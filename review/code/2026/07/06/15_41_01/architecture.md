### 발견사항

- **[INFO]** 순환 의존성 회피 기법이 `ModuleRef(strict:false)` 지연 해석 방식으로 도입되어 기존 `forwardRef()` 패턴과 병존
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:388-395` (`getWebsocket`), `notifications.module.ts:35-39` (주석)
  - 상세: NestJS 에서 모듈 간 순환 의존은 통상 `forwardRef(() => X)` 로 해결하지만, 본 PR 은 nodes 배럴(`integrations→notifications→…`) 초기화 경로에서 발생하는 **require 순환**(`WebsocketModule`→`workflows`→`import-workflow.dto` 의 top-level `[...ALL_NODE_TYPES]` spread 미초기화)을 이유로 `ModuleRef.get(WebsocketService, { strict: false })` 런타임 지연 해석을 택했다. 두 기법이 코드베이스에 공존하면 신규 기여자가 "언제 forwardRef, 언제 ModuleRef" 를 판단할 명문 기준이 없어 다음 순환 발생 시 선택이 임의적일 수 있다. 다만 이번 케이스는 문제의 근본 원인이 모듈 순환이 아니라 **배럴 파일의 즉시-평가(top-level spread) 부작용**이라는 점이 주석에 정확히 진단되어 있어, 통상적 DI 순환과는 결이 다른 정당한 예외로 보인다.
  - 제안: `spec/conventions/` 또는 아키텍처 문서에 "모듈 레벨 순환은 forwardRef, provider 인스턴스를 부팅 이후 시점에만 필요로 하는 optional/best-effort 의존은 ModuleRef(strict:false)" 식의 선택 기준을 1회성으로 명문화하면 재발 시 판단 비용을 줄일 수 있다 (필수 아님, 향후 유사 케이스 누적 시 고려).

- **[INFO]** `ModuleRef` 암묵적 전역 의존 — DI 그래프가 정적 타입 시그니처만으로 드러나지 않음
  - 위치: `notifications.service.ts:377-378` (생성자 `moduleRef: ModuleRef` 파라미터)
  - 상세: 생성자 시그니처만 보면 `NotificationsService` 가 `WebsocketService` 에 의존한다는 사실이 드러나지 않고, `getWebsocket()` 내부를 읽어야 알 수 있다. 이는 의존성 역전이라기보다 **서비스 로케이터 패턴**에 가까워, 컴파일 타임 추적성(누가 무엇에 의존하는지)이 약화된다. 실패 모드(첫 호출 시 `strict:false` 해석 실패)도 런타임까지 지연된다.
  - 제안: 현재 상태로도 주석이 근거를 상세히 남기고 있어 즉시 조치는 불필요. 다만 이런 우회가 늘어나면 `no-restricted-imports` 류의 정적 가드나 별도 `NotificationsBroadcaster` 포트 인터페이스로 감싸 테스트/추적성을 높이는 방향을 고려할 수 있다.

- **[INFO]** `NotificationsService` 가 영속(persist)과 실시간 브로드캐스트(WS emit) 두 책임을 겸함
  - 위치: `notifications.service.ts:413-483` (`notify`, `createMany`, `emitNew`)
  - 상세: SRP 관점에서 "알림을 저장" 과 "알림을 실시간 채널에 push" 는 서로 다른 축의 책임이다. 다만 emit 은 완전히 best-effort(적재 실패와 무관하게 절대 propagate 하지 않음)로 격리되어 있고, `emitNew` 라는 private 메서드로 분리되어 있어 응집도 저하가 크지 않다. 배치 호출자(background/alerts/integration)가 저장 직후 emit 이 "누락 없이" 일어나야 하는 요구(spec §1·§2.2) 를 고려하면 같은 서비스에 두는 것이 현재 규모에서는 합리적 트레이드오프다.
  - 제안: PR2(이메일 발송)·PR3(신규 발사 소스) 가 이 서비스에 계속 로직을 얹으면 책임이 더 불어난다. 향후 이메일 전송까지 추가되는 시점에 `NotificationDispatcher`(emit+mail 조율) 와 `NotificationsService`(순수 CRUD) 분리를 재고할 가치가 있다 — 이번 PR 범위에서는 불필요.

- **[INFO]** `notify()` 표면이 이번 diff 범위 내 프로덕션 호출자 없이 도입됨 (계획된 dead surface)
  - 위치: `notifications.service.ts:413-437`
  - 상세: 기존 4개 호출자(`background-execution.processor`, `alerts-evaluator.service`, `integration-expiry-scanner.service`, `integration-action-required-notifier.service`)는 모두 여전히 `createMany` 를 사용하고 `notify()` 는 아직 배선되지 않았다. 계획 문서(`plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md`)에 PR3 에서 `execution_failed`/`schedule_failed`/`team_invite` 발사원이 `notify()` 를 경유하도록 예정되어 있어 의도된 단계적 도입으로 보인다.
  - 제안: 문제 없음 — PR 분할 전략과 일치. PR3 병합 전까지 `notify()` 가 미사용 상태로 오래 방치되지 않도록만 후속 추적.

- **[INFO]** `notify()`/`createMany()` 간 row 매핑·null 정규화 로직 중복
  - 위치: `notifications.service.ts:423-433` (`notify`) vs 기존 `createMany` 매핑부(다이어그램상 `:445-450` 부근), 그리고 `emitNew` 내부 `?? null` 정규화가 이미 entity 레벨과 emit 레벨 이중으로 존재
  - 상세: 두 메서드가 거의 동일한 필드 조립(`workspaceId/userId/type/title/message/channel/resourceType/resourceId`) 로직을 각자 갖고 있어 향후 필드 추가 시 양쪽 동기화 누락 위험이 있다. `resourceType/resourceId` null 정규화도 `notify`/`createMany` 각각과 `emitNew` 양쪽에서 이뤄져 이중 방어 형태다.
  - 제안: `buildNotificationRow(entry)` 헬퍼로 공통 추출하면 확장(예: PR2 의 `channel`/`email_sent_at` 관련 필드)이 한 곳에서 이뤄져 유지보수성이 개선된다. 아키텍처 결함은 아니며 유지보수성 축의 개선 여지.

### 요약

이번 변경은 알림 영속 계층에 실시간 WS emit 을 추가하는 좁고 명확한 확장으로, 기존 레이어 구조(Controller/Service/Entity, WebsocketService 의 게이트웨이 브로드캐스트 위임)를 그대로 준수하며 새로운 순환 참조나 레이어 경계 침범을 만들지 않는다. 유일한 아키텍처적 특이점은 nodes 배럴의 top-level side-effect(즉시평가 `[...ALL_NODE_TYPES]`)로 인한 require 순환을 피하기 위해 `ModuleRef(strict:false)` 지연 해석을 도입한 점인데, 근본 원인이 정확히 진단되고 주석으로 문서화되어 있으며 best-effort try/catch 로 실패를 완전히 격리해 호출자에 전파하지 않도록 설계되어 있어 위험이 낮다. `notify()`/`createMany()` 의 책임 중복, 소량의 매핑 로직 중복, `notify()` 의 현재 미배선 상태는 모두 PR1→PR2→PR3 단계적 슬라이스 전략상 의도된 과도기적 형태로, 구조적 결함이라기보다 후속 PR 에서 자연히 정리될 여지로 판단된다.

### 위험도
LOW
