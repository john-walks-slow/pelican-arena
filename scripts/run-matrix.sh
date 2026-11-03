#!/usr/bin/env bash
set -e

PROJECT_DIR="/root/projects/pelican"
COOKIE="__pelican=eyJ1c2VySWQiOjM2MTUxOX0%3D.jzcXdhJAS2fFR2tMbp9oGXMilQoOC1a23NYZEkirf0M"
BASE_URL="https://pelicanarena.dpdns.org"

run_and_submit() {
  local model_alias="$1"
  local model_display="$2"
  local task_key="$3"
  local prompt_id="$4"
  local prompt_file="$5"
  local output_file="$6"
  local kind="$7"

  local work_dir="$PROJECT_DIR/runs/$model_alias/$task_key"
  mkdir -p "$work_dir"
  cd "$work_dir"

  echo "=========================================================="
  echo "Starting: Model=$model_display, Task=$task_key ($prompt_id)"
  echo "Directory: $work_dir"
  echo "=========================================================="

  local prompt_text
  prompt_text=$(cat "$prompt_file")

  local success=0
  for attempt in 1 2 3 4; do
    echo "--- Attempt $attempt for $model_display / $task_key ---"
    start_time=$(date +%s)
    
    if codex exec -m "$model_alias" -c model_reasoning_effort="high" --dangerously-bypass-approvals-and-sandbox "$prompt_text"; then
      if [ -f "$work_dir/$output_file" ]; then
        echo "Successfully generated $output_file!"
        success=1
        break
      else
        echo "Codex exited 0 but $output_file not found, retrying..."
      fi
    else
      echo "Codex execution failed (exit code $?), waiting 15s..."
    fi
    sleep 15
  done

  if [ "$success" -ne 1 ]; then
    echo "FAILED: $model_display / $task_key after multiple attempts."
    return 1
  fi

  # Copy latest session log
  latest_log=$(ls -t /root/.codex/sessions/2026/11/*/*.jsonl 2>/dev/null | head -n 1)
  if [ -n "$latest_log" ] && [ -f "$latest_log" ]; then
    cp "$latest_log" "$work_dir/session.jsonl"
    echo "Copied session log: $latest_log -> $work_dir/session.jsonl"
  fi

  # Submit to production
  echo "Submitting to $BASE_URL/p/$prompt_id/submit ..."
  local log_meta
  log_meta=$(node -e '
    const fs = require("fs");
    const sessionFile = "'"$work_dir"'/session.jsonl";
    if (!fs.existsSync(sessionFile)) {
      console.log(JSON.stringify({source: "codex", models: ["'"$model_alias"'"], inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, durationMs: 0, turns: 1, toolCalls: 0}));
      process.exit(0);
    }
    const lines = fs.readFileSync(sessionFile, "utf8").split("\n");
    let input = 0, output = 0, cached = 0, reasoning = 0, tools = 0;
    const records = [];
    for (const l of lines) {
      if (!l.trim().startsWith("{")) continue;
      try {
        const r = JSON.parse(l);
        if (r.type === "token_usage_record") records.push(r);
        if (r.type === "response_item" && (r.payload?.type === "function_call" || r.payload?.type === "custom_tool_call")) tools++;
      } catch {}
    }
    const seen = new Set();
    for (const r of records) {
      const id = r.payload?.response_id;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      const u = r.payload?.usage || {};
      const c = u.cached_input_tokens || 0;
      input += (u.input_tokens || 0) - c;
      cached += c;
      output += u.output_tokens || 0;
      reasoning += u.reasoning_output_tokens || 0;
    }
    console.log(JSON.stringify({
      source: "codex",
      models: ["'"$model_alias"'"],
      inputTokens: input,
      outputTokens: output,
      cacheReadTokens: cached,
      cacheWriteTokens: 0,
      reasoningTokens: reasoning,
      durationMs: 60000,
      turns: 1,
      toolCalls: tools
    }));
  ')

  local submit_res
  submit_res=$(curl -s -i --retry 3 -X POST "$BASE_URL/p/$prompt_id/submit" \
    -H "Cookie: $COOKIE" \
    -F "model=$model_display" \
    -F "provider=OpenAI" \
    -F "harness=Codex CLI" \
    -F "reasoning=high" \
    -F "notes=" \
    -F "logMeta=$log_meta" \
    -F "file=@$work_dir/$output_file" \
    -F "path=$output_file")

  local location
  location=$(echo "$submit_res" | grep -i "^location:" | tr -d '\r' | awk '{print $2}')
  echo "Submitted! Result location: $location"
  echo "$model_display | $task_key | $BASE_URL$location" >> "$PROJECT_DIR/runs/submissions.log"
}

case "$1" in
  astra-pelican)
    run_and_submit "gpt-6-astra" "GPT-6 Astra" "pelican" "ymaj6x4uw6" "$PROJECT_DIR/runs/prompt-pelican.txt" "index.html" "web"
    ;;
  astra-ocean)
    run_and_submit "gpt-6-astra" "GPT-6 Astra" "ocean-v2" "e1onsfq0nd" "$PROJECT_DIR/runs/prompt-ocean.txt" "index.html" "web"
    ;;
  sol-pelican)
    run_and_submit "gpt-6.1-sol" "GPT-6.1 Sol" "pelican" "ymaj6x4uw6" "$PROJECT_DIR/runs/prompt-pelican.txt" "index.html" "web"
    ;;
  sol-ocean)
    run_and_submit "gpt-6.1-sol" "GPT-6.1 Sol" "ocean" "e1onsfq0nd" "$PROJECT_DIR/runs/prompt-ocean.txt" "index.html" "web"
    ;;
  sol-tetris)
    run_and_submit "gpt-6.1-sol" "GPT-6.1 Sol" "tetris" "evzfd4un2i" "$PROJECT_DIR/runs/prompt-tetris.txt" "index.html" "web"
    ;;
  sol-store)
    run_and_submit "gpt-6.1-sol" "GPT-6.1 Sol" "convenience-store" "q2vasuirrp" "$PROJECT_DIR/runs/prompt-store.txt" "index.html" "web"
    ;;
  sol-candy)
    run_and_submit "gpt-6.1-sol" "GPT-6.1 Sol" "candy" "yex6n4yh2x" "$PROJECT_DIR/runs/prompt-candy.txt" "index.md" "markdown"
    ;;
  *)
    echo "Usage: $0 <step>"
    exit 1
    ;;
esac
