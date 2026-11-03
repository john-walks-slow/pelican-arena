-- 插入新增与改名后的 providers（去官方、去学生包、增 workbuddy / command code / opencode、中转站、公益站）
INSERT OR IGNORE INTO `providers` (`id`, `name`, `rank`, `category`) VALUES
  ('openai', 'OpenAI', 1, 'official'),
  ('anthropic', 'Anthropic', 2, 'official'),
  ('google-gemini', 'Google Gemini', 3, 'official'),
  ('xai-grok', 'xAI Grok', 4, 'official'),
  ('deepseek', 'DeepSeek', 5, 'official'),
  ('月之暗面-kimi', '月之暗面 Kimi', 6, 'official'),
  ('智谱-glm', '智谱 GLM', 7, 'official'),
  ('阿里通义千问', '阿里通义千问', 8, 'official'),
  ('minimax', 'MiniMax', 9, 'official'),
  ('workbuddy', 'WorkBuddy', 17, 'coding'),
  ('command-code', 'Command Code', 18, 'coding'),
  ('opencode', 'OpenCode', 19, 'coding'),
  ('中转站', '中转站', 29, 'gateway'),
  ('公益站', '公益站', 36, 'community'),
  ('api', 'API', 39, 'official'),
  ('网页版', '网页版', 100, 'consumer');

-- 迁移已有作品的 provider_id 外键
UPDATE `submissions` SET `provider_id` = 'openai' WHERE `provider_id` = 'openai-官方';
UPDATE `submissions` SET `provider_id` = 'anthropic' WHERE `provider_id` = 'anthropic-官方';
UPDATE `submissions` SET `provider_id` = 'google-gemini' WHERE `provider_id` = 'google-gemini-官方';
UPDATE `submissions` SET `provider_id` = 'xai-grok' WHERE `provider_id` = 'xai-grok-官方';
UPDATE `submissions` SET `provider_id` = 'deepseek' WHERE `provider_id` = 'deepseek-官方';
UPDATE `submissions` SET `provider_id` = '月之暗面-kimi' WHERE `provider_id` = '月之暗面-kimi-官方';
UPDATE `submissions` SET `provider_id` = '智谱-glm' WHERE `provider_id` = '智谱-glm-官方';
UPDATE `submissions` SET `provider_id` = '阿里通义千问' WHERE `provider_id` = '阿里通义千问官方';
UPDATE `submissions` SET `provider_id` = 'minimax' WHERE `provider_id` = 'minimax-官方';
UPDATE `submissions` SET `provider_id` = 'api' WHERE `provider_id` = '官方-api';
UPDATE `submissions` SET `provider_id` = '网页版' WHERE `provider_id` = '官方网页版';
UPDATE `submissions` SET `provider_id` = '中转站' WHERE `provider_id` = '社区中转站';
UPDATE `submissions` SET `provider_id` = '公益站' WHERE `provider_id` = '社区公益站';
UPDATE `submissions` SET `provider_id` = 'github-copilot' WHERE `provider_id` = 'github-copilot-学生包';

-- 清理旧条目与学生包
DELETE FROM `providers` WHERE `id` IN (
  'openai-官方', 'anthropic-官方', 'google-gemini-官方', 'xai-grok-官方',
  'deepseek-官方', '月之暗面-kimi-官方', '智谱-glm-官方', '阿里通义千问官方',
  'minimax-官方', '官方-api', '官方网页版', '社区中转站', '社区公益站',
  'github-copilot-学生包'
);

-- 更新全量排位
UPDATE `providers` SET `rank` = CASE `id`
  WHEN 'openai' THEN 1
  WHEN 'anthropic' THEN 2
  WHEN 'google-gemini' THEN 3
  WHEN 'xai-grok' THEN 4
  WHEN 'deepseek' THEN 5
  WHEN '月之暗面-kimi' THEN 6
  WHEN '智谱-glm' THEN 7
  WHEN '阿里通义千问' THEN 8
  WHEN 'minimax' THEN 9
  WHEN 'github-copilot' THEN 10
  WHEN 'cursor' THEN 11
  WHEN 'windsurf' THEN 12
  WHEN 'trae' THEN 13
  WHEN 'qoder' THEN 14
  WHEN '通义灵码' THEN 15
  WHEN 'cline' THEN 16
  WHEN 'workbuddy' THEN 17
  WHEN 'command-code' THEN 18
  WHEN 'opencode' THEN 19
  WHEN '阿里云百炼' THEN 20
  WHEN '火山引擎' THEN 21
  WHEN '腾讯云-tokenhub' THEN 22
  WHEN '百度千帆' THEN 23
  WHEN 'openrouter' THEN 24
  WHEN '硅基流动' THEN 25
  WHEN '302.ai' THEN 26
  WHEN 'aihubmix' THEN 27
  WHEN 'poe' THEN 28
  WHEN '中转站' THEN 29
  WHEN 'google-ai-studio' THEN 30
  WHEN 'groq' THEN 31
  WHEN 'cloudflare-workers-ai' THEN 32
  WHEN 'nvidia-nim' THEN 33
  WHEN 'github-models' THEN 34
  WHEN '智谱-glm-flash' THEN 35
  WHEN '公益站' THEN 36
  WHEN 'ollama' THEN 37
  WHEN 'lm-studio' THEN 38
  WHEN 'api' THEN 39
  WHEN '网页版' THEN 100
  ELSE `rank`
END;
