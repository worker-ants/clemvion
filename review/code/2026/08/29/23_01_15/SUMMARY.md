# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실질 결함(CRITICAL/WARNING)은 `testing` 리뷰어가 지적한 신규 방어 분기(`export { X as default }` 별칭 감지)의 회귀 테스트 커버리지 갭 1건뿐이며, 그 외 6개 reviewer(security/requirement/scope/side_effect/maintainability/documentation)는 전부 NONE — 발견사항 없음(INFO만 존재). forced whitelist 7명 전원 결과 확보 완료(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `hasDefaultExport()` 의 신규 세 번째 분기(`NamedExports` 의 `as default` 별칭 감지 — 이번 diff 가 새로 고친 바로 그 갭)가 커밋된 스위트에서 **양성 경로로 한 번도 실행되지 않는다**. 직접 뮤테이션(해당 분기 술어를 절대 불일치 문자열로 교체)으로 실증했고 6/6 GREEN 유지 — 즉 이 로직이 다시 깨져도 현재 스위트는 감지 못함. plan 문서가 기록한 뮤테이션 검증은 임시 사본에서 수행되고 되돌려졌을 뿐 영구 테스트로 커밋되지 않았다. 이 파일은 이미 4라운드 연속 "형태 하나를 놓쳤다 → 고침 → 다음 형태를 놓침" 패턴을 겪었음(plan 기록). | `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:188-193`(함수 3번째 분기), 소비처 `:352-363` | `ts.createSourceFile('t.ts', sourceText, …)` 를 직접 호출하는 합성(synthetic) 유닛 테스트를 추가해 세 AST 형태(`export default X` / `export default function f(){}` / `export { X as default }`) 각각에 `true`, 일반 named export 에 `false` 를 단언하는 테이블 기반 테스트로 이번 뮤테이션이 실측한 갭을 영구히 닫는다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / documentation | `plan/in-progress/ws-event-types-extract.md` 의 `plan/complete/` 이동 항목이 여전히 미체크 상태. 원인은 `spec/conventions/egress-masking.md:89` 의 DEAD 링크 캐비엇이며, 그 문장은 developer 가 아니라 planner 턴(`bdcfdc514`, git blame 확인)이 쓴 것이라 CLAUDE.md §자기-반증형 소정정 조건 1(developer 자신이 썼을 것)을 충족하지 못해 developer 가 직접 고칠 권한이 없음 — 프로세스상 정확히 다음 planner 턴으로 위임된 상태, 코드 결함 아님. | `plan/in-progress/ws-event-types-extract.md:294` | 조치 불요(이 PR 범위 밖). 후속 planner 턴에서 `egress-masking.md:89` 캐비엇 처리 후 plan 을 `complete/` 로 이동하고 7개 파일의 `spec_impact` 기재. |
| 2 | documentation | 개명(`NotificationEventType`→`InAppNotificationEventType`)의 disambiguation JSDoc 이 WS 쪽에만 있고, 동명 타입을 쓰는 반대쪽(`triggers/dto/notification-config.dto.ts`, diff 밖 파일)에는 대응 인용이 없음. 개명 자체가 이름 충돌을 실질적으로 해소했으므로 결함은 아님. | `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts` | 선택적 후속: 반대쪽에도 "WS 인앱 알림의 `InAppNotificationEventType` 과는 무관" 한 줄 추가하면 두 파일만 봐도 관계가 완결됨. |
| 3 | maintainability | `hasDefaultExport` 의 반환 스타일이 파일 내 형제 헬퍼(`…LeavesValueEdge` 동사형 네이밍)와 약간 다르고(`has` 접두), 함수 내부에서 early-return 과 단일 `return (표현식)` 스타일이 섞여 있음. 기능·가독성 영향 없는 순수 스타일 차이. | `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:180-194` | 필수 아님. 향후 유사 헬퍼 추가 시 기존 네이밍 패턴과의 정렬을 한 번 더 검토. |
| 4 | scope | `InAppNotificationEventType` JSDoc 이 이전 2줄 disambiguation 주석 대비 약 11줄로 상당히 길어짐. 개명 자체가 "주석만으로는 오import 를 못 막는다"는 반성에서 나온 조치라는 근거가 문서화돼 있고 파일 내 다른 export 의 근거 주석 밀도와도 부합. | `codebase/backend/src/modules/websocket/websocket-events.types.ts:213-224` | 조치 불요 — 컨벤션 준수로 판단. |
| 5 | maintainability | `plan/in-progress/ws-event-types-extract.md` 의 정보 밀도가 매우 높음(다단 인용 블록, 누적 실측표). 코드가 아니라 작업 추적 문서이며 저장소가 명시적으로 채택한 "근거는 문서에 남긴다" 컨벤션의 결과. | `plan/in-progress/ws-event-types-extract.md` | 조치 불요 — 컨벤션 준수로 판단. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인증/인가/암호화/마스킹 로직 불변경. enum 개명(값 불변) + 테스트 정적 가드 리팩터만 — 취약점 없음. |
| requirement | NONE | 개명 6곳 전수 grep 확인, jest 6/6, 뮤테이션으로 캐너리 실효성 확인. plan-complete 미이동은 developer 권한 밖 위임(정상). |
| scope | NONE | plan 이 명시한 두 백로그 항목만 정확히 구현, drive-by 없음, 설정/포맷팅 변경 없음. |
| side_effect | NONE | enum 개명은 wire 값 불변(순수 컴파일 타임), 신규 헬퍼는 순수 함수, 외부 소비자 0(grep 재확인). |
| maintainability | NONE | 중복 제거·타입 안전성 개선·네이밍 명확화. 함수 길이/복잡도/매직넘버 문제 없음. 스타일 관찰만 INFO. |
| testing | LOW | 핵심 로직은 실행 검증됨(jest 6/6, 63/63). 단, 신규 별칭-감지 분기가 스위트에서 양성 실행되지 않음(뮤테이션으로 실증) — WARNING 1건. |
| documentation | NONE | JSDoc cross-reference·spec 인용 정확, stale 참조 없음, CHANGELOG 미갱신 근거(행동 변화 0) 타당. |

