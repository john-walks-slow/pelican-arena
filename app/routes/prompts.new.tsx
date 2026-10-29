import { data, Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/prompts.new";
import { db } from "~/db/client.server";
import { prompts } from "~/db/schema";
import { dailyLimitError, requirePermission } from "~/lib/guards.server";
import { newId } from "~/lib/ids";

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

  const errors: Partial<Record<"title" | "body" | "form", string>> = {};
  if (!title) errors.title = "请填写标题";
  else if (title.length > LIMITS.title) errors.title = `标题最多 ${LIMITS.title} 字`;
  if (!body) errors.body = "请填写提示词";
  else if (body.length > LIMITS.body) errors.body = `提示词最多 ${LIMITS.body} 字`;
  const limitError = await dailyLimitError(user, "createPrompt");
  if (limitError) errors.form = limitError;
  if (Object.keys(errors).length > 0) {
    return data({ errors, values: { title, body } }, { status: 400 });
  }

  const id = newId(10);
  await db().insert(prompts).values({ id, authorId: user.id, title, body });
  return redirect(`/p/${id}`);
}

export default function NewPrompt({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const errors = actionData?.errors;
  const values = actionData?.values;

  return (
    <div className="mx-auto max-w-[720px]">
      <h1 className="text-title font-bold tracking-tight">出题</h1>
      <p className="mt-1 text-[15px] text-muted">
        写一段能让模型生成网页的提示词。有人提交答案后，题目内容不能再修改。
      </p>

      <Form method="post" className="panel mt-6 space-y-5 p-5 sm:p-6">
        <div>
          <label className="label" htmlFor="title">标题</label>
          <input
            id="title"
            name="title"
            className="field"
            maxLength={LIMITS.title}
            defaultValue={values?.title}
            placeholder="骑自行车的鹈鹕"
            aria-invalid={Boolean(errors?.title)}
            required
          />
          {errors?.title && <p className="mt-1 text-xs text-negative">{errors.title}</p>}
        </div>
        <div>
          <label className="label" htmlFor="body">提示词</label>
          <textarea
            id="body"
            name="body"
            rows={10}
            className="field h-auto py-2 leading-6"
            maxLength={LIMITS.body}
            defaultValue={values?.body}
            placeholder="Generate an SVG of a pelican riding a bicycle, as a single HTML page."
            aria-invalid={Boolean(errors?.body)}
            required
          />
          {errors?.body ? (
            <p className="mt-1 text-xs text-negative">{errors.body}</p>
          ) : (
            <p className="hint">答题者会原样复制这段文字发给模型。写明输出要求，比如“单个 HTML 文件”。</p>
          )}
        </div>
        {errors?.form && <p className="text-sm text-negative">{errors.form}</p>}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={navigation.state !== "idle"}>
            {navigation.state === "submitting" ? "发布中…" : "发布题目"}
          </button>
        </div>
      </Form>
    </div>
  );
}
