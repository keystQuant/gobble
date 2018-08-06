const puppeteer = require('puppeteer');
const axios = require('axios');
const CONFIG = require('./config.js');

const GATEWAY_IP = CONFIG.ip.gateway;

String.prototype.format = function () {
  // es5 synatax
  // finds '{}' within string values and replaces them with
  // given parameter values in the .format method
  let formatted = this;
  for (let i = 0; i < arguments.length; i++) {
    const regexp = new RegExp(`\\{${i}\\}`, 'gi');
    formatted = formatted.replace(regexp, arguments[i]);
  }
  return formatted;
};

// define all the api endpoints here
const URL = {
  LOGIN_PAGE: 'https://www.fnguide.com/home/login',
  DATE_PAGE: 'http://www.fnguide.com/fgdd/StkIndmByTime#multivalue=CJA005930|CII.001&adjyn=Y&multiname=삼성전자|종합주가지수',
  MKTCAP_PAGE: 'http://www.fnguide.com/fgdd/StkItemDateCap#tab=D&market=0',
  API: {
    date: 'http://www.fnguide.com/api/Fgdd/StkIndMByTimeGrdData?IN_MULTI_VALUE=CJA005930%2CCII.001&IN_START_DT=20000101&IN_END_DT={0}&IN_DATE_TYPE=D&IN_ADJ_YN=Y',
    kospi_tickers: 'http://www.fnguide.com/api/Fgdd/StkIndByTimeGrdDataDate?IN_SEARCH_DT={0}&IN_SEARCH_TYPE=J&IN_KOS_VALUE=1',
    kosdaq_tickers: 'http://www.fnguide.com/api/Fgdd/StkIndByTimeGrdDataDate?IN_SEARCH_DT={0}&IN_SEARCH_TYPE=J&IN_KOS_VALUE=2',
    index: 'http://www.fnguide.com/api/Fgdd/StkIndByTimeGrdDataDate?IN_SEARCH_DT={0}&IN_SEARCH_TYPE=I&IN_KOS_VALUE=0',
    etf: 'http://www.fnguide.com/api/Fgdd/StkEtfGrdDataDate?IN_TRD_DT={0}&IN_MKT_GB=0',
    ohlcv: 'http://www.fnguide.com/api/Fgdd/StkIndByTimeGrdDataDate?IN_SEARCH_DT={0}&IN_SEARCH_TYPE=J&IN_KOS_VALUE=0',
    buysell: 'http://www.fnguide.com/api/Fgdd/StkJInvTrdTrendGrdDataDate?IN_MKT_TYPE=0&IN_TRD_DT={0}&IN_UNIT_GB=2',
    factor: 'http://www.fnguide.com/api/Fgdd/StkDateShareIndxGrdDataDate?IN_SEARCH_DT={0}&IN_MKT_TYPE=0&IN_CONSOLIDATED=1',
  },
};


class Puppet {
  constructor(taskName) {
    this.taskName = taskName;

    // user id and pw
    this.id = 'keystone2016';
    this.pw = 'keystone2016';

    // width and height definitions for non-headless mode
    this.width = 1920;
    this.height = 1080;

    this.todayDate = new Date().toISOString().slice(0, 10).replace(/-/gi, '');
  }

  async startBrowser(headless_bool, slowMo_time = 100) {
    // set attribute values to local variables for ease of use
    const width = this.width;
    const height = this.height;

    // sets the browser attribute
    if (headless_bool == true) {
      var puppeteerConfig = {
        headless: headless_bool,
        args: ['--no-sandbox'],
        slowMo: slowMo_time,
      };
    } else if (headless_bool == false) {
      var puppeteerConfig = {
        headless: headless_bool,
        args: ['--no-sandbox'],
        slowMo: slowMo_time,
        args: ['--window-size=${width}, ${height}'],
      };
    }
    this.browser = await puppeteer.launch(puppeteerConfig);
    this.page = await this.browser.newPage();

    await this.page.setViewport({ width, height });
    return true;
  }

  async login() {
    // go to login page and login
    const page = this.page;

    const IDInputSelector = '#txtID';
    const PWInputSelector = '#txtPW';
    const loginBtnSelector = '#container > div > div > div.log--wrap > div.log--area > form > div > fieldset > button';
    const logoutOtherIPUserBtnSelector = '#divLogin > div.lay--popFooter > form > button.btn--back';
    const FnguideLogoSelector = 'body > div.header > div > h1 > a';
    // const userIDSelector = 'body > div.header > div > div.util > p > span:nth-child(1)'
    await page.goto(URL.LOGIN_PAGE);
    await page.waitForSelector(IDInputSelector);
    await page.click(IDInputSelector);
    await page.type(IDInputSelector, this.id);
    await page.click(PWInputSelector);
    await page.type(PWInputSelector, this.pw);
    await page.click(loginBtnSelector);

    const logoutOtherIPUserBtnExists = await page.$eval(
      logoutOtherIPUserBtnSelector,
      el => (!!el),
    ).catch((error) => { console.log(error); });
    if (logoutOtherIPUserBtnExists) {
      await page.click(logoutOtherIPUserBtnSelector);
    }

    // issues with waitForSelector
    // force wait for 5 seconds before waitForSelector
    // initially waited for userIDSelector but didn't work
    // so now waiting for FnguideLogoSelector
    // console.log('page waiting 5 secs')
    await page.waitFor(5000)
      .then(() => {
        page.waitForSelector(FnguideLogoSelector).then().catch();
      });
    // console.log('page waited 5 secs')
    // await page.waitForSelector(FnguideLogoSelector, { timeout: 5000 })
  }

