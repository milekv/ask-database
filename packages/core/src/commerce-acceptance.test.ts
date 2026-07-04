import { describe, expect, it } from "vitest";
import { parseDDL } from "@ask-database/schema-parser";
import type { Workspace } from "@ask-database/shared";
import { importHistoricalQueries, learnQueryPatterns } from "@ask-database/sql-memory";
import {
  askDatabase,
  MockLLMProvider,
  rankRelationshipPaths,
  retrieveHistoricalQueries,
  retrieveWorkspaceContext
} from "./index.js";

const commerceDdl = `
CREATE TABLE customers (
  id integer primary key,
  email text not null unique,
  full_name text not null,
  created_at timestamp not null
);

CREATE TABLE orders (
  id integer primary key,
  customer_id integer not null references customers(id),
  status text not null,
  ordered_at timestamp not null
);

CREATE TABLE categories (
  id integer primary key,
  name text not null unique
);

CREATE TABLE products (
  id integer primary key,
  category_id integer not null references categories(id),
  name text not null,
  sku text not null unique
);

CREATE TABLE order_items (
  id integer primary key,
  order_id integer not null references orders(id),
  product_id integer not null references products(id),
  quantity integer not null,
  unit_price numeric(12,2) not null
);
`;

const commerceHistory = `
SELECT c.id, c.email, SUM(oi.quantity * oi.unit_price) AS total_spend
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
GROUP BY c.id, c.email
HAVING SUM(oi.quantity * oi.unit_price) > 1000;

SELECT c.id, c.full_name, p.name AS product_name
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id;

SELECT c.id, c.full_name, cat.name AS category_name
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
JOIN categories cat ON cat.id = p.category_id
WHERE cat.name = 'Electronics';

SELECT o.id, o.status, o.ordered_at, c.email
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'completed';

SELECT cat.name, COUNT(oi.id) AS item_count
FROM categories cat
JOIN products p ON p.category_id = cat.id
JOIN order_items oi ON oi.product_id = p.id
GROUP BY cat.name;
`;

