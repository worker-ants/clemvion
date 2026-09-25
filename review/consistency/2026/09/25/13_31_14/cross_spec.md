# Cross-Spec 일관성 검토 — `plan/in-progress/changelog-backfill-12.md`

## 검토 범위와 방법

target 은 spec 문서가 아니라 CHANGELOG.md 백필 계획(`spec_impact: none`)이다. 새 엔티티·API·요구사항
ID·상태 머신·RBAC·계층 책임을 정의하지 않으므로, 통상적인 6개 관점 중 다섯(데이터 모델·API 계약·요구사항
ID·상태 전이·RBAC)은 target 이 아무것도 새로 선언하지 않아 원천적으로 직접 충돌 표면이 없다. 대신 실질
위험은 **target 이 판정 근거로 인용하는 "실측/사실" 이 실제 spec 서술과 어긋나는가** 쪽이다 — 판정표(§A)의
각 행이 향후 CHANGELOG.md 에 영구 기록되므로, 사실관계 오류는 커밋되는 순간 기록의 일부가 된다. 아래는
판정표의 기술적 주장(SSRF 에러 코드, WS 토큰 타이머, entity-schema-declarations 가드, `inputOverride`
additionalProperties, `NotificationEventType` 개명)을 실제 `spec/**` 본문과 대조한 결과다.

## 발견사항

- **[WARNING]** `#1238` "안 낸다" 판정의 근거 "spec 0" 이 실제로는 거짓 — spec 이 `#1238` 을 명시적으로 다룬다
  - target 위치: `plan/in-progress/changelog-backfill-12.md` §A 판정표, `#1238` 행 — "`NotificationEventType` 개명은 facade 소비자 0 · spec 0 인 내부 개명"
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §Rationale "WS 이벤트 enum 명명 — `<도메인>EventType` (2026-08-30, `#1238` 후속)" (라인 1298~1308)
  - 상세: target 은 `#1238` 의 `NotificationEventType → InAppNotificationEventType` 개명을 "spec 0" — 즉 어떤 spec 문서도 참조하지 않는 순수 내부 리네임 — 이라고 판정 근거에 적었다. 그러나 `spec/5-system/6-websocket-protocol.md` 는 바로 그 PR 번호(`#1238`)를 인용하며 이 개명을 별도 Rationale 서브섹션으로 상세히 다룬다: "`triggers/dto/notification-config.dto.ts` 의 `NotificationEventType`(outbound webhook 구독 화이트리스트)과 WS 인앱 알림 벨 enum 이 같은 이름이었고, `#1238` 에서 후자를 `InAppNotificationEventType` 으로 개명해 해소했다 ... 주석은 오import 를 막지 못한다" 라고 적고, 이 사건에서 도출한 명명 규칙(`<도메인>EventType`)까지 못박아 둔다. 즉 "spec 0" 은 grep 으로 즉시 반증되는 주장이다 — `#1238` 은 실재하는 타입 충돌(두 심볼이 동일한 이름이라 자동완성이 잘못된 쪽을 골라도 컴파일되는 문제)을 해소한 변경이고 spec 이 그 배경·근거를 이미 정본으로 기록해 두었다.
  - 이것이 최종 "안 낸다" 판정 자체를 반드시 뒤집는 것은 아니다 — target 의 기준 ③(가드)은 "특정 결함 클래스를 **전역으로** 막는 검사" 를 요구하는데, `#1238` 의 리네임은 검사·가드가 아니라 명명 규칙 채택이므로 여전히 기준 ③ 미충족으로 "안 낸다" 가 유지될 수 있다. 그러나 target 이 스스로 세운 검증 규율("각 항목의 수치·이름은 그 PR 본문 그대로", `## C. 검증`)에 비추면, "spec 0" 이라는 확인되지 않은 부정 존재 주장을 판정 근거로 제출하는 것 자체가 문제다 — 같은 트래커(`spec-draft-nullable-notation-followups.md`)의 다른 항목들이 반복 강조하는 "미측정 전제가 백로그 항목을 만든다" 류의 함정과 동형이다.
  - 제안: target §A `#1238` 행의 근거를 "facade 소비자 0 · spec 0" → "facade 소비자 0. spec 은 `#1238` 을 명명 규칙 채택 근거로 인용하지만(`5-system/6-websocket-protocol.md` Rationale), 검사/가드가 아니라 정책 문서화이므로 기준 ③(전역 가드) 미충족 — '안 낸다' 유지" 로 정정한다. 판정 자체보다 **근거 문구**를 고치는 것이 목적이며, spec 파일 자체는 수정할 필요 없다(이미 정확하다).

