import fs from "node:fs";
import { parseSessionLog } from "../app/lib/session-log.ts";

const workdir = "/root/projects/pelican/runs/glm-5.3-flash/candy";
const logMeta = parseSessionLog(fs.readFileSync(`${workdir}/session.jsonl`, "utf8"));

const form = new FormData();
form.append("model", "GLM-5.3 Flash");
form.append("provider", "火山引擎");
form.append("harness", "pi");
form.append("reasoning", "high");
form.append("notes", "");
form.append("logMeta", JSON.stringify(logMeta));
form.append("file", new Blob([fs.readFileSync(`${workdir}/index.md`)], { type: "text/markdown" }), "index.md");
form.append("path", "index.md");

const res = await fetch("https://pelicanarena.dpdns.org/p/yex6n4yh2x/submit", {
  method: "POST",
  headers: { Cookie: process.env.PELICAN_COOKIE },
  body: form,
  redirect: "manual",
});

console.log(res.status, res.headers.get("Location"));
