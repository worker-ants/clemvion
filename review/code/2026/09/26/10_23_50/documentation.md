# 문서화(Documentation) 리뷰 — `review/code/2026/09/26/10_23_50`

## 발견사항

- **[WARNING]** `swaggerResponseStatuses()` 독스트링이 "2xx 데코레이터가 50개 가까이" 라고 잘못 진술 — 실제로는 `Api*Response` 전체가 50개 가까이이고 그중 2xx 는 7개뿐
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts:49` (신규 파일 — 게이트 숫자가 실제 파일 줄 번호와 일치)
  - 상세: 해당 줄은 "이 패키지는 `ApiPartialContentResponse`(206) · `ApiResetContentResponse`(205) 처럼 **2xx 데코레이터를 50개 가까이 내보낸다**" 라고 적는다. 그러나 `swaggerResponseStatuses()` 는 `RESPONSE_DECORATOR = /^Api\w*Response$/` 로 **상태 코드와 무관하게 모든 `Api*Response` 이름**을 순회한다(2xx 만 거르지 않는다). 실측(`@nestjs/swagger` 런타임, `Object.keys(swagger)` 필터링): `Api*Response` 전체 49개, 그중 2xx 는 `ApiOkResponse`(200)·`ApiCreatedResponse`(201)·`ApiAcceptedResponse`(202)·`ApiNonAuthoritativeInformationResponse`(203)·`ApiNoContentResponse`(204)·`ApiResetContentResponse`(205)·`ApiPartialContentResponse`(206) 단 7개다. 같은 PR 의 형제 파일 `http-status-advertised.spec.ts:59` 는 이 수치를 정확히 적는다 — "`@nestjs/swagger` 는 `Api*Response` 를 50개 가까이 내보내고 **그중 2xx 가 일곱이다**". 즉 guard.ts 쪽 문구만 "2xx" 를 잘못 붙여 두 파일이 서로 다른 숫자를 주장하는 상태다. 이 문단은 "손으로 표를 쓰지 않는 이유" 라는 설계 근거를 뒷받침하는 핵심 수치라, 잘못 읽으면 다음 사람이 "2xx 성공 코드 이름이 50가지나 된다" 고 오해할 수 있다.
  - 제안: `http-status-advertised-guard.ts:49` 의 "2xx 데코레이터를" 을 "`Api*Response` 데코레이터를"(또는 spec.ts 와 동일하게 "그중 2xx 가 일곱이다" 를 덧붙임)로 정정해 두 파일의 수치 진술을 일치시킨다.

## 그 외 확인한 항목 (문제 없음)

- **CHANGELOG**: 이번 변경(POST 14곳 200 고정, 초대 취소 광고 정정, 신규 저장소 가드)에 대해 `CHANGELOG.md` 상단 두 개의 `## Unreleased` 항목이 이미 등재되어 있고, 실제 엔드포인트 목록 · 프론트엔드 영향 범위(`=== 201` 정확 비교 0건) · 가드의 판정 범위(광고 없는 핸들러는 대조하지 않음)를 정확히 반영한다.
- **spec 규약 문서**: `spec/conventions/swagger.md` §2-4 에 "광고한 성공 코드는 실제 성공 코드를 담는다" 규칙 문단과 신규 가드 언급이 추가됐고, `## Rationale` §2-4 에 배경(2026-09-26 실측 15곳 · `@Res()` 면제 안 함 · 이름→코드 표를 손으로 안 쓰는 이유)이 기록되어 있다. `code:` frontmatter 에도 신규 가드 파일 패턴이 등재됨.
- **컨트롤러 `@ApiOperation` description**: `auth-configs` · `integrations` · `knowledge-base` · `schedules` · `workflows` · `workspaces` 컨트롤러의 `@HttpCode(HttpStatus.OK)` 추가 지점 전부, 인접 한국어 설명문이 새 상태 코드와 모순되지 않는다(예: `regenerate` 위 주석은 `@Roles('admin')` 사유를 설명할 뿐 상태 코드와 무관).
- **e2e 주석 정확성**: `graph-warning-save.e2e-spec.ts` · `schedule-trigger.e2e-spec.ts` · `workspace-path-guard.e2e-spec.ts` · `workspace-rbac.e2e-spec.ts` · `integration-cache-invalidate.e2e-spec.ts` · `integration-rotate-concurrency.e2e-spec.ts` 등에서 "POST 기본 201" 을 근거로 들던 옛 주석이 새 기대값(200)에 맞춰 함께 수정되었거나 제거됨 — 코드만 바뀌고 주석이 낡게 남은 자리는 못 찾았다(`grep` 으로 `[200, 201]` 잔존 0건, `codebase/backend/test/*.e2e-spec.ts` 전수).
- **신규 e2e `action-success-status.e2e-spec.ts` 헤더 주석**: "재인증 · scope 추가 · 지식 베이스 검색은 외부 OAuth · 임베딩에 닿아 여기서 부르지 않는다" 는 진술을 실제 커버리지와 대조 — 해당 세 라우트는 이 파일에도, 다른 e2e 에도 성공 경로 호출이 없음을 확인했고, 이는 직전 라운드 `review/code/2026/09/26/10_00_52/RESOLUTION.md` 의 보류 결정(INFO3)과 일치한다. `plan/complete/post-status-openapi.md` 참조는 현재 `plan/in-progress/post-status-openapi.md` 에 있어 아직 존재하지 않는 경로이지만, 이 저장소는 계획이 `complete/` 로 옮겨지기 전에 `plan/complete/<name>.md` 를 미리 인용하는 것이 기존 관례다(`deletion-cascade-indexes` 등 다른 e2e 파일에서도 동일 패턴 확인) — 결함 아님.
- **`http-status-advertised-guard.ts` / `.spec.ts` 의 나머지 JSDoc**: `ResponseStatusMap` · `wrapperResponseStatuses` · `HttpStatusViolation` · `HttpStatusUnresolved` · `HttpStatusScan` · `judgeHandler` · `scanHttpStatusAdvertised` 의 독스트링을 각각 구현과 대조했고, 위 한 곳을 제외하면 진술이 코드 동작과 일치한다(예: `@Res()` 비면제 근거는 spec.ts 의 실제 요청 캐너리 테스트로 고정됨, `checked` 카운트 정의는 `judged.checked` 조건과 일치).
- **대조군 fixture 헤더 주석**: `sample.controller.ts` 상단 "프로덕션 스캔 루트는 `src/modules`" · "형제 가드(`swagger-dto-contract`·`nullable-type-lie-cast`)는 이 파일도 순회" 주장을 두 형제 가드의 `SRC_ROOT`/`collectTsFiles` 사용처와 대조해 정확함을 확인했다.
- **테스트 헬퍼 리팩터**: `test/helpers/auth.ts` 의 `inviteAndAccept` → `createInvitation` + `inviteAndAccept` 분리에서, 이동한 JSDoc(초대 1건 생성 vs 초대+가입 전체 흐름)이 각 함수의 새 시그니처·반환 타입과 일치한다.
- **README/설정 문서**: 이번 변경은 새 환경 변수·설정 옵션을 추가하지 않으며, `codebase/backend/README.md` 등에 갱신이 필요한 내용도 없다.

## 요약

이번 PR(성공 응답 코드를 OpenAPI 광고와 맞추는 작업 + 신규 정적 가드)은 CHANGELOG·spec 규약 문서(Rationale 포함)·컨트롤러 데코레이터 주석·e2e 헤더 주석이 모두 빠짐없이 함께 갱신된, 문서화 관점에서 매우 꼼꼼한 변경이다. 유일하게 확인된 결함은 신규 가드 구현 파일의 독스트링 한 곳(`http-status-advertised-guard.ts:49`)이 같은 PR 의 형제 스펙 파일이 정확히 적어 둔 수치("`Api*Response` 전체 50개 중 2xx 는 7개")를 "2xx 데코레이터가 50개" 로 잘못 옮겨 적어, 같은 PR 안에서 두 파일이 서로 다른 숫자를 주장하는 상태라는 점이다. 기능·테스트에는 영향이 없는 순수 주석 오류이지만, 이 문단이 "표를 손으로 쓰지 않는" 설계 근거를 설명하는 자리라 정정이 필요하다.

## 위험도

LOW
