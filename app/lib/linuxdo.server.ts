import { env } from "cloudflare:workers";

const AUTHORIZE_URL = "https://connect.linux.do/oauth2/authorize";
const TOKEN_URL = "https://connect.linux.do/oauth2/token";
const USER_URL = "https://connect.linux.do/api/user";

export interface LinuxDoUser {
  id: number;
  username: string;
  name: string | null;
  avatar_template: string | null;
  active: boolean;
  trust_level: number;
  silenced: boolean;
}

export const redirectUri = () => `${env.APP_ORIGIN}/auth/callback`;

export const isOAuthConfigured = () =>
  Boolean(env.LINUXDO_CLIENT_ID && env.LINUXDO_CLIENT_SECRET);

export function authorizeUrl(state: string) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.LINUXDO_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCode(code: string): Promise<LinuxDoUser> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.LINUXDO_CLIENT_ID}:${env.LINUXDO_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Linux DO token exchange failed: ${tokenRes.status}`);
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const userRes = await fetch(USER_URL, {
    headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json" },
  });
  if (!userRes.ok) {
    throw new Error(`Linux DO user request failed: ${userRes.status}`);
  }
  return (await userRes.json()) as LinuxDoUser;
}
