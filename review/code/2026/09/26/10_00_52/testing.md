# 테스트(Testing) 리뷰 — post-status-openapi

## 검증 방법 메모

- 신규 가드 `src/repo-guards/__tests__/http-status-advertised.spec.ts` 를
  `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 로 실제 실행 — 11개 전부 GREEN.
- **뮤테이션 검증**: `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` 의
  `regenerate()` 에서 `@HttpCode(HttpStatus.OK)` 한 줄을 스크래치 백업 후 제거 → 가드 재실행 →
  `광고한 성공 코드가 실제 성공 코드를 담는다` 테스트가 정확히
  `modules/auth-configs/auth-configs.controller.ts regenerate() POST — 실제 201 · 광고 200` 를 잡아 **RED**.
  즉시 `cp` 로 원복(`git checkout`/`restore` 미사용), `git status --short` 로 클린 확인 완료.
  가드가 실제로 이 PR 급의 회귀를 가른다는 것을 실측했다.
- `auth-configs.controller.spec.ts` 도 재실행(GREEN, 12/12) — 컨트롤러 메서드를 직접 호출하는
  unit 이라 `@HttpCode` 변경과 무관함을 확인.
- 작업 종료 시 `git status --short` 는 리뷰 산출물 디렉터리만 untracked 로 남아 있고, 코드 트리는 깨끗함.

## 발견사항

- **[INFO]** 신규 가드(`http-status-advertised-guard.ts`/`.spec.ts`/`fixtures/.../sample.controller.ts`)는 이 PR 에서 가장 가치 있는 테스트 자산이다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised.spec.ts` (전체), `http-status-advertised-guard.ts` (전체)
  - 상세: 이름→코드 표를 손으로 적지 않고 `@nestjs/swagger` 팩토리를 실제로 적용해 메타데이터를 읽고(`swaggerResponseStatuses`), 저장소 래퍼는 AST로 내부 호출을 추적한다(`wrapperResponseStatuses`) — "새 데코레이터 이름이 표에서 빠지면 조용히 통과"하는 실패 모드를 봉쇄했다. `@Res()` 핸들러를 면제하지 않기로 한 판단은 문장이 아니라 실제 Nest 앱을 띄우는 "근거 캐너리"(`describe('근거 캐너리 — @Res() 핸들러의 상태'...)`)로 고정했고, `@HttpCode` 유무 두 경우를 모두 실제 HTTP 요청으로 검증한다. vacuity floor(`checked > 150`, `files > 30`, `wrappers.statuses.size >= 6`)도 갖춰져 있어 표가 텅 비어 "판정 없이 통과"하는 상태를 막는다. 대조군 fixture(`sample.controller.ts`)는 기본값·204 광고·`@ApiResponse`·래퍼·206·`@Res()`·주석/문자열 디코이·`unresolved` 4형태까지 촘촘히 커버한다.
  - 제안: 없음 — 그대로 유지. 다만 향후 저장소 래퍼가 `export function` 이 아니라 `export const foo = (...) => ...` 형태로 추가되면 `wrapperResponseStatuses` 의 `ts.isFunctionDeclaration` 검사가 그 래퍼를 건너뛴다. 다만 이 경우도 `unresolved` 테스트가 즉시 실패하도록 설계돼 있어(조용히 통과하지 않음) 안전망은 있다 — 새 래퍼 스타일을 도입할 때 이 사실만 기억해 두면 된다.

