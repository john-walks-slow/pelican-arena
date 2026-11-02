import { useEffect, useRef, useState, type ReactNode } from "react";
import { PelicanRide } from "~/components/pelican-ride";
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

/**
 * 品牌 Accent 橙色新 Logo（PelicanRide，带辐条车轮）
 * 裸态呈现：不要背景、不要边框，无文字与发光。
 */
function BrandBadge({ className = "" }: { className?: string }) {
  return (
    <PelicanRide
      className={`size-5 text-[#c2410c] sm:size-6 select-none ${className}`}
    />
  );
}

function ScaledFrame({
  src,
  kind,
  className = "",
}: {
  src: string;
  kind: PromptKind;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        // 严格按照作品 canonical (1200x630) 比例等比完全展示，不切边缘
        const s = Math.min(w / V_WIDTH, h / V_HEIGHT);
        setScale(s);
      }
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (kind === "svg") {
    return (
      <div
        ref={containerRef}
        className={`relative size-full overflow-hidden flex items-center justify-center bg-white ${className}`}
      >
        <img
          src={src}
          alt=""
          className="size-full object-contain p-2"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative size-full overflow-hidden bg-white ${className}`}
    >
      {scale > 0 && (
        <iframe
          src={src}
          title="preview"
          sandbox={SANDBOX}
          tabIndex={-1}
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute top-1/2 left-1/2 origin-center border-0 bg-transparent"
          style={{
            width: V_WIDTH,
            height: V_HEIGHT,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        />
      )}
    </div>
  );
}

/**
 * 卡片外框：固定浅色规范，完全与全局深色模式隔绝。
 * 由作品区域的 1200:630 比例高度 + 底部独立信息栏自然撑开，平整干净。
 */
function CardFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-theme="light"
      style={{
        colorScheme: "light",
      }}
      className={`relative w-full overflow-hidden rounded-xl border border-[#e2e4e8] bg-white text-[#111827] select-none shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function ShareCardPreview({ data }: { data: ShareCardData }) {
  if (data.type === "answer") {
    const avg = data.votes > 0 ? (data.starSum / data.votes).toFixed(1) : null;

    return (
      <CardFrame>
        {/* 上半部分：作品严格按 canonical (1200x630) 长宽比显示，无 margin，无多层卡片 */}
        <div className="relative aspect-[1200/630] w-full overflow-hidden bg-white">
          <ScaledFrame src={data.previewUrl} kind={data.kind} />
          {/* 纯净裸 Accent 橙色 PelicanRide Logo，不要背景，不要框 */}
          <div className="absolute top-3 left-3.5 z-10">
            <BrandBadge />
          </div>
        </div>

        {/* 下半部分：独立信息底栏，直接紧接着作品内容，完全不遮挡作品 */}
        <div className="flex items-center justify-between gap-3 border-t border-[#e5e7eb] bg-white px-3.5 py-2 sm:px-5 sm:py-2.5">
          <div className="min-w-0 flex-1">
            {/* 直接展示题目名，不要“同一道题·”前缀 */}
            <div className="truncate text-[10px] text-[#6b7280] sm:text-xs">
              {data.promptTitle}
            </div>
            <div className="truncate text-sm font-extrabold text-[#111827] sm:text-base">
              {data.modelName}
            </div>
            <div className="truncate text-[10px] text-[#9ca3af] sm:text-xs">
              {data.providerName}
              {data.harnessName && ` · ${data.harnessName}`}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1 sm:gap-1.5">
            <div className="flex items-center gap-1">
              <Star className="size-3.5 fill-[#f97316] text-[#ea580c] sm:size-4" />
              <span className="text-xs font-bold text-[#111827] sm:text-base">
                {avg ?? "暂无"}
              </span>
              <span className="text-[10px] text-[#6b7280] sm:text-xs">
                {data.votes > 0 ? `${data.votes} 票` : "未评分"}
              </span>
            </div>
            <div className="inline-flex h-6 items-center rounded-md bg-[#18181b] px-2 text-[10px] font-semibold text-white shadow-sm sm:h-7 sm:px-2.5 sm:text-xs">
              你会打几分 →
            </div>
          </div>
        </div>
      </CardFrame>
    );
  }

  // 题目卡（Prompt Card）
  const top = data.topSubmissions.slice(0, 3);
  const hasSubmissions = top.length > 0;

  return (
    <CardFrame>
      {/* 上半部分：作品展示区或克制的暂无答案 */}
      <div className="relative aspect-[1200/630] w-full overflow-hidden bg-white">
        {hasSubmissions ? (
          <div
            className="grid size-full divide-x divide-[#e5e7eb]"
            style={{
              gridTemplateColumns: `repeat(${top.length}, minmax(0, 1fr))`,
            }}
          >
            {top.map((item) => (
              <div key={item.id} className="relative size-full overflow-hidden bg-white">
                <ScaledFrame src={item.previewUrl} kind={data.kind} />
                <div className="absolute bottom-2 left-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-1 truncate rounded-full border border-black/10 bg-white/95 px-2 py-0.5 text-[10px] font-medium text-[#111827] shadow-sm backdrop-blur-sm sm:text-xs">
                  <span className="truncate">{item.modelName}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 恢复过去简单克制的设计：暂无答案 */
          <div className="flex size-full items-center justify-center text-xs text-[#9ca3af]">
            暂无答案
          </div>
        )}

        {/* 纯净裸 Accent 橙色 PelicanRide Logo */}
        <div className="absolute top-3 left-3.5 z-10">
          <BrandBadge />
        </div>
      </div>

      {/* 下半部分：题目信息与按钮 */}
      <div className="flex items-center justify-between gap-3 border-t border-[#e5e7eb] bg-white px-3.5 py-2.5 sm:px-5 sm:py-3">
        <div className="min-w-0 flex-1">
          {/* 就叫“题目” */}
          <div className="text-[10px] text-[#6b7280] sm:text-xs">题目</div>
          <div className="truncate text-sm font-extrabold text-[#111827] sm:text-base">
            {data.title}
          </div>
          <div className="line-clamp-1 text-[10px] text-[#6b7280] sm:text-xs">
            {data.body}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 sm:gap-1.5">
          <div className="text-xs font-semibold text-[#111827] sm:text-sm">
            <b className="text-sm font-extrabold text-[#c2410c] sm:text-base">
              {data.totalSubmissions}
            </b>{" "}
            个模型同题作答
          </div>
          {/* 克制自然的按钮文案 */}
          <div className="inline-flex h-6 items-center rounded-md bg-[#18181b] px-2.5 text-[10px] font-semibold text-white shadow-sm sm:h-7 sm:text-xs">
            {hasSubmissions ? "看看谁画得最好 →" : "来答这道题 →"}
          </div>
        </div>
      </div>
    </CardFrame>
  );
}
