---
worktree: (unstarted)
status: backlog
started: 2026-05-22
owner: project-planner
priority: v2 (인프라 의존 — 사용자 결정 필요)
---

# Plan — Secret store 인프라 도입 (Chat Channel + Notification 공용)

## 배경

[CCH-SE-03](../../spec/5-system/15-chat-channel.md#34-신뢰성--보안) 및 [EIA notification.signing.secret](../../spec/5-system/14-external-interaction-api.md) 모두 v1 단계에서 `config` JSONB 평문 stub 으로 출발했다. v2 정식 구현은 secret store reference (`secret://triggers/:id/<name>`) 경로 보관 — 별도 secret store 인프라가 선행되어야 한다.

본 plan 은 그 인프라 결정 + 도입 작업을 추적한다.

## 결정 항목 (사용자 escalate)

| 옵션 | 장점 | 단점 |
|---|---|---|
| (A) AWS Secrets Manager | managed, rotation 자동, IAM 통합 | AWS lock-in, 비용 |
| (B) HashiCorp Vault | multi-cloud, OSS, fine-grained ACL | 운영 부담 (HA cluster) |
| (C) DB 암호화 컬럼 (`pgcrypto` + KMS) | 기존 PostgreSQL 위에서 동작, 별 인프라 없음 | rotation 수동, audit log 약함 |

배포 환경 / 운영 부담 / 비용 trade-off 에 따라 사용자 결정 필요.

## 범위 (인프라 결정 후)

### Phase 1 — secret store adapter abstraction
- 통합 인터페이스 (`SecretResolver { resolve(ref: string): Promise<string> }`)
- `secret://` URI scheme 파서

### Phase 2 — `notification.signing.secret` 마이그레이션
- 기존 plaintext 를 secret store 로 backfill (Flyway + 1회성 backfill job)
- `NotificationDispatcher` 가 발송 시 resolve

### Phase 3 — `chat-channel.botToken` 마이그레이션 (우선 — Bot API 전권한)
- Telegram bot token plaintext → secret store
- `TelegramClient` / `TelegramAdapter` resolve 경로 변경

### Phase 4 — `chat-channel.secretToken` 마이그레이션 (후속 — webhook 검증)
- 동일 패턴

## 의존 관계

- 관련 spec: spec/5-system/15-chat-channel.md §4.1 (CCH-SE-03), spec/5-system/14-external-interaction-api.md (notification.signing)
- 다른 자격증명 (cafe24 access token 등) 도 같은 인프라 공유 검토 — 별 plan 분리 가능

## Out of Scope

- 다른 모듈 (cafe24 / oauth 등) 의 동시 마이그레이션 — 별 plan 으로 분리 권장
- secret rotation 자동화 (v2.x 후속)
