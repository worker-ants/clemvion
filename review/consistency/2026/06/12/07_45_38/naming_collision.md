# 신규 식별자 충돌 검토 결과

검토 범위: `spec/4-nodes/4-integration/` (diff-base: origin/main)
검토 일시: 2026-06-12

---

## 발견사항

### INFO — `DB_HOST_BLOCKED` 신규 에러 코드: 충돌 없음, 기존 패턴과 일치

- **target 신규 식별자**: `DB_HOST_BLOCKED` (`spec/4-nodes/4-integration/2-database-query.md` §4 SSRF 가드 callout·§5.3 필드표·§6.2 에러 코드표·Rationale 섹션)
- **기존 사용처**:
  - `codebase/backend/src/nodes/core/error-codes.ts` — `DB_QUERY_FAILED` / `DB_CONNECTION_ERROR` / `DB_CONSTRAINT_VIOLATION` / `DB_PERMISSION_DENIED` 가 `DB_` prefix 로 기존 점유 중이나, `DB_HOST_BLOCKED` 는 존재하지 않았음(main 브랜치 기준). 동 파일에 `HTTP_BLOCKED` / `EMAIL_HOST_BLOCKED` 가 각각 HTTP·Email 도메인 SSRF 차단 코드로 존재
  - `spec/conventions/chat-channel-adapter.md` line 388 — `DB_*` 와일드카드로 `executionFailedInternal` 분류 매핑 중. `DB_HOST_BLOCKED` 는 이 패턴에 포함됨
  - `spec/5-system/3-error-handling.md` line 80 / line 223 — Database 에러 코드 목록이 worktree 에서 이미 `DB_HOST_BLOCKED` 추가 반영됨
  - `spec/2-navigation/4-integration.md` line 1083 — 동 worktree 파일에 `DB_HOST_BLOCKED` 행이 신규 추가됨
  - `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` line 63 — `INTERNAL_CODES` Set 에 `'DB_HOST_BLOCKED'` 등재됨
- **상세**: `DB_HOST_BLOCKED` 는 main 브랜치에 존재하지 않던 신규 식별자로, 기존의 다른 의미로 사용된 충돌 사례가 없다. `HTTP_BLOCKED`(HTTP 노드)·`EMAIL_HOST_BLOCKED`(Email 노드)와 동형 패턴을 따르며, `DB_` prefix 를 이미 점유 중인 네 코드와의 의미·맥락 중복도 없다. 코드·spec·classifier 세 곳 모두 동시 추가돼 일관성을 유지한다.
- **제안**: 현 상태 유지. 충돌 없음.

---

### INFO — `integration:cache:invalidate` Redis pub/sub 채널: 충돌 없음, 기존 정의와 일치

- **target 신규 식별자**: Redis pub/sub 채널명 `integration:cache:invalidate` (`spec/4-nodes/4-integration/2-database-query.md` §4 step 2 멀티 인스턴스 무효화 섹션·Rationale)
- **기존 사용처**:
  - `spec/0-overview.md` line 244 — Redis 구성요소 나열에 이미 `integration:cache:invalidate` 로 등재
  - `spec/5-system/4-execution-engine.md` line 1062 — Redis pub/sub 채널 표에 `integration:cache:invalidate` 로 기존 정의
  - `spec/data-flow/5-integration.md` line 71 — 동 채널 참조
  - `codebase/backend/src/common/redis/integration-cache-bus.service.ts` line 23 / `codebase/backend/test/integration-cache-invalidate.e2e-spec.ts` line 29 — 동일 문자열 상수 사용
- **상세**: target 문서가 새로 이름을 부여한 것이 아니라 기존 채널을 참조하는 구조이며, 이미 모든 문서에서 동일 이름·의미로 사용 중이다. 의미 충돌 없음.
- **제안**: 현 상태 유지. 충돌 없음.

---

### INFO — `POOL_MAX_CONNECTIONS` / `POOL_IDLE_TIMEOUT_MS`: 모듈 내부 상수, 충돌 없음

