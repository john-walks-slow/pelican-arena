INSERT OR IGNORE INTO `providers` (`id`, `name`, `rank`, `category`) VALUES
  ('openai-官方', 'OpenAI 官方', 1, 'official'),
  ('anthropic-官方', 'Anthropic 官方', 2, 'official'),
  ('google-gemini-官方', 'Google Gemini 官方', 3, 'official'),
  ('xai-grok-官方', 'xAI Grok 官方', 4, 'official'),
  ('deepseek-官方', 'DeepSeek 官方', 5, 'official'),
  ('月之暗面-kimi-官方', '月之暗面 Kimi 官方', 6, 'official'),
  ('智谱-glm-官方', '智谱 GLM 官方', 7, 'official'),
  ('阿里通义千问官方', '阿里通义千问官方', 8, 'official'),
  ('minimax-官方', 'MiniMax 官方', 9, 'official'),
  ('meta-官方', 'Meta 官方', 10, 'official'),
  ('mistral-官方', 'Mistral 官方', 11, 'official'),
  ('阶跃星辰官方', '阶跃星辰官方', 12, 'official'),
  ('官方-api', '官方 API', 13, 'official'),
  ('github-copilot', 'GitHub Copilot', 20, 'coding'),
  ('cursor', 'Cursor', 21, 'coding'),
  ('windsurf', 'Windsurf', 22, 'coding'),
  ('trae', 'Trae', 23, 'coding'),
  ('qoder', 'Qoder', 24, 'coding'),
  ('通义灵码', '通义灵码', 25, 'coding'),
  ('文心快码', '文心快码', 26, 'coding'),
  ('腾讯-codebuddy', '腾讯 CodeBuddy', 27, 'coding'),
  ('kilo-code', 'Kilo Code', 28, 'coding'),
  ('cline', 'Cline', 29, 'coding'),
  ('opencode-zen', 'OpenCode Zen', 30, 'coding'),
  ('阶跃-step-plan', '阶跃 Step Plan', 31, 'coding'),
  ('阿里云百炼', '阿里云百炼', 40, 'cloud'),
  ('火山引擎', '火山引擎', 41, 'cloud'),
  ('腾讯云-tokenhub', '腾讯云 TokenHub', 42, 'cloud'),
  ('百度千帆', '百度千帆', 43, 'cloud'),
  ('小米-mimo', '小米 MiMo', 44, 'cloud'),
  ('华为云', '华为云', 45, 'cloud'),
  ('京东云', '京东云', 46, 'cloud'),
  ('移动云', '移动云', 47, 'cloud'),
  ('联通云', '联通云', 48, 'cloud'),
  ('讯飞星火', '讯飞星火', 49, 'cloud'),
  ('商汤日日新', '商汤日日新', 50, 'cloud'),
  ('openrouter', 'OpenRouter', 60, 'gateway'),
  ('硅基流动', '硅基流动', 61, 'gateway'),
  ('302.ai', '302.AI', 62, 'gateway'),
  ('aihubmix', 'AIHubMix', 63, 'gateway'),
  ('zenmux', 'ZenMux', 64, 'gateway'),
  ('requesty', 'Requesty', 65, 'gateway'),
  ('poe', 'Poe', 66, 'gateway'),
  ('社区中转站', '社区中转站', 67, 'gateway'),
  ('google-ai-studio', 'Google AI Studio', 70, 'free'),
  ('groq', 'Groq', 71, 'free'),
  ('cloudflare-workers-ai', 'Cloudflare Workers AI', 72, 'free'),
  ('nvidia-nim', 'NVIDIA NIM', 73, 'free'),
  ('openrouter-免费模型', 'OpenRouter 免费模型', 74, 'free'),
  ('github-models', 'GitHub Models', 75, 'free'),
  ('智谱-glm-flash', '智谱 GLM Flash', 76, 'free'),
  ('modelscope', 'ModelScope', 77, 'free'),
  ('cerebras', 'Cerebras', 78, 'free'),
  ('mistral-免费层', 'Mistral 免费层', 79, 'free'),
  ('cohere-试用', 'Cohere 试用', 80, 'free'),
  ('github-student-developer-pack', 'GitHub Student Developer Pack', 90, 'student'),
  ('github-copilot-学生包', 'GitHub Copilot 学生包', 91, 'student'),
  ('jetbrains-student-pack', 'JetBrains Student Pack', 92, 'student'),
  ('qoder-学生版', 'Qoder 学生版', 93, 'student'),
  ('trae-免费档', 'Trae 免费档', 94, 'student'),
  ('perplexity-学生', 'Perplexity 学生', 95, 'student'),
  ('官方网页版', '官方网页版', 100, 'consumer'),
  ('perplexity', 'Perplexity', 101, 'consumer'),
  ('lmarena', 'LMArena', 102, 'consumer'),
  ('豆包', '豆包', 103, 'consumer'),
  ('kimi-网页版', 'Kimi 网页版', 104, 'consumer'),
  ('通义网页版', '通义网页版', 105, 'consumer'),
  ('元宝', '元宝', 106, 'consumer'),
  ('社区公益站', '社区公益站', 110, 'community'),
  ('共享车队-合租', '共享车队/合租', 111, 'community'),
  ('网页版逆向', '网页版逆向', 112, 'community'),
  ('镜像站', '镜像站', 113, 'community'),
  ('ollama', 'Ollama', 120, 'local'),
  ('lm-studio', 'LM Studio', 121, 'local'),
  ('llama.cpp', 'llama.cpp', 122, 'local'),
  ('vllm', 'vLLM', 123, 'local'),
  ('自建网关', '自建网关', 124, 'local'),
  ('google-colab', 'Google Colab', 125, 'local'),
  ('kaggle', 'Kaggle', 126, 'local'),
  ('oracle-cloud', 'Oracle Cloud', 130, 'trial'),
  ('aws-bedrock', 'AWS Bedrock', 131, 'trial'),
  ('azure-ai', 'Azure AI', 132, 'trial'),
  ('google-cloud', 'Google Cloud', 133, 'trial');

