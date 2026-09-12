# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. `codebase/**` 자체는 7라운드에 걸쳐 CRITICAL/WARNING 이 모두 해소되어 이번 라운드 10개 reviewer 전원(강제 7명 포함) NONE 으로 수렴했으나, 마지막 plan 커밋(`1e1d484c2`)이 `plan/complete/chat-channel-rules-cleanup.md` 내부 뮤테이션 개수 표기를 세 자리 중 한 곳만 갱신해 문서 내부 불일치가 새로 발생했다(WARNING 1건). forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 확인됨 — 누락 없음.

**참고(비차단, 현재는 해소 확인됨)**: `user_guide_sync` 리뷰어가 검토 도중 작업 트리에 `chat-channel-input-rules.ts` 의 미커밋 뮤테이션(`hasField` truthy 치환) 잔존을 관측·보고했다. `testing` 리뷰어도 동일 뮤테이션을 자신이 검증용으로 만들었다가 원복했다고 기록했다 — 병렬 실행 중 한 리뷰어가 다른 리뷰어의 임시 뮤테이션을 관측한 타이밍 문제로 판단된다. 본 SUMMARY 작성 시점에 `git status --short`/`git diff HEAD -- .../chat-channel-input-rules.ts` 로 직접 재확인한 결과 **워킹트리는 clean 하고 잔여 diff 없음** — 현재는 해소된 상태이나, 공유 워크트리 뮤테이션 오염 패턴(기존에도 반복 관찰됨)이므로 기록만 남긴다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | DOCUMENTATION | plan 문서 안에서 뮤테이션 개수가 세 자리에서 다르게 적혀 있다 — 체크리스트는 "9종", `## 증거`/`## 실측 기록` 소제목은 "6종"/"여섯"인데 표 자체는 9행. 라운드 2가 동일 종류 불일치를 이미 한 번 통일했던 자리(당시엔 6종으로 일치)에서, 마지막 커밋(`1e1d484c2`)이 체크리스트 한 곳만 갱신하고 나머지 둘을 놓쳐 재발했다. `plan/complete/` 로 봉인된 이력 문서라 다음 사람이 이 표를 근거로 삼을 때 혼동을 준다. | `plan/complete/chat-channel-rules-cleanup.md:87`("실제로는 **여섯**"), `:102`(체크리스트 "9종"), `:120`(`## 실측 기록 — 뮤테이션 6종` 소제목, 아래 표 9행) | `:87` "여섯"→"아홉", `:120` 소제목 "6종"→"9종"으로 갱신해 체크리스트(`:102`)와 일치시키는 후속 커밋. `codebase/**` 무관이라 리뷰 게이트는 안 걸리지만 plan 사후 정정으로 처리 가능 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/15-chat-channel.md` frontmatter `code:` glob(`.../dto/chat-channel-*.dto.ts`)이 `*` 가 `/` 를 넘지 않는 정본 매처 특성상 신규 파일 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 를 못 잡는다. 코드는 `swagger.md §5-1` 응답 DTO 배치 규약을 정확히 따랐으므로 spec 쪽이 낡았다. | `spec/5-system/15-chat-channel.md` frontmatter `code:` | 코드 유지(재배치가 올바른 결정) + `code:` glob 을 `dto/**/chat-channel-*.dto.ts` 로 넓히는 것을 planner 턴에서 반영. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재됨 — 이번 developer 턴 조치 불요 |
| 2 | API_CONTRACT / SECURITY | `rotateBotToken` 의 `:id` 파라미터에 `ParseUUIDPipe` 부재 — 같은 컨트롤러 다른 6개 `@Param('id', ...)` 은 전부 사용. `git log -S` 로 이 PR 이전(`e827ed2a7`)부터 있던 상태임을 확인 — 이번 diff 의 회귀 아님. 비-UUID 는 404(`RESOURCE_NOT_FOUND`)로 수렴해 인가 우회는 없으나 상태 코드 불일치(400 대신 404)는 남음 | `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` (`@Param('id') triggerId: string`) | 조치 불요(스코프 밖, 기존 트래커 이월). 재-flag 지양 |
| 3 | API_CONTRACT | `rotateBotToken` 요청 바디가 DTO 클래스 없이 인라인 타입(`{ newBotToken?: string }`) — `@ApiBody()` 스키마 없음, 전역 class-validator 미적용(수동 `if` 체크만). 이 PR 이전부터 있던 상태 | `triggers.controller.ts:287`, 검증 `:294-299` | 조치 불요(스코프 밖). 후속 확장 시 `RotateBotTokenRequestDto` 도입 고려 |
| 4 | TESTING / ARCHITECTURE | `rotateBotToken` 응답 DTO(`ChatChannelRotateBotTokenDto`)에 `response-contract`(선언 vs 실제 런타임 값) 런타임 검증이 미배선 — 저장소 전역 60개 엔드포인트 중 4개만 배선된 기존 갭의 연장. 이 PR 이 "선언이 실제 반환보다 좁음" 결함을 두 차례 냈던 자리라 우선순위 있음 | `triggers.controller.ts` — `rotateBotToken` `@ApiOkWrappedResponse` 자리 | 조치 불요(스코프 밖, 기존 트래커). 후속으로 `response-contract` 배선 대상에 추가 검토 |
| 5 | ARCHITECTURE / MAINTAINABILITY | `chat-channel-input-rules.ts` 가 입력 검증(`assertChatChannelInputSafe` 등)과 출력 에러 변환(`translateSetupChannelError`)이라는 서로 다른 책임을 여전히 한 파일에 갖는다 — 6라운드 내내 반복 관찰, 분리는 spec §7 파일 트리를 건드리는 planner 축 결정이라는 근거로 명시적으로 유예되어 헤더 주석에 문서화됨 | `chat-channel-input-rules.ts` 헤더 주석, `translateSetupChannelError` 정의부 | 조치 불요 — 이미 트래커 추적 중 |
| 6 | ARCHITECTURE | `botIdentity` 형태가 도메인 타입(`chat-channel/types.ts`)·입력 DTO(`ChatChannelBotIdentityDto`)·응답 DTO(`ChatChannelRotateBotIdentityDto`) 세 곳에 독립 선언 — 계약이 다르다는 실측 근거를 diff 주석에 남겼고 서비스↔응답 축은 도메인 타입 참조로 드리프트를 컴파일러가 잡도록 고정함 | `chat-channel/types.ts`, `dto/chat-channel-config.dto.ts`, `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` | 조치 불요. 도메인 타입에 필드 추가 시 응답 DTO 수동 동기 필요하다는 점만 인지 |
| 7 | SCOPE | `repo-guards` DTO 클래스명 충돌 가드(신규, 작업 #7)는 plan 원 작업표(#1~#6)에 없던 항목 — 이 PR 자신이 라운드 1에서 낸 CRITICAL(동명 클래스 충돌)의 재발 방지책으로, plan 체크리스트에 투명하게 별도 번호로 기록되고 스캔 범위를 최소로 제한함. 은폐형 스코프 확장 아님 | `plan/complete/chat-channel-rules-cleanup.md` 체크리스트 "7. repo-guards..." | 조치 불요. `swagger.md §5-1` 규약 프로즈 등재 후속 항목 이미 트래커에 있음 |
| 8 | MAINTAINABILITY / TESTING | `throwInvalidField(field: string, ...)` 저수준 헬퍼가 여전히 넓은 `string` 타입 — `rejectBlockedField` 를 경유하지 않는 6개 직접 호출부(`'chatChannel'`/`'provider'`/`'inboundSigningPlaintext'` 리터럴 반복)는 오타-컴파일에러 보호를 못 받음. 각 호출부 `details.field` 를 단언하는 테스트는 있어 오타는 RED 로 드러나지만 "타입이 막는다"가 아니라 "테스트가 우연히 단언한다"는 간접적 보호 | `chat-channel-input-rules.ts:56`(선언), 호출부 `:202,220,267,281,291,298` | 조치 불요(기존 유예, 2회 반복 지적). 재발 시 리터럴 유니언으로 좁히는 것 고려 |
| 9 | TESTING | 신규 `dto-class-name-collision.spec.ts` 대조군은 충돌 그룹 1개만 검증 — `findDtoClassCollisions` 의 그룹 간/그룹 내 정렬 로직의 실제 값(파일명)까지는 미단언(`files` 는 개수만 확인). 가드의 존재 목적(중복 0 유지)에는 영향 없음 | `dto-class-name-collision.spec.ts` (대조군 케이스) | 급하지 않음. 다중 충돌 실사용 시 정렬 값 단언 확대 고려 |
| 10 | MAINTAINABILITY | 신규 컨트롤러 반환 타입 설명 주석이 마지막 매개변수(`userId`) 바로 아래에 위치해 처음 읽을 때 무엇에 대한 설명인지 한 박자 늦게 파악됨. 신규 fixture 디렉터리명(`dto-class-collision`)이 가드/스펙 이름(`dto-class-name-collision`)과 한 단어 차이 — 실혼동 사례는 없음(파일 3개, 헤더 주석이 소유 명시) | `triggers.controller.ts:289-293`; `repo-guards/__tests__/fixtures/dto-class-collision/` | 급하지 않음. 다음 편집 때 주석 위치/디렉터리명 정리 고려 |
| 11 | SIDE_EFFECT / SECURITY | 컨트롤러/서비스 반환 타입 애노테이션 변경 2건(구조적 타입만)과 신규 swagger 데코레이터는 컴파일 타임/문서 메타데이터 전용 — 전역 `ClassSerializerInterceptor` 부재를 실측(grep) 확인해 런타임 응답 바디에 영향 없음을 검증. 신규 repo-guard 는 파일 읽기 전용, 부작용·네트워크·env 접근 없음. 신규 헬퍼 3종은 순수 함수(클로저 상태 없음) | `triggers.controller.ts` rotateBotToken 시그니처; `triggers.service.ts:991-997`; `repo-guards/__tests__/dto-class-name-collision-guard.ts` | 조치 불요(확인 기록). `ClassSerializerInterceptor` 향후 도입 시 응답 DTO 반환 전 컨트롤러 재검증 필요하다는 점만 트래커 참고 |
| 12 | 프로세스(공유 워크트리) | `user_guide_sync` 리뷰어가 검토 도중 `chat-channel-input-rules.ts` 에 미커밋 뮤테이션(`hasField` truthy 치환, `testing` 리뷰어가 판별력 검증용으로 만든 것과 동일 패턴) 잔존을 관측·보고. SUMMARY 작성 시점 재확인 결과 워킹트리는 clean, 잔여 diff 없음 — 병렬 실행 타이밍 문제로 이미 해소됨 | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (`hasField`) | 조치 불요(해소 확인됨). 병렬 리뷰어 워크트리 오염 패턴 기록용 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL/WARNING 없음. `ParseUUIDPipe` 부재는 기존 상태(INFO), 신규 헬퍼가 보안 회귀 표면을 오히려 줄이는 방향 |
| architecture | NONE | 입력/출력 책임 혼재(유예 중), `botIdentity` 3중 선언(계층 분리 근거 있음), 신규 DTO 충돌 가드는 fitness function 으로 긍정 평가 |
| requirement | NONE | spec §5.4 계열과 line-level 일치 재확인, GREEN 테스트 전수 재실행. SPEC-DRIFT 1건(`code:` glob) |
| scope | NONE | plan 작업표 #1~#6 과 diff 1:1 대응, 벗어난 항목(#7 가드)도 투명 기록·근거 있는 확장 |
| side_effect | NONE | 반환 타입 변경 2건 모두 컴파일타임 전용(ClassSerializerInterceptor 부재 실측), 신규 헬퍼/가드 순수 함수 |
| maintainability | NONE | 헬퍼 추출 품질 높음, 잔여 지적 전부 기존 유예 항목의 연속(INFO) |
| testing | NONE | 4 suites/243 tests GREEN, 뮤테이션 재검증(`hasField` truthy 치환 → 4건 RED)으로 신규 테스트 판별력 확인 |
| documentation | LOW | plan 문서 내부 뮤테이션 개수 표기 불일치(체크리스트 9종 vs 증거/소제목 6종) — WARNING 1건, 이번 마지막 커밋이 재발시킴 |
| api_contract | NONE | CRITICAL(스키마명 충돌)·WARNING(응답 필드 누락) 과거 해소 재확인. 잔여 2건은 PR 이전부터 있던 상태(INFO) |
| user_guide_sync | NONE | doc-sync-matrix 20행 중 `backend-api-change` 만 매칭, 같은 changeset 내 완결. 공유 워크트리 뮤테이션 잔존 관측(현재 해소) |

## 발견 없는 에이전트

없음 — 전원 최소 1건 이상의 INFO 관찰을 남겼으나, CRITICAL/WARNING 급 신규 결함은 documentation 1건(WARNING, plan 문서 한정) 외에는 없음.

## 권장 조치사항

1. `plan/complete/chat-channel-rules-cleanup.md` 의 뮤테이션 개수 표기를 통일한다 — `:87` "여섯"→"아홉", `:120` 소제목 "6종"→"9종" (체크리스트 `:102` 의 "9종"과 일치시킴). `codebase/**` 무관이라 리뷰 게이트는 안 걸리지만 후속 커밋으로 정정 권장.
2. (선택, planner 턴) `spec/5-system/15-chat-channel.md` frontmatter `code:` glob 을 `dto/**/chat-channel-*.dto.ts` 로 넓혀 신규 `dto/responses/**` 경로가 spec-link 판정에 잡히도록 한다 — [SPEC-DRIFT], 이미 트래커 등재됨.
3. 그 외 INFO 항목들은 모두 이번 PR 스코프 밖 기존 갭이거나 이미 유예·트래커 등재된 항목으로 즉시 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (10명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보 확인됨 — 누락 없음)
  - **제외**: 아래 표 (4명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 무관 (순수 리팩터 + swagger 문서화, 성능 경로 변경 없음) |
  | dependency | 신규 외부 패키지 의존성 추가 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 제어 로직 변경 없음 |