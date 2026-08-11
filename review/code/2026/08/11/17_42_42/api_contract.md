# API 계약(API Contract) 리뷰 — 후속 커밋 `165960a92`(잔여 13건 부착) 검증

직전 라운드(`17_21_33`)에서 내가 낸 WARNING("술어가 좁아 잔여 3건 이상 남았다")에 대한 처분(13건 부착,
커밋 `165960a92`)을 지시받은 5개 항목대로 **직접 코드를 열고 독립 스캐너로 재검증**했다.

## 검증 방법

- 정규식이 아니라 **TypeScript 컴파일러 API(AST)** 로 신규 스캐너를 작성해 `codebase/backend/src/modules/**/*.controller.ts` 전체(35개 파일)를 파싱했다. 데코레이터는 메서드 데코레이터 목록에서, `@WorkspaceId()` 소비 여부는 **파라미터 데코레이터**(정규식이 아니라 `node.parameters` 순회)에서 직접 판별해, 이전 두 라운드가 썼던 줄 단위 정규식 스캐너(±1 오차가 이미 관측됨)보다 구조적으로 정밀하다.
- `RolesGuard`(`codebase/backend/src/common/guards/roles.guard.ts`), `ApiExcludeEndpoint` 의 `@nestjs/swagger` 구현(`node_modules/@nestjs/swagger/dist/swagger-explorer.js`, `.../decorators/api-exclude-endpoint.decorator.js`)을 직접 읽었다.
- `git diff origin/main -- codebase/`, `git diff 91edf4f6e 165960a92` 로 실제 추가/삭제 라인을 전수 대조했다.

## 발견사항

- **[INFO]** 확인 1 — §5-4 술어(`@Roles(...)` 가 붙었거나 `@WorkspaceId()` 를 소비) 기준 잔여는 **실제로 0건**이다. 직접 재현했다.
  - 위치: `codebase/backend/src/modules/**/*.controller.ts` 전체(스캐너 대상)
  - 상세: AST 스캐너 결과 — 전체 라우트 **222**(plan 수치와 일치), `@Roles()` 보유 **79**, `@WorkspaceId()` 소비 **142**, `@ApiForbiddenResponse` 보유 **163**, `(@Roles() 또는 @WorkspaceId()) && !@ApiForbiddenResponse` = **0**. 이전에 내가 직접 지목한 3건도 `Read` 로 재확인했다: `workflows.controller.ts:134`(`graphWarnings`, `'viewer 이상 권한 필요'`), `agent-memory.controller.ts:71,100`(`listScopes`/`listMemories`, `'viewer 이상 권한 필요'`), `knowledge-base.controller.ts:366`(`uploadDocument`, `'editor 이상 권한 필요'`) — 전부 부착 확인. security(6)·convention(12) 가 짚은 나머지 항목도 이번 전수 재스캔 잔여 0건에 포함(개별 파일이 아니라 전체 predicate 기준으로 재검증했으므로 셋 중 어느 리뷰어가 놓친 항목이 있었어도 이번 스캔에 잡힌다).
  - 제안: 없음 — "잔여 0건" 클레임이 이번엔 **규약 그대로의 술어**로 성립한다.

