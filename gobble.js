// start js-gobble server on Gobble Server in a Docker container
// kill $(ps ax | grep '[j]s' | awk '{ print $1 }')     --> reload atom
// to kill puppeteer process: ps -A | grep <application_name> | awk '{print $1}' | xargs kill -9 $1
const express = require('express')
const axios = require('axios')

// gobble specific imports
const {
  API,
  CACHE,
  CONFIG,
  FNGUIDE,
  LOGGER,
  PROCESSOR,
  TASKSENDER,
} = require('./src')

const IP = CONFIG.ip.gateway
const RUN_ENV = 'remote' // change to 'local' when testing
const RUN_HEADLESS = true // change to 'false' when local

const cache = new CACHE.RedisClient()
const logger = new LOGGER.CacheLogger(cache)
const taskSender = new TASKSENDER.TaskSender(logger, RUN_ENV)
const api = new API.API()

const app = express()

const server = app.listen(8080, async () => {
  console.log('Gobble server started on port 8080')
  let cacheAuth = await cache.auth()
  console.log(`Cache connected: ${cacheAuth}`)
})

app.get('/', async (req, res) => {
  res.send('DONE')
})

//////////////////////////
// start test endpoints //
//////////////////////////
app.get('/set-cache/:keyval', async (req, res) => {
  let keyval = req.params.keyval.split(':')
  let key = keyval[0]
  let val = keyval[1]
  await cache.setKey(key, val)
  await logger.setCacheLog('SET_CACHE', 1)
  res.send('SUCCESS')
})

app.get('/get-cache/:key', async (req, res) => {
  let key = req.params.key
  let val = await cache.getKey(key)
  await logger.setCacheLog('GET_CACHE', 1)
  res.send(val)
})

app.get('/del-cache/:key', async (req, res) => {
  let key = req.params.key
  let delRes = await cache.delKey(key)
  await logger.setCacheLog('DEL_CACHE', 1)
  delRes = delRes ? 'DONE' : 'ERROR'
  res.send(delRes)
})
////////////////////////
// end test endpoints //
////////////////////////

// functions here
const runningTask = async (taskName, res) => {
  let taskStartKey = `${taskName}_RUNNING`
  let taskStartKeyExists = await cache.keyExists(taskStartKey)
  if (taskStartKeyExists) {
    let taskStartKeyValue = await cache.getKey(taskStartKey)
    if (taskStartKeyValue == 'RUNNING') {
      res.status(501)
      res.send('PROCESS_ALREADY_RUNNING')
      return 'KILL'
    } else if (taskStartKeyValue == 'STOPPED') {
      await cache.setKey(taskStartKey, 'RUNNING')
    }
  } else {
    await cache.setKey(taskStartKey, 'RUNNING')
  }
}

const endingTask = async (taskName) => {
  let taskStartKey = `${taskName}_RUNNING`
  cache.setKey(taskStartKey, 'STOPPED')
}

const pollingSignal = async (signal) => {
  console.log('polling gateway for start signal')
  let startSignal = 'WAIT'
  let signalExists = await cache.keyExists(signal)
  if (signalExists) {
    let signalMSG = await cache.getKey(signal)
    if (signalMSG == 'START') {
      startSignal = 'START'
    }
  } else {
    startSignal = 'WAIT'
  }
  return startSignal
}

const StartFnBrowser = async (req, res, taskName) => {
  // start fnguide puppet
  let fn = new FNGUIDE.Puppet(taskName)
  await fn.startBrowser(RUN_HEADLESS, 100)
  .then( response => { console.log(response) })
  .catch( error => { res.send(error) })
  // 3. login to fnguide as user
  await fn.login()
  .then( response => {
    // pass
  })
  .catch( error => {
    logger.setCacheLog(taskName, 0, false)
    fn.done()
    res.status(501) // not implemented error
    res.send(error)
  })

  return fn // returns fn puppet
}

