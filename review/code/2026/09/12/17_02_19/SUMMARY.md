# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 1건(이 PR 자신이 냈던 Swagger DTO 클래스명 충돌 결함의 재발 방지가 커밋되지 않는 1회성 grep 검증에만 의존 — 자동화된 회귀 테스트 부재)만 남아 병합을 막을 사유는 아니며, forced 화이트리스트(7명) 전원 결과 확보 확인됨.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 이 PR 자신이 라운드 1에서 낸 CRITICAL(Swagger 응답 DTO 클래스명 `ChatChannelBotIdentityDto` 충돌)의 재발 방지가 커밋되지 않는 1회성 수동 `grep` 검증에만 의존한다. 저장소는 이미 같은 결함 클래스(정적 DTO 계약 불일치)를 jest 로 고정하는 선례(`repo-guards/__tests__/swagger-dto-contract.spec.ts`)를 갖고 있는데, "DTO 클래스명 유일성"에는 적용돼 있지 않다. | `codebase/backend/src/repo-guards/__tests__/`(해당 가드 부재) | `swagger-dto-contract.spec.ts` 와 같은 자리에 `**/*.dto.ts` 전수 스캔으로 `export class` 이름 중복이 0건임을 고정하는 jest 케이스 추가 (라운드 2가 수행한 grep 로직을 테스트로 승격) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서(plan) | `plan/in-progress/chat-channel-rules-cleanup.md` 체크리스트가 3라운드째 전항목 미체크 상태(본문·RESOLUTION.md 는 완료를 증언) — requirement·documentation 중복 지적 | `plan/in-progress/chat-channel-rules-cleanup.md` `## 체크리스트` | 이번 라운드가 수렴(CRITICAL/코드 변경 요구 없음)으로 판정되면 즉시 체크리스트 전체 체크 + `plan/complete/` 이동 (plan 자신의 정지 규칙이 이미 요구) |
| 2 | API 계약 | `rotateBotToken` 의 `:id` 파라미터에 `ParseUUIDPipe`/`@ApiParam({format:'uuid'})` 부재 — 형제 엔드포인트(`findOne`/`update`/`remove`/`revokePerTriggerToken`)와 검증 방식 불일치. 비-UUID 는 404 로 수렴해 치명적이지 않음. PR 이전부터 존재, 스코프 밖 | `codebase/backend/src/modules/triggers/triggers.controller.ts:285-286` | 후속 PR 에서 다른 rotate 계열과 일관되게 `ParseUUIDPipe` 적용 |
| 3 | API 계약 | `rotateBotToken` 요청 바디가 class-validator DTO 가 아닌 인라인 타입(`@Body() body: { newBotToken?: string }`)이라 수동 검증만 하고 swagger request body 스키마가 없음. PR 이전부터 존재, 스코프 밖(이번 PR 은 응답 문서화만) | `codebase/backend/src/modules/triggers/triggers.controller.ts` (`rotateBotToken`) | 후속 PR 에서 `newBotToken` 전용 요청 DTO 도입 |
| 4 | 아키텍처 | `chat-channel-input-rules.ts` 가 입력 검증과 출력 에러 변환(`translateSetupChannelError`)이라는 두 책임을 한 파일에 유지 — 분리하려면 `spec/5-system/15-chat-channel.md §7` 파일 트리 편집(planner 축)이 필요해 이번 턴 스코프 밖으로 유예됨(plan 문서에 근거 명시) | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (헤더 34-39행, `translateSetupChannelError` 329-348행) | 조치 불요 — 파일이 더 커지는 시점을 분리 트리거로 삼을 것 |
| 5 | 아키텍처 | 컨트롤러 반환 타입이 DTO 클래스이지만 class-transformer 를 거치지 않아 계층 계약이 컴파일 타임에만 강제됨(런타임 필드 화이트리스트 없음) — 저장소 전역 갭(`api_contract`/`documentation` 리뷰가 이미 등재)의 연장, 이 PR 만의 문제 아님 | `codebase/backend/src/modules/triggers/triggers.controller.ts` (`rotateBotToken` 시그니처), `triggers.service.ts:986-1123` | 조치 불요 — 전역 `response-contract` 배선 작업에서 함께 처리 권장 |
| 6 | 유지보수성 | `throwInvalidField(field: string, …)` 가 넓은 `string` 이라 `rejectBlockedField` 를 경유하지 않는 6개 직접 호출부(`'inboundSigningPlaintext'` 리터럴 4회 반복 포함)는 오타-컴파일에러 보호를 못 받음 — 이미 2회 유예된 트레이드오프 | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:56, 205, 223, 270, 284, 294, 301` | 조치 불요(유예 유지). 호출부 증가 또는 실제 오타 사고 시 유니언으로 좁히는 것 고려 |
| 7 | 유지보수성 | `null`/`빈 문자열` 검증 `it.each` 블록이 `botToken`용·`inboundSigningPlaintext`용으로 거의 동일하게 반복(구조 중복) | `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts:94-106, 108-125` | 급하지 않음. 세 번째 필드 추가 시 이중 `it.each`/`describe.each` 로 통합 권장 |
| 8 | 유지보수성 | `rotateBotToken` 반환 타입 선택 근거 주석이 파라미터 목록 중간(마지막 파라미터와 닫는 괄호 사이)에 끼어 시그니처 가독성을 끊음(순수 스타일) | `codebase/backend/src/modules/triggers/triggers.controller.ts:285-293` | 급하지 않음. 다음에 만질 때 데코레이터 블록 설명에 합치거나 반환 타입 줄 위로 이동 |
| 9 | 테스트 | `rotateBotToken` 반환 타입 확장(`publicKey` 필드 포함)이 런타임 테스트로 단언되지 않음 — 전체 스프레드 반환이라 당장 위험은 낮으나, 추후 명시적 필드 나열로 바뀌면 조용히 누락될 수 있음. 직전 라운드가 이미 이월·defer 확정 | `codebase/backend/src/modules/triggers/triggers.service.ts:990-998, 1126`; `triggers.service.spec.ts:2095-2130` | 급하지 않음. 재개 시 `botIdentity` 테스트에 `publicKey` 포함 케이스 추가 |
| 10 | 테스트 | `assertChatChannelAlreadySetUp` 의 `incoming.provider &&` falsy-guard 가 `chat-channel-input-rules.spec.ts` 단독으로는 미검증(HTTP 경로 차단은 별도 DTO 검증 테스트로 고정됨). 직전 라운드부터 이어지는 이월 항목 | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:222`; `chat-channel-input-rules.spec.ts:295-304` | 급하지 않음. `provider: undefined` 단일 케이스 추가 시 파일 내에서 완결 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 라운드 1 CRITICAL(스키마 이름 충돌) 해소 재확인. `hasField` 존재판별이 `null`/`''` 로 비밀 필드를 우회하는 결함 클래스를 원천 차단·회귀 테스트로 고정한 개선점 확인 |
| architecture | LOW | `chat-channel-input-rules.ts` 의 입력검증+출력변환 이중 책임(스코프 밖 유예), 컨트롤러 반환 타입 구조적 타이핑 한계(전역 갭) — 신규 CRITICAL/WARNING 없음 |
| requirement | NONE | spec(`15-chat-channel.md §5.4/§5.4.1`)과 line-level 대조 완전 일치. 라운드 1·2 지적 전부 실측 재검증으로 해소 확인 |
| scope | NONE | 조치 커밋(`e07521a27`)이 직전 라운드 WARNING 3건 범위만 정확히 수정, 무관한 변경 없음 |
| side_effect | NONE | 전역 상태·환경변수·네트워크·이벤트 순서 영향 없음. 컨트롤러 반환 타입 변경도 구조적으로 안전한 타입 레벨 좁힘 |
| maintainability | LOW | `field: string` 타이핑 범위(2회 유예), 테스트 `it.each` 구조 중복, 주석 위치 스타일 — 전부 저위험 |
| testing | LOW | **WARNING**: DTO 클래스명 충돌 재발 방지 자동 회귀 테스트 부재. 나머지는 저위험 이월 항목(`publicKey` 런타임 미단언, falsy-guard 단일 파일 미검증) |
| documentation | NONE | 라운드 1·2 지적 전항목(클래스명·`publicKey`·401 응답·파일 위치·orphan JSDoc·뮤테이션 개수 서술) 코드 직접 대조로 해소 확인. plan 체크리스트 미갱신만 INFO |
| api_contract | NONE | breaking change 없음(순수 리팩터 + additive swagger 문서화). 라운드 1 CRITICAL/WARNING 필드·클래스명·import 경로 세 축 재대조로 해소 확인 |
| user_guide_sync | NONE | `backend-api-change` trigger 유일 매칭, swagger jsdoc target 은 이 diff 자체로 완결. user-guide MDX 갱신 대상 아님(API 노출 변경 없음) |

