# 요구사항(Requirement) Review — 슬러그 라우팅 하드닝 B (PR #865 후속)

## 검증 방법
- 18개 변경 파일의 diff·전체 컨텍스트 정독.
- `plan/complete/workspace-slug-routing.md`(PR #865 round3/4 defer 근거) 대조 — B-1~B-4 가 실제로 그 defer 항목과 일치하는지 확인.
- `git grep` 으로 (a) 남은 raw `/workflows/${...}/executions` 리터럴 0건, (b) `buildExecutionHref` 호출 15곳(커밋 메시지 claim 과 정확히 일치), (c) `buildWorkspaceHref` 잔존 호출에 executions 경로 없음을 확인.
- 관련 unit 테스트 실행: `href.test.ts`/`safe-path.test.ts`/`no-raw-execution-href.test.ts`(34/34 pass), `error-page.test.tsx`/`rerun-modal.test.tsx`/`trigger-history-dialog.test.tsx`/`execution-history-panel.test.tsx`(55/55 pass), `workflows-page.test.tsx`/`execution-detail-page.test.tsx`/`execution-list-page.test.tsx`/`execution-detail-waiting.test.tsx`(53/53 pass). 전부 통과.
- 변경 파일 대상 `eslint` 실행 — 에러 0.
- 관련 spec 본문 대조: `spec/2-navigation/14-execution-history.md`, `spec/5-system/13-replay-rerun.md §10.2/§10.14`.

## 발견사항

- **[INFO]** `buildExecutionHref` 는 `workflowId` 빈 문자열을 방어하지 않음
  - 위치: `codebase/frontend/src/lib/workspace/href.ts:31-38` (`buildExecutionHref`)
  - 상세: `workflowId` 가 빈 문자열이면 `` `/workflows//executions` `` 형태로 이중 슬래시가 생성된다. 다만 모든 호출부(`dashboard/page.tsx`, `executions/page.tsx`, `execution-detail page`, `rerun-modal.tsx`, `trigger-history-dialog.tsx`, `execution-history-panel.tsx`, `run-results-drawer.tsx`)는 API 응답의 `workflowId`/route param 을 그대로 넘기며 빈 문자열이 실제로 발생할 경로가 없다(모두 필수 필드거나 `workflowId &&` 가드 뒤에서 호출).
  - 제안: 실질적 위험 없음 — fix 불필요. 향후 신규 호출부 추가 시 참고.

- **[INFO]** 코드 주석의 "16 importer 무변경" 수치가 실측(15)과 1 차이
  - 위치: `codebase/frontend/src/lib/stores/workspace-store.ts:5`, `plan/in-progress/slug-routing-hardening.md` B-4 항목
  - 상세: `grep`으로 `WorkspaceSummary`/`WorkspaceRole` 를 `@/lib/stores/workspace-store` 에서 import 하는 파일은 15개(주석·plan 은 16개로 서술). `resolve-fallback.ts` 가 이번 변경으로 store 대신 `lib/workspace/types` 를 직접 import 하게 됐으므로 "16" 은 변경 **이전** 기준 수치로 보이며 문서 표현이 근소하게 부정확하다.
  - 상세: 기능에는 영향 없음(re-export 로 하위호환 정상 동작, 실제 15개 소비처 무변경 확인 — grep·unit test 모두 통과).
  - 제안: 코드 fix 불요. plan 문서 수치 정정은 선택.

- **[INFO]** `plan/in-progress/slug-routing-hardening.md` 의 "TEST WORKFLOW" 체크박스 미완료 상태로 리뷰 요청
  - 위치: `plan/in-progress/slug-routing-hardening.md:29`
  - 상세: B-1~B-4 는 체크됐고 TEST WORKFLOW(lint·unit·build·e2e)는 미체크. 리뷰 시점에 lint/unit 은 본 리뷰어가 직접 재현해 통과 확인했으나, plan 상 공식 TEST WORKFLOW 완료 표시는 아직이다. 정상적인 진행 중 상태(허위 체크 아님).
  - 제안: 조치 불요 — 개발자가 이어서 TEST WORKFLOW/REVIEW WORKFLOW 를 완료하면 됨.

## 긍정 확인 사항 (요구사항 충족 근거)

- **기능 완전성**: 커밋이 주장한 "실행경로 리터럴 15곳 통합"이 grep 으로 정확히 15건 확인됨. `buildWorkspaceHref` 의 executions 관련 잔존 호출 0건 — 전환 누락 없음.
- **회귀 수정 검증**: 커밋이 주장한 "3곳 slug 누락 latent broken-link"(dashboard row-click, executions row-click, execution-detail prev/next)가 diff 상 실제로 이전엔 `buildWorkspaceHref`/slug 없이 raw 템플릿 리터럴이었음을 확인 — 주장과 diff 가 line-level 로 일치.
- **회귀 가드**: `no-raw-execution-href.test.ts` 가 `__tests__`/`href.ts` 를 정확히 예외 처리하고, 현재 소스에 위반 0건(테스트 통과) — 향후 재발 방지 유효.
- **에러/엣지 케이스**: `adjacentQuery.data?.prev/next`, `execution.reRunOf != null`, `workflowId ?`, `workflowId &&` 등 기존 null/undefined 가드가 `buildExecutionHref` 전환 후에도 그대로 유지됨(각 호출부 검증).
- **보안(open-redirect) 대칭화**: `isSafeRedirectPath` 가 새 `isSafeInternalPath` 로 위임되며 기존 `//` 검사보다 엄격해짐(백슬래시·tab/CR/LF 도 차단) — `safe-path.test.ts` 9종 정규화 케이스 + `isSafeInternalPath` 8종 판정 케이스 전부 통과, 기존 `error-page.test.tsx` 의 `isSafeRedirectPath` 계약(`//evil.com`→false, `null`→false 등)도 유지.
- **순환 참조 제거**: `resolve-fallback.ts` 가 이제 `@/lib/workspace/types` 를 직접 import, `workspace-store.ts` 는 재-export 로 하위호환 — 구조적으로 store↔util 순환 제거, 그 외 15개 소비처 무변경 확인.
- **spec fidelity**: `spec/2-navigation/14-execution-history.md` (목록 `/w/<slug>/workflows/:id/executions`, 상세 `.../:executionId`, "행 클릭 → 상세로 이동")와 `spec/5-system/13-replay-rerun.md §10.14`("재실행 성공 시 `/w/<slug>/workflows/:workflowId/executions/:newId` 로 라우팅")가 `buildExecutionHref` 의 반환값·호출 패턴과 line-level 로 정확히 일치. spec 위반·drift 없음.
- **TODO/FIXME**: 신규/변경 파일 전체에 TODO/FIXME/HACK/XXX 없음.
- **테스트**: 신규·변경 파일 대상 관련 unit 142건 전부 통과, 대상 파일 eslint 에러 0.

## 요약

`slug-routing-hardening` B 커밋(PR #865 round3/4 defer 항목 B-1~B-4)은 실행 경로 헬퍼(`buildExecutionHref`) 도입으로 흩어진 15개 리터럴을 통합하면서 실제로 존재하던 3건의 slug-누락 latent broken-link 를 정확히 짚어 수정했고, open-redirect 방어를 `safe-path.ts` 공용 모듈로 대칭화·강화했으며, `workspace-store`↔`resolve-fallback` 순환 참조를 타입 분리로 구조적으로 제거했다. spec(`14-execution-history.md`, `13-replay-rerun.md`)의 URL 패턴·행위 명세와 구현이 line-level 로 정확히 일치하고, 신규 가드 테스트(`no-raw-execution-href.test.ts`)가 회귀 재발을 CI 레벨에서 차단한다. 관련 unit 테스트 142건 전부 통과, eslint 에러 0. CRITICAL/WARNING 급 결함은 발견되지 않았으며, 발견된 INFO 3건은 모두 실질적 위험이 없는 사소한 문서/방어 여백 수준이다.

## 위험도

NONE
