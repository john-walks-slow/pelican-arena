import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { parseSessionLog } from "../app/lib/session-log.ts";

const BASE_URL = "https://pelicanarena.dpdns.org";

// The cookie is provided through the environment so the secret never lands in the repo.
const COOKIE_VALUE = process.env.PELICAN_COOKIE;

const PROMPT_FILE = "/tmp/candy-prompt.md";
const TASKS = [
  { key: "glm-5.3", model: "hwvolc/glm-5.3", modelName: "GLM-5.3", provider: "火山引擎" },
  { key: "glm-5.3-flash", model: "hwvolc/glm-5.3-flash", modelName: "GLM-5.3 Flash", provider: "火山引擎" },
  { key: "gemini-3.8-flash-high", model: "gemini-3.8-flash-high", modelName: "Gemini 3.8 Flash", provider: "Antigravity" },
];

const PROMPT_ID = "yex6n4yh2x";

function latestSession(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({ name: f, time: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  return files.length ? path.join(dir, files[0].name) : null;
}

async function submit({ modelName, provider, workdir }) {
  const filePath = path.join(workdir, "index.md");
  const logPath = path.join(workdir, "session.jsonl");
  if (!fs.existsSync(filePath) || !fs.existsSync(logPath)) {
    console.error(`[Error] missing output in ${workdir}`);
    return;
  }
  const logMeta = parseSessionLog(fs.readFileSync(logPath, "utf8"));
  const form = new FormData();
  form.append("model", modelName);
  form.append("provider", provider);
  form.append("harness", "pi");
  form.append("reasoning", "high");
  form.append("notes", "");
  form.append("logMeta", JSON.stringify(logMeta));
  form.append("file", new Blob([fs.readFileSync(filePath)], { type: "text/markdown" }), "index.md");
  form.append("path", "index.md");

  const res = await fetch(`${BASE_URL}/p/${PROMPT_ID}/submit`, {
    method: "POST",
    headers: { Cookie: COOKIE_VALUE },
    body: form,
    redirect: "manual",
  });
  console.log(`[Submit] ${modelName}: ${res.status} ${res.headers.get("Location") ?? ""}`);
}

async function run(t) {
  const workdir = `/root/projects/pelican/runs/${t.key}/candy`;
  console.log(`\n===== ${t.modelName} =====`);
  fs.rmSync(path.join(workdir, "index.md"), { force: true });
  fs.rmSync(path.join(workdir, "index.html"), { force: true });
  fs.rmSync(path.join(workdir, "session.jsonl"), { force: true });

  const safeCwd = workdir.replace(/^\//, "").replace(/\//g, "-");
  const sessionDir = `/root/.pi/agent/sessions/--${safeCwd}--`;
  fs.rmSync(sessionDir, { recursive: true, force: true });

  // Quote the prompt through a file so backticks and newlines survive the shell.
  const cmd = `cd "${workdir}" && pi --provider cpa --model "${t.model}" --thinking high -p "$(cat ${PROMPT_FILE})"`;

  const started = Date.now();
  try {
    execSync(cmd, { stdio: "inherit", timeout: 600000 });
  } catch (e) {
    console.error(`[Warning] ${e.message}`);
  }
  console.log(`[Done] ${((Date.now() - started) / 1000).toFixed(1)}s`);

  const latest = latestSession(sessionDir);
  if (latest) {
    fs.copyFileSync(latest, path.join(workdir, "session.jsonl"));
  } else {
    console.error("[Error] no session log");
    return;
  }

  if (!fs.existsSync(path.join(workdir, "index.md"))) {
    console.error("[Error] model did not write index.md");
    return;
  }

  await submit({ modelName: t.modelName, provider: t.provider, workdir });
}

for (const t of TASKS) await run(t);
