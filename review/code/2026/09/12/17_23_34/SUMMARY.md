# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음, WARNING 1건(신규 코드 주석의 날짜 없는 세션 인용 — 강제 가드 없음, 병합 차단 사유 아님). forced 화이트리스트 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 확인됨 — 강제 목록 미이행으로 인한 은폐된 위험 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 이번 diff 가 새로 추가한 코드 주석 5곳이 `spec/conventions/review-citations.md` §2("bare `hh_mm_ss` 금지")를 위반 — 날짜 없이 세션 시각만 인용해 향후 이력 추적 불가 | `chat-channel-input-rules.spec.ts:88`, `chat-channel-rotate-bot-token-response.dto.ts:9,23,55`, `triggers.service.ts:995` (전부 신규 `+` 줄) | 다섯 곳을 `` `/ai-review` `2026-09-12 16_17_57` `` 또는 전체 경로 형태로 날짜 보강. 강제 가드는 없어 병합 차단 사유는 아니나, 저장소가 이미 문서화한 실측 교훈(§2, 날짜 없는 인용은 이력으로도 해소 불가)에 정면으로 어긋나므로 반영 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 신규 `dto-class-name-collision` 가드가 그 가드를 낳은 swagger 스키마 계약의 spec 문서(`swagger.md`) `code:` 목록에 미등재 — 자매 가드(`swagger-dto-contract-guard.ts` 등)와 달리 spec-coverage 감사 시야 밖에 남음 | `spec/conventions/swagger.md` frontmatter `code:`, 신규 `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision*.ts` | developer 권한 밖(spec 쓰기는 planner 축). `plan/in-progress/spec-draft-nullable-notation-followups.md:3052` 트래커 항목에 "`swagger.md` code: 에 이 가드 추가" 처분을 구체화해 다음 planner 턴에서 처리 |
| 2 | scope / documentation (통합) | `plan/in-progress/chat-channel-rules-cleanup.md` 체크리스트가 4라운드째 미체크 상태, 신규 repo-wide 가드도 plan 「작업」표 6개 항목에 사전 선언돼 있지 않음(다만 라운드 3 testing WARNING 에 대한 정직하고 비례적인 후속 조치로 판단, "의도 밖 확장" 아님) | `plan/in-progress/chat-channel-rules-cleanup.md` `## 체크리스트`, 「작업」표 | 이번 라운드가 CRITICAL/WARNING·`codebase/**` 신규 수정 요구 없이 수렴하면(=지금), 체크리스트 전항목 갱신 + 「작업」표에 "7. repo-guards DTO 클래스명 충돌 가드" 한 줄 추가 + `plan/complete/` 이동 |
| 3 | architecture / maintainability (통합) | 신규 가드 `exportedClassNames` 가 파일 최상위 statement 만 순회(비재귀) — 형제 가드(`dto-jsdoc-citation-guard.ts`)는 `ts.forEachChild` 재귀 순회를 씀. 스캔 루트도 `['modules','common']` 로 닫힌 열거(실측 114개 `.dto.ts` 전부 이 안에 있어 현재는 무해) | `dto-class-name-collision-guard.ts:25-41` (exportedClassNames), 파일 상단 `SCAN_ROOTS` | 급하지 않음. 완전성을 주장하는 가드이므로 스코프를 JSDoc 에 명시하거나 형제 가드처럼 재귀 순회/`collectTsFiles(SRC_ROOT)` 전체 스캔+fixture 필터링으로 통일 검토 |
| 4 | maintainability | `SRC_ROOT` 계산을 spec 파일이 가드 모듈에서 export 받지 않고 손으로 재계산 — 형제 가드가 정착시킨 "한 곳이 소유" 패턴과 불일치. `toPosixRelative` 도 클래스마다 재계산(불변값) | `dto-class-name-collision.spec.ts:42`, `dto-class-name-collision-guard.ts:54-57` | 급하지 않음(순수 스타일). `SRC_ROOT`/`SCAN_ROOTS` export 후 spec 이 import, `rel` 계산은 바깥 루프로 이동 |
| 5 | security / requirement (통합) | `rotateBotToken` 의 `:id` 파라미터에 `ParseUUIDPipe` 부재 — 3라운드 연속 지적된 PR 이전부터의 스코프 밖 사안. `workspaceId` 스코프 조회로 인가 우회로는 이어지지 않음(404 로 수렴) | `triggers.controller.ts` — `rotateBotToken(@Param('id') triggerId: string, ...)` | 조치 불요(이번 PR 스코프 밖). 후속 PR 에서 형제 엔드포인트(`revokePerTriggerToken`)와 정렬 권장 |
| 6 | requirement | `throwInvalidField(field: string, ...)` 의 `field` 가 넓은 `string` 이라 `ChatChannelBlockedField` 유니언의 오타 방지 혜택을 못 받는 직접 호출부 6곳 존재 — 각 호출부에 `details.field` 단언 테스트가 있어 회귀 위험은 낮음 | `chat-channel-input-rules.ts` — `throwInvalidField` 선언부 및 호출부 | 조치 불요, 이미 2라운드 연속 관찰·문서화된 트레이드오프 |
| 7 | testing | 신규 `dto-class-name-collision` 가드는 "정확히 2개 파일 충돌"만 fixture 로 실증 — 3개 이상 동명 클래스(N-way 충돌) 경로는 대조군 없음. 실제 필터 로직(`length > 1`)은 N 에 무관하나 정렬/보고 문자열이 3개 이상에서 검증되지 않음 | `dto-class-name-collision.spec.ts:73-79`, `dto-class-name-collision-guard.ts:49-67` | 급하지 않음. `gamma.dto.ts` fixture 추가로 3-way 케이스 보강 가능 |
| 8 | testing | 라운드 3 이월 항목 2건(이번 diff 범위 밖, defer 확정) — (a) `botIdentity.publicKey` 채움에 대한 회귀 테스트 부재, (b) `assertChatChannelAlreadySetUp` 의 `provider &&` falsy-guard 가 `chat-channel-input-rules.spec.ts` 단독으로는 미검증(DTO 층 테스트로만 간접 보장) | `triggers.service.spec.ts`(부재), `chat-channel-input-rules.ts:222` | 조치 불요, 기존 defer 상태 유지 |
| 9 | requirement / side_effect / testing (통합) | 리뷰 도중 `chat-channel-input-rules.ts` 의 `hasField` 가 **워킹트리에서만 미커밋 상태로** truthy 판별(`!!`)로 일시 변형돼 있는 것을 3개 reviewer 가 독립 관측 — 본 리뷰가 만든 변경이 아니며(각자 `Read`/`git status` 로만 확인, `git checkout/restore` 미사용), 재확인 시점엔 스스로 원복돼 사라짐. 동시 실행 중인 다른 검증 세션의 뮤테이션 잔여물로 추정(이전 라운드 `16_39_18` api_contract.md 도 동일 패턴 1회 기록) | `chat-channel-input-rules.ts` — `hasField` 함수 | 조치 불요(판정에 영향 없음, 커밋된 diff 기준으로 평가함). 공유 워크트리에서 병렬 리뷰 세션이 서로를 오염시키는 패턴이 재발했다는 사실만 기록 — 트래커에 "병렬 세션 워크트리 격리" 항목으로 누적 가치 있음 |
| 10 | security | 신규 응답 DTO(`ChatChannelRotateBotTokenDto`/`ChatChannelRotateBotIdentityDto`)는 `botToken`/`botTokenRef`/`inboundSigningRef`/`inboundSigningPlaintext` 등 비밀 필드를 노출하지 않음(재확인, SoT 타입과 필드 단위 대조 완료) | `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` | 조치 불요 |

