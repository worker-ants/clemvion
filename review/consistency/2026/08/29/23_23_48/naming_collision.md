STATUS=success naming_collision review complete — 0 CRITICAL, 0 WARNING, 1 INFO

### 발견사항

- **[INFO]** 이번 diff 는 기존 명칭 충돌을 "해소"한 것이지 새로 도입한 것이 아니다
  - target 신규 식별자: `InAppNotificationEventType` (`codebase/backend/src/modules/websocket/websocket-events.types.ts`, enum 선언 및 `websocket.service.ts` re-export/사용처 6곳)
  - 기존 사용처: `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts` 에 이미 `NotificationEventType` (outbound webhook 구독 화이트리스트, `execution.*` 5값)이라는 **동명이의** 타입이 있었고, 종전에는 WS 인앱 알림 enum 도 같은 이름 `NotificationEventType` 을 썼다 (`18_53_27` naming W3 로 이미 등재된 이슈).
  - 상세: 이번 커밋(`b86e541db`)은 WS 쪽 enum 을 `NotificationEventType` → `InAppNotificationEventType` 로 개명해 동명 충돌을 실제로 제거했다. `git grep` 로 전체 코드베이스(`codebase/`, `spec/`)를 확인한 결과 개명이 6개 사용처(enum 선언, JSDoc `@link`, `websocket.service.ts` import/re-export/호출부)에 완전히 전파됐고, `NotificationEventType` 이라는 이름은 이제 `notification-config.dto.ts` 한 곳(선언 + 2개 사용처)에만 남아 더 이상 동명이의가 아니다. `spec/` 전체에서 `NotificationEventType` 심볼명을 직접 인용하는 곳은 없었다(spec 은 wire-level 이벤트 이름 `notification.new` 만 참조) — 따라서 이 rename 이 spec 문서를 stale 하게 만들지도 않는다.
  - 새 이름 `InAppNotificationEventType` 자체도 `codebase/frontend`, `codebase/packages`, `codebase/channel-web-chat`, `spec/` 전역에서 사전 사용례가 없어 새 충돌을 만들지 않았고, 자매 enum 명명 규칙(`ExecutionEventType` · `NodeEventType` · `BackgroundRunEventType` · `KbEventType`, 즉 `<도메인>EventType`)과도 부합한다.
  - 제안: 조치 불요 — 기록 목적의 INFO. 향후 유사 동명이의가 재발하면(예: 새 도메인이 또 `NotificationEventType` 이라는 이름을 재사용) 같은 disambiguation 패턴(도메인 접두) 을 선례로 참조할 것.

### 요약

이번 diff 범위(`codebase/backend/src/modules/{websocket,triggers}` 의 enum rename + 테스트 보강)는 `spec/data-flow/` 자체를 전혀 변경하지 않았고(`git diff origin/main...HEAD -- spec/` 결과 0건), 신규 요구사항 ID·엔티티/DTO 명·API endpoint·이벤트 와이어 이름(`notification.new` 는 불변)·ENV/설정키·spec 파일 경로 중 어느 것도 새로 도입하지 않았다. 유일한 신규 식별자는 TS enum `InAppNotificationEventType` 이며, 이는 기존에 이미 문서화되어 있던 `NotificationEventType` 동명이의 충돌(`18_53_27` naming W3)을 주석 방어에서 이름 자체 분리로 격상해 **해소**한 변경이다. 전체 코드베이스 grep 으로 rename 전파 완전성과 신규 이름의 무충돌을 확인했다. 신규 식별자 충돌 관점에서 이 변경은 위험을 추가하지 않으며 오히려 기존 위험을 낮춘다.

### 위험도
NONE
