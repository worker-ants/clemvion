# Plan 정합성 검토 결과

## 메모: payload 스코프 이상 및 보정 조치

전달된 payload(`_prompts/plan_coherence.md`)의 "Target 문서"는 `spec/5-system/1-auth.md`
(인증/인가 spec) 전문만 담고 있었고, 사용자가 지시한 실제 검토 대상(ARCH#4/ARCH#6/MAINT#9
구현, `exec-intake-followups.md` 서브체크박스)과 무관했다 — orchestrator payload 구성 시
`--impl-prep spec/5-system/` 광범위 scope 필터가 auth spec 을 함께 실어 온 것으로 보인다
(이 사실 자체가 `exec-intake-followups.md` 25행에 "exec-engine 무관(별도 트랙)"으로 이미
기록되어 있다). 지시에 따라 plan 파일들을 직접 읽어 검토했다.

확인한 자료:
- `plan/in-progress/exec-intake-followups.md` (ARCH#4/5/6, MAINT#9 상태)
- `plan/in-progress/exec-limits-refactor.md` (본 워크트리 전용 실행 plan)
- `plan/in-progress/exec-park-durable-resume.md`, `plan/in-progress/workflow-cap-validated-dto.md` (execution-limits.ts/execution-run.queue.ts 참조 여부)
- `plan/in-progress/http-ssrf-all-auth-followups.md`, `plan/in-progress/node-output-redesign/*` (ARCH#5 지연 근거인 error-codes.ts 동시 편집 여부)
- `git diff origin/main` — `execution-limits.ts` / `execution-run.queue.ts` / `system-status.constants.ts`

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** ARCH#5 지연 사유 재확인 — 실재함
  - target 위치: 코드 diff (`error-codes.ts` 미변경, exit code 0 no-diff)
  - 관련 plan: `plan/in-progress/exec-limits-refactor.md` §스코프 결정, `plan/in-progress/exec-intake-followups.md` ARCH#5 항목
  - 상세: ARCH#5(엔진 에러코드 레이어 분리)를 `http-ssrf-all-auth-followups.md`·`node-output-redesign/*` 가 `error-codes.ts`/`ErrorCode` 를 활발히 편집 중이라는 이유로 별도 후속 분리했다는 서술을, 실제로 두 plan 이 `error-codes.ts` 관련 항목을 보유함을 확인해 근거가 유효함을 검증했다. 본 PR 의 diff 는 `error-codes.ts` 를 건드리지 않아 스코프 분리가 실제로 지켜졌다.
  - 제안: 조치 불필요, 기록 확인 목적.

- **[INFO]** 하위 plan(exec-park-durable-resume, workflow-cap-validated-dto)의 참조 무결성
  - target 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` (top JSDoc, PR3/PR4 서술), `execution-limits.ts` (`resolveConcurrencyCap`)
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md:182`, `plan/in-progress/workflow-cap-validated-dto.md:17`
  - 상세: 두 plan 이 각각 `execution-run.queue.ts` 상단 주석(PR3/PR4 stalled·재개 서술)과 `resolveConcurrencyCap`(execution-limits.ts) 을 인용한다. 이번 diff 는 `resolveExecutionRunWorkerConcurrency`/`DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY` 의 위치 이동과 JSDoc 갱신만 수행했고, 두 plan 이 인용하는 대상(파일 상단 헤더 주석·`resolveConcurrencyCap` 함수)은 diff 밖이라 무효화되지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** MAINT#9 의 동작 변경(loose→strict) 파급 범위 확인
  - target 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` (continuation concurrency 파싱)
  - 관련 plan: `plan/in-progress/exec-limits-refactor.md` MAINT#9 항목
  - 상세: `CONTINUATION_WORKER_CONCURRENCY` 를 참조하는 다른 in-progress plan 은 없음 — MAINT#9 가 loose parsing 을 strict canonical resolver 로 교체해도 다른 plan 의 가정과 충돌하지 않는다.
  - 제안: 조치 불필요.

## 요약

전달받은 payload 는 스코프가 어긋나 있었으나(auth spec 전문, 실제 검토 대상과 무관), 이는 이미 `exec-intake-followups.md` 자체에 별도 트랙으로 기록된 기존 현상이었다. plan 파일을 직접 읽어 확인한 결과, ARCH#4(이관)·ARCH#6(JSDoc 확장)·MAINT#9(canonical resolver 통일)는 `exec-intake-followups.md`/`exec-limits-refactor.md` 서술과 코드 diff 가 정확히 일치하며, ARCH#5 지연 근거(`error-codes.ts` 동시 편집 중인 http-ssrf·node-output-redesign plan 존재)도 실재를 확인했다. 다른 in-progress plan(`exec-park-durable-resume`, `workflow-cap-validated-dto`)이 인용하는 대상은 이번 diff 범위 밖이라 무효화되지 않았고, 후속 항목 누락이나 미해결 결정 우회도 발견되지 않았다. Plan 정합성 관점에서 이 리팩터는 완전히 정합적이다.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS
