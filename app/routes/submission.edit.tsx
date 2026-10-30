import {
  data,
  isRouteErrorResponse,
  redirect,
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
import { updateSubmission } from "~/lib/submissions.server";
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
    catalog: await getCatalog(),
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
  return redirect(from ?? `/s/${submission.id}`, {
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
