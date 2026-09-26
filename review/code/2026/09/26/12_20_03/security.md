# 보안(Security) 코드 리뷰

## 범위 요약

이번 변경은 크게 세 갈래다.

1. `codebase/backend/src/common/constants/workspace-roles.ts` — `RolesGuard.assertMember` 안에 인라인돼 있던 "요구 역할 중 가장 낮은 역할" 계산식을 `lowestRequiredRole()` 함수로 추출.
2. `codebase/backend/src/common/guards/roles.guard.ts` — 위 함수를 호출하도록 치환. 계산식 자체(`reduce`)는 문자 그대로 동일 — 로직 변경 없음.
3. `codebase/backend/src/common/swagger/forbidden-descriptions.ts` (신규) + 27개 컨트롤러 — `@ApiForbiddenResponse({ description: '...' })` 에 손으로 적던 문자열을 `FORBIDDEN_NOT_A_MEMBER` / `forbiddenForRole(role)` 헬퍼로 교체해, 가드가 실제로 던지는 거부 코드(`NOT_A_MEMBER` · `EDITOR_REQUIRED` · `ADMIN_REQUIRED` · `OWNER_REQUIRED`)를 Swagger 설명에 항상 싣게 함.
4. `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes{-guard.ts,.spec.ts}` (신규) — 라우트의 403 설명이 가드가 낼 수 있는 코드를 다 담는지 reflection 으로 검사하는 저장소 가드. 대조군에 실제 `RolesGuard` 를 돌려 모델과 대조하는 캐너리 포함.

`workspace-roles.ts`·`roles.guard.ts` 를 `Read` 로 전문 확인했다(프롬프트에 잘려 있었음). `lowestRequiredRole` 의 구현은 리팩터 전 `roles.guard.ts` 인라인 코드와 바이트 단위로 동일하고, 호출부(`assertMember`)는 여전히 `requiredRoles.length === 0` 을 먼저 걸러 빈 배열로 호출되지 않는다 — 인가 로직 자체의 변경은 없다.

## 발견사항

- **[INFO]** `lowestRequiredRole` 은 서열 밖 문자열이 섞이면 그 문자열(서열 0)이 문턱이 되어 요구가 사실상 사라진다(멤버면 누구나 통과)
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts:38-44` (`lowestRequiredRole` 본문), 대응 테스트 `codebase/backend/src/common/constants/workspace-roles.spec.ts:35-36`
  - 상세: `lowestRequiredRole(['admin', 'superadmin'])` 이 `'superadmin'`(서열 0)을 반환하고, 호출부(`assertMember`)는 `roleLevel(role) >= roleLevel(threshold)` 를 검사하므로 threshold 가 0 이면 모든 멤버가 통과한다. 이 자체는 **이번 diff 로 새로 생긴 동작이 아니다** — 종전 `roles.guard.ts` 인라인 코드에서 그대로 옮겨졌을 뿐이고, 실제 도달 경로는 `@Roles(...)` 데코레이터가 `WorkspaceRoleName[]`(컴파일 타임 유니온)만 받으므로 컴파일에서 오탈자가 막힌다. 다만 이 테스트가 생성한 신규 저장소 가드(`forbidden-response-codes-guard.ts`)의 `guardRejectionCodes` 도 같은 함수를 재사용하고, reflection 으로 얻은 `roles: string[]` 는 타입 소거된 문자열이라 컴파일 가드가 없다 — 다만 그쪽은 방어 코드(`Object.hasOwn(ROLE_REQUIRED, threshold)`)로 서열 밖 값을 걸러 코드 요구를 늘리지 않는 방향으로만 처리해 안전하다.
  - 제안: 조치 불요 — 기존 동작을 정확히 문서화·테스트로 고정한 것으로 판단된다. 향후 `@Roles()` 데코레이터의 타입 제약(`WorkspaceRoleName[]`)이 느슨해지는 변경이 있으면 이 지점을 재검토할 것.

- **[INFO]** Swagger 403 설명에 가드 거부 코드가 노출되도록 바뀜(`FORBIDDEN_NOT_A_MEMBER` / `forbiddenForRole`)
  - 위치: `codebase/backend/src/common/swagger/forbidden-descriptions.ts:19,36-39` 및 각 컨트롤러의 `@ApiForbiddenResponse` 데코레이터 전체
  - 상세: OpenAPI 문서에 `NOT_A_MEMBER` · `EDITOR_REQUIRED` · `ADMIN_REQUIRED` · `OWNER_REQUIRED` 같은 내부 거부 코드명이 그대로 실린다. 다만 이 코드들은 `roles.guard.ts` 의 `ForbiddenException({ ...NOT_A_MEMBER })` / `ForbiddenException({ ...ROLE_REQUIRED[threshold] })` 를 통해 **실제 403 응답 본문에 이미 노출되던 값**이다(가드 docstring `## 거부 코드 (2026-09-25~)` 참조). 즉 Swagger 문서가 새로운 정보를 추가로 유출하는 것이 아니라 런타임에 이미 공개되던 값을 문서에 미러링한 것 — 정보 노출 관점의 새 취약점은 아니다.
  - 제안: 조치 불요.

- **[INFO]** 신규 저장소 가드 테스트가 전용 `RolesGuard` 인스턴스에 고정 UUID(`11111111-...`, `22222222-...`)와 mock `WorkspacesService` 를 사용
  - 위치: `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes.spec.ts` (`모델 캐너리` 블록, `TOKEN_WS`/`OTHER_WS` 상수 및 `codesFromGuard`)
  - 상세: 테스트 전용 fixture 이고 실제 인증/DB 접근 없이 순수 함수 호출 경로만 검증한다. 하드코딩된 값은 시크릿이 아니라 임의 nil-형 UUID 상수다. 프로덕션 코드/설정에 영향 없음.
  - 제안: 조치 불요.

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩된 시크릿, 인증 우회, 안전하지 않은 암호화, 민감정보 에러 노출, 취약 의존성 추가 — 위 점검 관점에 해당하는 새로운 이슈는 발견되지 않았다. 변경은 (a) 인라인 계산식을 함수로 추출(로직 동일, byte-identical), (b) Swagger 문서 문자열을 상수 보간 헬퍼로 교체(런타임 응답과 동기화), (c) 이를 감시하는 신규 CI 전용 정적 검사 테스트 추가로 구성되며 셋 다 실행 경로상 사용자 입력을 다루지 않는다.

## 요약

이번 변경은 워크스페이스 역할 인가 로직 자체를 바꾸지 않는 순수 리팩터(계산식 추출)와, 이미 런타임에 노출되던 거부 코드를 Swagger API 문서에도 일관되게 반영하는 문서 동기화 작업, 그리고 그 동기화를 강제하는 신규 저장소 가드 테스트(실제 `RolesGuard` 를 돌려 모델과 대조하는 캐너리 포함)로 구성된다. `lowestRequiredRole`/`roles.guard.ts` 전문을 직접 열어 대조한 결과 인가 판정 흐름·거부 코드 산출 로직에 회귀나 우회 지점은 없었다. 서열 밖 역할 문자열이 문턱이 되는 기존 특성은 컴파일 타임 타입 제약으로 실질적으로 도달 불가능하며, 이번 diff 는 그 특성을 새로 만든 것이 아니라 테스트로 고정했을 뿐이다. 시크릿 하드코딩, 인젝션, 안전하지 않은 암호화, 민감정보 노출 등 다른 OWASP Top 10 관점의 이슈도 확인되지 않았다.

## 위험도

NONE
