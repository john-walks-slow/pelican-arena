UPDATE `submissions` SET `provider_id` = '官方-api'
WHERE `provider_id` NOT IN ('openai-官方', 'anthropic-官方', 'google-gemini-官方', 'xai-grok-官方', 'deepseek-官方', '月之暗面-kimi-官方', '智谱-glm-官方', '阿里通义千问官方', 'minimax-官方', 'github-copilot', 'cursor', 'windsurf', 'trae', 'qoder', '通义灵码', 'cline', '阿里云百炼', '火山引擎', '腾讯云-tokenhub', '百度千帆', 'openrouter', '硅基流动', '302.ai', 'aihubmix', 'poe', 'google-ai-studio', 'groq', 'cloudflare-workers-ai', 'nvidia-nim', 'github-models', '智谱-glm-flash', 'github-copilot-学生包', '社区公益站', '社区中转站', 'ollama', 'lm-studio', '官方-api', '官方网页版');

DELETE FROM `providers` WHERE `id` NOT IN ('openai-官方', 'anthropic-官方', 'google-gemini-官方', 'xai-grok-官方', 'deepseek-官方', '月之暗面-kimi-官方', '智谱-glm-官方', '阿里通义千问官方', 'minimax-官方', 'github-copilot', 'cursor', 'windsurf', 'trae', 'qoder', '通义灵码', 'cline', '阿里云百炼', '火山引擎', '腾讯云-tokenhub', '百度千帆', 'openrouter', '硅基流动', '302.ai', 'aihubmix', 'poe', 'google-ai-studio', 'groq', 'cloudflare-workers-ai', 'nvidia-nim', 'github-models', '智谱-glm-flash', 'github-copilot-学生包', '社区公益站', '社区中转站', 'ollama', 'lm-studio', '官方-api', '官方网页版');

ALTER TABLE `providers` DROP COLUMN `hidden`;
