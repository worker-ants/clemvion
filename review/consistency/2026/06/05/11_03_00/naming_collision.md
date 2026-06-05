# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
대상 범위: `spec/5-system/` diff vs `origin/main` + 구현 파일 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`

---

## 신규 식별자 목록 (이번 PR — A2a)

| 식별자 | 위치 | 종류 |
|--------|------|------|
| `CHECKPOINT_SCHEMA_VERSION` | `execution-engine.service.ts:267` | 모듈-레벨 상수 |
| `schemaVersion` | `_resumeCheckpoint` JSON 필드 (`buildResumeCheckpoint` L4300) | JSONB 페이로드 필드 |

> 참고: `RESUME_INCOMPATIBLE_STATE` / `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `conversationThread` / `conversation_thread` / `buildRetryReentryState` / `buildResumeCheckpoint` 는 이번 PR 이전(`origin/main`)에 이미 존재하는 식별자이므로 충돌 검토 대상이 아님.

---

## 발견사항

충돌 발견사항 없음.

**`CHECKPOINT_SCHEMA_VERSION` 충돌 검토**
- 전체 `codebase/backend/src/**/*.ts` 에서 `CHECKPOINT_SCHEMA_VERSION` 또는 `SCHEMA_VERSION` 계열 상수가 이 파일 이외에 정의된 곳이 없다 (`grep` 결과 0건).
- `spec/` 전체에서도 이번 diff 추가분 이외에 해당 이름이 없다.

**`schemaVersion` 충돌 검토**
- `codebase/backend/src/**/*.ts` 전체 및 `codebase/frontend/src/**/*.{ts,tsx}` 전체에서 `schemaVersion` 은 `execution-engine.service.ts` 와 동 `.spec.ts` 이외에 사용되지 않는다 (0건).
- `spec/` 에서도 `4-execution-engine.md` 이번 diff 추가분이 유일하다.
- 유사 명칭(`schema_version`, `SCHEMA_VER` 등)도 동 모듈 내에서 발견되지 않는다.

**기존 버전 상수와의 구분**
- 다른 버전 상수(`MCP_CLIENT_VERSION`, `VERSION = 0x01` in `credentials-transformer.ts`)는 각자 독립적인 도메인(MCP 프로토콜 버전, 암호화 포맷 버전)을 나타내며 `_resumeCheckpoint` 직렬화 버전과 의미가 겹치지 않는다.

**파일 경로 충돌**
- 이번 PR 에서 신규 spec 파일이 추가된 것은 없다. 기존 `spec/5-system/4-execution-engine.md` 인라인 수정만 이루어졌다.

**API endpoint · 이벤트명 · 환경변수**
- 신규 endpoint, webhook/SSE 이벤트명, ENV var, 설정 키가 추가된 것이 없다.

---

## 요약

이번 A2a PR 이 도입하는 신규 식별자는 `CHECKPOINT_SCHEMA_VERSION`(상수)과 `schemaVersion`(JSONB 필드) 두 개다. 두 식별자 모두 `execution-engine.service.ts` 내부에서만 사용되며, 코드베이스 전체 및 `spec/` 전체에 동일 이름으로 다른 의미를 부여한 선행 정의가 존재하지 않는다. 유사 명칭과의 의미 혼동 가능성도 없어 신규 식별자 충돌 관점에서 추가 조치가 필요한 사항이 없다.

---

## 위험도

NONE
