INSERT OR IGNORE INTO `models` (`id`, `name`) VALUES
  ('claude-opus-4.5', 'Claude Opus 4.5'),
  ('claude-sonnet-4.5', 'Claude Sonnet 4.5'),
  ('gpt-5.1', 'GPT-5.1'),
  ('gpt-5.1-codex', 'GPT-5.1 Codex'),
  ('gemini-3-pro', 'Gemini 3 Pro'),
  ('gemini-2.5-flash', 'Gemini 2.5 Flash'),
  ('deepseek-v3.2', 'DeepSeek V3.2'),
  ('kimi-k2-thinking', 'Kimi K2 Thinking'),
  ('glm-4.6', 'GLM-4.6'),
  ('qwen3-coder', 'Qwen3 Coder'),
  ('minimax-m2', 'MiniMax M2'),
  ('grok-4', 'Grok 4');

INSERT OR IGNORE INTO `providers` (`id`, `name`) VALUES
  ('官方-api', '官方 API'),
  ('官方网页版', '官方网页版'),
  ('openrouter', 'OpenRouter'),
  ('硅基流动', '硅基流动'),
  ('火山引擎', '火山引擎'),
  ('阿里云百炼', '阿里云百炼'),
  ('github-copilot', 'GitHub Copilot');

INSERT OR IGNORE INTO `harnesses` (`id`, `name`) VALUES
  ('裸-api', '裸 API'),
  ('官方网页版', '官方网页版'),
  ('claude-code', 'Claude Code'),
  ('codex-cli', 'Codex CLI'),
  ('gemini-cli', 'Gemini CLI'),
  ('cursor', 'Cursor'),
  ('cline', 'Cline'),
  ('opencode', 'opencode'),
  ('cherry-studio', 'Cherry Studio');

INSERT OR IGNORE INTO `mods` (`id`, `name`) VALUES
  ('联网搜索', '联网搜索'),
  ('mcp', 'MCP'),
  ('skills', 'Skills'),
  ('多轮修改', '多轮修改'),
  ('图片输入', '图片输入');
