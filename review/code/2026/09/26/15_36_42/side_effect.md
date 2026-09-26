# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 신규 공개 함수 `forbiddenWithService` 추가 — 기존 시그니처 변경 없음, 순수 함수
  - 위치: `codebase/backend/src/common/swagger/forbidden-descriptions.ts:47`
  - 상세: `export function forbiddenWithService(guard: string, service: string): string { return \`${guard} 또는 ${service}\`; }`. 두 문자열 인자를 받아 새 문자열을 반환할 뿐 어떤 외부 상태도 읽거나 쓰지 않는 순수 함수다. `common/swagger/index.ts` 가 `export * from './forbidden-descriptions'` 로 와일드카드 재노출하므로 배선도 자동이다. 기존 `forbiddenForRole`, `FORBIDDEN_NOT_A_MEMBER` 는 시그니처·값 모두 그대로이며 호출자 영향 없음.
  - 제안: 없음 — 부작용 관점에서 문제 없음, 기록 목적.

- **[INFO]** 8개 라우트 파일에서 module-level 상수가 헬퍼 호출 결과로 재정의됨 — 평가 시점·순서 이상 없음
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:96-107`, `codebase/backend/src/modules/workspaces/workspaces.controller.ts:68-71`, `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts:40-43`
  - 상세: `FORBIDDEN_MEMBER_OR_ORG_ADMIN` 등 module-level `const` 가 `forbiddenWithService(FORBIDDEN_NOT_A_MEMBER, \`...${ROLE_REQUIRED.admin.code}...\`)` 형태로 바뀌었다. `ROLE_REQUIRED`(from `common/constants/workspace-roles`)는 그 파일 자체가 외부 의존성이 없어(import 없음, 직접 확인) `forbidden-descriptions.ts` 와 순환 참조가 없다. ES 모듈 import 호이스팅으로 평가 순서 문제도 없다. 이 상수들은 Nest 데코레이터(`@ApiForbiddenResponse({ description: ... })`)에 넘겨지는 정적 문자열이며, 클래스 정의(모듈 로드) 시 1회 평가되고 이후 변하지 않는다 — 요청마다 재계산되거나 공유 가변 상태로 쓰이지 않는다.
  - 제안: 없음.

- **[INFO]** 미사용 import 잔존 여부 확인 — 문제 없음
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` (diff 로 `NOT_A_MEMBER`, `ROLE_REQUIRED` import 제거), `codebase/backend/src/modules/auth/auth.controller.ts` (동일 파일에 `NOT_A_MEMBER` import 잔존)
  - 상세: `executions.controller.ts` 는 `NOT_A_MEMBER`·`ROLE_REQUIRED` 를 더 이상 참조하지 않아 import 를 함께 제거했고(grep 으로 잔존 참조 0건 확인), `auth.controller.ts` 는 `NOT_A_MEMBER` import 를 유지하는데 실제로 432번째 줄 `@ApiOperation` description 안에서 여전히 `${NOT_A_MEMBER.code}` 를 보간해 사용 중이라 정당하다. 두 파일 모두 dangling import 나 dead code 로 인한 빌드/린트 부작용은 없다.
  - 제안: 없음.

- **[INFO]** 응답 상태 코드·본문·가드 로직은 변경되지 않음 — Swagger 문서 문자열만 교체
  - 위치: `codebase/backend/src/modules/auth/auth.controller.ts`, `executions.controller.ts`, `integrations.controller.ts`, `workflow-test-datasets.controller.ts`, `workspaces.controller.ts` 전체 diff
  - 상세: 모든 변경 hunk 가 `@ApiForbiddenResponse({ description: ... })` 의 `description` 문자열 생성 방식만 바꾼다. `@Roles(...)`, `RolesGuard`, 실제 서비스 계층의 403 판정·throw 로직에는 손대지 않았다 — 즉 런타임 HTTP 응답(상태 코드/본문)에는 부작용이 없고, 오직 생성되는 OpenAPI 스펙(문서)의 텍스트만 바뀐다. 이는 plan(`plan/in-progress/forbidden-helper-sentences.md`) 이 명시한 의도와 일치한다.
  - 제안: 없음.

## 요약

이번 변경은 17개 라우트의 `@ApiForbiddenResponse` 설명 문자열을 손으로 쓴 형태에서 공용 헬퍼(`forbiddenForRole`, 신규 `forbiddenWithService`)로 옮긴 것으로, 실질적으로는 순수 문자열 조합 함수 하나를 추가하고 여러 컨트롤러의 module-level 상수·데코레이터 인자를 그 함수 호출로 치환한 리팩터다. 전역 상태·환경 변수·파일시스템·네트워크·이벤트/콜백을 건드리는 지점이 전혀 없고, 기존 함수 시그니처 변경도 없으며(새 함수 추가만), 응답 상태 코드·본문·인가 로직은 그대로다. 제거된 import(`NOT_A_MEMBER`, `ROLE_REQUIRED` in `executions.controller.ts`)도 실제 미사용 확인 후 제거된 것으로 확인했고, 순환 import 등 모듈 평가 순서 리스크도 없다. 리뷰 중 저장소 파일에 대한 뮤테이션은 수행하지 않았으며(`git status --short` 로 확인), 부작용 관점에서 지적할 CRITICAL/WARNING 항목은 없다.

## 위험도

NONE
