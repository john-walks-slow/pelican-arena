import { data } from "react-router";
import type { Route } from "./+types/prompt.card";
import { countActiveAnswers, getPrompt, listSubmissions } from "~/lib/queries.server";
import { renderPromptCard } from "~/lib/share-card";
import { cardResponse } from "~/lib/share-card.server";
import { getOrGenerateThumbnail } from "~/lib/screenshot.server";

export async function loader({ params }: Route.LoaderArgs) {
  const prompt = await getPrompt(params.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });

  const [answersCount, topResult] = await Promise.all([
    countActiveAnswers(prompt.id),
    listSubmissions(prompt.id, {}, "top", 1, 3).catch(() => ({ submissions: [] })),
  ]);

  const topSubmissions = await Promise.all(
    topResult.submissions.map(async (sub) => {
      const previewImage = await getOrGenerateThumbnail(sub.id, prompt.kind).catch(() => null);
      return {
        modelName: sub.model.name,
        previewImage,
      };
    }),
  );

  return cardResponse(
    renderPromptCard({
      title: prompt.title,
      body: prompt.body,
      kind: prompt.kind,
      answers: answersCount,
      author: prompt.author.username,
      topSubmissions,
    }),
  );
}
