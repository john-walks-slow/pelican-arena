import { describe, expect, it } from "vitest";
import { escapeXml, plainExcerpt, renderAnswerCard, renderPromptCard } from "./share-card";
import { shareSnippet } from "./share";

const answer = {
  model: "GPT-5 <script>",
  provider: "OpenAI & Co",
  harness: null,
  promptTitle: "骑自行车的鹈鹕",
  kind: "svg" as const,
  starSum: 9,
  votes: 2,
  author: "alice",
};

describe("share cards", () => {
  it("escapes user text", () => {
    const svg = renderAnswerCard(answer);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("GPT-5 &#60;script&#62;");
    expect(escapeXml(`a"b'c`)).toBe("a&#34;b&#39;c");
  });

  it("shows the average and vote count, or a placeholder without votes", () => {
    expect(renderAnswerCard(answer)).toContain(">4.5<");
    expect(renderAnswerCard({ ...answer, starSum: 0, votes: 0 })).toContain("暂无评分");
  });

  it("truncates overlong titles with an ellipsis", () => {
    const svg = renderPromptCard({
      title: "很长的标题".repeat(30),
      body: "正文",
      kind: "web",
      answers: 3,
      author: "bob",
    });
    expect(svg).toContain("…");
    expect(svg).toContain("3 份答案");
  });

  it("strips Markdown from the excerpt", () => {
    expect(plainExcerpt("# 标题\n\n```js\ncode()\n```\n**粗体** [链接](http://x)")).toBe("标题 粗体 链接");
  });
});

describe("share snippets", () => {
  const target = { pageUrl: "https://a.test/s/1", cardUrl: "https://a.test/s/1/card.svg", title: "A [x]" };
  it("builds each format", () => {
    expect(shareSnippet(target, "markdown")).toBe("[![A \\[x\\]](https://a.test/s/1/card.svg)](https://a.test/s/1)");
    expect(shareSnippet(target, "html")).toContain('<a href="https://a.test/s/1"><img src="https://a.test/s/1/card.svg"');
    expect(shareSnippet(target, "link")).toBe("https://a.test/s/1");
  });
});
