class CacheLogger {

  constructor(RedisClient) {
    // pass in RedisClient as parameter
    this.c = RedisClient
  }

  async setCacheLog(taskName, state, noNumUpdate=false) {
    let c = this.c

    let logState = ''
    if (state == 1) {
      logState = 'DONE'
    } else if (state == 0) {
      logState = 'FAIL'
    } else if (state == 2) {
      logState = 'RUNNING'
    }

    let key = taskName
    // init empty value
    let value = ''
    let exists = await c.keyExists(key)
    if (!exists) {
      value = taskName + ',1,' + logState
      await c.setKey(key, value)
    } else {
      let cachedLog = await c.getKey(key)
      let logList = cachedLog.split(',')
      let taskNum = parseInt(logList[1])

      if (noNumUpdate) {
        value = taskName + ',' + String(taskNum) + ',' + logState
      } else {
        let newTaskNum = taskNum + 1
        value = taskName + ',' + String(newTaskNum) + ',' + logState
      }

      await c.setKey(key, value)
    }

  }

  async setMassCacheLog(taskName, dataInfo) {
    let c = this.c

    let logExists = await c.keyExists(taskName)
    if (!logExists) {
      await this.setCacheLog(taskName, 2, true)
    }

    let cachedLog = await c.getKey(taskName)
    let logList = cachedLog.split(',')
    let taskNum = parseInt(logList[1])

    let key = taskName + ':' + String(taskNum)

    if (taskNum % 10 == 1) {
      for (let i=1; i < 11; i++) {
        let toDelTaskNum = String(taskNum - 1)
        let toDelKey = taskName + ':' + toDelTaskNum
        let exists = await c.keyExists(toDelKey)
        if (exists) {
          await c.delKey(toDelKey)
        } else {
          break
        }
      }
    }

    let keyExists = await c.keyExists(key)
    if (!keyExists) {
      let cacheData = [key, dataInfo]
      await c.setList(cacheData)
    } else {
      await c.addToList(key, dataInfo)
    }

  }

}

module.exports = {
  CacheLogger: CacheLogger
}
