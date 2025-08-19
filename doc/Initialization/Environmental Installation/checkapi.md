##  創建文件  vi /etc/systemd/system/check-api.service
[Unit]
Description=Check API and Restart Service if Needed
After=network.target

[Service]
ExecStart=/opt/ifey/PayInOutWall/build/libs/check_api.sh
Restart=always
User=root

[Install]
WantedBy=multi-user.target