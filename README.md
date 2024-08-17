# Bybit orderbook alerts

A watcher script to observe whether a ticker continously satisfy the ~~extortion~~ rules listed in https://www.bybit.com/en/help-center/article/Spot-Project-Rules-and-Management-Guideline

Alerts are sent to a telegram chat, see `.env.example` for details.

## Running

``` sh
docker build -t bybit-alert .
docker run -it --rm \ 
    -e SYMBOL=BTC/USDT \ 
    -e BOT_TOKEN=<your bot token> \ 
    -e CHAT_ID=12345 \ 
    -e BYBIT_CLIENT_ID=JnJLokKbpFo \ 
    -e BYBIT_CLIENT_SECRET=H7S82G0ArvVKiJMrvTg/gw bybit-alert
```

