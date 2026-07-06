# 보안(Security) Review

## 발견사항

- **[INFO]** WS emit 은 이미 존재하는 fail-closed 채널 인가에 의존 — 신규 회귀 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `emitNotificationEvent()`
  - 상세: `notification.new` 는 `notifications:<userId>` 채널로 `broadcastToChannel`(소켓 룸 emit)만 수행한다. 룸 구독 시점 인가는 `NotificationsChannelAuthorizer`(사전 존재, 본 diff 미변경)가 JWT `sub === targetUserId` 를 강제하는 fail-closed 방식이라 다른 사용자 채널로 새지 않는다. emit 함수 자체는 인가를 재검증하지 않지만 이는 다른 브로드캐스트 이벤트와 동일한 기존 아키텍처 패턴이라 이번 변경의 신규 취약점이 아니다.
  - 제안: 없음(확인 목적).

- **[INFO]** payload 는 credential 마스킹 대상이 아닌 고정 shape — 정보 노출 위험 낮음
  - 위치: `websocket.service.ts:635-664` `emitNotificationEvent`
  - 상세: 다른 노드-출력 echo 이벤트는 임의 depth 객체를 다루므로 `sanitizePayloadForWs`(credential 키 마스킹)를 거치지만, `emitNotificationEvent` 는 `{id, type, title, message, resourceType, resourceId}` 6개 필드만 명시적으로 뽑아 보내 임의 객체를 echo 하지 않는다. 따라서 자격증명이 우연히 섞여 나갈 표면적이 이 경로엔 없다.
  - 제안: 없음.

- **[INFO]** `title`/`message` 콘텐츠의 XSS 가능성은 이 PR 범위 밖(사전 존재 데이터 소스)
  - 위치: `notifications.service.ts` `notify()` / `createMany()` 호출자(`alerts-evaluator.service.ts`, `integration-expiry-scanner.service.ts`, `background-runs.service.ts` 등, 본 diff 미변경)
  - 상세: 이번 diff는 이미 DB에 적재되던 알림 row를 실시간으로 WS push 하는 경로만 추가했을 뿐 새로운 입력 소스를 열지 않는다. `title`/`message`에 사용자 제어 문자열(예: 워크플로 이름, 워크스페이스명)이 포함될 경우 프런트가 이를 HTML로 렌더링하면 stored XSS 가능성이 있으나, 이는 기존 알림 목록 REST API(`GET /api/notifications`)에도 동일하게 존재하던 표면이며 이번 변경으로 새로 생기거나 악화되지 않는다.
  - 제안: 프런트 알림 UI가 `message`/`title`을 텍스트 노드로만 렌더링(HTML 삽입 금지)하는지 별도 확인 권장(이 PR 범위 밖 후속 점검용).

- **[INFO]** best-effort 에러 삼킴이 민감정보 노출 없이 적절히 처리됨
  - 위치: `notifications.service.ts` `emitNew()`, `websocket.service.ts` `emitNotificationEvent()`
  - 상세: `ModuleRef.get` 또는 broadcast 실패 시 `logger.warn`으로만 기록하고 호출자(REST 응답 등)에 전파하지 않는다. 로그 메시지에 `err.message`를 포함하지만 스택트레이스나 요청 바디 전체가 아니라 예외 메시지 문자열만 남기고, 이는 서버 로그(비공개)에만 기록되며 클라이언트로는 반환되지 않는다. 에러 메시지를 통한 정보 노출 위험은 낮음.
  - 제안: 없음.

- **[INFO]** 순환 의존 회피를 위한 `ModuleRef(strict:false)` 지연 해석 — 인가 우회 아님
  - 위치: `notifications.module.ts`, `notifications.service.ts` `getWebsocket()`
  - 상세: `strict:false`는 NestJS 모듈 캡슐화 범위를 넘어 전역 컨테이너에서 provider를 찾는 옵션이지만, `WebsocketService` 자체에는 인가 로직이 없고(인가는 gateway subscribe 시점 authorizer가 담당) 이 서비스는 싱글턴 emit 유틸리티로만 쓰인다. 인증/인가 우회를 야기하지 않는다.
  - 제안: 없음.

## 요약

이번 변경은 이미 DB에 커밋된 알림 row를 대상으로 `notifications:<userId>` WS 채널에 `notification.new` 이벤트를 best-effort로 실시간 push하는 기능을 추가한다. 채널 구독 인가는 사전 존재하는 `NotificationsChannelAuthorizer`(JWT `sub == userId` fail-closed)에 의해 이미 보장되고 있으며, 이번 diff가 이를 우회하거나 약화시키지 않는다. emit payload는 고정된 6개 필드만 명시적으로 전송해 임의 객체 echo로 인한 credential 유출 표면을 만들지 않고, 에러 처리도 민감정보 없이 warn 로그로만 격리된다(best-effort, 적재 경로에 영향 없음). 새로운 인젝션·인증/인가·하드코딩 시크릿·암호화 이슈는 발견되지 않았다. title/message 콘텐츠의 잠재적 XSS는 기존 REST 알림 API에도 동일하게 존재하는 사전 조건이라 이번 PR의 신규 이슈로 보지 않는다.

## 위험도
NONE
