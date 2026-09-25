# 아키텍처(Architecture) 리뷰 — workspace-path-guard (2026-09-25 17:14:49, 3라운드)

## 발견사항

- **[INFO]** (재확인, 상향 없음) 1·2라운드가 지적한 두 항목은 이번 라운드 코드에서 여전히 유효하지만 새 근거가 없어 등급을 올리지 않는다.
  - `RolesGuard.canActivate` 의 경로 파라미터 루프가 여전히 순차 `await` 다(`codebase/backend/src/common/guards/roles.guard.ts` — `pathParamNames` 를 순회하는 `for` 루프, `assertMember` 호출부). `workspace-roles-attachment.spec.ts` 가 15곳 전부 `['id']` 하나만 반환함을 고정하고 있어 지금은 무해하다.
  - `common/constants/workspace-roles.spec.ts` 가 여전히 `modules/workspaces/dto/add-member.dto` 를 역방향으로 import 한다 — 2라운드 RESOLUTION 이 "계약 테스트 의도, 급하지 않음" 으로 명시적으로 유지를 결정한 자리라 재지적하지 않는다.
  - 제안: 없음 — 두 항목 모두 이미 처분(유예)됐고 이번 diff 가 그 유예의 전제를 바꾸지 않았다.

- **[INFO]** 2라운드 WARNING(`ROLE_REQUIRED` 가 `WORKSPACE_ROLE_LEVEL` 에서 파생되지 않은 별도 리터럴)이 이번 라운드에서 타입 수준으로 정확히 닫혔음을 확인했다.
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts` — `ROLE_REQUIRED: Readonly<Record<WorkspaceRoleName, WorkspaceRoleRejection>>` 선언, `codebase/backend/src/common/constants/workspace-roles.spec.ts` — "역할 미달 본문은 요구 역할마다 있고..." 테스트.
  - 상세: `Record<WorkspaceRoleName, ...>` 로 키를 서열의 `keyof typeof WORKSPACE_ROLE_LEVEL` 에 묶어, 서열에 역할이 추가/삭제되면 이 리터럴이 그 자리에서 컴파일 오류가 난다 — 2라운드 리뷰가 제안한 정확히 그 방식이다. `Object.keys` 동등성 테스트까지 추가돼 런타임 측에서도 이중 확인된다. 이 판단은 조치 확인용 기록이며 별도 조치는 필요 없다.
  - 제안: 없음.

- **[INFO]** `ADMIN_ROLES` 의 타입이 `ReadonlySet<string>` 으로 선언돼, 방금 도입한 `WorkspaceRoleName` 유니온의 타입 안전성 이득을 이 필드만 누리지 못한다.
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts` — `export const ADMIN_ROLES: ReadonlySet<string> = new Set(...)` 선언부.
  - 상세: 같은 파일의 `WORKSPACE_ROLE_LEVEL`·`ROLE_REQUIRED` 는 이번 라운드에 `WorkspaceRoleName` 으로 키를 좁혀 오탈자를 컴파일에서 막게 했는데(위 항목), `ADMIN_ROLES` 는 여전히 `Set<string>` 이라 `ADMIN_ROLES.has(someArbitraryString)` 호출부(`workspaces.service.ts`·`workspace-invitations.service.ts`)에서 오탈자 문자열을 넘겨도 타입 체커가 잡지 못하고 그냥 `false` 를 돌려준다. 값 자체는 `workspaceRoleLevel` 로 파생되어 있어 SoT 위반은 아니고, 순수 타입 표현력의 사소한 비대칭이다.
  - 제안: `ReadonlySet<WorkspaceRoleName>` 으로 선언 타입만 좁힐 것(값 생성 로직은 이미 `WorkspaceRoleName` 집합의 부분집합이라 변경 없이 타입만 명시하면 됨). 급하지 않음 — 이번 PR 범위의 핵심 결함이 아니다.

## 좋았던 점 (참고)

- 3라운드에 걸쳐 반복된 아키텍처 리뷰의 핵심 지적(역할 서열 이중 유지 → `ROLE_REQUIRED` 파생 누락)이 매 라운드 정확한 근거로 좁혀지며 최종적으로 타입 수준 강제로 수렴했다 — "타입이 막아준다" 는 주장이 실제로 `Record<WorkspaceRoleName, ...>` 컴파일 강제와 키 동등성 테스트 이중으로 뒷받침된다.
- `@WorkspaceParam`/`workspaceParamNamesOf` 가 기존 `@WorkspaceId`/`handlerConsumesWorkspaceId` 패턴을 그대로 복제해 확장하고, 캐너리·정적 가드·가드 세 소비처가 모두 같은 판별 함수 하나만 부르는 구조는 개방-폐쇄 원칙과 응집도 측면에서 여전히 견고하다.
- `workspace-param-binding-guard.ts`(신규)가 형제 가드 `param-uuid-pipe-guard.ts` 와 `decoratorCallName` 공용 유틸(`source-scan.ts`)을 공유하도록 리팩터된 것은 2라운드 WARNING(로직 복제)을 정확히 겨냥한 해소다.

## 요약

3라운드 diff 는 1·2라운드 아키텍처 리뷰가 지적한 항목의 처분 결과를 담고 있으며, 그중 유일한 WARNING 이었던 "역할별 거부 코드 테이블이 서열에서 파생되지 않는다" 는 `Record<WorkspaceRoleName, WorkspaceRoleRejection>` 타입 강제 + 키 동등성 테스트로 정확히 닫혔음을 확인했다. 새로 발견된 문제는 없다 — 남은 관찰은 이전 라운드가 이미 의도적으로 유예한 두 건(경로 파라미터 다중화 시 N+1, `common` 스펙의 역방향 import)의 재확인과, 이번 라운드가 새로 얻은 타입 안전성 패턴을 `ADMIN_ROLES` 선언에도 마저 적용하면 좋겠다는 사소한 제안뿐이다. 레이어 책임 분리(가드/서비스 defense-in-depth), 정적 가드를 통한 구조적 불변식 강제, 리플렉션 기반 확장의 개방-폐쇄 준수는 이번 라운드에도 그대로 유지된다.

## 위험도

LOW