UPDATE `providers` SET `category` = CASE `id`
  WHEN 'openai-官方' THEN 'official'
  WHEN 'anthropic-官方' THEN 'official'
  WHEN 'google-gemini-官方' THEN 'official'
  WHEN 'xai-grok-官方' THEN 'official'
  WHEN 'deepseek-官方' THEN 'official'
  WHEN '月之暗面-kimi-官方' THEN 'official'
  WHEN '智谱-glm-官方' THEN 'official'
  WHEN '阿里通义千问官方' THEN 'official'
  WHEN 'minimax-官方' THEN 'official'
  WHEN 'meta-官方' THEN 'official'
  WHEN 'mistral-官方' THEN 'official'
  WHEN '阶跃星辰官方' THEN 'official'
  WHEN '官方-api' THEN 'official'
  WHEN 'github-copilot' THEN 'coding'
  WHEN 'cursor' THEN 'coding'
  WHEN 'windsurf' THEN 'coding'
  WHEN 'trae' THEN 'coding'
  WHEN 'qoder' THEN 'coding'
  WHEN '通义灵码' THEN 'coding'
  WHEN '文心快码' THEN 'coding'
  WHEN '腾讯-codebuddy' THEN 'coding'
  WHEN 'kilo-code' THEN 'coding'
  WHEN 'cline' THEN 'coding'
  WHEN 'opencode-zen' THEN 'coding'
  WHEN '阶跃-step-plan' THEN 'coding'
  WHEN '阿里云百炼' THEN 'cloud'
  WHEN '火山引擎' THEN 'cloud'
  WHEN '腾讯云-tokenhub' THEN 'cloud'
  WHEN '百度千帆' THEN 'cloud'
  WHEN '小米-mimo' THEN 'cloud'
  WHEN '华为云' THEN 'cloud'
  WHEN '京东云' THEN 'cloud'
  WHEN '移动云' THEN 'cloud'
  WHEN '联通云' THEN 'cloud'
  WHEN '讯飞星火' THEN 'cloud'
  WHEN '商汤日日新' THEN 'cloud'
  WHEN 'openrouter' THEN 'gateway'
  WHEN '硅基流动' THEN 'gateway'
  WHEN '302.ai' THEN 'gateway'
  WHEN 'aihubmix' THEN 'gateway'
  WHEN 'zenmux' THEN 'gateway'
  WHEN 'requesty' THEN 'gateway'
  WHEN 'poe' THEN 'gateway'
  WHEN '社区中转站' THEN 'gateway'
  WHEN 'google-ai-studio' THEN 'free'
  WHEN 'groq' THEN 'free'
  WHEN 'cloudflare-workers-ai' THEN 'free'
  WHEN 'nvidia-nim' THEN 'free'
  WHEN 'openrouter-免费模型' THEN 'free'
  WHEN 'github-models' THEN 'free'
  WHEN '智谱-glm-flash' THEN 'free'
  WHEN 'modelscope' THEN 'free'
  WHEN 'cerebras' THEN 'free'
  WHEN 'mistral-免费层' THEN 'free'
  WHEN 'cohere-试用' THEN 'free'
  WHEN 'github-student-developer-pack' THEN 'student'
  WHEN 'github-copilot-学生包' THEN 'student'
  WHEN 'jetbrains-student-pack' THEN 'student'
  WHEN 'qoder-学生版' THEN 'student'
  WHEN 'trae-免费档' THEN 'student'
  WHEN 'perplexity-学生' THEN 'student'
  WHEN '官方网页版' THEN 'consumer'
  WHEN 'perplexity' THEN 'consumer'
  WHEN 'lmarena' THEN 'consumer'
  WHEN '豆包' THEN 'consumer'
  WHEN 'kimi-网页版' THEN 'consumer'
  WHEN '通义网页版' THEN 'consumer'
  WHEN '元宝' THEN 'consumer'
  WHEN '社区公益站' THEN 'community'
  WHEN '共享车队-合租' THEN 'community'
  WHEN '网页版逆向' THEN 'community'
  WHEN '镜像站' THEN 'community'
  WHEN 'ollama' THEN 'local'
  WHEN 'lm-studio' THEN 'local'
  WHEN 'llama.cpp' THEN 'local'
  WHEN 'vllm' THEN 'local'
  WHEN '自建网关' THEN 'local'
  WHEN 'google-colab' THEN 'local'
  WHEN 'kaggle' THEN 'local'
  WHEN 'oracle-cloud' THEN 'trial'
  WHEN 'aws-bedrock' THEN 'trial'
  WHEN 'azure-ai' THEN 'trial'
  WHEN 'google-cloud' THEN 'trial'
  ELSE `category`
