# 문서화(Documentation) 리뷰 — 06 C-2 원자 claim 도입

## 발견사항

- **[WARNING]** 추적 plan `06-concurrency.md` C-2 체크박스가 구현 완료 후에도 "결정 대기" 로 미갱신
  - 위치: `plan/in-progress/refactor/06-concurrency.md:39` (`- [ ] 결정 대기 (사용자) — execution-engine.service.ts:1250-1344 + continuation-execution.processor.ts:72-80`)
  - 상세: 이번 changeset 은 `claimResumeEntry` 원자 claim 을 실제로 구현·테스트하고 `spec/5-system/4-execution-engine.md`·`spec/data-flow/3-execution.md` 를 갱신했으며(spec draft rev2 도 사용자 승인·consistency-check BLOCK:NO 확인됨), `spec-draft-c2-atomic-claim.md` 자체도 "사용자 승인(2026-07-02)" 라고 서술한다. 그러나 이 diff 목록에 `plan/in-progress/refactor/06-concurrency.md` 갱신이 포함되어 있지 않아, 그 파일은 여전히 "⚠️ C-2 [Critical] … 결정 대기" 상태로 남는다. 이는 `consistency/2026/07/02/23_23_49/cross_spec.md` INFO#2 가 이미 지적한 사항이자, 프로젝트 관례("plan 체크박스 = 실제 상태", `plan-lifecycle.md`)를 위반한다. 제3자가 이 plan 파일만 보면 C-2 가 아직 미착수인 것으로 오인한다.
  - 제안: 본 구현 커밋과 함께(또는 동일 PR 내) `06-concurrency.md` C-2 항목을 "[x] 구현 완료 — Option A 채택·적용(2026-07-02)" 로 갱신하고 상단 요약 라인("spec 대조 판정 분포 … C-2 … **결정 대기**")도 함께 정리할 것.

- **[INFO]** `claimResumeEntry` JSDoc 은 매우 상세하고 정확 — 모범 사례
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:619-642` (`claimResumeEntry` 메서드 JSDoc)
  - 상세: 원자 claim 의 동기·짝 상태 단일 트랜잭션 이유·크래시 시나리오(`recoverStuckExecutions` 와의 관계)·§1.3 패턴과의 관계까지 모두 문서화되어 있어 향후 유지보수자가 "왜 이렇게 짜여 있는지" 를 코드만 보고 이해할 수 있다. 별도 조치 불필요.

- **[INFO]** `updateExecutionStatus` choke point JSDoc 에 `claimResumeEntry` 우회 사실을 명시적으로 추가한 점이 우수
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:860-865`
  - 상세: 기존 choke point 헬퍼의 JSDoc 에 "예외 — `claimResumeEntry`(06 C-2)" 소절을 추가해, 향후 이 헬퍼의 RUNNING 진입 로직을 바꿀 때 `claimResumeEntry` 도 함께 점검하라는 경고를 남겼다. 오래된 주석이 새 코드와 불일치하게 되는 전형적 실수를 미리 방지하는 좋은 관례.

- **[INFO]** `ai-turn-orchestrator.service.ts` re-park 인라인 주석이 배경(claim 전/후 동작 차이)까지 설명 — 충분
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:91-98`
  - 상세: "claim 도입 전에는 이 설정이 불필요했다" 는 히스토리 맥락까지 남겨, 왜 새 코드가 필요한지 뿐 아니라 과거와 무엇이 달라졌는지도 알 수 있다.

- **[INFO]** spec 본문(`4-execution-engine.md`) 개정이 과거 Rationale 기각 사유를 정면 인용해 재서술 — Rationale 연속성 준수
  - 위치: `spec/5-system/4-execution-engine.md:1927-1935` (`### 재개 race 보장을 DB 원자 claim 으로 — 위 "running hop 회피" 결정의 부분 수정`)
  - 상세: consistency-check rev1 에서 지적된 CRITICAL(무근거 번복)이 rev2 에서 L1252 기각 논거("트랜잭션 분리로 원자성 약화")를 정면 인용하고 "새 편익 + 원자성 실질 대응" 으로 논증하도록 수정되었으며, 이 diff 는 그 rev2 버전을 반영한다. spec 문서화 품질 관점에서 모범적으로 처리됨.

- **[INFO]** `data-flow/3-execution.md` §1.4/§3.2 병행 다이어그램 동기화는 이번 diff 에 포함됨(§1.4, stateDiagram 2곳) — cross_spec WARNING 해소 확인
  - 위치: `spec/data-flow/3-execution.md:160-172`, `:240-243`, `:272-275`
  - 상세: `consistency/23_23_49/cross_spec.md` WARNING("`data-flow/3-execution.md §1.4` 미동기")과 `consistency/23_32_43/SUMMARY.md` WARNING#1("§3.2 NodeExecution status mermaid 도 필요")이 모두 이 diff 에서 실제로 반영되었다(`waiting_for_input --> running` 전이 주석과 claim 문구가 두 다이어그램 모두에 추가됨). 별도 조치 불필요.

- **[INFO]** 테스트 파일(`*.spec.ts`)의 변경 사유 주석이 상세해 회귀 의도를 코드만으로 추적 가능
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:538-540`, `:564-566`
  - 상세: "RUNNING 은 §7.5 원자 claim 진입 후 상태라 **허용값**이므로 reject 테스트에 쓰면 안 된다(가드 통과 → false-green)" 처럼 테스트 설계 실수를 방지하는 이유까지 주석으로 남겨, 향후 다른 개발자가 실수로 되돌리는 것을 방지한다.

- **[INFO]** README/CHANGELOG 업데이트 불필요 확인
  - 상세: 이번 변경은 내부 rehydration 동시성 가드 로직(`claimResumeEntry`)의 스키마·API 표면 변경이 없는 내부 리팩터링이며, 신규 환경변수·설정 옵션도 도입하지 않았다(`CONTINUATION_WORKER_CONCURRENCY` 는 기존 변수, 의미만 spec 주석으로 보강됨). README/CHANGELOG 갱신 대상 아님.

## 요약

핵심 구현 파일(`execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`, `continuation-execution.processor.ts`)의 JSDoc·인라인 주석은 원자 claim 도입 배경·짝 트랜잭션 이유·과거 코드와의 차이·회귀 방지 포인트까지 상세히 기술되어 있고, spec 본문(`4-execution-engine.md`, `data-flow/3-execution.md`)도 consistency-check 에서 지적된 rationale 연속성·cross-spec 동기화 이슈를 rev2 에서 실질적으로 해소해 반영했다. 유일한 잔여 갭은 추적 plan `06-concurrency.md` 의 C-2 체크박스가 이번 구현 완료를 반영하지 못하고 여전히 "결정 대기" 로 남아 있는 점으로, 이는 이미 cross_spec 체커가 INFO 로 지적했던 사항이 구현 단계까지도 넘어온 것이다. 전체적으로 문서화 품질은 높으며 유일한 발견은 plan 상태 동기화 누락(WARNING) 1건이다.

## 위험도

LOW
