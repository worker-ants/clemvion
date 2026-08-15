STATUS=success naming_collision review complete
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — naming_collision

## 검토 컨텍스트

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
- 대상 작업: `plan/in-progress/ws-event-types-extract.md` — `websocket.service.ts` 상단
  선언 블록(enum/interface/type, 구 `:6~:340`)을 의존성-프리 신규 모듈
  `codebase/backend/src/modules/websocket/websocket-events.types.ts` 로 추출하는 **순수 코드
  리팩터** (`spec_impact: none`). spec 변경은 `6-websocket-protocol.md` frontmatter `code:` 목록에
  새 파일 경로 1줄 추가뿐이다 (`git diff origin/main -- spec/5-system/6-websocket-protocol.md` 로 실측 —
  본문 요구사항 ID·엔티티명·endpoint·이벤트명·env var 는 전혀 바뀌지 않음).
- 이 검토는 `review/consistency/2026/08/15/18_53_27/naming_collision.md`(--impl-prep, 동일 작업 대상)의
  후속이다. 그 리뷰가 지목한 WARNING 1건이 이번 구현에서 실제로 어떻게 반영됐는지, 그리고 구현 diff 전체
  (`git diff origin/main --stat`, 53 files, 코드 변경분은 대부분 import 경로 rewrite)에 그 밖의 신규
  충돌 식별자가 없는지를 코드 레벨로 재확인했다.

## 발견사항

- **[INFO]** `NotificationEventType` 동명 충돌 — 이전 WARNING 대로 disambiguation 주석 반영 확인, 근본 rename 은 여전히 미집행
  - target 신규 식별자: `codebase/backend/src/modules/websocket/websocket-events.types.ts:219-221`
    `export enum NotificationEventType { NOTIFICATION_NEW = 'notification.new' }` (기존 `websocket.service.ts`
    에서 그대로 이동, `websocket.service.ts` 가 재-export).
  - 기존 사용처: `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts:28`
    `export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number]` — outbound webhook 구독
    화이트리스트(`execution.*` 5값, spec `14-external-interaction-api.md` §3.1 `EIA-NX-02`).
  - 상세: 18_53_27 리뷰가 이미 지목한 대로 두 정의는 이름이 완전히 동일하지만 도메인이 다르다(인앱 알림 벨
    1값 enum vs webhook 구독 화이트리스트 5값 union). 이번 구현은 이 WARNING 에 대해 정확히 권고된 조치
    — 새 모듈의 `NotificationEventType` enum 바로 위(`websocket-events.types.ts:209-217`)에
    "`triggers/dto/notification-config.dto.ts` 에 같은 이름의 다른 타입이 있다 … 둘은 무관하다. 개명은 별도
    항목" 이라는 상호 참조 JSDoc 을 추가했다 — 실제로 반영됐음을 코드에서 확인(`Read` 로 원문 대조).
    다만 이는 혼동 완화이지 해소는 아니다 — 두 타입은 여전히 동일 이름으로 각자 export 되어 있고
    (`git grep NotificationEventType` 실측, 4개 선언/사용 지점 모두 생존), 근본 rename 은 여전히
    "별도 항목" 으로 남아 있어 실제 트래커(예: `spec-sync-external-interaction-api-gaps.md`)에 후속
    항목으로 등재됐는지는 이번 diff 범위 밖이라 확인 대상이 아니다.
  - 제안: 이번 PR 은 등급을 낮출 만큼 충분한 완화(주석)를 이미 반영했으므로 차단 사유는 아니다. 다만
    "개명은 별도 항목" 이라 적어둔 이상, 그 rename 항목이 실제 plan 트래커에 등재됐는지는 developer 가
    이번 턴 종료 전에 한 번 확인해 두는 것을 권장한다(등재 누락 시 다음에도 같은 W3 가 재발견될 뿐 아무도
    처리하지 않는 상태로 방치될 수 있음).

## 그 외 점검 결과 (수집만, 문제 없음)

- **요구사항 ID 충돌**: 해당 없음 — spec 본문 무변경(`spec_impact: none` 실측 일치).
- **엔티티/타입명 충돌 (그 외)**: 이동 대상 15개 식별자(`ExecutionEventType`, `NodeEventType`,
  `BackgroundRunEventType`, `KbEventType`, `ExecutionChannelEvent`, `ChatChannelRoutingInfo`,
  `ExecutionRoutingContext`, `ToolCallStartedPayload`, `UserMessagePayload`, `ToolCallCompletedPayload`,
  `NotificationNewPayload` 등)을 `websocket-events.types.ts` 실제 내용과 backend 전역 사용처
  (`retry-turn.service.ts`, `interaction-stream.controller.ts`, `embedding.service.ts`,
  `graph-extraction.service.ts`, `ai-turn-executor.ts`, `sse-adapter.service.ts`,
  `chat-channel.dispatcher.ts` 등 13개 import 경로 변경분)로 대조한 결과, 이번 diff 는 import 문 경로만
  `../websocket/websocket.service` → `../websocket/websocket-events.types` 로 바꾼 것이며 새 이름은
  하나도 도입하지 않는다. `NotificationEventType` 외 중복 선언 없음.
- **API endpoint 충돌**: 해당 없음 — 신규 endpoint 없음(코드 diff 전체가 websocket 모듈 리팩터 + 무관한
  선행 커밋들의 잔여 diff 뿐).
- **이벤트/메시지명 충돌**: 신규 이벤트 이름 없음. 이동된 이벤트 문자열 값(`execution.*`, `notification.new`,
  `document:*`)은 전부 기존 값 그대로이며 wire 값 변경 없음.
- **환경변수·설정키 충돌**: 해당 없음 — 신규 env/config key 없음.
- **파일 경로 충돌**: 신규 파일 `codebase/backend/src/modules/websocket/websocket-events.types.ts` —
  저장소 전체에 동명/유사 경로 없음, 동일 디렉토리의 `*.service.ts`/`*.types.ts` 관례
  (`notification-dispatcher.types.ts` 등)와 부합. spec 파일이 아니므로 §6 spec 파일 경로 충돌 기준
  적용 대상 아님. `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록에 이 경로가 정확히
  추가되어 spec↔code 매핑도 정합.

## 요약

이번 구현은 `spec_impact: none` 순수 코드 리팩터(값/타입 15종 재배치 + import 13곳 rewrite)이며 신규
식별자를 실질적으로 도입하지 않는다. 직전 impl-prep 리뷰(18_53_27)가 지목한 유일한 WARNING —
`NotificationEventType` 이 `triggers/dto/notification-config.dto.ts` 의 동명 타입과 이름이 겹친다는
점 — 은 이번 구현에서 권고된 disambiguation JSDoc 주석이 실제로 추가되어 반영을 코드에서 확인했다.
동일 이름 자체는 여전히 존재하므로(rename 은 명시적으로 별도 항목으로 유예) 등급을 INFO 로 낮춰
재기록하며, 그 외 이동된 15개 식별자·API·이벤트·env·파일 경로 어디에서도 새로운 충돌은 발견되지 않았다.

## 위험도

LOW
