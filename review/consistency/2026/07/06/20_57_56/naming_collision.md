# 신규 식별자 충돌 검토 — `spec/data-flow/8-notifications.md`

## 검토 방법

target 문서(`spec/data-flow/8-notifications.md`)가 도입/사용하는 식별자(요구사항 ID, 엔티티/타입명,
API endpoint, 이벤트명, 환경변수/설정키, 파일 경로)를 추출하고, payload 에 포함된 코퍼스
(`spec/0-overview.md`, `spec/1-data-model.md`, `plan/in-progress/*`, `spec/conventions/*`) 및
실제 리포지토리(`spec/**`, `codebase/backend/src/modules/notifications/**`, `codebase/backend/src/modules/integrations/**`,
`spec/2-navigation/*`, `spec/5-system/6-websocket-protocol.md`)를 grep 으로 교차 대조했다.
target 은 git 이력상 기존 파일(`8-notifications.md`)에 대한 **갱신**(최근 커밋 #838/#837/#836 의
연장선, 알림 파이프라인 PR3)이며 신규 파일 생성이 아니다.

## 발견사항

없음. 검토한 항목은 모두 기존 정의와 일치하거나(재확인/동기화), 신설이라도 기존 어휘 점유 영역과
충돌하지 않는다. 상세:

- **엔티티/타입 — `Notification.type` 값들** (`background_failed`, `integration_expired`,
  `integration_action_required`, `alert_<rule.type>`, `execution_failed`, `schedule_failed`,
  `marketplace_update`, `team_invite`): 전부 `spec/1-data-model.md §2.19`, `spec/2-navigation/4-integration.md §11.2`,
  `spec/data-flow/5-integration.md` 에 이미 정의된 값과 1:1 일치. 새 값 추가 없음.
- **API endpoint** — `POST /notifications/:id/dismiss`, `POST /notifications/dismiss-all`,
  `POST /notifications/mark-all-read`: `spec/2-navigation/9-user-profile.md:366-367`,
  `spec/2-navigation/_layout.md:124` 의 기존 표와 method+path 동일, 의미도 동일(soft delete 일괄/단건,
  mark-all-read 와 독립). 코드(`notifications.controller.ts`)와도 일치.
- **DTO/클래스명** — `DismissNotificationResponseDto`, `DismissAllNotificationsResponseDto`,
  `MarkAllReadResultDto`: `codebase/backend/src/modules/notifications/dto/responses/*.ts` 에
  이미 존재하는 클래스를 그대로 참조. target 은 새 이름을 만들지 않고 기존 구현을 문서화.
- **WS 이벤트명** — `notification.new`: `spec/5-system/6-websocket-protocol.md §4.4`(751행)의
  권위 정의와 채널명(`notifications:{userId}`)·payload shape 모두 일치. `notification.read` /
  `notification.dismissed` 는 §4.6 follow-up(미구현)으로만 언급되며, 기존 WS 이벤트 중 `.read`/
  `.dismissed` suffix 사용 사례가 전무해 향후 신설되어도 충돌 소지 없음.
- **어휘 — `visible`**: `dismissed_at IS NULL` 상태를 가리키는 신규 어휘로 target Rationale 에서
  `active`/`live`/`undismissed` 대비 채택 근거를 기술한다. `spec/2-navigation/_layout.md:112`
  ("visible 미읽은 알림 수 뱃지")에서 이미 동일 의미로 쓰이고 있어 오히려 **정합**(신규 도입이
  기존 사용처와 부합) — 충돌 아님. target 이 명시적으로 우려한 `Workflow.is_active` /
  `Trigger.is_active` / `Schedule.is_active` 의 `active` 어휘와도 구분되어 실제로 혼동 방지에
  기여한다.
- **컬럼명 — `dismissed_at`**: 코드(`notification` 테이블, V055 마이그레이션)에 이미 존재하는
  컬럼이며 다른 테이블에서 `dismissed_at` 이 다른 의미로 쓰이는 사례 없음(grep 결과 전무).
- **헬퍼명 — `hasRecentByResource`**: `codebase/backend/src/modules/notifications/notifications.service.ts`
  기존 구현과 완전히 일치하는 참조. 신규 도입 아님.
- **파일 경로** — target 자신의 경로 `spec/data-flow/8-notifications.md` 는 `spec/data-flow/`
  폴더의 기존 파일이며 문서 맵(`spec/0-overview.md §8` 표, "알파벳 순 숫자 prefix") 컨벤션과
  일치. 새 파일 생성이 아니라 기존 파일 갱신(git log 확인: 최근 3커밋 연속 diff 존재)이므로
  경로 충돌 대상 자체가 아니다.
- **환경변수/설정키**: target 문서 자체는 신규 ENV var 나 config key 를 도입하지 않는다
  (`user.notification_preferences.integrationExpiryEmail` 은 기존 키 재확인일 뿐).

## 요약

target 문서는 이미 구현되고 다른 spec(`1-data-model.md`, `2-navigation/4-integration.md`,
`2-navigation/9-user-profile.md`, `2-navigation/_layout.md`, `5-system/6-websocket-protocol.md`)에
분산 정의된 알림 파이프라인 식별자(엔티티 type 값, endpoint, DTO, WS 이벤트, `dismissed_at`/`visible`
어휘)를 재확인하고 data-flow 관점으로 동기화하는 갱신 문서다. 신규로 부여되는 식별자가 거의 없고,
유일하게 신규성이 있는 어휘(`visible`)조차 이미 인접 문서(`_layout.md`)에서 동일 의미로 쓰이고
있어 오히려 일관성을 강화한다. 신규 식별자 충돌 관점에서 문제되는 지점을 찾지 못했다.

## 위험도

NONE
