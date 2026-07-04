# Plan 정합성 검토 — admission 회귀 보강 (test-only)

## 메타

- **검토 모드**: --impl-done (payload 상 scope=`spec/5-system/`, diff-base=`origin/main`)
- **Payload 상태**: mis-scoped — orchestrator 가 전달한 target 문서(`spec/5-system/1-auth.md` 전문)는 실제 diff 와 무관. 지시에 따라 `git diff origin/main...HEAD` 로 폴백.
- **실제 diff** (커밋 `d60fc16d8 test(06-concurrency): admission gate 회귀 보강 (§8 PR2b)`):
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (unit, +44)
  - `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` (e2e, +37)
  - `review/consistency/2026/07/04/20_09_53/**` — 이 worktree 의 **이전** consistency-check 산출물(현재 실행분과 무관, 커밋에 함께 포함된 과거 리뷰 기록)
- **코드 변경**: 없음 (production 코드 파일 diff 0건). 순수 테스트 추가/파라미터화.

## 대조 대상 plan

`plan/in-progress/exec-intake-followups.md` §"PR2b 후속" 4번째 항목:

> - [ ] **admission 회귀 보강 (ai-review testing INFO)** — deferred/cancelled 시 `releaseExecutionRouting`·`runExecution` 미호출 통합 유닛, workspace-cap 초과 e2e 시나리오, admission raw SQL 파라미터 순서 assert. (원자성·기능은 unit+e2e 로 실증됨 — 회귀 방지 보강 성격.)

## 발견사항

### diff ↔ plan 항목 매핑 (충돌 없음 확인)

diff 가 커버하는 3가지가 plan 항목이 명시한 3가지와 1:1 대응한다.

1. **admission raw SQL 파라미터 순서 assert** → `execution-engine.service.spec.ts` 신규 테스트 `'원자 UPDATE 파라미터 순서·cap 매핑 회귀: [executionId, workspaceId, wsCap, workflowId, wfCap]'` — advisory lock 키(`exec-cap:<workspaceId>`)와 조건부 UPDATE 의 5개 파라미터 위치·cap 교차오염(ws↔wf) 를 고정.
2. **deferred/cancelled 시 releaseExecutionRouting·runExecution 미호출 통합 유닛** → 신규 테스트 3종(`admitted`/`deferred`/`cancelled` 각 분기)이 `runExecutionFromQueue` 의 `admitExecutionOrDefer` 결과별 후속 분기(routing register/release, `runExecution` 호출 여부)를 고정.
3. **workspace-cap 초과 e2e 시나리오** → `execution-concurrency-cap.e2e-spec.ts` 신규 테스트 `'workspace-level cap 초과 → 다른 workflow 실행도 pending → 슬롯 해제 시 admitted'` — 별도 workspace(`createTeamWorkspace`) + workflow A/B 로 workspace-level cap 단독 gating 을 검증. 기존 헬퍼(`createCapWorkflow`, `execute`, `getStatus`, `poll`)를 workspace-scoped 로 파라미터화(`wsId`, `workflowCap: number | null`)해 재사용 — 기존 테스트 2건(workflow-level cap 검증)의 호출부는 기본 인자로 하위호환 유지.

**미해결 결정과의 충돌 없음.** plan 이 "결정 필요"로 남긴 항목은 이 문서에 없다 — "admission 회귀 보강"은 순수 실행 항목(테스트 추가)이며 설계 결정을 요구하지 않는다. diff 는 이미 완료된 PR2b 의 admission gate 구현(advisory lock + 조건부 UPDATE)을 **검증만** 하고, 그 설계를 바꾸거나 새 결정을 끼워넣지 않는다.

**선행 plan 미해소 없음.** 이 항목의 전제("원자성·기능은 unit+e2e 로 실증됨")는 PR2b(#800/#801, 이미 병합)에서 이미 충족되어 있고, 본 diff 는 그 위에 회귀 방지 테스트만 추가한다. 코드 변경이 없으므로 다른 plan 이 가정하는 조건을 흔들지 않는다.

**후속 항목 누락 없음.** 같은 plan 파일의 다른 미해결 항목(workflow-level cap validated write DTO, 곁들임 INFO 리팩터 묶음, orphan pending backstop, auth Critical 2건)은 이 diff 와 무관한 별개 항목이며 diff 로 인해 무효화되거나 새로 파생되지 않는다.

### INFO — plan 체크박스 미갱신 (기록 필요, 병합 차단 아님)

- **위치**: `plan/in-progress/exec-intake-followups.md` L20
- **상세**: diff 가 "admission 회귀 보강" 항목의 3개 서브 항목을 모두 구현했으나 체크박스는 여전히 `[ ]` 로 남아있다. 커밋 메시지(`test(06-concurrency): admission gate 회귀 보강 (§8 PR2b)`)와 diff 내용은 완료를 시사한다.
- **제안**: developer 가 이 diff 를 커밋할 때 plan 체크박스를 `[x]` 로 갱신하고 완료 근거(커밋 해시·테스트 파일)를 짧게 남기는 것을 권장한다. 병합을 막을 사유는 아니다(정합성 위반이 아니라 plan 갱신 누락이므로 INFO).

## 요약

Payload 는 `spec/5-system/` 전문(auth spec)을 target 으로 전달했으나 실제 diff 는 이와 무관한 test-only 변경(admission gate 회귀 테스트 2개 파일)이었다. 지시에 따라 `git diff origin/main...HEAD` 로 폴백해 확인한 결과, diff 는 `plan/in-progress/exec-intake-followups.md` 의 "admission 회귀 보강" 항목이 명시한 3가지 보강(파라미터 순서 assert·admission 결과별 통합 유닛·workspace-cap e2e)을 정확히 구현하며, 프로덕션 코드 변경이 없어 다른 미해결 결정이나 선행 plan 과 충돌할 표면 자체가 없다. 유일한 지적은 plan 체크박스 미갱신(INFO, 비차단)이다.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS
