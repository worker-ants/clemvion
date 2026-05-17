-- V020: Workflow AI Assistant — record stall auto-resume on assistant messages
-- See: spec/3-workflow-editor/4-ai-assistant.md §6.0, §10 / memory/workflow-assistant-provider-quirks-and-review-always.md §10
--
-- Stall auto-recovery (spec §10) previously accumulated every round of the
-- same turn into one `assistantText` and persisted a single
-- `workflow_assistant_message` row. gpt-oss-120b repeats confirmation
-- phrases ("계속 진행해도 될까요?") at round boundaries, so the repeated
-- text ended up crammed inside a single bubble.
--
-- We now split the row at each stall-recovery boundary: the "intermediate"
-- rows carry `finish_reason='auto_resume_pending'` with `auto_resumed=false`,
-- and the row that kicks off the recovered round carries `auto_resumed=true`
-- with the recovery reason and attempt number. The frontend uses these
-- flags to draw an "🔄 Auto-resumed" divider between bubbles on rehydrate.
--
-- Defaults keep existing rows readable (auto_resumed=false, other fields
-- NULL) without a data backfill.

ALTER TABLE workflow_assistant_message
    ADD COLUMN auto_resumed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN auto_resume_reason VARCHAR(40),
    ADD COLUMN auto_resume_attempt SMALLINT;
