import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("prompts/new", "routes/prompts.new.tsx"),
  route("me", "routes/me.tsx"),
  route("p/:promptId", "routes/prompt.tsx", [route("submit", "routes/submit.tsx")]),
  route("p/:promptId/edit", "routes/prompt.edit.tsx"),
  route("p/:promptId/submissions", "routes/prompt.submissions.ts"),
  route("s/:submissionId", "routes/submission.tsx", [route("edit", "routes/submission.edit.tsx")]),
  route("s/:submissionId/download", "routes/submission.download.ts"),
  route("s/:submissionId/log", "routes/submission.log.ts"),
  route("compare", "routes/compare.tsx"),
  route("auth/login", "routes/auth.login.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),
  route("api/prompts", "routes/api.prompts.ts"),
  route("api/catalog", "routes/api.catalog.ts"),
  route("api/mine/prompts", "routes/api.mine.prompts.ts"),
  route("api/mine/submissions", "routes/api.mine.submissions.ts"),
] satisfies RouteConfig;
