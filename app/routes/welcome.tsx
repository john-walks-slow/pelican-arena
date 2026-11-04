import { ArrowRight, Loader2 } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { Link, useNavigate, useNavigation } from "react-router";
import type { Route } from "./+types/welcome";
import { cn } from "~/lib/utils";

export const meta: Route.MetaFunction = () => [
  { title: "Pelican Arena · 同题竞技" },
  {
    name: "description",
    content: "同一道提示词，不同大模型各显身手。真实代码与视觉交互，直接对比。",
  },
];

interface CadencePhrase {
  text: string;
  baseDelayMs: number;
  charStepMs?: number;
}

// 意群节奏划分：以人类呼吸和语言重音为节拍，告别机械单调打字
const PHRASES: CadencePhrase[] = [
  { text: "同一道提示词，", baseDelayMs: 360, charStepMs: 18 },
  { text: "不同大模型各显身手。", baseDelayMs: 560, charStepMs: 16 },
  { text: "真实产出，", baseDelayMs: 820, charStepMs: 18 },
  { text: "直接对比。", baseDelayMs: 960, charStepMs: 18 },
];

export default function WelcomePage() {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [stage, setStage] = useState<"loading" | "morphing" | "settled">("loading");
  const [dismissing, setDismissing] = useState(false);
  const isNavigating = navigation.state === "loading" || dismissing;

  useEffect(() => {
    // 0~600ms: 轨道展开
    // 600~1700ms: 轮毂与鹈鹕骨骼流光勾勒
    // 1700ms+: 阻尼定格微动，文本韵律展开
    const t1 = setTimeout(() => setStage("morphing"), 600);
    const t2 = setTimeout(() => setStage("settled"), 1700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const handleEnter = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (dismissing) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("pelican_welcomed", "1");
    }
    setDismissing(true);
    setTimeout(() => {
      navigate("/", { replace: true });
    }, 380);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleEnter();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-ground select-none transition-all duration-400 ease-out",
        dismissing ? "pointer-events-none scale-102 opacity-0 blur-xs" : "opacity-100 scale-100",
      )}
      style={{
        backgroundImage: `radial-gradient(ellipse at 50% 45%, color-mix(in srgb, var(--color-surface) 75%, transparent) 0%, var(--color-ground) 100%)`,
      }}
    >
      {/* Precision Blueprint Grid Backdrop */}
      <div className="intro-grid-backdrop absolute inset-0 pointer-events-none opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]" />

      {/* Main Focal Center: Logo Morph Rig + Editorial Text */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6">
        {/* Animated Rig (Variant 1: Kinetic Trace) */}
        <div className="relative mb-6 flex size-52 sm:size-60 items-center justify-center">
          {/* Subtle Horizon Track */}
          <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-[1px] bg-gradient-to-r from-transparent via-border to-transparent" />

          <svg
            viewBox="0 0 32 32"
            fill="none"
            className={cn(
              "size-40 sm:size-48 transition-transform duration-700 ease-out",
              stage === "settled" ? "scale-100" : "scale-95",
            )}
          >
            {/* Animated Road Track */}
            <line
              x1="1.5"
              y1="29.5"
              x2="30.5"
              y2="29.5"
              stroke="var(--color-control)"
              strokeWidth="1.6"
              strokeDasharray="3.5 4"
              strokeLinecap="round"
              className={stage !== "loading" ? "intro-road-slide" : "opacity-30"}
            />

            {/* Kinetic Rear Wheel */}
            <g
              className={cn(
                "transition-all duration-700 ease-out",
                stage === "loading"
                  ? "opacity-0 -translate-x-4 scale-50"
                  : "opacity-100 translate-x-0 scale-100",
              )}
              style={{ transformOrigin: "9px 23px" }}
            >
              <circle
                cx="9"
                cy="23"
                r="5.5"
                stroke="currentColor"
                strokeWidth="2"
                className="text-ink intro-wheel-draw"
              />
              <g
                className={stage === "settled" ? "intro-spin-fast" : "intro-spin-slow"}
                style={{ transformOrigin: "9px 23px" }}
              >
                <line x1="9" y1="18.6" x2="9" y2="27.4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="text-muted" />
                <line x1="5.19" y1="20.8" x2="12.81" y2="25.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="text-muted" />
                <line x1="5.19" y1="25.2" x2="12.81" y2="20.8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="text-muted" />
                <circle cx="9" cy="23" r="1.15" fill="var(--color-accent)" />
              </g>
            </g>

            {/* Kinetic Front Wheel */}
            <g
              className={cn(
                "transition-all duration-700 ease-out",
                stage === "loading"
                  ? "opacity-0 translate-x-4 scale-50"
                  : "opacity-100 translate-x-0 scale-100",
              )}
              style={{ transformOrigin: "23px 23px" }}
            >
              <circle
                cx="23"
                cy="23"
                r="5.5"
                stroke="currentColor"
                strokeWidth="2"
                className="text-ink intro-wheel-draw"
              />
              <g
                className={stage === "settled" ? "intro-spin-fast" : "intro-spin-slow"}
                style={{ transformOrigin: "23px 23px" }}
              >
                <line x1="23" y1="18.6" x2="23" y2="27.4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="text-muted" />
                <line x1="19.19" y1="20.8" x2="26.81" y2="25.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="text-muted" />
                <line x1="19.19" y1="25.2" x2="26.81" y2="20.8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="text-muted" />
                <circle cx="23" cy="23" r="1.15" fill="var(--color-accent)" />
              </g>
            </g>

            {/* Kinetic Body & Pelican Beak Vector Trace */}
            <path
              d="M9 23l5-8h7l2 8M14 15c-1.5-3 0-6.5 3.5-6.5 2 0 3 1 3.5 2.5l8 1.5c-1.32 2.56-5.24 3.5-8 2.5"
              stroke="var(--color-accent)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                "intro-path-trace transition-opacity duration-300",
                stage === "loading" ? "opacity-0" : "opacity-100",
              )}
            />

            {/* Speed Dust Particles */}
            <g
              className={cn(
                "transition-opacity duration-500",
                stage === "settled" ? "opacity-100" : "opacity-0",
              )}
              stroke="var(--color-muted)"
              strokeWidth="1.2"
              strokeLinecap="round"
            >
              <line x1="2.2" y1="26.6" x2="4" y2="26.6" className="intro-dust-a" />
              <line x1="1.4" y1="27.9" x2="3.2" y2="27.9" className="intro-dust-b" />
            </g>
          </svg>
        </div>

        {/* Clean Editorial Content with Rhythmic Cadence */}
        <div className="flex flex-col items-center text-center max-w-lg">
          {/* Title: Two Crisp Word Beats (Pelican + Arena) */}
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink flex items-baseline gap-2.5">
            {stage === "settled" ? (
              <>
                <span
                  style={{ "--delay": "40ms" } as CSSProperties}
                  className="title-word-reveal"
                >
                  Pelican
                </span>
                <span
                  style={{ "--delay": "160ms" } as CSSProperties}
                  className="title-word-reveal text-accent"
                >
                  Arena
                </span>
              </>
            ) : (
              <span className="opacity-0">Pelican Arena</span>
            )}
          </h1>

          {/* Subtitle: Rhythmic Sense-Units with Natural Pauses (No Slop Blur) */}
          <p className="mt-3.5 text-sm sm:text-base leading-relaxed text-muted min-h-[3rem] flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            {stage === "settled" ? (
              PHRASES.map((phrase, pIdx) => (
                <span key={pIdx} className="phrase-cadence-unit">
                  {Array.from(phrase.text).map((char, cIdx) => {
                    const delay = phrase.baseDelayMs + cIdx * (phrase.charStepMs ?? 16);
                    return (
                      <span
                        key={cIdx}
                        style={{ "--delay": `${delay}ms` } as CSSProperties}
                        className="phrase-char-reveal"
                      >
                        {char}
                      </span>
                    );
                  })}
                </span>
              ))
            ) : (
              <span className="opacity-0">
                同一道提示词，不同大模型各显身手。真实产出，直接对比。
              </span>
            )}
          </p>

          {/* Action Trigger */}
          <div
            className={cn(
              "mt-7 transition-all duration-500 ease-out",
              stage === "settled" ? "welcome-btn-lift" : "opacity-0 pointer-events-none",
            )}
          >
            <Link
              to="/"
              prefetch="render"
              onClick={handleEnter}
              className="group relative inline-flex items-center gap-2.5 rounded-full bg-ink px-7 py-3 text-sm font-semibold text-ground shadow-sm transition-all duration-200 hover:bg-ink/90 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>进入竞技场</span>
              {isNavigating ? (
                <Loader2 className="size-4 animate-spin text-ground" />
              ) : (
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              )}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
