-- Initial schema, applied transactionally by migrate.mjs. Requires TimescaleDB 2.13+.
CREATE TABLE IF NOT EXISTS attempts (
  ts         timestamptz NOT NULL DEFAULT now(),
  learner_id uuid        NOT NULL,
  item       text        NOT NULL CHECK (item ~ '^[A-Z][A-Z0-9_-]{0,19}$'),
  correct    boolean     NOT NULL,
  codes      text[]      NOT NULL DEFAULT '{}' CHECK (cardinality(codes) <= 5)
);
SELECT create_hypertable('attempts', by_range('ts'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS attempts_learner_ts ON attempts (learner_id, ts DESC);
