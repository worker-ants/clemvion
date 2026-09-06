# 정식 규약 준수 검토 — target: `spec/2-navigation/` (impl-done, diff-base `origin/main`)

## 검토 범위와 방법

- scope(`spec/2-navigation`) 델타는 0개 파일 — 이번 PR 은 이 spec 영역을 고치지 않았다. 따라서
  검토는 (a) 이미 존재하는 `2-trigger-list.md`·`3-schedule.md` 본문이 `spec/conventions/**` 를
  따르는가, (b) 이번 PR 의 코드 diff(`codebase/backend/src/modules/triggers/**` 등)가 그 spec 이
  약속한 API 계약을 `swagger.md`/`error-codes.md`/`api-convention.md` 형식대로 노출하는가 두 축으로
  진행했다.
- 컨텍스트 예산으로 번들에서 절단된 `spec/conventions/{swagger,error-codes}.md` ·
  `spec/5-system/2-api-convention.md` · `spec/conventions/chat-channel-adapter.md` 는 저장소에서
  절대경로로 직접 Read 했다(HEAD 워킹트리, 즉 이 세션의 CWD 와 동일 — `git log -1`/`pwd` 로 확인).
- 코드 사실관계(“이 엔드포인트가 실제로 409/400 을 던지는가”, “컨트롤러에 어떤 데코레이터가
  있는가”)는 전부 워킹트리 파일을 직접 Read/grep 해 확인했다(아래 인용은 전부 실측).

## 발견사항

