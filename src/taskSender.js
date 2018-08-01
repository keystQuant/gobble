const axios = require('axios');
const CONFIG = require('./config.js');


const IP = CONFIG.ip.gateway;


class TaskSender {
  constructor(CacheLogger, env = 'remote') {
    // pass in CacheLogger to log task send responses
    this.gatewayIP = IP;
    if (env == 'remote') {
      this.taskURL = `http://${IP}/hidden-api/legacy-task/?type=`;
    } else if (env == 'local') {
      this.taskURL = 'http://127.0.0.1:8000/hidden-api/legacy-task/?type=';
    }

    this.logger = CacheLogger;
  }

  setCurrentTask(taskName) {
    this.currentTask = taskName;
  }

  async _getTask(taskURL) {
    // named getData because sending request as GET request
    const getData = await axios.get(taskURL);
    return getData;
  }

  async sendNextTask(nextTask) {
    const taskURL = this.taskURL + nextTask;

    const taskCacheKey = `${this.currentTask}_SEND_TASK`;
    await this._getTask(taskURL)
      .then((response) => {
        if (response.data.status == 'DONE') {
          this.logger.setCacheLog(taskCacheKey, 1);
        } else if (response.data.staus == 'FAIL') {
          this.logger.setCacheLog(taskCacheKey, 0);
        } else if (response.data.status == (`NO ACTION: ${nextTask}`)) {
          this.logger.setCacheLog(taskCacheKey, 0);
        }
      })
      .catch((error) => {
        this.logger.setCacheLog(taskCacheKey, 0);
      });
  }
}

module.exports = {
  TaskSender,
};
