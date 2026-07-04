const polishMap: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z"
};

const polishSuffixes = [
  "ami",
  "ach",
  "ego",
  "emu",
  "ymi",
  "imi",
  "owej",
  "owych",
  "owie",
  "ow",
  "ie",
  "ia",
  "em",
  "om",
  "a",
  "e",
  "y",
  "i"
];

export function normalizeForRetrieval(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ąćęłńóśźż]/g, (char) => polishMap[char] ?? char)
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string): string[] {
  const tokens = normalizeForRetrieval(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2);
  const expanded = new Set<string>();

  for (const token of tokens) {
    expanded.add(token);
    const stem = stemToken(token);
    if (stem.length >= 2) {
      expanded.add(stem);
    }
  }

  return Array.from(expanded);
}

export function containsNormalized(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeForRetrieval(needle);
  if (normalizedNeedle.length === 0) {
    return false;
  }

  const normalizedHaystack = normalizeForRetrieval(haystack);
  if (normalizedHaystack.includes(normalizedNeedle)) {
    return true;
  }

  return tokenOverlap(tokenize(haystack), tokenize(needle)) > 0;
}

export function tokenOverlap(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let overlap = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      overlap += 1;
    }
  }

  return overlap;
}

function stemToken(token: string): string {
  if (token.length <= 3) {
    return token;
  }

  if (/^[a-z]+s$/.test(token) && token.length > 4) {
    if (token.endsWith("ies") && token.length > 5) {
      return `${token.slice(0, -3)}y`;
    }
    return token.slice(0, -1);
  }

  for (const suffix of polishSuffixes) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
      return token.slice(0, -suffix.length);
    }
  }

  return token;
}
