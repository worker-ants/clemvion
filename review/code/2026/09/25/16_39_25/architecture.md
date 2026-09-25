# 아키텍처(Architecture) 리뷰 — workspace-path-guard (2026-09-25 16:39:25, 2라운드)

## 발견사항

- **[WARNING]** 역할 서열은 단일 SoT(`workspace-roles.ts`)로 통합했는데, 같은 PR 이 그 옆에 **파생되지 않은 두 번째 역할 테이블**(`ROLE_REQUIRED`)을 새로 만들어 같은 종류의 드리프트 위험을 재도입한다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:42`(`const ROLE_REQUIRED: Record<string, { code: string; message: string }> = {...}` 선언) · `:236`(`throw new ForbiddenException(ROLE_REQUIRED[threshold] ?? NOT_A_MEMBER);`)
  - 상세: 이번 PR 은 정확히 "가드의 `ROLE_HIERARCHY` 숫자 서열"과 "서비스의 `ADMIN_ROLES` 집합"이 따로 존재해 둘이 갈릴 수 있었던 문제를 `common/constants/workspace-roles.ts`(`WORKSPACE_ROLE_LEVEL` · `workspaceRoleLevel` · `ADMIN_ROLES`)로 단일화해 해결했다(`workspace-roles.spec.ts` 가 "DTO 가 받는 역할 전부가 서열에 있다" 를 고정). 그런데 같은 `roles.guard.ts` 에 새로 추가된 `ROLE_REQUIRED`(역할별 거부 코드/메시지 맵)는 `WORKSPACE_ROLE_LEVEL` 의 키에서 **파생되지 않은 별도의 손으로 쓴 리터럴**이다. `assertMember` 의 `ROLE_REQUIRED[threshold] ?? NOT_A_MEMBER` 폴백은 두 테이블의 키가 갈려도 컴파일·테스트가 잡지 못하고 조용히 `NOT_A_MEMBER`(비멤버 메시지)로 대체한다 — 요청은 여전히 거부되므로 인가 우회는 아니지만, "역할 미달"과 "비멤버"를 구분하지 않는 오답 코드/메시지를 클라이언트에 준다. `WORKSPACE_ROLE_LEVEL` 에 역할이 하나 추가되는 순간 이 맵을 사람이 기억해서 함께 고쳐야 하는데, 그 동기화를 강제하는 테스트나 타입(`Record<WorkspaceRole, ...>`처럼 키를 좁히는 타입)이 없다. 이 PR 이 방금 닫은 것과 같은 클래스의 이중 유지 표면을 스스로 하나 늘린 셈이다(개방-폐쇄 원칙: 역할 추가가 한 곳이 아니라 두 곳을 요구).
  - 제안: `ROLE_REQUIRED` 를 `Record<keyof typeof WORKSPACE_ROLE_LEVEL, ...>` 로 타입을 좁혀 tsc 가 누락 키를 잡게 하거나, `workspace-roles.spec.ts` 의 "한쪽에만 역할이 늘면 RED" 패턴처럼 `Object.keys(ROLE_REQUIRED)` 와 `Object.keys(WORKSPACE_ROLE_LEVEL)` 의 동등성을 단언하는 테스트를 추가할 것.

- **[INFO]** `common/` 계층의 테스트가 `modules/` 계층의 DTO 를 import해 레이어 방향이 역전된다 — 런타임 영향은 없지만 경계가 흐려진다.
  - 위치: `codebase/backend/src/common/constants/workspace-roles.spec.ts:6` (`import { WORKSPACE_ROLES } from '../../modules/workspaces/dto/add-member.dto';`)
  - 상세: 이 저장소는 `modules/*` 가 `common/*` 를 참조하는 단방향 레이어를 전제로 한다(가드·데코레이터·상수는 하위 공용 계층). 그런데 `common/constants/workspace-roles.spec.ts` 는 두 역할 카탈로그(가드가 보는 서열의 키 집합 vs DTO 가 검증에 쓰는 `WORKSPACE_ROLES`)가 갈리지 않는지 보려고 반대 방향으로 `modules/workspaces/dto/add-member.dto` 를 끌어온다. 계약 테스트(contract test) 의도는 합리적이고 프로덕션 번들에는 영향이 없지만(spec 파일이라 빌드 그래프에 안 들어간다), "common 은 modules 를 모른다" 는 불변식이 테스트 코드에서는 이미 깨져 있다는 신호다. 두 카탈로그 중 진짜 canonical 은 `WORKSPACE_ROLES`(DTO 의 `@IsEnum` 검증에 쓰이는 배열)인데, `WORKSPACE_ROLE_LEVEL` 이 그것을 참조하지 않고 독립적으로 같은 네 값을 다시 나열한 것도 같은 뿌리다.
  - 제안: 급한 사항은 아니다. 다음에 역할 목록을 건드릴 일이 있으면, `WORKSPACE_ROLES` 자체를 `common/constants/workspace-roles.ts` 로 옮기고 `add-member.dto.ts` 가 그것을 import 하도록 뒤집으면 이 역방향 참조와 "네 값의 이중 나열"이 함께 없어진다.

- **[INFO]** `RolesGuard.canActivate` 의 경로 파라미터 분기가 `pathParamNames` 를 배열로 순회하며 항목마다 `assertMember` 를 순차 호출한다 — 현재는 항상 1건이라 문제가 없지만, 나중에 한 핸들러가 `@WorkspaceParam` 을 두 개 이상 쓰게 되면 N+1 순차 DB 왕복이 조용히 생긴다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:166`(`const pathParamNames = workspaceParamNamesOf(...)`)~`:174`(`await this.assertMember(raw, userId, requiredRoles);` 를 포함한 `for` 루프)
  - 상세: `workspace-roles-attachment.spec.ts` 가 현재 15곳 전부 `['id']` 하나만 반환함을 고정하고 있어 지금 당장의 실제 위험은 낮다. 다만 코드 형태 자체는 "한 라우트가 워크스페이스 경로 파라미터를 여럿 가질 수 있다"를 전제로 짜여 있고, 그 경우 멤버십 조회가 파라미터 수만큼 직렬로 늘어난다. 이 저장소는 다른 곳(메모리 규약)에서 N+1 을 배치로 처리하는 관례를 갖고 있어 여기만 예외로 남는 모양이 된다.
  - 제안: 지금 고칠 필요는 없다 — 다만 두 번째 `@WorkspaceParam` 이 실제로 쓰이게 되면 `Promise.all` 로 병렬화하거나, 애초에 "라우트당 워크스페이스 경로 파라미터는 최대 1개"라는 불변식을 `workspace-param-binding-guard.ts` 류의 정적 가드로 명시해 두는 편이 안전하다.

## 좋았던 점 (참고)

- `spec/data-flow/12-workspace.md` §Rationale 을 근거로 가드(`RolesGuard`)·서비스(`assertAdmin`/`assertMembership`)·정적 가드(`workspace-param-binding-guard.ts`)·부트 캐너리(`workspace-reflection-canary.ts`)가 같은 불변식을 4중으로 지키는 defense-in-depth 가 일관되게 문서화돼 있다(1라운드 W2/W4/W6 이 이미 처분한 항목과 같은 결의 후속).
- `common/constants/workspace-roles.ts` 도입으로 가드·두 서비스가 하나의 서열에서 파생하게 된 것은 SOLID 의 단일 책임/개방-폐쇄 관점에서 올바른 리팩터다(단, 위 WARNING 이 그 옆에서 새는 자리를 지적한다).
- `workspace-param-binding-guard.ts` 는 정규식이 아니라 TypeScript AST 로 판정하고, 판정과 vacuity-floor 카운트를 같은 순회에서 내는 등 이 저장소의 기존 정적 가드 관례(같은 루프에서 세기, 허용목록 없는 fail-closed, 대조군 fixture)를 정확히 따른다 — 모듈 경계 강제가 런타임(가드)과 빌드타임(정적 가드) 양쪽에 걸쳐 있어 견고하다.
- e2e(`workspace-path-guard.e2e-spec.ts`)가 구현 세부가 아니라 "비멤버는 워크스페이스 존재·유형과 무관하게 같은 응답을 받는다" 같은 성질(invariant)을 단언해 리팩터 내성이 높다.

## 요약

이번 변경은 경로 파라미터로 전달되는 워크스페이스 ID를 `RolesGuard` 가 인식하지 못했던 인가 공백을 데코레이터(`@WorkspaceParam`) + reflection + 정적 가드(`workspace-param-binding-guard.ts`) 삼중 구조로 닫는다. 1라운드 아키텍처 리뷰가 지적한 역할 서열 이중 유지(W4)와 가드-서비스 중복 조회(W2)는 각각 공유 상수 모듈과 명시적 docstring 으로 이번 라운드에서 정리되었음을 확인했다. 다만 그 정리 과정에서 새로 추가된 `ROLE_REQUIRED`(역할별 에러 코드/메시지 맵)가 방금 통합한 SoT(`WORKSPACE_ROLE_LEVEL`)에서 파생되지 않은 채 병존해, 이 PR 의 설계 의도(단일 서열)를 스스로 부분적으로 어기는 새로운 소규모 드리프트 표면을 남겼다. 그 외 `common → modules` 역방향 테스트 의존성과 경로 파라미터 다중화 시의 잠재적 N+1 은 현재 실질적 위험이 낮은 참고 수준의 관찰이다. 전반적으로 레이어 책임 분리, 방어 심층화, 정적 가드를 통한 컨벤션 강제가 모두 견고하게 설계·문서화되어 있다.

## 위험도

LOW
