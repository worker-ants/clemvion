# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
대상 범위: `spec/5-system/` diff vs `origin/main`
이번 PR 범위: A2a (`_resumeCheckpoint schemaVersion` + 재구성 견고화) + consistency 동기화 커밋 2건

---

## 신규 식별자 목록 (이번 diff)

| 식별자 | 위치 | 종류 |
|--------|------|------|
| `CHECKPOINT_SCHEMA_VERSION` | `execution-engine.service.ts:267`, `spec/5-system/4-execution-engine.md §1.3` | 모듈-레벨 상수 / spec 문서 참조 |
| `schemaVersion` | `_resumeCheckpoint` JSONB 필드 — `buildResumeCheckpoint`, `spec/5-system/4-execution-engine.md §1.3·§7.5`, `spec/conventions/node-output.md`, `spec/4-nodes/3-ai/1-ai-agent.md §12`, `spec/5-system/6-websocket-protocol.md §4.3` | JSONB 페이로드 필드 / spec 명시 |
| `invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` · `forbidden` · `rate_limited` | `spec/conventions/error-codes.md §3 historical-artifact 레지스트리` (신규 행) + `spec/5-system/1-auth.md §1.5.4` (참조 주석 신규 추가) | 에러 코드 (lower_snake_case, historical-artifact) |

> 참고: `RESUME_INCOMPATIBLE_STATE` / `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `conversationThread` / `conversation_thread` / `buildRetryReentryState` / `buildResumeCheckpoint` 는 `origin/main` 에 이미 존재하는 식별자이므로 충돌 검토 대상이 아님.

---

## 발견사항

### [INFO] `forbidden` · `rate_limited` (lower_snake_case) 와 `FORBIDDEN` · `RATE_LIMITED` (UPPER_SNAKE_CASE) 의 공존

- target 신규 식별자: `forbidden` · `rate_limited` — `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 신규 등재된 초대 흐름 에러 코드
- 기존 사용처: `FORBIDDEN` — `spec/5-system/3-error-handling.md §1.3 L37`, `spec/5-system/2-api-convention.md §5.3 L160`, `codebase/backend/src/common/filters/http-exception.filter.ts L95`, `ws-error-codes.ts L15`, 다수 service 파일. `RATE_LIMITED` — `spec/5-system/3-error-handling.md §1.3 L28`, `main.ts L89`
- 상세: 두 코드는 **casing 이 다른 별개 문자열** (`forbidden` vs `FORBIDDEN`, `rate_limited` vs `RATE_LIMITED`)이며 서로 다른 발행 주체(초대 흐름 서비스 vs 시스템 전역 HTTP exception filter / 권한 guard)에서 나온다. 의미적으로는 유사하나 API 표면이 다르므로 런타임 충돌은 없다. historical-artifact 레지스트리 등재 자체가 "이 코드들은 `UPPER_SNAKE_CASE` 를 따르지 않는다"는 사실을 명시적으로 문서화하는 목적이다. 레지스트리 항목에 "신규 코드는 본 예외를 선례로 삼지 않는다" 라는 제약이 명기되어 있다.
- 제안: 충돌 없음. 단, 미래에 초대 흐름 에러 코드를 시스템 전역 `FORBIDDEN` / `RATE_LIMITED` 와 통합(alias 제공 등)할 경우 클라이언트(`INVITATION_ERROR_CODES`) 영향 범위를 분리해서 검토할 것 — 현재는 조치 불필요.

---

## 충돌 없음 확인 항목

**`CHECKPOINT_SCHEMA_VERSION` 충돌 검토**
- `codebase/backend/src/**/*.ts` 전체에서 `CHECKPOINT_SCHEMA_VERSION` 또는 `SCHEMA_VERSION` 계열 상수가 이 파일(`execution-engine.service.ts`) 이외에 정의된 곳 없음 (검색 결과 0건).
- `spec/` 전체에서도 이번 diff 추가분(`4-execution-engine.md`) 이외에 해당 이름 없음.

**`schemaVersion` JSONB 필드 충돌 검토**
- `codebase/backend/src/**/*.ts` 전체 및 `codebase/frontend/src/**/*.{ts,tsx}` 전체에서 `schemaVersion` 은 `execution-engine.service.ts` 와 동 `.spec.ts` 이외에 사용되지 않음 (0건).
- `spec/` 에서도 이번 diff 추가분 4개 파일이 유일. 유사 명칭(`schema_version`, `SCHEMA_VER`)도 동 모듈 내에서만 존재.
- 다른 버전 상수(`MCP_CLIENT_VERSION`, `VERSION = 0x01` in credentials-transformer)는 독립 도메인(MCP 프로토콜 버전, 암호화 포맷 버전)이며 `_resumeCheckpoint` 직렬화 버전과 의미 겹침 없음.

**초대 에러 코드 충돌 검토**
- `invitation_not_found` / `invitation_expired` / `invitation_already_used` / `invitation_email_mismatch` 는 코드베이스 전체에서 초대 흐름(`workspace-invitations.service.ts`, `auth.service.ts`, `invitations.controller.spec.ts`)에서만 발행되며 다른 도메인에서 동일 문자열로 다른 의미로 쓰이는 곳 없음.
- `forbidden` (lowercase) 는 초대 서비스에서만 발행되며 시스템 전역 `FORBIDDEN` (uppercase) 와 동일 문자열 아님 — API 계약상 다른 코드 값.
- `rate_limited` (lowercase) 도 동일 — 시스템 전역 `RATE_LIMITED` (uppercase) 와 구별.

**파일 경로 충돌**
- 이번 diff 에서 신규 spec 파일 추가 없음. 기존 파일 인라인 수정만.

**API endpoint · 이벤트명 · 환경변수**
- 신규 endpoint, webhook/SSE 이벤트명, ENV var, 설정 키 추가 없음.

---

## 요약

이번 diff 가 도입하는 신규 식별자는 `CHECKPOINT_SCHEMA_VERSION`(상수), `schemaVersion`(JSONB 필드), 그리고 `error-codes.md §3` 레지스트리에 등재된 초대 흐름 에러 코드 6종이다. `CHECKPOINT_SCHEMA_VERSION` 과 `schemaVersion` 은 `execution-engine.service.ts` 및 관련 spec 문서 4곳에만 존재하며 코드베이스·spec 전체에 동일 이름으로 다른 의미를 부여한 선행 정의가 없다. 초대 에러 코드(`forbidden`, `rate_limited` 등 lower_snake_case) 는 시스템 전역 UPPER_SNAKE_CASE 코드(`FORBIDDEN`, `RATE_LIMITED`)와 casing 이 달라 런타임 혼용 위험이 없고, historical-artifact 레지스트리 등재 목적 자체가 이 차이를 명시적으로 문서화하는 것이다. 신규 식별자 충돌 관점에서 조치가 필요한 항목은 없다.

---

## 위험도

NONE

STATUS: OK
