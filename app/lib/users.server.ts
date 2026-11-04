import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { users } from "~/db/schema";
import type { LinuxDoUser } from "./linuxdo.server";

const adminUsernames = () =>
  env.ADMIN_USERNAMES.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** Profile fields follow the forum on every login; bans stay local. */
export async function upsertUser(profile: LinuxDoUser) {
  const admins = adminUsernames();
  const isAdmin = admins.includes(profile.username.toLowerCase());
  // An empty allowlist is more likely a config mistake than an intentional
  // removal of every admin, so keep existing roles instead of demoting all.
  const demotedRole = admins.length > 0 ? "user" : sql`${users.role}`;
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
      // Role follows ADMIN_USERNAMES in both directions, so removing someone
      // from the list actually revokes access on their next login.
      set: { ...values, role: isAdmin ? "admin" : demotedRole },
    })
    .returning();
  return user;
}
