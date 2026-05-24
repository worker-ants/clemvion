# 보안(Security) 리뷰 — fix-chat-channel-dispatcher-and-cafe24-warn

리뷰 대상 파일 9개 (5 TS 구현 / 2 TS 테스트 / 1 MD 플랜 / 1 MD 일관성 보고서)

---

## 발견사항

### [INFO] `extractChatChannelFromInput` — raw 객체 전체 통과 (제한적 위험)
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `extractChatChannelFromInput` 함수 (L271-287)
- 상세: `provider`와 `conversationKey` 두 필드만 문자열 검증 후, `raw` 객체 전체(`Record<string, unknown>`)를 그대로 반환한다. 주석도 "sanitize 는 WebsocketService 측에서 적용"이라 명시하고 있고, 실제로 `attachRoutingContext` 내부에서 `sanitizePayloadForWs`가 적용된다. 그러나 sanitize가 credential 키 이름 패턴에만 의존하므로, `chatChannel` 내부에 이름이 패턴과 다른 민감 필드(예: `bot_token`, `signing_secret` 등 커스텀 필드명)가 포함된 경우 내부 subscriber(fanout envelope)로 노출될 수 있다.
- 제안: `extractChatChannelFromInput`에서 허용 필드 목록(`provider`, `conversationKey`, `channelUserKey`)만 allowlist 방식으로 추출하여 반환하도록 변경한다. "provider-specific 추가 필드도 dispatcher 가 필요로 할 수 있다"는 근거가 있지만, 현재 spec이 명시하는 필드 외의 필드는 명시적으로 허용 목록을 관리하거나 dispatcher 측에서 DB 조회로 대체하는 것이 더 안전하다.

---

### [INFO] `CREDENTIAL_KEY_PATTERN` — 불완전한 키 이름 커버리지
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` L127
- 상세: 현재 패턴은 `password|passwd|pwd|api[_-]?key|secret|token|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret|authorization|cookie`를 커버한다. `bot_token`, `signing_secret`, `webhook_secret`, `bearer`, `credential`, `pem`, `passphrase` 같은 변형은 미포함이다. `chatChannel` 객체가 provider-specific 추가 필드를 허용하는 현재 구조에서 커버리지 공백이 존재한다.
- 제안: 패턴에 `bot[_-]?token`, `signing[_-]?secret`, `webhook[_-]?secret`, `bearer`, `credential`, `passphrase`, `pem` 등을 추가하거나, 앞서 제안한 allowlist 방식과 함께 사용한다. 두 방법은 독립적으로 적용 가능하며 함께 쓰면 defense-in-depth가 강화된다.

---

### [INFO] `executionRouting` Map — 메모리 누수 가드의 에지 케이스
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `executionRouting` Map (private field)
- 상세: terminal event 발송 후 자동 release되는 구조이고, 엔진 setup 단계 throw 시 `releaseExecutionRouting`를 catch 블록에서 호출하는 방어 코드도 있다. 그러나 `emitNodeEvent` 경로에서는 terminal event에 의한 자동 release가 없다(node 이벤트는 자체 terminal event가 없음). 이 경로는 별도 누수 위험은 아니나 `emitExecutionEvent`의 terminal event에 의존하므로 execution이 영원히 완료되지 않는 비정상 케이스에서는 Map이 영구 보존된다.
- 제안: 현재 구조는 대부분의 시나리오에서 충분하다. 추가 방어를 원한다면 `WebsocketService` 레벨에서 일정 시간 경과 후 자동 만료되는 TTL 정책을 고려할 수 있다. 단, 이는 현 PR 범위 밖의 개선 사항이다.

---

### [INFO] `registerExecutionRouting` — 동일 executionId 덮어쓰기 허용
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `registerExecutionRouting` (L742-748)
- 상세: 같은 `executionId`로 재호출 시 이전 context를 무조건 덮어쓴다. 주석에도 명시되어 있지만, race condition 시나리오(예: 동일 executionId에 두 번의 register 호출이 거의 동시에 발생하는 경우)에서 두 번째 호출자가 첫 번째의 routing context를 덮어써 잘못된 `triggerId` / `chatChannel`이 첨부될 수 있다. 현재 단일 인스턴스 in-process 아키텍처에서는 실질적 위험이 낮다.
- 제안: 현재 사용 패턴(execute() 진입 1회 호출)에서는 문제없다. 분산 환경으로 확장 시 Redis 기반 atomic set-if-absent 패턴을 고려한다.

---

### [INFO] MCP Tool Provider — `null` sentinel 반환으로 throw 제거
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` `openServer` / `materializeServer` 변경
- 상세: 이전에는 `serviceType !== 'mcp'` 시 `throw new Error(...)` 하여 `Promise.allSettled`가 잡고 WARN 로그를 남기는 흐름이었다. 변경 후 `null` sentinel 반환으로 WARN이 제거되었다. 보안 관점에서 이 변경은 에러 경로의 가시성을 낮추지 않는다 — 실제 연결 실패(`connected` 상태 아닌 경우)는 여전히 `throw`로 처리되고, 단순히 "본 provider 가 처리할 대상 아님"인 라우팅 미스매치만 silent skip으로 변경되었다. 이는 적절한 구분이다.
- 제안: 특이 사항 없음. 현재 구현이 적절하다.