- **[INFO]** 확인 2 — 신규 13건의 설명 문자열이 §5-4 대로다. `owner`/`viewer` 도 정당한 파생이다.
  - 위치: `agent-memory.controller.ts:71,100`(viewer) · `executions.controller.ts:221,242`(owner) · `knowledge-base.controller.ts:366`(editor) · `workflows.controller.ts:134`(viewer) · `workflow-assistant.controller.ts:107,120,135,157`(editor) · `workflow-test-datasets.controller.ts:60,78,135`(editor)
  - 상세: 13건 전부 실제 `@Roles(...)` 인자값과 설명 문자열의 역할명이 **정확히 일치**함을 각 파일에서 직접 대조했다(예: `workflow-assistant.controller.ts` 의 `create`/`update`/`remove`/`sendMessage` 는 `@Roles('editor')` + `'editor 이상 권한 필요'`). 저장소 전체 `ApiForbiddenResponse` 문자열 분포를 재집계하면 `'editor 이상 권한 필요'` **54건**, `'viewer 이상 권한 필요'` **4건**, `'owner 이상 권한 필요'` **2건**(둘 다 이번 신규) — `git diff 91edf4f6e 165960a92` 로 대조한 결과 `'owner 이상 권한 필요'` 는 이 커밋 이전 저장소 어디에도 없던 **최초 사용**이었다. 다만 이는 "임의로 지어낸 문구"가 아니라 §5-4 가 명시한 **"`@Roles()` 있으면 요구 역할을 명시"** 규칙을 `editor`(기존 46→54건)·`viewer`(기존 1→4건)와 **동일한 템플릿**(`'<role> 이상 권한 필요'`)으로 `owner` 에 처음 적용한 것뿐이다. `admin` 계층에는 이번 diff 가 손대지 않았고, 기존 `admin` 표기는 `'관리자 권한 필요'`/`'Admin 미만 권한'` 등 **비-템플릿 레거시 문구**가 이미 혼재하지만(예: `workspaces` 계열 — 이번 diff 밖) 이는 이 PR 이전부터의 상태이며 이번 스코프 밖이다.
  - 제안: 없음 — 조치 불요.

- **[INFO]** 확인 3 — `executions.controller.ts` 테스트 훅 2종은 **프로덕션에 무조건 등록**되며, 부착이 사실관계로는 정확하다. 다만 **`@ApiExcludeEndpoint()` 때문에 생성 OpenAPI 문서에는 아무 효과가 없다** — 코드로 확인했다.
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:217-228`(`triggerStuckRecoveryForTest`), `:238-256`(`simulateExecutionRunRedeliveryForTest`)
  - 상세(등록 여부): `ExecutionsModule`(`executions.module.ts`)은 `controllers: [ExecutionsController, ...]` 로 **환경변수 조건 없이** 컨트롤러를 등록한다 — Nest 는 부트스트랩 시 두 라우트를 항상 라우팅 테이블에 올린다. 핸들러 **본문**만 `process.env.NODE_ENV !== 'test' || process.env.E2E_TEST_HOOKS !== '1'` 이면 `NotFoundException` 을 던진다. 그런데 `@Roles('owner')` 를 검사하는 `RolesGuard` 는 전역 `APP_GUARD`(`app.module.ts`)로 **핸들러 본문보다 먼저** 실행된다(`roles.guard.ts:97-147` 직접 확인: `needsRoleCheck` 가 true 인 경로는 멤버십 조회 → 역할 계층 비교를 거쳐 owner 미만이면 `return false`→403). 즉 **프로덕션에서도** owner 가 아닌 인증 사용자가 이 라우트를 치면 핸들러 본문에 도달하기 전 403 을 실제로 받는다 — 오직 owner 만 본문까지 도달해 (프로덕션에서는) 404 를 받는다. 이 경로의 "안 나는 에러를 문서화" 우려는 근거가 없다: `@ApiForbiddenResponse('owner 이상 권한 필요')` 는 실제 도달 가능한 403 을 정확히 서술한다.
  - 상세(계약 효과 부재): 다만 두 라우트 모두 `@ApiExcludeEndpoint()` 가 붙어 있다. `@nestjs/swagger` 구현(`node_modules/@nestjs/swagger/dist/swagger-explorer.js:95-98`)을 직접 읽으면, `scanFromPrototype` 콜백이 `excludeEndpoint.disable` 이 참이면 **다른 어떤 `@Api*Response` 데코레이터도 평가하지 않고 즉시 `return`** 한다 — 이 라우트는 생성된 OpenAPI 문서(`swagger.json`/Swagger UI/이로부터 생성되는 클라이언트 SDK)에 **아예 등장하지 않는다**. 따라서 이번에 붙인 `@ApiForbiddenResponse` 는 (a) 소스를 읽는 개발자에게는 정확한 자기-문서화이자 §5-4 를 예외 없이 일관 적용했다는 근거지만, (b) **실제 API 계약(클라이언트가 보는 산출물)에는 어떤 영향도 주지 않는다** — 붙이든 안 붙이든 스펙 출력은 동일하다.
  - 제안: 조치 불요(현행 부착이 틀리지 않았고, §5-4 를 "예외 없이 전수 적용"한 원칙과도 부합). 다만 향후 §5-4 를 리라이트할 기회가 있으면 "`@ApiExcludeEndpoint()` 라우트는 소스 문서화 목적으로만 부착하며 생성 계약에는 반영되지 않는다"는 각주를 남기는 것을 고려할 수 있다 — 이번 PR 범위는 아니다.

- **[INFO]** 확인 4 — `llm-model-config.controller.ts:118` 주석이 이제 코드와 일치한다.
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts:118-122`(주석), `:142`(데코레이터)
  - 상세: 정정된 주석("다만 `@ApiForbiddenResponse` 는 둔다 — `RolesGuard` 가 `@Roles()` 유무와 무관하게 워크스페이스 멤버십을 항상 검증해 403 을 낼 수 있기 때문")이 실제 `:142` 의 `@ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님' })` 와 정확히 대응한다. 종전 주석(이번 diff 가 삭제한 두 줄)이 남아 있었다면 코드-주석 모순이 계속됐을 것 — `git diff origin/main` 상 이 파일의 **유일한 삭제 라인**이 바로 그 옛 주석이다.
  - 제안: 없음.

