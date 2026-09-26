# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** POST 액션 14곳의 **실제 wire 레벨 성공 코드**가 201(NestJS 기본값) → 200(`@HttpCode(HttpStatus.OK)`)으로 바뀐다 — 이는 문서 정합화를 넘어 외부에 노출된 HTTP 계약의 실측 변경이다.
  - 위치:
    - `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts:160` (`regenerate`)
    - `codebase/backend/src/modules/integrations/integrations.controller.ts:209,232,503,526,560,589` (`preview-test`/`oauth/begin`/`:id/test`/`:id/rotate`/`:id/reauthorize`/`:id/request-scopes`)
    - `codebase/backend/src/modules/knowledge-base/knowledge-base.controller.ts:432` (`search`)
    - `codebase/backend/src/modules/schedules/schedules.controller.ts:187` (`preview`)
    - `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:153` (`sessions/:id/messages`, SSE)
    - `codebase/backend/src/modules/workflows/workflows.controller.ts:452` (`:id/save`)
    - `codebase/backend/src/modules/workspaces/workspaces.controller.ts:244,270,566` (`:id/leave`/owner 이양/`invitations/accept`)
  - 상세: 이 PR 전에는 OpenAPI 문서가 200 을 광고하는데 실제 응답은 Nest 기본값 201 이 나가는 **문서-실측 불일치**였다(가드 spec 헤더의 실측 근거 — `POST /api/workspaces/:id/transfer-ownership` e2e 가 201 을 관측). 이번 수정은 그 불일치를 "실제 코드를 문서에 맞춘다" 는 방향으로 해소했는데, 이는 **이미 배포되어 외부에 노출되고 있던 실제 HTTP 응답 코드 자체를 바꾸는 것**이다. 문서(OpenAPI)를 신뢰해 200 을 기대하고 만든 호출자는 영향이 없지만, (Nest 관례상 POST=201 이라 가정하고 정확한 상태 코드로 분기하는) 외부 API 소비자·webhook 클라이언트·서드파티 SDK 가 있었다면 그 경로는 깨진다. `codebase/frontend` 는 `response.ok`(200–299 range)·axios 기본 `validateStatus`(2xx)로 동작해 프론트엔드 자체는 영향이 없음을 확인했고(`assistant.ts`, `apiClient` 사용처에 exact-201 단언 없음), 이 변경은 `CHANGELOG.md`(`b37c36a8e`)와 plan(`plan/complete/post-status-openapi.md`)에 이미 기록되어 의도된 결정임을 확인했다.
  - 제안: 이미 의도된 문서화된 결정이므로 차단 사유는 아니다. 다만 이 저장소 밖의 **실 API 소비자**(외부 통합 파트너·고객 스크립트)에게도 이 변경이 전달되는 릴리즈 노트/버전 고지 경로가 있는지 확인 권장(코드 리뷰 스코프 밖일 수 있음).

- **[INFO]** `workspaces.controller.ts` 의 초대 취소(`DELETE :id/invitations/:invitationId`)는 이번 diff 에서 **실제 런타임 동작 변경이 없다** — `@ApiNoContentResponse` → `@ApiOkWrappedResponse(OkResultDto)` 로 **문서만** 200/body 로 고쳤다. 핸들러는 이미 `return { data: { ok: true } };` 를 호출자 관찰 이전부터 반환하고 있었다(Nest DELETE 기본값은 200, 204 아님). 실측: `OkResultDto`/`ApiNoContentResponse` 임포트 제거 후 파일 내 잔존 참조 0건(`grep` 확인) — 컴파일 깨짐 없음.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:550` 근방 (`revokeInvitation`)
  - 상세: 순수 문서 정합 수정이라 부작용 없음. 참고용으로만 기록.

- **[INFO]** `test/helpers/auth.ts` 의 `inviteAndAccept` 리팩터 — 내부 구현이 신규 `createInvitation()` 을 호출하도록 바뀌었지만 **공개 시그니처(파라미터·반환 타입)는 동일**하다. `createInvitation` 은 새 export 이며, 이 파일 밖 다른 e2e 스펙에서 같은 이름의 정의/충돌 없음을 확인했다(`grep -rn "export .*function createInvitation" codebase/backend/test` → 정의 1곳). 영향받는 호출자(`inviteAndAccept` 기존 사용처)는 시그니처 불변이라 안전.
  - 위치: `codebase/backend/test/helpers/auth.ts:91` (`createInvitation`), `:125` (`inviteAndAccept`)

- **[INFO]** `http-status-advertised-guard.ts` 의 `swaggerResponseStatuses()` 는 `@nestjs/swagger` 가 export 하는 모든 `Api*Response` 팩토리를 로컬 `Probe` 클래스에 **실제로 적용**해 `Reflect.getMetadata` 로 상태 코드를 읽어낸다. `import 'reflect-metadata'` 로 전역 `Reflect` 객체에 polyfill 을 얹지만, 이는 NestJS 프로젝트에서 통상적인 패턴이고 `Probe` 클래스는 루프마다 재정의되는 지역 변수라 그 메타데이터가 저장소의 다른 코드로 새지 않는다. 프로덕션 앱 부트스트랩이나 다른 모듈에 영향을 주는 전역 상태 변경은 아니다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts:53-82`

