const STORAGE_KEY = "meoini.settings";

export type ThemeMode = "light" | "dark";

export interface AppSettings {
  learningLanguage: string;
  theme: ThemeMode;
}

const defaults: AppSettings = {
  learningLanguage: "en",
  theme: "light",
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(partial: Partial<AppSettings>) {
  const next = { ...loadSettings(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

// 主题通过 <html data-theme="..."> 切换，全部颜色由 src/styles/themes.css 提供。
export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}


const RECENT_KEY = "meoini.recentSearches";

export function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function pushRecentSearch(word: string, max = 8) {
  const trimmed = word.trim();
  if (!trimmed) return;
  const list = loadRecentSearches().filter(
    (w) => w.toLowerCase() !== trimmed.toLowerCase(),
  );
  list.unshift(trimmed);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, max)));
}
