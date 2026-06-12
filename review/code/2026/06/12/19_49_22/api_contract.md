# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** Swagger UI 게이팅 변경 — production 기본 비노출 적용
  - 위치: `codebase/backend/src/main.ts`, `codebase/backend/src/common/config/production-guards.ts`
  - 상세: `isSwaggerEnabled()` 함수를 통해 production 환경에서 `/docs` 엔드포인트가 기본 비활성화된다. `ENABLE_SWAGGER_IN_PROD=true` opt-in 시에만 노출. 이는 API 계약(Swagger 스키마) 노출 범위에 영향을 주는 명시적 행동 변경이다. 기존에 production 에서 `/docs`에 접근하던 클라이언트·도구가 있다면 `404` 혹은 연결 거부를 받게 된다.
  - 제안: 해당 없음 — 의도된 보안 강화이며, 배포 runbook/운영 문서에 `ENABLE_SWAGGER_IN_PROD` env 옵션이 명시되어야 한다(API 계약 관점 하위 호환성 영향 없음, `/docs` 는 정규 API 엔드포인트 아님).

- **[INFO]** WebSocket 채널 인가 컨텍스트 확장 — `workspaceId` 단독에서 `{ workspaceId, userId }` 객체로 서명 변경
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (authorizer 인터페이스)
  - 상세: `authorize(channel, workspaceId: string)` → `authorize(channel, ctx: { workspaceId: string; userId: string })` 로 변경. WebSocket `subscribe` 이벤트의 응답 형식(`{ event: 'subscribed', data: { success, error? } }`)은 그대로 유지된다. 신규 채널(`workflow:`, `notifications:`) 추가는 기존 채널 동작에 영향 없음.
  - 제안: 내부 전략 패턴 인터페이스 변경이므로 외부 API 클라이언트 영향 없음. 정상.

- **[INFO]** 새 WebSocket 채널 타입 추가 — `workflow:<uuid>`, `notifications:<userId>`
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (channelAuthorizers 배열)
  - 상세: 두 신규 채널 타입이 추가되었다. `workflow:` 는 IDOR 차단 용도, `notifications:` 는 선제적 fail-closed(emit 미구현 상태). 기존 채널(`execution:`, `kb:`, `background:run:`)의 인가 로직은 변경 없음 — 하위 호환성 유지.
  - 제안: `notifications:` 채널 emit 이 실제 구현될 때, subscribe 응답에 포함되는 에러 메시지 문자열(`'Not authorized for these notifications'`)이 클라이언트 코드에서 파싱되고 있다면 계약 고정 대상이다.

- **[INFO]** ReDoS 방어 — 사용자 regex 거부 시 조건 평가 결과 변경 가능
  - 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts`, `filter.handler.ts`, `transform.handler.ts`
  - 상세: 길이 200 이내의 ReDoS-unsafe 패턴이 이제 `compileRegexCache`에서 skip된다. 기존에 우연히 컴파일에 성공하던 짧은 위험 패턴이 이제 no-match로 처리된다. 이는 조건 노드의 런타임 평가 결과가 달라질 수 있는 동작 변경이다. Filter 의 `meta.invalidRegexPatterns`에 해당 패턴이 포함되므로 API 응답에서 확인 가능.
  - 제안: 기존 워크플로에서 ReDoS-unsafe 패턴을 조건으로 사용 중인 경우, 해당 조건이 항상 false(no-match)로 평가된다는 점을 운영자에게 공지하는 것이 좋다. Filter 응답의 `meta.invalidRegexPatterns` 필드를 통해 클라이언트가 감지할 수 있다.

## 요약

이번 변경은 보안 강화(production Swagger 게이팅, WebSocket IDOR 차단, ReDoS 방어) 위주의 리팩터링이다. 외부 REST API 엔드포인트의 URL, 응답 스키마, 에러 응답 형식, HTTP 상태 코드, 인증/인가 방식은 변경되지 않았다. WebSocket subscribe 응답(`{ event, data: { success, error? } }`)도 구조가 유지된다. 눈에 띄는 breaking change 없음. `/docs` 엔드포인트의 production 비노출은 API 계약이 아닌 API 문서 가시성의 변경이며 명시적 opt-in escape hatch가 제공된다. ReDoS-unsafe regex의 silent no-match 처리는 Filter `meta.invalidRegexPatterns`로 클라이언트가 감지 가능하다.

## 위험도

NONE
