import { useEffect, useRef, useState } from "react";
import { SANDBOX } from "~/lib/sandbox";

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;

/**
 * A submitted page rendered at desktop size and scaled to fit its box. The
 * frame mounts only while on screen, so a long gallery does not run every
 * page's animations at once.
 */
export function PagePreview({ src, title }: { src: string; title: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const resize = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / VIEWPORT_WIDTH);
    });
    const intersect = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "480px",
    });
    resize.observe(box);
    intersect.observe(box);
    return () => {
      resize.disconnect();
      intersect.disconnect();
    };
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative aspect-[16/10] w-full overflow-hidden bg-raised"
    >
      {visible && scale > 0 && (
        <iframe
          src={src}
          title={title}
          sandbox={SANDBOX}
          loading="lazy"
          tabIndex={-1}
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute top-0 left-0 origin-top-left border-0 bg-white"
          style={{
            width: VIEWPORT_WIDTH,
            height: VIEWPORT_HEIGHT,
            transform: `scale(${scale})`,
          }}
        />
      )}
    </div>
  );
}

export function LiveFrame({ src, title, className }: { src: string; title: string; className?: string }) {
  return (
    <iframe
      src={src}
      title={title}
      sandbox={SANDBOX}
      referrerPolicy="no-referrer"
      allow="fullscreen; autoplay"
      className={`block border-0 bg-white ${className ?? ""}`}
    />
  );
}
