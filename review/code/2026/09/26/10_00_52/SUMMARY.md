# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — Critical 없음. 가장 두드러진 리스크는 상태변경(state-changing) 라우트 4곳(`auth-configs regenerate`, `workspaces leave`/`invitations accept`/`invitations 취소`)의 성공 경로가 실제 HTTP 라운드트립 테스트 없이 신규 정적 가드에만 의존한다는 점(testing WARNING)과, 14개 POST 액션의 실제 wire-level 응답 코드가 `201→200`으로 바뀌어 기존 프로덕션 API 계약이 변경된다는 점(side_effect WARNING, 이미 CHANGELOG 경고로 완화됨)이다. **forced(router_safety) 6명 전원 결과 확보 완료** — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 커버리지 | `auth-configs.regenerate`, `workspaces.leave`/`revokeInvitation`/`acceptInvitation` 4개 상태변경 라우트는 이번 PR로 실제 성공 코드가 바뀌었는데, 성공 경로를 실제 HTTP 요청으로 검증하는 e2e/통합 테스트가 전혀 없다. 신규 정적 가드는 "선언된 `@HttpCode` = 광고 값"만 보증할 뿐 "그 선언대로 실제 응답이 끝까지 나가는가"는 별도 사실이라 안전망이 한 겹뿐이다. | `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts:157-158`(regenerate), `codebase/backend/src/modules/workspaces/workspaces.controller.ts:243-244`(leave), `:537-550`(revokeInvitation), `:565-566`(acceptInvitation) | 각 라우트 성공 케이스 1개씩 e2e 추가(`regenerate`→200+새 키, `accept`→200+합류 확인, `cancel`→200+목록 소멸, `leave`→200). 즉시 불가하면 트래커 백로그로 명시 등재 |
| 2 | 부작용 / API 계약 | 14개 POST 액션 엔드포인트의 실제 wire-level 성공 코드가 `201 Created`→`200 OK`로 바뀐다. OpenAPI 문서는 이미 200을 광고 중이었으므로 "문서대로 구현한" 클라이언트는 무영향이지만, 실측 `201`에 의존한 외부/내부 자동화가 있다면 breaking change다. | `auth-configs.controller.ts:158`, `integrations.controller.ts`(6곳: 209/232/502/525/559/588), `knowledge-base.controller.ts:432`, `schedules.controller.ts:187`, `workflow-assistant.controller.ts:153`, `workflows.controller.ts:452`, `workspaces.controller.ts:244,270,567` | 이미 CHANGELOG 경고 문구 + 사전 조사(frontend/channel-web-chat/packages `=== 201` 비교 0건) 존재. 배포 전 이 관리 API를 직접 호출하는 미확인 외부/내부 소비자 존재 여부만 한 번 더 확인 |
| 3 | 유지보수성 | `auth-configs.controller.ts`의 `regenerate()`에 새로 추가된 `@HttpCode(HttpStatus.OK)`가 `@Roles('admin')`/주석보다 **앞**에 삽입돼, 같은 파일의 다른 8곳 및 이 PR이 고친 다른 6개 컨트롤러의 데코레이터 순서(`@Roles` 뒤, `@ApiOperation` 앞)와 유일하게 어긋난다. | `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts:157-161` | `@HttpCode(HttpStatus.OK)`를 주석·`@Roles('admin')` 뒤, `@ApiOperation` 앞으로 이동해 파일 내/PR 전체와 순서 통일 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 리뷰 프로세스 | 리뷰 도중 `auth-configs.controller.ts`의 `regenerate()`에서 `@HttpCode(HttpStatus.OK)`가 디스크상 일시적으로 사라진 상태가 관측됨(동시 실행 중이던 다른 세션의 미커밋 뮤테이션 검증으로 추정). 요약 작성 시점에 `git status --short`/`grep`로 재확인한 결과 현재는 diff 그대로(`@HttpCode(HttpStatus.OK)` 포함, 158행) 정상 상태 — 코드 결함 아님. | `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts:158` | `--impl-done` 직전 `git status --short` 로 최종 재확인(이미 정상 확인됨) |
| 2 | API 계약 / 문서 | `DELETE .../invitations/:invitationId`(초대 취소)는 런타임 변경 없이 광고만 `@ApiNoContentResponse`(204)→`@ApiOkWrappedResponse(OkResultDto)`(200)로 문서 정정. 실제 204 전환 여부는 별도 트래커 결정으로 이 PR 범위 밖이며, 그 라우트의 성공 경로 e2e 부재도 기존 갭(이번 PR이 만든 것 아님) | `codebase/backend/src/modules/workspaces/workspaces.controller.ts:550` | 없음(범위 밖). 향후 "삭제 응답 204 통일" 착수 시 e2e 함께 추가 |
| 3 | 테스트 커버리지 | `integrations`의 `:id/reauthorize`·`oauth/request-scopes`, `knowledge-base`의 `POST /search`도 성공 경로(200)를 검증하는 e2e/unit이 없음(기존 e2e는 403/404 실패 경로만 단언). WARNING #1과 같은 성격이나 우선순위 낮음 | `integrations.controller.ts`(524·588행), `knowledge-base.controller.ts:432` | 별도 커버리지 확장 백로그. OAuth 모킹 인프라 없으면 트래커 기록만 |
| 4 | 테스트 정합 | `workflow-crud.e2e-spec.ts`의 `POST /api/workflows/import` 2곳(451·484행)은 여전히 `expect([200, 201]).toContain(...)` 이완 단언 — 확인 결과 `importWorkflow`는 원래도 `@HttpCode(HttpStatus.CREATED)`+201 광고로 정합했던 자리라 회귀 위험은 없음, 이번 PR 취지(선언을 센다)에 비춰 사소한 미조임 | `codebase/backend/test/workflow-crud.e2e-spec.ts:451,484` | blocking 아님. 같은 취지로 `toBe(201)`로 조여도 무방 |
| 5 | 코드 품질 | 신규 가드의 `judgeHandler` 함수가 "핸들러에서 정보 추출"과 "위반 여부 판정" 두 책임을 한 함수(약 65줄)에서 수행해 파일 내 순환 복잡도가 가장 높음. 반환 타입도 파일의 다른 타입들과 달리 익명 인라인 타입 | `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts`(judgeHandler) | 필수 아님. 두 책임 분리 + 반환 타입에 이름(`HandlerJudgement`) 부여 시 가독성 개선 |
| 6 | 테스트 설계 | 신규 정적 가드(`http-status-advertised-guard.ts`/`.spec.ts`/fixture)는 이름표 대신 `@nestjs/swagger` 팩토리를 실제 호출해 메타데이터를 읽고, `@Res()` 핸들러 비면제 판단을 실제 Nest 앱 기동 "근거 캐너리"로 고정했으며 vacuity floor(`checked>150` 등)까지 갖춤. 뮤테이션 킬 실측(회귀를 정확히 RED로 검출 후 즉시 원복)도 확인됨 — 이 PR에서 가장 견고한 자산 | `codebase/backend/src/repo-guards/__tests__/http-status-advertised{-guard.ts,.spec.ts}` | 없음(모범 사례로 기록) |
| 7 | 보안 | e2e 테스트 파일들의 더미 자격 증명 문자열(`e2e-makeshop-secret` 등)은 이번 diff가 상태 코드 단언 줄만 바꾼 기존 컨텍스트이며 신규 도입 아님(로컬 docker-compose e2e 전용 값) | `codebase/backend/test/*.e2e-spec.ts`(다수) | 조치 불요(범위 밖) |
| 8 | 범위(Scope) | 리뷰 대상 29개 파일 전부가 plan(`plan/in-progress/post-status-openapi.md`)의 7개 명시 요구사항과 1:1 대응 확인(`@HttpCode` 14곳 정확히 일치, import 변경은 실사용에 정확 대응, 무관한 리팩토링/포맷팅/설정 변경 없음). `git diff HEAD~5 HEAD --stat`로 파일 목록도 프롬프트와 정확히 일치 확인 | 저장소 전체 | 없음(정상) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인가(`@Roles`)·SSRF 차단·암호화 저장 로직 등 보안 관련 코드는 전부 대조 확인 결과 변경 없음. 신규 위협 없음 |
| requirement | NONE | 실측 불일치 15곳 전부 반영, 가드 11/11 PASS 직접 확인, spec(`swagger.md` §2-4)이 코드보다 먼저 갱신된 정석적 SDD 흐름 |
| scope | NONE | 29개 파일 전부 plan 요구사항과 1:1 대응, scope creep/무관 변경 없음 |
| side_effect | LOW | 14개 POST 엔드포인트의 wire-level 응답 코드 변경(이미 조사·CHANGELOG 경고 완료), `revokeInvitation`은 순수 문서 정정으로 side effect 없음 확인 |
| maintainability | LOW | `auth-configs.regenerate()` 1곳의 데코레이터 순서 불일치 외에는 기계적·국소적 수정, 신규 가드도 기존 `repo-guards` 관례 준수 |
| testing | MEDIUM | 신규 가드는 실행+뮤테이션 킬로 견고성 실측 확인. 단, 상태변경 4라우트의 성공 경로 e2e 부재가 이 PR의 가장 눈에 띄는 커버리지 갭 |
| api_contract | LOW | 광고↔실제 불일치 15곳을 양방향(코드/문서)으로 정확히 닫음. 잔여 리스크는 미확인 외부 소비자 존재 여부뿐, 대상 전부 JWT+워크스페이스 인증 필요 관리 API라 실질 위험 낮음 |

