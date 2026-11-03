import * as React from "react";
import {
  data,
  isRouteErrorResponse,
  replace,
  useLocation,
  useParams,
} from "react-router";
import type { Route } from "./+types/submit";
import { GateDialog, useGate, type GateReason } from "~/components/gate-dialog";
import { SubmissionForm } from "~/components/submission/submission-form";
import { BundleError } from "~/lib/bundle";
import { cloudflareContext } from "~/lib/cloudflare-context";
import { hasAcceptedContentRules } from "~/lib/content-rules";
import { dailyLimitError, requirePermission } from "~/lib/guards.server";
import { safeFrom, withFrom } from "~/lib/navigation";
import { getCatalog, getPrompt } from "~/lib/queries.server";
import { flashToast } from "~/lib/session.server";
import { parseSubmissionMeta } from "~/lib/submission-input";
import { ensureThumbnail } from "~/lib/screenshot.server";
import { createSubmission, readBundleEntries } from "~/lib/submissions.server";
import { useDialogClose } from "~/lib/use-dialog-close";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: `提交答案 · ${loaderData?.prompt.title ?? ""} · Pelican Arena` },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  // Kick off the catalog read immediately, then wait only for the two checks
  // the dialog itself needs. The catalog streams in behind the open sheet.
  const catalog = getCatalog();
  const [, prompt] = await Promise.all([
    requirePermission(request, "submit"),
    getPrompt(params.promptId),
  ]);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });
  return {
    prompt: { id: prompt.id, title: prompt.title, kind: prompt.kind },
    catalog,
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const user = await requirePermission(request, "submit");
  const prompt = await getPrompt(params.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });

  if (!hasAcceptedContentRules(user)) return data({ error: "请先阅读并同意内容规则" }, { status: 403 });
  const limitError = await dailyLimitError(user, "submit");
  if (limitError) return data({ error: limitError }, { status: 429 });

  const form = await request.formData();
  const { meta, error } = parseSubmissionMeta(form);
  if (!meta) return data({ error }, { status: 400 });

  try {
    const entries = await readBundleEntries(form);
    const thumbFile = form.get("thumbnail");
    const thumbnail =
      thumbFile instanceof File && thumbFile.size > 0
        ? new Uint8Array(await thumbFile.arrayBuffer())
        : null;

    const id = await createSubmission({
      promptId: prompt.id,
      authorId: user.id,
      kind: prompt.kind,
      entries,
      meta,
      thumbnail,
    });
    if (!thumbnail) {
      // The client could not capture a poster; render one once, off the
      // critical path of this submission.
      context.get(cloudflareContext).ctx.waitUntil(
        ensureThumbnail(id, prompt.kind).catch((err) =>
          console.error("Background thumbnail rendering failed:", id, err),
        ),
      );
    }

    const from = safeFrom(new URL(request.url).searchParams.get("from"));
    return replace(withFrom(`/s/${id}`, from), {
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
  const gate = useGate();

  React.useEffect(() => {
    if (!gate.rulesAccepted) {
      gate.openRules();
    }
  }, [gate.rulesAccepted, gate.openRules]);

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
  let reason: GateReason = "trust_level";
  let title: string | undefined;
  let message = "加载失败，请稍后再试。";

  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      reason = "trust_level";
      if (typeof error.data === "string") message = error.data;
    } else if (error.status === 429) {
      reason = "daily_limit";
      if (typeof error.data === "string") message = error.data;
    } else {
      title = "无法提交答案";
      if (typeof error.data === "string") message = error.data;
    }
  }

  return (
    <GateDialog
      open={open}
      onOpenChange={(next) => !next && close()}
      reason={reason}
      action="submit"
      title={title}
      message={message}
    />
  );
}
