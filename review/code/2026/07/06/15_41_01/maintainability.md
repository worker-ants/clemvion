### 발견사항

- **[INFO]** `notify()` / `createMany()` 의 row 생성 로직 중복
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:272-282`(notify), `:307-320`(createMany 의 `.map` 콜백)
  - 상세: 두 메서드 모두 `workspaceId/userId/type/title/message/channel ?? 'in_app'/isRead:false` 를 동일하게 매핑한 뒤 `if (resourceType) row.resourceType = ...` / `if (resourceId) row.resourceId = ...` 를 반복한다. 필드가 하나 추가되면 두 곳을 동시에 고쳐야 하며 누락 시 `notify` 와 `createMany` 가 조용히 갈라질 위험이 있다.
  - 제안: `private buildRow(entry: {...}): Notification` 헬퍼로 추출해 `notify`/`createMany` 양쪽에서 재사용. (동일 entry 타입이 두 메서드 시그니처에 인라인으로 중복 선언돼 있는 것도 함께 정리 가능 — 공용 타입 alias 로 뽑으면 유지보수 포인트가 하나로 줄어든다.)

- **[INFO]** `emitNew` 의 payload 매핑과 `emitNotificationEvent` 내부 매핑이 구조적으로 동일한 필드를 두 번 나열
  - 위치: `notifications.service.ts:337-344`(emitNew), `websocket.service.ts:645-656`(emitNotificationEvent 내부 `broadcastToChannel` 호출 인자)
  - 상세: `emitNew` 에서 `resourceType: row.resourceType ?? null, resourceId: row.resourceId ?? null` 로 이미 정규화해 넘기는데, `emitNotificationEvent` 내부에서도 동일하게 `notification.resourceType ?? null` 을 다시 적용한다. 기능상 안전(idempotent)하지만 "정규화 책임이 어디에 있는지" 가 두 계층에 분산돼 있어 다음에 필드를 추가하는 사람이 어느 계층에서 정규화해야 하는지 애매해질 수 있다.
  - 제안: 정규화 책임을 `emitNotificationEvent`(wire 경계) 한 곳으로 확정하고, 상위 호출부는 원시 값을 그대로 전달하도록 주석으로 계약을 명시하면 향후 필드 추가 시 혼선을 줄일 수 있다. 현재도 큰 문제는 아니므로 INFO 등급.

- **[INFO]** `getWebsocket()` 지연 해석의 순환참조 회피 배경 설명이 세 곳(모듈 주석, 서비스 클래스 주석, 메서드 JSDoc)에 걸쳐 유사한 문장으로 반복
  - 위치: `notifications.module.ts:35-39`, `notifications.service.ts:13`, `notifications.service.ts:22-29`
  - 상세: 순환참조 회피 배경(nodes 배럴 → workflows → import-workflow.dto `[...ALL_NODE_TYPES]`)을 설명하는 문단이 module 파일과 service 파일에 각각 전문(全文) 형태로 중복 서술돼 있다. 의도적 중복(각 파일 단독으로 읽어도 이해되게 하려는 목적)일 수 있으나, 배경 설명이 바뀔 경우 두 곳을 함께 고쳐야 한다.
  - 제안: 한쪽은 요약 + 반대쪽 파일 참조로 축약해도 되지만, "왜 이렇게 짰는지"를 각 파일에서 즉시 알 수 있게 하려는 의도적 설계라면 현행 유지도 합리적 — 강제 수정 불요, 참고 사항.

### 요약

이번 변경은 가독성이 높고 각 메서드에 왜 이런 구조를 택했는지(순환참조 회피, best-effort 격리, WS payload shape 고정)를 상세한 JSDoc/인라인 주석으로 잘 설명하고 있다. 함수 길이·중첩 깊이·매직 넘버 문제는 없으며, `emitNew`/`emitNotificationEvent`의 try-catch-warn 패턴은 기존 `websocket.service.ts`의 다른 emit 메서드들과 스타일이 일관된다. 네이밍(`notify`, `createMany`, `emitNew`, `getWebsocket`)도 목적이 명확하다. 유일하게 눈에 띄는 것은 `notify()`와 `createMany()` 사이의 row 생성 로직 중복인데, 두 메서드가 항상 동기화돼야 하는 관계이므로 공용 헬퍼로 추출하면 향후 필드 추가 시 누락 위험을 줄일 수 있다(다만 현재 로직 자체가 짧아 실질적 리스크는 낮다). 테스트 파일(`notifications.service.spec.ts`, `websocket.service.spec.ts`)도 회귀 케이스(ModuleRef throw, 빈 userId, best-effort 격리)를 명확한 `describe` 구획으로 잘 조직해 가독성이 좋다. 전체적으로 유지보수성 관점에서 구조적 위험은 없다.

### 위험도
LOW