- **[WARNING]** `auth-configs` `regenerate`, `workspaces` `leave`/`invitations/accept`/초대 취소(`revokeInvitation`) 4개 라우트는 이번 PR 로 실제 성공 코드가 바뀌었는데(200으로), 이 경로들의 **성공 경로를 실제 HTTP 라운드트립으로 검증하는 e2e/통합 테스트가 전혀 없다**.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` (`regenerate`, 게이트 157-158행) / `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (`leave` 243-244행, `revokeInvitation` 537-550행, `acceptInvitation` 565-566행)
  - 상세: `grep` 으로 확인한 결과 — `auth-configs.controller.spec.ts` 는 `controller.regenerate(...)` 를 **직접 호출**하는 unit(`service.regenerate` 가 호출됐는지만 확인)이라 HTTP 계층을 거치지 않고, `@HttpCode` 는 관측되지 않는다. `test/*.e2e-spec.ts` 전체를 뒤져도 `/auth-configs/:id/regenerate` 를 부르는 e2e 는 없다. `workspaces` 쪽도 `workspace-rbac.e2e-spec.ts` 의 `/leave` 테스트는 **403 실패 경로만** 확인하고(게이트 344-346행), `invitations/accept`·`:id/invitations/:invitationId` DELETE 를 실제 supertest 요청으로 부르는 e2e 는 전무하다(`grep -rln invitation codebase/backend/test/*.e2e-spec.ts` 결과 4개 파일 중 어느 것도 accept/cancel 성공 경로를 안 부른다). 이 4곳은 오직 신규 정적 가드(`http-status-advertised.spec.ts`)에만 의존한다 — 가드는 "선언된 `@HttpCode` 값 = 광고 값"을 보증하지만, "그 선언이 실제로 그 상태 코드로 응답을 마친다"는 것은 (전역 인터셉터·예외 필터·비즈니스 로직 분기 등으로) 별도로 검증돼야 하는 사실이고, 특히 `regenerate`(토큰 무효화) · `revokeInvitation`/`acceptInvitation`(멤버십 변경) 은 부작용이 있는 상태 변경 액션이라 성공 경로가 실제로 끝까지 도달하는지 확인할 가치가 크다.
  - 제안: 최소한 성공 케이스 하나씩(`POST :id/regenerate` → 200 + 새 키 반환, `POST invitations/accept` → 200 + 합류 확인, `DELETE :id/invitations/:invitationId` → 200 + 목록에서 사라짐, `POST :id/leave` → 200, 비소유자 기준)을 e2e 에 추가해 "선언"과 "실제 응답"의 마지막 연결고리를 닫는 것을 고려. 트래커에 백로그로 남기는 것도 방법.

- **[INFO]** `integrations` 의 `:id/reauthorize`, `oauth/request-scopes` 두 라우트도 성공 경로(200) 자체를 검증하는 e2e/unit 이 없다 — 기존 e2e(`integration-personal-owner.e2e-spec.ts`)는 이 두 라우트에 대해 403/404 **실패 경로만** 단언한다(게이트 175-227행 부근).
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` (프롬프트에 컨텍스트 미포함 — diff 게이트 524·588행)
  - 상세: 실제 OAuth 프로바이더로 나가는 리다이렉트 흐름이라 성공 경로 e2e 화가 원래도 어렵다는 점은 이해하지만, 위 WARNING 항목과 같은 종류의 잔여 위험이다(정적 가드만이 유일한 보호막). `preview-test`, `oauth/begin`, `:id/test`, `:id/rotate` 는 이미 e2e 로 성공 경로가 200 으로 확인돼 있어(파일 19·20·21) 대비된다.
  - 제안: 우선순위는 낮음(WARNING 항목 대비) — OAuth 프로바이더를 모킹할 수 있는 인프라가 이미 있다면(`integration-oauth.service.ts` 등) 추가를 고려, 없으면 트래커에만 기록.

- **[INFO]** `knowledge-base` `POST /search` 라우트도 실제 HTTP 성공 응답(200)을 확인하는 테스트가 전무하다(unit 은 서비스 레벨만, e2e 는 전무 — `grep -rln "knowledge-base.*search"` 결과 0건).
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.controller.ts` (diff 게이트 432행, 프롬프트 컨텍스트 미포함)
  - 상세: "디버그" 용 RAG 검색 엔드포인트라 우선순위가 낮을 수 있지만, viewer 롤 가드까지 포함된 실 라우트이므로 성공 경로가 전혀 검증되지 않는 상태는 위 WARNING 항목과 동일한 성격의 갭이다.
  - 제안: 트래커에만 기록 — 이 PR 의 스코프(상태 코드 정합)를 넘는 별도 커버리지 확장으로 분리하는 것이 합리적.

