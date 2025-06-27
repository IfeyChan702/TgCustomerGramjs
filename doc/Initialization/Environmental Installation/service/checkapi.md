##  創建文件  vi /etc/systemd/system/check-api_tg.service
[Unit]
Description=Check api_tg API and Restart Service if Needed
After=network.target

[Service]
ExecStart=/opt/ifey/tg-node-service/check_api.sh
Restart=always
User=root

[Install]
WantedBy=multi-user.target


sudo systemctl daemon-reload
sudo systemctl start check-api_tg.service
sudo systemctl enable check-api_tg.service
sudo systemctl status check-api_tg.service

journalctl -u check-api_tg.service -f
