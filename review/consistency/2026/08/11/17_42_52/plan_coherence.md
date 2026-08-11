# Plan 정합성 검토 — `spec/conventions` (impl-done, diff-base=origin/main)

## 검토 대상

- Target: `spec/conventions` 번들 (swagger.md·node-cancellation.md 등, diff-base `origin/main` 대비 최신)
- 1차 대조 plan: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md`
- 대조 산출물: `review/code/2026/08/11/17_21_33/*`(SUMMARY·RESOLUTION·6개 리뷰어) +
  `review/consistency/2026/08/11/17_21_43/*`(SUMMARY·5개 리뷰어)
- 확인 방법: HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/stop-editor-403-docs`)
  절대경로로 코드·spec·git log·review 산출물을 직접 대조. `spec-links.ts`(`extractLinks`) 소스,
  `executions.controller.ts`/`workflow-assistant.controller.ts`/`workflow-test-datasets.controller.ts`
  등 컨트롤러의 `@Roles`/`@ApiForbiddenResponse` 실측, 커밋 `91edf4f6e`/`165960a92`의 diff 대조.

## 1. §5-4 → §2-4 정정 확인

**정정됨, 원문도 실제로 401 을 요구한다.** `swagger.md §2-4 "상태 코드 응답 규칙"`(라인 534-547)은
표에 `401 인증 실패 | @ApiUnauthorizedResponse` 행을 두고 바로 아래 "보호된 엔드포인트는
기본적으로 `@ApiUnauthorizedResponse(...)`를 포함합니다" 라고 명시한다. plan 의 "후속" 절
(라인 3103-3105)은 이제 "swagger.md **§2-4**(상태 코드 응답 규칙)가 401 을 요구한다... 첫 판에
§5-4 라 적었으나 401 요구는 §2-4 소관 — plan_coherence 정정" 이라고 정확히 correction 을 반영했다.
직전 라운드 INFO 가 제대로 처분됐다.

## 2. plan 의 새 서술("리뷰 라운드가 잡은 것") 사실 검증

전부 실측과 일치했다 — 과장 발견 없음.

- **"세 리뷰어가 6건/3건/12건"**: `review/code/.../security.md`(WARNING, 6건 = workflow-assistant.controller.ts
  4핸들러 + agent-memory.controller.ts 2핸들러) · `api_contract.md`(WARNING, "동종 갭 3건" = 3개
  위치/파일 — workflows.controller.ts·agent-memory.controller.ts·knowledge-base.controller.ts) ·
  `review/consistency/.../convention_compliance.md`(INFO, "잔여 12곳" 상세 나열: workflow-test-datasets
  3 + workflows::graphWarnings 1 + workflow-assistant 4 + knowledge-base 1 +
  executions::simulateExecutionRunRedeliveryForTest 1 + agent-memory 2 = 12)로 각각 grep 확인.
  세 숫자 모두 실제 리뷰 문서와 정확히 일치한다.
- **"13건" 표**: `RESOLUTION.md`("내 실측 13")·커밋 `165960a92`(`git show --stat`)의 변경 파일별
  라인 수(agent-memory +2, executions +2, knowledge-base +1, workflow-assistant +4,
  workflow-test-datasets +3, workflows +1 = 13)가 정확히 일치. `executions.controller.ts`
  "테스트 훅 2종 | owner"도 코드로 직접 확인 — `triggerStuckRecoveryForTest`/
  `simulateExecutionRunRedeliveryForTest` 둘 다 `@Roles('owner')` + 이제
  `@ApiForbiddenResponse({ description: 'owner 이상 권한 필요' })` 보유. convention_compliance
  의 12건 목록엔 이 중 1개(`simulateExecutionRunRedeliveryForTest`)만 있어 plan 의 13번째 항목이
  정확히 그 차이(`triggerStuckRecoveryForTest` 추가 발견)를 설명한다 — 내적 정합.
  역할 라벨(editor/viewer/owner)도 각 컨트롤러 소스와 전부 일치(workflow-test-datasets=editor,
  agent-memory=viewer, workflows::graphWarnings=viewer, workflow-assistant=editor).
- **"6건/6파일" 멀티라인 링크 사각지대**: `spec-links.ts`의 `extractLinks()`가 `text.split(/\r?\n/)`
  로 줄 단위 순회 후 각 줄에만 `LINK_RE`를 돌리는 것을 직접 확인 — 링크 텍스트가 줄바꿈을
  넘으면 원천적으로 못 잡는 구조가 맞다. `swagger.md:350`은 커밋 `91edf4f6e`(fix 이전)에서
  `[data-flow §Rationale "멤버십 검증은 가드\n      1곳에서"](...)` 형태의 멀티라인 링크였음을
  `git show 91edf4f6e -- spec/conventions/swagger.md`로 확인했고, 현재는 한 줄로 펴져 있다
  ("이번에 해소"와 일치). 타이트한 정규식(`\[[^\[\]\n]*\n[^\[\]\n]*\]\(`)으로 저장소 전수를
  재스캔하면 현재 잔존 5개 파일(database-query·1-auth·4-security·secret-store·12-workspace)이
  나와, swagger.md 를 더하면 정확히 6파일이 된다.
- **뮤테이션 3줄 표(350 멀티라인=GREEN / 350 한줄=RED / 398=RED)**: `extractLinks`의 줄 단위
  구조와 정확히 부합하는 결과이고, `RESOLUTION.md`/커밋 메시지의 서술과도 일치한다.

## 3. 체크박스 상태

모두 실제 상태와 일치한다.

- `[x]` 항목(§1 표 3곳 Editor+ 반영, §2 51+13건 부착, §3 앵커 2곳)은 `spec/3-workflow-editor/3-execution.md:178,336`,
  `swagger.md §5-4`, 각 컨트롤러 소스로 직접 재확인 — 전부 실제로 반영돼 있다.
- 남은 `[ ]`는 두 종류:
  1. `/consistency-check --spec` (본문 체크리스트) — **정당하게 열려 있다.** 이번 세션 자체가
     `--impl-done` 모드(prompt 헤더 "구현 완료 후 검토")이고, `plan/in-progress/`를 훑어도
     이 plan 에 대한 `--spec` 세션 산출물은 없다(있는 것은 `17_21_43`·`17_42_52` 두 impl-done
     라운드뿐). `spec/` 3개 파일은 이미 커밋됐으므로(`91edf4f6e`/`165960a92`) CLAUDE.md 의
     "planner 는 `spec/` 쓰기 **직전** `--spec` 의무" 순서상으론 사후가 되지만, plan 자체는
     이를 숨기지 않고 미체크로 남겨 정직하게 반영하고 있다. 이 plan 이 `complete/`로 넘어가기
     전 반드시 수행해야 할 잔여 게이트다.
  2. "후속(이 티켓 범위 밖, 등재만)" 2건 — 아래 §4 참조.

## 4. 후속 2건 등재 위치 판정

### [WARNING] `spec-link-integrity` 멀티라인 링크 사각지대는 harness 계열 plan 이 더 적절한 자리다

- target 위치: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` "## 후속(이
  티켓 범위 밖, 등재만)" 첫 항목(라인 3096-3102)
- 관련 plan: `plan/in-progress/harness-review-gate-followups.md` "## 미해결 항목" 첫 줄
  — `spec-impl-evidence.md §4.2 가 링크 위생 책임을 없는 곳에 돌리고 있다` (2026-08-10 실측,
  `plan-coherence-checker`가 링크 위생을 담당한다고 문서가 잘못 서술하는 문제 — 즉 이 결함과
  **같은 가드(`spec-link-integrity.test.ts`/`spec-links.ts`) 계열의 다른 결함**)
- 상세: 이번에 발견된 결함(줄 단위 정규식이라 `[`와 `](`가 다른 줄에 있으면 링크·앵커
  검증이 통째로 건너뛰어짐, 저장소 전수 6건/6파일)은 **하니스/테스트 인프라 결함**이고
  `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 수정이 필요하다. 반면
  `spec-sync-stop-editor-and-forbidden-routes.md`는 P3 spec-doc-sync(swagger 403 문서화)
  티켓으로 `owner: project-planner`, `spec_impact`에 swagger.md·node-cancellation.md·
  3-execution.md만 등재돼 있다. 이 harness 결함은 그 스코프·오너십 어느 쪽과도 맞지 않고,
  swagger.md 는 우연히(자기 앵커가 멀티라인이라) 이번 세션에서 이미 해소됐을 뿐 나머지 5파일
  (`database-query.md`·`1-auth.md`·`4-security.md`·`secret-store.md`·`12-workspace.md`)은
  이 티켓의 관심사와 무관한 문서들이다. 반면 `harness-review-gate-followups.md`는 이미
  같은 가드의 다른 결함(책임 소재 오기)을 추적 중이라 **두 발견을 한곳에서 봐야 재발을 막는다**
  — 두 항목을 따로 두면 다음에 이 가드를 손대는 사람이 한쪽만 보고 "고쳤다"고 판단할 위험이
  있다(이 저장소가 이미 "자매를 각각 처리하지 않으면 재발한다" 교훈을 여러 번 등재했다).
  또한 `spec-sync-stop-editor-and-forbidden-routes.md`는 P3 로 lifecycle 상 곧 `complete/`로
  이동할 성격의 소규모 티켓이라, 그 안에 남으면 harness/docs-guard 작업을 하는 사람이
  발견할 가능성이 낮다("review/ 는 SoT 아님 — 미룬 항목은 plan/ 에 적어라"는 이 저장소의 기존
  교훈이 "어느 plan/ 파일이냐"까지는 다루지 않는데, 이번 사례가 그 경계 사례다).
- 제안: 이 항목을 `harness-review-gate-followups.md`의 "미해결 항목"(또는 그 파일의 신규
  후속 섹션)으로 옮기고, `spec-sync-stop-editor-and-forbidden-routes.md`에는 "harness plan 으로
  이관, 상세는 그쪽 참조" 정도의 포인터만 남길 것을 권한다. 다만 항목 자체가 사실이고
  실측도 정확하므로 **어디에도 등재하지 않는 것보다는 지금 위치가 훨씬 낫다** — WARNING 등급도
  "옮겨야 한다"이지 "등재 자체가 틀렸다"가 아니다.

### 확인 — `workflow-assistant.controller.ts` 401 누락 후속은 제자리가 맞다

- target 위치: 같은 절 두 번째 항목(라인 3103-3105, §1의 3006도 동일 내용의 초기 버전)
- 이 항목은 이 티켓이 직접 건드린 파일(`workflow-assistant.controller.ts`)의, 이 티켓이 다루는
  것과 같은 데코레이터 계열(`@Api*Response`) 갭이고, §2-4(본문 조항)에 대한 순수 소급 정리라
  스코프·오너십 모두 이 plan 과 맞는다. 이관 불필요.

## 요약

target(`spec/conventions` 번들)의 이번 라운드 변경은 직전 라운드 INFO(§5-4→§2-4 인용 오류)를
정확히 정정했고, plan 에 새로 추가된 "리뷰 라운드가 잡은 것" 절의 모든 수치·표(6/3/12건,
13건 테이블, 6건/6파일, 뮤테이션 3줄 표)는 review/ 산출물·git 이력·현재 코드 상태와 전수
대조한 결과 과장이나 왜곡 없이 사실이었다. 체크박스는 실제 상태와 일치하며 남은 미해결
항목도 정당하다. 유일한 개선점은 후속 2건 중 `spec-link-integrity` 멀티라인 링크 사각지대가
이 P3 spec-doc-sync 티켓보다 이미 같은 가드 계열 결함을 추적 중인
`harness-review-gate-followups.md`에 등재되는 편이 스코프·오너십·향후 발견 가능성 면에서
더 적절하다는 것 — CRITICAL 급 미해결 결정 충돌이나 선행 plan 미해소는 발견되지 않았다.

## 위험도

LOW

STATUS: OK
BLOCK: NO
