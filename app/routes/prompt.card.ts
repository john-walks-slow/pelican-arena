import { data } from "react-router";
import type { Route } from "./+types/prompt.card";
import { countActiveAnswers, getPrompt } from "~/lib/queries.server";
import { renderPromptCard } from "~/lib/share-card";
import { cardResponse } from "~/lib/share-card.server";

export async function loader({ params }: Route.LoaderArgs) {
  const prompt = await getPrompt(params.promptId);
  if (!prompt || prompt.status !== "active") throw data("Not Found", { status: 404 });

  return cardResponse(
    renderPromptCard({
      title: prompt.title,
      body: prompt.body,
      kind: prompt.kind,
      answers: await countActiveAnswers(prompt.id),
      author: prompt.author.username,
    }),
  );
}