  async massDateCrawl() {
    const page = this.page;

    // set headers to fool Fnguide
    await page.setExtraHTTPHeaders({
      Referer: 'http://www.fnguide.com/fgdd/StkIndmByTime',
      'X-Requested-With': 'XMLHttpRequest',
    });
    const dateURL = URL.API.date.format(this.todayDate);
    await page.goto(dateURL);
    const dateData = await page.evaluate(() => {
      const data = JSON.parse(document.querySelector('body').innerText);
      return data;
    });

    return dateData;
  }

  async getKospiTickers() {
    const page = this.page;

    // set headers to fool Fnguide
    await page.setExtraHTTPHeaders({
      Referer: 'http://www.fnguide.com/fgdd/StkIndByTime',
      'X-Requested-With': 'XMLHttpRequest',
    });
    const kospiTickersURL = URL.API.kospi_tickers.format(this.todayDate);
    await page.goto(kospiTickersURL);
    const kospiTickersData = await page.evaluate(() => {
      const data = JSON.parse(document.querySelector('body').innerText);
      return data
    });

    return kospiTickersData;
  }

  async getKosdaqTickers() {
    const page = this.page;

    // set headers to fool Fnguide
    await page.setExtraHTTPHeaders({
      Referer: 'http://www.fnguide.com/fgdd/StkIndByTime',
      'X-Requested-With': 'XMLHttpRequest',
    });
    const kosdaqTickersURL = URL.API.kosdaq_tickers.format(this.todayDate);
    await page.goto(kosdaqTickersURL);
    const kosdaqTickersData = await page.evaluate(() => {
      const data = JSON.parse(document.querySelector('body').innerText);
      return data
    });

    return kosdaqTickersData;
  }

  async massIndexCrawl(date) {
    const page = this.page;

    // set headers to fool Fnguide
    await page.setExtraHTTPHeaders({
      Referer: 'http://www.fnguide.com/fgdd/StkIndByTime',
      'X-Requested-With': 'XMLHttpRequest',
    });

    // let indexURL = URL.API.index.format(this.todayDate)
    const indexURL = URL.API.index.format(date);
    await page.goto(indexURL);
    const indexData = await page.evaluate(() => {
      const data = JSON.parse(document.querySelector('body').innerText);
      return data;
    });

    return indexData;
  }

  async massOHLCVCrawl(date) {
    const page = this.page;

    // set headers to fool Fnguide
    await page.setExtraHTTPHeaders({
      Referer: 'http://fnguide.com/fgdd/StkIndByTime',
      'X-Requested-With': 'XMLHttpRequest',
    });

    // let indexURL = URL.API.index.format(this.todayDate)
    const ohlcvURL = URL.API.ohlcv.format(date);
    await page.goto(ohlcvURL);
    const ohlcvData = await page.evaluate(() => {
      const data = JSON.parse(document.querySelector('body').innerText);
      return data;
    });

    return ohlcvData;
  }

  async massBuysellCrawl(date) {
    const page = this.page;

    // set headers to fool Fnguide
    await page.setExtraHTTPHeaders({
      Referer: 'http://fnguide.com/fgdd/StkJInvTrdTrend',
      'X-Requested-With': 'XMLHttpRequest',
    });

    const buysellURL = URL.API.buysell.format(date);
    await page.goto(buysellURL);
    const buysellData = await page.evaluate(() => {
      const data = JSON.parse(document.querySelector('body').innerText);
      return data;
    });

    return buysellData;
  }

  async massFactorCrawl(date) {
    const page = this.page;

    // set headers to fool Fnguide
    await page.setExtraHTTPHeaders({
      Referer: 'http://www.fnguide.com/fgdd/StkDateShareIndx',
      'X-Requested-With': 'XMLHttpRequest',
    });

    const factorURL = URL.API.factor.format(date);
    await page.goto(factorURL);
    const factorData = await page.evaluate(() => {
      const data = JSON.parse(document.querySelector('body').innerText);
      return data;
    });

    return factorData;
  }

  async done() {
    await this.browser.close();
  }
}

module.exports = {
  Puppet,
};
