INSERT OR IGNORE INTO `providers` (`id`, `name`, `rank`) VALUES
  ('openai-官方', 'OpenAI 官方', 1),
  ('anthropic-官方', 'Anthropic 官方', 2),
  ('google-gemini-官方', 'Google Gemini 官方', 3),
  ('xai-grok-官方', 'xAI Grok 官方', 4),
  ('deepseek-官方', 'DeepSeek 官方', 5),
  ('月之暗面-kimi-官方', '月之暗面 Kimi 官方', 6),
  ('智谱-glm-官方', '智谱 GLM 官方', 7),
  ('阿里通义千问官方', '阿里通义千问官方', 8),
  ('minimax-官方', 'MiniMax 官方', 9),
  ('腾讯云-tokenhub', '腾讯云 TokenHub', 10),
  ('百度千帆', '百度千帆', 11),
  ('小米-mimo', '小米 MiMo', 12),
  ('302.ai', '302.AI', 13),
  ('aihubmix', 'AIHubMix', 14),
  ('cursor', 'Cursor', 15),
  ('社区中转站', '社区中转站', 16);

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
  WHEN '腾讯云-tokenhub' THEN 10
  WHEN '百度千帆' THEN 11
  WHEN '小米-mimo' THEN 12
  WHEN '302.ai' THEN 13
  WHEN 'aihubmix' THEN 14
  WHEN 'cursor' THEN 15
  WHEN '社区中转站' THEN 16
  WHEN 'openrouter' THEN 20
  WHEN '阿里云百炼' THEN 25
  WHEN '硅基流动' THEN 30
  WHEN '火山引擎' THEN 35
  WHEN 'github-copilot' THEN 40
  WHEN '官方-api' THEN 50
  WHEN '官方网页版' THEN 55
  ELSE `rank`
END;
