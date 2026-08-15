STATUS=success naming_collision review complete
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — naming_collision

## 검토 컨텍스트

- 모드: `--impl-prep`, scope=`spec/5-system/`
- 대상 작업: `plan/in-progress/ws-event-types-extract.md` — `websocket.service.ts` 상단 선언 블록
  (enum/interface/type, `:6~:340`)을 새 파일 `websocket-events.types.ts` 로 추출하는 **순수 코드 리팩터**
  (`spec_impact: none` — spec 문서 변경 없음).
- 번들된 `spec/5-system/` 중 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 는 전문 포함, 나머지
  15개(4·5·6·7·8·9·10·11·12·13·14·15·16·17·_product-overview)는 컨텍스트 예산 초과로 절단 표시만 있었다.
  이 중 본 작업과 직접 관련된 `6-websocket-protocol.md`·`14-external-interaction-api.md` 는 절단 사실을
  "내용 없음" 으로 간주하지 않고 `Read` 로 직접 열어 확인했다.
- 이 plan 은 spec 을 변경하지 않으므로 spec 레벨의 "신규 식별자"(요구사항 ID·엔티티명·API endpoint·env var·spec 파일 경로)는
  발생하지 않는다. 실질적으로 새로 생기는 식별자는 코드 파일 하나(`websocket-events.types.ts`)와, 거기로 옮겨가는
  기존 export 15종(변경 없이 재배치)뿐이다. 아래는 이 재배치가 기존 사용처와 부딪히는지에 대한 실측이다.

## 발견사항

- **[WARNING]** `NotificationEventType` — 서로 다른 두 의미가 이미 동일 식별자를 공유 중, 리팩터로 노출도가 커진다
  - target 신규 식별자: (신규 도입은 아니나) `websocket.service.ts:197-199` 의
    `export enum NotificationEventType { NOTIFICATION_NEW = 'notification.new' }` 가 plan 에 따라
    새 공유 모듈 `codebase/backend/src/modules/websocket/websocket-events.types.ts` 로 그대로 이동 예정.
  - 기존 사용처: `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts:28`
    `export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number]` —
    값은 `'execution.waiting_for_input' | 'execution.completed' | 'execution.failed' | 'execution.cancelled' | 'execution.ai_message'`
    (spec: `spec/5-system/14-external-interaction-api.md` §3.1 `EIA-NX-02`, outbound notification webhook 구독 이벤트 화이트리스트).
  - 상세: 두 정의는 이름이 완전히 동일(`NotificationEventType`)하지만 도메인이 다르다.
    - WS 쪽(`websocket.service.ts`)은 **인앱 알림 벨**(`notifications:<userId>` 채널의 `notification.new` 1개 값)을 나타내는 enum.
    - triggers DTO 쪽은 **outbound webhook 이 구독 가능한 execution 라이프사이클 이벤트 화이트리스트**(문자열 유니온, 5개 값)를 나타내는 type.
    현재는 두 파일이 이 이름을 동시에 import 하는 지점이 없어 컴파일 충돌은 없다(`grep` 실측, 두 정의 외 사용처 0건).
    다만 plan 은 WS 쪽 정의를 `websocket.service.ts`(단일 서비스 파일)에서 이름부터 "이벤트 타입 전용" 임을
    표방하는 공유 모듈 `websocket-events.types.ts` 로 옮긴다 — 이 이름 자체가 "웹소켓/알림 이벤트 타입의 정본"
    처럼 보이므로, 향후 개발자가 IDE 자동완성으로 `NotificationEventType` 을 import 할 때 두 후보 중
    triggers DTO 쪽이 필요한데도 WS 쪽(또는 반대)을 무심코 선택할 위험이 이전보다 커진다. TS 는 두 타입이
    구조적으로 겹치지 않아 즉시 컴파일 에러를 내지 않을 수 있어(예: enum 값 `'notification.new'` 는 union 5개
    값과 겹치지 않으므로 오용 시 타입 에러가 나긴 하지만, 동일 이름이라 리뷰 시 "같은 개념" 으로 오인되기 쉽다).
  - 제안: 이번 plan 의 범위(§범위 밖: "책임 분리 아님, 값/타입만 이동")를 존중해 **이름 변경은 이번 PR에서 강제하지 않되**,
    새로 만드는 `websocket-events.types.ts` 상단(또는 `NotificationEventType` enum 바로 위) JSDoc 에
    "이 `NotificationEventType` 은 인앱 알림 벨 전용이며, outbound webhook 구독 화이트리스트는
    `triggers/dto/notification-config.dto.ts` 의 동명 타입(별개)" 이라는 상호 참조 주석을 추가해 혼동을
    구조적으로 남기지 말 것을 권장한다. 근본 해소(예: WS 쪽을 `InAppNotificationEventType` 등으로 rename)는
    이번 plan 범위 밖이므로 후속 항목으로 트래커에 남기는 것을 권장.

