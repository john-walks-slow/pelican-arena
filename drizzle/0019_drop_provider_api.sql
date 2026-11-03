-- 将存量关联到 api 的题解迁移到对应厂商（Claude -> Anthropic，GPT -> OpenAI，其余默认 OpenAI）
UPDATE `submissions` SET `provider_id` = 'anthropic' WHERE `provider_id` = 'api' AND `model_id` LIKE 'claude%';
UPDATE `submissions` SET `provider_id` = 'openai' WHERE `provider_id` = 'api' AND `model_id` LIKE 'gpt%';
UPDATE `submissions` SET `provider_id` = 'openai' WHERE `provider_id` = 'api';

-- 删除 API 兜底项
DELETE FROM `providers` WHERE `id` = 'api';
