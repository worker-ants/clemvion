# ai-review SUMMARY — admission gate 회귀 보강 (TEST-ONLY)

- 세션: `review/code/2026/07/04/20_29_33`
- 대상 커밋: `d60fc16d8 test(06-concurrency): admission gate 회귀 보강 (§8 PR2b)`
- diff base: `origin/main` (로컬 main stale — #803 미포함이라 `--branch main` 은 over-include → origin/main 사용)
- router 활성 8/14: security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency
  - skip: performance, architecture, dependency, database, api_contract, user_guide_sync (test-only, 무관)

## 전체 위험도: NONE

## Critical: 0 · Warning: 0

8 reviewer 전원 NONE. 변경은 production 코드 무변경, §8 admission gate 회귀 테스트만:
- unit(4): admission deferred/cancelled → runExecution 미호출(+deferred release), admitted → runExecution(exec,input,true); 원자 UPDATE 파라미터 순서·cap 매핑 [executionId,workspaceId,wsCap,workflowId,wfCap] + advisory lock 키.
- e2e(1): workspace-level cap 단독 gating(다른 workflow running 이 workspace 슬롯 소비).

## reviewer별 핵심

| reviewer | 결과 | 핵심 |
| --- | --- | --- |
| security | NONE | 모든 admission SQL 파라미터화, 시크릿/auth surface 없음. |
| requirement | NONE | 구현(`admitExecutionOrDefer`/`runExecutionFromQueue`/`markQueueWaitTimeout`)·spec §8 line-level 검증. jest 358/358·tsc 확인. |
| scope | NONE | test-only. impl-prep convention_compliance BLOCK 은 mis-scope 오탐(SUMMARY override) 재확인. |
| side_effect | NONE | e2e 헬퍼 옵셔널 파라미터 기본값이 기존 동작과 동일 → 기존 2 테스트 불변. |
| maintainability | NONE | `admitStub` 헬퍼 dedup·하위호환 파라미터 긍정. |
| testing | NONE | 모든 assertion 구현 대조 일치·격리 sound·flakiness 없음. |
| documentation | NONE | 인라인 주석 구현/§8 정합. |
| concurrency | NONE | workspace-cap e2e 격리(fresh workspace → advisory-lock 키 비충돌)·타이밍 margin(1500ms<2000ms retry, 20s poll=10x) 안전. |

## INFO (비차단)

- `mockRestore()` 개별 호출 vs `afterEach(jest.restoreAllMocks())` 혼용 (testing) — 무해 스타일.
- workspace-cap e2e 는 workspace-COUNT-join 스코프 정확성을 증명하며 advisory-lock TOCTOU 직렬화 자체는 기존 코드 이력+per-workflow e2e 가 커버 (concurrency) — scope 명확화, 결함 아님.
- null-workflow admission lookup 커버리지 갭 (testing) — 본 changeset 목적 밖, pre-existing.

## 판정

Critical/Warning 0 → clean. `resolution-applier` 불요.
