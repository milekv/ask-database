import Editor from "@monaco-editor/react";
import type {
  CreateWorkspaceRequest,
  GenerationResult,
  SqlDialect,
  TableDefinition,
  Workspace,
  WorkspaceHealth,
  WorkspaceImportSummary
} from "@ask-database/shared";
import { Badge, Button, Card, Metric, cn } from "@ask-database/ui";
import { motion } from "framer-motion";
import { CheckCircle2, Copy, Database, FileSearch, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { SchemaGraph } from "../components/SchemaGraph.js";
import type { TranslationKey } from "../i18n/translations.js";

type Translator = (key: TranslationKey) => string;

interface CommonPageProps {
  t: Translator;
  workspace: Workspace;
  health: WorkspaceHealth;
  runtimeLabel: "api" | "static";
  workspaces: Workspace[];
  workspaceImportSummary: WorkspaceImportSummary | null;
  isCreatingWorkspace: boolean;
  onCreateWorkspace: (input: CreateWorkspaceRequest) => Promise<void>;
  onWorkspaceSelect: (workspaceId: string) => void;
}

interface DashboardPageProps extends CommonPageProps {
  onTryDemo: () => void;
  onAskNow: () => void;
}

export function DashboardPage({ t, workspace, health, runtimeLabel, onTryDemo, onAskNow }: DashboardPageProps) {
  const pipeline = [
    "dashboard.pipeline1",
    "dashboard.pipeline2",
    "dashboard.pipeline3",
    "dashboard.pipeline4",
    "dashboard.pipeline5",
    "dashboard.pipeline6"
  ] as const;

  return (
    <div className="space-y-8">
      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-soft"
        initial={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.45 }}
      >
        <div className="grid gap-8 p-8 lg:grid-cols-[1.25fr_0.75fr] lg:p-12">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-sky-400/15 text-sky-100" tone="info">
                {t("dashboard.badge")}
              </Badge>
              <Badge className="bg-emerald-400/15 text-emerald-100" tone="good">
                {t("common.runtime")}: {t(runtimeLabel === "api" ? "runtime.api" : "runtime.static")}
              </Badge>
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
              {t("dashboard.title")}
            </h1>
            <p className="mt-5 max-w-3xl text-xl font-semibold text-sky-100">{t("app.promise")}</p>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{t("app.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={onTryDemo}>{t("app.tryDemo")}</Button>
              <Button className="border-white/20 bg-white/10 text-white hover:bg-white/15" onClick={onAskNow}>
                {t("app.askNow")}
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">{t("dashboard.health")}</span>
              <span className="text-5xl font-black text-emerald-300">{health.score}</span>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ["Schema", health.schemaCoverage],
                ["Relacje", health.relationshipCoverage],
                ["Pamięć", health.memoryCoverage],
                ["Glossary", health.glossaryCoverage]
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="flex justify-between text-xs font-semibold text-slate-300">
                    <span>{label}</span>
                    <span>{value}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-emerald-300" style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label={t("dashboard.tables")} value={workspace.schema.tables.length} />
        <Metric label={t("dashboard.relationships")} value={workspace.schema.relationships.length} />
        <Metric label={t("dashboard.history")} value={workspace.historicalQueries.length} />
        <Metric label={t("dashboard.terms")} value={workspace.glossary.length} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="text-xl font-bold text-slate-950">{t("dashboard.why")}</h2>
          <p className="mt-3 leading-7 text-slate-600">{t("dashboard.whyText")}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {["Schema Memory", "Query Memory", "Correction Memory"].map((item) => (
              <div key={item} className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-bold text-slate-950">{t("dashboard.pipeline")}</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {pipeline.map((key, index) => (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                initial={{ opacity: 0, y: 10 }}
                key={key}
                transition={{ delay: index * 0.04 }}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-600 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="text-sm font-semibold text-slate-700">{t(key)}</span>
              </motion.div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

export function WorkspacesPage({
  t,
  workspace,
  workspaces,
  health,
  runtimeLabel,
  workspaceImportSummary,
  isCreatingWorkspace,
  onCreateWorkspace,
  onWorkspaceSelect
}: CommonPageProps) {
  const [name, setName] = useState("Test Commerce");
  const [description, setDescription] = useState("");
  const [dialect, setDialect] = useState<SqlDialect>("postgresql");
  const [ddl, setDdl] = useState("");
  const [historicalSql, setHistoricalSql] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const steps = [
    ["workspaces.importDdl", workspace.schema.tables.length],
    ["workspaces.reviewSchema", workspace.schema.relationships.length],
    ["workspaces.teachSql", workspace.historicalQueries.length],
    ["workspaces.ready", health.score]
  ] as const;

  return (
    <PageFrame description={t("workspaces.description")} title={t("workspaces.title")}>
      <Card>
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h3 className="text-lg font-bold text-slate-950">{t("workspaces.active")}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t("workspaces.activeDescription")}</p>
            <div className="mt-4 space-y-2">
              {workspaces.map((item) => (
                <button
                  className={cn(
                    "w-full rounded-lg border p-3 text-left text-sm transition",
                    item.id === workspace.id
                      ? "border-sky-300 bg-sky-50 text-sky-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                  key={item.id}
                  onClick={() => onWorkspaceSelect(item.id)}
                  type="button"
                >
                  <span className="block font-bold">{item.name}</span>
                  <span className="mt-1 block text-xs">{item.schema.tables.length} tabel · {item.dialect}</span>
                </button>
              ))}
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setCreateError(null);
              onCreateWorkspace({
                name,
                description,
                dialect,
                ddl,
                historicalSql
              }).catch((error: unknown) => {
                setCreateError(error instanceof Error ? error.message : t("workspaces.createFailed"));
              });
            }}
          >
            <div>
              <h3 className="text-lg font-bold text-slate-950">{t("workspaces.new")}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{t("workspaces.newDescription")}</p>
            </div>
            {runtimeLabel === "static" ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                {t("workspaces.staticCreateUnavailable")}
              </p>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                {t("workspaces.name")}
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                {t("workspaces.dialect")}
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  onChange={(event) => setDialect(event.target.value as SqlDialect)}
                  value={dialect}
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="sqlite">SQLite</option>
                  <option value="sqlserver">SQL Server</option>
                  <option value="oracle">Oracle</option>
                </select>
              </label>
            </div>
            <label className="space-y-1 text-sm font-semibold text-slate-700">
              {t("workspaces.optionalDescription")}
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                onChange={(event) => setDescription(event.target.value)}
                value={description}
              />
            </label>
            <SqlInput
              label={t("workspaces.ddl")}
              onChange={setDdl}
              placeholder="CREATE TABLE customers (...);"
              value={ddl}
            />
            <SqlInput
              label={t("workspaces.historicalSql")}
              onChange={setHistoricalSql}
              placeholder="SELECT ..."
              value={historicalSql}
            />
            {createError ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{createError}</p> : null}
            <Button disabled={runtimeLabel === "static" || isCreatingWorkspace || ddl.trim().length < 10 || name.trim().length < 2}>
              {isCreatingWorkspace ? t("workspaces.creating") : t("workspaces.create")}
            </Button>
          </form>
        </div>
      </Card>

      {workspaceImportSummary ? (
        <Card>
          <h3 className="text-lg font-bold text-slate-950">{t("workspaces.importSummary")}</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Metric label={t("dashboard.tables")} value={workspaceImportSummary.tables} />
            <Metric label={t("schema.columns")} value={workspaceImportSummary.columns} />
            <Metric label={t("dashboard.relationships")} value={workspaceImportSummary.relationships} />
            <Metric label={t("dashboard.history")} value={workspaceImportSummary.historicalQueries} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Metric label={t("workspaces.joinPatterns")} value={workspaceImportSummary.joinPatterns} />
            <Metric label={t("workspaces.filterPatterns")} value={workspaceImportSummary.filterPatterns} />
            <Metric label={t("workspaces.aggregationPatterns")} value={workspaceImportSummary.aggregationPatterns} />
          </div>
          {workspaceImportSummary.warnings.length > 0 ? (
            <div className="mt-4 space-y-2">
              {workspaceImportSummary.warnings.map((warning) => (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900" key={warning}>
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        {steps.map(([key, value], index) => (
          <Card key={key}>
            <div className="flex items-center justify-between">
              <Badge tone="info">{index + 1}</Badge>
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-950">{t(key)}</h3>
            <p className="mt-2 text-3xl font-black text-sky-700">{value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <h3 className="text-lg font-bold text-slate-950">{workspace.name}</h3>
        <p className="mt-2 leading-7 text-slate-600">{workspace.description}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge tone="good">{workspace.dialect}</Badge>
          <Badge tone="info">{workspace.schema.version}</Badge>
          <Badge tone="neutral">
            {t("common.score")}: {health.score}
          </Badge>
          <Badge tone={runtimeLabel === "api" ? "good" : "warning"}>
            {t("common.runtime")}: {t(runtimeLabel === "api" ? "runtime.api" : "runtime.static")}
          </Badge>
        </div>
      </Card>
    </PageFrame>
  );
}

interface AskPageProps extends CommonPageProps {
  copied: boolean;
  errorMessage: string | null;
  history: GenerationResult[];
  isGenerating: boolean;
  question: string;
  result: GenerationResult | null;
  onCopy: () => void;
  onGenerate: () => void;
  onQuestionChange: (value: string) => void;
  onUseSample: (value: string) => void;
}

export function AskPage({
  t,
  copied,
  errorMessage,
  history,
  isGenerating,
  question,
  result,
  onCopy,
  onGenerate,
  onQuestionChange,
  onUseSample
}: AskPageProps) {
  const samples = [
    ["ask.sampleActive", "Pokaż aktywnych studentów z nazwą wydziału"],
    ["ask.sampleCourses", "Pokaż najpopularniejsze kursy według liczby zapisów"],
    ["ask.sampleGrades", "Pokaż najlepsze oceny studentów i nazwy kursów"]
  ] as const;

  return (
    <PageFrame description={t("ask.description")} title={t("ask.title")}>
      <Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <textarea
            className="min-h-28 rounded-lg border border-slate-300 bg-white p-4 text-base leading-7 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder={t("ask.placeholder")}
            value={question}
          />
          <div className="flex flex-col gap-2">
            <Button disabled={isGenerating} onClick={onGenerate}>
              {isGenerating ? t("ask.generating") : t("ask.generate")}
            </Button>
            {samples.map(([label, value]) => (
              <Button disabled={isGenerating} key={label} onClick={() => onUseSample(value)} variant="secondary">
                {t(label)}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {errorMessage ? (
        <Card className="border-amber-200 bg-amber-50">
          <Badge tone="warning">{t("common.warning")}</Badge>
          <p className="mt-3 leading-7 text-amber-900">{errorMessage}</p>
        </Card>
      ) : null}

      {result ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-950">{t("ask.generatedSql")}</h3>
                <p className="text-sm text-slate-500">
                  {t("ask.engine")}: {result.engine}
                  {result.confidence !== undefined
                    ? ` · ${t("common.confidence")}: ${Math.round(result.confidence * 100)}%`
                    : ""}
                </p>
              </div>
              <Button onClick={onCopy} variant="secondary">
                <Copy className="mr-2 h-4 w-4" />
                {copied ? t("ask.copied") : t("ask.copy")}
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <Editor
                height="320px"
                language="sql"
                options={{
                  minimap: { enabled: false },
                  readOnly: true,
                  wordWrap: "on",
                  fontSize: 14,
                  scrollBeyondLastLine: false
                }}
                theme="vs"
                value={result.sql}
              />
            </div>
          </Card>

          <div className="space-y-6">
            <Card>
              <h3 className="text-lg font-bold text-slate-950">{t("ask.interpretation")}</h3>
              <p className="mt-2 leading-7 text-slate-600">{result.interpretation}</p>
              {result.engine === "saved-example" ? (
                <p className="mt-3 rounded-lg bg-sky-50 p-3 text-sm font-semibold text-sky-800">
                  {t("ask.savedExampleNotice")}
                </p>
              ) : null}
              {result.assumptions && result.assumptions.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-bold uppercase text-slate-500">{t("ask.assumptions")}</h4>
                  {result.assumptions.map((assumption) => (
                    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700" key={assumption}>
                      {assumption}
                    </p>
                  ))}
                </div>
              ) : null}
            </Card>
            <Card>
              <h3 className="text-lg font-bold text-slate-950">{t("ask.validation")}</h3>
              <div className="mt-3 space-y-2">
                {result.validation.issues.length === 0 ? (
                  <Badge tone="good">{t("common.noIssues")}</Badge>
                ) : (
                  result.validation.issues.map((issue) => (
                    <div
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                      key={`${issue.code}_${issue.fragment ?? "issue"}`}
                    >
                      <Badge tone={issue.severity === "error" ? "danger" : issue.severity === "warning" ? "warning" : "info"}>
                        {issue.severity}
                      </Badge>
                      <p className="mt-2 font-semibold text-slate-700">{issue.message}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <Card>
            <h3 className="text-lg font-bold text-slate-950">{t("ask.evidence")}</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {result.evidence.map((item) => (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={`${item.source}_${item.label}`}>
                  <div className="flex items-center justify-between">
                    <Badge tone="info">{item.source}</Badge>
                    <span className="text-sm font-bold text-slate-700">{Math.round(item.confidence * 100)}%</span>
                  </div>
                  <h4 className="mt-3 font-bold text-slate-950">{item.label}</h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-bold text-slate-950">{t("ask.path")}</h3>
            <div className="mt-4 space-y-2">
              {result.relationshipPath.length === 0 ? (
                <p className="text-sm text-slate-500">{t("common.noIssues")}</p>
              ) : (
                result.relationshipPath.map((relationship) => (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700" key={relationship.id}>
                    {relationship.fromTable}.{relationship.fromColumn}
                    {" -> "}
                    {relationship.toTable}.{relationship.toColumn}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      ) : (
        <Card className="flex flex-col items-start gap-4 bg-sky-50">
          <Sparkles className="h-8 w-8 text-sky-700" />
          <p className="max-w-2xl leading-7 text-slate-700">{t("ask.emptyState")}</p>
          <Button onClick={() => onUseSample("Pokaż aktywnych studentów z nazwą wydziału")}>
            {t("app.tryDemo")}
          </Button>
        </Card>
      )}

      <Card>
        <h3 className="text-lg font-bold text-slate-950">{t("ask.history")}</h3>
        <div className="mt-4 space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">{t("history.empty")}</p>
          ) : (
            history.map((entry) => (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={`${entry.generatedAt}_${entry.question}`}>
                <div className="text-sm font-bold text-slate-950">{entry.question}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {entry.generatedAt} · {entry.engine}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </PageFrame>
  );
}

export function SchemaPage({ t, workspace }: CommonPageProps) {
  const [search, setSearch] = useState("");
  const tables = useMemo(
    () =>
      workspace.schema.tables.filter((table) => {
        const haystack = `${table.name} ${table.columns.map((column) => column.name).join(" ")}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      }),
    [workspace, search]
  );

  return (
    <PageFrame description={t("schema.description")} title={t("schema.title")}>
      <Card>
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <FileSearch className="h-5 w-5 text-slate-500" />
          <input
            className="w-full bg-transparent outline-none"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("schema.search")}
            value={search}
          />
        </label>
      </Card>
      <div>
        <h3 className="mb-3 text-lg font-bold text-slate-950">{t("schema.graph")}</h3>
        <SchemaGraph workspace={workspace} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {tables.map((table) => (
          <TableCard key={table.name} table={table} t={t} />
        ))}
      </div>
    </PageFrame>
  );
}

export function QueryMemoryPage({ t, workspace }: CommonPageProps) {
  return (
    <PageFrame description={t("memory.description")} title={t("memory.title")}>
      <div className="grid gap-4 lg:grid-cols-3">
        {workspace.historicalQueries.map((query) => (
          <Card key={query.id}>
            <Badge tone="info">{query.statementType.toUpperCase()}</Badge>
            <h3 className="mt-4 text-lg font-bold text-slate-950">{query.tables.join(" + ")}</h3>
            <p className="mt-3 text-xs font-semibold uppercase text-slate-500">{t("memory.redacted")}</p>
            <pre className="mt-2 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              {query.redactedSql}
            </pre>
          </Card>
        ))}
      </div>
      <Card>
        <h3 className="text-lg font-bold text-slate-950">{t("memory.patterns")}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {workspace.queryPatterns.map((pattern) => (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={pattern.id}>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-950">{pattern.title}</h4>
                <Badge tone="good">{Math.round(pattern.confidence * 100)}%</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{pattern.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </PageFrame>
  );
}

export function GlossaryPage({ t, workspace }: CommonPageProps) {
  return (
    <PageFrame description={t("glossary.description")} title={t("glossary.title")}>
      <div className="grid gap-4 md:grid-cols-2">
        {workspace.glossary.map((term) => (
          <Card key={term.id}>
            <h3 className="text-lg font-bold text-slate-950">{term.name}</h3>
            <p className="mt-2 leading-7 text-slate-600">{term.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {term.aliases.map((alias) => (
                <Badge key={alias}>{alias}</Badge>
              ))}
            </div>
            {term.sqlExpression ? (
              <code className="mt-4 block rounded-lg bg-slate-950 p-3 text-sm text-slate-100">
                {term.sqlExpression}
              </code>
            ) : null}
          </Card>
        ))}
      </div>
    </PageFrame>
  );
}

export function RelationshipsPage({ t, workspace }: CommonPageProps) {
  return (
    <PageFrame description={t("relationships.description")} title={t("relationships.title")}>
      <div className="grid gap-4 md:grid-cols-2">
        {workspace.schema.relationships.map((relationship) => (
          <Card key={relationship.id}>
            <div className="flex items-center justify-between">
              <Badge tone="good">{Math.round(relationship.confidence * 100)}%</Badge>
              <Badge>{relationship.source}</Badge>
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-950">
              {relationship.fromTable}
              {" -> "}
              {relationship.toTable}
            </h3>
            <p className="mt-2 font-mono text-sm text-slate-700">
              {relationship.fromColumn} = {relationship.toColumn}
            </p>
          </Card>
        ))}
      </div>
    </PageFrame>
  );
}

export function WorkspaceMemoryPage({ t, workspace }: CommonPageProps) {
  return (
    <PageFrame description={t("workspaceMemory.description")} title={t("workspaceMemory.title")}>
      <div className="grid gap-4 md:grid-cols-2">
        {workspace.memoryRules.map((rule) => (
          <Card key={rule.id}>
            <div className="flex items-center justify-between">
              <Badge tone="info">{rule.appliesTo}</Badge>
              <Badge tone="good">{Math.round(rule.confidence * 100)}%</Badge>
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-950">{rule.title}</h3>
            <p className="mt-2 leading-7 text-slate-600">{rule.description}</p>
          </Card>
        ))}
      </div>
      <Card>
        <h3 className="text-lg font-bold text-slate-950">{t("workspaceMemory.corrections")}</h3>
        <div className="mt-4 space-y-3">
          {workspace.corrections.map((correction) => (
            <div className="rounded-lg bg-slate-50 p-4" key={correction.id}>
              <p className="font-semibold text-slate-950">{correction.originalQuestion}</p>
              <p className="mt-2 text-sm text-slate-600">{correction.reason}</p>
            </div>
          ))}
        </div>
      </Card>
    </PageFrame>
  );
}

export function HistoryPage({ t, history }: { t: Translator; history: GenerationResult[] }) {
  return (
    <PageFrame description={t("history.description")} title={t("history.title")}>
      {history.length === 0 ? (
        <Card>
          <p className="text-slate-600">{t("history.empty")}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <Card key={`${entry.generatedAt}_${entry.question}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-950">{entry.question}</h3>
                <Badge tone={entry.validation.valid ? "good" : "danger"}>
                  {entry.validation.valid ? t("common.noIssues") : t("common.error")}
                </Badge>
              </div>
              <pre className="mt-4 overflow-auto rounded-lg bg-slate-950 p-4 text-sm leading-6 text-slate-100">
                {entry.sql}
              </pre>
            </Card>
          ))}
        </div>
      )}
    </PageFrame>
  );
}

export function SettingsPage({ t, workspace, runtimeLabel }: CommonPageProps) {
  return (
    <PageFrame description={t("settings.description")} title={t("settings.title")}>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <ShieldCheck className="h-8 w-8 text-emerald-600" />
          <h3 className="mt-4 text-lg font-bold text-slate-950">{t("settings.provider")}</h3>
          <p className="mt-2 leading-7 text-slate-600">{t("settings.providerText")}</p>
          <Badge className="mt-4" tone={runtimeLabel === "api" ? "info" : "warning"}>
            {t(runtimeLabel === "api" ? "runtime.api" : "runtime.static")}
          </Badge>
        </Card>
        <Card>
          <Database className="h-8 w-8 text-sky-700" />
          <h3 className="mt-4 text-lg font-bold text-slate-950">{t("settings.persistence")}</h3>
          <p className="mt-2 leading-7 text-slate-600">{t("settings.persistenceText")}</p>
          <Badge className="mt-4" tone="info">{workspace.dialect}</Badge>
        </Card>
      </div>
    </PageFrame>
  );
}

function TableCard({ table, t }: { table: TableDefinition; t: Translator }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-950">{table.name}</h3>
        <Badge tone="info">
          {table.columns.length} {t("schema.columns")}
        </Badge>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        {table.columns.map((column) => (
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-100 p-3 last:border-b-0" key={column.name}>
            <div>
              <div className="font-semibold text-slate-950">{column.name}</div>
              <div className="text-sm text-slate-500">{column.dataType}</div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {column.primaryKey ? <Badge tone="good">{t("schema.primaryKey")}</Badge> : null}
              {column.references ? <Badge tone="info">{t("schema.foreignKey")}</Badge> : null}
              {!column.nullable ? <Badge>NOT NULL</Badge> : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SqlInput({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="space-y-2 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <textarea
        className="min-h-36 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs leading-5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      <input
        accept=".sql,.txt"
        className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }
          file.text().then(onChange).catch(() => undefined);
        }}
        type="file"
      />
    </label>
  );
}

function PageFrame({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 max-w-3xl leading-7 text-slate-600">{description}</p>
      </div>
      {children}
    </div>
  );
}
