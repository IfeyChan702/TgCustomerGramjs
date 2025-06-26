#!/bin/bash
cd /opt/ifey/tg-node-service || exit
pm2 stop gramjs-bot
rm -rf TgCustomerGramjs/
git clone https://github.com/IfeyChan702/TgCustomerGramjs.git
cd TgCustomerGramjs/
npm install --force
npm install dotenv -force
npm install cross-env -force
cd
pm2 start /opt/ifey/tg-node-service/gramjs.config.js

