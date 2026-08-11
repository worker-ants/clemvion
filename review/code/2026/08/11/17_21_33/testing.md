# 테스트(Testing) Review

## 조사 방법 요약

- 회귀 테스트 필요성: `git log`/`git show --stat` 로 이 변경(`91edf4f6e`)과 선행 P0 PR(`4c199813c`,
  `8d84f6e9f`)의 실제 diff 파일 목록을 대조.
- 뮤테이션 재현: 저장소 밖 scratch(`/private/tmp/.../scratchpad/mirror`)에 `spec/`·`plan/`·
  `.claude/docs/`·`PROJECT.md`·`codebase/frontend/src`(+ `node_modules` symlink)를 복제해
  `repoRoot()` 오프셋이 그대로 성립하는 독립 미러를 만들고, 그 미러에서만 `spec/conventions/swagger.md`
  를 편집. 원본 워크트리는 전혀 건드리지 않았다(`cp` 로 미러 생성, `git restore`/`checkout` 미사용).
- backend 회귀: 워크트리 로컬 `codebase/backend/node_modules/.bin/jest` + `jest.config.ts` 로 변경된
  16개 컨트롤러에 대응하는 기존 `*.controller.spec.ts` 9개(94 테스트) + repo-guard
  `workspace-roles-attachment.spec.ts`(9 테스트)를 직접 실행. 추가로 `tsc --noEmit`(전체 프로그램)과
  `eslint`(변경 16파일 타겟)를 실행해 "내 탓 vs 선재" 를 실측으로 갈랐다.

## 발견사항

