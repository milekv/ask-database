import type { GenerationResult, Language } from "@ask-database/shared";
import {
  calculateWorkspaceHealth,
  createUniversityDemoWorkspace,
  generateReadOnlySql
} from "@ask-database/core";
import { useEffect, useMemo, useState } from "react";
import { AppShell, type NavigationItem, type PageKey } from "./components/AppShell.js";
import { createTranslator } from "./i18n/translations.js";
import {
  AskPage,
  DashboardPage,
  GlossaryPage,
  HistoryPage,
  QueryMemoryPage,
  RelationshipsPage,
  SchemaPage,
  SettingsPage,
  WorkspaceMemoryPage,
  WorkspacesPage
} from "./pages/ProductPages.js";

const navItems: NavigationItem[] = [
  { page: "dashboard", labelKey: "nav.dashboard" },
  { page: "workspaces", labelKey: "nav.workspaces" },
  { page: "ask", labelKey: "nav.ask" },
  { page: "schema", labelKey: "nav.schema" },
  { page: "queryMemory", labelKey: "nav.queryMemory" },
  { page: "glossary", labelKey: "nav.glossary" },
  { page: "relationships", labelKey: "nav.relationships" },
  { page: "workspaceMemory", labelKey: "nav.workspaceMemory" },
  { page: "history", labelKey: "nav.history" },
  { page: "settings", labelKey: "nav.settings" }
];

const demoQuestion = "Pokaż aktywnych studentów z nazwą wydziału";

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [language, setLanguage] = useState<Language>(() => readStoredLanguage());
  const [safeMode, setSafeMode] = useState(true);
  const [question, setQuestion] = useState(demoQuestion);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [copied, setCopied] = useState(false);

  const workspace = useMemo(() => createUniversityDemoWorkspace(), []);
  const health = useMemo(() => calculateWorkspaceHealth(workspace), [workspace]);
  const t = useMemo(() => createTranslator(language), [language]);

  useEffect(() => {
    localStorage.setItem("ask-database-language", language);
    document.documentElement.lang = language;
  }, [language]);

  function generate(questionToUse = question) {
    const nextResult = generateReadOnlySql({
      workspace,
      question: questionToUse,
      safeMode
    });
    setQuestion(questionToUse);
    setResult(nextResult);
    setHistory((current) => [nextResult, ...current].slice(0, 12));
    setActivePage("ask");
  }

  function handleTryDemo() {
    generate(demoQuestion);
  }

  async function handleCopySql() {
    if (!result) {
      return;
    }

    await navigator.clipboard.writeText(result.sql);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const commonProps = {
    t,
    workspace,
    health
  };

  return (
    <AppShell
      activePage={activePage}
      language={language}
      navItems={navItems}
      onLanguageChange={setLanguage}
      onNavigate={setActivePage}
      onSafeModeChange={setSafeMode}
      safeMode={safeMode}
      t={t}
      title={t("app.promise")}
    >
      {activePage === "dashboard" ? (
        <DashboardPage {...commonProps} onAskNow={() => setActivePage("ask")} onTryDemo={handleTryDemo} />
      ) : null}
      {activePage === "workspaces" ? <WorkspacesPage {...commonProps} /> : null}
      {activePage === "ask" ? (
        <AskPage
          {...commonProps}
          copied={copied}
          history={history}
          onCopy={handleCopySql}
          onGenerate={() => generate()}
          onQuestionChange={setQuestion}
          onUseSample={generate}
          question={question}
          result={result}
        />
      ) : null}
      {activePage === "schema" ? <SchemaPage {...commonProps} /> : null}
      {activePage === "queryMemory" ? <QueryMemoryPage {...commonProps} /> : null}
      {activePage === "glossary" ? <GlossaryPage {...commonProps} /> : null}
      {activePage === "relationships" ? <RelationshipsPage {...commonProps} /> : null}
      {activePage === "workspaceMemory" ? <WorkspaceMemoryPage {...commonProps} /> : null}
      {activePage === "history" ? <HistoryPage history={history} t={t} /> : null}
      {activePage === "settings" ? <SettingsPage {...commonProps} /> : null}
    </AppShell>
  );
}

function readStoredLanguage(): Language {
  const stored = localStorage.getItem("ask-database-language");
  if (stored === "pl" || stored === "en") {
    return stored;
  }

  return "pl";
}
