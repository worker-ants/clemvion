# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] ExternalInteractionModule 클래스 JSDoc — 새 BullMQ 큐·서비스 미반영
- 위치: `codebase/backend/src/modules/external-interaction/external-interaction.module.ts` L89–103
- 상세: 모듈 JSDoc 의 "Wire-up" 목록과 "의존성" 절이 `TerminalRevokeReconcilerService` 및 `TERMINAL_REVOKE_RECONCILE_QUEUE` 추가를 반영하지 않고 있다. 현재 JSDoc 에는 `NotificationDispatcher + Processor + Fanout (R10)` 까지만 언급되고, BullMQ `notification-webhook` 큐만 표기되어 있다. 신규 reconcile 큐와 서비스가 wire-up 설명에서 누락된 상태다.
- 제안: JSDoc Wire-up 항목에 `TerminalRevokeReconcilerService (EIA-RL-06 at-least-once sweep)` 를 추가하고, 의존성 절의 BullMQ 괄호에 `terminal-revoke-reconcile 큐` 를 병기한다.

### [INFO] TerminalRevokeReconcilerService — `reconcile()` 공개 메서드 JSDoc 부재
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` reconcile() 메서드
- 상세: `process(_job)` 는 BullMQ 인터페이스 구현이라 추가 설명이 불필요하지만, `reconcile()` 은 테스트에서 직접 호출 가능한 공개 메서드임에도 JSDoc 이 없다. 클래스 주석이 상세하므로 중복은 아니지만, 외부에서 직접 호출할 수 있는 공개 메서드로서의 계약(반환 타입 `Promise<void>`, fail-open 의미)이 명시되지 않았다.
- 제안: `reconcile()` 에 단문 JSDoc 을 추가한다. 예: `/** fail-open — 내부 오류는 swallow 후 로그, 다음 tick 에서 재시도. 직접 테스트/호출 가능. */`

### [INFO] `batchLimit` 매개변수 — 선택 근거 및 설정 가이드 미비
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` reconcileTerminalRevocations 시그니처
- 상세: `reconcileTerminalRevocations(batchLimit = 500)` 의 기본값 500 에 대한 선택 근거(예: 메모리·쿼리 비용 트레이드오프, 설정 가능 여부)가 JSDoc 이나 주석으로 설명되지 않았다. 큰 배치는 DB 부하를 늘리고 작은 배치는 지연 증가 — 어느 방향으로도 설정 가이드가 없다. 환경변수나 설정 키로 조정 가능한지도 불명확하다.
- 제안: JSDoc 에 `@param batchLimit` 항목을 추가해 기본값 500 의 의미(1회 sweep 당 최대 execution 수)와 조정 시 고려 사항을 한 줄 기재한다.

### [INFO] `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수 — 기존 큐 상수 위치 패턴과 불일치
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` 상단
- 상세: 큐 이름 상수 `TERMINAL_REVOKE_RECONCILE_QUEUE` 가 서비스 파일 내 직접 export 되어 있다. `NOTIFICATION_WEBHOOK_QUEUE` 는 `notification-dispatcher.types.ts` 에 있어 패턴이 불일치한다. 일관성 문서화 측면에서 유사 큐 상수의 위치 규약이 없으면 신규 진입자가 탐색을 어려워한다.
- 제안: `NOTIFICATION_WEBHOOK_QUEUE` 와 동일하게 `.types.ts` 파일로 분리하거나, 현 구조를 유지한다면 서비스 파일 상단에 `// BullMQ 큐 이름 — module.ts 등록 참조` 와 같은 주석으로 의도를 명시한다.

### [INFO] plan 문서 — 권장안(C)과 실제 결정(D3=A)의 불일치 설명 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-token-codes-revoke-outbox-2639e5/plan/complete/spec-fix-eia-token-error-codes.md`
- 상세: plan 문서 완료 노트는 "결정 3=A — reconciler 구현까지 포함(별도 후속 plan 불요)" 라고 명시했으나, 본래 권장안 섹션에는 "C(now) → A(follow-up)" 이었다. 결정 옵션 섹션의 "권장안: C" 와 완료 노트의 "D3=A" 가 문서 내에서 방향이 달라 보여 혼란을 줄 수 있다. 실제로는 사용자 결정(D3=A)이 권장안(C)을 번복한 것이지만 해당 경위가 본문에 명시적으로 설명되지 않았다.
- 제안: 완료 노트 또는 결정 3 섹션 말미에 "사용자 결정 D3=A — 권장안 C 대신 outbox 구현까지 본 PR 에서 완결" 임을 1행 추가하면 이후 참조 시 혼선이 없어진다.

## 요약

이번 변경 세트는 전반적으로 문서화 수준이 높다. `reconcileTerminalRevocations` 에 상세 JSDoc 이 작성되어 있고, `TerminalRevokeReconcilerService` 클래스 주석도 아키텍처 배경(멀티 인스턴스 안전성, durable outbox 로서의 `execution_token`, live fast-path 의 한계)을 충실히 설명한다. 발견된 사항은 모두 INFO 등급으로, 클래스/함수 계약의 핵심 정보가 누락된 것이 아니라 모듈 JSDoc 갱신 누락, 공개 메서드 단문 JSDoc 부재, 배치 크기 파라미터 선택 근거 미기재 등 보완 권고 수준이다. plan 문서에서 권장안과 실제 결정 방향의 차이가 본문에서 명확히 설명되지 않은 점이 유일하게 주목할 만한 정보 일관성 이슈다. 긴급 수정을 요하는 사항은 없다.

## 위험도

NONE
