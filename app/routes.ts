import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("prompts/new", "routes/prompts.new.tsx"),
  route("p/:promptId", "routes/prompt.tsx"),
  route("p/:promptId/submissions", "routes/prompt.submissions.ts"),
  route("p/:promptId/submit", "routes/submit.tsx"),
  route("s/:submissionId", "routes/submission.tsx"),
  route("s/:submissionId/download", "routes/submission.download.ts"),
  route("s/:submissionId/log", "routes/submission.log.ts"),
  route("compare", "routes/compare.tsx"),
  route("auth/login", "routes/auth.login.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),
  route("api/prompts", "routes/api.prompts.ts"),
  route("api/catalog", "routes/api.catalog.ts"),
] satisfies RouteConfig;
