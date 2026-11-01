import { and, eq, isNull } from "drizzle-orm";
import { db } from "~/db/client.server";
import { apiTokens, users } from "~/db/schema";
import { newId } from "./ids";

/** Secrets look like `pa_<32 chars>` and are shown once at creation. */
const TOKEN_PREFIX = "pa_";
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createApiToken(createdBy: number, name: string) {
  const id = newId(10);
  const secret = `${TOKEN_PREFIX}${newId(32)}`;
  await db()
    .insert(apiTokens)
    .values({ id, name, tokenHash: await sha256(secret), createdBy });
  return { id, name, secret };
}

export async function listApiTokens() {
  return db()
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
      createdBy: users.username,
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.createdBy))
    .where(isNull(apiTokens.revokedAt))
    .orderBy(apiTokens.createdAt);
}

export async function revokeApiToken(id: string) {
  await db()
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), isNull(apiTokens.revokedAt)));
}

export interface TokenActor {
  id: string;
  name: string;
}

/** Resolves `Authorization: Bearer pa_…` to a live token, or null. */
export async function authenticateApiToken(request: Request): Promise<TokenActor | null> {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(pa_[a-z0-9]+)$/i.exec(header.trim());
  if (!match) return null;
  const token = await db().query.apiTokens.findFirst({
    where: and(eq(apiTokens.tokenHash, await sha256(match[1])), isNull(apiTokens.revokedAt)),
  });
  if (!token) return null;
  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await db().update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, token.id));
  }
  return { id: token.id, name: token.name };
}
