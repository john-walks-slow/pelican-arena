import {
  data,
  isRouteErrorResponse,
  redirect,
  useLocation,
  useParams,
} from "react-router";
import type { Route } from "./+types/submit";
import { SubmissionErrorDialog } from "~/components/submission/submission-error-dialog";
import { SubmissionForm } from "~/components/submission/submission-form";
import { BundleError, formatBytes } from "~/lib/bundle";
import { dailyLimitError, requirePermission } from "~/lib/guards.server";
import { safeFrom, withFrom } from "~/lib/navigation";
import { getCatalog, getPrompt } from "~/lib/queries.server";
import { flashToast } from "~/lib/session.server";
import { FIELDS, parseSubmissionMeta, RAW_LOG_LIMIT } from "~/lib/submission-input";
import { createSubmission, readBundleEntries } from "~/lib/submissions.server";
import { useDialogClose } from "~/lib/use-dialog-close";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: `提交答案 · ${loaderData?.prompt.title ?? ""} · Pelican Arena` },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  await requirePermission(request, "submit");
  const prompt = await getPrompt(params.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });
  return {
    prompt: { id: prompt.id, title: prompt.title, kind: prompt.kind },
    catalog: await getCatalog(),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requirePermission(request, "submit");
  const prompt = await getPrompt(params.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });

  const limitError = await dailyLimitError(user, "submit");
  if (limitError) return data({ error: limitError }, { status: 429 });

  const form = await request.formData();
  const { meta, error } = parseSubmissionMeta(form);
  if (!meta) return data({ error }, { status: 400 });

  const rawLog = form.get(FIELDS.rawLog);
  const rawLogFile = rawLog instanceof File && rawLog.size > 0 ? rawLog : null;
  if (rawLogFile && rawLogFile.size > RAW_LOG_LIMIT) {
    return data({ error: `日志超过 ${formatBytes(RAW_LOG_LIMIT)}` }, { status: 400 });
  }

  try {
    const entries = await readBundleEntries(form);
    const id = await createSubmission({
      promptId: prompt.id,
      authorId: user.id,
      kind: prompt.kind,
      entries,
      meta,
      rawLog: rawLogFile,
    });
    const from = safeFrom(new URL(request.url).searchParams.get("from"));
    return redirect(withFrom(`/s/${id}`, from), {
      headers: { "Set-Cookie": await flashToast(request, "已提交，感谢你的参与") },
    });
  } catch (e) {
    if (e instanceof BundleError) return data({ error: e.message }, { status: 400 });
    throw e;
  }
}

export default function Submit({ loaderData }: Route.ComponentProps) {
  const { prompt, catalog } = loaderData;
  const { search } = useLocation();
  const { open, close } = useDialogClose(`/p/${prompt.id}${search}`);

  return (
    <SubmissionForm
      mode="create"
      prompt={prompt}
      catalog={catalog}
      open={open}
      onClose={close}
    />
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { promptId = "" } = useParams();
  const { search } = useLocation();
  const { open, close } = useDialogClose(promptId ? `/p/${promptId}${search}` : "/");
  let title = "无法提交答案";
  let message = "加载失败，请稍后再试。";
  if (isRouteErrorResponse(error)) {
    if (error.status === 403) title = "没有提交权限";
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
