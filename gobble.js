// start js-gobble server on Gobble Server in a Docker container
//kill $(ps ax | grep '[j]s' | awk '{ print $1 }')     --> reload atom
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

const cache = new CACHE.RedisClient()
const logger = new LOGGER.CacheLogger(cache)
const taskSender = new TASKSENDER.TaskSender(logger, 'remote') // change to 'local' when testing
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

const massCrawlTask = async (req, res) => {
  // 1. define taskName and dataType
  let taskName = req.url.split('/')[1]
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
    console.log(`${taskName} task done`)
    res.status(200)
    res.send('NO DATE TO UPDATE')
  }

  // continue if dates exist
  let status = 'NONE'

  // common puppet tasks:

  // 1. start fnguide puppet
  let fn = new FNGUIDE.Puppet(taskName)
  await fn.startBrowser(true, 100) // set to false when 'local'
  .then( response => { console.log(response) })
  .catch( error => { res.send(error) })
  // 2. login to fnguide as user
  await fn.login()
  .then( response => {
    // pass
  })
  .catch( error => {
    logger.setCacheLog(taskName, 0, true)
    res.status(501)
    res.send(error)
  })

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

    let sleepStatus = await axios.get('http://127.0.0.1:8000/hidden-api/legacy-task/?type=TIME_SLEEP')
    if (sleepStatus.data.status == 'DONE') {
      console.log('data crawled success: ' + date)
    }
  }

  // close puppet
  await fn.done()

  status = 'DONE'
  console.log(`${taskName} task done`)
  // await endingTask(taskName)
  res.status(200)
  res.send(status)
}


////// REAL TASK API'S START HERE //////
app.get('/MASS_DATE_CRAWL', async (req, res) => {
  console.log('MASS_DATE_CRAWL task received')
  // 1. define taskName
  let taskName = req.url.split('/')[1]
  // 2. start fnguide puppet
  let fn = new FNGUIDE.Puppet(taskName)
  await fn.startBrowser(true, 100) // set to false when 'local'
  .then( response => { console.log(response) })
  .catch( error => { res.send(error) })
  // 3. login to fnguide as user
  await fn.login()
  .then( response => {
    // pass
  })
  .catch( error => {
    logger.setCacheLog(taskName, 0, false)
    res.status(501) // not implemented error
    res.send(error)
  })
  // 4. get mass date API and close browser
  let dateData = await fn.massDateCrawl()
  await fn.done()
  // 5. save list data to cache
  let p = new PROCESSOR.Processor(dateData)
  let datesData = await p.processMassDate()

  await cache.setList(datesData)
  // 6. send data task to gateway server (MASS_DATE_SAVE)
  await taskSender.setCurrentTask(taskName)
  await taskSender.sendNextTask('MASS_DATE_SAVE')

  // log end process
  await logger.setCacheLog(taskName, 1, false)

  console.log('MASS_DATE_CRAWL task done')
  res.status(200)
  res.send('DONE')
})

app.get('/MASS_INDEX_CRAWL', async (req, res) => {
  massCrawlTask(req, req)
})

app.get('/MASS_OHLCV_CRAWL', async (req, res) => {
  massCrawlTask(req, req)
})

app.get('/MASS_BUYSELL_CRAWL', async (req, res) => {
  massCrawlTask(req, req)
})

app.get('/MASS_FACTOR_CRAWL', async (req, res) => {
  massCrawlTask(req, req)
})

// crawling all data once (daily, every 30 minutes if date updated)
app.get('/DAILY_CRAWL_ALL', async (req, res) => {
  let taskName = req.url.split('/')[1]
  // await runningTask(taskName, res)

  // 1. start fnguide puppet
  let fn = new FNGUIDE.Puppet('MASS_INDEX_CRAWL')
  await fn.startBrowser(true, 100) // set to false when 'local'
  .then( response => { console.log(response) })
  .catch( error => { res.send(error) })
  // 2. login to fnguide as user
  await fn.login()
  .then( response => {
    // pass
  })
  .catch( error => {
    res.status(501)
    res.send(error)
  })

  // get mass index API and close browser
  let crawledData = await fn.massIndexCrawl('20180705')
  // save list data to cache
  let p = new PROCESSOR.Processor(crawledData)
  let processedData = await p.processMassIndex('20180705')

  let testData = processedData[1]

  await api.saveState(taskName, testData)
  // await endingTask(taskName)
  res.status(200)
  res.send('DONE')
})
