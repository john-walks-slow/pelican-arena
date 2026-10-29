import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { createCookieSessionStorage, redirect } from "react-router";
import { db } from "~/db/client.server";
import { users, type User } from "~/db/schema";

export interface FlashToast {
  id: number;
  message: string;
  kind: "success" | "error";
}

interface SessionData {
  userId: number;
  oauthState: string;
  returnTo: string;
  toast: FlashToast;
}

let storage: ReturnType<typeof createCookieSessionStorage<SessionData>> | undefined;

function sessionStorage() {
  storage ??= createCookieSessionStorage<SessionData>({
    cookie: {
      name: "__pelican",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: env.APP_ORIGIN.startsWith("https://"),
      secrets: [env.SESSION_SECRET],
      maxAge: 60 * 60 * 24 * 30,
    },
  });
  return storage;
}

export const getSession = (request: Request) =>
  sessionStorage().getSession(request.headers.get("Cookie"));
export const commitSession: ReturnType<typeof sessionStorage>["commitSession"] = (...args) =>
  sessionStorage().commitSession(...args);
export const destroySession: ReturnType<typeof sessionStorage>["destroySession"] = (...args) =>
  sessionStorage().destroySession(...args);

export async function getUser(request: Request): Promise<User | null> {
  const session = await getSession(request);
  const userId = session.get("userId");
  if (!userId) return null;
  const user = await db().query.users.findFirst({ where: eq(users.id, userId) });
  return user && !user.banned ? user : null;
}

export async function requireUser(request: Request): Promise<User> {
  const user = await getUser(request);
  if (!user) {
    const url = new URL(request.url);
    throw redirect(`/auth/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`);
  }
  return user;
}

/** Queues a toast that survives the next redirect and is consumed by the root loader. */
export async function flashToast(
  request: Request,
  message: string,
  kind: FlashToast["kind"] = "success",
) {
  const session = await getSession(request);
  session.set("toast", { id: Date.now(), message, kind });
  return commitSession(session);
}
