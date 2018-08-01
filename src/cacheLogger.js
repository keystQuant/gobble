class CacheLogger {
  constructor(RedisClient) {
    // pass in RedisClient as parameter
    this.c = RedisClient;
  }

  async setCacheLog(taskName, state, noNumUpdate = false) {
    const c = this.c;

    let logState = '';
    if (state == 1) {
      logState = 'DONE';
    } else if (state == 0) {
      logState = 'FAIL';
    } else if (state == 2) {
      logState = 'RUNNING';
    }

    const key = taskName;
    // init empty value
    let value = '';
    const exists = await c.keyExists(key);
    if (!exists) {
      value = `${taskName},1,${logState}`;
      await c.setKey(key, value);
    } else {
      const cachedLog = await c.getKey(key);
      const logList = cachedLog.split(',');
      const taskNum = parseInt(logList[1]);

      if (noNumUpdate) {
        value = `${taskName},${String(taskNum)},${logState}`;
      } else {
        const newTaskNum = taskNum + 1;
        value = `${taskName},${String(newTaskNum)},${logState}`;
      }

      await c.setKey(key, value);
    }
  }

  async setMassCacheLog(taskName, dataInfo) {
    const c = this.c;

    const logExists = await c.keyExists(taskName);
    if (!logExists) {
      await this.setCacheLog(taskName, 2, true);
    }

    const cachedLog = await c.getKey(taskName);
    const logList = cachedLog.split(',');
    const taskNum = parseInt(logList[1]);

    const key = `${taskName}:${String(taskNum)}`;

    if (taskNum % 10 == 1) {
      for (let i = 1; i < 11; i++) {
        const toDelTaskNum = String(taskNum - 1);
        const toDelKey = `${taskName}:${toDelTaskNum}`;
        const exists = await c.keyExists(toDelKey);
        if (exists) {
          await c.delKey(toDelKey);
        } else {
          break;
        }
      }
    }

    const keyExists = await c.keyExists(key);
    if (!keyExists) {
      const cacheData = [key, dataInfo];
      await c.setList(cacheData);
    } else {
      await c.addToList(key, dataInfo);
    }
  }
}

module.exports = {
  CacheLogger,
};
