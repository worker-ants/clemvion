# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수 — 큐 상수 파일 위치 패턴 불일치
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` 최상단
- 상세: `NOTIFICATION_WEBHOOK_QUEUE` 는 `notification-dispatcher.types.ts` 별도 파일에 위치하는 반면, `TERMINAL_REVOKE_RECONCILE_QUEUE` 는 서비스 구현 파일 내에 직접 export 되어 있다. 모듈 파일이 해당 상수를 import 할 때 서비스 구현 파일 전체를 참조하게 되며, 상수 위치 규약이 일관되지 않아 신규 진입자가 탐색에 어려움을 겪을 수 있다. 단, 파일 상단에 `/** repeatable job 보존 — 완료 24h / 실패 7d. */` 주석이 추가되어 age 상수에 대한 의도는 명확히 문서화되어 있다.
- 제안: `terminal-revoke-reconciler.types.ts` 를 별도 생성해 큐 상수를 분리하거나, 현 구조를 유지한다면 서비스 파일 상단에 `// BullMQ 큐 이름 상수 — module.ts 등록 참조` 형태의 한 줄 주석을 추가해 의도를 명시한다. 현 규모에서 즉각 수정을 요하지는 않는다.

### [INFO] `reconcile()` public 공개 의도 — JSDoc 에 명시됨 (이전 회차 fix 확인)
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` `reconcile()` 메서드
- 상세: 이번 변경에서 `reconcile()` 에 JSDoc 이 추가되었다(`public 인 것은 단위 테스트가 직접 호출해 fail-open 동작을 검증하기 위함이다`). 메서드의 계약(fail-open swallow, 다음 tick 재시도, sweep 결과 로그는 token service 단일 책임)이 명확히 기술되어 있다. 이전 회차 리뷰 I7/I18 fix 사항이 적용된 것으로 확인된다.
- 제안: 없음.

### [INFO] plan 문서 — 권장안(C)과 실제 결정(D3=A) 불일치 설명 반영 여부 미확인
- 위치: `plan/complete/spec-fix-eia-token-error-codes.md`
- 상세: 이전 리뷰(15_59_50)에서 동일 항목이 지적되었고 RESOLUTION.md 내 `I20 plan D3=A 경위 note → fix` 로 처리 완료라고 명시되어 있다. 그러나 현재 diff 에는 해당 plan 파일의 변경이 포함되어 있지 않아 실제 수정 내용을 diff 로 확인할 수 없다. plan 문서에서 `권장안: C` 와 완료 노트 `D3=A` 가 방향이 달라 보이는 상황이 잔존할 가능성이 있다.
- 제안: plan 파일에 `사용자 결정 D3=A — 권장안 C 대신 outbox 구현까지 본 PR 에서 완결` 경위가 실제로 추가되었는지 확인 필요. diff 에 미포함이면 미완료 상태다.

### [INFO] `batchLimit` JSDoc `@param` — 추가 확인됨, 외부 주입 불가 안내는 미비
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` `reconcileTerminalRevocations` 시그니처
- 상세: `@param batchLimit` 항목이 추가되어 기본값 `RECONCILE_BATCH_LIMIT=500` 의 의미와 `[1, RECONCILE_BATCH_MAX]` clamp 동작이 명확히 기술되어 있다. 이전 리뷰 I19 fix 사항이 적용된 것으로 확인된다. 단, batchLimit 을 환경변수나 설정 키로 외부에서 주입 가능한지에 대한 안내가 없다 — 현재 하드코딩된 상수이므로 운영 튜닝을 원하는 경우 소스 변경이 필요함을 문서화하면 더 명확하다.
- 제안: JSDoc 에 `환경변수 주입 불가, 소스 상수 RECONCILE_BATCH_LIMIT 변경 필요` 한 줄을 추가하면 운영자 혼선을 방지할 수 있다. INFO 수준, 즉각 필수 아님.

### [INFO] 인라인 주석 — bounded-concurrency 루프 이유 명시됨 (양호)
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` `reconcileTerminalRevocations` 내 병렬 루프 블록
- 상세: `// execution 단위 bounded-concurrency 병렬 — 직렬 N+1 왕복(최악 배치 수백건)을 완화한다. // per-execution revoke 는 idempotent·fail-open 이라 병렬·중복 안전.` 주석이 추가되어 복잡한 `Promise.allSettled` 패턴의 도입 이유와 안전성 근거가 명확히 설명된다.
- 제안: 없음.

### [INFO] `TERMINAL_STATUSES` 상수 주석 — enum 동기화 경고 문서화됨 (양호)
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` 상수 블록
- 상세: `/** terminal execution 상태 — 잔존 토큰 회수 대상. enum 확장 시 본 배열 동기화. */` 주석이 명시적으로 유지보수 위험을 경고하고 있다. 적절한 문서화다.
- 제안: 없음.

### [INFO] module JSDoc wire-up 갱신 — TerminalRevokeReconcilerService 항목 추가 확인
- 위치: `codebase/backend/src/modules/external-interaction/external-interaction.module.ts` JSDoc 블록
- 상세: `TerminalRevokeReconcilerService (EIA-RL-06 — terminal revoke at-least-once sweep, BullMQ repeatable)` 항목이 Wire-up 목록에 추가되어 이전 리뷰 I8 fix 사항이 반영된 것으로 확인된다. 신규 큐와 서비스가 모듈 문서에 명확히 반영되어 있다.
- 제안: 없음.

## 요약

이번 변경 세트는 이전 리뷰(15_59_50)에서 지적된 문서화 관련 INFO 항목(I7 reconcile() JSDoc, I8 module wire-up JSDoc, I5/I6/I9 매직 넘버 상수 추출 + 주석, I18 public 이유 명시, I19 @param batchLimit)을 충실히 이행했다. 모듈 JSDoc 에 `TerminalRevokeReconcilerService (EIA-RL-06)` 항목이 추가되었고, `reconcile()` 에는 fail-open 계약과 public 의도가 명시된 JSDoc 이 작성되었으며, 복잡한 병렬 루프에는 근거 인라인 주석이 추가되었다. `TERMINAL_STATUSES` 상수의 동기화 경고, age 상수의 의도 주석 등 전반적으로 문서화 수준이 높다. 남은 INFO 수준 갭은 세 가지다: (1) `TERMINAL_REVOKE_RECONCILE_QUEUE` 가 별도 types 파일이 아닌 서비스 파일에 위치해 기존 큐 상수 패턴과 불일치하는 점, (2) `batchLimit` 외부 주입 불가 여부가 JSDoc 에 미명시된 점, (3) plan 문서의 D3=A 경위 추가가 현재 diff 에서 확인되지 않아 실제 반영 여부가 불명확한 점. 긴급 수정을 요하는 항목은 없다.

## 위험도

NONE
