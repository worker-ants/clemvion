# 보안(Security) 리뷰

## 검토 범위

이번 변경은 OpenAPI(Swagger) 403 응답 `description` 문자열의 형식을 공용 헬퍼(`forbiddenForRole`, `forbiddenWithService`)로
통일하는 순수 리팩터다. 실측(`git diff HEAD~5 -- codebase/`)으로 대상 파일을 전수 확인했다:

- `codebase/backend/src/common/swagger/forbidden-descriptions.ts` — 신규 헬퍼 `forbiddenWithService(guard, service)` 추가.
  구현은 `` `${guard} 또는 ${service}` `` 단순 템플릿 문자열 결합이며, 두 인자 모두 코드 내부에 이미 존재하는 상수/헬퍼
  반환값이다(호출자가 사용자 입력을 직접 넘기는 경로 없음).
- `codebase/backend/src/common/swagger/forbidden-descriptions.spec.ts` — 위 헬퍼의 단위 테스트만 추가.
- `codebase/backend/src/modules/{auth,executions,integrations,workflow-test-datasets,workspaces}/*.controller.ts` —
  `@ApiForbiddenResponse({ description: ... })` 데코레이터의 문자열 조립 방식만 교체. 실제 인가 로직
  (`@Roles(...)`, `RolesGuard`, 서비스 계층의 권한 판정)은 각 파일에서 **일절 수정되지 않았다** — diff 를 확인한 결과
  가드 데코레이터·서비스 호출부는 그대로이고, 바뀐 줄은 전부 `@ApiForbiddenResponse` 의 `description` 필드뿐이다.

`@ApiForbiddenResponse` 의 `description` 은 NestJS/Swagger 가 OpenAPI 스펙(문서) 생성에만 사용하는 메타데이터로, 런타임에
실제 403 응답 바디에 포함되지 않는다(실제 응답은 가드/서비스가 던지는 `ForbiddenException` 이 별도로 결정한다). CHANGELOG.md
자체에도 "응답 자체(상태 · 본문 · 코드)는 그대로이고 **문서의 설명 문장**만 바뀐다" 고 명시되어 있고, 코드 diff 로 이를 재확인했다.

## 발견사항

해당 없음 — 인젝션, 시크릿 하드코딩, 인증/인가 로직 변경, 입력 검증 경로, 암호화, 의존성 변경 중 어느 것도 이번 diff 에
포함되지 않는다. 문자열 내용 자체도 기존에 이미 공개되어 있던 에러 코드(`NOT_A_MEMBER.code`, `ROLE_REQUIRED.*.code`,
`RERUN_PERMISSION_DENIED` 등)를 그대로 재사용하며, 구두점(`, 또는` → ` 또는`)과 조립 위치만 바뀌었다 — 새로운 정보 노출은 없다.

- `codebase/backend/src/modules/auth/auth.controller.ts:432` 부근에 남아 있는 `NOT_A_MEMBER` import 는 여전히 다른
  `@ApiOperation` description 에서 사용 중이라 불필요한 잔존 import 가 아님을 확인했다(참고용, 보안 이슈 아님).

## 뮤테이션 검증

저장소 파일을 수정하지 않고 `git diff HEAD~5`, `grep` 만으로 확인했다 — 저장소 트리에 아무 변경도 남기지 않았음
(`git status --short` 로 재확인함, 결과 없음).

## 요약

이번 PR 은 403 응답의 OpenAPI 문서 설명 문자열 형식을 공용 헬퍼로 통일하는 순수 리팩터로, 실제 인가 로직·입력 처리·암호화·
의존성에는 어떤 변경도 없다. 신규 헬퍼 `forbiddenWithService` 는 코드 내부 상수만 결합하는 단순 문자열 함수라 인젝션이나
정보 노출 벡터가 없다. 보안 관점에서 우려할 변경 사항이 없다.

## 위험도

NONE
