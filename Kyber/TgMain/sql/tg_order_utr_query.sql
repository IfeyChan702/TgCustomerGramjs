-- UTR 代收查单：tg_order 补齐所需列（幂等版，已存在的列/索引自动跳过）
-- 适用于生产库/测试库：
--   * 生产库已有 target_chat_id → 自动跳过，只补 UTR 相关新列
--   * 新代码需要的全部列一次补齐，可重复执行
-- 执行前请先备份 tg_order 表。用 Navicat / mysql 命令行执行（含存储过程，勿用不支持 DELIMITER 的工具）。
--
-- 列说明：
--   target_chat_id      目标(渠道群)chatId（master 转发/回复查询逻辑使用）
--   platform_order_no   平台订单号（order-in/get 的 orderNo）
--   amount              订单金额
--   order_created_time  订单创建时间（48h 规则基准，来自接口 createTime）
--   utr                 UTR
--   matched_order_no    UTR 匹配到的商户单号（暂留空）
--   status_code         接口订单状态码（10待收款/11收款成功/12分润完成/30已取消...）
--   query_result        查单结果：处理中 / 查单成功 / 查单失败
--   ticket_status       工单状态：0=处理中 1=已完成
--   next_retry_time     下次自动重查时间
--   retry_count         已自动重查次数

DROP PROCEDURE IF EXISTS __tg_order_utr_migrate;
DELIMITER $$
CREATE PROCEDURE __tg_order_utr_migrate()
BEGIN
    DECLARE db VARCHAR(64);
    SET db = DATABASE();

    IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'tg_order' AND COLUMN_NAME = 'target_chat_id') THEN
        ALTER TABLE tg_order ADD COLUMN target_chat_id BIGINT NULL COMMENT '目标(渠道群)chatId' AFTER merchant_order_id;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'tg_order' AND COLUMN_NAME = 'platform_order_no') THEN
        ALTER TABLE tg_order ADD COLUMN platform_order_no VARCHAR(64) NULL COMMENT '平台订单号';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'tg_order' AND COLUMN_NAME = 'amount') THEN
        ALTER TABLE tg_order ADD COLUMN amount DECIMAL(20, 2) NULL COMMENT '订单金额';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'tg_order' AND COLUMN_NAME = 'order_created_time') THEN
        ALTER TABLE tg_order ADD COLUMN order_created_time DATETIME NULL COMMENT '订单创建时间(接口createTime)';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'tg_order' AND COLUMN_NAME = 'utr') THEN
        ALTER TABLE tg_order ADD COLUMN utr VARCHAR(64) NULL COMMENT 'UTR';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'tg_order' AND COLUMN_NAME = 'matched_order_no') THEN
        ALTER TABLE tg_order ADD COLUMN matched_order_no VARCHAR(64) NULL COMMENT 'UTR匹配到的商户单号';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'tg_order' AND COLUMN_NAME = 'status_code') THEN
        ALTER TABLE tg_order ADD COLUMN status_code INT NULL COMMENT '接口订单状态码';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'tg_order' AND COLUMN_NAME = 'query_result') THEN
        ALTER TABLE tg_order ADD COLUMN query_result VARCHAR(16) NULL COMMENT '查单结果:处理中/查单成功/查单失败';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'tg_order' AND COLUMN_NAME = 'ticket_status') THEN
        ALTER TABLE tg_order ADD COLUMN ticket_status TINYINT NOT NULL DEFAULT 0 COMMENT '工单状态:0处理中1已完成';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'tg_order' AND COLUMN_NAME = 'next_retry_time') THEN
        ALTER TABLE tg_order ADD COLUMN next_retry_time DATETIME NULL COMMENT '下次自动重查时间';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'tg_order' AND COLUMN_NAME = 'retry_count') THEN
        ALTER TABLE tg_order ADD COLUMN retry_count INT NOT NULL DEFAULT 0 COMMENT '自动重查次数';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'tg_order' AND INDEX_NAME = 'idx_tg_order_retry') THEN
        CREATE INDEX idx_tg_order_retry ON tg_order (ticket_status, next_retry_time);
    END IF;
END$$
DELIMITER ;

CALL __tg_order_utr_migrate();
DROP PROCEDURE __tg_order_utr_migrate;
