const axios = require('axios')

const CONFIG = require('./config.js')
const GATEWAY_IP = CONFIG.ip.gateway


class API {

  constructor() {
    this.datesAPI = 'http://' + GATEWAY_IP + '/stock-api/date/?page='
  }

  async getDates(pageNum, url=false) {
    let fullDatesAPI = ''
    if (url == false) {
      fullDatesAPI = this.datesAPI + pageNum
    } else {
      fullDatesAPI = url
    }
    return axios.get(fullDatesAPI)
  }

  async retrieveAllDates() {
    // this method is used so crawlers know on what date they should crawl data
    let allDates = [] // save all dates here
    let nextURL = this.datesAPI + 1 // first request URL
    // empty variables
    let datesData = ''
    let datesDataResult = ''
    // start looping
    while (nextURL != null) {
      console.log(nextURL)
      datesData = await this.getDates(0, nextURL)
      nextURL = datesData.data.next
      datesDataResult = datesData.data.results
      for (let dateData of datesDataResult) {
        let dateDataPoint = dateData.date
        allDates.push(dateDataPoint)
      }
    }
    return allDates
  }

}

module.exports = {
  API: API
}
