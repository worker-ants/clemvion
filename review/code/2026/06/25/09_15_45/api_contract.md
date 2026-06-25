# API 계약(API Contract) 리뷰 결과

## 발견사항

### [INFO] `execution.message` SSE 이벤트 — payload `presentations` 필드 타입이 `Record<string, unknown>` 로 느슨함
- 위치: `codebase/channel-web-chat/src/lib/eia-types.ts` — `ExecutionMessageEvent.presentations`
- 상세: `presentations?: Array<Record<string, unknown>>` 는 wire 계약을 TypeScript 수준에서 강제하지 못한다. `AiMessageEvent.presentations` 도 동일한 패턴이므로 기존 관례와 일관적이나, 신규 이벤트 도입 시 더 좁은 `{ config: Record<string, unknown>; output: Record<string, unknown> }` 인터페이스를 명시해 계약을 구체화할 수 있다.
- 제안: `PresentationEnvelope = { config: Record<string, unknown>; output: Record<string, unknown> }` 타입 alias 를 `eia-types.ts` 에 정의하고 `presentations` 필드에 적용하면 클라이언트-서버 계약이 명확해진다. 현재 위험 수준에서 INFO 처리.

### [INFO] `wc:command` `resetSession` — 외부 호스트 호출 시 서버 측 execution 상태 영향 미기술
- 위치: `spec/7-channel-web-chat/2-sdk.md` — `resetSession` 설명 항목
- 상세: `resetSession` 이 SDK 공개 명령으로 spec 에 추가됐다. 현재 spec 에 "closeStream→clearSession→start" 동작이 기술되어 있으나, "진행 중인 execution 의 서버 측 상태가 어떻게 되는가(취소 vs. 고아 상태 유지)" 에 대한 계약이 누락됐다. 외부 호스트가 이 명령을 호출할 경우 기대 동작을 오해할 수 있다.
- 제안: `spec/7-channel-web-chat/2-sdk.md` 의 `resetSession` 설명에 "진행 중 execution 의 서버 측 상태는 변경되지 않는다 — 클라이언트 세션(localStorage) + SSE 스트림만 초기화하며, 동일 `triggerEndpointPath` 의 새 execution 을 시작한다" 를 한 줄 추가 권장.

### [INFO] `execution.message` 이벤트 — spec payload 예시의 `seq`/`timestamp` 필드 주입 경로 미명시
- 위치: `spec/5-system/14-external-interaction-api.md` §5.2 payload 예시
- 상세: spec §5.2 payload 예시에는 `executionId`, `nodeId`, `nodeType`, `presentations`, `seq`, `timestamp` 가 있으나, 엔진 발행 코드(`execution-engine.service.ts` 내 EXECUTION_MESSAGE 발행 블록)의 payload 객체는 `{ nodeId, nodeType, presentations }` 만 포함한다. `seq`/`timestamp`/`executionId` 가 SSE 레이어에서 자동 주입된다면 그 경로가 spec 에 명시되지 않아 클라이언트 개발자가 payload 에서 해당 필드를 직접 읽을 때 혼란이 생길 수 있다.
- 제안: spec §5.2 payload 예시에 `seq`/`timestamp`/`executionId` 가 "SSE envelope 레이어 주입 필드" 임을 괄호 주석으로 명시하거나, 핸들러 payload 예시(`nodeId`, `nodeType`, `presentations` 만)와 SSE 최종 wire 예시를 구분하여 기술.

## 요약

이번 변경의 핵심 API 계약 변경은 SSE 표면에 신규 이벤트 `execution.message` 를 additive 하게 추가하는 것으로, 기존 이벤트(`execution.ai_message`, `execution.node.completed`)를 삭제하거나 payload shape 을 변경하지 않아 하위 호환성이 유지된다. `wc:command` 에 `resetSession` 이 추가됐으나 기존 command 는 변경 없어 breaking change 가 없다. `ExecutionMessageEvent` 타입은 기존 `AiMessageEvent` 패턴과 일관되게 설계됐고, spec(EIA §5.2 R18, 2-sdk §3)·코드·테스트가 삼각 검증되어 계약 완결성이 높다. 발견된 3건은 모두 INFO 수준으로, 타입 정밀도 향상과 문서 보완 권고이며 현재 구현을 차단하지 않는다.

## 위험도

LOW
