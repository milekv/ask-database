CREATE TABLE IF NOT EXISTS workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  dialect text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_versions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version text NOT NULL,
  ddl text NOT NULL,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  unsupported_statements jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_tables (
  id text PRIMARY KEY,
  schema_version_id text NOT NULL REFERENCES schema_versions(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  schema_name text,
  primary_key jsonb NOT NULL DEFAULT '[]'::jsonb,
  unique_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schema_version_id, name)
);

CREATE TABLE IF NOT EXISTS schema_columns (
  id text PRIMARY KEY,
  table_id text NOT NULL REFERENCES schema_tables(id) ON DELETE CASCADE,
  schema_version_id text NOT NULL REFERENCES schema_versions(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  name text NOT NULL,
  data_type text NOT NULL,
  nullable boolean NOT NULL,
  primary_key boolean NOT NULL,
  unique_key boolean NOT NULL,
  default_value text,
  references_table text,
  references_column text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_id, name)
);

CREATE TABLE IF NOT EXISTS schema_relationships (
  id text PRIMARY KEY,
  schema_version_id text NOT NULL REFERENCES schema_versions(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  from_table text NOT NULL,
  from_column text NOT NULL,
  to_table text NOT NULL,
  to_column text NOT NULL,
  source text NOT NULL,
  confidence numeric NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  preferred boolean NOT NULL DEFAULT false,
  rejected boolean NOT NULL DEFAULT false,
  usage_count integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS historical_queries (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  original_sql text NOT NULL,
  sanitized_sql text NOT NULL,
  normalized_sql text NOT NULL,
  statement_type text NOT NULL,
  tables jsonb NOT NULL DEFAULT '[]'::jsonb,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  joins jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  group_by jsonb NOT NULL DEFAULT '[]'::jsonb,
  order_by jsonb NOT NULL DEFAULT '[]'::jsonb,
  structure_signature text NOT NULL,
  semantic_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_glossary_terms (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text NOT NULL DEFAULT '',
  sql_expression text,
  related_tables jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_aliases (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id text NOT NULL,
  alias text NOT NULL,
  language text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_memory (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  applies_to text NOT NULL,
  confidence numeric NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  priority text NOT NULL DEFAULT 'medium',
  scope text NOT NULL DEFAULT 'workspace',
  source text NOT NULL DEFAULT 'manual',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_corrections (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  original_question text NOT NULL,
  corrected_sql text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS query_conversations (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS query_turns (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES query_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS query_versions (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES query_conversations(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  question text NOT NULL,
  interpretation text NOT NULL,
  sql text NOT NULL,
  validation jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decision_log_entries (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id text REFERENCES query_conversations(id) ON DELETE CASCADE,
  query_version_id text REFERENCES query_versions(id) ON DELETE CASCADE,
  stage text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_conflicts (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_updated_at ON workspaces(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_schema_tables_workspace ON schema_tables(workspace_id);
CREATE INDEX IF NOT EXISTS idx_schema_columns_workspace ON schema_columns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_schema_relationships_workspace ON schema_relationships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_historical_queries_workspace ON historical_queries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_business_glossary_workspace ON business_glossary_terms(workspace_id);
CREATE INDEX IF NOT EXISTS idx_schema_aliases_workspace ON schema_aliases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_memory_workspace ON workspace_memory(workspace_id);
