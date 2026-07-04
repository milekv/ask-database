export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let quote: "'" | "\"" | "`" | null = null;
  let bracketIdentifier = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index] ?? "";
    const next = sql[index + 1] ?? "";

    if (lineComment) {
      current += char;
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }

    if (!quote && !bracketIdentifier && char === "-" && next === "-") {
      current += char + next;
      index += 1;
      lineComment = true;
      continue;
    }

    if (!quote && !bracketIdentifier && char === "/" && next === "*") {
      current += char + next;
      index += 1;
      blockComment = true;
      continue;
    }

    if (!quote && char === "[") {
      bracketIdentifier = true;
      current += char;
      continue;
    }

    if (bracketIdentifier) {
      current += char;
      if (char === "]") {
        bracketIdentifier = false;
      }
      continue;
    }

    if ((char === "'" || char === "\"" || char === "`") && !quote) {
      quote = char;
      current += char;
      continue;
    }

    if (quote === char) {
      current += char;
      if (char === "'" && next === "'") {
        current += next;
        index += 1;
      } else {
        quote = null;
      }
      continue;
    }

    if (!quote && char === ";") {
      if (current.trim().length > 0) {
        statements.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) {
    statements.push(current.trim());
  }

  return statements;
}

export function normalizeSql(sql: string): string {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim();
}
