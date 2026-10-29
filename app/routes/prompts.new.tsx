import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/prompts.new";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { db } from "~/db/client.server";
import { prompts } from "~/db/schema";
import { dailyLimitError, requirePermission } from "~/lib/guards.server";
import { newId } from "~/lib/ids";
import { isPromptKind, KIND_META, PROMPT_KINDS, type PromptKind } from "~/lib/kinds";

export const meta: Route.MetaFunction = () => [{ title: "出题 · Pelican Arena" }];

const LIMITS = { title: 80, body: 8000 };

export async function loader({ request }: Route.LoaderArgs) {
  await requirePermission(request, "createPrompt");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requirePermission(request, "createPrompt");
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const kindRaw = String(form.get("kind") ?? "web");
  const kind: PromptKind = isPromptKind(kindRaw) ? kindRaw : "web";

  const errors: Partial<Record<"title" | "body" | "form", string>> = {};
  if (!title) errors.title = "请填写标题";
  else if (title.length > LIMITS.title) errors.title = `标题最多 ${LIMITS.title} 字`;
  if (!body) errors.body = "请填写提示词";
  else if (body.length > LIMITS.body) errors.body = `提示词最多 ${LIMITS.body} 字`;
  const limitError = await dailyLimitError(user, "createPrompt");
  if (limitError) errors.form = limitError;
  if (Object.keys(errors).length > 0) {
    return data({ errors, values: { title, body, kind } }, { status: 400 });
  }

  const id = newId(10);
  await db().insert(prompts).values({ id, authorId: user.id, title, body, kind });
  return redirect(`/p/${id}`);
}

export default function NewPrompt({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const errors = actionData?.errors;
  const values = actionData?.values;
  const [kind, setKind] = useState<PromptKind>(values?.kind ?? "web");
  const meta = KIND_META[kind];

  return (
    <div className="mx-auto max-w-[680px]">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" strokeWidth={1.75} />
        题目
      </Link>
      <h1 className="mt-2 text-title font-bold tracking-tight">出题</h1>
      <p className="mt-1 text-sm text-muted">
        写一段让模型产出同一类作品的提示词。有人提交答案后，题目内容不能再修改。
      </p>

      <Form method="post" className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium" htmlFor="title">
            标题
          </label>
          <Input
            id="title"
            name="title"
            className="mt-1.5"
            maxLength={LIMITS.title}
            defaultValue={values?.title}
            placeholder="骑自行车的鹈鹕"
            aria-invalid={Boolean(errors?.title)}
            required
          />
          {errors?.title && <p className="mt-1 text-xs text-negative">{errors.title}</p>}
        </div>

        <div>
          <span className="block text-sm font-medium">作品类型</span>
          <input type="hidden" name="kind" value={kind} />
          <div className="mt-1.5 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="作品类型">
            {PROMPT_KINDS.map((value) => {
              const active = kind === value;
              const item = KIND_META[value];
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setKind(value)}
                  className={`rounded-control border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-ink/25 bg-raised"
                      : "border-control bg-surface hover:bg-raised/60"
                  }`}
                >
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted">
                    {item.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="body">
            提示词
          </label>
          <Textarea
            id="body"
            name="body"
            rows={10}
            className="mt-1.5 leading-6"
            maxLength={LIMITS.body}
            defaultValue={values?.body}
            placeholder={meta.placeholder}
            aria-invalid={Boolean(errors?.body)}
            required
          />
          {errors?.body ? (
            <p className="mt-1 text-xs text-negative">{errors.body}</p>
          ) : (
            <p className="mt-1 text-xs text-muted">
              答题者会原样复制这段文字发给模型。{meta.hint}
            </p>
          )}
        </div>

        {errors?.form && <p className="text-sm text-negative">{errors.form}</p>}

        <div className="flex justify-end gap-1.5 border-t border-border pt-5">
          <Button asChild variant="outline">
            <Link to="/">取消</Link>
          </Button>
          <Button type="submit" variant="primary" disabled={navigation.state !== "idle"}>
            {navigation.state === "submitting" ? "发布中…" : "发布题目"}
          </Button>
        </div>
      </Form>
    </div>
  );
}
