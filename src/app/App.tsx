import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { BottomNav } from "../components/BottomNav";
import { Sidebar } from "../components/Sidebar";
import { AppRoutes } from "./routes";
import { ActiveDeckSelector } from "../components/ActiveDeckSelector";

const SIDEBAR_KEY = "meoini.sidebarCollapsed";

function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === "true";
  } catch {
    return false;
  }
}

export default function App() {
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, String(collapsed));
    } catch {
      // 隐私模式下写入失败时忽略，仅影响状态持久化。
    }
  }, [collapsed]);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div
        className={[
          "min-h-full transition-[padding] duration-200",
          collapsed ? "lg:pl-16" : "lg:pl-60",
        ].join(" ")}
      >
        {/* 桌面端主内容居中并限制最大宽度，避免宽屏无限拉伸 */}
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8 2xl:max-w-7xl">
          <ActiveDeckSelector />
          <AppRoutes />
        </main>
      </div>
      <BottomNav />
    </BrowserRouter>
  );
}
