import type {
  CreateWorkspaceRequest,
  GenerationResult,
  Language,
  Workspace,
  WorkspaceImportSummary
} from "@ask-database/shared";
import { calculateWorkspaceHealth, createUniversityDemoWorkspace } from "@ask-database/core";
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

interface AskApiResponse {
  conversation?: unknown;
  result?: GenerationResult;
  error?: string;
  code?: string;
  setup?: string;
}

interface WorkspacesApiResponse {
  workspaces?: Workspace[];
}

interface CreateWorkspaceApiResponse {
  workspace?: Workspace;
  importSummary?: WorkspaceImportSummary;
  error?: string;
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [language, setLanguage] = useState<Language>(() => readStoredLanguage());
  const [safeMode, setSafeMode] = useState(true);
  const [question, setQuestion] = useState(demoQuestion);
  const [workspace, setWorkspace] = useState<Workspace>(() => createUniversityDemoWorkspace());
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => [createUniversityDemoWorkspace()]);
  const [workspaceImportSummary, setWorkspaceImportSummary] = useState<WorkspaceImportSummary | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runtimeLabel, setRuntimeLabel] = useState<"api" | "static">("static");

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const health = useMemo(() => calculateWorkspaceHealth(workspace), [workspace]);
  const t = useMemo(() => createTranslator(language), [language]);

  useEffect(() => {
    localStorage.setItem("ask-database-language", language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!apiBaseUrl) {
      setRuntimeLabel("static");
      return;
    }

    let active = true;
    fetch(`${apiBaseUrl}/api/workspaces`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Demo API unavailable"))))
      .then((payload: WorkspacesApiResponse) => {
        if (active && payload.workspaces && payload.workspaces.length > 0) {
          setWorkspaces(payload.workspaces);
          setWorkspace(payload.workspaces.find((item) => item.id === "university-demo") ?? payload.workspaces[0]!);
          setRuntimeLabel("api");
        }
      })
      .catch(() => {
        if (active) {
          setRuntimeLabel("static");
        }
      });

    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  function selectWorkspace(workspaceId: string) {
    const selected = workspaces.find((item) => item.id === workspaceId);
    if (selected) {
      setWorkspace(selected);
      setResult(null);
      setQuestion(demoQuestion);
    }
  }

  async function createWorkspace(input: CreateWorkspaceRequest) {
    if (!apiBaseUrl || runtimeLabel === "static") {
      throw new Error(t("workspaces.staticCreateUnavailable"));
    }

    setIsCreatingWorkspace(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/workspaces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      });
      const payload = (await response.json()) as CreateWorkspaceApiResponse;
      if (!response.ok || !payload.workspace) {
        throw new Error(payload.error ?? t("workspaces.createFailed"));
      }

      setWorkspaces((current) => [payload.workspace!, ...current.filter((item) => item.id !== payload.workspace!.id)]);
      setWorkspace(payload.workspace);
      setWorkspaceImportSummary(payload.importSummary ?? null);
      setResult(null);
      setHistory([]);
    } finally {
      setIsCreatingWorkspace(false);
    }
  }

  async function generate(questionToUse = question) {
    const cleanQuestion = questionToUse.trim();
    setQuestion(cleanQuestion);
    setErrorMessage(null);
    setActivePage("ask");

    if (!cleanQuestion) {
      setErrorMessage(t("ask.emptyQuestion"));
      return;
    }

    if (!apiBaseUrl || runtimeLabel === "static") {
      if (isDemoQuestion(cleanQuestion)) {
        useSavedDemo(cleanQuestion);
      } else {
        setResult(null);
        setErrorMessage(t("ask.staticModeNotice"));
      }
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/workspaces/${workspace.id}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: cleanQuestion,
          dialect: workspace.dialect,
          safeMode
        })
      });
      const payload = (await response.json()) as AskApiResponse;

      if (!response.ok || !payload.result) {
        if (isDemoQuestion(cleanQuestion) && payload.code === "PROVIDER_NOT_CONFIGURED") {
          useSavedDemo(cleanQuestion);
        }
        setErrorMessage(payload.setup ?? payload.error ?? t("ask.generateFailed"));
        return;
      }

      setResult(payload.result);
      setHistory((current) => [payload.result!, ...current].slice(0, 12));
    } catch {
      if (isDemoQuestion(cleanQuestion)) {
        useSavedDemo(cleanQuestion);
      }
      setErrorMessage(t("ask.apiUnavailable"));
      setRuntimeLabel("static");
    } finally {
      setIsGenerating(false);
    }
  }

  function useSavedDemo(questionToUse = demoQuestion) {
    const saved = buildSavedDemoResult(workspace, questionToUse);
    setResult(saved);
    setHistory((current) => [saved, ...current].slice(0, 12));
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
    health,
    runtimeLabel,
    workspaces,
    workspaceImportSummary,
    isCreatingWorkspace,
    onCreateWorkspace: createWorkspace,
    onWorkspaceSelect: selectWorkspace
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
          errorMessage={errorMessage}
          history={history}
          isGenerating={isGenerating}
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

function buildSavedDemoResult(workspace: Workspace, question: string): GenerationResult {
  const relationshipPath = workspace.schema.relationships.filter(
    (relationship) => relationship.fromTable === "students" && relationship.toTable === "departments"
  );

  return {
    question,
    interpretation:
      "Zapisany przykład demo: aktywni studenci połączeni z wydziałami przez students.department_id.",
    sql: `SELECT
  s.id,
  s.full_name,
  s.email,
  d.name AS department_name
FROM students s
JOIN departments d ON s.department_id = d.id
WHERE s.status = 'active'
ORDER BY s.created_at DESC
LIMIT 50;`,
    dialect: workspace.dialect,
    relationshipPath,
    evidence: [
      {
        label: "Zapisany przykład demo",
        description:
          "GitHub Pages jest statyczne, dlatego pokazuje jawnie oznaczony przykład zamiast udawać live generowanie.",
        confidence: 1,
        source: "history"
      },
      {
        label: "Relacja DDL",
        description: "students.department_id -> departments.id została wykryta ze schematu demo.",
        confidence: 1,
        source: "relationship"
      },
      {
        label: "Safe Mode",
        description: "Zapytanie jest pojedynczym SELECT-em z limitem wyników.",
        confidence: 1,
        source: "validation"
      }
    ],
    confidence: 0.92,
    validation: {
      valid: true,
      readOnly: true,
      issues: []
    },
    assumptions: ["To jest zapisany przykład statyczny, nie odpowiedź live providera."],
    generatedAt: new Date().toISOString(),
    engine: "saved-example"
  };
}

function getApiBaseUrl(): string | null {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
    return "http://127.0.0.1:4310";
  }

  return null;
}

function isDemoQuestion(value: string): boolean {
  return normalizeText(value) === normalizeText(demoQuestion);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function readStoredLanguage(): Language {
  const stored = localStorage.getItem("ask-database-language");
  if (stored === "pl" || stored === "en") {
    return stored;
  }

  return navigator.language.toLowerCase().startsWith("pl") ? "pl" : "en";
}