const massDateCrawlTask = async (req, res, fn='NONE') => {
  console.log('MASS_DATE_CRAWL task received')
  // 1. define taskName
  let taskName = req.url.split('/')[1]

  // 2. start fnguide puppet
  if (fn == 'NONE') {
    fn = await StartFnBrowser(req, res, taskName)
  }

  // 3. get mass date API and close browser
  let dateData = await fn.massDateCrawl()

  // 4. save list data to cache
  let p = new PROCESSOR.Processor(dateData)
  let datesData = await p.processMassDate()

  await cache.setList(datesData)
  // 5. send data task to gateway server (MASS_DATE_SAVE)
  await taskSender.setCurrentTask(taskName)
  await taskSender.sendNextTask('MASS_DATE_SAVE')

  // log end process
  await logger.setCacheLog(taskName, 1, false)

  console.log('MASS_DATE_CRAWL task done')

  return fn // return fnguide browser so process can turn off
}

const massCrawlTask = async (req, res, fn='NONE', taskName='NONE') => {
  // 1. define taskName and dataType
  if (taskName == 'NONE') {
    taskName = req.url.split('/')[1]
  }
  // await runningTask(taskName, res)
  let dataType = taskName.split('_')[1]

  console.log(`${taskName} task received`)

  // 2. define all necessary variables that are used within the function
  let setDatesTask = `SET_MASS_${dataType}_DATES`
  let signal = `MASS_${dataType}_CRAWL_SIGNAL`
  let datesListKey = `MASS_${dataType}_CRAWL_DATES`
  let saveTask = `MASS_${dataType}_SAVE`

  // set mass index dates
  await taskSender.setCurrentTask(taskName) // task sender set to local or remote
  await taskSender.sendNextTask(setDatesTask)

  let startSignal = await pollingSignal(signal)
  while (startSignal == 'WAIT') {
    startSignal = await pollingSignal(signal)
  }
  // delete signal after polling
  await cache.delKey(signal)

  let dates = await cache.getList(datesListKey)
  if (dates.length == 0) {
    console.log('NO DATE TO UPDATE')
    console.log(`${taskName} task done`)
  }

  // common puppet tasks:

  // 1. start fnguide puppet
  if (fn == 'NONE') {
    fn = await StartFnBrowser(req, res, taskName)
  }

  for (let date of dates) {

    let processedData = ''

    if (taskName == 'MASS_INDEX_CRAWL') {
      // get mass index API and close browser
      let crawledData = await fn.massIndexCrawl(date)
      // save list data to cache
      let p = new PROCESSOR.Processor(crawledData)
      processedData = await p.processMassIndex(date)
    }

    else if (taskName == 'MASS_OHLCV_CRAWL') {
      // get mass index API and close browser
      let crawledData = await fn.massOHLCVCrawl(date)
      // save list data to cache
      let p = new PROCESSOR.Processor(crawledData)
      processedData = await p.processMassOHLCV(date)
    }

    else if (taskName == 'MASS_BUYSELL_CRAWL') {
      // get mass index API and close browser
      let crawledData = await fn.massBuysellCrawl(date)
      // save list data to cache
      let p = new PROCESSOR.Processor(crawledData)
      processedData = await p.processMassBuysell(date)
    }

    else if (taskName == 'MASS_FACTOR_CRAWL') {
      // get mass index API and close browser
      let crawledData = await fn.massFactorCrawl(date)
      // save list data to cache
      let p = new PROCESSOR.Processor(crawledData)
      processedData = await p.processMassFactor(date)
    }

    await cache.setList(processedData)
    // send data task to gateway server (MASS_INDEX_SAVE)
    await taskSender.setCurrentTask(taskName)
    await taskSender.sendNextTask(saveTask)

    // add date to mass cache lot
    await logger.setMassCacheLog(taskName, date)

    let sleepURL = ''
    if (RUN_ENV == 'remote') {
      sleepURL = `http://${IP}/hidden-api/legacy-task/?type=TIME_SLEEP`
    } else if (RUN_ENV == 'local') {
      sleepURL = 'http://127.0.0.1:8000/hidden-api/legacy-task/?type=TIME_SLEEP'
    }
    let sleepStatus = await axios.get(sleepURL)
    if (sleepStatus.data.status == 'DONE') {
      console.log('data crawled success: ' + date)
    }
  }

  console.log(`${taskName} task done`)
  // await endingTask(taskName)

  return fn // return fnguide browser so process can turn off
}


