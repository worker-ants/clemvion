STATUS=success naming_collision review complete
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — naming_collision

## 검토 컨텍스트

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`. HEAD 워킹트리:
  `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434` (브랜치
  `claude/ws-event-types-extract`).
- 대상 작업: `plan/in-progress/ws-event-types-extract.md` — `websocket.service.ts` 상단
  선언 블록(enum/interface/type 11종)을 의존성-0 신규 모듈
  `codebase/backend/src/modules/websocket/websocket-events.types.ts` 로 추출하는 **순수 코드
  리팩터** (`spec_impact: none`). `git diff origin/main...HEAD --stat -- spec/` 로 실측한
  결과 spec 변경은 `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록에 새
  파일 경로 1줄 추가뿐이다(본문 요구사항 ID·엔티티명·endpoint·이벤트명·env var 불변).
- 이 검토는 `18_53_27`(--impl-prep) → `20_05_19`(--impl-done) naming_collision 리뷰의
  후속이다. `20_05_19` 이후(`git log --since="20:05:19"`) 6개 커밋이 더 있었으나 전부 가드
  테스트(`websocket-events.types.spec.ts`) 정밀화·`import type` 부여·JSDoc/plan 등재
  보완이며, `git diff a6d764ac6~1 38bde3b63 --stat -- codebase/ spec/` 로 대조한 결과
  `spec/` 무변경, `websocket-events.types.ts` 본체(선언 11종)도 무변경이다. 즉 신규
  식별자 충돌 관점에서 `20_05_19` 리뷰 이후 달라진 표면이 없다.

## 발견사항

- **[INFO]** `NotificationEventType` 동명 충돌 — 완화 반영 확인 + 이번엔 rename 항목도 실제 등재됨
  - target 신규 식별자: `codebase/backend/src/modules/websocket/websocket-events.types.ts:219-221`
    `export enum NotificationEventType { NOTIFICATION_NEW = 'notification.new' }`
    (기존 `websocket.service.ts` 선언을 그대로 이동, `websocket.service.ts:18,35`가 재-export).
  - 기존 사용처: `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts:28`
    `export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number]` — outbound
    webhook 구독 화이트리스트(`execution.*` 5값, spec `14-external-interaction-api.md` §3.1
    `EIA-NX-02`). `git grep -n "NotificationEventType"` 전수 재확인 — 두 정의가 이름은
    동일하되 서로 다른 파일에서 독립적으로 export 되고 있음을 재확인(총 8개 참조 지점, 이전
    라운드 대비 증감 없음).
  - 상세: 인앱 알림 벨 1값 enum(WS) vs webhook 구독 화이트리스트 5값 union(트리거 도메인)이라
    도메인이 다르지만 이름이 완전히 동일해 오import 위험이 있다. 이번 diff 에서는 이전
    WARNING(→INFO 하향)에 대해 권고된 조치가 그대로 유지되고 있음을 코드에서 재확인:
    `websocket-events.types.ts:213-218` 에 "`triggers/dto/notification-config.dto.ts` 에
    같은 이름의 다른 타입이 있다 … 둘은 무관하다. 개명은 별도 항목" JSDoc 이 그대로 있다.
    추가로 이번 라운드에서 발전한 점 — `plan/in-progress/ws-event-types-extract.md:325-328`
    에 "`NotificationEventType` 개명" 이 실제 미해결 백로그 항목(`- [ ]`)으로 등재됐다
    (`20_05_19` naming INFO7 이 "등재 여부를 developer 가 확인하라" 고 권고한 것에 대한
    직접 응답 — 커밋 `a6d764ac6` 메시지도 "이 브랜치에서 반복된 '등재했다' 거짓의 또 한 사례라
    여기 실제로 등재한다" 라고 자체 기록).
  - 제안: 여전히 등급을 낮출 만큼 충분한 완화(JSDoc + 등재)가 되어 있어 이번 PR 을 막을
    사유는 아니다. rename 자체는 이번 diff 범위 밖의 별도 작업으로 남겨 둔 것이 합리적 —
    지금 collapsing 하면 이 리팩터의 "순수 이동" 스코프를 깨고 두 도메인(WS 인앱 알림 /
    webhook 구독)의 실제 이름 정정 논의를 별도 검토 없이 끼워 넣게 된다.

## 그 외 점검 결과 (수집만, 문제 없음)

- **요구사항 ID 충돌**: 해당 없음 — spec 본문 무변경, 신규 요구사항 ID 부여 없음.
- **엔티티/타입명 충돌 (그 외)**: `websocket-events.types.ts` 가 export 하는 11개 심볼
  (`ExecutionChannelEvent`, `ChatChannelRoutingInfo`, `ExecutionRoutingContext`,
  `ExecutionEventType`, `ToolCallStartedPayload`, `UserMessagePayload`,
  `ToolCallCompletedPayload`, `NodeEventType`, `BackgroundRunEventType`,
  `NotificationNewPayload`, `KbEventType`)에 대해 `git grep -n "^export
  \(interface\|enum\|type\) <name>"` 로 저장소 전체(`codebase/`, `spec/`)를 재확인한 결과
  각각 정확히 1곳(신규 파일)에서만 선언되며, 위 `NotificationEventType` 외 동명 충돌 없음.
  이들은 모두 `websocket.service.ts` 에서 **그대로 이동**된 기존 식별자라 "신규 도입"이
  아니라 "위치 이동"이며, 코드베이스 전역 사용처(13개 import 경로) 관점에서도 신규 충돌면이
  생기지 않는다(re-export facade 로 하위호환 유지).
- **API endpoint 충돌**: 해당 없음 — 신규 endpoint 없음.
- **이벤트/메시지명 충돌**: 신규 이벤트 문자열 값 없음. 이동된 값(`execution.*`,
  `notification.new`, `document:*`)은 전부 리팩터 이전과 동일.
- **환경변수·설정키 충돌**: 해당 없음 — 신규 env/config key 없음.
- **파일 경로 충돌**: 신규 파일 `codebase/backend/src/modules/websocket/websocket-events.types.ts`
  — 동일 디렉토리 파일 목록(`find codebase/backend/src/modules/websocket -maxdepth 1`)과
  대조한 결과 동명/유사 경로 없고, `*.types.ts` suffix 컨벤션(예: 타 모듈의
  `notification-dispatcher.types.ts`)과 정합. `spec/5-system/6-websocket-protocol.md`
  frontmatter `code:` 목록에도 이 경로가 정확히 반영되어 spec↔code 매핑 정합.

## 요약

`spec_impact: none` 순수 코드 리팩터(값/타입 11종 위치 이동)로, `18_53_27`→`20_05_19` 로
이어진 이전 두 라운드의 naming_collision 검토가 발견한 유일한 이슈 —
`NotificationEventType` 이 `triggers/dto/notification-config.dto.ts` 의 동명 타입과 이름이
겹치는 문제 — 는 이번 라운드에서도 동일하게 존재하지만, JSDoc disambiguation 이 유지되고
있고 이번엔 "개명은 별도 항목" 이라던 후속 rename 작업이 `plan/in-progress/ws-event-types-extract.md`
에 실제 미해결 백로그 항목으로 등재된 것까지 확인했다. `20_05_19` 리뷰 이후의 6개 커밋은
가드 테스트 정밀화·plan 등재 보완일 뿐 신규 식별자·spec 변경을 만들지 않았으므로, 신규
식별자 충돌 관점의 전체 판정은 이전 라운드와 동일하게 유지된다 — 실질적 CRITICAL/WARNING
없음.

## 위험도

LOW
