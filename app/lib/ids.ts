const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function newId(length = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Catalog ids are derived from names so "GPT-5 " and "gpt-5" collapse to one entry. */
export function slugify(name: string) {
  return name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_/]+/g, "-")
    .replace(/[^\p{L}\p{N}.\-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
