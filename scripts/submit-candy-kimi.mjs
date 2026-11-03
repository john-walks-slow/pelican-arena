import fs from "node:fs";
import path from "node:path";
import { parseSessionLog } from "../app/lib/session-log.ts";

const BASE_URL = "https://pelicanarena.dpdns.org";
const COOKIE_VALUE = process.env.PELICAN_COOKIE;
const PROMPT_ID = "yex6n4yh2x";

const runs = [
  { key: "kimi-k3", modelName: "Kimi K3", provider: "火山引擎" },
];

for (const run of runs) {
  const workdir = `/root/projects/pelican/runs/${run.key}/candy`;
  const sessionDir = `/root/.pi/agent/sessions/--root-projects-pelican-runs-${run.key}-candy--`;
  const files = fs.existsSync(sessionDir)
    ? fs.readdirSync(sessionDir).filter((f) => f.endsWith(".jsonl")).map((f) => ({ f, t: fs.statSync(path.join(sessionDir, f)).mtimeMs })).sort((a, b) => b.t - a.t)
    : [];
  if (!files.length) {
    console.error(`[Error] no session log for ${run.key}`);
    continue;
  }
  fs.copyFileSync(path.join(sessionDir, files[0].f), path.join(workdir, "session.jsonl"));

  const logMeta = parseSessionLog(fs.readFileSync(path.join(workdir, "session.jsonl"), "utf8"));
  const form = new FormData();
  form.append("model", run.modelName);
  form.append("provider", run.provider);
  form.append("harness", "pi");
  form.append("reasoning", "high");
  form.append("notes", "");
  form.append("logMeta", JSON.stringify(logMeta));
  form.append("file", new Blob([fs.readFileSync(path.join(workdir, "index.md"))], { type: "text/markdown" }), "index.md");
  form.append("path", "index.md");

  const res = await fetch(`${BASE_URL}/p/${PROMPT_ID}/submit`, {
    method: "POST",
    headers: { Cookie: COOKIE_VALUE },
    body: form,
    redirect: "manual",
  });
  console.log(`[Submit] ${run.modelName}: ${res.status} ${res.headers.get("Location") ?? ""}`);
}
