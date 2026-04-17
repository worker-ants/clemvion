-- V018: Add thinking_tokens column to llm_usage_log.
-- Tracks reasoning / thought token counts reported by provider SDKs that
-- surface them separately (OpenAI reasoning models, Gemini 2.5). Nullable
-- because Anthropic does not report thinking tokens as a standalone count.

ALTER TABLE llm_usage_log
    ADD COLUMN thinking_tokens INTEGER;
