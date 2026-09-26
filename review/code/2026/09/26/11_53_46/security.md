# Security 리뷰 — forbidden-desc-codes

## 범위 요약

이 변경은 32개 파일에 걸쳐 `@ApiForbiddenResponse({ description: ... })` 의 하드코딩 문자열을
`RolesGuard` 가 실제로 내는 거부 코드(`NOT_A_MEMBER` · `EDITOR_REQUIRED` · `ADMIN_REQUIRED` ·
`OWNER_REQUIRED`)를 보간하는 공용 헬퍼(`forbiddenForRole` · `FORBIDDEN_NOT_A_MEMBER`,
`codebase/backend/src/common/swagger/forbidden-descriptions.ts`)로 교체하는 기계적(mechanical)
OpenAPI 문서 일관성 수정이다. 여기에 더해:

- `workspace-roles.ts` 에 `lowestRequiredRole()` 을 추출해 `RolesGuard.assertMember` 와 신규 저장소
  가드(`forbidden-response-codes-guard.ts`)가 "요구 역할 중 실제 문턱"을 계산하는 단일 함수를 공유한다.
- `src/repo-guards/__tests__/forbidden-response-codes-guard.ts` + `.spec.ts` — reflection 기반으로
  모든 컨트롤러 라우트를 스캔해 403 설명이 가드가 낼 수 있는 코드를 전부 담는지 검증하는 신규
  repo-guard(테스트 전용)를 추가한다.

## 발견사항

- **[INFO]** 신규 repo-guard 의 `guardRejectionCodes()` 모델이 실제 `RolesGuard.canActivate` 분기를 손으로
  옮겨 적은 것이라, 저장소에 아직 없는 라우트 모양(fixture 에 없는 조합)에 대해서는 드리프트를 못 잡을 수
  있다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts` 의
    `guardRejectionCodes()` 함수, 및 `forbidden-response-codes.spec.ts` 의 "모델 캐너리" 테스트
    (fixture 클래스 `ForbiddenFixtureController` / `ClassRolesFixtureController` 로만 검증).
  - 상세: PR 저자도 이 갭을 문서화해 뒀다(spec 파일 헤더 "못 보는 것 두 가지" 및 클래스 docstring). 모델
    캐너리가 실제 `RolesGuard` 인스턴스를 fixture 라우트에 돌려 대조하는 설계는 좋으나, 대조 대상이
    fixture 라우트에 한정되어 실제 `src/modules` 컨트롤러의 모든 데코레이터 조합(예: 클래스+핸들러 양쪽에
    `@Roles()` 가 다른 값으로 걸린 조합, `@Public()` + `@Roles()` 동시 등)까지 보장하지는 않는다. 이는
    이번 diff 가 런타임 인가 로직 자체를 바꾸지 않았으므로 새로운 취약점은 아니고, 향후 `RolesGuard` 가
    분기를 늘릴 때 이 모델이 소리 없이 stale 해질 수 있다는 커버리지 메모에 가깝다.
  - 제안: 별도 조치 불필요(현재 diff 범위 밖). 향후 `RolesGuard` 분기 변경 시 이 저장소 가드의 fixture 를
    함께 갱신하는 관례만 유지하면 된다.

- **[INFO]** 403 설명에 내부 거부 코드(`NOT_A_MEMBER` 등)를 명시적으로 노출한다.
  - 위치: `codebase/backend/src/common/swagger/forbidden-descriptions.ts` 전체, 그리고 이를 소비하는
    30개 컨트롤러 파일의 `@ApiForbiddenResponse({ description: ... })` 자리.
  - 상세: 실제 403 응답 본문은 변경 전부터 이미 `ForbiddenException({ ...NOT_A_MEMBER })` /
    `ForbiddenException({ ...ROLE_REQUIRED[threshold] })` 형태로 `{code, message}` 를 실어 보냈다
    (`codebase/backend/src/common/guards/roles.guard.ts` `assertMember`, 이번 diff 이전부터). 이번
    변경은 이미 관측 가능한 코드값을 Swagger 문서에 반영한 것뿐이라 새로운 정보 노출이 아니다.
  - 제안: 조치 불필요.

## 검토한 항목과 결론

1. **인젝션**: 모든 문자열 보간은 코드베이스 내부 상수(`NOT_A_MEMBER.code`, `ROLE_REQUIRED[role].code`)에서만
   오며 사용자 입력이 개입하지 않는다. SQL/XSS/커맨드 인젝션 경로 없음.
2. **하드코딩된 시크릿**: 없음. 테스트의 `'11111111-1111-4111-8111-111111111111'` 류는 모델 캐너리 테스트용
   더미 UUID이지 시크릿이 아니다.
3. **인증/인가**: `RolesGuard.assertMember` 의 문턱 계산 로직(`requiredRoles.reduce(...)`)이
   `lowestRequiredRole()` 로 추출됐을 뿐 알고리즘은 동일하다 — `roles.guard.ts` 는
   `workspaceRoleLevel as roleLevel` 을 그대로 import 해 쓰므로(`import { ... workspaceRoleLevel as roleLevel } from '../constants/workspace-roles'`), 추출된 함수와 가드가 같은 `workspaceRoleLevel` 을 공유해
   두 구현이 갈리는 회귀는 없다. 오히려 이 추출은 가드와 신규 정적 검사기가 동일 함수를 참조하게 해
   "검사가 가드와 다른 문턱 규칙을 요구하는" 드리프트를 구조적으로 막는다(주석에 명시된 의도와 일치, 실측
   가능).
4. **입력 검증**: 이번 diff 는 컨트롤러의 파라미터 검증·데코레이터에 변경이 없다(문서 문자열만 교체).
5. **OWASP Top 10**: 해당 없음 — 문서-구현 정합성 개선(오히려 기존 문서 드리프트를 줄이는 방향).
6. **암호화**: 관련 코드 없음.
7. **에러 처리**: 위 INFO 항목 참고 — 노출은 기존 런타임 동작을 문서화한 것으로 신규 노출이 아니다.
8. **의존성 보안**: 신규 repo-guard 파일(`src/repo-guards/__tests__/*`)은 `tsconfig.build.json` 의
   `exclude: ["src/repo-guards/**", ...]` 에 이미 걸려 production 빌드(`dist/`)에서 제외된다 — 확인 완료.
   따라서 이 테스트 전용 코드의 `import('...')`(동적 import, 고정된 repo 내부 파일 목록만 사용)나
   `reflect-metadata`/`@nestjs/common` 의존은 런타임 공격 표면이 아니다.

## 요약

본 변경은 런타임 인가 판정 로직을 바꾸지 않는 순수 문서(OpenAPI `@ApiForbiddenResponse` description) 정합성
수정이며, 함께 추출된 `lowestRequiredRole()` 공유 함수는 가드와 신규 정적 검사기의 문턱 계산 로직이 갈리는
잠재적 회귀를 오히려 구조적으로 차단한다. 문서에 새로 실린 거부 코드는 이미 403 응답 본문으로 노출되던
값이라 추가적인 정보 노출이 아니다. 신규 저장소 가드(reflection 기반 정적 분석)는 테스트 전용이며 production
빌드 제외 목록에 이미 포함되어 있어 의존성/공급망 위험도 없다. 인젝션·시크릿·인증 우회·암호화·에러 처리
관점에서 발견된 신규 취약점은 없다.

## 위험도

NONE
