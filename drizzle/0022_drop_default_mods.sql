-- 清理存量题解对默认增强的引用
DELETE FROM `submission_mods` WHERE `mod_id` IN ('联网搜索', 'mcp', 'skills', '多轮修改', '图片输入');

-- 从 mods 表中删除默认增强选项
DELETE FROM `mods` WHERE `id` IN ('联网搜索', 'mcp', 'skills', '多轮修改', '图片输入');
