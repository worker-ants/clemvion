# 요구사항(Requirement) Review — auth-guard-reflection-hardening

## 검증 방법

diff 11개 코드 파일(app.module.ts·workspace-reflection-canary.{ts,spec.ts}·workspace.decorator.spec.ts·roles.guard.spec.ts·uuid.{ts,spec.ts}·workspace-context.util.{ts,spec.ts}·main.ts·CHANGELOG.md)과 plan/review 산출물 11개를 전수 확인했다. 프롬프트에 본문이 생략된 파일은 전부 `Read`로 직접 열었고, 핵심 주장은 **실행으로 검증**했다:
- `npx jest`로 변경 5개 spec 파일 전수 실행 → **70/70 PASS**
- `npx tsc --noEmit`으로 변경 파일 타입 오류 없음 확인 (무관 사전 존재 spec 파일 오류만 있고 본 PR 파일은 0건)
- `npx eslint`로 변경 소스 파일 lint 확인 → 0 error, 1 warning(스타일 nit)
- `@nestjs/core` 실제 타입 정의(`DiscoveryService`/`MetadataScanner`/`DiscoveryModule`)를 열어 캐너리의 API 사용이 실제 시그니처와 일치하는지 대조
- `spec/5-system/2-api-convention.md §5.3`·`3-error-handling.md §1.3`을 열어 `VALIDATION_ERROR` 재사용 결정이 spec과 line-level로 일치하는지 확인
- `codebase/backend/src/common/filters/http-exception.filter.ts`를 열어 `BadRequestException({code:'VALIDATION_ERROR'})` → 실제 400 응답 매핑 경로 확인
- `git log`/`git merge-base --is-ancestor`로 CHANGELOG 참조 링크의 실제 유효성 검증

### 발견사항

