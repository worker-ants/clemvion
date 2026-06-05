# 신규 식별자 충돌 검토

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)

변경된 파일:
- `spec/5-system/4-execution-engine.md` — `schemaVersion`/`CHECKPOINT_SCHEMA_VERSION` 도입
- `spec/5-system/3-error-handling.md` — `RESUME_INCOMPATIBLE_STATE` 설명 확장 (schemaVersion 언급 추가)
- `spec/5-system/6-websocket-protocol.md` — 동일
- `spec/4-nodes/3-ai/1-ai-agent.md` — 동일
- `spec/conventions/node-output.md` — 동일
- `spec/5-system/1-auth.md` — historical-artifact 주석 추가
- `spec/conventions/error-codes.md` — §3 레지스트리에 invitation 에러코드 행 신규 등재

---

## 발견사항

### [WARNING] `forbidden` (lowercase) 를 글로벌 레지스트리에 등재 — `FORBIDDEN` 과 대소문자 혼동 위험

- target 신규 식별자: `forbidden` (lowercase) — `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 신규 등재
- 기존 사용처:
  - `spec/5-system/2-api-convention.md` L160: `403=\`FORBIDDEN\`` — HTTP 403 global default code
  - `spec/5-system/3-error-handling.md` L37: `FORBIDDEN` — 역할 권한 부족(generic) 글로벌 코드
  - 코드베이스 전역에서 `FORBIDDEN` 이 403 응답의 default code 로 사용됨
- 상세: `forbidden` (lowercase) 는 초대 API 한정 historical artifact 이며 `FORBIDDEN` (UPPER_SNAKE_CASE) 과 의미·케이스 모두 다르다. 등재된 entry 가 이 점을 명시("초대 흐름 전용")하고 있어 현재는 문서 정합 상 혼동이 없다. 그러나 두 코드가 동일 레지스트리에 공존함으로써 "forbidden 과 FORBIDDEN 은 다르다" 를 레지스트리를 읽지 않은 독자에게 혼동을 줄 수 있다.
- 제안: `error-codes.md §3` 의 해당 행에 "본 `forbidden` (lowercase) 은 초대 흐름 전용이며 `spec/5-system/2-api-convention.md` 의 `FORBIDDEN` (global 403 default) 와 의도적으로 다른 값이다" 를 명시 보강. 현재 entry 에 이미 "다른 영역의 UPPER_SNAKE_CASE 범용 코드와 별개" 문구가 포함되어 있어 WARNING 수준(충돌이 아닌 혼동 가능성).

---

### [WARNING] `rate_limited` (lowercase) 를 글로벌 레지스트리에 등재 — `RATE_LIMITED` 와 대소문자 혼동 위험

- target 신규 식별자: `rate_limited` (lowercase) — `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 신규 등재
- 기존 사용처:
  - `spec/5-system/2-api-convention.md` L160: `429=\`RATE_LIMITED\`` — HTTP 429 global default code
  - `spec/5-system/3-error-handling.md` L28: `RATE_LIMITED` — 글로벌 429 코드
  - `spec/5-system/14-external-interaction-api.md` L316·L646: `RATE_LIMITED`
- 상세: `forbidden` 케이스와 동일 구조. `rate_limited` (lowercase) 가 초대 흐름에서 발행되고, `RATE_LIMITED` (UPPER_SNAKE_CASE) 가 시스템 전역에서 발행되는데, 두 코드가 별개의 행 없이 동일 레지스트리 셀에 묶여있다.
- 제안: `forbidden` 과 동일하게 레지스트리 entry 내 "RATE_LIMITED (글로벌 429) 와 별개" 명시 강화. 현재 entry 에 이미 명시되어 있어 추가 강화 정도.

---

### [INFO] `schemaVersion` 필드 네이밍 — `_resumeCheckpoint` 한정 사용, 충돌 없음

- target 신규 식별자: `schemaVersion` — `_resumeCheckpoint` JSON 객체 내 필드. `CHECKPOINT_SCHEMA_VERSION` — 코드 모듈 상수 (`execution-engine.service.ts`)
- 기존 사용처: spec 전역 및 codebase 에서 `schemaVersion` 을 동일 이름으로 다른 도메인에 사용하는 사례 없음. `execution-engine.service.ts` 내부에서만 사용.
- 상세: 충돌 없음. `schemaVersion` 은 JSONB 내부 필드라 외부 노출이 없고, `CHECKPOINT_SCHEMA_VERSION` 은 모듈 내부 상수라 범위가 좁다. 기존 `_retryState` 의 `expiresAt`/`lastUserMessage` 등 필드와도 이름 충돌 없음.
- 제안: 없음. 현재 명명 적절.

---

### [INFO] `RESUME_INCOMPATIBLE_STATE` 에러 코드 — 기존 코드 확장, 신규 코드 아님

- target 신규 식별자: 기존 `RESUME_INCOMPATIBLE_STATE` 에 "미래 버전" 케이스를 추가하는 설명 확장
- 기존 사용처: `spec/5-system/3-error-handling.md`, `spec/5-system/6-websocket-protocol.md`, `spec/5-system/4-execution-engine.md` 에 이미 정의된 코드
- 상세: 신규 ID 도입이 아니라 기존 코드의 트리거 조건 확장. 의미는 동일(재구성 불가 → cancelled). 충돌 없음.
- 제안: 없음.

---

### [INFO] `invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` — 기존 코드 레지스트리 등재, 신규 발행 아님

- target 신규 식별자: `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 신규 행 등재
- 기존 사용처:
  - `spec/5-system/1-auth.md` §1.5.4 (origin/main 에서 이미 정의)
  - `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` 에서 이미 발행 중
  - `codebase/frontend/src/lib/api/invitations.ts` `INVITATION_ERROR` 상수로 이미 사용 중
- 상세: 코드 자체는 신규 발명이 아니라 기존 코드의 레지스트리 등재. 이미 사용 중인 코드를 문서화하는 것이므로 식별자 충돌 없음. `spec/5-system/1-auth.md` 의 신규 주석과 `error-codes.md §3` 등재는 상호 일관됨.
- 제안: 없음.

---

## 요약

이번 diff 가 도입하는 신규 식별자는 `schemaVersion`/`CHECKPOINT_SCHEMA_VERSION` (checkpoint 버전 관리) 와 `error-codes.md §3` 의 invitation 에러코드 행(기존 코드 소급 등재) 두 가지다. `schemaVersion`/`CHECKPOINT_SCHEMA_VERSION` 은 execution-engine 모듈 내부에만 국한되어 다른 도메인과 충돌이 없다. invitation 에러코드 등재는 기존 발행 중인 코드를 레지스트리에 올린 것으로 새 의미 충돌이 없다. 단, `forbidden`/`rate_limited` (lowercase) 를 글로벌 레지스트리에 등재하면서 시스템 전역 default code `FORBIDDEN`/`RATE_LIMITED` (UPPER_SNAKE_CASE) 와 레지스트리 내 공존하게 되는데, entry 내 명시적 구분 문구가 이미 포함되어 CRITICAL 충돌은 아니나 대소문자 혼동 가능성이 있어 WARNING 으로 분류한다.

## 위험도

LOW
