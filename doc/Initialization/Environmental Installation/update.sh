#!/bin/bash
systemctl stop tg-gramjs.service
cd /opt/ifey/tg-node-service || exit
rm -rf TgCustomerGramjs/
git clone https://github.com/IfeyChan702/TgCustomerGramjs.git
cd TgCustomerGramjs/
npm install --force
npm install dotenv -force
npm install cross-env -force
npm install swagger-jsdoc swagger-ui-express --save -force
systemctl restart tg-gramjs.service