---

### [INFO] 에러 메시지에서의 정보 노출
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L779 (`error.message`) 및 `mcp-tool-provider.ts` `openServer` 내 throw 메시지들
- 상세: catch 블록에서 `error instanceof Error ? error.message : String(error)`를 `this.logger.error`에 전달한다. 서버 측 로그이므로 외부 노출은 아니나, DB 연결 문자열이나 경로 정보가 error.message에 포함될 경우 서버 로그를 통한 내부 정보 노출 가능성이 있다. 현 변경 범위(MCP null sentinel 변경 후)에서는 통합 ID가 throw 메시지에 포함되지만(`Integration ${ref.integrationId} is not connected`) 이는 내부 서비스 간 통신이므로 낮은 위험이다.
- 제안: 로그 출력 시 통합 ID 등 내부 식별자를 obfuscate하거나, 구조화 로깅에서 `integrationId`를 별도 필드로 분리하여 민감도를 명확히 구분하면 더 좋다.

---

### [INFO] 하드코딩된 시크릿 — 발견 없음
- 분석 대상 diff 전체에서 API 키, 토큰, 비밀번호, 인증서 등의 하드코딩된 시크릿은 발견되지 않았다. 테스트 파일의 `'trg-tele'`, `'12345'`, `'user-1'` 등은 모두 테스트 픽스처값이다.

---

### [INFO] 인증/인가 — 직접적 변경 없음
- `registerExecutionRouting` / `releaseExecutionRouting` API는 `WebsocketService`의 `private` 메서드 및 `ExecutionEventEmitter` 위임을 통해서만 호출된다. 외부에서 직접 호출 불가한 구조이다. `triggerId` 등록을 통해 잘못된 trigger로 라우팅될 가능성은, `options.triggerId`가 실제 DB에 저장된 trigger의 ID여야 한다는 상위 검증에 의존한다. 해당 검증이 `execute()` 호출 전 충분히 이루어지는지는 이 diff 범위 외 코드에서 확인해야 한다.

---

## 요약

이번 변경은 chat-channel dispatcher에 routing context(triggerId/chatChannel)를 전달하기 위한 내부 fanout envelope 보강 및 MCP tool provider의 silent skip 패턴 도입이다. 보안 관점에서 핵심 양성 요소는 두 가지다. 첫째, wire envelope(frontend 노출)와 fanout envelope(internal subscriber)를 명시적으로 분리하여 `triggerId` / `chatChannel`이 프론트엔드에 누출되지 않도록 설계한 점. 둘째, `sanitizePayloadForWs`를 `attachRoutingContext` 내에서 chatChannel에도 적용하여 credential 필드가 내부 subscriber에도 노출되지 않도록 defense-in-depth를 갖춘 점. 다만 `extractChatChannelFromInput`이 raw 객체 전체를 통과시키고 sanitize를 하위 레이어에 위임하는 구조에서, `CREDENTIAL_KEY_PATTERN`이 커버하지 못하는 커스텀 provider 필드명이 내부 fanout에 노출될 가능성이 낮게 존재한다. 전반적으로 설계가 보안 의식적이며, 식별된 이슈는 모두 INFO 등급의 개선 권고 수준이다.

---

## 위험도

LOW
