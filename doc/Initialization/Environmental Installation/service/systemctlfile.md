sudo vim /etc/systemd/system/tg-gramjs.service

[Unit]
Description=TgCustomerGramjs Service
After=network.target

[Service]
Type=exec
WorkingDirectory=/opt/ifey/tg-node-service/TgCustomerGramjs/Kyber/TgMain/src
ExecStart=/root/.nvm/versions/node/v22.11.0/bin/node index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tg-gramjs

[Install]
WantedBy=multi-user.target

sudo chown -R root:root /opt/ifey/tg-node-service/TgCustomerGramjs
sudo chmod -R 755 /opt/ifey/tg-node-service/TgCustomerGramjs

sudo systemctl daemon-reload
sudo systemctl start tg-gramjs
sudo systemctl enable tg-gramjs
sudo systemctl status tg-gramjs
# 查看服务状态
sudo journalctl -u tg-gramjs -f  # 实时日志
sudo journalctl -u tg-gramjs --since "1 hour ago"  # 最近1小时的日志