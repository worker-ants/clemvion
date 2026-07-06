# 문서화(Documentation) Review

## 발견사항

- **[INFO]** JSDoc 품질은 전반적으로 양호 — 순환참조 회피 로직 문서화 우수
  - 위치: `codebase/backend/src/modules/notifications/notifications.module.ts:35-39`, `notifications.service.ts:380-387, 458-465`
  - 상세: `NotificationsModule`이 `WebsocketModule`을 file-level import 하지 않는 이유(require 순환 → `ALL_NODE_TYPES` 미초기화)를 모듈 파일 상단 주석과 `getWebsocket()`/`emitNew()` JSDoc 양쪽에 정확하고 일관되게 기술했다. "왜"를 설명하는 근거 중심 주석으로 모범적이다. 서비스 스펙 파일에도 "회귀" 명시 테스트(`getWebsocket — ModuleRef 지연 해석 계약 (회귀)`, `emit best-effort 격리 (회귀 — WARNING #2)`)로 문서화된 계약이 테스트로 고정돼 있어 코드-주석-테스트 삼중 정합이 확인된다.
  - 제안: 없음 (우수 사례).

- **[INFO]** `notify()` / `createMany()` JSDoc이 spec 참조와 책임 경계를 명확히 기술
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:404-412, 439-444`
  - 상세: `notify()` JSDoc이 spec 앵커(`spec/data-flow/8-notifications.md §1`)와 함께 "preference/channel 계산은 호출자 책임", "이메일 발송·`email_sent_at`은 후속 phase(§2.2 Planned)"라고 범위를 정확히 못박았다. `createMany()`에 추가된 한 줄("저장된 각 row에 대해 emit... spec §1·§2.2")도 기존 영어 독스트링(`Persist a batch...`)과 언어가 섞이지만(영어+한국어 혼용), 내용 자체는 정확하고 최신 동작과 일치한다.
  - 제안: 선택적으로 기존 영어 JSDoc을 한국어로 통일하거나 최소 스타일 일관성 코멘트를 남기면 가독성이 개선되나 차단 사유는 아니다.

- **[INFO]** `WebsocketService.emitNotificationEvent` JSDoc이 권위 spec 위치와 fail-open 정책 근거를 명시
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:624-634`
  - 상세: "채널 authorizer가 이미 fail-closed로 배치돼 있어 다른 사용자 채널로 새지 않는다"는 근거를 WS spec §3.3 Rationale과 연결했고, best-effort 정책도 "이메일 실패는 warn만" 기조와의 동형성으로 근거를 남겼다. payload shape가 §4.4 그대로이고 timestamp/seq를 붙이지 않는다는 의도적 설계도 인라인 주석(`websocket.service.ts:642-644`)으로 재확인돼 있어, 향후 다른 이벤트 타입을 참고해 필드를 늘리려는 실수를 예방한다.
  - 제안: 없음.

- **[WARNING]** spec 문서 배지("Planned"/"미구현")가 이번 PR의 실제 구현과 어긋난 상태로 남아있음 (SPEC-DRIFT, 단 이미 추적됨)
  - 위치: `spec/5-system/6-websocket-protocol.md:747, 751, 958-959, 1048` / `spec/data-flow/8-notifications.md` §1, §2.2, Overview, Rationale
  - 상세: 코드는 `WebsocketService.emitNotificationEvent`로 `notification.new`를 실제 emit하지만, spec 본문은 여전히 "emit 코드가 없다", "계획·미구현"이라고 서술한다(직접 확인: `6-websocket-protocol.md:747` "`notification.new` 를 emit 하는 backend 코드가 없다"). 이 자체는 CRITICAL 문서 결함이지만, 이번 diff에 이미 `plan/in-progress/spec-update-notifications-ws-emit.md`가 신설되어 flip 대상 문구·라인을 정확히 지목했고 planner에게 명시 위임했으며, 두 자매 tracker plan(`spec-sync-data-flow-8-notifications-gaps.md`, `spec-sync-websocket-protocol-gaps.md`)의 체크박스도 이 PR에서 `[x]`로 갱신됐다. 즉 "developer는 spec read-only"라는 프로젝트 규약상 정당한 처리이며 후속 조치가 이미 플랜에 기록돼 있다.
  - 제안: 조치 불필요 — planner 세션에서 `spec-update-notifications-ws-emit.md`를 소비해 spec 배지를 flip하면 해소된다. 리뷰 시점 기준으로는 WARNING이 아니라 정상적인 spec read-only 위임 패턴으로 간주.

