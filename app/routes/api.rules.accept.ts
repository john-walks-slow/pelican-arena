import { eq } from "drizzle-orm";
import { data } from "react-router";
import type { Route } from "./+types/api.rules.accept";
import { db } from "~/db/client.server";
import { users } from "~/db/schema";
import { requireUser } from "~/lib/session.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method Not Allowed" }, { status: 405 });
  }

  const user = await requireUser(request);
  const now = new Date();
  await db()
    .update(users)
    .set({ rulesAcceptedAt: now })
    .where(eq(users.id, user.id));

  return data({ ok: true, rulesAcceptedAt: now.getTime() });
}
