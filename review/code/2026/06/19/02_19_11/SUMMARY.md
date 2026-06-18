# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 JSDoc/인라인 주석 전용 커밋(`8a9d8a06`). 런타임·컴파일 산출물 무변. 신규 Critical 없음. 기존 pre-existing 구조 문제(god-class, forwardRef 순환 DI) 2건이 WARNING 으로 기록되나 본 변경이 악화시키지 않음. 문서 품질 개선 효과가 있는 경미한 INFO 항목 다수.

> **재검토 맥락**: 본 세션(02_19_11)은 `--commit 8a9d8a06`(ai-review INFO 주석 반영 커밋, 주석 7줄) 델타 재검토. 본체 변경(`29e38a38`)은 선행 세션 `review/code/2026/06/19/01_41_04`(LOW·C0·W4)에서 검토 완료. 본 세션은 review-gate(코드가 리뷰 이후 수정됨) 해소용 fresh 재검토.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | Architecture | god-class `ExecutionEngineService` (6,973줄) — `WorkflowExecutor` + `EngineDriver` 두 인터페이스를 동시 구현하며 단일 책임 원칙 지속 위반. C-1 step2~4 에서 4개 책임 분해 후에도 잔존. | `execution-engine.service.ts` 전체 | PR-H/I 에서 컨테이너 dispatch 또는 상태 머신 클러스터를 별도 서비스로 추출하는 로드맵 일정 유지. 본 변경과 무관한 pre-existing 항목. |
| W2 | Architecture | `forwardRef` 순환 DI 4개 — 추출된 `AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService` 가 모두 `ENGINE_DRIVER`(=`ExecutionEngineService`)를 역방향 주입받아 `forwardRef` 로 임시 해소. | `execution-engine.service.ts` L602, L606, L608, L612 | `loadAndBuildGraph`, `runNodeDispatchLoop`, `rehydrateContext` 등을 별도 stateless `GraphExecutionHelper` 서비스로 분리해 순환 구조적 제거 검토. PR-H/I 로드맵에 포함 권장. Pre-existing. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/4-execution-engine.md` §Rationale C-1 분할(L1464)이 `EngineDriver` 멤버를 3개만 열거하고 step4 추가 5개를 누락. 코드 JSDoc 이 비대칭을 올바르게 설명하므로 코드는 옳고 spec 이 낡음. | `spec/5-system/4-execution-engine.md` L1464 | spec §Rationale 멤버 목록에 step4 5개 추가해 전체 12멤버 완성. project-planner 경로. |
| I2 | Maintainability | `applyContinuation` 직전 폐기된 구 JSDoc 블록(L983-991)과 신규 블록(L992-1008) 연속 존재. Pre-existing. | `execution-engine.service.ts` L983-991 | 구 JSDoc 제거 또는 인라인 주석화. |
| I3 | Maintainability | `rehydrateAndResume` 내 일본어 주석 혼입. Pre-existing(본 diff 밖). | `execution-engine.service.ts` L1271-1273 | 한국어/영어 재작성. |
| I4 | Maintainability | `EngineDriver` step4 이전 7개 멤버에 개별 `@internal` 미표기(클래스 레벨 JSDoc에만 설명). | `engine-driver.interface.ts` | 7개 멤버에 `@internal` 추가 — 후속 PR. |
| I5 | Maintainability | `dispatchMeta` 인라인 리터럴 타입. verbatim 이동. | `types/graph-dispatch.types.ts` | `DispatchMeta` type alias 추출. |
| I6 | Maintainability | `rehydrateContext` 내 `seenNodeIds` + `seenNodeIdSet` 이중 자료구조. Pre-existing(본 diff 밖). | `execution-engine.service.ts` L1401-1407 | 의도 인라인 주석 명시. |
| I7 | Maintainability | `NodeDispatchLoopParams.executionId` JSDoc 이 `savedExecution.id` 관계 미명시. | `types/graph-dispatch.types.ts` | 관계 보강 — 선택. |
| I8 | Documentation | `ExecutionGraphState.nodeMap` 인라인 주석에 리뷰 경로 없음. | `execution-engine.service.ts` | 리뷰 경로 포함 — 필수 아님. |
| I9 | Architecture | `EngineDriver` step4 5개만 `@internal` 비대칭 — 본 변경 JSDoc 단락으로 이유 설명됨. | `engine-driver.interface.ts` L26-30 | 후속 PR 7개 균등 추가. |
| I10 | Security | `assertSameWorkspace` fail-open. 기존 백로그, 본 변경 무관. | `execution-engine.service.ts` | parentWorkspaceId 정착 시 fail-closed 전환. |
| I11 | Testing | `ENGINE_DRIVER` 토큰 provider 바인딩 검증 존재 여부 확인. | `execution-engine.service.spec.ts` 등 | 기존 존재 시 추가 조치 불필요. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 주석 only 변경, 보안 민감 정보 없음. |
| architecture | LOW | god-class(W1)·forwardRef 순환 DI(W2) pre-existing. leaf 타입 모듈 분리 방향 적절. |
| requirement | NONE | spec fidelity 이상 없음. SPEC-DRIFT 1건(I1). |
| scope | NONE | 변경 범위 완전 일치. 의도 이상 변경 없음. |
| side_effect | NONE | 런타임·컴파일 산출물·공개 API 무변. |
| maintainability | LOW | dead JSDoc(I2)·일본어 주석(I3)·@internal 비대칭(I4)·dispatchMeta(I5) INFO. |
| testing | NONE | 주석 only — 신규 테스트 불필요. |
| documentation | LOW | dead JSDoc pre-existing(I2). 전반 문서 품질 개선. |

---

## 권장 조치사항

1. **(SPEC-DRIFT)** spec §Rationale C-1 EngineDriver 멤버 목록 step4 5개 추가 — project-planner 경로. (I1)
2. (pre-existing 그루밍) dead JSDoc 블록 제거(I2)·일본어 주석 재작성(I3) — 본 diff 밖, 별도 그루밍.
3. (후속 PR-H/I) god-class 분해 + forwardRef 순환 DI 구조적 해소(W1/W2) — = C-1 후속 ④.
4. (후속 PR) EngineDriver 기존 7개 멤버 `@internal` 균등(I4/I9) — 또는 현 인터페이스 레벨 설명 유지.
5. (선택) `DispatchMeta` type alias 추출(I5).

---

## 라우터 결정

routing_status=done. 실행 8명(security·architecture·requirement·scope·side_effect·maintainability·testing·documentation), 제외 6명(performance·dependency·database·concurrency·api_contract·user_guide_sync — 주석 전용 변경으로 무관).
