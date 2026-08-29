# 정식 규약 준수 검토 — spec/data-flow/ (--impl-done)

## 검토 범위 확인

이번 PR(`ws-event-types-followups`)의 실제 diff(`git diff origin/main...HEAD -- code_areas`)는
`spec/data-flow/**` 를 **전혀 건드리지 않는다**. 변경은 전부 코드다:

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `NotificationEventType` →
  `InAppNotificationEventType` 개명 (WS 인앱 알림 벨 전용 enum)
- `codebase/backend/src/modules/websocket/websocket.service.ts` — 위 개명에 따른 import/re-export/
  사용처 갱신
- `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts` — disambiguation JSDoc 보강
  (동명이던 outbound webhook 구독 타입 `NotificationEventType` 은 그대로 유지)
- `websocket-events.types.spec.ts` — 개명 반영 + `hasDefaultExport` 판정 3형태 전수화 테스트 보강

이에 따라 본 검토는 (a) 이 개명이 `spec/data-flow/**` 및 관련 spec 트리와 정합한지, (b) 개명 자체가
명명 규약 관점에서 타당한지를 중심으로 확인했다.

## 확인한 사실

1. **spec 전수에 옛 식별자 참조 없음.** `grep -rn "NotificationEventType" spec/` (전체 spec 트리) →
   0건. `spec/data-flow/8-notifications.md`, `spec/5-system/6-websocket-protocol.md` 등 관련 문서는
   전부 **wire-level 이벤트 이름** (`notification.new`, dot 표기) 만 인용하고 TS 식별자(enum 이름)는
   전혀 인용하지 않는다. 따라서 이번 개명으로 갱신이 필요한 spec 문서는 없다 —
   `plan/in-progress/ws-event-types-extract.md` 의 "spec 변경 불요" 판단과 일치하고, plan
   frontmatter `spec_impact: none` 도 이 사실과 부합한다 (Gate C 형식 요건도 리스트 아닌 `none` 스칼라로
   정상).
2. **명명 패턴 정합.** `websocket-events.types.ts` 는 이미 `ExecutionEventType` · `NodeEventType` ·
   `BackgroundRunEventType` · `KbEventType` 4개가 `<도메인>EventType` 패턴을 따르고 있었고,
   `InAppNotificationEventType` 개명은 그 패턴 안에 있다 (자매 export 전수 확인, `websocket-events.types.ts:83,185,204,226,261`).
   다만 이 패턴은 `spec/conventions/**` 에 **정식 문서화된 규약은 아니고** 모듈 내부의 관행이다 —
   따라서 이번 개명이 "정식 규약을 준수"한다고 단정할 근거 문서는 없지만, 위반도 없다 (아래 INFO 참조).
3. **동명이인 해소.** 개명 전에는 `websocket-events.types.ts` 의 `NotificationEventType`(인앱 알림
   벨, `notification.new` 단일 값)과 `triggers/dto/notification-config.dto.ts` 의
   `NotificationEventType`(outbound webhook 구독 화이트리스트, `execution.*` 5값)가 **동명이의**였다.
   개명 후 두 심볼은 이름으로 구분되어, 자동완성이 잘못된 심볼을 노출해도 컴파일이 통과하던
   위험이 제거됐다. 이는 "명명 규약" 관점에서 개선이며 회귀가 아니다.
4. **spec 문서 구조.** 교차 확인한 `spec/data-flow/8-notifications.md` (개명된 심볼과 가장 인접한
   문서)는 Overview → 번호 섹션(Source→Sink / Schema 매핑 / 상태 전이 / …) → Rationale 3섹션
   구조를 그대로 따르고, `spec/conventions/swagger.md §5`·`§5-1` 인용(`DismissNotificationResponseDto`,
   `DismissAllNotificationsResponseDto` 파일 경로)도 실제 코드 경로와 일치함을 확인했다
   (`codebase/backend/src/modules/notifications/dto/responses/dismiss-*-response.dto.ts` 존재 확인).
   본 PR 의 diff 범위는 아니지만 겸사 확인한 결과 위반 없음.

## 발견사항

없음 (CRITICAL/WARNING 없음).

- **[INFO]** `<도메인>EventType` 명명 패턴의 비공식성
  - target 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts` (spec 문서 아님,
    참고용)
  - 위반 규약: 해당 없음 — `spec/conventions/**` 에 이 패턴을 명문화한 문서가 없다는 점 자체를 지적
  - 상세: `ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`/`KbEventType`/
    `InAppNotificationEventType` 5개가 이미 일관된 `<도메인>EventType` 규칙을 따르고 있고, 이번 PR 의
    plan 도 이 규칙을 개명 근거로 명시했다. 그런데 이 규칙은 `spec/conventions/**` 어디에도 정식
    문서화되어 있지 않아, 다음에 6번째 이벤트 enum 을 추가하는 사람이 이 관행을 몰라서 벗어날
    위험이 있다.
  - 제안: 강제 사항은 아니므로 지금 당장 조치는 불요. 향후 WS 이벤트 관련 convention 문서(예:
    `spec/conventions/websocket-events.md` 신설 또는 기존 `spec/5-system/6-websocket-protocol.md`
    Rationale)에 이 명명 패턴을 한 문단으로 명문화하면 재발 방지에 도움이 된다 — project-planner
    턴 소관.

## 요약

이번 PR 의 diff 는 `spec/data-flow/**` 를 변경하지 않았고, 변경된 코드(`NotificationEventType` →
`InAppNotificationEventType` 개명)도 spec 트리 전체(`spec/data-flow/` 포함)에서 옛 식별자를 인용하는
곳이 없어 spec 정합성 훼손이 없음을 grep 으로 직접 확인했다. 개명 자체는 기존 모듈 내 `<도메인>EventType`
명명 패턴을 따르며 동명이의 충돌을 이름 수준에서 해소해 명명 규약 관점에서 개선이다. 다만 이 패턴이
`spec/conventions/**` 에 정식 문서화되어 있지 않다는 점은 재발 방지 관점의 INFO 로 남긴다. 정식 규약
위반은 발견되지 않았다.

## 위험도

NONE
