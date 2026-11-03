import {
  data,
  isRouteErrorResponse,
  replace,
  useLocation,
  useParams,
} from "react-router";
import type { Route } from "./+types/submission.edit";
import { SubmissionErrorDialog } from "~/components/submission/submission-error-dialog";
import { SubmissionForm } from "~/components/submission/submission-form";
import { safeFrom } from "~/lib/navigation";
import {
  getCatalog,
  getPrompt,
  getSubmission,
} from "~/lib/queries.server";
import { flashToast, requireUser } from "~/lib/session.server";
import { parseSubmissionMeta } from "~/lib/submission-input";
import { setSubmissionStatus, updateSubmission } from "~/lib/submissions.server";
import { useDialogClose } from "~/lib/use-dialog-close";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `编辑答案 · ${loaderData?.prompt.title ?? ""} · Pelican Arena` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const submission = await getSubmission(params.submissionId);
  if (!submission) throw data("Not Found", { status: 404 });
  if (submission.authorId !== user.id) throw data("只能编辑自己的答案", { status: 403 });
  if (submission.status !== "active") throw data("已撤回的答案需要先恢复", { status: 403 });

  const prompt = await getPrompt(submission.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });

  return {
    submission: {
      id: submission.id,
      promptId: submission.promptId,
      status: submission.status,
      model: submission.model.name,
      provider: submission.provider.name,
      harness: submission.harness?.name ?? "",
      reasoning: submission.reasoning ?? "",
      mods: submission.mods.map((m) => m.name),
      notes: submission.notes ?? "",
      files: submission.files,
      logMeta: submission.logMeta,
    },
    prompt: { id: prompt.id, title: prompt.title, kind: prompt.kind },
    catalog: getCatalog(),
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const submission = await getSubmission(params.submissionId);
  if (!submission) throw data("Not Found", { status: 404 });
  if (submission.authorId !== user.id) throw data("只能编辑自己的答案", { status: 403 });
  if (submission.status !== "active") throw data("已撤回的答案需要先恢复", { status: 403 });

  const prompt = await getPrompt(submission.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });

  const form = await request.formData();
  if (form.get("intent") === "withdraw") {
    const result = await setSubmissionStatus(submission.id, user.id, "hidden");
    if (result === "ok") {
      const from = safeFrom(new URL(request.url).searchParams.get("from"));
      return replace(from ?? `/p/${prompt.id}`, {
        headers: { "Set-Cookie": await flashToast(request, "答案已撤回") },
      });
    }
    if (result === "not_found") throw data("答案不存在", { status: 404 });
    if (result === "conflict") return data({ error: "答案正在处理或已下架，请联系管理员" }, { status: 409 });
    return data({ error: "只能操作自己的答案" }, { status: 403 });
  }

  const { meta, error } = parseSubmissionMeta(form);
  if (!meta) return data({ error }, { status: 400 });

  const updated = await updateSubmission({
    id: submission.id,
    authorId: user.id,
    meta,
  });
  if (!updated) {
    return data({ error: "答案状态已变更，请刷新后再试" }, { status: 409 });
  }

  const from = safeFrom(new URL(request.url).searchParams.get("from"));
  return replace(from ?? `/s/${submission.id}`, {
    headers: { "Set-Cookie": await flashToast(request, "答案已更新") },
  });
}

export default function EditSubmission({ loaderData }: Route.ComponentProps) {
  const { submission, prompt, catalog } = loaderData;
  const { search } = useLocation();
  const from = safeFrom(new URLSearchParams(search).get("from"));
  const { open, close } = useDialogClose(from ?? `/s/${submission.id}`);

  return (
    <SubmissionForm
      mode="edit"
      prompt={prompt}
      catalog={catalog}
      initial={submission}
      open={open}
      onClose={close}
    />
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { submissionId = "" } = useParams();
  const { search } = useLocation();
  const from = safeFrom(new URLSearchParams(search).get("from"));
  const { open, close } = useDialogClose(from ?? `/s/${submissionId}`);
  const title = "无法编辑答案";
  let message = "加载失败，请稍后再试。";
  if (isRouteErrorResponse(error) && typeof error.data === "string") {
    message = error.data;
  }

  return (
    <SubmissionErrorDialog
      open={open}
      onClose={close}
      title={title}
      message={message}
    />
  );
}