## 그 외 점검 결과 (수집만, 문제 없음)

- **요구사항 ID 충돌**: 해당 없음 — `spec_impact: none`, 이 plan 은 spec 을 변경하지 않는다.
- **엔티티/타입명 충돌 (그 외)**: 이동 대상 15개 식별자(`ExecutionEventType`, `NodeEventType`,
  `BackgroundRunEventType`, `KbEventType`, `ExecutionChannelEvent`, `ChatChannelRoutingInfo`,
  `ExecutionRoutingContext`, `ToolCallStartedPayload`, `UserMessagePayload`, `ToolCallCompletedPayload`,
  `NotificationNewPayload`, `MAX_SANITIZE_DEPTH`, `TERMINAL_EXECUTION_EVENTS`, `sanitizePayloadForWs`,
  `CREDENTIAL_KEY_PATTERN`/`SANITIZE_CACHE`/`sanitizeInner`)를 backend 전역 grep 으로 대조한 결과
  `NotificationEventType` 외에는 중복 선언이 없다. `CREDENTIAL_KEY_PATTERN` 은
  `shared/utils/sanitize-error-message.ts` 에도 모듈-private const 로 동명 존재하지만 export 되지 않고
  이미 JSDoc 에서 "mirrors `sanitizePayloadForWs`" 로 의도된 자매 관계임을 명시하고 있어 충돌 아님(그 파일은
  깊이 상수도 `MAX_REDACT_DEPTH` 로 의도적으로 다르게 명명해 겹침을 피해두었다).
- **API endpoint 충돌**: 해당 없음 — 신규 endpoint 없음.
- **이벤트/메시지명 충돌**: `NotificationEventType`(WS) 의 값 `notification.new` 와 `NotificationEventType`(triggers)
  값 5종은 문자열 자체는 겹치지 않는다(전자 1개, 후자 5개 execution.* 계열). 후자의 5개 값은
  `ExecutionEventType`(WS) 의 기존 값들과 문자열이 동일한데(`execution.waiting_for_input` 등), 이는 outbound
  webhook 이 동일 execution 라이프사이클 이벤트를 구독한다는 설계상 의도된 재사용이며 `EIA-NX-02` 로 spec 에
  명시되어 있어 충돌이 아니다.
- **환경변수·설정키 충돌**: 해당 없음 — 신규 env/config key 없음.
- **파일 경로 충돌**: 신규 파일 `codebase/backend/src/modules/websocket/websocket-events.types.ts` 는
  저장소 전체에 동명/유사 경로가 없고(`grep` 0건), 같은 디렉토리 관례(`*.service.ts`)와 다른 모듈들의
  `*.types.ts` 관례(`notification-dispatcher.types.ts`, `graph-dispatch.types.ts` 등)에도 부합한다. 다만
  spec 파일이 아니므로 본 checker 의 "spec 파일 경로 충돌" 기준(§6) 적용 대상은 아니다.

## 요약

이 작업은 spec 을 변경하지 않는 순수 코드 리팩터(기존 export 15종을 새 모듈로 재배치)라 정의상 "신규 식별자"가 거의 없고,
이동 대상 식별자 15종을 backend 전역과 조회 가능한 spec/5-system/ 범위(전문 3개 + 직접 Read 한 2개)에 대조한 결과
실질적 충돌은 없었다. 유일하게 주의할 점은 `NotificationEventType` 이 WS 인앱 알림(enum, 1값)과 triggers webhook
구독 화이트리스트(type, 5값)라는 서로 다른 의미로 **이미** 동일 이름을 쓰고 있다는 것 — 이번 plan 이 이를 새로 만들지는
않지만, WS 쪽 정의를 이름 자체가 "이벤트 타입 정본"처럼 보이는 공유 모듈로 옮기면서 향후 오상상(오import) 위험을
키운다. 이번 PR 범위에서 강제 차단할 사안은 아니며, 새 파일에 상호 참조 disambiguation 주석을 남기는 정도의 경량 조치로
충분하다.

## 위험도

LOW
