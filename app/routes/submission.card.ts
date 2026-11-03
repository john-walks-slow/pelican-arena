import { data } from "react-router";
import type { Route } from "./+types/submission.card";
import { getPrompt, getSubmission } from "~/lib/queries.server";
import { renderAnswerCard } from "~/lib/share-card";
import { cardResponse } from "~/lib/share-card.server";
import { thumbnailDataUri } from "~/lib/screenshot.server";

export async function loader({ params }: Route.LoaderArgs) {
  const submission = await getSubmission(params.submissionId);
  if (!submission || submission.status !== "active") throw data("Not Found", { status: 404 });
  const prompt = await getPrompt(submission.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });

  const previewImage = await thumbnailDataUri(submission.id, prompt.kind).catch(() => null);

  return cardResponse(
    renderAnswerCard({
      model: submission.model.name,
      provider: submission.provider.name,
      harness: submission.harness?.name ?? null,
      promptTitle: prompt.title,
      kind: prompt.kind,
      starSum: submission.starSum,
      votes: submission.votes,
      author: submission.author.username,
      previewImage,
    }),
  );
}
