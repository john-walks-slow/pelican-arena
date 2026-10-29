import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { users } from "~/db/schema";
import type { LinuxDoUser } from "./linuxdo.server";

const adminUsernames = () =>
  env.ADMIN_USERNAMES.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** Profile fields follow the forum on every login; role and bans stay local. */
export async function upsertUser(profile: LinuxDoUser) {
  const isAdmin = adminUsernames().includes(profile.username.toLowerCase());
  const values = {
    id: profile.id,
    username: profile.username,
    name: profile.name || null,
    avatarTemplate: profile.avatar_template,
    trustLevel: profile.trust_level,
    silenced: profile.silenced || !profile.active,
    lastLoginAt: new Date(),
  };
  const [user] = await db()
    .insert(users)
    .values({ ...values, role: isAdmin ? "admin" : "user" })
    .onConflictDoUpdate({
      target: users.id,
      set: { ...values, role: isAdmin ? "admin" : sql`${users.role}` },
    })
    .returning();
  return user;
}
