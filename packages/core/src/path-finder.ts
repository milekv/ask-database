import type { RelationshipDefinition, Workspace } from "@ask-database/shared";

export function findRelationshipPath(
  workspace: Workspace,
  fromTable: string,
  toTable: string
): RelationshipDefinition[] {
  if (fromTable.toLowerCase() === toTable.toLowerCase()) {
    return [];
  }

  const relationships = workspace.schema.relationships;
  const queue: Array<{ table: string; path: RelationshipDefinition[] }> = [
    { table: fromTable, path: [] }
  ];
  const visited = new Set<string>([fromTable.toLowerCase()]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    for (const relationship of relationships) {
      const nextTable = nextTableForRelationship(relationship, current.table);
      if (!nextTable || visited.has(nextTable.toLowerCase())) {
        continue;
      }

      const path = [...current.path, relationship];
      if (nextTable.toLowerCase() === toTable.toLowerCase()) {
        return path;
      }

      visited.add(nextTable.toLowerCase());
      queue.push({ table: nextTable, path });
    }
  }

  return [];
}

function nextTableForRelationship(
  relationship: RelationshipDefinition,
  table: string
): string | null {
  if (relationship.fromTable.toLowerCase() === table.toLowerCase()) {
    return relationship.toTable;
  }
  if (relationship.toTable.toLowerCase() === table.toLowerCase()) {
    return relationship.fromTable;
  }

  return null;
}
