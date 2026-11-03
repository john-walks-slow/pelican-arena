import type { PromptKind } from "./kinds";

const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 630;

/**
 * Renders an SVG string into a 1200x630 WebP Blob via Canvas.
 */
async function svgToWebpBlob(svgText: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();

      const cleanup = () => {
        URL.revokeObjectURL(url);
      };

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = TARGET_WIDTH;
          canvas.height = TARGET_HEIGHT;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            cleanup();
            return resolve(null);
          }

          // Fill clean white background
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

          // Contain scale & center
          const imgRatio = (img.naturalWidth || TARGET_WIDTH) / (img.naturalHeight || TARGET_HEIGHT);
          const targetRatio = TARGET_WIDTH / TARGET_HEIGHT;

          let dw = TARGET_WIDTH;
          let dh = TARGET_HEIGHT;
          let dx = 0;
          let dy = 0;

          if (imgRatio > targetRatio) {
            dw = TARGET_WIDTH;
            dh = TARGET_WIDTH / imgRatio;
            dy = (TARGET_HEIGHT - dh) / 2;
          } else {
            dh = TARGET_HEIGHT;
            dw = TARGET_HEIGHT * imgRatio;
            dx = (TARGET_WIDTH - dw) / 2;
          }

          ctx.drawImage(img, dx, dy, dw, dh);
          cleanup();

          canvas.toBlob(
            (blob) => resolve(blob),
            "image/webp",
            0.85,
          );
        } catch {
          cleanup();
          resolve(null);
        }
      };

      img.onerror = () => {
        cleanup();
        resolve(null);
      };

      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Extracts an SVG element from an HTML string if present, returning its XML string.
 */
function extractSvgFromHtml(html: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const svg = doc.querySelector("svg");
    if (svg) {
      // Ensure essential namespace
      if (!svg.getAttribute("xmlns")) {
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      }
      return new XMLSerializer().serializeToString(svg);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Renders an HTML string inside an off-screen sandbox iframe and retrieves its visual snapshot.
 */
async function captureHtmlViaIframe(html: string, timeoutMs = 1200): Promise<Blob | null> {
  return new Promise((resolve) => {
    let resolved = false;
    let timer: number | null = null;
    let iframe: HTMLIFrameElement | null = null;

    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
      iframe = null;
    };

    const done = (blob: Blob | null) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(blob);
    };

    const onMessage = async (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "PELICAN_CAPTURE_SVG" && typeof e.data.xml === "string") {
        const blob = await svgToWebpBlob(e.data.xml);
        done(blob);
      } else if (e.data.type === "PELICAN_CAPTURE_DATA" && typeof e.data.dataUrl === "string") {
        try {
          const res = await fetch(e.data.dataUrl);
          const blob = await res.blob();
          done(blob);
        } catch {
          done(null);
        }
      } else if (e.data.type === "PELICAN_CAPTURE_NONE") {
        done(null);
      }
    };

    window.addEventListener("message", onMessage);
    timer = window.setTimeout(() => done(null), timeoutMs);

    try {
      iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.top = "-9999px";
      iframe.style.left = "-9999px";
      iframe.style.width = `${TARGET_WIDTH}px`;
      iframe.style.height = `${TARGET_HEIGHT}px`;
      iframe.style.border = "none";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";
      iframe.sandbox.add("allow-scripts");

      const injectedScript = `
<script>
(() => {
  window.addEventListener('load', () => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const canvas = document.querySelector('canvas');
          if (canvas) {
            try {
              const dataUrl = canvas.toDataURL('image/webp', 0.85);
              window.parent.postMessage({ type: 'PELICAN_CAPTURE_DATA', dataUrl }, '*');
              return;
            } catch (err) {}
          }
          const svg = document.querySelector('svg');
          if (svg) {
            if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            const xml = new XMLSerializer().serializeToString(svg);
            window.parent.postMessage({ type: 'PELICAN_CAPTURE_SVG', xml }, '*');
            return;
          }
        } catch (e) {}
        window.parent.postMessage({ type: 'PELICAN_CAPTURE_NONE' }, '*');
      }, 200);
    });
  });
})();
<\/script>
`;

      const docHtml = html.includes("</body>")
        ? html.replace("</body>", `${injectedScript}</body>`)
        : `${html}${injectedScript}`;

      document.body.appendChild(iframe);
      iframe.srcdoc = docHtml;
    } catch {
      done(null);
    }
  });
}

/**
 * Main client-side thumbnail generator.
 * Runs in the user's browser before upload.
 * Returns a WebP Blob (1200x630) or null on failure/timeout.
 */
export async function captureClientThumbnail(
  kind: PromptKind,
  entryData: Uint8Array,
): Promise<Blob | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(entryData);

    // 1. Direct SVG input
    if (kind === "svg") {
      return await svgToWebpBlob(text);
    }

    // 2. Web (HTML) input
    if (kind === "web") {
      // Fast path: Check if the HTML directly contains an SVG graphic
      const svgXml = extractSvgFromHtml(text);
      if (svgXml) {
        const blob = await svgToWebpBlob(svgXml);
        if (blob) return blob;
      }

      // Offscreen iframe path for interactive/animated/canvas components
      return await captureHtmlViaIframe(text);
    }
  } catch (err) {
    console.warn("Client thumbnail capture skipped due to error:", err);
  }

  return null;
}
