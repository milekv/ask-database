import type {
  BusinessTerm,
  RetrievalEvidence,
  SchemaAlias,
  SchemaCandidateColumn,
  SchemaCandidateTable,
  SchemaRetrievalResult,
  Workspace
} from "@ask-database/shared";
import { containsNormalized, normalizeForRetrieval, tokenOverlap, tokenize } from "./normalize.js";

const MAX_CANDIDATE_TABLES = 8;
const MAX_CANDIDATE_COLUMNS = 32;
const EXACT_TABLE_MATCH_SCORE = 50;
const EXACT_COLUMN_MATCH_SCORE = 35;
const ALIAS_MATCH_SCORE = 40;
const GLOSSARY_MATCH_SCORE = 45;
const HISTORY_TABLE_SCORE = 8;
const MEMORY_SCORE = 10;

export function retrieveWorkspaceContext(workspace: Workspace, question: string): SchemaRetrievalResult {
  const questionTokens = tokenize(question);
  const evidence: RetrievalEvidence[] = [];
  const matchedAliases = matchAliases(workspace.aliases ?? [], question);
  const matchedBusinessTerms = matchBusinessTerms(workspace.glossary, question);
  const tableScores = new Map<string, RetrievalEvidence[]>();
  const columnScores = new Map<string, RetrievalEvidence[]>();

  for (const table of workspace.schema.tables) {
    const tableId = table.name;
    if (containsNormalized(question, table.name)) {
      addEvidence(tableScores, tableId, {
        source: "table-name",
        targetId: tableId,
        label: table.name,
        score: EXACT_TABLE_MATCH_SCORE,
        reason: "Question contains normalized table name."
      });
    }

    const tableTokenScore = tokenOverlap(questionTokens, tokenize(table.name));
    if (tableTokenScore > 0) {
      addEvidence(tableScores, tableId, {
        source: "table-name",
        targetId: tableId,
        label: table.name,
        score: tableTokenScore * 12,
        reason: "Question token overlap with table name."
      });
    }

    for (const column of table.columns) {
      const columnId = `${table.name}.${column.name}`;
      if (containsNormalized(question, column.name)) {
        addEvidence(columnScores, columnId, {
          source: "column-name",
          targetId: columnId,
          label: column.name,
          score: EXACT_COLUMN_MATCH_SCORE,
          reason: "Question contains normalized column name."
        });
        addEvidence(tableScores, tableId, {
          source: "column-name",
          targetId: tableId,
          label: table.name,
          score: 12,
          reason: `Column ${column.name} matched the question.`
        });
      }
    }
  }

  for (const alias of matchedAliases) {
    if (alias.targetType === "table") {
      addEvidence(tableScores, alias.targetId, {
        source: "alias",
        targetId: alias.targetId,
        label: alias.alias,
        score: ALIAS_MATCH_SCORE,
        reason: "Manual schema alias matched the question."
      });
    }
    if (alias.targetType === "column") {
      addEvidence(columnScores, alias.targetId, {
        source: "alias",
        targetId: alias.targetId,
        label: alias.alias,
        score: ALIAS_MATCH_SCORE,
        reason: "Manual column alias matched the question."
      });
      const tableName = alias.targetId.split(".")[0];
      if (tableName) {
        addEvidence(tableScores, tableName, {
          source: "alias",
          targetId: tableName,
          label: alias.alias,
          score: 10,
          reason: "Column alias implies its parent table."
        });
      }
    }
    if (alias.targetType === "relationship") {
      for (const table of workspace.schema.tables) {
        if (containsNormalized(alias.targetId, table.name)) {
          addEvidence(tableScores, table.name, {
            source: "alias",
            targetId: table.name,
            label: alias.alias,
            score: Math.round(ALIAS_MATCH_SCORE * 0.8),
            reason: "Manual relationship alias references this table."
          });
        }
      }
    }
  }

  for (const term of matchedBusinessTerms) {
    for (const table of term.relatedTables) {
      addEvidence(tableScores, table, {
        source: "glossary",
        targetId: table,
        label: term.name,
        score: GLOSSARY_MATCH_SCORE,
        reason: "Enabled business glossary term matched the question."
      });
    }
    for (const columnId of term.relatedColumns) {
      addEvidence(columnScores, columnId, {
        source: "glossary",
        targetId: columnId,
        label: term.name,
        score: Math.round(GLOSSARY_MATCH_SCORE * 0.75),
        reason: "Glossary term references this column."
      });
    }
  }

  for (const query of workspace.historicalQueries) {
    const queryTokens = tokenize(
      `${query.tables.join(" ")} ${(query.columns ?? []).join(" ")} ${query.semanticSummary ?? ""}`
    );
    const overlap = tokenOverlap(questionTokens, queryTokens);
    if (overlap === 0) {
      continue;
    }
    for (const table of query.tables) {
      addEvidence(tableScores, table, {
        source: "history",
        targetId: table,
        label: query.id,
        score: overlap * HISTORY_TABLE_SCORE,
        reason: "Historical query overlaps with the question."
      });
    }
  }

  for (const memory of workspace.memoryRules.filter((rule) => rule.enabled !== false)) {
    const memoryTokens = tokenize(`${memory.title} ${memory.description}`);
    const overlap = tokenOverlap(questionTokens, memoryTokens);
    for (const table of workspace.schema.tables) {
      const payloadScore = memoryPayloadMentions(memory.payload, table.name) ? 2 : 0;
      if (overlap > 0 && containsNormalized(memory.description, table.name)) {
        addEvidence(tableScores, table.name, {
          source: "memory",
          targetId: table.name,
          label: memory.title,
          score: overlap * MEMORY_SCORE,
          reason: "Confirmed workspace memory references this table."
        });
      }
      if (payloadScore > 0) {
        addEvidence(tableScores, table.name, {
          source: "memory",
          targetId: table.name,
          label: memory.title,
          score: payloadScore * MEMORY_SCORE,
          reason: "Confirmed workspace memory payload references this table."
        });
      }
    }
  }

  const candidateTables: SchemaCandidateTable[] = workspace.schema.tables
    .map((table) => ({
      table,
      evidence: tableScores.get(table.name) ?? [],
      score: totalScore(tableScores.get(table.name) ?? [])
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_CANDIDATE_TABLES);

  const candidateColumns: SchemaCandidateColumn[] = workspace.schema.tables
    .flatMap((table) =>
      table.columns.map((column) => {
        const columnId = `${table.name}.${column.name}`;
        const columnEvidence = columnScores.get(columnId) ?? [];
        const parentTableEvidence = tableScores.get(table.name) ?? [];
        return {
          tableName: table.name,
          column,
          evidence: columnEvidence,
          score: totalScore(columnEvidence) + Math.min(12, totalScore(parentTableEvidence) * 0.2)
        };
      })
    )
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_CANDIDATE_COLUMNS);

  const retrievalEvidence = [
    ...candidateTables.flatMap((candidate) => candidate.evidence),
    ...candidateColumns.flatMap((candidate) => candidate.evidence)
  ];

  return {
    candidateTables: ensureMinimumTables(workspace, candidateTables),
    candidateColumns,
    matchedAliases,
    matchedBusinessTerms,
    retrievalEvidence,
    retrievalScore: totalScore(retrievalEvidence)
  };
}

function ensureMinimumTables(
  workspace: Workspace,
  candidates: SchemaCandidateTable[]
): SchemaCandidateTable[] {
  if (candidates.length > 0) {
    return candidates;
  }

  return workspace.schema.tables.slice(0, Math.min(3, workspace.schema.tables.length)).map((table) => ({
    table,
    score: 1,
    evidence: [
      {
        source: "table-name",
        targetId: table.name,
        label: table.name,
        score: 1,
        reason: "Fallback small candidate context because deterministic retrieval found no direct match."
      }
    ]
  }));
}

function matchAliases(aliases: SchemaAlias[], question: string): SchemaAlias[] {
  const questionTokens = tokenize(question);
  return aliases.filter(
    (alias) => alias.enabled && (containsNormalized(question, alias.alias) || tokenOverlap(questionTokens, tokenize(alias.alias)) > 0)
  );
}

function matchBusinessTerms(terms: BusinessTerm[], question: string): BusinessTerm[] {
  const questionTokens = tokenize(question);
  return terms.filter(
    (term) =>
      term.enabled !== false &&
      [term.name, ...term.aliases].some(
        (value) => containsNormalized(question, value) || tokenOverlap(questionTokens, tokenize(value)) > 0
      )
  );
}

function addEvidence(
  target: Map<string, RetrievalEvidence[]>,
  key: string,
  evidence: RetrievalEvidence
): void {
  target.set(key, [...(target.get(key) ?? []), evidence]);
}

function totalScore(evidence: RetrievalEvidence[]): number {
  return evidence.reduce((sum, item) => sum + item.score, 0);
}

function memoryPayloadMentions(payload: Record<string, unknown> | undefined, tableName: string): boolean {
  if (!payload) {
    return false;
  }

  const values = Object.values(payload).flatMap((value) => {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string");
    }
    return typeof value === "string" ? [value] : [];
  });

  return values.some((value) => containsNormalized(value, tableName));
}
