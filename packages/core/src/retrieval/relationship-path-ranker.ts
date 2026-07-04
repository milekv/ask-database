import type {
  RelationshipDefinition,
  RelationshipPathCandidate,
  RetrievalEvidence,
  SchemaRetrievalResult,
  Workspace,
  WorkspaceMemoryRule
} from "@ask-database/shared";
import { containsNormalized, tokenOverlap, tokenize } from "./normalize.js";

const MAX_RELATIONSHIP_PATHS = 5;
const SOURCE_WEIGHTS: Record<string, number> = {
  "user-correction": 100,
  "approved-memory": 90,
  manual: 80,
  ddl: 65,
  "historical-query": 45,
  inferred: 20
};

export function rankRelationshipPaths(
  workspace: Workspace,
  retrieval: SchemaRetrievalResult
): RelationshipPathCandidate[] {
  const candidateTables = retrieval.candidateTables.map((candidate) => candidate.table.name);
  const pairs = createPairs(candidateTables);
  const candidates: RelationshipPathCandidate[] = [];

  for (const [fromTable, toTable] of pairs) {
    const path = findPath(workspace.schema.relationships, fromTable, toTable);
    if (path.length === 0) {
      continue;
    }

    candidates.push(buildCandidate(path, workspace.memoryRules));
  }

  return dedupePaths(candidates)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_RELATIONSHIP_PATHS);
}

function createPairs(tables: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let left = 0; left < tables.length; left += 1) {
    for (let right = left + 1; right < tables.length; right += 1) {
      const first = tables[left];
      const second = tables[right];
      if (first && second) {
        pairs.push([first, second]);
      }
    }
  }

  return pairs;
}

function findPath(
  relationships: RelationshipDefinition[],
  fromTable: string,
  toTable: string
): RelationshipDefinition[] {
  const queue: Array<{ table: string; path: RelationshipDefinition[] }> = [{ table: fromTable, path: [] }];
  const visited = new Set<string>([fromTable.toLowerCase()]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    for (const relationship of relationships.filter((item) => item.enabled !== false)) {
      const next = nextTable(relationship, current.table);
      if (!next || visited.has(next.toLowerCase())) {
        continue;
      }

      const path = [...current.path, relationship];
      if (next.toLowerCase() === toTable.toLowerCase()) {
        return path;
      }

      visited.add(next.toLowerCase());
      queue.push({ table: next, path });
    }
  }

  return [];
}

function buildCandidate(
  relationships: RelationshipDefinition[],
  memoryRules: WorkspaceMemoryRule[]
): RelationshipPathCandidate {
  const evidence: RetrievalEvidence[] = relationships.map((relationship) => {
    const sourceWeight = SOURCE_WEIGHTS[relationship.source] ?? 10;
    const preferenceBonus = relationship.preferred ? 20 : 0;
    const rejectionPenalty = relationship.rejected ? -80 : 0;
    const usageBonus = Math.min(20, relationship.usageCount ?? 0);
    return {
      source: "memory",
      targetId: relationship.id,
      label: relationship.id,
      score: sourceWeight + preferenceBonus + usageBonus + rejectionPenalty,
      reason: `Relationship source ${relationship.source} with confidence ${relationship.confidence}.`
    };
  });
  evidence.push(...memoryEvidenceForPath(relationships, memoryRules));

  const lengthPenalty = Math.max(0, relationships.length - 1) * 12;
  const score = Math.max(1, evidence.reduce((sum, item) => sum + item.score, 0) - lengthPenalty);
  const tableSet = new Set<string>();
  for (const relationship of relationships) {
    tableSet.add(relationship.fromTable);
    tableSet.add(relationship.toTable);
  }

  return {
    relationships,
    tables: Array.from(tableSet),
    score,
    evidence
  };
}

function memoryEvidenceForPath(
  relationships: RelationshipDefinition[],
  memoryRules: WorkspaceMemoryRule[]
): RetrievalEvidence[] {
  const pathText = relationships
    .flatMap((relationship) => [
      relationship.id,
      relationship.fromTable,
      relationship.fromColumn,
      relationship.toTable,
      relationship.toColumn
    ])
    .join(" ");
  const pathTables = new Set(relationships.flatMap((relationship) => [relationship.fromTable, relationship.toTable]));
  const evidence: RetrievalEvidence[] = [];

  for (const memory of memoryRules.filter((rule) => rule.enabled !== false)) {
    const payload = memory.payload ?? {};
    const preferred = stringArray(payload.preferredTables);
    const rejected = stringArray(payload.rejectedTables);
    const preferredRelationshipIds = stringArray(payload.preferredRelationshipIds);
    const rejectedRelationshipIds = stringArray(payload.rejectedRelationshipIds);
    const priorityScore = memory.priority === "high" ? 55 : memory.priority === "low" ? 15 : 30;
    const confidence = Math.max(0, Math.min(1, memory.confidence));
    let score = 0;

    if (preferred.some((table) => pathTables.has(table)) || preferredRelationshipIds.some((id) => relationships.some((relationship) => relationship.id === id))) {
      score += priorityScore * confidence;
    }
    if (rejected.some((table) => pathTables.has(table)) || rejectedRelationshipIds.some((id) => relationships.some((relationship) => relationship.id === id))) {
      score -= priorityScore * confidence;
    }

    const memoryText = `${memory.title} ${memory.description}`;
    if (tokenOverlap(tokenize(memoryText), tokenize(pathText)) >= 2) {
      score += Math.round((priorityScore / 2) * confidence);
    }
    if ((containsNormalized(memoryText, "avoid") || containsNormalized(memoryText, "unikaj")) && tokenOverlap(tokenize(memoryText), tokenize(pathText)) > 0) {
      score -= Math.round((priorityScore / 2) * confidence);
    }

    if (score !== 0) {
      evidence.push({
        source: "memory",
        targetId: memory.id,
        label: memory.title,
        score,
        reason: score > 0 ? "Confirmed workspace memory prefers this path." : "Confirmed workspace memory penalizes this path."
      });
    }
  }

  return evidence;
}

function nextTable(relationship: RelationshipDefinition, table: string): string | null {
  if (relationship.fromTable.toLowerCase() === table.toLowerCase()) {
    return relationship.toTable;
  }
  if (relationship.toTable.toLowerCase() === table.toLowerCase()) {
    return relationship.fromTable;
  }

  return null;
}

function dedupePaths(paths: RelationshipPathCandidate[]): RelationshipPathCandidate[] {
  const byKey = new Map<string, RelationshipPathCandidate>();
  for (const path of paths) {
    const key = path.relationships.map((relationship) => relationship.id).sort().join("|");
    const current = byKey.get(key);
    if (!current || path.score > current.score) {
      byKey.set(key, path);
    }
  }

  return Array.from(byKey.values());
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
