STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 리뷰

## 발견사항

해당 없음.

검토 대상 5개 파일은 모두 `codebase/backend/src/modules/execution-engine/` 내부 상태 전이 로직·DI 인터페이스이며, 이번 diff(`2ca44b769` "retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함" + 후속 스펙/테스트 커밋)는 다음 범위에 한정된다:

- `state/state-machine.ts` — `canTransition`/`assertTransition` 의 `allowRetryReentry` opt-in 대상에 `WAITING_FOR_INPUT` 을 추가 (내부 전이 검증 함수, export 되지만 소비처는 `execution-engine.service.ts`·`retry-turn.service.ts` 단 둘 — 모두 같은 모듈 내부).
- `execution-engine.service.ts` — `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 상수 신설 + `lockNonTerminalExecutionRow`/`tryLockActiveExecutionAndSaveNodeExec`/`updateExecutionStatus` else 분기의 SQL guard 가 `opts.allowRetryReentry` 를 실제로 반영하도록 수정 (private/internal 메서드, DB 가드 SQL 조립 로직).
- `ai-turn-orchestrator.service.ts` — `reparkAiResumeTurn` 호출부 4곳 + `tryLockActiveExecutionAndSaveNodeExec` 호출부 2곳에 `retryReentry` 플래그 전파.
- `engine-driver.interface.ts` — `AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec` 시그니처에 `opts?: { allowRetryReentry?: boolean }` 매개변수 추가 (엔진 내부 전용 DI 계약, `ENGINE_DRIVER` 토큰으로만 주입되며 모듈 외부에 노출되지 않음).
- `retry-turn.service.ts` — `canTransition` 사용부만 리뷰 컨텍스트에 포함, 이번 diff 자체 변경분은 없음(주변 문맥).

이 5개 파일이 구현하는 실제 대외 진입점은 `RetryTurnService.retryLastTurn(executionId, nodeExecutionId): Promise<{ spawnedNodeExecutionId: string }>` 과 `applyRetryLastTurn(executionId, spawnedNodeExecutionId): Promise<void>` 인데, 두 메서드의 시그니처는 이번 diff 로 전혀 바뀌지 않았다. 이 메서드를 호출하는 `websocket.gateway.ts`(`execution.retry_last_turn` WS 커맨드 핸들러, 인증/인가 컨텍스트 처리)와 `continuation-execution.processor.ts`(BullMQ worker) 역시 이번 커밋 diff 목록에 없다 — `git show --stat` 로 확인.

즉 이번 변경은:
- REST 컨트롤러·DTO·라우트를 전혀 건드리지 않는다 (`@Controller`/`@Get`/`@Post`/`@Body`/`@Param` 등 이번 diff 어디에도 없음, grep 확인).
- WebSocket 프로토콜의 메시지 이름·payload 필드 shape 을 바꾸지 않는다 — 후속 커밋(`1838c6fec`)의 `spec/5-system/6-websocket-protocol.md`/`spec/5-system/4-execution-engine.md`/`spec/4-nodes/3-ai/1-ai-agent.md` 수정도 기존에 문서화된 `execution.retry_last_turn`(§4.2) 동작을 설명하는 서술 보강(§1.1 전이표에 `failed → waiting_for_input` 행 추가, ASCII 다이어그램 갱신)일 뿐, 신규 필드·신규 이벤트 타입을 도입하지 않는다.
- HTTP 상태 코드·에러 응답 형식·페이지네이션·URL 설계·인증/인가 경계 중 어느 것도 다루지 않는다.

요컨대 이 fix 는 "이미 계약된(spec §4.2 문서화) `retry_last_turn` 재진입이 DB 가드 버그로 구조적으로 0행만 매칭돼 절대 성공하지 못했던" 결함을 고쳐, 문서화된 대로 동작하게 만드는 내부 엔진 수정이다. 클라이언트가 관측하는 요청/응답 스키마는 변경 전후 동일하다(다만 버그가 고쳐졌으므로 이제 실제로 의도한 성공 경로를 탈 수 있다는 동작 차이는 있음 — 이는 계약 변경이 아니라 계약 이행의 회복).

## 요약

이번 변경 세트(`state-machine.ts`, `execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`, `engine-driver.interface.ts`, `retry-turn.service.ts`)는 execution-engine 모듈 내부의 상태 전이 검증·DB 가드 SQL·엔진 내부 DI 인터페이스에 한정된 버그 수정이며, REST 컨트롤러·WebSocket 게이트웨이 핸들러·DTO 등 외부 노출 API 계약 표면을 전혀 포함하지 않는다. `RetryTurnService` 의 대외 진입점 시그니처와 이를 호출하는 `websocket.gateway.ts`/`continuation-execution.processor.ts` 는 이번 diff 밖이며, 후속 spec 문서 수정도 기존 §4.2 문서화 동작을 명확히 하는 서술 보강일 뿐 새 필드·메시지 타입 도입이 아니다. 따라서 API 계약(하위 호환성/버전관리/응답형식/에러응답/요청검증/URL설계/페이지네이션/인증인가) 관점에서 검토할 대상이 없다.

## 위험도

NONE
