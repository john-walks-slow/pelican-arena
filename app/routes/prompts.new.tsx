import { ArrowLeft } from "lucide-react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/prompts.new";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
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
    <div className="mx-auto max-w-[680px]">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" strokeWidth={1.75} />
        题目
      </Link>
      <h1 className="mt-2 text-title font-bold tracking-tight">出题</h1>
      <p className="mt-1 text-sm text-muted">
        写一段能让模型生成网页的提示词。有人提交答案后，题目内容不能再修改。
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
            placeholder="Generate an SVG of a pelican riding a bicycle, as a single HTML page."
            aria-invalid={Boolean(errors?.body)}
            required
          />
          {errors?.body ? (
            <p className="mt-1 text-xs text-negative">{errors.body}</p>
          ) : (
            <p className="mt-1 text-xs text-muted">
              答题者会原样复制这段文字发给模型。写明输出要求，比如「单个 HTML 文件」。
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
