/**
 * Port of Discourse's post sanitizer (frontend/pretty-text/addon/sanitizer.js).
 * Keeping the rules byte-for-byte matters: the preview has to predict what a
 * Discourse forum will actually keep, not what a browser would render.
 */
import xss from "xss";
import AllowLister from "./allow-lister.js";

// Should match any <iframe> without a src attribute
const IFRAME_REGEXP = /<iframe(?![^>]*\s+src\s*=)[^>]*>[\s\S]*?(<\/iframe\s*>|$)/gi;

function attr(name, value) {
  return value ? `${name}="${xss.escapeAttrValue(value)}"` : name;
}

export function hrefAllowed(href, extraHrefMatchers) {
  href = href.replace(/'/g, "%27");

  if (/^(https?:)?\/\/[\w.\-]+/i.test(href)) {
    return href;
  }
  if (/^\/[\w.\-]+/i.test(href)) {
    return href;
  }
  if (/^#[\w.\-]+/i.test(href)) {
    return href;
  }
  if (/^mailto:[\w.\-@]+/i.test(href)) {
    return href;
  }

  if (extraHrefMatchers && extraHrefMatchers.length > 0) {
    for (const matcher of extraHrefMatchers) {
      if (matcher.test(href)) return href;
    }
  }
  return undefined;
}

function sanitizeMediaSrc(tag, attrName, value, extraHrefMatchers) {
  const srcAttrs = { img: ["src"], source: ["src", "srcset"], track: ["src"] };
  if (!srcAttrs[tag]?.includes(attrName)) return undefined;

  if (value.startsWith("data:image")) return attr(attrName, value);

  if (attrName === "srcset") {
    const srcset = value.split(",").map((v) => v.split(" ", 2));
    const sanitized = srcset
      .map((src) => {
        const allowed = hrefAllowed(src[0], extraHrefMatchers);
        if (allowed) return src[1] ? `${allowed} ${src[1]}` : allowed;
        return undefined;
      })
      .join(",");
    return attr(attrName, sanitized);
  }

  const allowed = hrefAllowed(value, extraHrefMatchers);
  return attr(attrName, allowed);
}

function testDataAttribute(forTag, name, value) {
  return Object.keys(forTag).find((k) => {
    const nameWithMatcher = `^${k.replace(/\*$/, "\\w+?")}`;
    const validValues = forTag[k];
    return (
      new RegExp(nameWithMatcher).test(name) &&
      (validValues.includes("*") ? true : validValues.includes(value))
    );
  });
}

export function isAllowListedAttr(forTag, name, value) {
  const forAttr = forTag[name];
  return !!(
    (forAttr && (forAttr.includes("*") || forAttr.includes(value))) ||
    (!name.includes("data-html-") &&
      name.startsWith("data-") &&
      (forTag["data-*"] || testDataAttribute(forTag, name, value)))
  );
}

function iframeSrcAllowed(src, allowedIframes) {
  let decoded;
  try {
    decoded = decodeURIComponent(src);
  } catch {
    return false;
  }
  const urls = [decoded, src];
  return (
    !decoded.match(/\/\.+(?:[/\\?#]|$)/) &&
    allowedIframes.some((entry) => {
      const pattern = entry
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // escape regex, keep *
        .replace(/\*/g, "[^/?#\\\\]+");
      const allowed = new RegExp(`^${pattern}.*$`, "i");
      return urls.every((url) => allowed.test(url));
    })
  );
}

/**
 * @param {string} text cooked HTML
 * @param {{allowedIframes?: string[]}} options
 */
export function sanitize(text, options = {}) {
  if (!text) return "";

  text = text.replace(/<([^A-Za-z/!]|$)/g, "&lt;$1");

  const allowLister = new AllowLister({
    allowedIframes: options.allowedIframes ?? [],
  });
  const allowList = allowLister.getAllowList();
  const allowedHrefSchemes = allowLister.getAllowedHrefSchemes();
  const allowedIframes = allowLister.getAllowedIframes();

  let extraHrefMatchers = null;
  if (allowedHrefSchemes && allowedHrefSchemes.length > 0) {
    extraHrefMatchers = [
      new RegExp(`^(${allowedHrefSchemes.join("|")})://[\\w\\.\\-]+`, "i"),
    ];
    if (allowedHrefSchemes.includes("tel")) {
      extraHrefMatchers.push(new RegExp("^tel://\\+?[\\w\\.\\-]+", "i"));
    }
  }

  const result = xss(text, {
    allowList: allowList.tagList,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script", "table"],

    onIgnoreTagAttr(tag, name, value) {
      const forTag = allowList.attrList[tag];
      if (!forTag) return undefined;

      if (
        isAllowListedAttr(forTag, name, value) ||
        (tag === "a" && name === "href" && hrefAllowed(value, extraHrefMatchers)) ||
        (tag === "iframe" && name === "src" && iframeSrcAllowed(value, allowedIframes))
      ) {
        return attr(name, value);
      }

      const mediaSrc = sanitizeMediaSrc(tag, name, value, extraHrefMatchers);
      if (mediaSrc) return mediaSrc;

      if (tag === "iframe" && name === "src") return "";

      if (tag === "video" && name === "autoplay") return "autoplay muted";

      if (
        ["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag) &&
        value.match(/^heading--[a-zA-Z0-9\-_]+$/)
      ) {
        return attr(name, value);
      }

      return undefined;
    },
  });

  return result
    .replace(/\[removed\]/g, "")
    .replace(IFRAME_REGEXP, "")
    .replace(/&(?![#\w]+;)/g, "&amp;")
    .replace(/&#39;/g, "'")
    .replace(/ \/>/g, ">");
}

export const DEFAULT_IFRAME_ALLOWLIST = [
  "https://www.google.com/maps/embed?",
  "https://www.openstreetmap.org/export/embed.html?",
  "https://calendar.google.com/calendar/embed?",
  "https://codepen.io/*/embed/preview/",
  "https://www.instagram.com/",
  "https://player.bilibili.com/player.html",
  "https://www.youtube.com/embed/",
  "https://linux.do/discobot/certificate.svg",
  "https://www.bilibili.com/blackboard/live/live-activity-player.html",
  "https://embed.music.apple.com/",
  "https://open.spotify.com/embed/",
  "https://music.163.com/outchain/player",
  "https://embed.podcasts.apple.com/",
  "https://api.http.rw/e/",
  "https://i.y.qq.com/n2/m/outchain/player/index.html",
];