////// REAL TASK API'S START HERE //////
app.get('/MASS_DATE_CRAWL', async (req, res) => {
  let fnBrowser = await massDateCrawlTask(req, res, 'NONE')
  await fnBrowser.done()
  res.status(200)
  res.send('DONE')
})

app.get('/MASS_INDEX_CRAWL', async (req, res) => {
  let fnBrowser = await massCrawlTask(req, res, 'NONE', 'NONE')
  await fnBrowser.done()
  res.status(200)
  res.send('DONE')
})

app.get('/MASS_OHLCV_CRAWL', async (req, res) => {
  let fn = await massCrawlTask(req, res, 'NONE', 'NONE')
  await fn.done()
  res.status(200)
  res.send('DONE')
})

app.get('/MASS_BUYSELL_CRAWL', async (req, res) => {
  let fn = await massCrawlTask(req, res, 'NONE', 'NONE')
  await fn.done()
  res.status(200)
  res.send('DONE')
})

app.get('/MASS_FACTOR_CRAWL', async (req, res) => {
  let fn = await massCrawlTask(req, res, 'NONE', 'NONE')
  await fn.done()
  res.status(200)
  res.send('DONE')
})

// crawling all data once (daily, every 30 minutes if date updated)
app.get('/DAILY_CRAWL_ALL', async (req, res) => {
  let taskLog = ''

  let taskName = req.url.split('/')[1]
  await runningTask(taskName, res)

  // 1. MASS_DATE_CRAWL (Node)
  let fn = await massDateCrawlTask(req, res, 'NONE')
  taskLog = 'MASS_DATE_CRAWL'

  let keystDates = await cache.getList('keyst_dates')
  let mostCurrentDate = keystDates[0]
  taskLog = taskLog + `(${mostCurrentDate})`

  // 2. check most recent db updates
  let updatesURL = ''
  if (RUN_ENV == 'remote') {
    updatesURL = `http://${IP}/hidden-api/legacy-task/?type=SET_RECENT_UPDATE_DATES`
  } else if (RUN_ENV == 'local') {
    updatesURL = 'http://127.0.0.1:8000/hidden-api/legacy-task/?type=SET_RECENT_UPDATE_DATES'
  }
  let setState = await axios.get(updatesURL)

  let tasksList = []
  if (setState.data.status == 'DONE') {
    let recentIndexDate = await cache.getKey('RECENT_INDEX_DATE')
    let recentOhlcvDate = await cache.getKey('RECENT_OHLCV_DATE')
    let recentBuysellDate = await cache.getKey('RECENT_BUYSELL_DATE')
    let recentFactorDate = await cache.getKey('RECENT_FACTOR_DATE')
    console.log('Recent Index data update date: ' + recentIndexDate)
    console.log('Recent OHLCV data update date: ' + recentOhlcvDate)
    console.log('Recent BuySell data update date: ' + recentBuysellDate)
    console.log('Recent Factor data update date: ' + recentFactorDate)
    taskLog = taskLog + ` Index: ${recentIndexDate} OHLCV: ${recentOhlcvDate} BuySell: ${recentBuysellDate} Factor: ${recentFactorDate}`

    if (recentIndexDate != mostCurrentDate) {
      tasksList.push('MASS_INDEX_CRAWL')
    }

    if (recentOhlcvDate != mostCurrentDate) {
      tasksList.push('MASS_OHLCV_CRAWL')
    }

    if (recentBuysellDate != mostCurrentDate) {
      tasksList.push('MASS_BUYSELL_CRAWL')
    }

    if (recentFactorDate != mostCurrentDate) {
      tasksList.push('MASS_FACTOR_CRAWL')
    }
  }

  if (tasksList.length != 0) {
    // only run task loop when there are data needed for update
    for (let task of tasksList) {
      fn = await massCrawlTask(req, res, fn, task)
      taskLog = taskLog + ` ${task}`
    }
  }

  await fn.done()
  await endingTask(taskName)
  await api.saveState(taskName, taskLog)
  // await endingTask(taskName)
  res.status(200)
  res.send('DONE')
})
