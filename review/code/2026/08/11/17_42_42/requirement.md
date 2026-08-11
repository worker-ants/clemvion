# 요구사항(Requirement) 리뷰 — `spec-sync-stop-editor-and-forbidden-routes` §1·§2·§3 이행

## 검증 방법

전 41개 파일(백엔드 컨트롤러 19개 · plan 1개 · spec 3개 · 이전 리뷰 라운드(`17_21_33` 코드 6 +
`17_21_43` consistency 5) 산출물 20개)을 읽었다. 프롬프트가 크기 제한으로 생략한 전체 파일
컨텍스트(`integrations.controller.ts`, `workflows.controller.ts`, `3-execution.md`,
`node-cancellation.md`, `swagger.md`, plan 본문)는 `Read`로 워크트리에서 직접 열어 대조했다.

수치 검증은 **직접 재구현**했다 — 티켓·plan·기존 리뷰어가 쓴 스캐너를 신뢰하지 않고, 독립
Python 데코레이터-블록 파서(줄 단위 괄호 깊이 추적 + `//` 라인 코멘트 스킵 + 코멘트 전용 청크
투명화)를 새로 작성해 `codebase/backend/src/modules/**/*.controller.ts` **35개 파일 전체**를
재스캔했다. (1차 구현은 `//` 주석 내부의 `"` 를 문자열 시작으로 오인하는 버그가 있어
`workflows.controller.ts` 라우트 수를 8로 저계수했다 — `get_class_body` 에 라인 코멘트 스킵을
추가해 수정 후 재검증.)

## 발견사항

- **[INFO]** plan 의 핵심 수치가 독립 재구현으로 전부 확인된다.
  - 위치: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md:82,87` (전체 라우트
    222 / 대상 51), `:48-49`(§5-4 술어 64건), `:147`(§5-4 술어 기준 잔여 0건)
  - 상세: 독립 스캐너로 저장소 전체 35개 컨트롤러를 재스캔한 결과 — 전체 라우트 **222**(일치),
    `@WorkspaceId()` 소비 **142**(plan 표기 141 과 ±1, 아래 참조), `@Roles()` 있음 **76**(plan
    표기 75 와 ±1), 대상(둘 다 없음, 수정 전 상태 기준) **51**(일치), §5-4 술어(`@Roles()` OR
    `@WorkspaceId()` 소비) AND `@ApiForbiddenResponse` 부재 — 수정 후 **잔여 0건**(일치). 별도로
    `git diff origin/main...HEAD -- codebase/backend/src | grep -c '^+.*@ApiForbiddenResponse('`
    로 실제 추가된 데코레이터 줄만 세면 정확히 **64줄**(삭제 0줄)이고, description 문자열
    분포는 `워크스페이스 멤버가 아님` 51 + `editor 이상 권한 필요` 8 + `owner 이상 권한 필요`
    2 + `viewer 이상 권한 필요` 3 = 64 — plan §2 "리뷰 라운드가 잡은 것" 표(workflow-assistant
    4/workflow-test-datasets 3/agent-memory 2/executions 2/knowledge-base 1/workflows 1 = 13)와
    역할별로 정확히 일치한다(editor 4+3+1=8, owner 2, viewer 2+1=3). §5-4 술어 기준 잔여 0건도
    35개 컨트롤러 전체(19개 touched 파일뿐 아니라 미변경 16개 파일 포함)를 재스캔해 확인했다 —
    이번 PR 밖의 컨트롤러에도 §5-4 미충족 라우트가 남아있지 않다.
  - `141/75` vs `142/76` 의 ±1 은 plan·`documentation`·`plan_coherence`(round 1) 가 이미 각각
    독립적으로 발견해 INFO 로 남긴 것과 동일한 지점이며, 포함-배제 산식(`142−76−79+64=51`)으로
    최종 결론(51/0)에는 영향이 없음을 재확인했다. 새로운 결함이 아니라 기존 INFO 의 재검증이다.
  - 제안: 조치 불요 — 확인만 목적.

- **[INFO]** §2 를 규약(§5-4) 술어로 확장한 것은 스코프 초과가 아니라 티켓 자신의 트리거를
  이행한 것이다.
  - 위치: `spec/conventions/swagger.md:347-350`(§5-4 원문), `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md:70-71`("§2 의 트리거: `swagger.md §5-4` 가 P0 PR 에서
    확장됐으므로...")
  - 상세: `swagger.md` §5-4 원문을 직접 읽었다 — `"@Roles(...)` 가 붙었거나 `@WorkspaceId()` 를
    소비하는 엔드포인트는 `@ApiForbiddenResponse` 도 추가"`(OR 조건). 반면 티켓 §2 체크리스트
    원문(수정 전, 이번 diff 의 `-` 라인)은 `"@WorkspaceId()` 소비 **&&** `@Roles()` 부재"`로
    §5-4 보다 **좁은** AND 술어를 썼다. plan Rationale 이 스스로 "§2 의 트리거가 §5-4 확장"이라고
    명시하는 이상, §5-4 의 실제 OR 조건 전체를 충족시키는 것이 티켓의 존재 이유를 정확히
    이행하는 것이지 확장이 아니다. 실제로 13건 전부 `@Roles()` 는 있지만 `@ApiForbiddenResponse`
    가 전혀 없는 라우트였고(`RolesGuard` 는 `@Roles()` 유무와 무관하게 멤버십을 검증하므로 이
    13건도 실제로 403 을 낼 수 있다 — round 1 `api_contract`/`security` 리뷰어가
    `roles.guard.ts:97-147` 를 직접 추적해 확인), §5-4 문언 그대로다.
  - 제안: 없음 — 판정 확인 목적.

