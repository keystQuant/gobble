const axios = require('axios');

const CONFIG = require('./config.js');

const GATEWAY_IP = CONFIG.ip.gateway;


class API {
  constructor() {
    this.datesAPI = `http://${GATEWAY_IP}/stock-api/date/?page=`;
    this.statesAPI = `http://${GATEWAY_IP}/hidden-api/gateway-states/`;
  }

  async getDates(pageNum, url = false) {
    let fullDatesAPI = '';
    if (url == false) {
      fullDatesAPI = this.datesAPI + pageNum;
    } else {
      fullDatesAPI = url;
    }
    return axios.get(fullDatesAPI);
  }

  async retrieveAllDates() {
    // this method is used so crawlers know on what date they should crawl data
    const allDates = []; // save all dates here
    let nextURL = this.datesAPI + 1; // first request URL
    // empty variables
    let datesData = '';
    let datesDataResult = '';
    // start looping
    while (nextURL != null) {
      console.log(nextURL);
      datesData = await this.getDates(0, nextURL);
      nextURL = datesData.data.next;
      datesDataResult = datesData.data.results;
      for (const dateData of datesDataResult) {
        const dateDataPoint = dateData.date;
        allDates.push(dateDataPoint);
      }
    }
    return allDates;
  }

  async saveState(taskName, log) {
    const todayDate = new Date().toISOString().slice(0, 10).replace(/-/gi, '');
    const stateData = {
      date: todayDate,
      task_name: taskName,
      state: 'P',
      log,
    };
    const res = await axios.post(this.statesAPI, stateData);
    return res;
  }
}

module.exports = {
  API,
};
