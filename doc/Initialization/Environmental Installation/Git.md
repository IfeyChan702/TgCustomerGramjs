git clone https://github.com/IfeyChan702/TgCustomerGramjs.git

pm2 start app.js --name "your-app-name"

#!/bin/bash
cd /opt/ifey/tg-node-service || exit
git pull origin main
npm install
pm2 restart your-app
