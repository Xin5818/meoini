import { useEffect } from "react";

/**
 * 监听 Escape 键以关闭弹窗。`enabled` 为 false 时不注册监听。
 * 桌面端快捷键：Esc 关闭弹窗。
 */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape, enabled]);
}
