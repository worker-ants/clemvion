# 정식 규약 준수 검토 — 라운드 2 (`swagger.md §5-4` 잔여 13건 fix + INFO 2건 처분 재검증)

검토 대상: 직전 라운드(`review/consistency/2026/08/11/17_21_43`)가 발견한 **잔여 12건**(직접 재계산 시 13건)과
INFO 2건(`Editor+` bold, §5-4→§2-4 인용)에 대한 fix 커밋(`165960a92`)의 처분 결과. 기준 diff:
`git diff origin/main...HEAD`(commit `91edf4f6e` + `165960a92`, docs-only 커밋 `7977f5c81` 제외).

## 검증 방법

- **HEAD 워킹트리를 절대경로로 직접 스캔** — 프롬프트 번들이 `<git diff origin/main...HEAD -- code_areas>`
  자체를 컨텍스트 예산 초과로 드롭했으므로, 번들 내용을 신뢰하지 않고
  `git -C stop-editor-403-docs diff origin/main...HEAD`, `git show <commit>`, `Read` 로 독립 재확인했다.
- §5-4 술어(`@Roles(...)` 보유 **또는** `@WorkspaceId()` 소비 → `@ApiForbiddenResponse` 필수)를 코드로
  재구현해 `codebase/backend/src/modules/**/*.controller.ts` 35개 파일 · 222개 라우트 전수를 독립 스캔
  (HTTP verb 데코레이터부터 다음 라우트 데코레이터 직전까지를 블록으로 파싱 — 데코레이터가 verb 데코레이터
  *뒤에* 온다는 사실을 놓쳐 첫 스크립트가 오탐 145건을 냈고, 파싱 방향을 고쳐 재실행함).
- fix 커밋(`165960a92`)이 처분했다고 주장하는 13건 각각을 diff 로 열어 `@Roles(<role>)` 인자와
  신규 `@ApiForbiddenResponse({ description: '<role> 이상 권한 필요' })` 의 role 문자열이 실제로
  일치하는지 대조.
- `Editor+` bold 관련해 직전 라운드 원문(`17_21_43/convention_compliance.md` 발견사항 1번)을 재조회해
  "무엇이 기준선이었는지"를 재확인(내가 실제로 지적한 대상이 어느 파일·어느 형태였는지).
- `spec/5-system/1-auth.md §3.2` 표를 직접 열어, 새로 정정된 인용("Owner/Admin/Editor ✅, Viewer —")이
  실제 표 값과 정확히 일치하는지 대조.

## 발견사항

- **[INFO] 401→403→404 배치 순서 — 규약 명문화는 별도 티켓으로 (재확인)**
  - target 위치: `spec/conventions/swagger.md` §2-4 "상태 코드 응답 규칙" 표
  - 위반 규약: 없음 — §2-4 는 각 상태 코드에 대응하는 데코레이터만 정의하고, 컨트롤러 안에서의
    나열 순서를 규정하지 않는다.
  - 상세: 이번 라운드에서 신규 13건이 추가되며 401→403→404 오름차순 준수 사례가 51건 → **64건**으로
    늘었다(예외 0건 유지 — 신규 13건 중 `@ApiUnauthorizedResponse` 자체가 없는
    `executions.controller.ts` 테스트 훅 2건은 순서를 어길 여지 자체가 없어 배치 규칙과 무관하다).
    직전 라운드가 이미 이 제안을 냈고 "이 티켓 범위 밖" 으로 명시적으로 무조치 처리했다
    (`17_21_43/SUMMARY.md` "무조치" 섹션). 이번 fix 커밋도 이 INFO 는 건드리지 않았다 —
    일관된 판단이다.
  - 제안: 64/64 무예외가 재확인됐으니 **언젠가는** `swagger.md §2-4` 표 아래 "데코레이터는
    표의 status 오름차순으로 나열한다" 한 줄을 추가할 가치가 있다. 다만 **지금 이 PR 에서는
    하지 말 것을 권한다** — (1) 이 PR 의 plan 자체가 Overview 에서 "spec 을 한 줄이라도 더
    건드리면 방금 통과한 `--impl-done` 이 다시 stale 이 돼 사이클이 한 번 더 열린다" 는 이유로
    범위를 좁혔는데, 신규 규범 문장 추가는 그 우려가 그대로 적용되는 종류의 변경이다.
    (2) 새 규범 한 줄은 그 자체로 `## Rationale` 근거를 요구하는 이 저장소의 SDD 관행과
    맞물려 별도 검토 사이클을 여는 편이 깨끗하다. 별도 P3 plan 항목으로 등재 권장.

## 확인했으나 문제 없음 (질문 1~3 직접 검증 결과)