## 발견 없는 에이전트

security, requirement(WARNING/CRITICAL 없음, INFO만), scope, side_effect, maintainability(INFO만), documentation(INFO만)

## 권장 조치사항
1. (WARNING) `hasDefaultExport()` 의 별칭(`as default`) 감지 분기에 대해 `ts.createSourceFile` 기반 합성 소스 문자열로 테이블 기반 양성/음성 단위 테스트를 추가해 커버리지 갭을 영구히 닫는다. 비용 낮음(이미 이 파일을 만지는 diff).
2. (INFO, 선택) `notification-config.dto.ts` 의 `NotificationEventType` JSDoc 에 `InAppNotificationEventType` 과 무관하다는 대칭 한 줄을 추가해 disambiguation 을 완결한다.
3. (INFO, 조치 불요) `plan/in-progress/ws-event-types-extract.md` 의 `plan/complete/` 이동은 `egress-masking.md:89` DEAD 링크 정정을 위한 후속 planner 턴을 기다린다 — 이번 PR 범위 밖으로 정확히 위임됨.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 표 (아래, 7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — **전원 결과 확보됨**(forced whitelist 7명 전부 success + 전문 확보, 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위 밖(성능 영향 없는 enum 개명 + 테스트 헬퍼 리팩터) |
  | architecture | router 판단상 이번 diff 범위 밖(구조 변경 없음) |
  | dependency | router 판단상 이번 diff 범위 밖(의존성 변경 없음) |
  | database | router 판단상 이번 diff 범위 밖(DB 접근 코드 변경 없음) |
  | concurrency | router 판단상 이번 diff 범위 밖(동시성 로직 변경 없음) |
  | api_contract | router 판단상 이번 diff 범위 밖(외부 API 계약 변경 없음, wire 값 불변) |
  | user_guide_sync | router 판단상 이번 diff 범위 밖(사용자 가이드 문서 대상 아님) |
