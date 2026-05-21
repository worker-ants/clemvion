---
status: complete
created: 2026-05-22
completed: 2026-05-22
owner: project-planner
priority: post-v1
worktree: chat-channel-spec-fix-5fc137
---

> 처리 결과 (spec 차원 정밀화 + 인프라 plan 분리): CCH-SE-03 본문에 v2 deadline 명시 — secret store 인프라 도입 직후 마이그레이션 의무, botToken 우선·secretToken 후속. §4.1 botTokenRef 주석 + chat-channel-adapter.md §2.3 secretToken 주석에 신 plan `chat-channel-secret-store-infra` 참조로 갱신. secret store 인프라 자체 결정 (AWS Secrets Manager / Vault / pgcrypto 등) 은 사용자 escalate 사항으로 신규 plan `chat-channel-secret-store-infra` 신설 — 본 plan 의 phase 2~3 작업은 인프라 결정 후 신 plan 으로 흡수.


# Plan — Chat Channel bot token v2: secret store reference 분리

## 배경

[CCH-SE-03](../../spec/5-system/15-chat-channel.md#34-신뢰성--보안) 는 "config JSONB 평문 금지 + secret store reference 만 보관" 을 **필수** 요구사항으로 명시하나, v1 구현은 `config.chatChannel.botToken` 을 plaintext stub 으로 출발한다 (`notification.signing.secret` 와 동일 정책). `botTokenRef` 와 `secretToken` 둘 다 v1 plaintext stub 상태.

본 plan 은 v2 implementation 으로 secret store 경로 (`secret://triggers/:id/bot-token` 형식) 로 분리하는 작업을 추적한다.

## 범위

### Phase 1 — secret store 인프라
- secret store 추상화 (AWS Secrets Manager / Vault / DB encrypted column 중 선택)
- `notification.signing.secret` 와 공용 secret store 경로 합의

### Phase 2 — botTokenRef 마이그레이션 (우선 — Bot API 전권한 자원)
- `config.chatChannel.botToken` (plaintext) → `botTokenRef: 'secret://triggers/:id/bot-token'` 마이그레이션
- 기존 plaintext 토큰을 secret store 로 옮기는 backfill migration
- `TelegramAdapter` / `ChatChannelDispatcher` 가 botToken resolve 시 secret store 조회

### Phase 3 — secretToken 마이그레이션 (후속 — server-issued 상대적 저위험)
- 동일 패턴, `secretToken` 도 secret store 경로화

## 의존 관계

- 선행 PR: #259 (본 plan stub 신설)
- 관련 spec: spec/5-system/15-chat-channel.md §4.1, spec/conventions/chat-channel-adapter.md §2.3
- 동반 갱신 필요: notification.signing.secret 도 같은 인프라를 공유한다면 [EIA spec](../../spec/5-system/14-external-interaction-api.md) §7.1 정합

## Out of Scope

- secret store 자체의 선정·도입 결정 (별 인프라 plan 으로 분리 가능)
- 다른 모듈의 secret 관리 통합 (cafe24 access token 등)
