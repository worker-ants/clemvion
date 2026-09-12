# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(155~224행)을 Read 함.

## 변경 파일
- `CHANGELOG.md`
- `codebase/backend/src/modules/auth/login-history.service.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (+ `.spec.ts`)
- `plan/in-progress/keyset-cursor-uuid-validation.md`
- `plan/in-progress/spec-draft-nullable-notation-followups.md`

## 매칭 검토

### 1) `auth/login-history.service.ts` → `auth-session-flow-change` 후보 (glob `codebase/backend/src/modules/auth/**`, match=semantic)
경로만 보면 매트릭스 trigger 글롭에 걸린다. 그러나 실제 diff 는 `decodeCursor` 의 keyset 커서 **`id` 성분**에
`isUuidShaped` 검증을 추가한 것뿐이다 — Postgres 가 `uuid` 컬럼에 파싱 불가 값을 바인딩받아 22P02 로
거부하던 것을 500 대신 "손상된 커서로 취급해 무시하고 1페이지" 로 처분한다(CHANGELOG 3~27행). **정상
로그인/세션/권한 흐름은 무변이다** — 로그인·2FA·세션 발급/검증 로직을 건드리지 않는다. 순수 pagination
edge-case 견고성 수정.
`codebase/frontend/src/content/docs/07-workspace-and-team/` 전체를 grep 했으나 "로그인 기록(login
history)" 열람 UI 를 설명하는 페이지가 아예 없다(`system-status.mdx` 의 "login-history-pruner" 는 BullMQ
큐 이름 언급일 뿐 무관). 즉 갱신 대상이 될 기존 문서 자체가 없고, 이 변경이 새로 문서화해야 할 사용자
가시 동작도 만들지 않는다.
→ **판정: 해당 없음(회색 지대, 매칭 기각).** glob 은 맞지만 semantic 축에서 "흐름 변경" 이 아니다.

### 2) `background-runs.service.ts` → `run-debug-flow-change` 후보 (semantic, targets: `05-run-and-debug/`)
`decodeCursor` 의 base64 파싱·JSON 파싱·날짜 파싱은 이미 검증돼 400 `INVALID_CURSOR` 로 떨어지고 있었고,
이번 diff 는 그 중 빠져 있던 **`i`(NodeExecution.id) 성분**에도 같은 `isUuidShaped` 검증을 추가해 같은
기존 400 `INVALID_CURSOR` 분기로 합류시켰을 뿐이다(신규 `code` 아님 — `throw new Error(...)` 가 기존
`catch` 블록의 `code: 'INVALID_CURSOR'` 로 흡수됨. `backend-labels.ts` grep 0건, 애초에 이 code 는 ko
매핑 대상이 아니었고 이번 변경으로도 새 매핑 요구가 생기지 않는다).
`codebase/frontend/src/content/docs/02-nodes/logic.mdx` §Background 가 이 엔드포인트
(`GET /api/executions/{executionId}/background-runs/{backgroundRunId}`)를 이미 언급하지만 "cursor
페이지네이션" 이라는 존재만 서술하고 malformed-cursor 처분까지는 다루지 않는다 — 이번 수정은 그 서술을
반증하지 않는다(정상 발급 커서의 형태·응답 계약은 그대로).
→ **판정: 해당 없음.** 문서가 이미 서술하는 수준(커서 페이지네이션 존재)과 충돌 없음, 새 배선·새 계약
아님.

### 3) 신규 warningCode/errorCode 발행 여부
두 파일 모두 **기존** `INVALID_CURSOR` 코드를 재사용하거나(background-runs), 에러를 발생시키지 않고
null 반환으로 처리한다(login-history — 500→200 이지 새 코드 아님). `ErrorCode` enum
(`codebase/backend/src/nodes/core/error-codes.ts`)도 `warningRules` 도 건드리지 않았다.
→ **판정: 해당 없음.**

### 4) 그 외 trigger (신규 노드/스키마, TSX 신규 문자열, 통합·제공자, 신규 섹션 디렉토리, 표현식 언어)
이번 changeset 에 `codebase/frontend/**` 파일이 전혀 없다 — TSX 신규 문자열도, dict 도, i18n 도 대상
파일 자체가 없다. `codebase/packages/expression-engine/**` 도 무관. `codebase/backend/src/nodes/**` 신규
파일도 없다.
→ **판정: 해당 없음.**

### 5) `plan/in-progress/*.md`, `CHANGELOG.md`
매트릭스 target 목록 어디에도 속하지 않는 작업 추적/릴리스노트 문서이며, 오히려 이번 changeset 이
CHANGELOG 자체를 갱신 대상으로 이미 채운 상태(리뷰 대상 파일 1). 별도 조치 불필요.

## 요약
매트릭스 21행 중 경로 글롭으로 후보에 오른 것은 `auth-session-flow-change`(auth/** 경로) 1행뿐이었고,
semantic 판단으로 `run-debug-flow-change` 도 함께 검토했다. 두 후보 모두 실제 diff 를 대조한 결과
정상 사용자 흐름·기존 문서 서술을 바꾸지 않는 pagination 커서 견고성 버그 수정(500→200/기존 400 코드
재사용)이라 동반 갱신 대상이 아니라고 판정했다. 신규 노드·UI 문자열·제공자·섹션·표현식 언어·warning/error
code 발행에 해당하는 파일은 changeset 에 없다. 누락 0건.

## 위험도
NONE