- **[INFO]** `http-status-advertised.spec.ts` 의 "근거 캐너리" 는 `ResStatusCanaryController`(`@Controller('canary')`)를 별도 `Test.createTestingModule` + `app.init()`/`app.close()` 로 격리 기동한다. 임의 고정 포트 바인딩이 아니라 `app.getHttpServer()`(supertest 가 임시 소켓 사용)이므로 다른 병렬 테스트/실행 중인 앱과 포트 충돌 없음. `sample.controller.ts` 픽스처(`HttpStatusAdvertisedFixtureController`)는 실제로 어떤 Nest 모듈에도 등록되지 않고(`grep` 결과 정의만 존재) 가드가 **텍스트/AST 로만** 파싱하므로 실제 라우트(`/fixture/*`)가 뜨는 일은 없다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised.spec.ts:237-281`, `codebase/backend/src/repo-guards/__tests__/fixtures/http-status-advertised/sample.controller.ts:41-42`

- **[INFO]** 파일시스템 부작용 없음 — `http-status-advertised-guard.ts`/`.spec.ts` 는 `fs.readFileSync` 로 소스만 읽고, 어떤 파일도 쓰거나 지우지 않는다(가드는 순수 스캔 함수).

- 교차 검증(회귀 누락 확인): 14곳의 상태 코드 변경 대상 라우트를 호출하는 다른 e2e 스펙(diff 목록에 없는 파일)에 남아있는 `.toBe(201)`/`[200,201]` 같은 stale 단언이 있는지 `grep` 으로 전수 확인했다 — `regenerate`/`preview-test`/`oauth/begin`/`/rotate`/`:id/test`/`request-scopes`/`reauthorize` 를 호출하는 파일 중 diff 밖에 남은 것은 전부 오탐(주석 텍스트 매치, 에러 경로(403/404) 단언)이었고 실제 성공 코드 단언이 남은 곳은 없었다.

## 요약

핵심 부작용은 **14개 POST 라우트의 실제 HTTP 성공 코드가 201→200 으로 바뀐다**는 점이다 — 이는 이미 공개된 OpenAPI 문서(200)에 실제 런타임을 맞추는 의도된 수정이며, `CHANGELOG.md`/plan 문서에 근거·실측(15곳, 뮤턴트 KILLED)이 기록되어 있고 frontend·백엔드 e2e 전수 재확인으로 회귀 누락이 없음을 확인했다. 다만 "문서를 신뢰하지 않고 Nest 관례(POST=201)를 가정한" 외부 API 소비자가 있다면 이 배포는 그들에게 관측 가능한 계약 변경이 된다는 점은 side-effect 관점에서 기록해 둘 가치가 있다. 그 외 항목 — 초대 취소 문서 정합화, 테스트 헬퍼 리팩터, 신규 정적 가드의 `reflect-metadata`/`Api*Response` 팩토리 적용, 격리된 캐너리 Nest 앱 — 은 전부 스코프가 닫혀 있고 저장소 상태·파일시스템·전역 변수에 실질적 부작용을 남기지 않는다. 리뷰 중 저장소 파일에 대한 뮤테이션은 수행하지 않았다(모든 검증은 `grep`/`Read` 기반 read-only).

## 위험도

LOW
