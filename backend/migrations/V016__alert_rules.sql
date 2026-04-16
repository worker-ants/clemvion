-- V016: Alert rules for threshold-based notifications
-- See: plan/stages/09-alerting-thresholds.md

CREATE TABLE alert_rule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES workflow(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL CHECK (type IN ('failure_rate', 'duration', 'llm_cost')),
    threshold NUMERIC(12, 4) NOT NULL,
    -- ISO 8601 duration (예: PT1H, PT24H, P1D).
    -- 주의: `window`는 PostgreSQL 예약어(WINDOW 절·윈도 함수)라 컬럼명으로 쓸 수 없으므로
    -- `window_iso`로 명명한다. TypeORM 엔티티는 `@Column({ name: 'window_iso' })`로 매핑.
    window_iso VARCHAR(32) NOT NULL DEFAULT 'PT1H',
    channel VARCHAR(16) NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_rule_workspace ON alert_rule (workspace_id);
CREATE INDEX idx_alert_rule_enabled ON alert_rule (enabled) WHERE enabled = true;
