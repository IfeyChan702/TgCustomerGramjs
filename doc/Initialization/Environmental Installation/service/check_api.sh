#!/bin/bash

# 目标 URL
URL="http://127.0.0.1:8087/api/open/test"

# 失败计数
FAIL_COUNT=0

# 最大失败次数（超过这个次数就重启服务）
MAX_FAILS=5

# 监控循环
while true; do
    # 使用 curl 进行请求，超时时间设置为 3 秒 (-m 3)
    RESPONSE=$(curl -s -m 3 -o /dev/null -w "%{http_code}" "$URL")

    # 检查 HTTP 状态码是否是 200
    if [ "$RESPONSE" == "200" ]; then
        echo "$(date) ✅ 请求成功，重置失败计数"
        FAIL_COUNT=0
    else
        echo "$(date) ❌ 请求失败 (状态码: $RESPONSE)，失败次数: $((FAIL_COUNT+1))"
        ((FAIL_COUNT++))
    fi

    # 如果失败次数达到阈值，则重启服务
    if [ "$FAIL_COUNT" -ge "$MAX_FAILS" ]; then
        echo "$(date) 🚨 连续 $MAX_FAILS 次失败，正在重启服务..."
        systemctl restart tg-gramjs.service
        FAIL_COUNT=0  # 重置失败计数
    fi

    # 每 5 秒执行一次
    sleep 5
done