## 다른 항목 교차검증 결과 (충돌 없음 — 확인용 기록)

아래는 target 의 다른 기술적 주장을 실제 spec 본문과 대조해 **일치**를 확인한 것들이다(발견사항 아님, 근거 기록):

- `#1364` (SSRF 가드 소비자): `INTEGRATION_CALL_FAILED`/`DB_CONNECT_FAILED` 구분, "판정(`HTTP_BLOCKED`/`DB_HOST_BLOCKED`) 아닌 가드 고장은 `INTEGRATION_CALL_FAILED`" 서술이 `spec/4-nodes/4-integration/0-common.md`·`1-http-request.md`·`2-database-query.md`·`spec/2-navigation/4-integration.md` 와 정확히 일치.
- `#1270` (WS 토큰 타이머 `.unref()`, 900초): `spec/5-system/6-websocket-protocol.md` §1.2/§Rationale (`R-ws-socket-lifetime-binds-token`)의 access token 900초·소켓별 `exp` 타이머·60초 사전 통지 서술과 일치.
- `#1354`/`#1358` (entity-schema-declarations e2e 가드): `spec/1-data-model.md` §Rationale·`spec/0-overview.md` §2.8 Rationale 이 이미 이 가드를 "인덱스·제약은 선언→DB 한쪽, 컬럼 정의는 양방향"으로 정확히 같은 내용으로 문서화.
- `#1206` (`inputOverride` `additionalProperties: true`): `spec/conventions/swagger.md` §1-4 "열린/동적 map" 규칙(자유 payload·사용자 정의 변수 맵에 한해 허용)과 부합. 새 계약을 만드는 것이 아니라 기존 규칙의 적용 사례.
- `#1326` (`rotate-bot-token` OpenAPI 노출): 해당 엔드포인트·DTO 는 `spec/2-navigation/2-trigger-list.md`·`spec/5-system/2-api-convention.md`·`spec/conventions/secret-store.md` 등에 이미 실재 기능으로 문서화돼 있어 신규 계약 충돌 없음.

## 요약

target 은 spec 을 직접 수정하지 않는 CHANGELOG 백필 계획이라 6개 관점 중 데이터 모델·API 계약·요구사항
ID·상태 전이·RBAC 충돌은 구조적으로 발생하지 않는다. 실측 대조 결과 대부분의 기술적 주장(SSRF 에러 코드
분기, WS 토큰 타이머 900초, entity-schema-declarations 가드, `inputOverride` 열린 map 규칙, `rotate-bot-token`
노출)은 기존 spec 서술과 정확히 일치해 신뢰도가 높다. 다만 `#1238` "안 낸다" 판정에 실린 "spec 0" 근거는
`spec/5-system/6-websocket-protocol.md` 가 그 PR 을 명시적으로 인용·서술하고 있어 사실이 아니다 — 최종
판정(안 낸다)이 뒤집힐 가능성은 낮지만, 근거 문구를 spec 사실과 맞게 정정한 뒤 커밋해야 CHANGELOG.md 에
검증되지 않은 부정 존재 주장이 영구히 남는 것을 막을 수 있다.

## 위험도

LOW
