# User Guide Sync Review — `16_21_03`

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 21건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (L127~L206) 을 SSOT 로 적재.

## 변경 파일 (changeset, 24개 — orchestrator 목록 + `git status`/`git log` 로 재확인)

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — **working tree 미커밋**. `deepRedactCore` 의 깊이 경계 비교 `depth >= MAX_REDACT_DEPTH` → `depth > MAX_REDACT_DEPTH` 로 1칸 정정 (off-by-one 수정)
- `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` — 깊이 경계 테스트 7종 + 뮤테이션 방어 (이미 `f29a21ac1`/`a1be4c97a` 커밋)
- `plan/complete/masked-marker-shared-package.md` · `plan/complete/mirror-guard-single-copy.md` — 신규 (in-progress → complete 이동)
- `plan/in-progress/masked-marker-shared-package.md` · `plan/in-progress/mirror-guard-single-copy.md` — 삭제 (위 이동의 짝)
- `review/code/2026/08/22/16_07_45/*` (11개), `review/consistency/2026/08/22/15_35_56/*` (8개) — 이전 라운드 리뷰/consistency 산출물

## 매트릭스 매칭 분석

21개 trigger 행을 전수 대조:

- **new-node / node-schema-change** — `codebase/backend/src/nodes/**` glob. 변경 경로는 `codebase/backend/src/shared/utils/` 로 미매칭.
- **new-ui-string / new-widget-chrome-string** — frontend/channel-web-chat `*.tsx` glob. 이번 changeset 에 TSX 변경 없음.
- **integration-provider-change** — semantic, provider 관련 변경 없음.
- **new-userguide-section-dir** — `content/docs/*/` glob. 미매칭.
- **backend-api-change** — controller/DTO glob. 미매칭.
- **new-bullmq-queue** — `system-status.constants.ts` glob. 미매칭.
- **new-warning-code / new-error-code** — `error-codes.ts` glob 또는 warningRules semantic. `sanitize-error-message.ts` 는 warningRules 도 `ErrorCode` enum 도 아니며, 순수 redaction 유틸(비밀 마스킹 깊이 경계)이라 미매칭.
- **new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field** — semantic, 해당 없음.
- **auth-session-flow-change** — `modules/auth/**` glob. 미매칭.
- **auth-config-type-enum-change** — semantic, 해당 없음.
- **expression-language-change** — `packages/expression-engine/**` glob. 미매칭.
- **run-debug-flow-change** — semantic("실행·디버깅 흐름 변경"). 검토 필요 — 아래 상세.
- **env-runtime-change / spec-major-change / userguide-gui-flow-section / spec-defect-found** — 해당 없음 (README·spec·docs 파일 변경 전무).

### run-debug-flow-change 상세 검토

`deepRedactSecrets`/`sanitizeLastErrorMessage` 는 실행 실패 시 `lastErrorMessage` 등 debug 표면에 노출되는 값을 마스킹하는 내부 유틸이라 "실행·디버깅 흐름"과 이름상 인접하다. 그러나 이번 변경의 실질은:

- **비교 연산자 하나** (`>=` → `>`) — 깊이 상한 지점의 서브트리가 마스킹되는 경계를 정확히 한 칸 조정하는 off-by-one 수정. 사용자가 관찰 가능한 정상 케이스(중첩 10단 미만) 는 동작 무변화.
- 사용자 가시 영향은 오직 **깊이 10~11 사이의 극단적으로 중첩된 페이로드**의 마스킹 여부뿐이며, 이는 05-run-and-debug 가이드가 서술하는 "실행 결과 보는 법·재실행·로그 필터" 같은 사용자 흐름과 무관한 내부 방어 경계다.
- plan(`plan/complete/masked-marker-shared-package.md`) 본문도 이 항목을 "동작 무변경(behavior-neutral)" 추출/방어 강화로 명시하고 있고, 유저 가이드 갱신 항목은 등장하지 않는다.

즉 **런타임 동작·UI 흐름의 실질 변경이 아니라 내부 보안 경계 하드닝**으로 판단해 `run-debug-flow-change` 미매칭.

## i18n / backend-labels / locale 관련 점검

- `codebase/frontend/src/lib/i18n/dict/**`, `backend-labels.ts`, `codebase/frontend/src/lib/docs/locale.ts` 어느 것도 changeset 에 없음 — 애초에 frontend 파일이 changeset 에 하나도 없다.
- plan 이동·review 산출물은 문서/코드 자체가 아니라 워크플로 부산물이라 매트릭스 대상 아님.

## 발견사항

없음.

## 요약

매트릭스 21개 trigger 행 중 이번 changeset(backend redaction 유틸의 깊이 경계 off-by-one 수정 + 테스트 + plan 이동/review 산출물, 총 24파일)에 매칭되는 행은 0건. 전부 backend 내부 방어 로직·테스트·plan 위생 변경이며 노드/스키마/UI 문자열/통합/섹션 디렉토리/인증/표현식/실행-디버깅 흐름 어느 trigger 도 실질적으로 건드리지 않아 동반 갱신 누락은 없다.

## 위험도
NONE
