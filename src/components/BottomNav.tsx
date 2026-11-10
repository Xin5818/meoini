import { NavLink } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { NavIcon, type NavIconName } from "./NavIcon";

const links: { to: string; label: string; end: boolean; icon: NavIconName }[] = [
  { to: "/", label: "查词", end: true, icon: "search" },
  { to: "/review", label: "复习", end: false, icon: "review" },
  { to: "/library", label: "词库", end: false, icon: "library" },
  { to: "/settings", label: "设置", end: false, icon: "settings" },
];

/**
 * 移动端/平板底部导航（lg 以下显示）。
 * 触控区不小于 56px 高，桌面端由 Sidebar 取代。
 */
export function BottomNav() {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("主要导航")}
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {links.map(({ to, label, end, icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-medium transition-colors",
                  isActive ? "text-primary-text" : "text-text-muted",
                ].join(" ")
              }
            >
              <NavIcon name={icon} className="h-5 w-5" />
              <span>{t(label)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
