import * as React from "react";
import { CircleAlert } from "lucide-react";
import { data, redirect } from "react-router";
import type { Route } from "./+types/prompts.new";
import { useGate } from "~/components/gate-dialog";
import { PageHeader } from "~/components/page-header";
import { PromptForm } from "~/components/prompt-form";
import { db } from "~/db/client.server";
import { prompts } from "~/db/schema";
import { hasAcceptedContentRules } from "~/lib/content-rules";
import { dailyLimitError, requirePermission } from "~/lib/guards.server";
import { newId } from "~/lib/ids";
import { isPromptKind, type PromptKind } from "~/lib/kinds";
import { initialPromptStatus } from "~/lib/moderation";
import { promptReviewEnabled } from "~/lib/moderation.server";
import { cachedClientLoader, clearRouteCache } from "~/lib/route-cache";
import { flashToast } from "~/lib/session.server";

export const meta: Route.MetaFunction = () => [{ title: "出题 · Pelican Arena" }];

const LIMITS = { title: 80, body: 8000 };

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requirePermission(request, "createPrompt");
  return { reviewed: initialPromptStatus(user, promptReviewEnabled()) === "pending" };
}

export function clientLoader({ request, serverLoader }: Route.ClientLoaderArgs) {
  return cachedClientLoader(request, serverLoader);
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  clearRouteCache();
  return serverAction();
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requirePermission(request, "createPrompt");
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const kindRaw = String(form.get("kind") ?? "web");
  const kind: PromptKind = isPromptKind(kindRaw) ? kindRaw : "web";
  const allowSearch = form.get("allowSearch") === "on" || form.get("allowSearch") === "true";
  const allowLibraries =
    kind === "markdown"
      ? false
      : form.get("allowLibraries") === "on" || form.get("allowLibraries") === "true";

  const errors: Partial<Record<"title" | "body" | "form", string>> = {};
  if (!title) errors.title = "请填写标题";
  else if (title.length > LIMITS.title) errors.title = `标题最多 ${LIMITS.title} 字`;
  if (!body) errors.body = "请填写提示词";
  else if (body.length > LIMITS.body) errors.body = `提示词最多 ${LIMITS.body} 字`;
  if (!hasAcceptedContentRules(user)) errors.form = "请先阅读并同意内容规则";
  const limitError = await dailyLimitError(user, "createPrompt");
  if (limitError) errors.form = limitError;
  if (Object.keys(errors).length > 0) {
    return data(
      { errors, values: { title, body, kind, allowSearch, allowLibraries } },
      { status: 400 },
    );
  }

  const id = newId(10);
  const status = initialPromptStatus(user, promptReviewEnabled());
  await db().insert(prompts).values({
    id,
    authorId: user.id,
    title,
    body,
    kind,
    allowSearch,
    allowLibraries,
    status,
  });
  return redirect(`/p/${id}`, {
    headers: {
      "Set-Cookie": await flashToast(
        request,
        status === "pending" ? "已提交，通过审核后公开" : "题目已发布",
      ),
    },
  });
}

export default function NewPrompt({ loaderData, actionData }: Route.ComponentProps) {
  const gate = useGate();

  React.useEffect(() => {
    if (!gate.rulesAccepted) {
      gate.openRules();
    }
  }, [gate.rulesAccepted, gate.openRules]);

  return (
    <div className="mx-auto max-w-[1240px]">
      <PageHeader
        title="出题"
        subtitle="写一段让模型产出同一类作品的提示词。"
        actions={
          <button
            type="button"
            onClick={gate.viewRules}
            title="查看内容规则"
            aria-label="查看内容规则"
            className="inline-flex size-8 items-center justify-center rounded-control border border-border bg-surface text-muted transition-colors hover:border-rule hover:bg-raised hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <CircleAlert className="size-4 text-accent" strokeWidth={2} />
          </button>
        }
      />

      <PromptForm
        mode="create"
        errors={actionData?.errors}
        values={actionData?.values}
        cancelTo="/"
        submitLabel={loaderData.reviewed ? "提交审核" : "发布题目"}
        hint={loaderData.reviewed ? "新题目经审核后公开并开放作答。" : undefined}
      />
    </div>
  );
}
