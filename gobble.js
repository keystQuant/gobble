// start js-gobble server on Gobble Server in a Docker container
const express = require('express')

// gobble specific imports
const { CONFIG, CACHE } = require('./src')

const cache = new CACHE.RedisClient()
const app = express()

const server = app.listen(3000, async () => {
  console.log('Gobble server started on port 3000')
  let cacheAuth = await cache.auth()
  console.log(`Cache connected: ${cacheAuth}`)
})

app.get('/', async (req, res) => {
  res.send('DONE')
})

app.get('/set-cache/:keyval', async (req, res) => {
  let keyval = req.params.keyval.split(':')
  let key = keyval[0]
  let val = keyval[1]
  await cache.setKey(key, val)
  res.send('SUCCESS')
})

app.get('/get-cache/:key', async (req, res) => {
  let key = req.params.key
  let val = await cache.getKey(key)
  res.send(val)
})