describe("commerce acceptance flow", () => {
  it("uses commerce schema, glossary, aliases, historical SQL and correction memory without University Demo scenarios", async () => {
    const workspace = createCommerceWorkspace();
    const question =
      "Show valuable customers who bought products from the Electronics category since 2025 and place the highest total spend first.";

    const retrieval = retrieveWorkspaceContext(workspace, question);
    const historical = retrieveHistoricalQueries(workspace, question);
    const paths = rankRelationshipPaths(workspace, retrieval);

    expect(retrieval.candidateTables.map((candidate) => candidate.table.name)).toEqual(
      expect.arrayContaining(["customers", "orders", "order_items", "products", "categories"])
    );
    expect(retrieval.matchedBusinessTerms.map((term) => term.id)).toContain("term_valuable_customer");
    expect(retrieval.matchedAliases.map((alias) => alias.id)).toContain("alias_bought");
    expect(historical.length).toBeGreaterThanOrEqual(2);
    expect(historical.flatMap((match) => match.evidence.map((item) => item.label))).toEqual(
      expect.arrayContaining(["join path overlap"])
    );
    expect(paths.length).toBeGreaterThan(0);

    const provider = new MockLLMProvider();
    provider.queueStructured({
      requestSummary:
        "Valuable customers with completed orders for Electronics products since 2025, sorted by total spend.",
      requestedEntities: ["customers", "orders", "order_items", "products", "categories"],
      requestedFields: ["customers.id", "customers.email", "customers.full_name"],
      filters: ["categories.name = 'Electronics'", "orders.ordered_at >= DATE '2025-01-01'"],
      aggregations: ["SUM(order_items.quantity * order_items.unit_price)"],
      grouping: ["customers.id", "customers.email", "customers.full_name"],
      sorting: ["total_spend DESC"],
      limit: null,
      exclusions: [],
      existenceConditions: [],
      matchedBusinessTerms: ["valuable customer"],
      candidateTableIds: ["customers", "orders", "order_items", "products", "categories"],
      candidateColumnIds: [
        "customers.id",
        "customers.email",
        "customers.full_name",
        "orders.status",
        "orders.ordered_at",
        "order_items.quantity",
        "order_items.unit_price",
        "products.category_id",
        "categories.name"
      ],
      ambiguities: [],
      requiresClarification: false
    });
    provider.queueStructured({
      sql: `SELECT
  c.id,
  c.email,
  c.full_name,
  SUM(oi.quantity * oi.unit_price) AS total_spend
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
JOIN categories cat ON cat.id = p.category_id
WHERE cat.name = 'Electronics'
  AND o.ordered_at >= DATE '2025-01-01'
GROUP BY c.id, c.email, c.full_name
HAVING SUM(oi.quantity * oi.unit_price) > 1000
ORDER BY total_spend DESC;`,
      tableIdsUsed: ["customers", "orders", "order_items", "products", "categories"],
      columnIdsUsed: [
        "customers.id",
        "customers.email",
        "customers.full_name",
        "orders.customer_id",
        "orders.ordered_at",
        "order_items.order_id",
        "order_items.product_id",
        "order_items.quantity",
        "order_items.unit_price",
        "products.id",
        "products.category_id",
        "categories.id",
        "categories.name"
      ],
      relationshipIdsUsed: [
        "orders.customer_id->customers.id",
        "order_items.order_id->orders.id",
        "order_items.product_id->products.id",
        "products.category_id->categories.id"
      ],
      assumptions: [],
      ambiguities: [],
      explanation: "Generated from commerce retrieval context and historical join evidence."
    });

    const result = await askDatabase({
      workspace,
      provider,
      request: {
        workspaceId: workspace.id,
        question,
        dialect: "postgresql",
        safeMode: true
      }
    });

    expect(result.validation.valid).toBe(true);
    expect(result.sql).not.toMatch(/students|departments|courses|grades|enrollments/i);
    expect(result.sql).toMatch(/customers/i);
    expect(result.sql).toMatch(/order_items/i);
    expect(result.historicalEvidence?.length).toBeGreaterThan(0);
    expect(result.businessTermEvidence?.map((term) => term.id)).toContain("term_valuable_customer");

    workspace.memoryRules.push({
      id: "memory_completed_orders",
      title: "Completed orders only",
      description: "For valuable customer spend, prefer completed orders.",
      appliesTo: "filter",
      confidence: 1,
      enabled: true,
      priority: "high",
      scope: "workspace",
      source: "user-correction",
      payload: {
        preferredTables: ["orders"],
        requiredFilters: ["orders.status = 'completed'"]
      }
    });

    const followUpRetrieval = retrieveWorkspaceContext(
      workspace,
      "Show valuable customers from the Electronics category."
    );
    expect(followUpRetrieval.retrievalEvidence.some((item) => item.source === "memory" && item.targetId === "orders")).toBe(true);

    workspace.memoryRules[workspace.memoryRules.length - 1]!.enabled = false;
    const disabledRetrieval = retrieveWorkspaceContext(
      workspace,
      "Show valuable customers from the Electronics category."
    );
    expect(disabledRetrieval.retrievalEvidence.some((item) => item.label === "Completed orders only")).toBe(false);
  });
});

function createCommerceWorkspace(): Workspace {
  const parsed = parseDDL(commerceDdl, "postgresql").schema;
  const historicalQueries = importHistoricalQueries(commerceHistory, "postgresql").imported;
  return {
    id: "test-commerce",
    name: "Test Commerce",
    description: "Synthetic commerce workspace for acceptance testing.",
    dialect: "postgresql",
    schema: parsed,
    historicalQueries,
    queryPatterns: learnQueryPatterns(historicalQueries),
    glossary: [
      {
        id: "term_valuable_customer",
        name: "valuable customer",
        aliases: ["valuable customers", "high value customer"],
        description: "Customer with total completed order value greater than 1000.",
        sqlExpression: "SUM(order_items.quantity * order_items.unit_price) > 1000",
        relatedTables: ["customers", "orders", "order_items", "products", "categories"],
        relatedColumns: ["customers.id", "orders.customer_id", "orders.status", "order_items.unit_price"]
      }
    ],
    aliases: [
      {
        id: "alias_bought",
        targetType: "relationship",
        targetId: "orders.customer_id->customers.id order_items.order_id->orders.id order_items.product_id->products.id",
        alias: "bought",
        language: "en",
        enabled: true
      }
    ],
    memoryRules: [],
    corrections: [],
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z"
  };
}
