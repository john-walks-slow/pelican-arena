ALTER TABLE `providers` ADD `hidden` integer DEFAULT false NOT NULL;

UPDATE `providers` SET `hidden` = 1
WHERE `id` IN ('meta-官方', 'mistral-官方', '阶跃星辰官方', '官方-api', '文心快码', '腾讯-codebuddy', 'kilo-code', 'opencode-zen', '阶跃-step-plan', '小米-mimo', '华为云', '京东云', '移动云', '联通云', '讯飞星火', '商汤日日新', 'zenmux', 'requesty', 'openrouter-免费模型', 'modelscope', 'cerebras', 'mistral-免费层', 'cohere-试用', 'github-student-developer-pack', 'jetbrains-student-pack', 'qoder-学生版', 'trae-免费档', 'perplexity-学生', '官方网页版', 'perplexity', 'lmarena', '豆包', 'kimi-网页版', '通义网页版', '元宝', '共享车队-合租', '网页版逆向', '镜像站', 'llama.cpp', 'vllm', '自建网关', 'google-colab', 'kaggle', 'oracle-cloud', 'aws-bedrock', 'azure-ai', 'google-cloud');

UPDATE `providers` SET `rank` = CASE `id`
  WHEN 'openai-官方' THEN 1
  WHEN 'anthropic-官方' THEN 2
  WHEN 'google-gemini-官方' THEN 3
  WHEN 'xai-grok-官方' THEN 4
  WHEN 'deepseek-官方' THEN 5
  WHEN '月之暗面-kimi-官方' THEN 6
  WHEN '智谱-glm-官方' THEN 7
  WHEN '阿里通义千问官方' THEN 8
  WHEN 'minimax-官方' THEN 9
  WHEN 'github-copilot' THEN 10
  WHEN 'cursor' THEN 11
  WHEN 'windsurf' THEN 12
  WHEN 'trae' THEN 13
  WHEN 'qoder' THEN 14
  WHEN '通义灵码' THEN 15
  WHEN 'cline' THEN 16
  WHEN '阿里云百炼' THEN 17
  WHEN '火山引擎' THEN 18
  WHEN '腾讯云-tokenhub' THEN 19
  WHEN '百度千帆' THEN 20
  WHEN 'openrouter' THEN 21
  WHEN '硅基流动' THEN 22
  WHEN '302.ai' THEN 23
  WHEN 'aihubmix' THEN 24
  WHEN 'poe' THEN 25
  WHEN 'google-ai-studio' THEN 26
  WHEN 'groq' THEN 27
  WHEN 'cloudflare-workers-ai' THEN 28
  WHEN 'nvidia-nim' THEN 29
  WHEN 'github-models' THEN 30
  WHEN '智谱-glm-flash' THEN 31
  WHEN 'github-copilot-学生包' THEN 32
  WHEN '社区公益站' THEN 33
  WHEN '社区中转站' THEN 34
  WHEN 'ollama' THEN 35
  WHEN 'lm-studio' THEN 36
  ELSE `rank`
END
WHERE `id` IN ('openai-官方', 'anthropic-官方', 'google-gemini-官方', 'xai-grok-官方', 'deepseek-官方', '月之暗面-kimi-官方', '智谱-glm-官方', '阿里通义千问官方', 'minimax-官方', 'github-copilot', 'cursor', 'windsurf', 'trae', 'qoder', '通义灵码', 'cline', '阿里云百炼', '火山引擎', '腾讯云-tokenhub', '百度千帆', 'openrouter', '硅基流动', '302.ai', 'aihubmix', 'poe', 'google-ai-studio', 'groq', 'cloudflare-workers-ai', 'nvidia-nim', 'github-models', '智谱-glm-flash', 'github-copilot-学生包', '社区公益站', '社区中转站', 'ollama', 'lm-studio');
