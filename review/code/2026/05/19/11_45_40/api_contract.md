# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] WebSocket `NODE_FAILED` 이벤트 페이로드 — 기존 스키마와의 정합성
- 위치: `execution-engine.service.ts` `finalizeAiNode` FAILED 분기 (diff +290~+354)
- 상세: `this.eventEmitter.emitNode(..., NodeEventType.NODE_FAILED, { nodeExecutionId, parentNodeExecutionId, status, error, duration, nodeType, nodeLabel, output, input, interactionData, startedAt, finishedAt })` 로 페이로드를 구성한다. `output` 필드에 `nodeExec.outputData` 전체(에러 shape 포함)가 실려 WebSocket 클라이언트로 전달된다. 기존 `NODE_FAILED` 이벤트도 동일 필드 집합을 사용하는지 spec/5-system/6-websocket-protocol.md §3 기준 확인이 필요하다. 현재 diff 내에서 코드 주석(`spec/5-system/6-websocket-protocol.md §3 — execution.node.failed 단일 발사`)으로 spec 참조가 명시되어 있어 의도적 일치로 보이며, 페이로드 필드 자체는 기존 `NODE_FAILED` shape 과 구조가 동일해 breaking change 는 없다.
- 제안: e2e/contract 테스트에서 `NODE_FAILED` 페이로드 shape 을 assertion 대상으로 포함해 스키마 드리프트를 자동 감지하도록 권장한다.

### [INFO] `handleAiTurnError` 반환 타입 — 내부 함수 시그니처 변경
- 위치: `handleAiMessageTurn` 반환 타입 변경 (diff +83~+94)
- 상세: `handleAiMessageTurn` 의 반환 타입에 `finalStatus?: 'FAILED'` 가 추가됐다. 이 함수는 `private` 이며 외부 HTTP/WebSocket API 에 직접 노출되지 않는다. 소비자는 같은 파일 내 `waitForAiConversation` 뿐이므로 하위 호환성 문제는 없다.
- 제안: 해당 없음.

### [INFO] `sanitizeLastErrorMessage` 를 `integration-oauth.service` 에서 import
- 위치: diff +37 (`import { sanitizeLastErrorMessage } from '../integrations/integration-oauth.service'`)
- 상세: 토큰/시크릿 echo 차단 유틸이 OAuth 서비스에 위치해 있어 현재는 의존 방향이 다소 어색하나, 외부 API 계약에는 영향이 없다. 에러 메시지에 민감 정보가 새어나가지 않도록 sanitize 를 적용하는 것 자체는 올바른 방향이다.
- 제안: 장기적으로 `sanitizeLastErrorMessage` 를 공유 유틸 모듈로 이동하는 리팩터링을 권장한다 (API 계약 관점에서 즉각적 영향 없음).

## 요약

이번 변경은 AI Agent multi-turn 대화 중 handler throw (LLM 429 등)가 발생할 때 `NodeExecution.status` 와 `Execution.status` 를 올바르게 `FAILED` 로 전이시키고, WebSocket `NODE_FAILED` 이벤트를 발사하는 내부 실행 엔진 수정이다. HTTP REST 엔드포인트·URL 경로·요청 검증·인증/인가·페이지네이션·API 버전 관리에는 변경이 없다. WebSocket 이벤트(`NODE_FAILED`) 페이로드는 기존 스키마 필드 집합을 그대로 사용하며 추가·제거된 필드가 없어 기존 프론트엔드 클라이언트와의 하위 호환성이 유지된다. 전반적으로 API 계약 관점의 위험 요소가 없다.

## 위험도

NONE
