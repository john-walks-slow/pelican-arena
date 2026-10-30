import { Lock } from "lucide-react";
import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { BackLink } from "~/components/back-link";
import { Markdown } from "~/components/markdown";
import { OutputRequirements } from "~/components/output-requirements";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { KIND_META, PROMPT_KINDS, type PromptKind } from "~/lib/kinds";

const LIMITS = { title: 80, body: 8000 };

export interface PromptFormValues {
  title: string;
  body: string;
  kind: PromptKind;
}

export function PromptForm({
  mode,
  initial,
  locked = false,
  answerCount = 0,
  errors,
  values,
  cancelTo,
  cancelHistory = true,
  submitLabel,
}: {
  mode: "create" | "edit";
  initial?: PromptFormValues;
  locked?: boolean;
  answerCount?: number;
  errors?: Partial<Record<"title" | "body" | "form", string>>;
  values?: PromptFormValues;
  cancelTo: string;
  cancelHistory?: boolean;
  submitLabel: string;
}) {
  const [kind, setKind] = useState<PromptKind>(values?.kind ?? initial?.kind ?? "web");
  const [title, setTitle] = useState(values?.title ?? initial?.title ?? "");
  const [body, setBody] = useState(values?.body ?? initial?.body ?? "");
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle";
  const meta = KIND_META[kind];
  const ready = title.trim().length > 0 && body.trim().length > 0;

  return (
    <Form
      method="post"
      className="reveal-tier-1 mt-3 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]"
    >
      <div className="rounded-card border border-border bg-surface">
        {locked && (
          <div className="flex items-start gap-2 border-b border-border bg-raised/50 px-5 py-3 text-xs text-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
            已有 {answerCount} 份答案，正文和作品类型不能再改。
          </div>
        )}

        <div className="space-y-5 p-5">
          <div>
            <span className="block text-sm font-medium">作品类型</span>
            <input type="hidden" name="kind" value={kind} />
            <div
              className="mt-1.5 grid gap-2 sm:grid-cols-3"
              role="radiogroup"
              aria-label="作品类型"
            >
              {PROMPT_KINDS.map((value) => {
                const active = kind === value;
                const item = KIND_META[value];
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={locked}
                    onClick={() => setKind(value)}
                    className={`rounded-control border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      active
                        ? "border-ink/35 bg-raised text-ink"
                        : "border-border bg-surface hover:border-control hover:bg-raised/50"
                    }`}
                  >
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted">
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="title">
              标题
            </label>
            <Input
              id="title"
              name="title"
              className="mt-1.5 h-9"
              maxLength={LIMITS.title}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === "create" ? "骑自行车的鹈鹕" : undefined}
              aria-invalid={Boolean(errors?.title)}
              autoFocus
              required
            />
            {errors?.title && <p className="mt-1 text-xs text-negative">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="body">
              提示词
            </label>
            <Textarea
              id="body"
              name="body"
              rows={12}
              className="mt-1.5 leading-6 read-only:bg-raised/40"
              maxLength={LIMITS.body}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={mode === "create" ? meta.placeholder : undefined}
              aria-invalid={Boolean(errors?.body)}
              readOnly={locked}
              required
            />
            <div className="mt-1.5 flex items-baseline justify-between gap-3 text-xs">
              {errors?.body && <p className="text-negative">{errors.body}</p>}
              <span className="num ml-auto shrink-0 text-muted">
                {body.length} / {LIMITS.body}
              </span>
            </div>
          </div>

          <div className="rounded-control border border-border bg-raised/50 px-3.5 py-3">
            <OutputRequirements kind={kind} className="border-t-0 pt-0" />
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              输出要求会自动拼接在题目提示词末尾。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-5 py-3.5">
          {errors?.form ? (
            <p className="mr-auto text-xs text-negative">{errors.form}</p>
          ) : mode === "edit" && !locked ? (
            <p className="mr-auto text-xs text-muted">保存后立即生效。</p>
          ) : null}
          <div className="ml-auto flex items-center gap-1.5">
            <Button asChild variant="outline">
              <BackLink to={cancelTo} history={cancelHistory}>
                取消
              </BackLink>
            </Button>
            <Button type="submit" variant="primary" disabled={!ready || submitting}>
              {submitting ? "保存中…" : submitLabel}
            </Button>
          </div>
        </div>
      </div>

      <aside className="lg:sticky lg:top-8">
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <span className="text-xs font-medium text-muted">题目预览</span>
            <span className="text-[11px] text-muted">{meta.label}</span>
          </div>
          <div className="px-4 py-4">
            <h2 className="text-[17px] leading-snug font-semibold tracking-tight">
              {title.trim() || "未命名的题目"}
            </h2>
            <div className="mt-2">
              {body.trim() ? (
                <>
                  <Markdown>{body}</Markdown>
                  <OutputRequirements kind={kind} className="mt-3" />
                </>
              ) : (
                <p className="text-sm text-muted">提示词会显示在这里。</p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </Form>
  );
}
