const api = require('./api.js')
const cache = require('./cache.js')
const cacheLogger = require('./cacheLogger.js')
const config = require('./config.js')
const fnguide = require('./fnguide.js')
const processor = require('./processor.js')
const taskSender = require('./taskSender.js')

module.exports = {
  API: api,
  CACHE: cache,
  CONFIG: config,
  FNGUIDE: fnguide,
  LOGGER: cacheLogger,
  PROCESSOR: processor,
  TASKSENDER: taskSender,
}
