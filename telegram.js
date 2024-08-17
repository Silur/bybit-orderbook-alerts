const https = require('https')
const logger = require('./logger')

const BOT_TOKEN = process.env.BOT_TOKEN
const CHAT_ID = process.env.CHAT_ID

function alert (msg) {
  logger.debug(`Sending telegram alert to ${CHAT_ID}`)
  const postData = JSON.stringify({
    chat_id: CHAT_ID,
    text: msg
  })
  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }

  const req = https.request(options)
  req.on('error', (e) => {
    logger.error('Error sending message:', e)
  })

  req.write(postData)
  req.end()
}

module.exports = alert
