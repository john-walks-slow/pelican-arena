import { data, redirect } from "react-router";
import type { Route } from "./+types/prompt.edit";
import { PageHeader } from "~/components/page-header";
import { PromptForm } from "~/components/prompt-form";
import { initialPromptStatus, PROMPT_STATUS_LABELS } from "~/lib/moderation";
import { getPromptForEdit, updatePrompt } from "~/lib/queries.server";
import { requireOwnership } from "~/lib/guards.server";
import { isPromptKind, type PromptKind } from "~/lib/kinds";
import { backTarget, safeFrom } from "~/lib/navigation";
import { flashToast, requireUser } from "~/lib/session.server";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `编辑 ${loaderData?.prompt.title ?? "题目"} · Pelican Arena` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const prompt = await getPromptForEdit(params.promptId);
  if (!prompt || prompt.status === "removed") throw data("Not Found", { status: 404 });
  requireOwnership(user, prompt.authorId);
  return {
    prompt,
    locked: prompt.answers > 0,
    reviewed: initialPromptStatus(user) === "pending",
    from: safeFrom(new URL(request.url).searchParams.get("from")),
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const prompt = await getPromptForEdit(params.promptId);
  if (!prompt || prompt.status === "removed") throw data("Not Found", { status: 404 });
  requireOwnership(user, prompt.authorId);

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const kindRaw = String(form.get("kind") ?? prompt.kind);
  const kind: PromptKind = isPromptKind(kindRaw) ? kindRaw : prompt.kind;
  const locked = prompt.answers > 0;

  const errors: Partial<Record<"title" | "body" | "form", string>> = {};
  if (!title) errors.title = "请填写标题";
  else if (title.length > 80) errors.title = "标题最多 80 字";
  if (!body) errors.body = "请填写提示词";
  else if (body.length > 8000) errors.body = "提示词最多 8000 字";
  if (locked && (body !== prompt.body || kind !== prompt.kind)) {
    errors.form = "已有答案，提示词和作品类型不能再修改";
  }
  if (Object.keys(errors).length > 0) {
    return data({ errors, values: { title, body, kind } }, { status: locked ? 409 : 400 });
  }

  const reviewed = !locked && initialPromptStatus(user) === "pending";
  const ok = await updatePrompt({
    id: prompt.id,
    authorId: user.id,
    title,
    body,
    kind,
    locked,
    reviewed,
  });
  if (!ok) {
    const lateError: Partial<Record<"title" | "body" | "form", string>> = {
      form: "题目刚刚收到答案，请刷新后再试",
    };
    return data({ errors: lateError, values: { title, body, kind } }, { status: 409 });
  }

  const from = safeFrom(new URL(request.url).searchParams.get("from"));
  return redirect(from ?? `/p/${prompt.id}`, {
    headers: {
      "Set-Cookie": await flashToast(
        request,
        reviewed ? "已保存，等待审核" : "题目已更新",
      ),
    },
  });
}

export default function EditPrompt({ loaderData, actionData }: Route.ComponentProps) {
  const { prompt, locked, reviewed, from } = loaderData;
  const back = backTarget(from, { label: prompt.title, to: `/p/${prompt.id}` });

  return (
    <div className="mx-auto max-w-[1240px]">
      <PageHeader
        back={{ to: back.to, label: back.label, history: !back.explicit }}
        title="编辑题目"
        subtitle={
          locked
            ? "调整题目标题。"
            : reviewed
              ? `修改标题、正文和作品类型，保存后重新审核（当前${PROMPT_STATUS_LABELS[prompt.status]}）。`
              : "修改标题、正文和作品类型。"
        }
      />

      <PromptForm
        mode="edit"
        initial={prompt}
        locked={locked}
        answerCount={prompt.answers}
        errors={actionData?.errors}
        values={actionData?.values}
        cancelTo={back.to}
        cancelHistory={!back.explicit}
        submitLabel="保存修改"
      />
    </div>
  );
}