- **질문 1 — 잔여 12건 전부 포함 + §5-4 술어 기준 잔여 0, 직접 확인**: 독립 파서로 222개 라우트를
  재스캔한 결과 `(@Roles() 있음 OR @WorkspaceId() 소비) AND @ApiForbiddenResponse 없음` 조건을
  만족하는 라우트는 **0건**이다. 직전 라운드가 이름으로 지목한 12건
  (`workflow-test-datasets.controller.ts` list/create/clone·`workflows.controller.ts::graphWarnings`·
  `workflow-assistant.controller.ts` create/update/remove/sendMessage·
  `knowledge-base.controller.ts::uploadDocument`·`executions.controller.ts::simulateExecutionRunRedeliveryForTest`·
  `agent-memory.controller.ts` listScopes/listMemories) 는 diff 에서 전부 `@ApiForbiddenResponse` 추가를
  확인했다. 13번째(`executions.controller.ts::triggerStuckRecoveryForTest` — `simulateExecutionRunRedeliveryForTest`
  바로 옆 테스트 훅으로, 직전 라운드가 놓친 항목)도 fix 커밋에서 함께 처분됐다. "12건" 이 직전 라운드의
  과소 계수였다는 fix 커밋의 자기 진단은 정확하다.
- **질문 2 — 신규 13건 설명 문자열의 §5-4 준수 + 표현 난립 여부**: 3개 role 변형
  (`'owner 이상 권한 필요'`×2, `'editor 이상 권한 필요'`×8, `'viewer 이상 권한 필요'`×3) 을 각 라우트의
  실제 `@Roles(<role>)` 인자와 1:1 대조한 결과 전부 일치한다(예: `agent-memory.controller.ts` listScopes/
  listMemories 는 `@Roles('viewer')` → `'viewer 이상 권한 필요'`, `executions.controller.ts` 테스트 훅
  2종은 `@Roles('owner')` → `'owner 이상 권한 필요'`, `workflow-assistant.controller.ts` 4곳은
  `@Roles('editor')` → `'editor 이상 권한 필요'`). §5-4 원문이 예시로 든 템플릿("`editor` 이상 권한
  필요"처럼)을 role 파라미터만 바꿔 그대로 적용한 것이라 **표현 난립이 아니라 규약의 정확한 인스턴스화**다.
  저장소에 남아 있는 `'관리자 권한 필요'`(`alerts.controller.ts` 3곳)·`'Admin 미만 권한'`
  (`auth-configs.controller.ts` 5곳)은 이번 PR 이 건드리지 않은 **기존(pre-existing) 표현**이고 diff 에
  `+`/`-` 로 나타나지 않는다 — 이번 PR 이 이 이질성을 새로 만들거나 키우지 않았다.
- **질문 3 — `Editor+` bold 정정이 선례와 일치하는가**: 직전 라운드가 실제로 지적한 대상은
  `spec/3-workflow-editor/3-execution.md:178` 의 **표 행** `| 권한 | **Editor+** — ... |` 뿐이었다
  (같은 표의 인접 행 전부 non-bold 라 국소적으로도 이질적이라는 근거). `spec/conventions/node-cancellation.md`
  의 **서술문** `**Editor+ 전용**이다` 는 직전 라운드 원문이 "문장 서술형이라 bold 가 자연스럽다"고
  명시적으로 구분해 대상에서 제외했다. fix 커밋은 정확히 그 표 행만 plain 으로 낮췄고
  (`spec/5-system/13-replay-rerun.md:482` 의 `| 권한 | RR-PL-06 — ... Editor+ |` 선례와 이제 동형),
  서술문 쪽은 손대지 않았다 — **지적된 범위와 정확히 일치하는 처분**이며 남겨진 bold 도 의도된 것이다.

## 요약

fix 커밋(`165960a92`)은 직전 라운드가 지목한 항목을 정확한 범위로 처분했다. §5-4 술어를 코드로
재구현해 222개 라우트를 독립 재스캔한 결과 `@Roles()` 보유 또는 `@WorkspaceId()` 소비 라우트 중
`@ApiForbiddenResponse` 가 없는 곳은 0건이며, 신규 3종 설명 문자열(`owner`/`editor`/`viewer` 이상
권한 필요)은 모두 해당 라우트의 실제 `@Roles()` 인자와 정확히 일치해 §5-4 템플릿의 올바른 인스턴스화다
— 저장소에 남은 이질적 표현(`관리자 권한 필요`/`Admin 미만 권한`)은 이번 PR 이전부터 있던 별개 항목이라
새로운 표현 난립이 아니다. `Editor+` bold 정정도 직전 라운드가 실제로 지목한 표 행에만 정확히 적용됐고,
서술문의 bold 는 애초에 지적 대상이 아니었으므로 남아 있어도 문제가 아니다. 유일한 미결 사안은
401→403→404 배치 순서를 `swagger.md` 에 명문화할지 여부인데, 이번 라운드로 무예외 사례가 64건으로
늘어 규약 승격의 근거는 더 튼튼해졌지만, 이 PR 의 스코프 원칙(spec 추가 편집으로 리뷰 사이클을 다시
열지 않는다)과 일관되게 **별도 티켓으로 미루는 것을 권장**한다(INFO, 비차단). CRITICAL/WARNING 급
위반은 발견되지 않았다.

## 위험도

NONE

BLOCK: NO
STATUS: OK
