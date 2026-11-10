import { NavLink } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { NavIcon, type NavIconName } from "./NavIcon";

const links: { to: string; label: string; end: boolean; icon: NavIconName }[] = [
  { to: "/", label: "查词", end: true, icon: "search" },
  { to: "/review", label: "复习", end: false, icon: "review" },
  { to: "/library", label: "词库", end: false, icon: "library" },
  { to: "/settings", label: "设置", end: false, icon: "settings" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * 桌面端左侧导航（lg 及以上显示）。
 * 展开宽度 15rem，折叠宽度 4rem，折叠状态由 App 统一管理并持久化。
 */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { t } = useI18n();
  return (
    <aside
      aria-label={t("主要导航")}
      className={[
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-surface/95 backdrop-blur lg:flex",
        "transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      ].join(" ")}
    >
      <div className={`flex h-16 items-center gap-2 border-b border-border px-3 ${collapsed ? "justify-center" : "justify-between"}`}>
        <NavLink to="/" className="flex min-w-0 items-center gap-2.5" aria-label="Meoini">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-text">
            M
          </span>
          {!collapsed && <span className="truncate text-lg font-bold text-text">Meoini</span>}
        </NavLink>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={t("收起侧边栏")}
            title={t("收起侧边栏")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <ChevronIcon direction="left" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {links.map(({ to, label, end, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                title={t(label)}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    collapsed ? "justify-center px-0" : "",
                    isActive
                      ? "bg-primary text-primary-text"
                      : "text-text-muted hover:bg-surface-hover hover:text-text",
                  ].join(" ")
                }
              >
                <NavIcon name={icon} />
                {!collapsed && <span className="truncate">{t(label)}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {collapsed && (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={onToggle}
            aria-label={t("展开侧边栏")}
            title={t("展开侧边栏")}
            className="flex h-10 w-full items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <ChevronIcon direction="right" />
          </button>
        </div>
      )}
    </aside>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === "left" ? <path d="m14 6-6 6 6 6" /> : <path d="m10 6 6 6-6 6" />}
    </svg>
  );
}