- **[INFO]** `NotificationNewPayload` 인터페이스 JSDoc이 spec 좌표를 명시하되 optional/null 의미 구분이 다소 모호
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:601-614`
  - 상세: `resourceType?: string | null` 처럼 optional이면서 null도 허용하는 타입에 대해 "attribution이 없으면 null"이라고 기술했으나, 인터페이스 정의상 `undefined`(생략) 케이스가 호출자에게 여전히 허용되는지(즉 `notify()`/`emitNew()`가 항상 null로 정규화하므로 실질적으로 undefined가 발생하지 않는다는 점)는 이 인터페이스 JSDoc만으로는 드러나지 않는다. 실제 정규화는 `emitNew()`(`?? null`)와 `emitNotificationEvent()`(`?? null`) 양쪽에서 이중으로 수행되는데(SUMMARY INFO#9에서도 지적된 "의도적 이중 방어"), 이 이중화 이유가 인터페이스 JSDoc에는 없다.
  - 제안: 필요시 인터페이스 주석에 "실제로는 항상 null로 정규화됨(undefined 미사용) — optional은 호출부 유연성을 위한 타입 여유"라는 한 줄을 추가하면 향후 유지보수자의 혼란을 줄일 수 있다. 우선순위 낮음.

- **[INFO]** README/CHANGELOG 업데이트 불요 판단이 타당
  - 상세: 이번 변경은 내부 서비스 계층(NestJS module/service)의 WS emit 파이프라인 1단계(PR1)이며, 사용자 대면 신규 기능·환경변수·설정 옵션이 추가되지 않았다(발사 소스는 PR3에서 wiring 예정). API 엔드포인트 변경도 없다(REST 계약 불변, WS 이벤트만 추가). 따라서 README/API 문서/CHANGELOG 업데이트가 필요하지 않다는 암묵적 판단은 타당하다.
  - 제안: 없음. 다만 PR3에서 실제 발사 소스가 연결되고 프런트가 이 이벤트를 구독하는 시점에는 `spec/5-system/6-websocket-protocol.md` §4.4의 배지 flip과 함께 프런트 개발자向 "무엇을 구독할 수 있는가" 안내(예: 컨벤션 문서 또는 위젯 문서)가 필요할 수 있음을 인지해 둘 것.

- **[INFO]** 인라인 주석이 복잡한 순환-회피 로직과 best-effort 격리 이유를 잘 설명
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:466-482`
  - 상세: `emitNew()`의 try/catch가 `getWebsocket()`(ModuleRef 해석 실패)과 `emitNotificationEvent`(broadcast 실패) 양쪽을 모두 감싸는 이유("적재는 이미 커밋됐으므로 emit 경로의 어떤 실패도 전파되면 안 된다")가 JSDoc에 명시돼 있고, 이는 WARNING #2 조치와 정확히 일치한다. 복잡한 예외 격리 로직에 대한 설명으로 충분하다.
  - 제안: 없음.

## 요약
이번 변경(알림 파이프라인 PR1)은 소스 코드 문서화 관점에서 높은 완성도를 보인다. 순환참조 회피, best-effort 격리, ModuleRef 지연 해석 등 비직관적인 설계 결정마다 "왜"를 설명하는 JSDoc/인라인 주석이 spec 앵커(§ 번호)와 함께 정확히 배치돼 있고, 회귀 테스트 이름에도 그 계약이 반영돼 코드-주석-테스트 삼중 정합이 이뤄졌다. 유일하게 눈에 띄는 항목은 spec 문서의 "Planned/미구현" 배지가 실제 구현과 어긋난 SPEC-DRIFT인데, 이는 developer가 spec read-only인 프로젝트 규약에 따라 `plan/in-progress/spec-update-notifications-ws-emit.md`로 정확히 위임 처리돼 있어 이번 PR 범위에서는 결함으로 보지 않는다. README/CHANGELOG/API 문서 업데이트는 사용자 대면 변경이 없어 불필요하다는 판단도 타당하다. 경미하게 개선 가능한 지점(영어/한국어 혼용 독스트링, optional+null 이중 표현의 의도 설명 부족)은 INFO 수준으로 차단 사유가 아니다.

## 위험도
NONE
