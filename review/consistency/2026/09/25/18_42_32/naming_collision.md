# 신규 식별자 충돌 검토

검토 대상: `workspace-path-guard` 구현 diff (`origin/main...HEAD`, 30개 파일 / 3473줄, 코드 전용 —
scope spec 델타 0개는 정상). `@WorkspaceParam` 데코레이터, `common/constants/workspace-roles.ts`,
`workspace-param-binding` 저장소 가드, 가드 거부 코드(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/
`ADMIN_REQUIRED`/`OWNER_REQUIRED`) 도입을 대상으로 실제 워크트리(`git diff origin/main...HEAD`,
`git grep ... origin/main`)를 직접 대조했다. 이 PR 은 이미 `/ai-review` 5라운드 + planner 턴 3회를
거쳤고, 그 라운드들의 RESOLUTION 이 다수의 근접 명명·중복 서열 문제(ROLE_HIERARCHY→
WORKSPACE_ROLE_LEVEL 통합, `admin_required`/`ADMIN_REQUIRED` 대소문자 구분 명시, 가드 이름
경계 주석 등)를 이미 처리했음을 실측으로 확인했다.

## 발견사항

- **[WARNING]** 새 공용 `ADMIN_ROLES` 가 `integrations.service.ts` 의 기존 로컬 `ADMIN_ROLES` 를
  통합하지 않고 남겨 둠
  - target 신규 식별자: `codebase/backend/src/common/constants/workspace-roles.ts` 의 `export const
    ADMIN_ROLES: ReadonlySet<string>` (workspace 역할 서열에서 파생, `workspaces.service.ts` ·
    `workspace-invitations.service.ts` 가 이번 diff 에서 로컬 선언을 지우고 이 값을 import 하도록
    갈아탔다)
  - 기존 사용처: `codebase/backend/src/modules/integrations/integrations.service.ts:112` —
    `const ADMIN_ROLES = new Set(['owner', 'admin']);` (모듈 스코프 비-export, Integration 생성 권한
    판정용). 이 파일은 이번 diff 의 변경 대상이 아니며 origin/main 에도 동일하게 존재한다.
  - 상세: 같은 리터럴 이름 `ADMIN_ROLES`, 같은 값(`{'owner','admin'}`)을 세 곳(workspaces ·
    workspace-invitations · integrations)이 각각 독립적으로 갖고 있었는데, 이번 PR 이 그중 두 곳만
    공용 모듈로 옮기고 `integrations.service.ts` 는 그대로 남겼다. 모듈 스코프라 컴파일/런타임
    충돌은 없지만, "워크스페이스 역할 서열의 단일 진실"이라는 새 모듈의 취지(파일 헤더 docstring
    참조)와 어긋나는 동명 잔존이 하나 남아, 향후 `ADMIN_ROLES` 를 grep 하는 사람이 "공용 상수인 줄
    알았는데 왜 여기는 다르게 정의돼 있나"로 헷갈릴 수 있다.
  - 제안: 이번 PR 범위로 묶을 필요는 없다(계획 문서에 언급 없음 — 범위 확대 소지). 다만 후속
    트래커 항목으로 "`integrations.service.ts` 의 `ADMIN_ROLES` 도 `common/constants/
    workspace-roles.ts` 재사용"을 남기거나, 최소한 그 파일에 "workspace 서열과 우연히 같은 값이며
    별개 로컬 상수"라는 한 줄 주석을 추가해 동명이인임을 명시하는 편이 안전하다.

- **[INFO]** `WorkspaceRole`(기존) vs `WorkspaceRoleName`(신규) — 같은 개념의 근접 타입명
  - target 신규 식별자: `common/constants/workspace-roles.ts` 의 `export type WorkspaceRoleName =
    keyof typeof WORKSPACE_ROLE_LEVEL`
  - 기존 사용처: `codebase/backend/src/modules/workspaces/dto/add-member.dto.ts` 의 기존 `export type
    WorkspaceRole = (typeof WORKSPACE_ROLES)[number]`
  - 상세: 두 타입 모두 "워크스페이스 역할 이름(`viewer`/`editor`/`admin`/`owner`)"을 나타내는
    문자열 리터럴 유니온이며 실제로 값 집합이 같다. 이번 diff 는 `WORKSPACE_ROLES` 선언을 `as const
    satisfies readonly WorkspaceRoleName[]` 로 묶어 두 값이 어긋나면 컴파일이 막히게 해뒀고
    (`add-member.dto.ts`), `WorkspaceRoleName` 은 서열(`WORKSPACE_ROLE_LEVEL`)에서, `WorkspaceRole`
    은 DTO 열거값 배열(`WORKSPACE_ROLES`, OpenAPI enum 노출 순서 보존용)에서 각각 파생돼 존재
    이유가 다르므로 기능적 충돌은 아니다. 다만 이름이 `Name` 접미사 하나로만 갈리는 두 타입이
    서로 다른 파일에 있어, 신규 코드 작성 시 어느 쪽을 import 해야 하는지 즉시 판단하기 어렵다.
  - 제안: 병합할 필요는 없음(파생 축이 다름 — 서열 vs enum 표시 순서). 다만 `WorkspaceRoleName`
    docstring 또는 `WorkspaceRole` 옆에 "OpenAPI enum 표시 순서용 별칭, 값 집합은
    `WorkspaceRoleName` 과 컴파일 타임에 동기화됨(`satisfies`)"라는 상호 참조 한 줄을 남기면
    향후 혼동을 줄일 수 있다(선택 사항, WARNING 상향 요건 아님).

## 확인했으나 충돌 아님 (근거 남김)

- `EDITOR_REQUIRED` — `git grep EDITOR_REQUIRED origin/main` 0건, 완전 신규 코드. `error-codes.md`·
  `error-handling.md` 에 신규 등재됐고 다른 코드와 근접 명명 충돌 없음.
- `NOT_A_MEMBER` / `ADMIN_REQUIRED` / `OWNER_REQUIRED` — origin/main 에 이미 서비스 계층
  (`workspaces.service.ts`, `auth.service.ts`)이 동일 의미로 발행 중이던 기존 코드. 이번 PR 은
  가드 계층이 **같은 코드를 같은 의미로** 내도록 통합한 것이라 신규 식별자 충돌이 아니라 의도된
  중복 제거(단일 표 `common/constants/workspace-roles.ts` 로 흡수)다.
  `spec/5-system/3-error-handling.md`·`spec/conventions/error-codes.md` 가 소문자 `admin_required`
  (초대 모듈 lowercase 컨벤션, 두 번째 방어선)와 대문자 `ADMIN_REQUIRED` 를 명시적으로 구분해 두어
  근접 명명 오인 위험도 문서 차원에서 이미 처리됐다.
- `@WorkspaceParam` 데코레이터 / `workspace-param-binding` 저장소 가드 — `git grep
  "WorkspaceParam\b\|workspace-param-binding" origin/main` 0건, 완전 신규. 형제 가드
  `workspace-roles-attachment.spec.ts` 와 이름이 가깝다는 점은 계획 문서(W5)가 이미 인지했고,
  `workspace-param-binding.spec.ts` 헤더에 "이웃 가드와의 경계" 절로 두 가드의 책임 분리(이름 패턴
  전수 금지 vs 특정 핸들러의 `@Roles` 부착 확인)를 명시해 실제로 해소돼 있음을 파일에서 확인.
- `ROLE_HIERARCHY` → `WORKSPACE_ROLE_LEVEL` 리네임 — frontend `role-gate.tsx` 주석이 신 이름으로
  갱신돼 stale 참조가 남지 않았음을 diff 로 확인.
- 신규 spec 파일 경로 없음 — 이번 PR 은 기존 9개 spec 파일 본문만 수정(`spec_impact` 와 일치),
  새 spec 파일·엔드포인트 파일 생성 없음. API endpoint 신규 추가도 없음(기존 15개 라우트에 인가
  계층만 추가).

## 요약

신규 식별자 대부분(`EDITOR_REQUIRED`, `@WorkspaceParam`, `workspace-param-binding`,
`WORKSPACE_ROLE_LEVEL`)은 origin/main 에 선례가 없는 완전 신규이거나, 기존 서비스 계층 코드
(`NOT_A_MEMBER`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)를 같은 의미로 가드 계층까지 확장한
의도된 통합이며, 이미 5라운드의 `/ai-review` 와 3회의 planner 턴을 거치며 근접 명명·중복 서열
문제 다수가 해소된 상태다. 남은 항목은 `integrations.service.ts` 의 로컬 `ADMIN_ROLES` 가 이번에
신설된 공용 `ADMIN_ROLES` 로 흡수되지 않고 동명으로 남아 있다는 것(WARNING, 기능적 충돌 아님 —
모듈 스코프로 격리돼 있고 값도 일치) 과, `WorkspaceRole`/`WorkspaceRoleName` 근접 명명(INFO) 뿐이다.
둘 다 사용자/시스템 혼선을 즉시 유발하는 CRITICAL 성격은 아니다.

## 위험도

LOW
