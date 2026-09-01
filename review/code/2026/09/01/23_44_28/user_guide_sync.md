# 유저 가이드 동반 갱신(User Guide Sync) 코드 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(127~198행)을 Read 했다.

## 변경 파일 컨텍스트

`git diff origin/main...HEAD --stat` 로 이 changeset(125개 파일)을 실측했다. 구성:

- **harness 위생 4파일**: `.claude/docs/plan-lifecycle.md`, `.claude/hooks/_lib/plan_guard.py`, `.claude/tests/test_plan_guard.py`, `codebase/frontend/src/lib/docs/__tests__/{spec-links,stray-tool-tags}.test.ts` + `tree-walk.ts`
- **`codebase/backend/src/nodes/core/error-codes.ts`** — 1파일, JSDoc 주석만 6줄 추가/2줄 삭제 (enum 멤버 변경 없음, 실측 확인)
- **`spec/conventions/error-codes.md`** — 1파일, 컨벤션 본문 명문화(12줄)
- **`plan/**`** 9파일 — 체크리스트/트래커 갱신
- **`review/code/**`, `review/consistency/**`** 110파일 — 이전 리뷰 라운드/consistency 세션의 자동 산출물

`codebase/frontend/src/content/docs/**`, `codebase/frontend/src/lib/i18n/**`(dict, backend-labels.ts), `codebase/backend/src/nodes/<cat>/<name>/`(신규 노드 디렉토리), `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**` — 이 changeset 어디에도 없음.

## trigger 매칭

- **`new-error-code`** (glob: `codebase/backend/src/nodes/core/error-codes.ts`) — **파일 경로만으로는 매칭된다.** 그러나 `git diff origin/main...HEAD -- codebase/backend/src/nodes/core/error-codes.ts` 로 diff 내용을 직접 확인한 결과, 변경은 파일 최상단 JSDoc 주석 6줄 추가뿐이다(`ErrorCode` 가 노드뿐 아니라 엔진도 일부 발행한다는 설명 + `EngineErrorCode` 와의 비대칭 경계를 명문화하고 `spec/conventions/error-codes.md` §Overview 를 가리킴). **`ErrorCode` enum 의 멤버 추가/삭제/변경은 0건**이다. `spec/conventions/error-codes.md` diff 도 동일 성격 — "대표 surface" → "대표 surface 중 하나"로 문구를 정정하고 `ErrorCode`/`EngineErrorCode` 두 surface 병기를 설명하는 문단 추가일 뿐, 새 에러 코드 문자열은 도입하지 않는다.
  PROJECT.md 원문의 trigger 조건은 "`ErrorCode` enum **추가**" 로 명시돼 있어(144행), 이 행의 JSON glob(파일 경로 전체)은 PROJECT.md 의 의미 조건보다 넓다 — **glob 이 파일 단위라 diff 내용을 구분 못 하는 false-positive 매칭**이다. `backend-labels.ts` 의 `ERROR_KO` 동반 갱신은 "errorCode 추가 시"에만 요구되므로, 이번 changeset 에는 적용되지 않는다.
- 나머지 19개 행(`new-node`, `node-schema-change`, `new-ui-string`, `new-widget-chrome-string`, `integration-provider-change`, `new-userguide-section-dir`, `backend-api-change`, `new-bullmq-queue`, `new-warning-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field`, `auth-session-flow-change`, `auth-config-type-enum-change`, `expression-language-change`, `run-debug-flow-change`, `env-runtime-change`, `spec-major-change`, `userguide-gui-flow-section`) — glob/semantic 어느 쪽으로도 매칭 대상 파일 없음. `spec-major-change` 행(`spec/conventions/**` glob)만 `spec/conventions/error-codes.md` 에 형식상 매칭되나, 그 행의 target 은 frontmatter `code:`/`status:`/`pending_plans:` 정합이며 본 파일은 컨벤션 본문 자체의 명문화(작은 문구 정정)로 frontmatter 변경이 없어 이 changeset 범위 밖(별도 리뷰어 소관 — `documentation`/`requirement` 관점).

## 발견사항

- **[INFO]** `error-codes.ts` 변경이 `new-error-code` trigger 의 glob 과 파일 경로 단위로 일치하지만, 실제 diff 는 enum 멤버가 아닌 JSDoc 주석뿐이라 매트릭스의 의미 조건("ErrorCode enum 추가")을 충족하지 않는 회색 지대
  - 변경 파일: `codebase/backend/src/nodes/core/error-codes.ts`
  - 매트릭스 항목: `new-error-code` — PROJECT.md 144행 "신규 errorCode 발행 (`codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 추가) | 현재 `backend-labels.ts` 에 `ERROR_KO` 매핑 테이블이 없어 영문 message 가 그대로 노출됨. 후속 plan 에서 `ERROR_KO` 신설 검토 — 그 전까지는 errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시"
  - 누락된 동반 갱신: 없음 — enum 멤버 추가가 아니므로 `ERROR_KO` 매핑도, PR 본문 명시 의무도 발생하지 않는다
  - 상세: `.claude/config/doc-sync-matrix.json` 의 이 행은 `match: "glob"` 이라 파일 경로 전체를 대상으로 하는데, PROJECT.md 원문 조건은 "enum 추가" 로 더 좁다. 이 changeset 은 그 간극이 실제로 벌어진 사례 — glob 매칭은 되지만 target 이 요구하는 조건(신규 코드 문자열 발행)은 없다. 사용자 영향 없음(신규 에러 코드가 없으므로 영문 노출 리스크도 없음).
  - 제안: 조치 불요 — 관측 기록 목적. 향후 이 changeset 에 실제 `ErrorCode`/`EngineErrorCode` 멤버 추가가 섞이면 그때 `backend-labels.ts` `ERROR_KO` 갱신 여부를 재검토할 것.

이 외 CRITICAL/WARNING 없음 — i18n dict, `backend-labels.ts`, docs MDX, `locale.ts`, 노드 디렉토리, auth 모듈, expression-engine 어느 것도 이 changeset 에 없어 해당 trigger들의 동반 갱신 누락 여부 자체가 성립하지 않는다.

## 요약

매트릭스 20개 trigger 중 파일 경로 기준으로 매칭된 것은 `new-error-code`(glob) 1건뿐이며, 실제 diff 를 대조한 결과 enum 멤버 변경이 없어 semantic 조건 미충족 — false-positive 근접 사례로 INFO 1건만 기록했다. 이 changeset(125파일)은 harness 위생(plan_guard.py 체크박스 정규식 확장, docs 테스트 보강)·plan 트래커 갱신·이전 리뷰/consistency 세션 산출물·`error-codes.ts` 및 `spec/conventions/error-codes.md` 의 순수 문서 명문화로 구성돼 있어, 유저 가이드 동반 갱신(노드/docs MDX/i18n dict/backend-labels/locale) 대상 파일이 전혀 없다. 누락 CRITICAL 0건, WARNING 0건.

## 위험도

NONE