- **[WARNING]** CHANGELOG.md 의 plan 추적 링크가 이미 깨진 경로를 그대로 유지
  - 위치: `CHANGELOG.md:47`
  - 상세: "추적: `plan/in-progress/auth-workspace-membership-guard.md`, `plan/in-progress/auth-guard-reflection-hardening.md`." 중 첫 번째 경로는 실재하지 않는다 — 해당 plan은 이미 `plan/complete/auth-workspace-membership-guard.md`로 이동했다(#1105, `b2b22f35d`, 본 브랜치의 조상 커밋). `git merge-base --is-ancestor b2b22f35d HEAD`로 확인. `#1105`는 인입 링크 8곳(spec·형제 plan 6곳 등)을 정정했지만 CHANGELOG.md는 그 목록에 없었다. 이번 PR은 바로 그 줄을 편집해(두 번째 경로를 추가) 새 diff에 포함시켰음에도 이미 깨져 있던 첫 경로는 고치지 않고 그대로 전파했다. `spec-link-integrity` 가드는 `spec/**.md`만 스캔하므로(리포지토리 루트의 `CHANGELOG.md`는 스코프 밖) CI로도 잡히지 않는다.
  - 제안: `plan/in-progress/auth-workspace-membership-guard.md` → `plan/complete/auth-workspace-membership-guard.md`로 정정.

- **[WARNING]** plan frontmatter `worktree` 필드가 placeholder로 남아 있음
  - 위치: `plan/in-progress/auth-guard-reflection-hardening.md:3`
  - 상세: `worktree: (unstarted)`. CLAUDE.md는 "진행 중 작업 | `plan/in-progress/<name>.md` (frontmatter 에 `worktree` 명시)"를 규약으로 못박고, 실제로 자매 plan(`plan/complete/auth-workspace-membership-guard.md:3`)은 `worktree: auth-workspace-membership-guard-2b94db`처럼 실제 슬러그를 채운다. 그런데 이 plan은 본문 체크리스트(TDD·TEST WORKFLOW·lint/unit/build/e2e PASS 등)가 전부 완료 상태(`[x]`)로 기록돼 있고 실제로 `auth-guard-reflection-hardening-9c31f2` 워크트리에서 구현이 끝난 채로 리뷰 중인데도 frontmatter는 여전히 "미착수"를 가리킨다.
  - 제안: `worktree: auth-guard-reflection-hardening-9c31f2`로 갱신.

- **[INFO]** `assertWorkspaceIdReflectionWorks`의 `@returns` 주석이 실제 프로덕션 호출부 동작과 어긋남
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:89` (JSDoc `@returns 인식된 소비 라우트 수 (호출부가 로그·관측에 쓴다)`) vs `codebase/backend/src/main.ts:168` (`assertWorkspaceIdReflectionWorks(app);` — 반환값 미소비)
  - 상세: 실제 로깅은 함수 내부의 `logger.log(...)`가 수행하며(반환값과 무관하게 항상 실행됨), `main.ts`의 실제 호출부는 반환값을 변수에 받지 않고 버린다. 반환값을 소비하는 곳은 테스트 파일뿐이다. 기능 결함은 아니지만("호출부가 …쓴다"는 서술은 오독 소지가 있음) 문서-구현 괴리다.
  - 제안: 주석을 "테스트·향후 관측 확장을 위해 반환한다(현재 부트 호출부는 미소비, 로깅은 함수 내부에서 자체 수행)"처럼 정정.

- **[INFO]** `RolesGuard.canActivate` 경로에서 malformed `X-Workspace-Id` → 400 을 직접 검증하는 테스트 부재
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts` (전체 — 해당 시나리오 자체가 없음)
  - 상세: `resolveRequestWorkspaceContext`(단위)와 `WorkspaceId` 데코레이터(단위) 양쪽에서 malformed 헤더 → `BadRequestException(VALIDATION_ERROR)`는 테스트로 고정돼 있으나, 가드가 그 예외를 삼키지 않고 그대로 전파하는지를 `roles.guard.spec.ts` 레벨에서 직접 단언하는 테스트는 없다. `RolesGuard.canActivate`에 try/catch가 없어 실제 위험은 낮지만(코드 확인 완료), 세 소비처 중 하나만 커버리지가 비어 있다.
  - 제안: 여유가 되면 `roles.guard.spec.ts`에 "malformed 헤더 → `canActivate`가 throw"를 1건 추가해 회귀 방지선을 소비처 3곳 모두에 맞춘다.

- **[INFO]** eslint 경고 1건(기능 영향 없음)
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:80`
  - 상세: `handlerConsumesWorkspaceId(cls as object, handler)` — 이미 `typeof cls !== 'function'`로 좁혀진 뒤라 `as object` 캐스팅이 불필요(`@typescript-eslint/no-unnecessary-type-assertion`). `npx eslint` 실행 결과 0 error/1 warning으로 CI는 통과하나 정리 대상.

### 검증되어 CRITICAL 없음으로 확인한 핵심 지점 (참고)

- `assertWorkspaceIdReflectionWorks`/`countWorkspaceIdConsumingRoutes`는 실제 `@nestjs/core` `DiscoveryService.getControllers()`(`InstanceWrapper.metatype: Function | Type<any> | null`)·`MetadataScanner.getAllMethodNames(prototype): string[]` 시그니처와 정확히 일치. `DiscoveryModule`이 두 프로바이더를 모두 export하므로 `app.module.ts`의 `imports: [DiscoveryModule, ...]` 추가로 `app.get()`이 정상 동작(비-strict 모드는 전역 컨테이너 검색).
- `main.ts`에서 `assertWorkspaceIdReflectionWorks(app)`는 `NestFactory.create()` 직후·`app.listen()` 이전에 동기 호출되며, count===0이면 throw → `void bootstrap()`이 삼키지 않으므로 부팅 실패(fail-closed) — plan/CHANGELOG의 주장과 코드가 일치. `docker-compose.e2e.yml`의 `backend-e2e`가 실제 빌드된 서버를 기동하고(`/api/health` healthcheck), e2e 테스트(backend-e2e-runner)가 그 컨테이너를 대상으로 실행되므로 캐너리가 e2e 경로에서 실제로 실행됨을 확인.
- `isUuidShaped`(canonical 8-4-4-4-12 hex, 버전/variant 무시)와 `isValidUuid`(RFC v1–v5+variant)의 경계(nil UUID·v7·비-RFC variant)가 테스트로 정확히 고정돼 있고, `resolveRequestWorkspaceContext`가 `isUuidShaped`만 사용해 헤더 검증 → `BadRequestException({code:'VALIDATION_ERROR'})`을 던짐. `GlobalExceptionFilter`가 `resp.code`를 그대로 채택하는 경로(코드 42-77행 확인)로 실제 400 `VALIDATION_ERROR` 응답이 나감을 소스 레벨로 확인. `spec/5-system/2-api-convention.md §5.3`이 400의 기본 코드로 `VALIDATION_ERROR`를 명시하므로 spec과 line-level 일치, `spec_impact: none` 판단이 정합함.
- 토큰 클레임은 검증하지 않는다는 주석(`resolveRequestWorkspaceContext`)과 실제 구현(`headerWorkspaceId` 유무로만 분기) 일치. `system-status.e2e-spec.ts:147`가 실제로 nil UUID(`00000000-...`)를 헤더로 쓰고 있어 "Postgres가 파싱 가능한 값은 통과시켜야 한다"는 근거 주장이 사실과 일치.
- `WorkspaceIdReflectionBrokenError` 메시지가 테스트가 요구하는 `handlerConsumesWorkspaceId`·`cross-tenant` 문자열을 모두 포함.

### 요약

핵심 보안 로직(부트타임 fail-closed 캐너리, UUID 형식 검증에 따른 400 응답, 두 소비처 공용 헬퍼) 은 소스 코드 직접 대조·실제 테스트 실행(70/70 PASS)·타입체크·lint·spec 본문 대조를 통해 **의도한 대로 정확히 구현**돼 있음을 확인했다. `@nestjs/core` 실제 API 시그니처, exception filter 매핑 경로, e2e 부팅 경로까지 추적해 문서상 주장과 실제 동작이 어긋나는 지점을 찾지 못했다. 발견된 문제는 전부 CRITICAL 이하 — CHANGELOG의 이미 깨진 plan 링크를 이번 PR이 같은 줄을 편집하면서도 고치지 않고 전파한 점, plan frontmatter의 `worktree` placeholder 미갱신, 그리고 사소한 문서/테스트 커버리지 갭 2건. 코드 정확성 자체에는 결함이 없다.

### 위험도
LOW
