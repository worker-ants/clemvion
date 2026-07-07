---
worktree: notif-followup-refactor-8c7ad2
started: 2026-07-07
owner: developer
---

# 알림 하드닝 후속 — 리팩터링 + spec §4.4 문서화

> 출처: [[notif-hardening-followups]] §후속 (PR #841 머지 후). 엔진 재리뷰(22_42_32)·rationale WARNING 처리.
> 관련 spec: spec/5-system/4-execution-engine.md §4.4, spec/data-flow/8-notifications.md §1.1.

## 항목
- [x] **finalizeFailedExecution 헬퍼 추출** (behavior-preserving) — `runExecution` catch(초기 세그먼트)와
  `finalizeResumedExecutionOutcome`(재개 세그먼트)의 near-identical FAILED 종결 블록(status/error 봉인/save/
  EXECUTION_FAILED emit/execution_failed dispatch)을 단일 private 헬퍼로 일원화. **버그 A(한쪽만 배선돼
  execution_failed 미발사) 재발 방지.** 로그 라벨(rehydrated) 차이만 opt 로 흡수. context/캐시 정리는 호출자 finally 유지.
  - 주의: failFirstSegmentSetup(534)·sub-workflow timeout(3929) 은 구조·정책 상이(dispatch 미포함/재throw) → 본 추출 대상 아님(behavior-preserving 유지).
- [x] **spec §4.4 ModuleRef 문서화** — 현재 "엔진 순환=forwardRef" 만 명문. `ExecutionEngineService↔NotificationsService`
  는 생성자 @Optional 이 인스턴스화 순서로 undefined 로 굳는 케이스라 **ModuleRef(strict:false) 지연 해석**(getNotificationsService)
  으로 해결(PR #841). 기존 `NotificationsService.getWebsocket()` 도 동일 선례. §4.4 에 "순환 DI 해법 = forwardRef +
  ModuleRef 지연해석 2종, 적용 기준(생성자 주입이 인스턴스화 순서로 undefined 되는 @Optional 케이스 = ModuleRef)" 정리.
- [x] **plan lifecycle**: [[spec-update-notifications-background-run-id]] 의 마지막 §4.4 항목 완료 → complete 이동.
  notif-hardening-followups 의 helper·§4.4 [x], DI-cycle 근본해소는 backlog 로 분리.

## Backlog (본 PR 범위 밖 — 대규모 behavior-risky)
- **DI 순환 그래프 근본 축소** (이벤트 기반 디커플링 등): forwardRef/ModuleRef 우회가 아닌 순환 자체 제거.
  §4.4 가 이미 forwardRef 전략·strangler-fig 분할을 광범위 문서화 — 근본 축소는 대규모 아키텍처 작업이라 별도 backlog.

## 게이트
- impl-prep → 구현 → lint·unit·build·e2e → ai-review → impl-done → PR.
