# Code Review 통합 보고서

## 전체 위험도
**LOW** — 이번 라운드(5회차, `17_39_51`)의 실제 코드 델타는 직전 라운드 WARNING(bare 인용 경로)을 조치한 주석 문자열 5곳뿐이며 CRITICAL/WARNING 급 신규 결함은 없다. 누적 PR 관점에서 유일하게 살아있는 WARNING 은 `rotateBotToken` 이 고친 "응답이 선언보다 넓다(Discord `publicKey`)" 결함 클래스에 대한 런타임 회귀 테스트 부재 1건이며, forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과가 확보되어 강제 목록 미이행은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 이번 PR 이 고친 "응답 DTO 선언이 실제 반환보다 좁았다(Discord `botIdentity.publicKey` 누락)" 결함 클래스의 재발을 막는 런타임 회귀 테스트가 없다. 타입만 `NonNullable<ChatChannelConfig['botIdentity']>` 로 넓혔을 뿐, `publicKey` 가 포함된 fixture(Discord 시나리오)로 응답에 실제로 전달되는지 단언하는 테스트가 `triggers.service.spec.ts` 의 `rotateBotToken` describe 에 없음(grep 으로 전수 확인) | `codebase/backend/src/modules/triggers/triggers.service.ts` (`rotateBotToken` 반환 타입), `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts` (`ChatChannelRotateBotIdentityDto.publicKey`), 테스트 파일 `triggers.service.spec.ts` | `configUpdates.botIdentity` 에 `publicKey` 를 포함한 Discord 케이스를 `rotateBotToken` describe 에 추가해 응답 객체에 그대로 실리는지 단언. 여력이 되면 `response-contract`(`contractForDto`/`assertMatchesContract`) 를 이 DTO 에 배선해 "선언 vs 실제" 축을 구조적으로 고정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | 신규 응답 DTO(`dto/responses/chat-channel-rotate-bot-token-response.dto.ts`)가 `15-chat-channel.md` frontmatter 의 좁은 `code:` glob(`dto/chat-channel-*.dto.ts`, `*`가 `/`를 못 넘음)에 안 잡힘 — 이전 라운드(`16_39_18`·`17_02_19`)가 이미 실측·등재해 둔 planner 후속 항목, 이번 PR 신규 결함 아님 | `spec/5-system/15-chat-channel.md` frontmatter `code:` 목록 | 조치 불요(이번 라운드 범위 밖). `dto/**/chat-channel-*.dto.ts` 로 넓히는 것은 `project-planner` 턴의 몫 |
| 2 | testing | 신규 응답 DTO(`ChatChannelRotateBotTokenDto`/`ChatChannelRotateBotIdentityDto`)가 `response-contract` 런타임 검증에 배선되지 않음(저장소 전역 갭의 연장선, 이번 PR 신규 결함 아님이나 신설 시점이라 배선했으면 위 WARNING 을 코드리뷰 대신 테스트 실행이 잡았을 자리) | `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`, `triggers.controller.ts` | 배선 우선순위 후보로 기록만 |
| 3 | maintainability | `throwInvalidField(field: string, ...)` 가 넓은 `string` 이라, `rejectBlockedField` 를 경유하지 않는 6개 직접 호출부(`assertChatChannelAlreadySetUp`·`assertInboundSigningPlaintextByProvider`)는 `ChatChannelBlockedField` 유니언의 오타-컴파일에러 보호를 못 받음(4라운드 연속 이월, 테스트가 즉시 RED 로 잡아 실위험 낮음) | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:56, 205-207, 222-226, 270-304` | 급하지 않음. 호출부 증가 시 유니언 확장 고려 |
| 4 | maintainability | 신규 `dto-class-name-collision-guard.ts` 가 형제 가드(`dto-jsdoc-citation-guard.ts`)와 스타일이 다름 — 최상위 statement 만 비재귀 순회, `SRC_ROOT` 를 가드가 export 하지 않고 spec 이 직접 계산. 실측상 무해(전 DTO 클래스가 최상위, 같은 디렉터리라 값도 안 갈림)하나 "왜 여기만 다른가"를 다음 사람이 되물어야 함 | `.../dto-class-name-collision-guard.ts:33`, `dto-class-name-collision.spec.ts:42` | 급하지 않음. 스코프 고정 의도면 JSDoc 명시, 아니면 재귀 순회+`SRC_ROOT` export 로 통일 |
| 5 | maintainability | `findDtoClassCollisions` 가 파일당 불변인 `toPosixRelative` 결과를 클래스 수만큼 안쪽 루프에서 재계산 | `.../dto-class-name-collision-guard.ts:54-58` | 급하지 않음(순수 스타일), 다음에 만질 때 바깥 루프로 이동 |
| 6 | maintainability | `chat-channel-input-rules.spec.ts` 의 `it.each([null, ''])` 골격이 필드(botToken/inboundSigningPlaintext)만 바꿔 두 번 반복(라운드 3 부터 이월된 저위험 관찰, 가독성-중복 트레이드오프) | `chat-channel-input-rules.spec.ts:94-106, 108-125` | 조치 불요 |
| 7 | scope/documentation | RESOLUTION 의 "이 PR 파일 안 bare 인용 0건" 주장은 "이 PR 이 새로 넣은 인용" 기준으로만 참 — `trigger-dto-validation.spec.ts:845` 에 별개 PR(#1314, 2026-09-11) 소유의 pre-existing bare 인용 1건이 남아 있으나 `review-citations.md §4`(소급 정리 예외)에 따라 의도적으로 손대지 않은 것으로 스코프 위반 아님 | `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:845` | 조치 불요, 문구 정밀도 참고용 |
| 8 | user_guide_sync | 사용자 가이드 MDX 4곳이 rotate-bot-token 404 를 `TRIGGER_NOT_FOUND` 로 서술하나 실제 코드는 `RESOURCE_NOT_FOUND` 반환 — 2026-05-23 커밋(#282)에서 유입된 4개월 앞선 선재 결함이며 이번 diff 는 해당 MDX 를 건드리지 않음 | `content/docs/06-integrations-and-config/telegram{,.en}.mdx`, `02-nodes/triggers{,.en}.mdx` | 이번 PR 범위 밖. 별도 plan/PR 에서 일괄 정정 권고 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 이번 라운드 델타(주석 인용 경로 3곳)·누적 PR 전체 모두 CRITICAL/WARNING 없음. 인가 데코레이터·시크릿 비노출(SS-SE-01)·입력 검증·에러 처리 무변경 재확인 |
| requirement | NONE | 8개 함수/DTO 를 spec R-CC-21·R-CC-23·§5.4·§5.4.1·§5.4.1.2 와 line-level 대조 완료, 전수 일치. INFO 1건(glob 미매칭, 이미 등재됨) |
| scope | NONE | 이번 커밋(`01f03524c`)은 정확히 지적된 범위(bare 인용 5곳)만 순수 주석 치환. plan/설정/포맷팅 무관 변경 없음 |
| side_effect | NONE | 코드 델타는 주석뿐. 누적 diff 재스캔(`process.env`/네트워크/파일시스템/전역상태/이벤트) 0건 |
| maintainability | LOW | INFO 4건(전부 4라운드 연속 이월된 저위험 관찰, 실측상 무해) |
| testing | LOW | WARNING 1건(publicKey 회귀 테스트 부재) + INFO 2건(response-contract 미배선, 신규 가드 품질 긍정 평가) |
| documentation | NONE | 모든 JSDoc 사실 주장(호출 횟수·카운트·spec 절 번호)을 전수 재실측, 전부 일치. stale comment 재발 없음 |
| api_contract | NONE | 라운드 1~2 의 CRITICAL(스키마명 충돌)·WARNING(publicKey 누락)은 해소·재검증 완료. 이번 라운드 신규 지적 없음 |
| user_guide_sync | NONE | 매트릭스 20행 중 `backend-api-change` 1건만 매칭, 이미 충족/갱신 불요. INFO 1건(선재 결함, 이번 PR 무관) |

## 발견 없는 에이전트

security, scope, side_effect, documentation, api_contract, user_guide_sync (모두 NONE — Critical/Warning 미발견)

## 권장 조치사항
1. (선택, 다음 라운드 또는 후속 PR) `triggers.service.spec.ts` 의 `rotateBotToken` describe 에 `publicKey` 포함 Discord 시나리오 케이스를 추가해 응답 전달을 런타임으로 단언 — 이번 PR 이 고친 결함 클래스(선언<실반환)의 재발 방지 공백을 메운다.
2. (선택, 배선 우선순위 후보) 신규 `ChatChannelRotateBotTokenDto` 를 `response-contract` 에 배선.
3. (플래너 축, 이미 등재됨) `15-chat-channel.md` frontmatter `code:` glob 을 `dto/**/chat-channel-*.dto.ts` 로 넓혀 신규 응답 DTO 를 포함시킬지 검토.
4. (별도 plan, 이번 PR 무관) 사용자 가이드 MDX 4곳의 `TRIGGER_NOT_FOUND` → `RESOURCE_NOT_FOUND` 표기 일괄 정정.
5. maintainability INFO 4건은 즉시 조치 불요 — 다음에 해당 파일을 만질 때 함께 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨 (forced 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(주석 치환 + 순수 헬퍼 추출/타입 정밀화)과 무관 |
  | architecture | router 판단상 구조적 재설계 없음(기존 모듈 경계 내 리팩터) |
  | dependency | 신규 외부 의존성 없음(기존 `typescript`/`@nestjs/swagger` 재사용) |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 로직 변경 없음 |