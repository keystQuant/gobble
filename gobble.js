// start js-gobble server on Gobble Server in a Docker container
const express = require('express')

// gobble specific imports
const { CONFIG } = require('./src')

const app = express()

const server = app.listen(3000, () => {
  console.log(CONFIG)
})

app.get('/', async (req, res) => {
  res.send('DONE')
})
