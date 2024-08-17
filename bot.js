const ccxt = require('ccxt')
const logger = require('./logger')
const alert = require('./telegram')
const BYBIT_CLIENT_ID = process.env.BYBIT_CLIENT_ID
const BYBIT_CLIENT_SECRET = process.env.BYBIT_CLIENT_SECRET

const bybit = new ccxt.bybit({
  apiKey: BYBIT_CLIENT_ID,
  secret: BYBIT_CLIENT_SECRET
})

const SYMBOL = process.env.SYMBOL

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

if (!SYMBOL) {
  logger.error('SYMBOL is needed in env!')
  process.exit(1)
}

const market = {
  older: false,
  doubleSidedLiq: 0,
  ticker: null,
  orderBook: null,
  rollingLiq: new Array(8640).fill(0),
  rollingLiqCtr: 0,
  tradeDiffs: new Array(8640).fill(0),
  tradeDiffsCtr: 0,
  orderTradeRatios: new Array(8640).fill(0),
  orderTradeRatiosCtr: 0
}

async function fetchListingTime () {
  const since = bybit.milliseconds() - 86400000 * 40
  const trades = await bybit.fetchTrades(SYMBOL, since, 10)
  if (trades.length > 0) {
    market.older = true
    logger.info('Orderbook is older than 30 days, adjusting rules')
  }
}

async function checkDoubleSidedLiq () {
  const lastTradedPrice = market.ticker.last
  if (!lastTradedPrice) {
    logger.error('Failed to fetch last traded price')
    return null
  }
  logger.debug(`Last traded price was ${lastTradedPrice}`)
  logger.debug(`checking single-sided liquidity in 2% range: ${lastTradedPrice * 0.98} - ${lastTradedPrice * 1.02}`)

  const bids = market.orderBook.bids
    .filter((bid) => bid[0] >= lastTradedPrice * 0.98 && bid[0] <= lastTradedPrice * 1.02)
    .map((e) => e[1])
  const liq = bids.reduce((a, e) => a + e)
  market.rollingLiq[market.rollingLiqCtr++ % 8640] = liq
  const avgLiq = market.rollingLiq.reduce((a, e) => a + e, 0) / market.rollingLiq.length
  if (avgLiq < 1000 && market.rollingLiqCtr > 8640) {
    const alertMsg = 'The average daily single-sided liquidity within 2% of the last traded price is less than 1,000 USDT.'
    logger.warn(alertMsg)
    alert(alertMsg)
  }
}

async function checkTradedBid1Ask1 () {
  const lastTradedPrice = market.ticker.last
  if (!lastTradedPrice) {
    logger.error('Failed to fetch last traded price')
    return null
  }
  const diff = (1 - (market.ticker.bid / market.ticker.ask)) - 0.0000001
  logger.debug(`Avg daily difference between traded price and bid1/ask1: ${diff}`)
  market.tradeDiffs[market.tradeDiffsCtr++ % 8640] = diff
  const avgDiff = market.tradeDiffs.reduce((a, e) => a + e, 0) / market.tradeDiffs.length
  if (avgDiff < 1000 && market.tradeDiffsCtr > 8640) {
    const alertMsg = 'The average daily difference between the last traded price and bid1/ask1 is more than 1%.'
    logger.warn(alertMsg)
    alert(alertMsg)
  }
}

async function checkTakerVolume () {
  const since = bybit.milliseconds() - 86400000
  const trades = await bybit.fetchTrades(SYMBOL, since, 10000)
  const takerVolume = trades.filter((e) => e.side === 'sell').reduce((a, e) => a + e, 0)
  if (takerVolume < 3000) {
    const alertMsg = 'Daily taker volume is less than 3,000 USDT, and the daily trading frequency is less than 10%.'
    logger.warn(alertMsg)
    alert(alertMsg)
  }
  const orders = await (bybit.fetchOpenOrders(SYMBOL, since, 10000))
  const ratio = trades.length / orders.length
  market.orderTradeRatios[market.orderTradeRatiosCtr++ % 8640] = ratio
  if (ratio < 0.1) {
    const alertMsg = 'Daily taker volume is less than 3,000 USDT, and the daily trading frequency** is less than 10%.'
    logger.warn(alertMsg)
    alert(alertMsg)
  }
}

async function tick (i) {
  const orderBook = await bybit.fetchOrderBook(SYMBOL)
  const ticker = await bybit.fetch_ticker(SYMBOL)
  if (!orderBook) {
    logger.error('Failed to fetch orderbook, skipping iteration...')
    return
  }
  if (!ticker) {
    logger.error('Failed to fetch ticker, skipping iteration...')
    return
  }

  market.orderBook = orderBook
  market.ticker = ticker
  if (i % 10 == 0) { // 10 second mark
    try {
      await checkDoubleSidedLiq()
      await checkTradedBid1Ask1()
      await checkTakerVolume()
    } catch (e) {
      logger.error(e.toString())
    }
  }
}

;(async () => {
  await fetchListingTime()
  let i = 0
  while (true) {
    tick(i)
    await sleep(1000)
    i = (i + 1) % 60
  }
})()
