import { AppWindow, Brain, Cpu, Server } from "lucide-react";
import { use, useEffect, useState } from "react";
import { Combobox } from "~/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
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
  catalog: Promise<Catalog>;
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
  const resolved = use(catalog);
  const [modelLevels, setModelLevels] = useState<string[] | null | undefined>(undefined);
  const modOptions = [...new Set([...resolved.mods.map((m) => m.name), ...mods])];

  useEffect(() => {
    const name = model.trim();
    if (!name) {
      setModelLevels(undefined);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/catalog?kind=models&find=${encodeURIComponent(name)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((raw: unknown) => {
          if (controller.signal.aborted) return;
          const data = raw as { model?: { reasoning?: string[] | null } | null } | null;
          setModelLevels(data?.model?.reasoning ?? undefined);
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [model]);

  const levels: readonly string[] =
    modelLevels == null ? REASONING_LEVELS : modelLevels;
  const reasoningOptions =
    reasoning && !levels.includes(reasoning) ? [...levels, reasoning] : levels;

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
        options={resolved.models}
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
        options={resolved.providers}
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
        options={resolved.harnesses}
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
            {reasoningOptions.map((level) => (
              <SelectItem key={level} value={level}>
                {REASONING_LABELS[level as keyof typeof REASONING_LABELS] ?? level}
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
            options={resolved.mods}
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

function FieldSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

/** Reserves the field layout while the catalog arrives behind the dialog. */
export function MetaFieldsSkeleton() {
  return (
    <div className="mt-3.5 space-y-3.5" role="status" aria-label="正在载入生成信息">
      <FieldSkeleton />
      <FieldSkeleton />
      <FieldSkeleton />
      <FieldSkeleton />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-7 w-40 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-[70px] w-full" />
      </div>
    </div>
  );
}
