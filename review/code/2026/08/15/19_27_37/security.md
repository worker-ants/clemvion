# Security Review

## 변경 개요

이번 diff 는 `websocket.service.ts` 가 export 하던 값(enum)·타입 정의를 의존성-프리 신규 모듈
`codebase/backend/src/modules/websocket/websocket-events.types.ts` 로 추출하고, 25개 호출부의
import 경로를 갱신한 **순수 리팩터**다. `websocket.service.ts` 는 re-export 로 기존 경로를
보존하며, credential 마스킹(`CREDENTIAL_KEY_PATTERN`/`sanitizePayloadForWs`)·외부 fanout
strip(`stripExternalOnlyFields`)·routing context 첨부(`attachRoutingContext`) 등 보안 관련
구현 로직은 전부 원 파일에 그대로 남아 동작이 바뀌지 않았음을 실제 소스(`websocket.service.ts`)
로 직접 확인했다. `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 모듈-스코프 상수화는
순환 참조 문제(#1174)를 해소하기 위한 것으로 이벤트 payload 조립 로직 자체는 동일하다. 나머지
파일들(`chat-channel.dispatcher.ts`, `notification-fanout.service.ts`,
`background-execution.processor.ts`, `sse-adapter.service.ts`, `interaction-stream.controller.ts`,
`ai-turn-executor.ts`, `embedding.service.ts`, `graph-extraction.service.ts` 등)은 모두 import
경로만 변경되었고 로직 변경이 없다. `plan/`·`review/consistency/` 하위 문서 변경 역시 서술 갱신뿐이다.

### 발견사항

- **[INFO]** 보안 관련 JSDoc 주석이 실제 구현이 없는 신규 타입 전용 모듈로 이동해 "고아 주석"이 됨
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:239-246`
  - 상세: `WARN #10 (Security)` 로 시작하는 credential-like 키 마스킹 설명 주석이 이 파일로 옮겨졌지만, 실제 마스킹 구현(`CREDENTIAL_KEY_PATTERN`, `sanitizePayloadForWs`)은 `codebase/backend/src/modules/websocket/websocket.service.ts:51-119`에 그대로 남아 있다. `websocket-events.types.ts`는 파일 헤더에서 스스로 "구현 세부는 타입 모듈에 두지 않는다"고 명시하고 있어(`websocket.service.ts:48-50` 주석과 대구를 이룸) 이 주석 블록이 잘못된 위치에 남은 것으로 보인다. 기능적 결함은 아니나(원본 로직은 무결), 향후 유지보수자가 이 주석을 보고 "이 파일에 마스킹 코드가 있어야 한다"고 오인해 중복/불일치 sanitizer를 만들 위험(SoT 분산)이 있다. 저장소 메모리에 기록된 "방어의 정의를 한 칸 좁게 잡는다"류 실수를 유발할 소지.
  - 제안: 이 주석 블록을 `websocket.service.ts`의 `CREDENTIAL_KEY_PATTERN` 선언부 바로 위로 옮기거나(원래 위치 추정), 타입 모듈에는 "마스킹 구현은 `websocket.service.ts`에 있다"는 pointer 한 줄만 남기고 상세 설명은 제거.

- **[INFO]** `emitTerminalExecution`의 `failed`/`cancelled` 종결 이벤트가 `payload.error`(`TerminalErrorPayload`)를 그대로 wire에 실음
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:145-151` (함수 `emitTerminalExecution`)
  - 상세: 이번 diff의 변경 범위는 아니지만(로직 자체는 no-op 변경, `TERMINAL_SHAPE` 모듈 스코프 이동만), 이 함수는 `wire.error = payload.error`로 에러 객체를 그대로 WS 채널에 발행한다. 호출부가 `sanitizeErrorMessage`(다른 경로에서 사용 확인됨, 예: `background-execution.processor.ts`)를 거치지 않고 원본 에러 메시지를 실을 경우 스택트레이스·내부 경로 등이 외부 구독자(SSE 토큰 보유 채널 포함)에 노출될 수 있다. 다만 `emitExecutionEvent`가 이후 `sanitizePayloadForWs` + `stripExternalOnlyFields`를 적용하므로 credential-key 패턴에 해당하는 키는 마스킹되고 depth 상한도 걸린다 — 이 리뷰 범위에서는 새로 도입된 결함이 아니라 기존 설계이므로 참고용으로만 기재.
  - 제안: (범위 밖 참고) `TerminalErrorPayload`를 채우는 모든 호출부가 `sanitizeErrorMessage` 계열 유틸을 거치는지 별도 turn에서 전수 확인.

## 요약

이번 변경은 WebSocket 이벤트 타입/enum 선언을 순환 참조 회피 목적의 의존성-프리 모듈로 옮기는 기계적 리팩터로, 신규 엔드포인트·사용자 입력 처리·인증/인가 로직·암호화·시크릿 관리 변경이 없다. 기존 보안 통제(credential 키 패턴 마스킹, 외부 fanout 필드 strip, depth 상한을 통한 DoS/누출 방지)는 원본 `websocket.service.ts`에 그대로 남아 있고 직접 소스를 대조한 결과 동작 변경이 없음을 확인했다. 유일한 지적사항은 보안 관련 JSDoc 주석이 실제 구현이 없는 신규 파일로 잘못 이동한 문서 배치 이슈(INFO)로, 기능적 취약점이 아니라 향후 유지보수 시 혼선 가능성에 대한 예방적 지적이다.

## 위험도
NONE
