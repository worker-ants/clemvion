STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 리뷰

## 발견사항

해당 없음.

검토 대상 5개 파일(`state/state-machine.ts`, `execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`, `engine-driver.interface.ts`, `retry-turn.service.ts`)은 모두 `codebase/backend/src/modules/execution-engine/` 내부 상태 전이 검증·DB 가드·엔진 내부 DI 인터페이스이며, REST 컨트롤러·DTO·WebSocket 게이트웨이 핸들러 어느 것도 diff 에 포함되지 않는다 (`git diff main...HEAD --stat -- codebase/` 로 확인 — 이번 브랜치 전체에서 변경된 backend 파일은 이 5개 + 대응 `*.spec.ts` 4개뿐).

이번 라운드(2026-07-30 17:37) 시점의 diff 내역을 직전 라운드(16:42, `review/code/2026/07/30/16_42_36/api_contract.md`, NONE 판정) 대비 재확인한 결과, 그 사이 병합된 커밋(`3c306d593`, 10R CRITICAL)은 이 5개 리뷰 대상 파일 중 `engine-driver.interface.ts` 에 `tryLockActiveExecutionAndSaveNodeExec` 의 `opts.allowRetryReentry` 파라미터를 설명하는 **JSDoc 6줄**만 추가했을 뿐, 시그니처·동작은 이전 라운드와 완전히 동일하다(같은 커밋은 그 외 `*.spec.ts` 테스트 파일과 frontend 사용자 가이드 mdx 만 변경). 즉 API 계약 관점에서 이번 라운드는 직전 라운드와 **판단을 바꿀 근거가 없다**.

세부 확인 사항:

- **하위 호환성**: `state-machine.ts` 의 `canTransition`/`assertTransition` 은 `allowRetryReentry` opt-in 대상에 `WAITING_FOR_INPUT` 을 추가하는 것으로, 기존 허용 전이표를 축소하지 않는 순수 additive 변경. `execution-engine.service.ts`/`engine-driver.interface.ts`/`ai-turn-orchestrator.service.ts` 의 `tryLockActiveExecutionAndSaveNodeExec`/`updateExecutionStatus`/`reparkAiResumeTurn` 모두 신규 `opts?: { allowRetryReentry?: boolean }` 를 **옵션**으로 추가했고 기존 호출부(옵션 미전달)는 종전과 동일하게 동작한다(기본값 유지). 이 인터페이스들은 `ENGINE_DRIVER` DI 토큰으로만 모듈 내부에서 소비되며 외부에 노출되지 않는다.
- **버전 관리**: REST/WS 버전 체계에 영향 없음 — 새 엔드포인트·새 메시지 타입 도입 없음.
- **응답 형식/스키마**: `RetryTurnService.retryLastTurn`/`applyRetryLastTurn` 의 공개 시그니처는 변경 없음. 유일하게 wire 상 관측 가능한 부수 효과는 `retry-turn.service.ts` 의 `applyRetryLastTurn` 이 claim 성공 직후 `delete spawnedRow.inputData['_retryState']` 를 수행해, 이후 `emitNode(NODE_STARTED, ...)` 의 `input` 페이로드에 내부 전용 키 `_retryState` 가 더 이상 포함되지 않는 것 — 이는 "internal 필드 비노출" 방향의 **개선**(정보 노출 축소)이며 `retry-turn.service.spec.ts:745` 의 명시적 회귀 테스트(`NODE_STARTED emit 의 input payload 는 _retryState 를 포함하지 않는다`)로 잠겨 있다. `execution.node.started` 의 `input` 필드 자체는 이 PR 이전부터 같은 파일 다른 호출부(예: `execution-engine.service.ts` 여러 지점)에서 이미 쓰이던 기존 패턴이라 신규 필드 도입이 아니다.
- **에러 응답**: `RetryLastTurnError` 코드(`RETRY_STATE_NOT_FOUND`/`NODE_NOT_RETRYABLE`/`RETRY_TOO_EARLY`)나 `execution.retry_last_turn.ack` 의 `{ executionId, nodeExecutionId, resumed, error? }` 형태는 이 diff 에서 변경되지 않았다. 이번 변경은 그 문서화된 재진입 성공 경로가 DB 가드 버그로 **항상 0행이라 절대 persist 될 수 없었던** 결함을 고쳐, 문서(spec §4.2)에 이미 서술된 동작을 실제로 도달 가능하게 만든 것 — 계약 자체의 변경이 아니라 계약 이행의 회복이다.
- **요청 검증**: 클라이언트 → 서버 요청 payload(`{ executionId, nodeExecutionId }`)는 손대지 않음.
- **URL/경로 설계**: 해당 없음(REST 라우트 변경 없음).
- **페이지네이션**: 해당 없음(목록 API 아님).
- **인증/인가**: WS 게이트웨이의 인증/인가 처리 코드(`websocket.gateway.ts`)는 이번 diff 밖.

## 요약

이번 변경 세트는 execution-engine 모듈 내부의 상태 전이 검증(state-machine)·DB 가드 SQL(`NON_TERMINAL_OR_FAILED_STATUSES_SQL` 경유)·엔진 내부 DI 인터페이스(`EngineDriver`)에 한정된 버그 수정이며, 외부에 노출된 REST/WebSocket API 계약 표면(컨트롤러·DTO·메시지 타입·ack/에러 shape)을 전혀 건드리지 않는다. 유일한 wire-관측 가능 부수 효과(`NODE_STARTED.input` 에서 내부 키 `_retryState` 제거)는 계약을 좁히는 breaking change 가 아니라 의도치 않게 노출되던 내부 상태를 제거하는 개선이며 회귀 테스트로 고정돼 있다. 직전 라운드(16:42, NONE) 이후 병합된 커밋은 JSDoc 추가뿐이라 판정을 바꿀 근거가 없다. API 계약 관점에서 검토할 대상이 없다.

## 위험도

NONE