- **[INFO]** 확인 5 — 하위 호환성. 영향 없음.
  - 위치: `git diff origin/main -- codebase/` 전체
  - 상세: 삭제 라인은 위 `llm-model-config.controller.ts` 옛 주석 2줄뿐이며, 나머지는 전부 데코레이터/`import` 추가다. 라우트 경로·HTTP 메서드·요청/응답 스키마·상태 코드 의미 변경 없음. `@ApiForbiddenResponse` 부착은 이미 실제로 발생 가능했던 403 variant 를 뒤늦게 OpenAPI 문서에 반영하는 **순수 additive** 변경이다(테스트 훅 2건은 위에서 확인했듯 `@ApiExcludeEndpoint()` 로 인해 생성 문서에도 반영되지 않으므로 계약 표면 자체는 그마저도 불변). breaking change 없음.
  - 제안: 없음.

## 요약

지시받은 5개 항목을 전부 코드로 직접 재검증했다. (1) §5-4 술어 기준 잔여는 정규식이 아닌 TypeScript AST 파서로 재현해 실제로 0건이며, 직전 라운드에서 내가 지목한 3건(`graphWarnings`/`agent-memory` 2곳/`uploadDocument`)이 전부 포함됐다. (2) 신규 13건의 설명 문자열은 각 라우트의 실제 `@Roles()` 값과 정확히 일치하며, `owner 이상 권한 필요`는 이 저장소 최초 사용이지만 `editor`/`viewer` 와 동일한 템플릿을 규약 그대로 적용한 것이라 문제없다. (3) `executions.controller.ts` 테스트 훅 2종은 프로덕션에도 무조건 등록되고 `RolesGuard` 가 핸들러 본문보다 먼저 실행되므로 403 서술은 사실관계로 정확하지만, `@ApiExcludeEndpoint()` 때문에 생성 OpenAPI 문서에는 어떤 영향도 주지 않는다는 점을 소스(`@nestjs/swagger` 구현)로 확인해 새로 기록해 둔다 — 결함은 아니고 조치 불요. (4) `llm-model-config.controller.ts:118` 주석은 코드와 정확히 일치하도록 정정됐다. (5) 전체 변경은 애디티브 문서화뿐이며 breaking change 는 없다. 억지로 만든 발견은 없으며, 전부 정보성이다.

## 위험도

NONE

STATUS: OK