- **[WARNING]** `PATCH /api/triggers/:id` · `POST /api/triggers` 에 신설된 409 계약이 Swagger 데코레이터에 반영되지 않음
  - target 위치: `spec/2-navigation/2-trigger-list.md` `## 3. API` — `PATCH /api/triggers/:id` 블록쿼트
    (*"`(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT` (세부 코드
    `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)"*) 및 §2.3.1 매트릭스의
    `Webhook Configuration | endpointPath` 행
  - 위반 규약: `spec/conventions/swagger.md` §2-4 "상태 코드 응답 규칙"(`409 중복/충돌 → @ApiConflictResponse`)
    및 §5-4 "새 엔드포인트 체크리스트"
  - 상세: 이번 diff 의 `triggers.service.ts` 가 정확히 이 spec 문장을 실현하려고
    `rethrowEndpointPathConflict()`(`ConflictException({ code: 'RESOURCE_CONFLICT', details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' } })`, L1591-1631)를 신설하고
    `create()`(L421-423)·`update()`(L507-509)의 `save()` 뒤에 `.catch(...)` 로 연결했다 — 즉 이
    409 는 이제 두 엔드포인트에서 **실제로 도달 가능**하다. 그런데 같은 두 메서드의 컨트롤러
    데코레이터(`codebase/backend/src/modules/triggers/triggers.controller.ts` L85-129, 이번 diff에
    포함되지 않은 미변경 파일)에는 `@ApiConflictResponse` 가 없다(`grep -n "ApiConflictResponse"
    triggers.controller.ts` → 0건, 파일 전체에 단 한 번도 등장하지 않음). `create()` 는
    `@ApiBadRequestResponse`/`@ApiUnauthorizedResponse`/`@ApiForbiddenResponse` 만, `update()` 는
    거기에 `@ApiNotFoundResponse` 만 더 갖고 있다. 같은 저장소의 `workflows.controller.ts`(L467, 493,
    542) 등 다른 컨트롤러는 동일 성격의 유니크 제약 위반에 `@ApiConflictResponse({ description: '노드
    라벨 중복' })` 류를 정확히 붙이고 있어, 이 규칙이 아직 지켜지지 않는 게 아니라 이 컨트롤러
    한 곳만 뒤처졌다는 것을 보여준다. 결과적으로 OpenAPI 스키마는 이 엔드포인트가 409 를 낼 수
    있다는 사실을 광고하지 않는데, `api-convention.md` 자신의 Overview 가 "OpenAPI 문서가 실제
    wire 와 어긋나면 그 어긋남이 소비자 코드로 전파된다"고 명시한 바로 그 위험이다(SDK
    생성기·Swagger UI 소비자가 이 409 분기를 모르게 됨).
  - 이 diff 가 새로 만든 결함은 아니다 — `triggers.controller.ts` 자체는 이번 diff 에 없다(비교:
    `git diff origin/main...HEAD --stat -- codebase/backend/src/modules/triggers/triggers.controller.ts`
    → 무출력). 다만 이번 PR 이 바로 이 409/`details` 계약을 "런타임에서 처음으로 실제로 맞게"
    만든 자리이므로(코드 주석 자신이 *"문서한 보장이 구현보다 넓었다"* 를 실측으로 인용, `review/consistency/2026/09/06/14_26_32` Critical 1), 같은 PR 이 Swagger 표면까지 맞췄다면 이
    간극이 남지 않았을 것이다.
  - 제안: `triggers.controller.ts` 의 `create()`·`update()` 에
    `@ApiConflictResponse({ description: '동일 워크스페이스 내 endpointPath 중복 (RESOURCE_CONFLICT / TRIGGER_ENDPOINT_PATH_CONFLICT)' })` 추가. 부수적으로 `update()` 의 기존
    `@ApiBadRequestResponse` 설명은 schedule 타입 필드 제한만 언급하고 `authConfigId` 불일치
    (`AUTH_CONFIG_NOT_FOUND`, 400) 케이스는 언급하지 않는데, 이미 상세 설명 스타일을 쓰고 있으므로
    함께 보강하면 §2-4 의 취지(실제 발생 가능한 상태코드를 데코레이터로 광고)에 더 부합한다.

## 점검했으나 위반이 아니라고 판단한 항목 (근거 포함)

- **URL 명명** — `POST /api/triggers/:id/notification/rotate-secret` · `.../interaction/revoke-token` ·
  `.../chat-channel/rotate-bot-token` 은 `api-convention.md` §2.2 "RPC-style sub-channel action"
  예외 행이 **정확히 같은 예시**로 등재한 패턴이다. `POST /api/schedules/:id/run-now` 도 같은 §2.2
  "자원 액션" 행의 예시(`run-now`)와 문자 그대로 일치.
- **상태 토글** — `PATCH /api/triggers/:id { isActive }` 단일 경로, `/toggle` 서브경로 미채택(R-4) —
  `api-convention.md` §12.1 "상태 토글 패턴"(`is_active` 는 전용 endpoint 금지)과 정확히 일치.
- **에러 코드 표기** — `VALIDATION_ERROR`/`RESOURCE_CONFLICT`/`RESOURCE_NOT_FOUND`/
  `TRIGGER_ENDPOINT_PATH_CONFLICT`/`AUTH_CONFIG_NOT_FOUND` 전부 `UPPER_SNAKE_CASE` — `error-codes.md`
  §1 표기·명명 규율 위반 없음. `AUTH_CONFIG_NOT_FOUND` 가 (404 가 아니라) 400 으로 발행되는 점은
  언뜻 `error-codes.md` Rationale 의 "`MODEL_CONFIG_NOT_FOUND`(404)/`MODEL_CONFIG_DEFAULT_MISSING`(400)
  분리 — 동일 코드가 두 status 를 가지면 모호하다" 사례를 연상시키지만, 실측(`triggers.service.ts`
  L844-858 `assertAuthConfigInWorkspace` → `BadRequestException`)해 보니 `AUTH_CONFIG_NOT_FOUND` 는
  **오직 400 한 곳에서만** 발행되고 404 짝이 없어 그 모호성이 성립하지 않는다. 게다가 같은
  "참조 리소스가 요청 본문 안에서 검증 실패"(cross-entity 참조 오류) 패턴으로 `USER_NOT_FOUND`
  (`totp.service.ts`, 400) · `PREVIOUS_EXECUTION_NOT_FOUND`(`workflows.controller.ts`, 400) ·
  `RERANK_CONFIG_NOT_FOUND`(400) 가 이미 저장소 전역에 있어, 이 패턴 자체가 기존 관행이다 — 위반
  아님.
- **목록 응답/페이지네이션** — `GET /api/triggers`·`GET /api/schedules` 모두 "페이지네이션 응답
  형식은 API 규약 §5.2 준수"를 직접 인용하고, 쿼리 파라미터(`page/limit/search/sort/order` +
  도메인 필터)도 §4.1/§4.2 형태와 일치.
  - `GET /api/triggers` 가 `sort`/`order` 를 받지만 `findAll` 이 무시한다는 ⚠️ 캘아웃(§3 API 표)은
    `status: implemented` 프론트매터와 충돌해 보일 수 있으나(spec-impl-evidence.md 상 "일부 미구현"
    이면 원칙적으로 `partial`+`pending_plans:` 대상), **같은 문서군의 형제 파일**
    `3-schedule.md` 의 Rationale("sort/order 쿼리 반영 — '미구현/Planned' 표기 해제")이 스케줄 API 의
    동일 종류 갭을 정확히 이 방식(인라인 ⚠️ 캘아웃 유지, 구현 완료 시 캘아웃만 제거)으로 다뤄온
    선례라 이 PR 고유의 일탈이 아니라 이 영역의 기존 관행이다 — WARNING 으로 올리지 않음(신규
    지적이 필요하면 `pending_plans:` 도입 여부는 planner 판단 사안으로 남긴다).
