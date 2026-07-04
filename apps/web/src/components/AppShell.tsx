import type { Language } from "@ask-database/shared";
import { Button, cn } from "@ask-database/ui";
import {
  BookOpen,
  Braces,
  Database,
  GitBranch,
  History,
  Home,
  Languages,
  Network,
  Search,
  Settings,
  ShieldCheck
} from "lucide-react";
import type { ReactNode } from "react";
import type { TranslationKey } from "../i18n/translations.js";

export type PageKey =
  | "dashboard"
  | "workspaces"
  | "ask"
  | "schema"
  | "queryMemory"
  | "glossary"
  | "relationships"
  | "workspaceMemory"
  | "history"
  | "settings";

export interface NavigationItem {
  page: PageKey;
  labelKey: TranslationKey;
}

const iconMap = {
  dashboard: Home,
  workspaces: Database,
  ask: Search,
  schema: Network,
  queryMemory: Braces,
  glossary: BookOpen,
  relationships: GitBranch,
  workspaceMemory: ShieldCheck,
  history: History,
  settings: Settings
} satisfies Record<PageKey, typeof Home>;

interface AppShellProps {
  activePage: PageKey;
  language: Language;
  navItems: NavigationItem[];
  safeMode: boolean;
  title: string;
  t: (key: TranslationKey) => string;
  onNavigate: (page: PageKey) => void;
  onLanguageChange: (language: Language) => void;
  onSafeModeChange: (value: boolean) => void;
  children: ReactNode;
}

export function AppShell({
  activePage,
  language,
  navItems,
  safeMode,
  title,
  t,
  onNavigate,
  onLanguageChange,
  onSafeModeChange,
  children
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-slate-200 bg-white xl:block">
        <div className="flex h-20 items-center border-b border-slate-200 px-6">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-sky-700">ASK DATABASE</div>
            <div className="text-xs text-slate-500">{title}</div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = iconMap[item.page];
            return (
              <button
                key={item.page}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition",
                  activePage === item.page
                    ? "bg-sky-50 text-sky-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                )}
                onClick={() => onNavigate(item.page)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="xl:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 xl:hidden">
              <Database className="h-5 w-5 text-sky-700" />
              <span className="font-bold text-slate-950">ASK DATABASE</span>
            </div>
            <div className="flex flex-wrap gap-2 xl:hidden">
              {navItems.slice(0, 5).map((item) => (
                <Button
                  key={item.page}
                  className="h-9 px-3"
                  onClick={() => onNavigate(item.page)}
                  variant={activePage === item.page ? "primary" : "secondary"}
                >
                  {t(item.labelKey)}
                </Button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                {t("app.safeMode")}
                <input
                  checked={safeMode}
                  className="h-4 w-4 accent-sky-600"
                  onChange={(event) => onSafeModeChange(event.target.checked)}
                  type="checkbox"
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                <Languages className="h-4 w-4 text-sky-700" />
                {t("app.language")}
                <select
                  className="bg-transparent text-sm font-semibold outline-none"
                  onChange={(event) => onLanguageChange(event.target.value as Language)}
                  value={language}
                >
                  <option value="pl">PL</option>
                  <option value="en">EN</option>
                </select>
              </label>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
