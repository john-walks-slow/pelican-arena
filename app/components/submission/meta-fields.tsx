import { AppWindow, Brain, Cpu, Server } from "lucide-react";
import { Combobox } from "~/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { REASONING_LEVELS } from "~/db/schema";
import type { Catalog } from "~/lib/catalog";
import { REASONING_LABELS } from "~/lib/format";
import { FIELDS, NOTES_LIMIT } from "~/lib/submission-input";

/** Model / provider / harness / reasoning / mods / notes, shared by submit and edit. */
export function SubmissionMetaFields({
  catalog,
  model,
  setModel,
  provider,
  setProvider,
  harness,
  setHarness,
  reasoning,
  setReasoning,
  mods,
  setMods,
  notes,
  setNotes,
  logModelHint,
}: {
  catalog: Catalog;
  model: string;
  setModel: (value: string) => void;
  provider: string;
  setProvider: (value: string) => void;
  harness: string;
  setHarness: (value: string) => void;
  reasoning: string;
  setReasoning: (value: string) => void;
  mods: string[];
  setMods: (value: string[]) => void;
  notes: string;
  setNotes: (value: string) => void;
  logModelHint?: string | null;
}) {
  const modOptions = [...new Set([...catalog.mods.map((m) => m.name), ...mods])];

  function addMod(name: string) {
    const clean = name.trim();
    if (clean && !mods.includes(clean)) setMods([...mods, clean]);
  }

  return (
    <div className="mt-3.5 space-y-3.5">
      <Combobox
        name={FIELDS.model}
        label="模型"
        icon={<Cpu className="size-3.5" strokeWidth={1.75} />}
        kind="models"
        options={catalog.models}
        value={model}
        onChange={setModel}
        placeholder="选择或输入模型"
        required
        hint={logModelHint ? `日志记录：${logModelHint}` : undefined}
      />

      <Combobox
        name={FIELDS.provider}
        label="提供方"
        icon={<Server className="size-3.5" strokeWidth={1.75} />}
        kind="providers"
        options={catalog.providers}
        value={provider}
        onChange={setProvider}
        placeholder="官方 API、OpenRouter、某中转站…"
        required
      />

      <Combobox
        name={FIELDS.harness}
        label="客户端"
        icon={<AppWindow className="size-3.5" strokeWidth={1.75} />}
        kind="harnesses"
        options={catalog.harnesses}
        value={harness}
        onChange={setHarness}
        placeholder="Claude Code、Cherry Studio…"
      />

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-muted" htmlFor="reasoning">
          思考强度
        </label>
        <input type="hidden" name={FIELDS.reasoning} value={reasoning} />
        <Select
          value={reasoning || "default"}
          onValueChange={(value) => setReasoning(value === "default" ? "" : value)}
        >
          <SelectTrigger id="reasoning" className="h-8 rounded-control px-2.5 shadow-none">
            <div className="flex min-w-0 items-center gap-2">
              <Brain className="size-3.5 shrink-0 opacity-60" strokeWidth={1.75} />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            {REASONING_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {REASONING_LABELS[level]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted">增强</label>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {modOptions.map((name) => {
            const on = mods.includes(name);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  on ? setMods(mods.filter((m) => m !== name)) : setMods([...mods, name])
                }
                className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs transition-colors ${
                  on
                    ? "border-accent/30 bg-accent-soft font-medium text-accent-ink"
                    : "border-control bg-surface text-muted hover:bg-raised hover:text-ink"
                }`}
              >
                {name}
              </button>
            );
          })}
          <Combobox
            options={catalog.mods}
            kind="mods"
            value=""
            onChange={addMod}
            placeholder="更多"
            searchPlaceholder="搜索或新建增强"
            trigger="chip"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted" htmlFor="notes">
          备注
        </label>
        <Textarea
          id="notes"
          name={FIELDS.notes}
          rows={3}
          maxLength={NOTES_LIMIT}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1.5"
          placeholder="温度、系统提示词、遇到的问题…"
        />
      </div>
    </div>
  );
}