## 발견 없는 에이전트

없음 — 실행된 7개 reviewer 전원이 최소 INFO 이상을 기록했다(대부분 "정상 확인" 성격의 INFO 포함).

## 권장 조치사항

1. **[최우선]** `auth-configs.regenerate`, `workspaces.leave`/`invitations accept`/`invitations 취소` 4개 상태변경 라우트에 성공 경로 e2e를 최소 1개씩 추가한다 — 정적 가드는 "선언=광고"만 보증하고 "선언대로 응답이 나가는가"는 보증하지 않는다 (testing WARNING #1).
2. `auth-configs.controller.ts`의 `regenerate()`에서 `@HttpCode(HttpStatus.OK)` 위치를 `@Roles('admin')`/주석 뒤, `@ApiOperation` 앞으로 옮겨 이 PR이 다른 8곳에서 지킨 데코레이터 순서와 통일한다 (maintainability WARNING #3).
3. 배포 전, 이번에 wire-level 응답 코드가 바뀌는 14개 관리 API 엔드포인트를 실측 `201`에 의존해 호출하는 외부/내부 자동화가 남아 있는지 한 번 더 확인한다 — 이미 CHANGELOG 경고와 내부 조사가 있으므로 필수 차단 사유는 아니다 (side_effect WARNING #2).
4. `integrations reauthorize`/`request-scopes`, `knowledge-base search`의 성공 경로 테스트 커버리지 확장은 별도 백로그로 등재한다 (INFO #3, 낮은 우선순위).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `api_contract` (7명)
  - **강제 포함(router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (6명) — **전원 결과 확보됨** (화이트리스트 미이행 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(응답 코드 데코레이터 추가 + 테스트 단언 변경)와 낮은 관련성 |
  | architecture | 상동 |
  | documentation | 상동 (단, requirement/api_contract reviewer가 spec 정합성은 커버함) |
  | dependency | 신규 의존성 추가 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | user_guide_sync | 사용자 가이드 문서 영향 없음 |
