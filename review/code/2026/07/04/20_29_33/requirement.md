# 요구사항(Requirement) Review — admission gate §8 회귀 테스트 (TEST-ONLY)

## 검토 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
  - 신규 unit 테스트 4건: 원자 UPDATE 파라미터 순서·cap 매핑 회귀, admission `deferred`/`cancelled`/`admitted` 3-way 분기 회귀
- `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts`
  - workspace-level cap 단독 gating e2e 케이스 1건 신규 + helper 파라미터화(`wsId`/`workflowCap`)
- production 코드·spec 변경 없음 (TEST-ONLY, consistency-check `--impl-prep` BLOCK: NO 로 착수 승인됨)

## 검증 방법

- 대상 함수 `admitExecutionOrDefer` / `runExecutionFromQueue` / `markQueueWaitTimeout` 실구현(`execution-engine.service.ts` L2604-2701, L3296-3377, L2558-2601) 을 Read 하여 신규 assertion 이 실제 동작과 line-level 로 일치하는지 대조.
- spec `spec/5-system/4-execution-engine.md` §8 본문(L1071-1090, L1518-1535 Rationale) 대조.
- `npx jest execution-engine.service.spec.ts` 전체 실행(358 passed) — 신규 4건 포함, 기존 테스트와 mock 상태 충돌 없음 확인.
- `npx tsc --noEmit` — e2e 파일 신규 에러 없음. unit spec 파일의 `manager.transaction` 관련 TS2339 는 origin/main 에도 동일 패턴(L3096/3130/3175)으로 이미 존재하는 pre-existing 이슈이며 신규 테스트가 그 기존 관용구를 그대로 재사용한 것 — 새로 도입된 결함 아님.

## 발견사항

- **[INFO]** 발견된 결함 없음(no findings).
  - 상세:
    1. **파라미터 순서·cap 매핑 테스트** — assertion `['eSQL','ws-X',7,'wf',2]` 이 실제 SQL `UPDATE ... WHERE id=$1 AND ... workspace_id=$2 ... <$3 AND ... workflow_id=$4 ... <$5`(L2661-2671) 과 정확히 일치. advisory lock 키 `exec-cap:ws-X` 도 `` `exec-cap:${workspaceId ?? execution.workflowId}` ``(L2657) 와 일치. `mockWorkflowRepo.findOne` 반환 shape(`settings`/`workspace.settings`/`workspaceId`) 도 구현이 읽는 필드와 정확히 대응.
    2. **admission 3-way 분기 테스트** — `deferred` → `releaseExecutionRouting` 호출 + `runExecution` 미호출(L3350-3354 그대로 반영), `cancelled` → `runExecutionFromQueue` 자체는 release 호출 안 함(release 는 `markQueueWaitTimeout` 내부 L2589 에서 처리 — 테스트 주석이 정확히 이 사실을 반영), `admitted` → `runExecution(execution, input, true)` 호출 + release 없음(L3350, L3364). 세 분기 모두 실제 코드 분기와 1:1 대응하며 함수명·주석·구현이 일치.
    3. **workspace-level cap e2e** — spec §8 "워크스페이스/워크플로우 **양쪽** 검증, 둘 다 cap 미만일 때만 RUNNING"(L1085) 요구사항 중 기존 두 e2e 케이스는 per-workflow cap 만 검증했고, workspace cap 단독 gating(다른 workflow 의 running 이 workspace 슬롯을 소비)은 미검증이었던 갭을 정확히 겨냥. 신규 테스트는 격리된 workspace 생성 + workflow cap 은 기본값(여유, 3) 유지 + workspace cap=1 로 설정해 교차 오염 없이 workspace-only gating 을 검증. `resolveConcurrencyCap` 기본값(`DEFAULT_WORKFLOW_MAX_CONCURRENT_EXECUTIONS`=3) 로 wfB 자체는 gating 되지 않음을 정확히 전제.
    4. helper 파라미터화(`wsId`/`workflowCap` 기본값 유지)로 기존 두 테스트의 시그니처·동작에 회귀 없음(기본 인자로 이전 호출부 그대로 통과 — 실제 jest 실행으로 확인).
  - 제안: 없음(테스트가 spec §8 요구사항과 실제 구현 모두에 line-level 로 부합).

## 요약

TEST-ONLY 변경으로, 신규 unit 테스트 4건과 e2e 테스트 1건 모두 실제 구현(`admitExecutionOrDefer`/`runExecutionFromQueue`/`markQueueWaitTimeout`)의 정확한 동작(원자 UPDATE 파라미터 순서 `[executionId, workspaceId, wsCap, workflowId, wfCap]`, advisory lock 키 스코프, deferred/cancelled/admitted 세 분기별 routing release·runExecution 호출 여부, workspace-level cap 이 워크플로우 간 교차 gating 하는 동작)를 spec §8 본문과 정확히 일치시켜 고정한다. 실제 jest 실행(358/358 passed)으로 assertion 이 유효함을 확인했고, 기존 테스트와의 mock 상태 충돌도 없다. 결함 없음.

## 위험도

NONE

STATUS: SUCCESS