END;

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
  WHEN 'meta-官方' THEN 10
  WHEN 'mistral-官方' THEN 11
  WHEN '阶跃星辰官方' THEN 12
  WHEN '官方-api' THEN 13
  WHEN 'github-copilot' THEN 20
  WHEN 'cursor' THEN 21
  WHEN 'windsurf' THEN 22
  WHEN 'trae' THEN 23
  WHEN 'qoder' THEN 24
  WHEN '通义灵码' THEN 25
  WHEN '文心快码' THEN 26
  WHEN '腾讯-codebuddy' THEN 27
  WHEN 'kilo-code' THEN 28
  WHEN 'cline' THEN 29
  WHEN 'opencode-zen' THEN 30
  WHEN '阶跃-step-plan' THEN 31
  WHEN '阿里云百炼' THEN 40
  WHEN '火山引擎' THEN 41
  WHEN '腾讯云-tokenhub' THEN 42
  WHEN '百度千帆' THEN 43
  WHEN '小米-mimo' THEN 44
  WHEN '华为云' THEN 45
  WHEN '京东云' THEN 46
  WHEN '移动云' THEN 47
  WHEN '联通云' THEN 48
  WHEN '讯飞星火' THEN 49
  WHEN '商汤日日新' THEN 50
  WHEN 'openrouter' THEN 60
  WHEN '硅基流动' THEN 61
  WHEN '302.ai' THEN 62
  WHEN 'aihubmix' THEN 63
  WHEN 'zenmux' THEN 64
  WHEN 'requesty' THEN 65
  WHEN 'poe' THEN 66
  WHEN '社区中转站' THEN 67
  WHEN 'google-ai-studio' THEN 70
  WHEN 'groq' THEN 71
  WHEN 'cloudflare-workers-ai' THEN 72
  WHEN 'nvidia-nim' THEN 73
  WHEN 'openrouter-免费模型' THEN 74
  WHEN 'github-models' THEN 75
  WHEN '智谱-glm-flash' THEN 76
  WHEN 'modelscope' THEN 77
  WHEN 'cerebras' THEN 78
  WHEN 'mistral-免费层' THEN 79
  WHEN 'cohere-试用' THEN 80
  WHEN 'github-student-developer-pack' THEN 90
  WHEN 'github-copilot-学生包' THEN 91
  WHEN 'jetbrains-student-pack' THEN 92
  WHEN 'qoder-学生版' THEN 93
  WHEN 'trae-免费档' THEN 94
  WHEN 'perplexity-学生' THEN 95
  WHEN '官方网页版' THEN 100
  WHEN 'perplexity' THEN 101
  WHEN 'lmarena' THEN 102
  WHEN '豆包' THEN 103
  WHEN 'kimi-网页版' THEN 104
  WHEN '通义网页版' THEN 105
  WHEN '元宝' THEN 106
  WHEN '社区公益站' THEN 110
  WHEN '共享车队-合租' THEN 111
  WHEN '网页版逆向' THEN 112
  WHEN '镜像站' THEN 113
  WHEN 'ollama' THEN 120
  WHEN 'lm-studio' THEN 121
  WHEN 'llama.cpp' THEN 122
  WHEN 'vllm' THEN 123
  WHEN '自建网关' THEN 124
  WHEN 'google-colab' THEN 125
  WHEN 'kaggle' THEN 126
  WHEN 'oracle-cloud' THEN 130
  WHEN 'aws-bedrock' THEN 131
  WHEN 'azure-ai' THEN 132
  WHEN 'google-cloud' THEN 133
  ELSE `rank`
END;
