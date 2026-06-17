# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 차단 사유 없음

## 전체 위험도
**LOW** — Plan 문서 갱신 누락 1건(WARNING). 코드·spec 동작 모순 없음.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `c1-engine-split.md` PR4 절이 "대기" placeholder 로 남아 있어, 실제 구현의 메서드 disposition(`publishRetryLastTurn` 엔진 잔류, `buildRetryReentryState` EngineDriver 멤버 잔류)이 plan 텍스트("이동" 목록)와 불일치 | `plan/in-progress/refactor/c1-engine-split.md` §PR4 (L97–99) | `plan/in-progress/spec-update-engine-split.md` §변경(실제 disposition 반영본) | PR1–3 패턴에 맞춰 PR4 절에 체크리스트·완료 로그 추가. "이동" 목록에서 `publishRetryLastTurn`·`buildRetryReentryState` 를 "엔진 잔류" 로 수정, thin delegator 패턴 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/5-system/4-execution-engine.md` §1.3/§7.5 에 `RetryTurnService` 미등재 — 의도된 planner 후속 작업 | `spec/5-system/4-execution-engine.md` §1.3, §7.5 | `spec-update-engine-split.md` 절차에 따라 planner 가 C-1 체인 종료 시 일괄 반영 |
| 2 | Cross-Spec | `interaction-type-registry.md §1.2` Backend emit 위치 열이 PR2·PR3 이후 stale | `spec/conventions/interaction-type-registry.md` L31, L43–44 | `spec-update-engine-split.md` §conventions 갱신 항에 이미 예약됨 |
| 3 | Cross-Spec | `spec/data-flow/3-execution.md` 시퀀스 다이어그램이 단일 actor 표현 유지 | `spec/data-flow/3-execution.md` L42, L73, L123, L152 | `spec-update-engine-split.md` 에서 "선택(차단 아님)"으로 분류. planner 재량 |
| 4 | Cross-Spec | `EngineDriver` 인터페이스 멤버 카탈로그가 spec 미기재 | `spec/5-system/4-execution-engine.md` — EngineDriver 멤버 목록 | Rationale 에 "EngineDriver 는 엔진 내부 전용 토큰, spec 레벨 외부 계약 아님" 한 줄 명시 권장 |
| 5 | Cross-Spec | `rehydrateContext` 등 `private` → `public` 변경이 spec "엔진 내부" 서술과 겉보기 어긋남 | `execution-engine.service.ts` — 5개 메서드 | spec-update Rationale 에 "`EngineDriver` 멤버는 `public` 이지만 NestJS DI 경유만 허용(`@internal`)" 설명 추가 |
| 6 | Rationale Continuity | (발견 없음) 기각 대안 재도입·합의 invariant 위반 없음 | — | — |
| 7 | Convention Compliance | `ExecutionCancelledError` 가 `workflow-errors.ts` 편입 후 `@internal` 주석 부재 | `workflow-errors.ts` line 288 | `/** @internal — 엔진 내부 sentinel. code 없음; WS/API surface 미발행. */` JSDoc 추가 |
| 8 | Convention Compliance | `engine-driver.interface.ts` 신규 멤버 5개에 인터페이스 측 `@internal` 주석 누락 | `engine-driver.interface.ts` — 신규 멤버 JSDoc | implementation 측 주석과 대칭으로 인터페이스에도 `@internal — RetryTurnService 경유 전용` 추가 |
| 9 | Convention Compliance | `ExecutionGraphState` / `NodeDispatchLoopParams` export 승격 근거가 spec Rationale 에 미기재 | `execution-engine.service.ts` — 두 인터페이스 | `spec/5-system/4-execution-engine.md §1.3` Rationale 에 export 승격 이유 한 줄 추가 권장 |
| 10 | Plan Coherence | PR4 DoD 후속 단계(`/consistency-check --impl-done`, `/ai-review`, push/PR) 체크리스트 미기록 | `plan/in-progress/refactor/c1-engine-split.md` §PR4 | 완료 후속 단계를 PR4 절에 체크리스트로 추가 |
| 11 | Plan Coherence | `spec-update-engine-split.md` 생성 사실이 c1-engine-split.md 진행 로그에 미기록 | `plan/in-progress/refactor/c1-engine-split.md` 진행 로그 | 추적 목적으로 기록 권장 (우선순위 낮음) |
| 12 | Naming Collision | (발견 없음) 신규 식별자 모두 충돌 없음 | — | — |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | PR4 동작 모순 없음. spec 텍스트 추적 지연 4건(INFO) — 모두 `spec-update-engine-split.md` 예약 항목 |
| Rationale Continuity | NONE | 기각 대안 재도입·합의 invariant 위반 없음. INFO 5건 모두 충돌 없음 확인 |
| Convention Compliance | NONE | 직접 규약 위반 없음. 주석 보강·Rationale 문서화 제안 3건(INFO) |
| Plan Coherence | LOW | c1-engine-split.md PR4 절 "대기" placeholder — disposition 불일치(WARNING 1건) + 체크리스트 누락(INFO 2건) |
| Naming Collision | NONE | 신규 식별자 전체 충돌 없음. `ExecutionCancelledError` workflow-errors.ts 단일 canonical 정리 확인 |

## 권장 조치사항

1. **(WARNING 해소)** `plan/in-progress/refactor/c1-engine-split.md` PR4 절을 PR1–3 패턴에 맞춰 갱신 — "이동" 목록에서 `publishRetryLastTurn`·`buildRetryReentryState`·`buildResumeCheckpoint`·`isCheckpointEligibleNodeType` 를 "엔진 잔류(EngineDriver 멤버 / publisher cluster)" 로 수정, thin delegator 패턴 명시, DoD 체크리스트(ai-review·impl-done·push/PR·spec-sync) 추가. BLOCK 사유는 아니지만 추적 완결을 위해 이번 PR merge 전 처리 권장.
2. **(INFO, 경량)** `workflow-errors.ts` line 288 `ExecutionCancelledError` 에 `@internal` JSDoc 추가.
3. **(INFO, 경량)** `engine-driver.interface.ts` 신규 멤버 5개에 인터페이스 측 `@internal — RetryTurnService 경유 전용` 주석 추가.
4. **(INFO, planner 위임)** C-1 체인 종료 후 `spec-update-engine-split.md` 절차에 따라 planner 가 `spec/5-system/4-execution-engine.md` §1.3/§7.5 Rationale·메서드 소속 포인터 갱신 수행.