- **[INFO]** 기존 e2e 의 회귀 갱신(`[200, 201]` → `toBe(200)`, `toBe(201)` → `toBe(200)`)은 실제로 실행해 확인 가능한 형태로 잘 됐다 — 다만 `workflow-crud.e2e-spec.ts` 게이트 451·484행 부근의 `expect([200, 201]).toContain(importRes.status)` 2곳은 이번 PR 이 건드리지 않고 남겨뒀다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` (F·G 케이스, `POST /api/workflows/import`)
  - 상세: 확인해 보니 `workflows.controller.ts` 의 `importWorkflow` 는 이미 `@HttpCode(HttpStatus.CREATED)` + `@ApiCreatedWrappedResponse`(201 광고)로 광고·실제가 일치한다 — 즉 이 PR 이 고치는 클래스의 결함(광고 200/실제 201)이 아니라 **원래도 정합했던 자리**를 느슨하게 단언해 온 것뿐이라, 방치해도 회귀 위험은 없다. 다만 이번 PR 이 나머지 25곳을 전부 `toBe(단일값)` 으로 조인 김에 여기 2곳만 남은 것은 "선언을 센다"는 이 PR 의 취지에 비춰 사소한 불일치로 보인다.
  - 제안: 같은 커밋 취지로 `toBe(201)` 로 조여도 되지만, 이 PR 의 핵심 결함(광고↔실제 불일치)과 무관하므로 blocking 아님.

- **[INFO]** 새 가드 테스트의 격리·가독성은 양호 — `describe` 최상위에서 `files`/`swaggerStatuses`/`wrappers`/`statuses` 를 1회 계산해 각 `it` 이 공유하지만, 전부 순수 함수 결과이고 어느 테스트도 그 값을 변형하지 않아 순서 의존성이 없다. "근거 캐너리" 서브 `describe` 는 자체 `beforeAll`/`afterAll` 로 Nest 앱을 격리해서 뜨고 닫는다. 실측 수치(40+, 6+, 150+, 30+)를 주석으로 근거(2026-09-26 카운트)와 함께 남겨 vacuity 가드의 "왜 이 숫자인가"가 추적 가능하다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised.spec.ts`
  - 상세/제안: 발견사항 아님 — 좋은 패턴으로 기록.

## 요약

이 PR 의 핵심 테스트 자산은 신규 정적 가드(`http-status-advertised-guard.ts` + `.spec.ts` + 대조군 fixture)로, 실제 실행(11/11 GREEN)과 뮤테이션 킬(회귀를 정확히 잡아 RED, 즉시 원복)로 그 유효성을 실측 확인했다 — 이름표 대신 런타임 팩토리를 실제로 적용하고 `@Res()` 예외를 근거 캐너리로 고정한 설계는 견고하다. 기존 e2e 25곳의 `[200,201]`/`toBe(201)` 단언을 `toBe(200)` 으로 조인 회귀 갱신도 정확하다. 다만 이번에 실제 상태 코드가 바뀐 라우트 중 `auth-configs regenerate`, `workspaces leave/invitations accept/cancel`(부작용 있는 상태 변경 액션) 4곳은 성공 경로를 실제 HTTP 요청으로 검증하는 테스트가 전혀 없어, 정적 가드 하나에만 안전망을 의존하고 있다 — 가드는 "선언 = 광고"를 보증할 뿐 "그 선언대로 끝까지 응답이 나가는가"는 별도 사실이므로, 이 지점이 이 PR 의 테스트 커버리지에서 가장 눈에 띄는 갭이다. `integrations reauthorize/request-scopes`, `knowledge-base search` 도 같은 성격의 더 낮은 우선순위 갭이다.

## 위험도

MEDIUM
