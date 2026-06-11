# 유저 가이드 동반 갱신(User Guide Sync) Review

## 매트릭스 적재 결과

`/Volumes/project/private/clemvion/.claude/config/doc-sync-matrix.json` 로드 완료. 총 18 rows. 이하 분석에서 적용 가능한 trigger 를 순서대로 점검.

## 변경 파일 식별

`git diff origin/main...HEAD --name-only` 기준 본 PR(errcode-wiring) 의 실제 변경 파일:

- `codebase/backend/src/nodes/core/error-codes.ts`
- `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts`
- `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts`
- `codebase/backend/src/nodes/data/code/code.handler.ts`
- `codebase/backend/src/nodes/data/code/code.handler.spec.ts`
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`
- `plan/in-progress/code-node-isolated-vm-followups.md`
- `plan/in-progress/http-ssrf-all-auth-followups.md`
- `review/code/2026/06/12/00_21_47/` (review artifact — 매트릭스 대상 아님)

## 발견사항

해당 없음.

### 상세 분석

**trigger `new-error-code` (id) — `codebase/backend/src/nodes/core/error-codes.ts` glob 매치**

diff 내용: `HTTP_BLOCKED` 항목에 주석 2줄(opt-out env 명시·`http-safety.ts` SoT 참조)을 추가했을 뿐, `ErrorCode` enum 에 **새로운 값은 추가되지 않았다**. `HTTP_BLOCKED` 자체는 선행 PR `a1ad25f6`(refactor 04 C-3, #549)에서 이미 등재됐으며, 해당 PR 에서 `codebase/frontend/src/lib/i18n/backend-labels.ts` `ERROR_KO` 에도 한국어 매핑이 동반 추가됐다(파일 직접 확인). `CODE_MEMORY_LIMIT` 도 선행 PR `761583a8`(isolated-vm, #546)에서 enum + ko 매핑이 함께 추가됐다.

따라서 본 PR 에서 `new-error-code` trigger 의 "사용자 가시 ko 노출을 PR 본문에 명시" 의무가 적용되는 신규 ErrorCode 는 없다.

**trigger `new-node` / `node-schema-change` — `codebase/backend/src/nodes/**` glob 매치**

`error-codes.ts`, `code.handler.ts`, `http-request.handler.ts` 가 glob 에 매치된다. 그러나 변경 내용은:
- `error-codes.ts`: 기존 값 주석 보강 (enum 값 추가 없음)
- `code.handler.ts`: 함수 rename(`classifyError` → `classifyCodeNodeError`), 상수 선언 위치 이동, 타입 강화 — 노드 스키마(필드·라벨·타입) 변경 없음
- `http-request.handler.ts`: string literal → `ErrorCode.HTTP_BLOCKED` 상수 참조로 교체 — 동일 값, 노드 스키마 변경 없음

위 변경들은 노드 신규 추가 또는 노드 schema(필드·라벨·타입) 변경에 해당하지 않는다. 내부 구현 리팩터(명명 정리, 상수 참조화, 타입 강화)이므로 docs MDX·i18n dict 동반 갱신 의무가 발생하지 않는다.

**trigger `run-debug-flow-change` (semantic) — execution-failure-classifier.ts 변경**

`INTERNAL_CODES` Set 에 `CODE_MEMORY_LIMIT`/`HTTP_BLOCKED` 를 등재해 unknown-fallback 경로를 제거했다. 사용자 대면 분류 결과(`executionFailedInternal`)는 변경 없으며, 제거된 것은 서버 측 warn 로그(CCH-ERR-04)뿐이다. 실행·디버깅 사용자 흐름에는 변화가 없으므로 `05-run-and-debug/` 동반 갱신 의무가 없다.

**기타 trigger 점검**

- `new-ui-string`: 변경 파일에 TSX 없음 → 해당 없음
- `integration-provider-change`: 신규/변경 provider 없음 → 해당 없음
- `new-userguide-section-dir`: docs 디렉토리 신설 없음 → 해당 없음
- `auth-session-flow-change`: `codebase/backend/src/modules/auth/**` 변경 없음 → 해당 없음
- `expression-language-change`: expression-engine 변경 없음 → 해당 없음
- `new-warning-code`: backend warningRules 변경 없음 → 해당 없음
- `new-backend-ui-zod-value`: ui.label/hint/group 신규값 없음 → 해당 없음

## 요약

매트릭스 18개 trigger 전체 점검. `codebase/backend/src/nodes/**` glob(new-node, node-schema-change)과 `error-codes.ts` glob(new-error-code)이 매치됐으나, 본 PR 의 변경은 신규 ErrorCode 추가 없는 주석 보강, 함수 rename, 상수 참조화, 기존 classifier Set 보완에 국한된다. 양쪽 신규 에러코드(`CODE_MEMORY_LIMIT`, `HTTP_BLOCKED`)의 `ERROR_KO` 한국어 매핑은 각각 선행 PR(isolated-vm #546, http-ssrf #549)에서 이미 완료됐으며 현재 `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/backend-labels.ts` 에 존재한다. 동반 갱신 누락 0건.

## 위험도

NONE
