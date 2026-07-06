### 발견사항

- **[INFO]** `notify()` 의 `channel` 파라미터(`'in_app' | 'email' | 'both'`) 기본값·override 경로 테스트 부재
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:270-278` (notify), `:303-314` (createMany) / `notifications.service.spec.ts`
  - 상세: `notify`/`createMany` 모두 `entry.channel ?? 'in_app'` 폴백 로직을 갖는데, 신규 테스트 4개(§1 notify, §2.2 createMany)는 전부 `channel` 을 생략한 케이스만 검증한다. `channel: 'email'` 또는 `'both'` 를 명시 전달했을 때 그 값이 그대로 `save` 에 전달되는지 확인하는 케이스가 없다 — 회귀가 나도 이 스펙만으론 못 잡는다.
  - 제안: `channel: 'both'` 등을 명시한 케이스 1개를 `notify` 쪽에 추가해 폴백과 override 두 경로를 모두 회귀 잠그기를 권장. (이메일 발송 자체는 PR2 스코프 밖이라 이 항목은 CRITICAL/WARNING 아닌 INFO.)

- **[INFO]** 기존 4개 `createMany` 호출자(background/alerts/integration×2)의 emit 연쇄에 대한 통합/회귀 테스트 부재
  - 위치: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:177`, `codebase/backend/src/modules/alerts/alerts-evaluator.service.ts:209`, `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts:482`, `codebase/backend/src/modules/integrations/integration-action-required-notifier.service.ts:88`
  - 상세: 이들 서비스의 스펙은 `NotificationsService` 를 인터페이스 레벨 mock 으로 주입하므로(`new NotificationsService(...)` 직접 생성 아님) 생성자 시그니처 변경(ModuleRef 추가)에는 영향받지 않아 회귀 없음 확인. 다만 "기존 배치 호출자도 실시간 push 를 확보한다"는 이번 PR 의 핵심 목적(plan §PR1 설명)이 이 4개 호출자 자신의 스펙에서는 검증되지 않는다 — `createMany` 내부에서 emit 이 호출된다는 사실은 `notifications.service.spec.ts` 에서만 보장되고, 호출자 쪽에서 "내가 createMany 를 부르면 실제로 emit 까지 이어진다"를 계약 테스트로 명시하진 않는다. 계층 분리상 정상적인 설계이나, e2e 부재와 겹쳐 종단 검증 공백이 있다는 점은 인지할 가치 있음.
  - 제안: 필수는 아님(현재 unit 분리 원칙에 부합). e2e 슈트에 인증된 WS 클라이언트가 `notifications:<userId>` 채널을 구독한 상태에서 알림 발생 트리거(예: integration expiry) 후 `notification.new` 수신을 검증하는 케이스가 있으면 최상.

- **[INFO]** `emitNotificationEvent`/`emitNew` best-effort 예외 삼킴 경로는 잘 테스트됨 — 회귀 위험 낮음
  - 위치: `notifications.service.spec.ts` "emit best-effort 격리" describe, `websocket.service.spec.ts` "broadcast 예외를 삼켜..." 케이스
  - 상세: `ModuleRef.get` throw 시 `notify`/`createMany` 가 resolve 유지, `WebsocketService.emitNotificationEvent` 자체에서 `gateway.broadcastToChannel` throw 시에도 `not.toThrow()` — 두 계층 모두 실패 격리를 독립적으로 커버해 방어 심도(defense-in-depth)가 테스트로 명확히 표현됨. `getWebsocket()` 캐싱(1회 해석 후 재사용) 회귀 케이스도 명시적으로 존재. 우수 사례로 참고할 만함.

- **[INFO]** `emitNotificationEvent` 의 `userId` 빈 문자열 no-op 케이스는 있으나 `null`/`undefined` 케이스 미검증
  - 위치: `websocket.service.spec.ts:549-557` ("userId 가 비면 no-op")
  - 상세: 시그니처가 `userId: string` 이라 컴파일 타임에는 `null`/`undefined` 가 차단되지만, 실제 런타임 호출자(`emitNew`)는 `row.userId`(엔티티 필드, TypeORM 이 DB NULL 이면 실제로 `null` 반환 가능)를 그대로 넘긴다. 현재 `if (!userId) return;` 가드가 falsy 전반(`''`, `null`, `undefined`)을 이미 커버하므로 기능적으로는 안전하나, 테스트는 `''` 케이스만 검증해 `null` 전달 시에도 동일하게 no-op 함을 명시적으로 보장하지 않는다.
  - 제안: 우선순위 낮음. `userId: null as any` 케이스를 하나 더 추가하면 타입 경계를 넘는 실제 DB 데이터 형태까지 커버 범위가 넓어짐.

- **[INFO]** `notifications.module.ts` 순환참조 회피 주석의 "실제로 순환이 재발하지 않는다"는 사실 자체에 대한 자동 테스트(가드) 없음
  - 위치: `codebase/backend/src/modules/notifications/notifications.module.ts:35-39`
  - 상세: 주석은 "WebsocketModule 을 여기서 import 하지 않는다"는 불변식을 설명하지만, 이를 어기는 회귀(누군가 나중에 file-level import 를 추가)를 잡아줄 자동 테스트/lint 규칙은 diff 범위에 없다. 유닛 테스트로 이 종류의 순환 문제를 직접 검출하긴 어렵고(모듈 부트스트랩 e2e 필요), NestJS `AppModule` 전체를 로드하는 e2e/smoke 테스트가 있다면 이런 회귀를 잡아낼 수 있다.
  - 제안: 이미 e2e 부트 스모크 테스트가 있는 프로젝트라면 별도 조치 불필요(순환 발생 시 NestJS가 부트 자체에서 실패하므로 기존 e2e 부트가 안전망 역할). 없다면 최소 1개의 "AppModule compiles" 스모크만으로 충분 — 이번 PR 필수 요구사항은 아님.

### 요약
`NotificationsService.notify()`/`createMany()` 신설 emit 경로와 `WebsocketService.emitNotificationEvent`, `ModuleRef` 지연 해석 캐싱 로직 모두 신규 유닛 테스트로 견고하게 커버되어 있다. 특히 "저장된 row 기준으로 emit"(입력이 아닌 saved 우선), "빈 배열 no-op", "resource attribution 없을 때 null 정규화", "ModuleRef 해석 실패/broadcast 실패 모두 best-effort 삼킴 + 1회 캐싱" 같은 핵심 계약이 각각 독립된 테스트 케이스로 명확히 표현되어 가독성·의도 전달이 좋다. 기존 4개 `createMany` 호출자 스펙은 인터페이스 mock 구조 덕분에 생성자 시그니처 변경(`ModuleRef` 추가)에 영향받지 않아 회귀 없음을 확인했다. 남은 갭은 모두 INFO 수준으로 — `channel` override 미검증, 종단(e2e) WS 전달 검증 부재, `userId=null` 실데이터 케이스 미포함 — 모두 이번 PR1 스코프(단일 적재 표면 + WS emit)의 핵심 계약을 위협하지 않는 저위험 보완사항이다.

### 위험도
LOW