- **삭제 응답** — `204 No Content` — `api-convention.md` §6 일치.
- **DTO 위치·네이밍** — 응답 DTO `dto/responses/trigger-response.dto.ts`(swagger.md §5-1 규정 경로),
  요청 DTO `update-trigger.dto.ts`(dto/ 최상위, `-response` 접미 불필요) 모두 일치. 이번 diff 의
  `workspace-response.dto.ts` 신규 `joinedAt` 필드도 swagger.md §1-4/§3(JSDoc 은 소비자 문장,
  내부 서사는 `//`)·§5.4(상시 존재 nullable → `@ApiProperty({ nullable: true })` + `T | null`) 를
  그대로 준수(대상 영역은 spec/2-navigation 밖이라 참고로만 확인).
- **리뷰 인용 형식** — 이번 diff 전체(코드 주석)의 review 인용은 전부 `review/code/2026/09/06/HH_MM_SS`
  전체 경로 형태로, `spec/conventions/review-citations.md` §2 위반(bare `hh_mm_ss`) 없음. 같은 PR 이
  `dto-jsdoc-citation-guard.ts` 를 신설해 §3 "DTO JSDoc 에는 리뷰 인용 금지" 축을 처음으로
  강제하기 시작했고, 실제로 변경된 응답 DTO(`workspace-response.dto.ts`)의 JSDoc 에는 리뷰 인용이
  없다 — 자기 규약 준수.

## 요약

`spec/2-navigation/` 자체(트리거 목록·스케줄 화면 spec)는 URL 명명, 상태 토글 패턴, 에러 코드
표기, 페이지네이션 응답 형식, RPC-style 예외 등 `spec/conventions/**` 의 정식 규약을 폭넓게
정확히 인용하며 따르고 있고, 이번 PR 은 그 spec 이 이미 문서화한 409 계약(`TRIGGER_ENDPOINT_PATH_CONFLICT`)을 처음으로 런타임에서 실제로 구현했다. 다만 그 처리 계층(`triggers.service.ts`)만
바뀌고 같은 계약을 노출하는 API 문서 계층(`triggers.controller.ts` 의 `@ApiConflictResponse`)은
갱신되지 않아, 이 엔드포인트에 한해 OpenAPI 문서가 실제로 도달 가능한 409 응답을 광고하지 않는
`swagger.md` §2-4 갭이 하나 확인된다. 이는 이번 diff 가 새로 만든 결함이 아니라 기존
`triggers.controller.ts` 의 누락이 이번 변경으로 실질적 의미를 갖게 된 것이며, 빌드 게이트가
잡지 못하는 문서-전용 간극이라 런타임 계약을 깨지는 않는다. 그 외에는 CRITICAL 급 정식 규약
위반을 발견하지 못했다.

## 위험도

LOW