- **[INFO]** spec 3곳(§1) 서술이 실제 코드·규약과 line-level 로 일치한다.
  - 위치: `spec/3-workflow-editor/3-execution.md:178`(신규 "권한" 행), `:336`(`/stop` 행
    `Editor+` 부기), `spec/conventions/node-cancellation.md:63`("Editor+ 전용" 문구)
  - 상세: `codebase/backend/src/modules/executions/executions.controller.ts:121-137` 의 `stop`
    핸들러에 `@Roles('editor')`(122)와 기존 `@ApiForbiddenResponse({ description: 'editor 이상
    권한 필요' })`(137, 이번 diff 밖 — P0 PR 에서 이미 부착)가 실재함을 확인했고,
    `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:82`
    (`const canEdit = useHasRole("editor")`)와 `:493`(`{canEdit && isCancellable &&
    executionId && (...)}`)로 FE 가드도 실재를 확인했다. 인용 근거
    `1-auth.md §3.2`(`Workflow 실행` 행)도 `spec/5-system/1-auth.md:373` 에
    `| Workflow 실행 | ✅ | ✅ | ✅ | — |`(Owner/Admin/Editor/Viewer)로 실재한다.
  - 제안: 없음 — spec 이 코드보다 4개월 먼저 존재했음도 round 1 `rationale_continuity` 가
    `git blame`/`git log -S` 로 확인했다(§3.2 는 `ca227cc36` 2026-03-26, `@Roles('editor')` 는
    `8d84f6e9f4` 2026-08-08) — spec 이 코드의 사후 정당화가 아니라 선행 결정의 파생 반영이다.

- **[INFO]** `swagger.md` 앵커 2곳(§3)이 실제 대상 헤딩과 GitHub 슬러그까지 정확히 일치한다.
  - 위치: `spec/conventions/swagger.md:350,398`(앵커 추가 지점), `spec/data-flow/12-workspace.md:313`
    (대상 헤딩)
  - 상세: 대상 헤딩 `### 멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관 (2026-08-08)`을 GitHub
    슬러그 규칙(소문자화·백틱/`@`/괄호/em-dash 제거·공백→`-`, em-dash 자리엔 좌우 공백이 남아
    `--`)으로 직접 산출하면 `멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08` — 두 앵커에
    쓰인 프래그먼트와 정확히 일치. 동일 헤딩 중복도 없다(`grep -c` 1건)
    (`spec/data-flow/12-workspace.md`).
  - 제안: 없음. (참고: round 1 리뷰가 처음 냈던 "뮤테이션으로 검증했다"는 주장이 두 앵커를
    동시에 바꿔 하나의 RED 만 보고 판단한 결함이었고, 이는 이미 plan
    `:161-178`·`review/code/.../17_21_33/RESOLUTION.md` 에서 격리 재검증으로 스스로 정정한
    이력이 있다 — 코드/spec 결함이 아니라 검증 방법론 결함이었고, 이미 처분됐다.)

