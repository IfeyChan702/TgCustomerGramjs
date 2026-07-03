-- UTR 代收查单改造：tg_order 增加查单/工单相关列
-- 执行前请先备份 tg_order 表
-- 说明：
--   platform_order_no   平台订单号（order-in/get 返回的 orderNo）
--   amount              订单金额
--   order_created_time  订单创建时间（48h 规则基准，来自接口 createTime）
--   utr                 UTR（接口 utr 字段）
--   matched_order_no    UTR 实际匹配到的商户单号（③不一致时用，暂留空）
--   status_code         接口订单状态码（10待收款/11收款成功/12分润完成/30已取消...）
--   query_result        查单结果：处理中 / 查单成功 / 查单失败
--   ticket_status       工单状态：0=处理中 1=已完成
--   next_retry_time     下次自动重查时间（未支付且≤48h时使用）
--   retry_count         已自动重查次数

ALTER TABLE tg_order
    ADD COLUMN platform_order_no  VARCHAR(64)    NULL COMMENT '平台订单号' AFTER merchant_order_id,
    ADD COLUMN amount             DECIMAL(20, 2) NULL COMMENT '订单金额' AFTER platform_order_no,
    ADD COLUMN order_created_time DATETIME       NULL COMMENT '订单创建时间(接口createTime)' AFTER amount,
    ADD COLUMN utr                VARCHAR(64)    NULL COMMENT 'UTR' AFTER order_created_time,
    ADD COLUMN matched_order_no   VARCHAR(64)    NULL COMMENT 'UTR匹配到的商户单号' AFTER utr,
    ADD COLUMN status_code        INT            NULL COMMENT '接口订单状态码' AFTER matched_order_no,
    ADD COLUMN query_result       VARCHAR(16)    NULL COMMENT '查单结果:处理中/查单成功/查单失败' AFTER status_code,
    ADD COLUMN ticket_status      TINYINT        NOT NULL DEFAULT 0 COMMENT '工单状态:0处理中1已完成' AFTER query_result,
    ADD COLUMN next_retry_time    DATETIME       NULL COMMENT '下次自动重查时间' AFTER ticket_status,
    ADD COLUMN retry_count        INT            NOT NULL DEFAULT 0 COMMENT '自动重查次数' AFTER next_retry_time;

-- 便于定时任务扫描到期工单
CREATE INDEX idx_tg_order_retry ON tg_order (ticket_status, next_retry_time);