## 확인했으나 문제 없음 (요약)

- **라운드 1~3 CRITICAL/WARNING 전건 해소 재검증**: swagger 스키마 클래스명 충돌(CRITICAL) 개명 완료 + 재발 방지 가드 신설·뮤테이션으로 RED 재현(원복 완료) / `publicKey` 누락(WARNING) 필드 반영 / DTO 파일 `dto/responses/` 재배치 / 서비스 층 `null`/`''` secret 우회 차단(2계층) — 전부 코드·테스트로 고정됨을 security·requirement·testing·api_contract 4개 reviewer 가 독립적으로 재확인.
- **API 계약 무변경**: 라운드 3 이후 `codebase/**` 신규 변경은 순수 정적 가드/테스트뿐이며 엔드포인트·요청/응답 스키마·인증·라우팅은 한 글자도 바뀌지 않음(api_contract NONE).
- **사용자 가이드 갱신 불요**: `backend-api-change` 트리거만 매칭됐고 target 이 이미 같은 diff(swagger jsdoc)로 충족되거나 기존 문서(06-integrations-and-config MDX)가 이미 다루는 동작이라 신규 갱신 대상 없음(user_guide_sync NONE).
- **부작용 없음**: 시그니처 변경 2곳은 타입 레벨 전용(실반환 객체 불변), 전역 상태·환경변수·네트워크 호출·이벤트 등록 변경 없음, 신규 파일은 전부 명시적으로 소비됨.
- **가드 설계 타당성**: 형제 가드의 좁은 술어(`isResponseDtoFile`)를 무비판적으로 재사용하지 않고 이 가드 목적(모든 DTO 클래스명 유일성)에 맞는 넓은 술어를 새로 정의한 판단이 옳음(재사용했다면 라운드 1 CRITICAL 클래스 자체를 못 잡는 vacuous 가드가 됐을 것) — architecture 상세 분석.
- **스코프 이탈 없음**: `codebase/` diff 13개 파일 전체가 plan 의도(헬퍼 추출 리팩터 + swagger 문서화 + 재발방지 가드)와 대응, frontend/설정/포맷팅 drive-by 변경 0건.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 결함 없음. ParseUUIDPipe 부재(스코프 밖)·응답 DTO 비밀 미노출 재확인 |
| architecture | LOW | 신규 가드 스캔 루트 닫힌 열거·비재귀 순회(둘 다 현재 무해, INFO) |
| requirement | NONE | spec §5.4 line-level 전부 일치. 뮤테이션 RED 재현으로 가드 유효성 검증. 병렬세션 뮤테이션 관측(비영향) |
| scope | NONE | 신규 가드가 plan 작업표 밖이나 리뷰 요구에 대한 정당한 비례적 조치 |
| side_effect | NONE | 시그니처 변경은 타입 레벨 전용, 전역/환경/네트워크 부작용 없음 |
| maintainability | LOW | 형제 가드 대비 재귀 순회·`SRC_ROOT` 소유권 관례 불일치(INFO) |
| testing | NONE | 뮤테이션 검증(hasField null/'' RED 4건) 통과. 3-way 충돌 미검증(INFO) |
| documentation | LOW | WARNING 1(날짜 없는 세션 인용) + swagger.md code: 미등재·plan 체크리스트 미갱신(INFO) |
| api_contract | NONE | API 표면 무변경, 라운드 1~2 CRITICAL/WARNING 해소 확정 |
| user_guide_sync | NONE | 매칭된 유일 트리거도 이미 충족, 갱신 대상 없음 |

