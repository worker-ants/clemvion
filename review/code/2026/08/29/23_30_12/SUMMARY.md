# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. 전 reviewer 가 NONE 을 보고했으나 `testing` 만 facade 재수출 테스트 미소비(INFO 성격)를 이유로 LOW 로 판정해 전체 위험도를 LOW 로 집계. forced whitelist(7명) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서/컨벤션 | `<도메인>EventType` 명명 규칙(자매 enum `ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`/`KbEventType`/`InAppNotificationEventType` 이 따르는 패턴)이 `spec/conventions/**` 어디에도 문서화되어 있지 않음 — 이번 개명 근거의 절반이 이 미문서화 규칙에 기대고 있음 | `codebase/backend/src/modules/websocket/websocket-events.types.ts:220-225` (JSDoc), `plan/in-progress/ws-event-types-extract.md` "같은 planner 턴에 함께 볼 것" | 조치 불요 — developer 권한 밖(spec 신설은 project-planner 소관), 최신 커밋(`0ecc6fa2a`)이 이미 convention_compliance 로 planner 턴에 인계함 (requirement · documentation 중복 지적, 통합) |
| 2 | 테스트 | `InAppNotificationEventType` 의 facade 재수출(`websocket.service.ts`)이 `websocket.service.spec.ts` 어디에서도 실제로 import·소비되지 않음 — 그 spec 이 다른 3개 값(`ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`)에 대해서는 "의도된 커버리지"로 명시했지만 이 값에는 실제로 적용되지 않아, facade 재수출 줄이 깨져도(오탈자 등) 어떤 테스트도 RED 를 내지 않음 | `codebase/backend/src/modules/websocket/websocket.service.ts` (import/재수출 블록), `codebase/backend/src/modules/websocket/websocket.service.spec.ts` | `websocket.service.spec.ts` 에 `InAppNotificationEventType` 을 facade 에서 import 해 `.NOTIFICATION_NEW === 'notification.new'` 단언 한 줄 추가 권장. 비용 낮으나 개명 전부터 있던 사전 갭이라 이번 PR 의 차단 사유는 아님 (testing) |
| 3 | 스코프 | 리뷰 대상 26개 파일(+1238/-22) 중 실제 애플리케이션 코드 변경은 4개(+29/-16 net)뿐이고 나머지 22개(+~1100줄)는 `review/code/**`·`review/consistency/**`·`plan/in-progress/**` 워크플로 산출물 | `plan/in-progress/ws-event-types-extract.md`, `review/code/2026/08/29/23_01_15/*`, `review/consistency/2026/08/29/23_23_48/*` | 조치 불요 — 프로젝트 컨벤션(`CLAUDE.md` "정보 저장 위치" 표) 부합, developer 의 `review/**`·`plan/**` 쓰기 권한 범위 (scope) |
| 4 | 스코프 | `notification-config.dto.ts` JSDoc 4줄 추가는 직전 리뷰 라운드가 선택적(optional) 후속으로만 표시했으나 developer 가 함께 적용함 | `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts` (JSDoc 블록) | 조치 불요 — 개명의 반대쪽 disambiguation 을 대칭 완결하는 4줄 문서 전용 변경, 리스크·범위 확장 없음 (scope) |
| 5 | 부작용 | `NotificationEventType` → `InAppNotificationEventType` 개명은 공개 심볼 시그니처 변경이나, `codebase/` 전체(backend/frontend/packages) grep 재검증 결과 외부 소비자 0곳이며 enum 값(`'notification.new'`) 불변이라 WS wire 계약도 그대로 | `websocket-events.types.ts:226` (선언), `websocket.service.ts:27,44,588` (import·재수출·사용) | 조치 불요 — 이미 grep 재검증까지 마친 안전한 rename (side_effect) |
| 6 | 유지보수성 | `InAppNotificationEventType` 의 JSDoc 이 17줄로 이례적으로 길다(개명 배경·이전 실패 이유·자매 enum 규칙까지 포함) | `codebase/backend/src/modules/websocket/websocket-events.types.ts:209-225` | 조치 불요 — 직전 라운드(`RESOLUTION.md` INFO#4)에서 이미 won't-do 처분됨(향후 재발 방지 근거로 유의미 판단). 다른 enum 에도 같은 두께가 쌓이면 그때 `spec/conventions/**` 로 분리 고려 (maintainability) |
| 7 | 유지보수성 | `plan/in-progress/ws-event-types-extract.md` 가 502줄까지 누적, 세션별 인용 블록(`>`)이 중첩되어 계속 덧붙는 구조 | `plan/in-progress/ws-event-types-extract.md` 전체 | 조치 불요 — 같은 diff 안에서 이미 won't-do 처분됨("근거는 문서에 남긴다" 프로젝트 채택 컨벤션), 코드 유지보수성에 영향 없음 (maintainability) |
| 8 | 문서화/테스트 신뢰성 | `RESOLUTION.md` 가 주장한 `npx jest src/modules/websocket/` 172/172 GREEN 수치는 재실행에서 재현되었으나, 1회는 이 diff 와 무관해 보이는 스위트에서 2건 FAIL 관측(재실행 시 즉시 GREEN 복귀 — flaky 추정) | `review/code/2026/08/29/23_01_15/RESOLUTION.md` "## main 의 독립 재검증" 절 | documentation 결함 아님(주장한 숫자 자체는 실측 가능·재현됨) — 참고용 기록, 조치 불요 (documentation) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 사용자 입력·인증/인가·SSRF·에러처리 경로 전부 diff 밖(불변). 발견 없음 |
| requirement | NONE | 개명 6곳 전수 확인(grep 잔존 참조 0건), `hasDefaultExport` AST 3형태 전수 소진, spec fidelity(EIA-NX-02·§4.4) 정합. INFO 1건(명명규칙 미문서화, 이미 인계됨) |
| scope | NONE | plan 에 사전 등재된 두 백로그 항목만 정확히 구현, drive-by 없음. 나머지 22개 파일은 워크플로 산출물 |
| side_effect | NONE | rename·순수함수 추출뿐, 전역상태/네트워크/파일시스템 부작용 없음. 외부 소비자 0곳 grep 재확인 |
| maintainability | NONE | 헬퍼 추출은 모범사례, 네이밍 일관. JSDoc/plan 문서 길이는 이미 won't-do 처분된 INFO |
| testing | LOW | 이전 WARNING(별칭 분기 커버리지)을 합성 소스 테이블로 영구 고정, 3차 독립 재검증(뮤테이션)까지 예측=실측 일치. 유일 관찰: facade 재수출 미소비(INFO) |
| documentation | NONE | JSDoc 상호참조·plan 서술 다수 대조 재실측, 불일치 없음. 명명규칙 미문서화는 이미 planner 인계됨 |

## 발견 없는 에이전트

security, requirement(코드 결함 없음, INFO 만), scope, side_effect(코드 결함 없음, INFO 만), maintainability(코드 결함 없음, INFO 만), documentation(코드 결함 없음, INFO 만) — 6개 에이전트 모두 실질 코드 결함 0건.

## 권장 조치사항

1. (낮은 비용, 선택) `websocket.service.spec.ts` 에 `InAppNotificationEventType` 을 facade(`./websocket.service`)에서 import 해 `.NOTIFICATION_NEW === 'notification.new'` 단언 한 줄을 추가해, 다른 3개 값과 동일한 수준의 facade 커버리지를 완성한다. 개명 전부터 있던 사전 갭이라 이번 PR 의 차단 사유는 아니다.
2. (참고) `<도메인>EventType` 명명 규칙의 `spec/conventions/**` 문서화는 이미 planner 턴으로 인계되어 있으므로 다음 planner 세션에서 처리한다 — 본 리뷰에서 추가 조치 불요.
3. Critical/Warning 이 없으므로 즉시 차단 조치는 없음. 위 두 항목은 선택적 후속으로 처리 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — forced 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(enum 개명·테스트 헬퍼 리팩터)와 무관 |
  | architecture | router 판단상 이번 diff 와 무관 |
  | dependency | 신규 의존성 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 로직 변경 없음 |
  | api_contract | wire 계약(enum 값) 불변 — 컴파일타임 개명뿐 |
  | user_guide_sync | 사용자 가이드 대상 변경 없음 |