## 발견 없는 에이전트

scope, user_guide_sync — 위 표의 INFO 항목에도 해당 사항 없이 완전히 클린 판정.

## 권장 조치사항

1. (가장 중요, WARNING 해소) `codebase/backend/src/repo-guards/__tests__/` 에 `**/*.dto.ts` 전수 스캔으로 `export class` 이름 중복 0건을 고정하는 jest 케이스 추가 — `swagger-dto-contract.spec.ts` 패턴 재사용. 이번 PR 이 실제로 그 재발 시나리오의 사례였으므로 우선순위 최상단.
2. 본 라운드가 CRITICAL/WARNING 없이 수렴하는 것으로 판정되면 `plan/in-progress/chat-channel-rules-cleanup.md` 체크리스트 전체를 체크하고 `plan/complete/` 로 이동(plan 자신의 정지 규칙 이행).
3. (이월, 급하지 않음) `rotateBotToken` 의 `:id` `ParseUUIDPipe` 적용 및 요청 바디 DTO 화 — 후속 PR.
4. (이월, 급하지 않음) `throwInvalidField` field 타입 좁히기, 테스트 `it.each` 통합, `publicKey` 런타임 단언 보강, falsy-guard 단일 파일 케이스 추가 — 필요 시점에 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 확인됨(누락 없음)
  - **제외**: 4명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 해당 diff 스코프 밖 |
  | dependency | router 판단 — 신규/변경 외부 의존성 없음 |
  | database | router 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | router 판단 — 동시성 표면 변경 없음 |