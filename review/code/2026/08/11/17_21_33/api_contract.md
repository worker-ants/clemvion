# API 계약(API Contract) 리뷰 — 51개 라우트 `@ApiForbiddenResponse` 부착

## 발견사항

- **[INFO]** 판정 술어(1번 확인 항목) — **검증 결과 옳다.** `RolesGuard`(`codebase/backend/src/common/guards/roles.guard.ts:97-147`)를 직접 읽었다.
  - 상세: `canActivate` 는 `needsRoleCheck = !!requiredRoles && requiredRoles.length > 0`(`@Roles()` 유무)로 나뉘지만, **멤버십 조회(`getMemberRole`) 자체는 `@Roles()` 유무와 무관**하게 도달한다 — 유일한 단축 통과(`roles.guard.ts:114-119`)는 `!needsRoleCheck && !handlerConsumesWorkspaceId(...)` 일 때만이며, `handlerConsumesWorkspaceId`(`codebase/backend/src/common/decorators/workspace.decorator.ts:61-80`)는 `ROUTE_ARGS_METADATA` 에 등록된 파라미터 팩토리를 `extractWorkspaceId` 와 **identity 비교**해 "`@WorkspaceId()` 를 실제로 쓰는가"만 판별하는 reflection 이다. 즉 `@WorkspaceId()` 를 쓰고 `@Roles()` 가 없는 라우트는 이 단축을 타지 않고 `getMemberRole` 까지 내려가, 비멤버면 `return false`(Nest 기본 `ForbiddenException`→403)로 차단된다(`roles.guard.ts:138-139`).
  - 가드 등록 순서도 확인: `app.module.ts:209-213` 에서 `JwtAuthGuard` → `UserThrottlerGuard` → `RolesGuard` 순으로 `APP_GUARD` 등록되어 `RolesGuard` 실행 시점엔 `request.user` 가 이미 채워져 있다. `@Public()` 라우트는 `JwtAuthGuard`(`jwt-auth.guard.ts:12-21`)가 passport 전략을 아예 호출하지 않고 통과시키므로 `request.user` 가 비고, `RolesGuard` 의 `if (!userId) return !needsRoleCheck;` 로 멤버십 검사에 도달하지 않는다 — `@Public()` 라우트는 이 51건 술어에서 올바르게 제외됐다(스캔 결과 실제로 `@Public()` 컨트롤러(`third-party-oauth.controller.ts`)는 diff 대상 16파일에 없음을 grep 으로 확인).
  - 결론: 51건은 **거짓 문서화가 아니다** — 실제로 403 을 낼 수 있는 경로를 정확히 문서화했다.

- **[WARNING]** 술어("`@Roles()` 부재")가 놓친 동종 갭 3건 — 이번 diff 범위 밖이지만 **같은 근본 원인**(RolesGuard 는 `@Roles()` 유무 무관하게 멤버십/역할 403 을 낸다)으로 `@ApiForbiddenResponse` 가 통째로 빠져 있다.
  - 위치 1: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `graphWarnings` 핸들러(`@Get(':id/graph-warnings')` 120번째 줄, `@Roles('viewer')` 121번째 줄). `@ApiUnauthorizedResponse`(133)·`@ApiNotFoundResponse`(134)는 있지만 `@ApiForbiddenResponse` 자체가 없다. **같은 파일**에서 이번 diff 가 `findAll`/`findOne`/`exportWorkflow` 3곳에 정확히 이 데코레이터를 추가했는데, 바로 아래 `graphWarnings` 는 `@Roles('viewer')` 가 있다는 이유만으로 스캔에서 제외돼 그대로 방치됐다.
  - 위치 2: `codebase/backend/src/modules/agent-memory/agent-memory.controller.ts` — `listScopes`(`@Get('scopes')` 60번째 줄, `@Roles('viewer')` 61번째 줄)와 `listMemories`(`@Get()` 87번째 줄, `@Roles('viewer')` 88번째 줄) 둘 다 `@ApiUnauthorizedResponse` 만 있고 `@ApiForbiddenResponse` 가 전혀 없다. 클래스 docstring(41-53줄)이 "조회(GET)는 `@Roles('viewer')` — RolesGuard 가 멤버십을 검증"이라고 명시할 정도로 멤버십 403 을 의도한 설계인데도 미문서.
  - 위치 3: `codebase/backend/src/modules/knowledge-base/knowledge-base.controller.ts` — `uploadDocument`(`@Post(':id/documents')` 331번째 줄, `@Roles('editor')` 333번째 줄). 같은 파일의 다른 모든 `@Roles('editor')` 라우트(create/update/remove/reEmbedAll/retryFailed/removeDocument/reEmbed 등)는 `@ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })` 를 갖는데 이 라우트만 없다.
  - 제안: 이번 티켓은 "`@Roles()` 부재" 로 스코프를 좁혔으므로 위 3건을 이 diff 에서 처리할 필요는 없지만, `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` 의 "## 후속(이 티켓 범위 밖, 등재만)" 목록(현재 `workflow-assistant.controller.ts` 401 누락 1건만 등재됨)에 이 3건도 함께 등재할 것을 권한다 — 그렇지 않으면 "재스캔 잔여 0건" 이라는 검증 문구가 "`@Roles()` 없는 대상" 으로만 참이고 "403 을 실제로 낼 수 있는데 미문서" 전체 집합 기준으로는 참이 아니라는 점이 후속 세션에서 다시 놓칠 수 있다.