- **target 신규 식별자**: `POOL_MAX_CONNECTIONS=5`, `POOL_IDLE_TIMEOUT_MS=30000` (`spec/4-nodes/4-integration/2-database-query.md` §4 step 2)
- **기존 사용처**: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` line 64–65 — 동일 이름의 모듈 내 `const` 상수로 이미 정의됨
- **상세**: 이 두 식별자는 환경변수가 아닌 모듈 내부 하드코딩 상수(Node.js `const`)다. spec 이 구현 상수값을 명시한 것이며, 같은 이름을 다른 의미로 쓰는 곳은 없다.
- **제안**: 현 상태 유지. 충돌 없음.

---

### WARNING — `HTTP_TIMEOUT` 코드가 `error-codes.ts` 에 있으나 target HTTP Request 에러 코드표에 미등재

- **target 신규 식별자**: (신규 부여 없음 — 기존 코드의 누락 문제)
- **기존 사용처**: `codebase/backend/src/nodes/core/error-codes.ts` line 13 — `HTTP_TIMEOUT: 'HTTP_TIMEOUT'` 정의. `spec/5-system/3-error-handling.md` line 79/222 — Database 에러 목록에 `HTTP_TIMEOUT` 언급
- **상세**: target 의 `spec/4-nodes/4-integration/1-http-request.md` §6 에러 코드표에 `HTTP_4XX` / `HTTP_5XX` / `HTTP_TRANSPORT_FAILED` / `HTTP_BLOCKED` / `INTEGRATION_*` 는 열거되나, `HTTP_TIMEOUT` 이 표에 없다. `error-codes.ts` 와 `spec/5-system/3-error-handling.md` 는 이 코드를 기존부터 인정하고 있다. 신규 식별자 도입은 아니므로 충돌은 아니지만, 독자가 에러 코드표에서 `HTTP_TIMEOUT` 을 찾을 수 없어 혼동 가능성이 있다.
- **제안**: `spec/4-nodes/4-integration/1-http-request.md` §6 에러 코드표에 `HTTP_TIMEOUT` 행을 추가하거나, `HTTP_TRANSPORT_FAILED` 에 타임아웃 케이스가 포함됨을 주석으로 명시해 일관성을 확보한다.

---

### INFO — `meta.durationMs` 명명 통일: 신규 필드명 충돌 없음

- **target 신규 식별자**: `meta.durationMs` 로 통일 (기존 `meta.duration` 폐지 선언, `spec/4-nodes/4-integration/0-common.md` §6.1)
- **기존 사용처**: `meta.durationMs` 는 `spec/5-system/` 문서군에서 기존부터 사용. `meta.duration` 은 codebase 내 `.handler.ts` 파일에서 검색되지 않으며, 이미 `durationMs` 로 통일돼 있다.
- **상세**: target 이 `meta.durationMs` 를 새로 정의하는 것이 아니라 기존 명명과 통일 선언을 하는 것이므로 충돌 없음.
- **제안**: 현 상태 유지.

---

## 요약

target 문서(`spec/4-nodes/4-integration/`) 가 도입하는 실질적 신규 식별자는 `DB_HOST_BLOCKED` 하나다. 이 코드는 main 브랜치에 없던 신규 값으로, 기존에 다른 의미로 사용된 사례가 없고 `HTTP_BLOCKED` / `EMAIL_HOST_BLOCKED` 와 동형 패턴을 따른다. `error-codes.ts`·spec 3개 파일·`execution-failure-classifier.ts` 에 일관되게 추가됐으며, `chat-channel-adapter §3.1` 의 `DB_*` 와일드카드 매핑에 자동 포함된다. 그 외 `integration:cache:invalidate` 채널명과 `POOL_*` 상수는 기존 정의의 참조 또는 재확인이다. 유일한 주의 사항은 `HTTP_TIMEOUT` 이 `error-codes.ts` / `3-error-handling.md` 에 등재돼 있음에도 `1-http-request.md` §6 에러 코드표에 누락된 기존 불일치로, 신규 도입 충돌은 아니다.

## 위험도

LOW
