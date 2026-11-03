export interface ShouldRevalidateArgs {
  formMethod?: string;
  actionResult?: unknown;
  currentUrl: URL;
  nextUrl: URL;
  defaultShouldRevalidate: boolean;
}

/**
 * Revalidation policy for the prompt detail route:
 * - Revalidates on form submissions / mutations.
 * - Revalidates when search params (e.g. model/provider/sort filters) change.
 * - Suppresses gallery reloads when purely opening or closing the /submit child dialog.
 * - Falls back to default revalidation for other route transitions.
 */
export function promptShouldRevalidate({
  formMethod,
  actionResult,
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateArgs): boolean {
  if (formMethod && formMethod !== "GET") return defaultShouldRevalidate;
  if (actionResult !== undefined) return defaultShouldRevalidate;
  if (currentUrl.search !== nextUrl.search) return true;
  const withoutDialog = (pathname: string) => pathname.replace(/\/submit$/, "");
  if (
    currentUrl.pathname !== nextUrl.pathname &&
    withoutDialog(currentUrl.pathname) === withoutDialog(nextUrl.pathname)
  ) {
    return false;
  }
  return defaultShouldRevalidate;
}
