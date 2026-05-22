-- V063: Secret store — application-side AES-256-GCM 으로 암호화된 자격증명·시크릿 보관소
--
-- 관련 spec:
--   - spec/conventions/secret-store.md (단일 진실 — SecretResolver interface / URI scheme / 암호화 형식)
--   - spec/1-data-model.md §2.21.1 (SecretStore 엔티티)
--   - spec/5-system/15-chat-channel.md §3.4 CCH-SE-03 (chat channel bot token / webhook secret)
--   - spec/5-system/14-external-interaction-api.md §7.1 (notification.signing.secretRef)
--
-- 결정
--   - PostgreSQL 의 pgcrypto 사용하지 않음 — backend Node.js `crypto` 모듈이 AES-256-GCM 으로
--     암복호화. 마스터키는 ENCRYPTION_KEY (LLM API key 암호화에 이미 사용 중인 64-char hex)
--     를 재사용 — 신규 env var 도입 안 함. DB 는 ciphertext (BYTEA) 만 본다.
--
-- 저장 형식
--   - encrypted = [IV(12B) ‖ AES-256-GCM ciphertext(N) ‖ authTag(16B)] raw concat
--   - AAD = ref (cross-row 교체 공격 차단)
--
-- 호환성
--   - 신규 테이블 — 기존 테이블/컬럼 무변경.
--   - workspace_id FK 없음 — application-level cascade (TriggersService.delete / workspace 삭제 시
--     명시적 cleanup). 향후 다른 scope (workspace 외부 system-wide secret) 확장 여지를 위한 결정.

CREATE TABLE secret_store (
    ref          TEXT        PRIMARY KEY,
    workspace_id UUID        NOT NULL,
    encrypted    BYTEA       NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ref 형식 검증: 'secret://<scope>/<resourceId>/<name>' 강제 (spec/conventions/secret-store.md §1).
-- 추가 형식 검증은 application 차원에서도 수행하지만, DB 차원 가드로 corrupt row 방지.
ALTER TABLE secret_store
    ADD CONSTRAINT chk_secret_store_ref_format
    CHECK (ref ~ '^secret://[a-z][a-z0-9-]*/[^/]+/[a-z0-9][a-z0-9.-]*$');

-- workspace 별 cleanup·조회용 인덱스.
CREATE INDEX idx_secret_store_workspace_id ON secret_store(workspace_id);
