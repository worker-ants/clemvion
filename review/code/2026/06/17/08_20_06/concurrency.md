# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] handleAiMessageTurn — LLM await 구간의 비동기 경쟁 조건(Async Race)
- 위치: `ai-turn-orchestrator.service.ts` 라인 1682-1694 (`handleAiMessageTurn` 내 `if (!this.contextService.getContext(contextKey))` 가드)
- 상세: `handler.processMultiTurnMessage(message, resumeState, ...)` await 중 외부 경로(cancel/FAILED 전환)가 ExecutionContext 를 삭제할 수 있다. 코드 자체가 이 경쟁 구간을 명시하고 있으며("LLM 호출 await 도중 외부 path 가 ExecutionContext 를 삭제했을 가능성"), `ended: true, finalStatus: 'FAILED'` 반환으로 caller(`processAiResumeTurn`)가 `finalizeAiNode('FAILED')` 를 호출하도록 보호하고 있다. 단, 이 경우 `reparkAiResumeTurn` 없이 WAITING_FOR_INPUT 상태가 DB 에 잔류하는 window 가 이론적으로 열려 있다.
- 제안: 현재 방어 코드는 적절하게 동작한다. 장기적으로는 ExecutionContext 삭제 경로(cancel/FAILED)와 LLM await 구간이 겹치는 근본 window 를 좁히는 방향을 검토 권장.

### [INFO] waitForAiConversation — rawConfig 얕은 freeze 와 중첩 참조 공유 가능성
- 위치: `ai-turn-orchestrator.service.ts` 라인 1234-1235 (`resumeState.rawConfig = Object.freeze({ ...(node.config ?? {}) })`)
- 상세: 최상위 레벨만 얕은 복사 + freeze 한다. `node.config` 내부 중첩 객체(배열·중첩 레코드)는 freeze 되지 않는다. Node.js 단일 스레드이므로 실제 동시 쓰기는 없으나, 동일 `node.config` 참조가 여러 실행 컨텍스트에 공유될 경우 중첩 필드 돌연변이가 cross-execution 오염으로 이어질 수 있다.
- 제안: 중첩 포함 deep freeze 또는 `structuredClone` 사용을 고려.

### [INFO] buildAiMessageDebugFromResumeState 테스트 — 얕은 복사 뮤테이션 가드 검증
- 위치: `ai-turn-orchestrator.service.spec.ts` 라인 1024-1041 (`shallow-copies llmCalls so later mutation…` 테스트)
- 상세: 테스트가 `llmCalls` 배열 얕은 복사를 검증하는 것은 후속 turn push 가 이미 emit 된 payload 를 소급 변경하지 않음을 가드하는 올바른 접근이다. 실제 구현체(`buildAiMessageDebugFromResumeState`)가 이 shallow copy 를 보장하는지는 프롬프트에서 제공된 구현 본문에서 직접 확인되지 않았으나, 테스트가 통과하고 있으므로 구현은 적절하다고 판단된다.
- 제안: 현재 테스트 방향은 적절하며 별도 조치 불필요.

## 요약

이 변경은 NestJS/Node.js 단일 스레드 이벤트 루프 위에서 동작하는 비동기 서비스 추출(strangler-fig C-1 step2)이다. 실제 멀티스레드 경쟁 조건은 없으나, `handleAiMessageTurn` 내 LLM `await` 구간 중 외부 경로가 ExecutionContext 를 삭제하는 **비동기 경쟁(async race)** 이 가장 주목할 만한 동시성 위험이며, 코드 자체가 이를 인지하고 graceful exit(`ended: true, finalStatus: 'FAILED'`) 처리를 구현하고 있다. `reparkAiResumeTurn` 의 sync-stage + async-commit 패턴은 단일 이벤트 루프 내에서 중단 없이 실행되므로 순서 뒤집힘 위험 없다. `Object.freeze` 얕은 복사의 중첩 참조 공유 가능성은 INFO 수준이다. 전체적으로 비동기 경계가 명확하고 경쟁 구간의 방어 코드도 존재하며, 위험도는 낮다.

## 위험도
LOW