## 발견 없는 에이전트

- **api_contract** — 발견사항 "없음" 명시(NONE)
- **user_guide_sync** — 발견사항 "없음" 명시(NONE)

## 권장 조치사항

1. (권장, 비필수) documentation WARNING — 신규 코드 주석 5곳에 날짜 보강(`YYYY-MM-DD HH_MM_SS` 또는 전체 경로 형태)하여 `review-citations.md` §2 준수.
2. 이번 라운드가 CRITICAL/WARNING 없이(신규 `codebase/**` 수정 요구 없이) 수렴했으므로, `plan/in-progress/chat-channel-rules-cleanup.md` 체크리스트 전항목 갱신 + 「작업」표에 신규 가드 항목 추가 + `plan/complete/` 로 이동.
3. `swagger.md` `code:` 목록에 신규 `dto-class-name-collision` 가드 등재 처분을 트래커(`spec-draft-nullable-notation-followups.md:3052`)에 구체화 — 다음 planner 턴에서 처리(developer 권한 밖).
4. (선택, 급하지 않음) 신규 가드를 형제 가드 스타일(재귀 AST 순회, `SRC_ROOT` export)에 맞추거나, 현재 설계(최상위만·닫힌 스캔 루트)를 의도적 스코프로 JSDoc 에 명시.
5. (선택) 3-way 클래스명 충돌 fixture(`gamma.dto.ts`) 추가로 가드 대조군 보강.
6. 기존 이월 항목(ParseUUIDPipe 부재, `throwInvalidField` 넓은 타이핑, `botIdentity.publicKey` 회귀 테스트 부재, `provider` falsy-guard 단독 미검증)은 계속 defer 확정 상태 유지 — 재지적 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 아래 표 (4명, prompt 에 개별 사유 상세는 미제공)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **전원 결과 확보 확인됨**, 강제 목록 미이행으로 인한 은폐 위험 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(사유 상세는 prompt manifest 에 포함되지 않음) — 이번 diff 가 순수 리팩터/정적 가드 추가로 성능 영향 표면 없음과 정합 |
  | dependency | 라우터 판단 — 신규 외부 의존성 추가 없음(전부 저장소 내부 `typescript`/`fs` 기존 사용)과 정합 |
  | database | 라우터 판단 — DB 스키마/쿼리 변경 없음과 정합 |
  | concurrency | 라우터 판단 — 동시성 제어 로직 변경 없음과 정합 |