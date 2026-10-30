import { useEffect, useRef, useState } from "react";
import { PelicanMark } from "~/components/pelican-mark";
import { Star } from "lucide-react";
import type { PromptKind } from "~/lib/kinds";
import { SANDBOX } from "~/lib/sandbox";

export interface AnswerShareData {
  type: "answer";
  promptTitle: string;
  modelName: string;
  providerName: string;
  harnessName?: string | null;
  kind: PromptKind;
  previewUrl: string;
  starSum: number;
  votes: number;
}

export interface PromptShareData {
  type: "prompt";
  title: string;
  body: string;
  kind: PromptKind;
  totalSubmissions: number;
  topSubmissions: Array<{
    id: string;
    modelName: string;
    previewUrl: string;
    starSum: number;
    votes: number;
  }>;
}

export type ShareCardData = AnswerShareData | PromptShareData;

const V_WIDTH = 1200;
const V_HEIGHT = 630;

function ScaledFrame({
  src,
  kind,
  aspectRatio,
}: {
  src: string;
  kind: PromptKind;
  aspectRatio: "full" | "third";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) {
        // "full" 模式下以 1200 宽为基准，"third" 模式下以 400 宽为基准裁切居中
        const baseWidth = aspectRatio === "full" ? V_WIDTH : V_WIDTH / 3;
        setScale(w / baseWidth);
      }
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [aspectRatio]);

  if (kind === "svg") {
    return (
      <div ref={containerRef} className="relative size-full overflow-hidden bg-white">
        <img
          src={src}
          alt=""
          className="size-full object-contain p-4"
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative size-full overflow-hidden bg-white">
      {scale > 0 && (
        <iframe
          src={src}
          title="preview"
          sandbox={SANDBOX}
          tabIndex={-1}
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute top-0 left-1/2 origin-top border-0 bg-white"
          style={{
            width: V_WIDTH,
            height: V_HEIGHT,
            transform: `translateX(-50%) scale(${scale})`,
          }}
        />
      )}
    </div>
  );
}

export function ShareCardPreview({ data }: { data: ShareCardData }) {
  if (data.type === "answer") {
    const avg = data.votes > 0 ? (data.starSum / data.votes).toFixed(1) : null;
    return (
      <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-card border border-border bg-ground select-none">
        {/* 背景作品完整铺满 */}
        <div className="absolute inset-0">
          <ScaledFrame src={data.previewUrl} kind={data.kind} aspectRatio="full" />
        </div>

        {/* 水印 Logo */}
        <div className="absolute top-3 left-3.5 z-10 flex items-center gap-1.5 text-xs font-bold text-ink drop-shadow-[0_1px_3px_rgba(255,255,255,0.95)] sm:text-sm">
          <PelicanMark className="size-4 text-ink sm:size-5" />
          <span>Pelican Arena</span>
        </div>

        {/* 底部信息浮层 */}
        <div className="absolute inset-x-3.5 bottom-3.5 z-10 flex items-center justify-between gap-3 rounded-card border border-white/70 bg-surface/90 px-3.5 py-2.5 shadow-lg backdrop-blur-md sm:px-4 sm:py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[10px] text-muted sm:text-xs">
              同一道题 · {data.promptTitle}
            </div>
            <div className="truncate text-base font-extrabold text-ink sm:text-xl">
              {data.modelName}
            </div>
            <div className="truncate text-[10px] text-muted sm:text-xs">
              {data.providerName}
              {data.harnessName && ` · ${data.harnessName}`}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex items-center gap-1">
              <Star className="size-3.5 fill-accent text-accent sm:size-4" />
              <span className="text-xs font-bold text-ink sm:text-base">
                {avg ?? "暂无"}
              </span>
              <span className="text-[10px] text-muted sm:text-xs">
                {data.votes > 0 ? `${data.votes} 票` : "未评分"}
              </span>
            </div>
            <div className="inline-flex h-6 items-center rounded-control bg-primary px-2 text-[10px] font-semibold text-white sm:h-7 sm:px-2.5 sm:text-xs">
              你会打几分 →
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 题目卡
  const top = data.topSubmissions.slice(0, 3);
  return (
    <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-card border border-border bg-ground select-none">
      {/* 上半部分三格并排，每个答案各自缩放并居中裁剪 */}
      <div className="absolute inset-x-0 top-0 h-[60%] border-b border-border bg-raised">
        {top.length > 0 ? (
          <div
            className="grid h-full divide-x divide-border"
            style={{ gridTemplateColumns: `repeat(${top.length}, minmax(0, 1fr))` }}
          >
            {top.map((item) => (
              <div key={item.id} className="relative h-full overflow-hidden bg-white">
                <ScaledFrame src={item.previewUrl} kind={data.kind} aspectRatio="third" />
                <div className="absolute bottom-2 left-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-1 truncate rounded-full border border-white/80 bg-surface/90 px-2 py-0.5 text-[10px] font-medium text-ink shadow-sm backdrop-blur-sm sm:text-xs">
                  <span className="truncate">{item.modelName}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            暂无答案
          </div>
        )}
      </div>

      {/* 水印 Logo */}
      <div className="absolute top-3 left-3.5 z-10 flex items-center gap-1.5 text-xs font-bold text-ink drop-shadow-[0_1px_3px_rgba(255,255,255,0.95)] sm:text-sm">
        <PelicanMark className="size-4 text-ink sm:size-5" />
        <span>Pelican Arena</span>
      </div>

      {/* 下半部分题目信息 */}
      <div className="absolute inset-x-0 bottom-0 flex h-[40%] items-center justify-between gap-4 bg-surface px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-muted sm:text-xs">题目</div>
          <div className="truncate text-sm font-extrabold text-ink sm:text-lg">
            {data.title}
          </div>
          <div className="line-clamp-1 text-[10px] text-muted sm:text-xs">
            {data.body}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="text-xs font-semibold text-ink sm:text-sm">
            <b className="text-sm font-extrabold text-accent sm:text-base">
              {data.totalSubmissions}
            </b>{" "}
            个模型同题作答
          </div>
          <div className="inline-flex h-6 items-center rounded-control bg-primary px-2 text-[10px] font-semibold text-white sm:h-7 sm:px-2.5 sm:text-xs">
            看看谁画得最好 →
          </div>
        </div>
      </div>
    </div>
  );
}
