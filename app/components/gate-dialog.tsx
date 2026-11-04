import * as React from "react";
import { useLocation } from "react-router";
import { ContentRulesDialog } from "~/components/content-rules-dialog";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { LinuxDoIcon } from "~/components/ui/linuxdo-icon";
import type { User } from "~/db/schema";
import {
  ACTION_LABELS,
  DAILY_LIMITS,
  LIMIT_NOUNS,
  TRUST,
  type Action,
} from "~/lib/permissions";

export type GateReason = "login" | "trust_level" | "daily_limit" | "silenced";

export interface GateOptions {
  reason: GateReason;
  action?: Action;
  message?: string;
  title?: string;
  returnTo?: string;
  requiredTrustLevel?: number;
  currentTrustLevel?: number;
}

export interface GateDialogProps extends GateOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 统一的受限操作拦截弹窗控件。
 * 覆盖未登录、信任等级不足、达到每日上限、账号禁言等全部限制场景。
 */
export function GateDialog({
  open,
  onOpenChange,
  reason,
  action,
  message,
  title,
  returnTo,
  requiredTrustLevel,
  currentTrustLevel,
}: GateDialogProps) {
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}`;
  const effectiveReturnTo = returnTo ?? currentPath;
  const loginUrl = `/auth/login?returnTo=${encodeURIComponent(effectiveReturnTo)}`;

  const actionName = action ? ACTION_LABELS[action] : null;

  let resolvedTitle = title;
  let primaryDesc: React.ReactNode = message;
  let secondaryDesc: React.ReactNode = null;

  if (reason === "login") {
    resolvedTitle ??= "需要登录";
    primaryDesc ??= actionName
      ? `${actionName}需要登录 Linux DO 账号后继续。`
      : "该操作需要登录 Linux DO 账号后继续。";
    secondaryDesc =
      effectiveReturnTo === currentPath
        ? "登录后将自动返回当前页面。"
        : "登录后将回到你刚才要去的页面。";
  } else if (reason === "trust_level") {
    resolvedTitle ??= "信任等级不足";
    const req = requiredTrustLevel ?? (action ? TRUST[action] : 1);
    const cur = currentTrustLevel ?? 0;
    primaryDesc ??= actionName
      ? `${actionName}需要信任等级 TL${req} 及以上，你当前为 TL${cur}。`
      : `该操作需要信任等级 TL${req} 及以上，你当前为 TL${cur}。`;
  } else if (reason === "daily_limit") {
    resolvedTitle ??= "已达今日上限";
    if (!primaryDesc && action) {
      primaryDesc = `24 小时内最多${LIMIT_NOUNS[action]} ${DAILY_LIMITS[action]} 次。`;
    }
    primaryDesc ??= "已达到当前操作的 24 小时频次限制。";
    secondaryDesc = "频次按 24 小时滚动计算，请稍后再试。";
  } else if (reason === "silenced") {
    resolvedTitle ??= "账号受限";
    primaryDesc ??= "你的论坛账号处于禁言状态，暂无法进行此操作。";
  }

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription className="sr-only">{resolvedTitle}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-2 px-5 py-4 text-sm leading-relaxed text-muted">
          <p className="text-ink">{primaryDesc}</p>
          {secondaryDesc && <p className="text-xs text-muted">{secondaryDesc}</p>}
        </DialogBody>

        <DialogFooter className="justify-end gap-2">
          {reason === "login" ? (
            <>
              <Button type="button" variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button asChild variant="linuxdo" className="gap-2">
                <a href={loginUrl}>
                  <LinuxDoIcon size={16} />
                  Linux DO 登录
                </a>
              </Button>
            </>
          ) : (
            <Button type="button" variant="primary" onClick={handleClose}>
              知道了
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface GateContextValue {
  open: (options: GateOptions) => void;
  close: () => void;
  guard: (
    action: Action,
    onAllowed: () => void,
    options?: { returnTo?: string; onBlocked?: (reason: GateReason) => void },
  ) => boolean;
  rulesAccepted: boolean;
  openRules: (onAccepted?: () => void) => void;
  viewRules: () => void;
}

const GateContext = React.createContext<GateContextValue | null>(null);

export type GateUser = Pick<User, "trustLevel" | "silenced" | "role"> & {
  rulesAccepted?: boolean;
};

export function GateProvider({
  user,
  children,
}: {
  user: GateUser | null;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const [dialogState, setDialogState] = React.useState<
    (GateOptions & { open: boolean }) | null
  >(null);
  const [localRulesAccepted, setLocalRulesAccepted] = React.useState<boolean | null>(null);
  const [rulesDialogOpen, setRulesDialogOpen] = React.useState(false);
  const [rulesDialogMode, setRulesDialogMode] = React.useState<"mandatory" | "view">("mandatory");
  const pendingAllowedRef = React.useRef<(() => void) | null>(null);

  const isRulesAccepted = localRulesAccepted ?? Boolean(user?.rulesAccepted);

  const open = React.useCallback((options: GateOptions) => {
    setDialogState({ ...options, open: true });
  }, []);

  const close = React.useCallback(() => {
    setDialogState((prev) => (prev ? { ...prev, open: false } : null));
  }, []);

  const openRules = React.useCallback((onAccepted?: () => void) => {
    pendingAllowedRef.current = onAccepted ?? null;
    setRulesDialogMode("mandatory");
    setRulesDialogOpen(true);
  }, []);

  const viewRules = React.useCallback(() => {
    setRulesDialogMode("view");
    setRulesDialogOpen(true);
  }, []);

  const guard = React.useCallback(
    (
      action: Action,
      onAllowed: () => void,
      options?: { returnTo?: string; onBlocked?: (reason: GateReason) => void },
    ): boolean => {
      if (!user) {
        options?.onBlocked?.("login");
        open({
          reason: "login",
          action,
          returnTo: options?.returnTo ?? `${location.pathname}${location.search}`,
        });
        return false;
      }

      if (user.silenced) {
        options?.onBlocked?.("silenced");
        open({ reason: "silenced", action });
        return false;
      }

      if (user.role !== "admin" && user.trustLevel < TRUST[action]) {
        options?.onBlocked?.("trust_level");
        open({
          reason: "trust_level",
          action,
          requiredTrustLevel: TRUST[action],
          currentTrustLevel: user.trustLevel,
        });
        return false;
      }

      if ((action === "createPrompt" || action === "submit") && !isRulesAccepted) {
        pendingAllowedRef.current = onAllowed;
        setRulesDialogOpen(true);
        return false;
      }

      onAllowed();
      return true;
    },
    [user, location.pathname, location.search, open, isRulesAccepted],
  );

  const contextValue = React.useMemo<GateContextValue>(
    () => ({
      open,
      close,
      guard,
      rulesAccepted: isRulesAccepted,
      openRules,
      viewRules,
    }),
    [open, close, guard, isRulesAccepted, openRules, viewRules],
  );

  return (
    <GateContext.Provider value={contextValue}>
      {children}
      {dialogState && (
        <GateDialog
          open={dialogState.open}
          onOpenChange={(next) => {
            if (!next) close();
          }}
          reason={dialogState.reason}
          action={dialogState.action}
          message={dialogState.message}
          title={dialogState.title}
          returnTo={dialogState.returnTo}
          requiredTrustLevel={dialogState.requiredTrustLevel}
          currentTrustLevel={dialogState.currentTrustLevel}
        />
      )}
      <ContentRulesDialog
        open={rulesDialogOpen}
        mode={rulesDialogMode}
        onOpenChange={(next) => {
          if (!next) {
            setRulesDialogOpen(false);
            pendingAllowedRef.current = null;
          }
        }}
        onAccepted={() => {
          setLocalRulesAccepted(true);
          const next = pendingAllowedRef.current;
          pendingAllowedRef.current = null;
          setRulesDialogOpen(false);
          next?.();
        }}
      />
    </GateContext.Provider>
  );
}

export function useGate(): GateContextValue {
  const ctx = React.useContext(GateContext);
  if (!ctx) {
    throw new Error("useGate must be used within a GateProvider");
  }
  return ctx;
}
