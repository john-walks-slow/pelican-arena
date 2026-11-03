import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { promptWithRequirements } from "../app/lib/output-requirements.ts";
import { parseSessionLog } from "../app/lib/session-log.ts";

const COOKIE = "__pelican=eyJ1c2VySWQiOjM2MTUxOX0%3D.jzcXdhJAS2fFR2tMbp9oGXMilQoOC1a23NYZEkirf0M";
const BASE_URL = "https://pelicanarena.dpdns.org";

const TASKS = [
  {
    id: "ymaj6x4uw6",
    slug: "pelican",
    kind: "web",
    file: "index.html",
    body: "生成html，内容是svg绘制鹈鹕骑自行车的动画。输出最高质量的成品。",
    instruction: "请在当前目录下创建 index.html 并将完整可运行代码写入该文件。",
  },
  {
    id: "e1onsfq0nd",
    slug: "ocean",
    kind: "web",
    file: "index.html",
    body: "生成美丽的3D大海场景。具有逼真的流体物理、日夜交替。输出最高质量的成品。",
    instruction: "请在当前目录下创建 index.html 并将完整可运行代码写入该文件。",
  },
  {
    id: "evzfd4un2i",
    slug: "tetris",
    kind: "web",
    file: "index.html",
    body: "制作一个具有顶尖画质的 3D 版俄罗斯方块游戏。输出最高质量的成品。",
    instruction: "请在当前目录下创建 index.html 并将完整可运行代码写入该文件。",
  },
  {
    id: "q2vasuirrp",
    slug: "convenience",
    kind: "web",
    file: "index.html",
    body: "制作一个雨夜便利店街角小场景，整体像一个可以自由拖拽、旋转、缩放观看的微缩三维模型 / 小型景观。输出最高质量的成品。",
    instruction: "请在当前目录下创建 index.html 并将完整可运行代码写入该文件。",
  },
  {
    id: "yex6n4yh2x",
    slug: "candy",
    kind: "markdown",
    file: "index.md",
    body: `不使用任何外部工具回答以下问题：

在一个黑色的袋子里放有三种口味的糖果，每种糖果有两种不同的形状（圆形和五角星形，不同的形状靠手感可以分辨）。现已知不同口味的糖和不同形状的数量统计如下表。参赛者需要在活动前决定摸出的糖果数目，那么，最少取出多少个糖果才能保证手中同时拥有不同形状的苹果味和桃子味的糖？（同时手中有圆形苹果味匹配五角星桃子味糖果，或者有圆形桃子味匹配五角星苹果味糖果都满足要求）
\`\`\`
        苹果味  桃子味  西瓜味
圆形       7      9      8
五角星形   7      6      4
\`\`\``,
    instruction: "请在当前目录下创建 index.md 并将完整清晰的推导与解答写入该文件。",
  },
];

async function submitToArena(params) {
  const { promptId, modelName, workdir, fileName } = params;
  const filePath = path.join(workdir, fileName);
  const logPath = path.join(workdir, "session.jsonl");

  if (!fs.existsSync(filePath)) {
    console.error(`[Error] File not found: ${filePath}`);
    return null;
  }
  if (!fs.existsSync(logPath)) {
    console.error(`[Error] Log not found: ${logPath}`);
    return null;
  }

  const logContent = fs.readFileSync(logPath, "utf8");
  const logMeta = parseSessionLog(logContent);
  const fileBytes = fs.readFileSync(filePath);

  const form = new FormData();
  form.append("model", modelName);
  form.append("provider", "Antigravity");
  form.append("harness", "pi");
  form.append("reasoning", "high");
  form.append("notes", "");
  form.append("logMeta", JSON.stringify(logMeta));
  form.append("file", new Blob([fileBytes], { type: fileName.endsWith(".html") ? "text/html" : "text/markdown" }), fileName);
  form.append("path", fileName);

  try {
    const res = await fetch(`${BASE_URL}/p/${promptId}/submit`, {
      method: "POST",
      headers: { "Cookie": COOKIE },
      body: form,
      redirect: "manual",
    });

    const location = res.headers.get("Location");
    console.log(`[Submit] ${modelName} -> ${promptId} result: ${res.status}, Location: ${location}`);
    return location;
  } catch (err) {
    console.error(`[Submit Failed]`, err.message);
    return null;
  }
}

async function runTask(task) {
  const modelKey = "gemini-3.8-flash-high";
  const modelName = "Gemini 3.8 Flash";
  const workdir = `/root/projects/pelican/runs/${modelKey}/${task.slug}`;
  console.log(`\n======================================================`);
  console.log(`[Start] Model: ${modelName} (${modelKey}) | Task: ${task.slug}`);
  console.log(`Workdir: ${workdir}`);

  const promptText = `${task.instruction}\n\n${promptWithRequirements(task.body, task.kind, { allowSearch: false, allowLibraries: true })}`;
  
  const safeCwd = workdir.replace(/^\//, "").replace(/\//g, "-");
  const sessionDir = `/root/.pi/agent/sessions/--${safeCwd}--`;

  // Clean old session directory if exists
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }

  const cmd = `cd "${workdir}" && pi --provider cpa --model "gemini-3.8-flash-high" --thinking high -p ${JSON.stringify(promptText)}`;

  const startTime = Date.now();
  try {
    execSync(cmd, { stdio: "inherit", timeout: 480000 });
  } catch (e) {
    console.error(`[Warning] pi CLI execution finished with code/error: ${e.message}`);
  }
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Done] pi finished in ${duration}s`);

  // Find latest session file in sessionDir
  if (fs.existsSync(sessionDir)) {
    const files = fs.readdirSync(sessionDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({ name: f, time: fs.statSync(path.join(sessionDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 0) {
      const latest = path.join(sessionDir, files[0].name);
      fs.copyFileSync(latest, path.join(workdir, "session.jsonl"));
      console.log(`[Log] Saved session log to ${path.join(workdir, "session.jsonl")}`);

      // Fallback extraction if tool write wasn't called directly
      const targetFile = path.join(workdir, task.file);
      if (!fs.existsSync(targetFile)) {
        console.log(`[Notice] ${task.file} not created by tool, trying text extraction...`);
        const text = fs.readFileSync(latest, "utf8");
        const lines = text.split("\n").filter(l => l.trim().startsWith("{")).map(l => JSON.parse(l));
        let content = "";
        for (const item of lines) {
          const msg = item.message?.content || item.content || [];
          if (Array.isArray(msg)) {
            for (const b of msg) {
              if (b.type === "text" && b.text) {
                if (task.kind === "markdown") {
                  content = b.text;
                } else if (b.text.includes("<!DOCTYPE html>")) {
                  const match = b.text.match(/```(?:html)?\s*(<!DOCTYPE html>[\s\S]*?)\s*```/i);
                  if (match) content = match[1];
                  else {
                    const start = b.text.indexOf("<!DOCTYPE html>");
                    const end = b.text.lastIndexOf("</html>");
                    if (start !== -1 && end !== -1) content = b.text.slice(start, end + 7);
                  }
                }
              }
            }
          }
        }
        if (content) {
          fs.writeFileSync(targetFile, content);
          console.log(`[Extracted] Successfully wrote ${task.file} (${content.length} bytes)`);
        }
      }
    }
  }

  // Submit to Pelican Arena
  await submitToArena({
    promptId: task.id,
    modelName: modelName,
    workdir,
    fileName: task.file,
  });
}

async function main() {
  for (const t of TASKS) {
    await runTask(t);
  }
}

main().catch(console.error);
