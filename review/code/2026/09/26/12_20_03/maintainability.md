# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** import 순서가 나머지 파일들과 반대다 — `FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole` 를 함께 import 하는 14개 컨트롤러 중 이 파일만 `forbiddenForRole` 을 먼저 적었다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:34-35`
  - 상세: 다른 13개 파일(alerts·auth-configs·edges·executions·folders·graph·knowledge-base·llm-model-config·model-config·nodes·schedules·triggers·workflow-assistant·workflows·workspaces 등)은 전부 `FORBIDDEN_NOT_A_MEMBER` 를 먼저, `forbiddenForRole` 을 나중에 쓴다. 이 파일만 순서가 뒤집혀 있다. eslint 에 `import/order`/`sort-imports` 규칙이 없어 CI 는 잡지 않지만, 같은 PR 안에서 유일한 예외라 다음에 이 파일을 보는 사람이 "의도된 차이인가" 를 다시 확인해야 한다.
  - 제안: 다른 파일과 동일하게 `FORBIDDEN_NOT_A_MEMBER` 를 먼저 적는다(순수 스타일 통일, 동작 영향 없음).

- **[INFO]** `"Admin 이상 권한 필요"` 류 문구가 공용 헬퍼(`ROLE_SHORTFALL`) 밖에서 손으로 다시 조립된다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:95-97` (`FORBIDDEN_MEMBER_OR_ORG_ADMIN` · `FORBIDDEN_EDITOR_OR_ORG_ADMIN` · `FORBIDDEN_MEMBER_OR_ADMIN`), `codebase/backend/src/modules/workspaces/workspaces.controller.ts:67` (`FORBIDDEN_OWNER_OR_PERSONAL`), `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts:39` (`FORBIDDEN_EDITOR_OR_NOT_OWNER`)
  - 상세: 이번 리팩터의 목적 자체가 "손으로 쓴 403 문구를 단일 헬퍼로 대체해 표기 drift 를 없앤다" 인데, 역할 요구가 서비스 계층의 추가 거부(조직 Admin·소유자·개인 워크스페이스)와 결합되는 5곳은 `forbiddenForRole()`/`FORBIDDEN_NOT_A_MEMBER` 를 베이스로 쓰되 접미 문구(`, 또는 ...`)는 여전히 각 파일에서 따로 조립한다. `ROLE_REQUIRED.admin.code` 를 직접 보간하는 자리(`FORBIDDEN_MEMBER_OR_ORG_ADMIN` 등)는 `forbiddenForRole('admin')` 이 이미 담은 "Admin 이상 권한 필요(ADMIN_REQUIRED)" 문구와 표현이 겹친다. 발생 빈도가 4곳 뿐이라 헬퍼를 더 일반화하는 게 오히려 과설계일 수 있어 CRITICAL/WARNING 은 아니지만, 6번째 컨트롤러가 같은 복합 패턴을 또 필요로 하면 이때는 `forbiddenForRole` 옆에 합성 헬퍼(예: `forbiddenForRole(role, extra: string)`)를 만드는 편이 낫다.
  - 제안: 지금 당장 변경 불필요. 유사 복합 패턴이 한 곳 더 생기면 공용 합성 헬퍼로 승격을 고려.

## 요약

핵심 변경은 `workspace-roles.ts` 에 `lowestRequiredRole()` 를 추출해 `RolesGuard.assertMember` 와 신설 저장소 가드(`forbidden-response-codes-guard.ts`)가 "요구 역할 중 가장 낮은 것이 문턱" 이라는 규칙을 한 곳에서만 표현하게 만든 것과, `common/swagger/forbidden-descriptions.ts` 의 `FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole()` 로 24개 컨트롤러에 흩어져 있던 손으로 쓴 403 설명 문자열(표기가 제각각이던 "권한 부족 (Admin 미만) 또는 비멤버" 류)을 단일 소스로 치환한 것이다. 두 변경 모두 전형적인 DRY 개선으로, 그동안 코드마다 따로 옮겨 적던 서열/문구 로직이 갈릴 위험을 구조적으로 없앤다. `ROLE_SHORTFALL` 은 `Record<Exclude<WorkspaceRoleName,'viewer'>, string>` 타입으로 역할이 늘면 컴파일에서 막히게 해 완전성을 보장하고, 신설 정적 분석 가드(`forbidden-response-codes-guard.ts` + `.spec.ts`)는 작은 단일 책임 함수들(`loadControllers`/`collectRouteHandlers`/`guardRejectionCodes`/`scanForbiddenResponseCodes`)로 나뉘어 있고, "모델(가드 코드 예측)과 실제 `RolesGuard` 가 갈릴 수 있다" 는 고전적 위험을 캐너리 테스트(대조군 fixture 에 실제 가드를 돌려 모델과 대조)로 직접 검증해 완화했다는 점이 특히 견고하다. 24개 컨트롤러에 걸친 변경은 대부분 `'문자열' → forbiddenForRole('role')` 형태의 기계적 치환이라 반복이 많아 보이지만 이는 파일마다 독립적으로 필요한 import/decorator 배선이라 실질적 코드 중복이 아니다. 발견한 이슈는 import 순서 스타일 불일치 1건과 복합 문구 조립의 경미한 반복 1건뿐으로 둘 다 INFO 수준이며 동작에 영향이 없다.

## 위험도

LOW
