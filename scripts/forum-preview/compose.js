/**
 * Rebuilds the three things a reader can see when a Pelican link is pasted
 * into Discourse: the onebox card, an image snippet, or an iframe embed.
 */
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const absolute = (value, base) => {
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
};

function parseAttrs(tag) {
  const attrs = {};
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(tag))) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return attrs;
}

export function parseMeta(html, baseUrl) {
  const meta = { title: "", description: "", image: "", siteName: "", type: "", oembed: "", favicon: "" };
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleTag) meta.title = decodeEntities(titleTag[1].trim());

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = parseAttrs(tag);
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    const content = attrs.content;
    if (content === undefined) continue;
    if (key === "og:title" && !meta.title) meta.title = content;
    else if (key === "og:title") meta.title = content;
    if (key === "og:description" && !meta.description) meta.description = content;
    if (key === "og:image" && !meta.image) meta.image = absolute(content, baseUrl);
    if (key === "og:site_name") meta.siteName = content;
    if (key === "og:type") meta.type = content;
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attrs = parseAttrs(tag);
    const rel = (attrs.rel ?? "").toLowerCase();
    if (rel.includes("alternate") && attrs.type === "application/json+oembed" && attrs.href) {
      meta.oembed = absolute(attrs.href, baseUrl);
    }
    if (!meta.favicon && rel.split(/\s+/).some((r) => r === "icon" || r === "shortcut")) {
      meta.favicon = attrs.href ? absolute(attrs.href, baseUrl) : "";
    }
  }

  meta.title = decodeEntities(meta.title).replace(/\s+/g, " ").trim();
  meta.description = decodeEntities(meta.description).replace(/\s+/g, " ").trim();
  return meta;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function fetchPage(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
  });
  const html = await res.text();
  return {
    status: res.status,
    finalUrl: res.url || url,
    html,
    meta: parseMeta(html, res.url || url),
  };
}

/** Onebox's article card for a generic page, matching Discourse core's markup. */
export function oneboxCard(page) {
  const { finalUrl, meta } = page;
  const host = new URL(finalUrl).host;
  const sourceName = meta.siteName || host;
  const title = escapeHtml(meta.title || host);
  const image = meta.image
    ? `<img width="512" height="512" src="${escapeHtml(meta.image)}" class="thumbnail" alt="">`
    : "";
  const description = meta.description ? `<p>${escapeHtml(meta.description)}</p>` : "";
  const favicon = meta.favicon
    ? `<img src="${escapeHtml(meta.favicon)}" class="site-icon" alt="">`
    : "";

  return `<aside class="onebox allowlistedgeneric" data-onebox-src="${escapeHtml(finalUrl)}">
  <header class="source">
      ${favicon}
      <a href="${escapeHtml(finalUrl)}" target="_blank" rel="nofollow ugc noopener">${escapeHtml(sourceName)}</a>
  </header>
  <article class="onebox-body">
    ${image}
<h3><a href="${escapeHtml(finalUrl)}" target="_blank" rel="nofollow ugc noopener">${title}</a></h3>
  ${description}
  </article>
  <div class="onebox-metadata">
  </div>
  <div style="clear: both"></div>
</aside>`;
}

/** The oEmbed branch: a page can hand Discourse an iframe to embed instead of a card. */
export async function oembedEmbed(page, allowedIframes) {
  if (!page.meta.oembed) return null;
  let data;
  try {
    const res = await fetch(page.meta.oembed, { headers: { "user-agent": UA } });
    data = await res.json();
  } catch {
    return null;
  }
  if (data?.type !== "rich" || typeof data.html !== "string" || !/<iframe/i.test(data.html)) {
    return null;
  }
  const src = data.html.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
  if (!src) return null;
  const allowed = allowedIframes.some((entry) => {
    const pattern = entry.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/?#\\\\]+");
    return new RegExp(`^${pattern}.*$`, "i").test(src);
  });
  if (!allowed) return { blocked: true, src };
  return { html: `<iframe src="${escapeHtml(src)}" width="${data.width ?? "100%"}" height="${data.height ?? 400}" scrolling="no" frameborder="0"></iframe>` };
}

export function pictureSnippet({ pageUrl, cardUrl, title }) {
  const escapeAttr = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<a href="${pageUrl}">
<picture><source type="image/svg+xml" srcset="${cardUrl} 1x"><img width="600" height="315" alt="${escapeAttr(title)}"></picture>
</a>`;
}

export function markdownSnippet({ cardUrl, title }) {
  const alt = title.replace(/[[\]\\]/g, "\\$&");
  return `![${alt}](${cardUrl})`;
}

export function markdownToCooked(markdown) {
  const m = markdown.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (!m) return `<p>${escapeHtml(markdown)}</p>`;
  return `<p><img src="${escapeHtml(m[2])}" alt="${escapeHtml(m[1])}"></p>`;
}

export function iframeSnippet({ src, height = 420 }) {
  return `<iframe src="${src}" width="100%" height="${height}" frameborder="0" allowfullscreen></iframe>`;
}

export function videoSnippet({ src, poster, height = 420 }) {
  return `<video autoplay muted loop playsinline controls height="${height}" poster="${poster ?? ""}"><source src="${src}"></video>`;
}
