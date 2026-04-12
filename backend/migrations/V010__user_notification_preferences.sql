-- V010: User notification preferences
-- See: spec/2-navigation/4-integration.md §11.3 (email opt-in for integration expiry)

ALTER TABLE "user"
    ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}';
