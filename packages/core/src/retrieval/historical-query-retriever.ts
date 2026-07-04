import type { HistoricalQueryMatch, RetrievalEvidence, Workspace } from "@ask-database/shared";
import { tokenOverlap, tokenize } from "./normalize.js";

const MAX_HISTORICAL_EXAMPLES = 4;
const TABLE_OVERLAP_WEIGHT = 18;
const COLUMN_OVERLAP_WEIGHT = 10;
const FILTER_OVERLAP_WEIGHT = 6;
const SUMMARY_OVERLAP_WEIGHT = 14;
const JOIN_OVERLAP_WEIGHT = 12;
const AGGREGATION_WEIGHT = 10;
const STRUCTURE_WEIGHT = 6;

export function retrieveHistoricalQueries(workspace: Workspace, question: string): HistoricalQueryMatch[] {
  const questionTokens = expandQuestionTokens(workspace, question);

  return workspace.historicalQueries
    .map((query): HistoricalQueryMatch => {
      const evidence: RetrievalEvidence[] = [];
      const tableOverlap = tokenOverlap(questionTokens, query.tables.flatMap(tokenize));
      if (tableOverlap > 0) {
        evidence.push({
          source: "history",
          targetId: query.id,
          label: "table overlap",
          score: tableOverlap * TABLE_OVERLAP_WEIGHT,
          reason: "Historical query uses tables related to the question."
        });
      }

      const columnOverlap = tokenOverlap(questionTokens, (query.columns ?? []).flatMap(tokenize));
      if (columnOverlap > 0) {
        evidence.push({
          source: "history",
          targetId: query.id,
          label: "column overlap",
          score: columnOverlap * COLUMN_OVERLAP_WEIGHT,
          reason: "Historical query uses columns related to the question."
        });
      }

      const filterOverlap = tokenOverlap(
        questionTokens,
        query.filters.map((filter) => filter.rawCondition).flatMap(tokenize)
      );
      if (filterOverlap > 0) {
        evidence.push({
          source: "history",
          targetId: query.id,
          label: "filter overlap",
          score: filterOverlap * FILTER_OVERLAP_WEIGHT,
          reason: "Historical filter pattern overlaps with the question."
        });
      }

      const joinOverlap = tokenOverlap(
        questionTokens,
        query.joins.map((join) => `${join.leftTable ?? ""} ${join.rightTable ?? ""} ${join.rawCondition}`).flatMap(tokenize)
      );
      if (joinOverlap > 0) {
        evidence.push({
          source: "history",
          targetId: query.id,
          label: "join path overlap",
          score: joinOverlap * JOIN_OVERLAP_WEIGHT,
          reason: "Historical join path overlaps with the question context."
        });
      }

      if (query.groupBy.length > 0 && questionMentionsAggregation(questionTokens)) {
        evidence.push({
          source: "history",
          targetId: query.id,
          label: "aggregation similarity",
          score: AGGREGATION_WEIGHT,
          reason: "Historical query has aggregation and the question asks for a grouped or total result."
        });
      }

      if (query.signature && tokenOverlap(questionTokens, tokenize(query.signature)) > 0) {
        evidence.push({
          source: "history",
          targetId: query.id,
          label: "structure signature",
          score: STRUCTURE_WEIGHT,
          reason: "Historical structure signature overlaps with the question."
        });
      }

      if (query.semanticSummary) {
        const summaryOverlap = tokenOverlap(questionTokens, tokenize(query.semanticSummary));
        if (summaryOverlap > 0) {
          evidence.push({
            source: "history",
            targetId: query.id,
            label: "semantic summary",
            score: summaryOverlap * SUMMARY_OVERLAP_WEIGHT,
            reason: "Provider-generated summary overlaps with the question."
          });
        }
      }

      return {
        query,
        evidence,
        score: evidence.reduce((sum, item) => sum + item.score, 0)
      };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_HISTORICAL_EXAMPLES);
}

function questionMentionsAggregation(tokens: string[]): boolean {
  return tokens.some((token) =>
    ["count", "sum", "total", "average", "avg", "liczba", "suma", "razem", "wartosc", "value", "spend"].includes(token)
  );
}

function expandQuestionTokens(workspace: Workspace, question: string): string[] {
  const tokens = new Set(tokenize(question));
  const questionTokens = Array.from(tokens);

  for (const term of workspace.glossary.filter((item) => item.enabled !== false)) {
    const termTokens = [term.name, ...term.aliases].flatMap(tokenize);
    if (tokenOverlap(questionTokens, termTokens) === 0) {
      continue;
    }

    for (const value of [...term.relatedTables, ...term.relatedColumns]) {
      for (const token of tokenize(value)) {
        tokens.add(token);
      }
    }
  }

  for (const alias of workspace.aliases ?? []) {
    if (!alias.enabled || tokenOverlap(questionTokens, tokenize(alias.alias)) === 0) {
      continue;
    }
    for (const token of tokenize(alias.targetId)) {
      tokens.add(token);
    }
  }

  return Array.from(tokens);
}