- **[WARNING]** `@ApiForbiddenResponse` 부착을 검증하는 테스트가 저장소에 전혀 없고, 이번 51건도
  추가하지 않았다 — "51건이 계속 51건으로 유지된다" 를 지키는 회귀 가드가 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/workspace-roles-attachment.spec.ts` (기존 테스트,
    수정 없음) / 이번 diff의 16개 컨트롤러 파일 전체 (예: `codebase/backend/src/modules/alerts/alerts.controller.ts:50`)
  - 상세: `grep -rl "ApiForbiddenResponse" --include="*.spec.ts" --include="*.test.ts"` 전수 검색 결과
    0건이다. 선행 P0 PR(`4c199813c`, "5개 컨트롤러 12곳에 `@ApiForbiddenResponse` 부착")도 테스트
    파일을 전혀 추가하지 않았다(`git show --stat 4c199813c` — 컨트롤러 5개만 변경). 그 PR 이 같은
    diff 에서 만든 유일한 회귀 가드 `workspace-roles-attachment.spec.ts` 는 `Reflect.getMetadata(ROLES_KEY, handler)`
    로 **`@Roles()`** 메타데이터 8곳만 고정하며, `@ApiForbiddenResponse`(Swagger 데코레이터, 별도
    메타데이터 키)는 검사하지 않는다. 이번 PR(`91edf4f6e`, 51건/16파일)도 컨트롤러 파일과 plan/spec
    문서만 바꿨을 뿐 테스트 파일은 0건이다(`git show --stat 91edf4f6e`).
  - plan(`plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` §2)이 "51건 확정"에 쓴
    **데코레이터 블록 파서**(triage 스크립트)는 codemod 실행 후 버려졌고 repo-guard 로 남지 않았다 —
    P0 PR 이 `@Roles()` 에 대해 한 것(reflection 기반 회귀 가드)과 대칭이 아니다. 이 변경 자체는
    런타임 동작이 0(Swagger 메타데이터만 추가, `RolesGuard.canActivate` 는 `@ApiForbiddenResponse`
    유무와 무관하게 항상 멤버십을 검사하므로 보안 동작에는 영향 없음)이라 **동작 회귀 테스트는
    불필요**하다는 판정에는 동의한다. 다만 "51곳 전부 부착됨" 이라는 **정적 불변식**은 다음 PR 이
    새 `@WorkspaceId()`-only 라우트를 추가하거나 기존 데코레이터를 실수로 지워도 어떤 테스트도
    잡지 못한다 — `workspace-roles-attachment.spec.ts` 와 같은 형태(reflection 기반, 리스트 고정)로
    `@ApiForbiddenResponse` 존재를 최소한 "이번에 건드린 16파일 51곳" 범위에서라도 고정하는 것이
    저비용·고가치 보완이다.
  - 제안: `workspace-roles-attachment.spec.ts` 패턴을 확장하거나 별도 repo-guard 를 추가해,
    "`@WorkspaceId()` 를 소비하고 `@Roles()` 가 없는 핸들러는 `@ApiForbiddenResponse` 메타데이터도
    갖는다" 를 최소한 이번에 고친 51곳(또는 전수 스캔 방식)에 대해 정적으로 고정한다. 완전한 전수
    파서가 부담스러우면 최소한 이번 16파일·51개 handler 목록만이라도 `describe.each` 로 리스트업해
    reflection 단언을 건다.

- **[WARNING]** "앵커 뮤테이션 검증" 주장은 절반만 사실이다 — 새로 추가한 앵커 인용 2곳 중
  **1곳(§5-4 체크리스트, 멀티라인 링크)은 `spec-link-integrity` 스캐너의 사각지대**라 뮤테이션이
  RED 를 내지 않는다
  - 위치: `spec/conventions/swagger.md:350` (`plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md:55`
    의 "앵커 실재는 뮤테이션으로 검증...RED 가 되는 것을 확인했다" 서술 및 커밋 `91edf4f6e` 메시지의
    동일 주장)
  - 상세: scratch 미러에서 두 앵커 인용(`swagger.md:350`·`swagger.md:398`)을 모두 존재하지 않는
    프래그먼트로 바꾸자 `spec-link-integrity.test.ts` 는 **RED** 가 됐다(`ANCHOR` 위반 1건,
    `line: 398`). 여기까지는 plan 의 주장과 일치한다. 그런데 `line: 398` 쪽만 정상 앵커로 되돌리고
    `line: 350` 쪽은 깨진 채로 둔 채 재실행하면 **13/13 GREEN** 으로 돌아간다 — 즉 `line 350`
    의 깨진 앵커는 이 가드가 절대 못 잡는다.
    원인은 `spec-links.ts` 의 `extractLinks()`(`codebase/frontend/src/lib/docs/__tests__/spec-links.ts:105-131`)
    가 **한 줄 단위**로 `LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g` 를 돌리기 때문이다. `swagger.md:349-350`
    은 `[data-flow §Rationale "멤버십 검증은 가드`(줄 349, `[` 만 있고 `]` 없음) →
    `1곳에서"](../data-flow/12-workspace.md#...)`(줄 350, `]`·`(` 만 있고 `[` 없음) 로 **링크 구문이
    두 줄에 걸쳐 쪼개진 멀티라인 링크**라, 어느 줄에서도 `LINK_RE` 가 매치하지 않는다. 반면 `line
    398` 은 같은 문장이 줄바꿈 없이 한 줄 전체이므로 정상 매치된다. 즉 plan 이 "2곳 다 검증했다" 고
    쓴 것과 달리, 실제로 뮤테이션-검증이 성립하는 곳은 **1곳뿐**이고 나머지 1곳은 처음부터 이
    가드로는 검증이 원천 불가능한 위치였다. (실제 현재 커밋 상태의 두 앵커 텍스트 자체는 맞게
    작성돼 있어 지금 당장의 문서 무결성 결함은 아니다 — 이건 "검증됐다" 는 **주장의 근거**가
    실제로 커버하는 범위에 대한 지적이다.)
  - 이 저장소가 이미 학습한 클래스(정적 정규식 vs 실제 문법 파서의 경계, blind-regex 가 멀티라인
    구조를 놓치는 패턴)와 같은 축이며, "GREEN 만 보고 검증됐다 하지 않는다" 는 원칙을 정확히
    지키려면 **RED 관측이 mutate 한 대상 전부(2곳)를 개별적으로 커버하는지**까지 확인했어야 한다.
  - 제안: (a) 이 특정 위치는 `swagger.md:349-350` 처럼 링크를 강제로 한 줄에 담거나 줄바꿈 위치를
    옮겨 매치 가능하게 만들거나, (b) `extractLinks()` 자체를 멀티라인 링크도 잡도록 보강(문서
    전체에 이런 줄바꿈 링크가 더 있을 수 있음 — 전수 재스캔 권장)한다. 최소한 이 PR 범위에서는
    "2곳 다 개별적으로 RED 확인" 을 재현해 두거나, 안 되면 그 사실을 plan/커밋 메시지에 정정해야
    "검증됐다" 는 주장이 실제 근거와 일치한다.

- **[INFO]** 이번에 손댄 16개 컨트롤러 중 7개는 컨트롤러 단위 스펙 자체가 없다(이 diff 로 생긴
  갭은 아님, 사전 상태)
  - 위치: `codebase/backend/src/modules/{alerts,dashboard,knowledge-base(graph),notifications,statistics,workflow-assistant}/*.controller.ts`,
    `codebase/backend/src/modules/integrations/integrations.controller.ts`
  - 상세: `find ... -iname "*.controller.spec.ts"` 로 확인한 결과 이 7개 컨트롤러는
    `*.controller.spec.ts` 가 아예 없다(나머지 9개는 있고 전부 GREEN, 아래 검증 참조). 이 PR 은
    데코레이터만 추가했으므로 이 갭을 만들지도, 넓히지도 않았다 — 새 결함으로 지적하는 것이
    아니라, "회귀 테스트 필요 여부" 판단의 배경으로만 남긴다.

## 검증 결과 (재현 실측)

1. **회귀 테스트 필요성** — 판정: **불필요(동작 회귀 관점)**, 다만 위 WARNING 처럼 **정적 불변식
   고정용 회귀 가드는 있는 편이 낫다.** 이 diff 는 `@nestjs/swagger` 데코레이터 51개 부착뿐이고
   `RolesGuard`/서비스 로직을 전혀 건드리지 않는다 — 실제 403 발생 여부는 이미 `RolesGuard` 가
   전역 `APP_GUARD` 로 강제하며, 그 동작은 `roles.guard.spec.ts`(296줄, P0 PR 에서 대폭 보강)와
   `workspace-roles-attachment.spec.ts` 가 이미 커버한다. `@ApiForbiddenResponse` 자체는
   OpenAPI 문서 생성에만 영향을 주고 HTTP 응답 코드에는 영향이 없으므로, 표준적인 "동작 변경
   → 테스트 추가" 요구는 성립하지 않는다.

2. **새 앵커 뮤테이션 검증 유효성** — 판정: **부분적으로 반증됨** (위 WARNING 상세 참조).
   scratch 미러에서 직접 재현한 결과 두 앵커 인용 중 1곳(line 398)만 실제로 뮤테이션-RED 가
   성립했고, 다른 1곳(line 350, 멀티라인 링크)은 어떤 뮤테이션을 넣어도 `spec-link-integrity` 가
   절대 감지하지 못한다(구조적 사각지대, 이번 diff 가 만든 결함이 아니라 기존 스캐너의 한계).
   "GREEN 만 보고 검증됐다 하지 않는다" 는 절차 자체는 옳지만, 실제로 관측한 RED 하나가 mutate 한
   2곳 모두를 대표하지 못했다.

3. **backend 테스트 회귀 여부** — 판정: **회귀 없음(실측 확인)**.
   - 변경된 16개 컨트롤러 중 기존 스펙이 있는 9개(`auth-configs`·`executions`·`background-runs`·
     `folders`·`llm-model-config`·`model-config`·`schedules`·`workflow-versions`·`workflows`)를
     로컬 `jest.config.ts` 로 직접 실행 → **9 suites / 94 tests 전부 PASS**.
   - `workspace-roles-attachment.spec.ts` (P0 PR 회귀 가드) → **9/9 PASS**, 영향 없음
     (애초에 `@Roles()` 만 검사하므로 이 diff 와 무관).
   - `tsc --noEmit`(백엔드 전체 프로그램) 결과를 16개 변경 파일명으로 grep → **0건 일치**. 즉
     이 diff 가 만든 타입 오류는 없다. `backend-lint-gate-broken-on-main.md` 가 추적하는 선재
     오류(테스트 파일 한정, ~209건, ratchet 으로 baseline 처리됨)는 전부 `*.spec.ts`/`*.e2e-spec.ts`
     소속이라 이번 컨트롤러 파일과 교집합이 없다 — "내 탓 아님" 이 실측으로 확인된다.
   - `eslint` 를 변경 16개 컨트롤러 파일에 직접 타겟 실행 → **0 errors, 0 warnings**.
   - 종합: plan 이 서술한 "재스캔 잔여 0건 / lint 0건 / 타입 오류 0건" 은 실측과 일치한다.

## 요약

이번 변경은 51개 `@ApiForbiddenResponse` Swagger 데코레이터 부착 + 문서 3곳 동기화로, 런타임 동작
회귀는 없고(실측: 기존 컨트롤러 스펙 94건 전부 GREEN, 타입/lint 0건) 그 판정 자체는 타당하다.
다만 두 가지 검증 절차상 허점이 있다. 첫째, `@ApiForbiddenResponse` 부착이라는 **정적 불변식**을
지키는 회귀 가드가 전무하다 — P0 PR 이 `@Roles()` 에 대해 만든 reflection 기반 가드
(`workspace-roles-attachment.spec.ts`)와 대칭되는 것이 이번엔 없어, 다음 PR 이 조용히 이 51곳
중 하나를 깨뜨리거나 새 갭 라우트를 추가해도 아무 테스트도 잡지 못한다. 둘째, "가짜 앵커
주입 → RED 확인" 이라는 뮤테이션 검증 주장은 scratch 미러 재현 결과 **절반만 참**이다 — 새로
추가한 앵커 인용 2곳 중 1곳(swagger.md:350, 멀티라인 마크다운 링크)은 `spec-link-integrity` 의
한 줄 단위 정규식 스캐너가 원천적으로 감지할 수 없는 구조라, 실제로 검증된 것은 1곳뿐이다.
현재 커밋된 텍스트 자체는 두 곳 다 올바르므로 지금 당장의 문서 결함은 아니지만, "검증됐다" 는
근거 자체가 과장돼 있다는 점은 테스트 유효성 관점에서 짚어야 한다.

## 위험도

MEDIUM