- **[INFO]** 남은 `[ ]` 2건은 타당하게 스코프 밖으로 등재됐다.
  - 위치: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md:62`
    (`/consistency-check --spec`), `:195-196`(`workflow-assistant.controller.ts` 3라우트
    `@ApiUnauthorizedResponse` 부재, `swagger.md §2-4` 소관)
  - 상세: `grep -n '^\s*- \[ \]'` 로 plan 전체를 스캔한 결과 이 2건이 전부다. 전자는
    "spec 본문 편집 → `--spec` 게이트 의무"(CLAUDE.md)를 지키는 정상 pending 상태이고(이번 코드
    리뷰 시점엔 아직 돌기 전이라 미체크가 맞다), 후자는 이 티켓이 403 전용으로 스코프를 명시
    (§1·§2·§3 어디에도 401 요구는 없음)했으므로 401 갭은 별도 후속으로 분리한 것이 맞다 — §2-4
    가 401 을, §5-4 가 403 을 각각 요구하는 서로 다른 절이라는 것도 `swagger.md:534-547`(§2-4)
    · `:343-354`(§5-4)를 직접 대조해 확인했다.
  - 제안: 없음.

- **[INFO]** TODO/FIXME/HACK/XXX, `@Public()` 라우트 오염, drive-by 없음 — 확인만.
  - 상세: `git diff origin/main...HEAD -- codebase/backend/src spec/ plan/` 의 추가 줄에서
    `TODO|FIXME|HACK|XXX` 매치 0건. 이번 diff 가 건드린 19개 컨트롤러 중 `@Public()` 을 가진
    파일은 0개(`integrations/third-party-oauth.controller.ts` 에 `@Public()` 이 있으나 이 PR
    이 건드리지 않은 별도 파일). `git diff --shortstat -- codebase/backend/src` =
    `19 files changed, 74 insertions(+), 2 deletions(-)` — 74 는 데코레이터 64줄 + import 6줄
    + `llm-model-config.controller.ts:118-122` 주석 정정 4줄이고, 삭제 2줄은 그 주석 정정
    (구 정책 문구 삭제)뿐이다. 나머지는 순수 추가.

## 요약

`/executions/:id/stop` 의 Editor+ 권한을 파생 spec 문서 3곳에 동기화하고(§1), 저장소 전체
`@ApiForbiddenResponse` 소급 부착을 규약(`swagger.md §5-4`) 술어 기준으로 완결(§2, 51+13=64건),
`swagger.md` 교차링크 앵커 2곳을 정정(§3)하는 순수 문서·API-문서 동기화 PR 이다. plan 이 주장한
모든 핵심 수치(전체 라우트 222 · 대상 51 · §5-4 술어 확장분 13 · 최종 §5-4 잔여 0)를 티켓·plan·
기존 리뷰어의 스캐너를 재사용하지 않고 처음부터 다시 작성한 독립 파서로 저장소 35개 컨트롤러
전체(diff 대상 19개뿐 아니라 미변경 16개 포함) 재스캔해 확인했으며, `git diff` 라인 카운트·
description 문자열 역할별 분포로도 교차 검증했다 — 전부 일치한다. §2 를 티켓 원문(`@Roles()`
부재)보다 넓은 규약 술어(`@Roles()` 있거나 `@WorkspaceId()` 소비)로 확장한 것은 §5-4 원문과
plan 자신의 Rationale("§2 의 트리거가 §5-4 확장")을 근거로 판단할 때 스코프 초과가 아니라 티켓의
존재 이유를 정확히 이행한 것이다. spec 3곳의 서술은 실제 백엔드 `@Roles('editor')`·FE `canEdit`
가드·`1-auth.md §3.2` 매트릭스와 line-level 로 일치하고, 신규 앵커 2곳도 대상 헤딩의 GitHub
슬러그와 정확히 일치한다. 남은 `[ ]` 2건(`--spec` 게이트, 401 갭 후속)은 모두 정당하게 스코프
밖으로 분리·등재된 상태다. TODO/FIXME 류 미완성 표식, `@Public()` 라우트 오염, drive-by 리팩터링
모두 발견되지 않았다. 억지로 만든 결함은 없으며, CRITICAL/WARNING 급 요구사항 불충족을 찾지
못했다.

## 위험도

NONE

STATUS: OK
