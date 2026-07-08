-- UTR 查单：新增「渠道声称成功」标记列（幂等，可重复执行）
-- 用途：区分 ≥48h 未成功的两类工单
--   channel_claimed_success = 1 → 渠道判成功但平台不认（矛盾单）→ 报警监听群、转人工(ticket_status=2)
--   channel_claimed_success = 0 → 从头到尾没成功过（普通死单）→ 满48h 回商户「查单失败」
-- ticket_status 取值：0=处理中 1=已完成 2=待人工核实(矛盾)
-- 执行前请先备份 tg_order 表。用 Navicat / mysql 命令行执行（含存储过程，勿用不支持 DELIMITER 的工具）。

DROP PROCEDURE IF EXISTS __tg_order_conflict_flag_migrate;
DELIMITER $$
CREATE PROCEDURE __tg_order_conflict_flag_migrate()
BEGIN
    DECLARE db VARCHAR(64);
    SET db = DATABASE();

    IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'tg_order' AND COLUMN_NAME = 'channel_claimed_success') THEN
        ALTER TABLE tg_order ADD COLUMN channel_claimed_success TINYINT NOT NULL DEFAULT 0 COMMENT '渠道声称成功但平台未确认(矛盾单标记)';
    END IF;

    IF NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = db AND TABLE_NAME = 'tg_order' AND INDEX_NAME = 'idx_tg_order_ticket') THEN
        CREATE INDEX idx_tg_order_ticket ON tg_order (ticket_status, query_result);
    END IF;
END$$
DELIMITER ;

CALL __tg_order_conflict_flag_migrate();
DROP PROCEDURE __tg_order_conflict_flag_migrate;
