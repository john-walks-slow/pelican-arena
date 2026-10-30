import { env } from "cloudflare:workers";
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
import {
  buildBundle,
  BundleError,
  readTextBundle,
  type BundleEntry,
} from "~/lib/bundle";
import { KIND_META } from "~/lib/kinds";
import { safeFrom } from "~/lib/navigation";
import {
  countOtherRatings,
  getCatalog,
  getPrompt,
  getSubmission,
} from "~/lib/queries.server";
import { flashToast, requireUser } from "~/lib/session.server";
import { FIELDS, parseSubmissionMeta } from "~/lib/submission-input";
import {
  readBundleEntries,
  SubmissionLockedError,
  updateSubmission,
} from "~/lib/submissions.server";
import { bundleKey } from "~/lib/usercontent.server";
import { useDialogClose } from "~/lib/use-dialog-close";

const PREFILL_LIMIT = 512 * 1024;

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `编辑答案 · ${loaderData?.prompt.title ?? ""} · Pelican Arena` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const submission = await getSubmission(params.submissionId);
  if (!submission) throw data("Not Found", { status: 404 });
  if (submission.authorId !== user.id) throw data("只能编辑自己的答案", { status: 403 });
  if (submission.status !== "active") throw data("已撤回的答案需要先恢复", { status: 403 });

  const otherRatings = await countOtherRatings(submission.id, user.id);
  if (otherRatings > 0) {
    throw data(`已有 ${otherRatings} 人打分，答案不能再修改。需要更换内容，请撤回后重新提交。`, {
      status: 403,
    });
  }

  const prompt = await getPrompt(submission.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });

  let initialText: string | null = null;
  if (prompt.kind !== "web") {
    const entry = KIND_META[prompt.kind].entry;
    const object = await env.FILES.get(bundleKey(submission.id, entry));
    if (object && object.size <= PREFILL_LIMIT) initialText = await object.text();
  }

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
      hasRawLog: submission.hasRawLog,
    },
    prompt: { id: prompt.id, title: prompt.title, kind: prompt.kind },
    catalog: await getCatalog(),
    initialText,
    useFileMode: prompt.kind !== "web" && initialText === null,
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const submission = await getSubmission(params.submissionId);
  if (!submission) throw data("Not Found", { status: 404 });
  if (submission.authorId !== user.id) throw data("只能编辑自己的答案", { status: 403 });
  if (submission.status !== "active") throw data("已撤回的答案需要先恢复", { status: 403 });

  const otherRatings = await countOtherRatings(submission.id, user.id);
  if (otherRatings > 0) {
    return data({ error: `已有 ${otherRatings} 人打分，答案不能再修改` }, { status: 403 });
  }

  const prompt = await getPrompt(submission.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });

  const form = await request.formData();
  const { meta, error } = parseSubmissionMeta(form);
  if (!meta) return data({ error }, { status: 400 });

  try {
    let entries: BundleEntry[] | null = null;
    const replace = form.get("replace") === "1";
    if (replace) {
      entries = await readBundleEntries(form);
      if (entries.length === 0) return data({ error: "请选择要替换的文件" }, { status: 400 });
    } else if (prompt.kind !== "web") {
      const text = String(form.get("text") ?? "");
      if (!text.trim()) {
        return data({ error: `请填写${KIND_META[prompt.kind].resultTitle}` }, { status: 400 });
      }
      const bytes = new TextEncoder().encode(text);
      readTextBundle(prompt.kind, bytes);
      entries = buildBundle(
        [{ path: KIND_META[prompt.kind].entry, data: bytes }],
        prompt.kind,
      );
    }

    await updateSubmission({
      id: submission.id,
      authorId: user.id,
      kind: prompt.kind,
      currentFiles: submission.files,
      currentContent: submission.content,
      currentLogMeta: submission.logMeta,
      currentHasRawLog: submission.hasRawLog,
      entries,
      meta,
      removeRawLog: form.get("removeRawLog") === "1",
    });
  } catch (e) {
    if (e instanceof BundleError) return data({ error: e.message }, { status: 400 });
    if (e instanceof SubmissionLockedError) {
      return data({ error: "刚刚有人打分，答案已锁定" }, { status: 409 });
    }
    throw e;
  }

  const from = safeFrom(new URL(request.url).searchParams.get("from"));
  return redirect(from ?? `/s/${submission.id}`, {
    headers: { "Set-Cookie": await flashToast(request, "答案已更新") },
  });
}

export default function EditSubmission({ loaderData }: Route.ComponentProps) {
  const { submission, prompt, catalog, initialText, useFileMode } = loaderData;
  const { search } = useLocation();
  const from = safeFrom(new URLSearchParams(search).get("from"));
  const { open, close } = useDialogClose(from ?? `/s/${submission.id}`);

  return (
    <SubmissionForm
      mode="edit"
      prompt={prompt}
      catalog={catalog}
      initial={submission}
      initialText={initialText}
      useFileMode={useFileMode}
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
  let title = "无法编辑答案";
  let message = "加载失败，请稍后再试。";
  if (isRouteErrorResponse(error)) {
    if (error.status === 403) title = "答案已锁定";
    if (typeof error.data === "string") message = error.data;
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
