# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 이 PR 의 목적(129곳의 손으로 쓴 403 문구를 공용 헬퍼로 DRY 화)과 반대로, 헬퍼 도입 과정에서 동일한 복합 문구 리터럴이 파일 내에서 2회씩 중복 생성됨 — 이전에는 로컬 상수(`FORBIDDEN_OWNER_ROUTE` 등) 하나로 공유되던 자리다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:223`, `codebase/backend/src/modules/workspaces/workspaces.controller.ts:274` — 둘 다 `` `${forbiddenForRole('owner')}, 또는 개인 워크스페이스` `` 동일 리터럴.
  - 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts:99`, `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts:119` — 둘 다 `` `${forbiddenForRole('editor')}, 또는 데이터셋 소유자가 아님(FORBIDDEN — 서비스 판정)` `` 동일 리터럴.
  - 상세: 코드(code) 부분은 `forbiddenForRole()`로 이미 중앙화되어 있어 코드 드리프트 위험은 없지만, 뒤에 붙는 자연어 설명("또는 개인 워크스페이스" 등)은 그대로 복사돼 있다. 같은 PR 안에서 `integrations.controller.ts`는 동일한 상황(복합 거부 문구가 여러 라우트에서 재사용됨)을 모듈 레벨 상수(`FORBIDDEN_MEMBER_OR_ORG_ADMIN` 등)로 추출해 정확히 이 패턴을 피했고, `triggers.controller.ts`의 `TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION`도 같은 관례를 보여준다 — 이 두 파일만 관례를 벗어났다.
  - 제안: 각 파일에 `const FORBIDDEN_OWNER_OR_PERSONAL = `${forbiddenForRole('owner')}, 또는 개인 워크스페이스`;` / `const FORBIDDEN_EDITOR_OR_NOT_OWNER = `${forbiddenForRole('editor')}, 또는 데이터셋 소유자가 아님(FORBIDDEN — 서비스 판정)`;` 형태의 모듈 상수로 추출해 두 사용처가 참조하게 한다.

- **[INFO]** `lowestRequiredRole`은 `Array.prototype.reduce`를 초기값 없이 호출해 빈 배열이 들어오면 `TypeError: Reduce of empty array with no initial value`라는 불친절한 런타임 에러를 낸다. JSDoc에 "`requiredRoles`는 비어 있지 않아야 한다"는 전제가 명시돼 있고 현재 두 호출부(`RolesGuard.assertMember`, `guardRejectionCodes`)가 모두 `length === 0` 체크 뒤에만 호출하므로 지금은 안전하지만, 향후 새 호출자가 그 전제를 놓치면 원인을 알기 어려운 에러로 이어진다.
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts:36`-`42` (`lowestRequiredRole` 함수)
  - 제안: 필수는 아니나, 빈 배열 입력 시 명시적으로 에러를 던지거나(`if (requiredRoles.length === 0) throw new Error(...)`) JSDoc의 전제를 함수 안에서도 assert 하면 향후 호출자 실수를 더 빨리 드러낼 수 있다.

- **[INFO]** `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts`의 `guardRejectionCodes`는 nestjs/swagger가 export 하지 않는 메타데이터 키 문자열(`'swagger/apiResponse'` 등)을 손으로 옮겨 적었다. 파일 상단 주석이 "키가 바뀌면 조용히 통과하지 않는다"는 이유(형제 가드 `http-status-advertised`와 동일 사정)를 이미 밝혀 두어 납득할 만한 트레이드오프이지만, 매직 스트링이라는 성격은 남는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts` 내 `SWAGGER_API_RESPONSE` / `SWAGGER_EXCLUDE_ENDPOINT` / `SWAGGER_EXCLUDE_CONTROLLER` 상수 선언부.
  - 상세/제안: 조치 불필요 — 기존 저장소 관례와 일치하고 이미 문서화됨. 참고용으로만 기록.

## 긍정적으로 확인된 점

- `codebase/backend/src/common/constants/workspace-roles.ts`의 `lowestRequiredRole`과 `codebase/backend/src/common/swagger/forbidden-descriptions.ts`의 `forbiddenForRole`/`FORBIDDEN_NOT_A_MEMBER`는 짧고 단일 책임이며, 129곳에 흩어져 있던 손으로 쓴 403 문구(형식이 컨트롤러마다 갈리고 코드가 빠져 있던 상태)를 하나의 SoT로 모았다 — 이 PR의 핵심 목적을 잘 달성했다.
- 두 함수 모두 "왜"를 설명하는 JSDoc이 충실하다(가드·저장소 가드가 같은 함수를 공유해야 하는 이유, 서열 밖 문자열이 문턱이 되는 위험 등) — 코드만 읽어서는 알기 어려운 설계 의도를 잘 남겼다.
- `roles.guard.ts`의 리팩터(인라인 `reduce` 식 → `lowestRequiredRole` 호출)는 중복 제거이자 단일 진실 원천화이며 동작 변경이 없다.
- 신규 저장소 가드(`forbidden-response-codes-guard.ts` + `.spec.ts`)는 기존 `*-guard.ts`/`*.spec.ts` 페어 패턴(`http-status-advertised-guard.ts` 등과 동일 디렉터리 관례)을 그대로 따라 저장소 전반의 일관성을 해치지 않는다. 함수들(`loadControllers`, `collectRouteHandlers`, `metadataOf`, `guardRejectionCodes`, `isExcluded`, `forbiddenDescription`, `scanForbiddenResponseCodes`)은 각각 짧고 단일 책임이며 중첩도 얕다(순회 + 조기 `continue`).
- 129개 컨트롤러 호출부 변경은 전부 기계적이고 동일한 형태(`'문자열'` → `FORBIDDEN_NOT_A_MEMBER` 또는 `forbiddenForRole('role')`)라 리뷰·향후 유지보수 부담이 낮다. `integrations.controller.ts`·`triggers.controller.ts`는 재사용되는 복합 문구를 모듈 상수로 뽑아 이 PR이 지향하는 DRY 관례를 정확히 보여준다(위 WARNING 두 곳만 예외).

## 요약

전체적으로 매직 문자열(하드코딩된 403 설명)을 공용 헬퍼로 중앙화하여 유지보수성을 크게 개선한 리팩터다. 핵심 로직 파일(`workspace-roles.ts`, `roles.guard.ts`, `forbidden-descriptions.ts`, 저장소 가드 한 쌍)은 함수 길이·중첩·네이밍·문서화 모두 양호하며 기존 코드베이스 관례(가드-스펙 페어, spec 인용, JSDoc 근거 서술)를 그대로 따른다. 유일한 흠은 이 PR 자신의 DRY 취지와 어긋나게 두 컨트롤러 파일에서 복합 거부 문구 리터럴을 로컬 상수로 추출하지 않고 2회씩 그대로 복제한 점인데, 코드(에러 코드) 자체는 이미 헬퍼로 중앙화돼 있어 실질적 드리프트 위험은 낮다.

## 위험도

LOW