- **[INFO]** 이번 diff 로 생긴 자기모순 주석 — `codebase/backend/src/modules/llm/llm-model-config.controller.ts:118-120`.
  - 상세: `@Get(':id/models')`(121번째 줄) 바로 위 주석이 "조회(Viewer+) — `@Roles` 미적용이 의도적이다... **역할 제한이 없어 `@ApiForbiddenResponse` 도 두지 않는다** — 워크스페이스 멤버십 미충족 403 은 컨트롤러 공통 인증 계층 책임이다" 라고 명시한다. 그런데 바로 이 diff 가 그 동일 핸들러의 데코레이터 블록(140번째 줄)에 `@ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님' })` 를 **추가**했다 — 주석이 말하는 정책과 실제 코드가 정면으로 어긋난다.
  - 이는 §5-4 확장(2026-08-08, `swagger.md` §Rationale)으로 "@Roles() 없이도 `@WorkspaceId()` 만으로 403 문서화 대상"이라는 규칙이 새로 생겼는데, 이 파일의 옛 주석이 구 정책("역할 제한 없으면 안 붙인다")을 그대로 남긴 채 코드만 새 정책을 따른 결과로 보인다.
  - 제안: 주석을 새 정책에 맞게 정정하거나(예: "멤버십 403 은 §5-4 확장에 따라 문서화한다"), 최소한 "@ApiForbiddenResponse 도 두지 않는다" 문장을 삭제해 코드-주석 불일치를 없앨 것. 런타임/계약에는 영향 없지만 향후 유지보수자가 이 주석만 보고 "여기는 의도적으로 뺐다"고 오판할 위험이 있다.

- **[INFO]** 설명 문자열 일관성 — 문제 없음. `git diff` 로 확인한 결과 51건 전부가 정확히 `'워크스페이스 멤버가 아님'` 한 문구로 통일되어 있고(`grep -c` 51건 일치), `spec/conventions/swagger.md` §5-4("`@Roles()` 없이 `@WorkspaceId()` 만 쓰면 '워크스페이스 멤버가 아님'으로 통일")와 정확히 일치한다. `@Roles()` 있는 형제 라우트들의 기존 문구("editor 이상 권한 필요" 등)와도 섞이지 않았다.

- **[INFO]** 하위 호환성 — 영향 없음. 51건 모두 `@ApiForbiddenResponse` 추가뿐이며 런타임 핸들러·응답 바디·상태 코드·라우트 경로는 그대로다(코드 diff 로 직접 확인: 데코레이터 라인만 `+`). OpenAPI 스키마에 이미 실제로 발생 가능했던 403 응답 variant 가 뒤늦게 문서화되는 것으로, 기존 클라이언트·SDK 생성기 입장에서는 이미 존재하던 동작이 문서에 추가로 반영되는 additive 변경이다. breaking change 없음.

## 요약
51건의 `@ApiForbiddenResponse` 부착은 `RolesGuard` 소스 코드(멤버십 검사가 `@Roles()` 유무와 무관하게 항상 수행됨, `handlerConsumesWorkspaceId` reflection, `@Public()` 라우트의 정당한 제외)로 직접 검증한 결과 **정확한 문서화**이며, 설명 문자열도 `swagger.md §5-4` 규약과 완전히 일치하고 런타임 동작 변경도 없다. 다만 이번 스캔 술어(`@Roles()` 부재)가 구조적으로 배제한 "`@Roles()` 는 있지만 `@ApiForbiddenResponse` 가 아예 없는" 동종 갭이 diff 밖에 최소 3곳(`workflows.controller.ts` graphWarnings, `agent-memory.controller.ts` 2곳, `knowledge-base.controller.ts` uploadDocument) 남아 있고, 그중 `workflows.controller.ts` 는 이번 diff 가 이미 손댄 바로 그 파일이라 후속 등재가 누락되면 재발견 비용이 커진다. 또한 `llm-model-config.controller.ts` 에는 이번 diff 의 추가와 정면으로 모순되는 stale 주석이 남았다. 두 항목 모두 API 계약 자체(wire format)에는 영향이 없는 문서/일관성 수준 이슈다.

## 위험도
LOW

STATUS: OK
