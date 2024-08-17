FROM node:22
MAINTAINER Silur <silur@cryptall.co>
WORKDIR /tmp/app
RUN chown 1000:1000 /tmp/app
USER 1000
COPY --chown=1000:1000 . .
RUN npm install --verbose
ENTRYPOINT ["node", "bot.js"]
