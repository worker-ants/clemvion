# Code Review 통합 보고서

## 전체 위험도
**LOW** — POST 액션 14곳의 실제 wire 상태 코드가 201→200으로 바뀌는 진짜 breaking change 1건(이미 CHANGELOG 경고·전수 grep·e2e/정적 가드로 완화됨)과, 신규 가드 파일의 독스트링 수치 오기 1건이 WARNING 급이며, 그 외는 전부 INFO. forced whitelist(maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 정상 확보되어 강제 화이트리스트 미이행 사례는 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API계약/부작용 | POST 액션 14곳의 실제 wire-level 성공 코드가 `201 Created` → `200 OK`로 변경됨(문서 정합화가 아니라 이미 배포되어 노출 중인 실제 HTTP 응답 자체의 변경). Nest 관례(POST=201)를 가정해 상태 코드로 분기하는 외부 API 소비자·서드파티 SDK가 있다면 그 경로가 깨짐 | `auth-configs.controller.ts:160`(regenerate), `integrations.controller.ts:209,232,503,526,560,589`(preview-test/oauth-begin/:id/test/:id/rotate/:id/reauthorize/:id/request-scopes), `knowledge-base.controller.ts:432`(search), `schedules.controller.ts:187`(preview), `workflow-assistant.controller.ts:153`(sendMessage, SSE), `workflows.controller.ts:452`(:id/save), `workspaces.controller.ts:244,270,566`(leave/transfer-ownership/acceptInvitation) | 이미 완화 조치 완료(frontend/channel-web-chat `=== 201` 비교 0건 확인, CHANGELOG에 외부 API 호출자용 명시적 경고 문구, 15/15 뮤턴트 KILLED, e2e 전수 조정, 신규 정적 가드로 회귀 봉쇄) — 추가 차단 사유 아님. 실제 저장소 밖 프로그래매틱 소비자가 존재한다면 릴리스 노트/버전 공지 채널로 별도 안내 고려. 향후 유사 breaking 변경 시 plan 문서에도 `error-codes.md` 선례처럼 "잔여 위험 인수" 문구 명시 권장 |
| 2 | 문서화 | `swaggerResponseStatuses()` 독스트링이 "2xx 데코레이터가 50개 가까이"라고 잘못 진술 — 실제로는 `Api*Response` 전체가 ~50개이고 그중 2xx는 7개뿐(`ApiOkResponse`·`ApiCreatedResponse`·`ApiAcceptedResponse`·`ApiNonAuthoritativeInformationResponse`·`ApiNoContentResponse`·`ApiResetContentResponse`·`ApiPartialContentResponse`). 같은 PR의 형제 파일 `http-status-advertised.spec.ts:59`는 이 수치를 정확히 적어 두 파일이 서로 다른 숫자를 주장하는 상태 | `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts:49` | "2xx 데코레이터를"을 "`Api*Response` 데코레이터를"(또는 spec.ts와 동일하게 "그중 2xx가 일곱이다"를 추가)로 정정해 두 파일의 수치 진술을 일치 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항/테스트 | 신설 e2e 파일 헤더 주석이 아직 존재하지 않는 `plan/complete/post-status-openapi.md`를 인용(실제로는 `plan/in-progress/post-status-openapi.md`에 있음, 체크리스트의 `/ai-review`·`--impl-done`·트래커 닫기 미완료) | `codebase/backend/test/action-success-status.e2e-spec.ts:13` | 최종 커밋에서 plan을 `complete/`로 옮길 때 자연히 해소됨. 별도 코드 수정 불요 |
| 2 | 요구사항 | `revokeInvitation`(DELETE 초대 취소) 런타임을 204로 바꿀지는 이번 PR 범위 밖으로 의도적으로 유예, 트래커에 등재됨 | `codebase/backend/src/modules/workspaces/workspaces.controller.ts`(`revokeInvitation`) | 조치 불요, 별도 트래커 항목에서 결정 |
| 3 | 변경범위 | `workflow-crud.e2e-spec.ts`의 `import` 라우트 단언 2곳이 이번 PR의 15개 대상 라우트 목록 밖인데도 `toBe(201)`로 조여짐. 다만 직전 `/ai-review` 1라운드 조치 커밋(`f5b10f57b`)에서 이미 의도적으로 처리·기록된 항목으로, 이번 라운드의 새로운 스코프 이탈이 아님 | `codebase/backend/test/workflow-crud.e2e-spec.ts:451,484` | 추가 조치 불요 |
| 4 | 테스트 | `:id/reauthorize`·`:id/request-scopes`(integrations)·`search`(knowledge-base)의 성공(200) 경로가 e2e로 직접 검증되지 않음(외부 OAuth·임베딩 의존). 신설 정적 가드(뮤테이션 15/15 KILLED)와 `@Res()` 근거 캐너리로 상당 부분 상쇄되며 PR이 이 트레이드오프를 명시적으로 문서화함 | `integrations.controller.ts`(:id/reauthorize 559, :id/request-scopes 588), `knowledge-base.controller.ts:432` | OAuth 프로바이더 목(mock) 또는 서비스 계층 스텁으로 컨트롤러 통합 테스트를 추가하는 후속 항목 고려(즉시 차단 사유 아님) |
| 5 | 유지보수성 | `@HttpCode` 데코레이터 삽입 위치가 파일마다/같은 파일 안에서도 일관되지 않음(`@Post` 직후 vs `@Roles` 이후) | `integrations.controller.ts:209,525`, `schedules.controller.ts:187`, `workflows.controller.ts:452` | `spec/conventions/`에 "라우트 데코레이터 바로 다음에 `@HttpCode`" 같은 한 줄 규칙 신설 고려 |
| 6 | 유지보수성 | `ts.createSourceFile(...)` 호출이 동일 인자 조합으로 두 함수에 중복 | `http-status-advertised-guard.ts:96-101, 290-295` | `parseSourceFile()` 사설 헬퍼로 추출 |
| 7 | 유지보수성 | `judgeHandler` 함수가 "분류→결정→판정" 3단계를 한 함수(약 65줄)에서 처리해 두 책임이 분리되지 않음 | `http-status-advertised-guard.ts:201-266` | 데코레이터 순회로 중간 구조체를 만드는 부분과 violation 계산 부분을 별도 함수로 분리 고려(필수는 아님) |
| 8 | 유지보수성 | `swaggerResponseStatuses()`가 `@nestjs/swagger`의 비공개 메타데이터 키 문자열 `'swagger/apiResponse'`에 의존 — 라이브러리 업그레이드로 키가 바뀌면 조용히 빈 표가 될 위험. 다만 주석에 설계 이유가 남아 있고 형제 spec의 vacuity guard(`size > 40`)로 위험이 이미 완화됨 | `http-status-advertised-guard.ts:37,72` | 현재 수준의 문서화+테스트로 충분, 추가 조치 불요 |
| 9 | 보안 | e2e 테스트 헬퍼의 하드코딩된 고정 비밀번호(`TEST_PASSWORD`) — 로컬/CI e2e 인프라 전용, 프로덕션 코드 경로에는 없음 | `codebase/backend/test/helpers/auth.ts` | 조치 불요 |
| 10 | 보안/API계약 | 초대 취소 성공 응답이 `204 No Content` → `200 + {data:{ok:true}}`로 변경(순수 문서 정합화, 런타임 동작 불변, 새 필드 노출 없음, `@Roles('admin')` 인가 유지) | `workspaces.controller.ts:550` | 조치 불요 |
| 11 | API계약 | 신설 정적 가드(`http-status-advertised`)가 `@nestjs/swagger` 팩토리를 실제 적용해 메타데이터로 상태 코드 표를 읽어 하드코딩 표 없이 신규 2xx 데코레이터 추가에도 판정이 새지 않음. `@Res()` 핸들러도 면제하지 않음을 근거 캐너리로 고정 | `http-status-advertised-guard.ts`, `.spec.ts`, `fixtures/http-status-advertised/sample.controller.ts` | 조치 불요(가장 실효성 있는 안전장치로 평가) |
| 12 | API계약 | `saveCanvas`(200, 액션)와 `duplicate`/`import`(201, 신규 리소스 생성)가 같은 파일에서 서로 다른 상태 코드를 유지 — RESTful 관례상 의도된 구분 | `workflow-crud.e2e-spec.ts` | 조치 불요 |
| 13 | 유저가이드 동기화 | `doc-sync-matrix.json` 20개 row 중 `backend-api-change` 1개만 매칭, 두 target(swagger jsdoc·user-guide 영향) 모두 같은 changeset 안에서 충족되거나 영향 없음(관련 MDX 문서는 행위 수준 서술이며 raw status code 미인용). frontend/channel-web-chat 변경 0건이라 i18n parity 트리거 자체가 없음 | `.claude/config/doc-sync-matrix.json` 대조 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인증/인가 로직 변경 없음, INFO 4건(테스트 고정 비밀번호 등)만 존재 |
| requirement | NONE | 15개 요구사항 1:1 대응 확인, INFO 2건(plan 경로 참조, revokeInvitation 런타임 유예) |
| scope | NONE | 31개 파일 전부 plan과 1:1 대응, INFO 1건(무관 라우트 단언 조임, 이미 이전 라운드 처리) |
| side_effect | LOW | WARNING 1건(14개 라우트 실제 201→200 breaking change, 완화 조치 확인됨), INFO 다수 |
| maintainability | LOW | INFO 4건(데코레이터 위치 비일관, 코드 중복, 함수 책임 분리, 비공개 메타데이터 키 의존) |
| testing | LOW | INFO 2건(3개 라우트 e2e 미커버, plan 경로 참조), 강점 다수(뮤테이션 15/15 KILLED, 근거 캐너리) |
| documentation | LOW | WARNING 1건(독스트링 수치 오기), 그 외 문서 동반 갱신 전부 정확 |
| api_contract | LOW | INFO 4건(14개 라우트 breaking change 재확인, revokeInvitation 문서 정합화, 신규 가드 실효성, saveCanvas/import 구분) |
| user_guide_sync | NONE | trigger 1개 매칭, 갭 없음(사용자 가이드 갱신 대상 아님) |

## 발견 없는 에이전트

없음 — 9개 reviewer 모두 최소 INFO 이상의 관찰 사항을 보고함(단, security/requirement/scope/user_guide_sync는 실질적 결함 없이 NONE 위험도로 수렴).

## 권장 조치사항

1. `http-status-advertised-guard.ts:49`의 독스트링 문구를 형제 spec 파일과 일치하도록 정정("2xx 데코레이터 50개" → "`Api*Response` 데코레이터 ~50개, 그중 2xx는 7개") — WARNING #2, 사소하지만 설계 근거를 설명하는 핵심 문단이므로 정정 권장.
2. 14개 POST 라우트의 201→200 변경은 이미 CHANGELOG 경고·전수 grep·정적 가드로 충분히 완화됨 — 추가 코드 조치는 불요하나, 실제 외부(비-SPA) API 소비자가 존재한다면 릴리스 노트/공지 채널 안내를 별도 검토(WARNING #1).
3. INFO 항목(유지보수성 스타일 개선, 3개 라우트 e2e 커버리지 후속, `@HttpCode` 위치 컨벤션화 등)은 병합을 막을 사유가 아니며 선택적 후속 개선으로 남겨도 무방.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (9명)
  - **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(누락 없음)
  - **제외**: 5명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(HTTP 상태 코드 정합화 + 정적 가드)과 무관 |
  | architecture | router 판단상 아키텍처 구조 변경 없음 |
  | dependency | router 판단상 의존성 변경 없음 |
  | database | router 판단상 DB 스키마/쿼리 변경 없음 |
  | concurrency | router 판단상 동시성 로직 변경 없음 |
