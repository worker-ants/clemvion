# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
Scope: `spec/5-system/4-execution-engine.md` 영역 구현 변경
Diff-base: `claude/engine-split-s3-formbutton`
Target: C-1 step4 — `RetryTurnService` 추출 (PR4)

---

## 발견사항

- **[WARNING]** `c1-engine-split.md` PR4 placeholder 와 실제 구현 scope 불일치
  - target 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 상단 docstring (L1678–1684) 및 `execution-engine.service.ts` import 주석 (L396)
  - 관련 plan: `plan/in-progress/refactor/c1-engine-split.md` §"PR4 — RetryTurnService — 대기" (L97–99)
  - 상세: plan PR4 절은 `applyRetryLastTurn`/`buildRetryReentryState`/`resumeGraphAfterRetry`/`completeRetryExecution`/`failRetryExecution`/`publishRetryLastTurn` 전체를 "이동" 대상으로 기술한다. 그러나 실제 구현에서는 `publishRetryLastTurn` 은 엔진의 publisher cluster 에 잔류하고, `buildRetryReentryState`·`buildResumeCheckpoint`·`isCheckpointEligibleNodeType` 는 `EngineDriver` 멤버로 엔진 잔류하며, `retryLastTurn`·`applyRetryLastTurn` 외부 진입점은 thin delegator 로 엔진에 남긴다. PR4 section 은 체크리스트 없이 "대기" 상태이므로 이 불일치가 DoD 기록에 반영되지 않았다.
  - 제안: `c1-engine-split.md` PR4 절을 PR1–3 패턴과 동일하게 체크리스트 항목과 완료 로그로 갱신. 구체적으로 "이동" 목록에서 `publishRetryLastTurn`·`buildRetryReentryState` 를 "엔진 잔류(EngineDriver 멤버 / publisher cluster)" 로 수정하고, thin delegator 패턴(외부 표면 보존)을 명시. 해당 내용은 이미 `plan/in-progress/spec-update-engine-split.md` §`spec/5-system/4-execution-engine.md` 항목(L37–39)에 실제 disposition 이 반영되어 있으므로 c1-engine-split.md 만 동기화하면 된다.

- **[INFO]** PR4 DoD 후속 항목(`/consistency-check --impl-done`, `/ai-review`, push/PR) 미기록
  - target 위치: 현재 브랜치 `claude/engine-split-s4-retry` (변경사항 전체)
  - 관련 plan: `plan/in-progress/refactor/c1-engine-split.md` §"PR4 — RetryTurnService — 대기" 및 §spec 갱신 (L106 "PR4 DoD 에 … 포함")
  - 상세: c1-engine-split.md 는 PR4 DoD 에 "/consistency-check --impl-done + /ai-review + push/PR + spec Rationale/§1.0 enrichment planner 반영 + /consistency-check --spec BLOCK:NO" 를 포함하도록 명시하나, PR4 절에는 이 단계들의 체크리스트가 없어 완료 추적이 불가능하다. 구현 자체에는 문제가 없고, plan 문서 갱신만 필요한 추적 누락이다.
  - 제안: 구현 완료 이후 단계들(TEST·ai-review·impl-done·push/PR·spec-sync)을 c1-engine-split.md PR4 절에 체크리스트로 추가하고, 완료 시 진행 로그에 기록.

- **[INFO]** `spec-update-engine-split.md` 가 PR4 완료 전에 생성됨 — PR4 DoD 의 spec-sync "formal phase" 선행 작업으로 적합
  - target 위치: `plan/in-progress/spec-update-engine-split.md` (created: 2026-06-18)
  - 관련 plan: `plan/in-progress/refactor/c1-engine-split.md` §spec 갱신 (L106) "체인 종료(PR4) 시 planner 가 일괄 반영하는 정식 phase"
  - 상세: spec-update-engine-split.md 는 구현 완료와 동일 날짜에 생성된 핸드오프용 draft 로, PR4 실제 disposition 을 정확히 반영하고 있다(`buildRetryReentryState`·`buildResumeCheckpoint`·`isCheckpointEligibleNodeType` 엔진 잔류, `publishRetryLastTurn` 언급 없음). 이는 c1-engine-split.md 가 요구하는 "체인 종료 시 planner 일괄 반영" 의 준비 상태로 정합하다.
  - 제안: 추적 목적으로 c1-engine-split.md 진행 로그에 spec-update-engine-split.md 생성 사실을 기록하는 것을 권장. 실행 우선순위는 낮음.

---

## 요약

PR4(`RetryTurnService` 추출) 구현이 plan 에서 "미해결 결정"으로 남겨둔 항목을 일방적으로 우회하거나 선행 조건 미해소 상태에서 진행한 충돌은 없다. 다만 `c1-engine-split.md` PR4 절이 "대기" 상태 placeholder 로 남아 있어, 실제 구현이 채택한 메서드 disposition(`publishRetryLastTurn` 엔진 잔류, `buildRetryReentryState` EngineDriver 멤버 잔류)이 plan 텍스트("이동" 목록)와 표면적으로 어긋난다. 이는 plan 갱신 누락(WARNING)으로, 미해결 결정 우회(CRITICAL)가 아니다. `spec-update-engine-split.md` 는 PR4 실제 scope 를 정확하게 반영하여 체인 종료 후 spec-sync 의 formal phase 준비 상태가 정합하다. 후속 단계인 `/ai-review`, `/consistency-check --impl-done`, push/PR, planner 의 spec-update 반영이 c1-engine-split.md PR4 DoD 체크리스트에 추가되어야 추적이 완결된다.

---

## 위험도

LOW
