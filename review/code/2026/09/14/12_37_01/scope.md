# 변경 범위(Scope) 리뷰 — trigger-canary-hardening (라운드 4)

## 검토 방법

`plan/in-progress/trigger-canary-hardening.md` 가 선언한 4개 항목(① 트리거 비밀 컬럼 3중 사본
repo-guard, ② `TriggerDto.workflow`(schedule) 양성 커버리지, ③ 캐너리 두 파일 주석 정리, ④ e2e
teardown 근거 정정)을 기준으로, `git diff origin/main...HEAD` 전량(76개 파일, +5481/-27)의 각
파일이 그 4개 항목 또는 harness 필수 산출물(consistency-check, ai-review 리포트) 중 어디에
대응하는지 1:1로 대조했다. 신설 파일 2개(`trigger-secret-columns-{guard.ts,spec.ts}`)는 전체
내용을 직접 `Read` 했고, 5,000줄이 넘는 트래커(`spec-draft-nullable-notation-followups.md`)의
diff hunk 도 전부 확인했다.

## 발견사항

- **[INFO]** 정합 확인 — `codebase/**` 코드 diff(6개 파일, +369/-23)는 전부 plan 이 선언한 4개
  항목 중 정확히 하나에 대응하고, 그 밖의 파일·영역을 건드리지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`(신규,
    항목①), `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts`(신규,
    항목①), `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`(항목③ — 원문자
    →아라비아 숫자 통일 + 자기수정 이력 문단 제거 + 의역 표기 추가, docstring 2개 hunk 에
    국한), `codebase/backend/test/schedule-trigger.e2e-spec.ts`(항목②, `expectTriggerWorkflowRef`
    3곳: C-2 목록·G/H PATCH), `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`
    및 `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`(항목④, `afterAll` JSDoc 정정 —
    실제 정리 로직은 `git diff` 상 무편집).
  - 상세: `readStringArrayConst`/`readAllTriggerSecretColumnLists` 신규 함수는 plan 항목①이
    요구한 "3중 사본 정합 검증" 그 자체이고, 호출부·상수(`CANONICAL_SOURCE`/`MIRROR_SOURCES`
    등)도 정본(`triggers.service.ts`)·사본 2곳(`schedule-trigger-ref.ts`,
    `trigger-workflow-ref.ts`)만 참조한다 — 범위 밖 파일을 건드리지 않는다.
    `schedule-trigger.e2e-spec.ts` 의 import 추가(`expectTriggerWorkflowRef`)는 3개 신규 호출
    지점에서 실사용되어 미사용 임포트가 아니다. `trigger-workflow-ref.ts`/
    `schedule-trigger-ref.ts`(헬퍼 본체)는 이번 diff 에 포함되지 않았다(`git diff --stat` 로
    확인) — 헬퍼 시그니처 변경 없이 기존 export 를 재사용만 한다.
  - 판단: 범위 이탈 없음.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커, 5,000줄+)의
  185줄 diff 는 전부 해당 4항목의 체크박스 전환(`[ ]`→`[x]`) + 실측 각주이거나, **권한 밖
  발견을 직접 고치지 않고 새 트래커 항목으로만 등재**한 부분이다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` — 신규 5항목
    (`secret-store.md §R4` 오기, `2-trigger-list.md` `code:` 갭, repo-guard `code:` 미등재,
    단건 조회 커버리지, harness 번들 절단, `_overview.md` frontmatter 상호참조, `__` 표기)
    전부 `planner`/`harness` owner 로 등재만 되고 `[ ]` 상태 유지.
  - 상세: 이 5,000줄 문서의 다른 구간(다른 날짜 등재 항목들)은 diff 에 나타나지 않는다 —
    편집이 해당 4항목 구간(L3932~L4200 부근)에만 국한됨을 `git diff` 로 확인했다. `spec/**`
    편집이 developer 권한 밖이라는 CLAUDE.md 경계를 정확히 지켰다 — consistency-checker 가
    지적한 `secret-store.md §R4` 오기·`_overview.md` frontmatter 등을 직접 고치지 않고
    등재만 한 것은 범위 이탈이 아니라 오히려 경계 준수의 증거다.
  - 판단: 범위 이탈 없음.

- **[INFO]** `review/code/2026/09/14/{11_27_40,11_52_13,12_17_14}/**`(라운드 1~3 `/ai-review`
  산출물, 33개 파일)와 `review/consistency/2026/09/14/{10_44_37,11_27_47,11_52_23,12_17_21}/**`
  (`--impl-prep`/`--impl-done` 4회, 37개 파일) 커밋은 코드 변경이 아니라 CLAUDE.md 가 규정한
  "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 이행의 산출물이다.
  - 위치: `review/code/2026/09/14/**`, `review/consistency/2026/09/14/**`
  - 상세: CLAUDE.md 는 코드 리뷰/일관성 검토 산출물의 저장 위치를
    `review/code|consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 로 명시하고, developer 워크플로는
    구현 완료 후 `/ai-review` + Critical/Warning fix 를 "같은 턴의 강제 의무"로 규정한다. 4회의
    `/ai-review`→`--impl-done` 사이클은 실제로 코드 결함(vacuous 삼항식, 대조군 미영속화,
    괄호 언랩 미검증)을 라운드마다 하나씩 고쳤고(`4c1a49b30`, `3f5e451b3`, `1a99f07a4` 커밋),
    그 fix 들도 전부 `trigger-secret-columns-{guard.ts,spec.ts}` 내부에 국한되어 plan 항목①의
    범위를 벗어나지 않는다. "코드 diff"와 "harness 프로세스 산출물"이 같은 브랜치에 섞여 있는
    것은 이 프로젝트의 정상 관례이며 scope 이탈이 아니다.
  - 판단: 범위 이탈 아님(harness 의무 산출물). 조치 불필요.

- **[INFO]** fix 커밋 3건(`4c1a49b30`, `3f5e451b3`, `1a99f07a4`)의 실질 변경도 전부 항목①
  (`trigger-secret-columns-guard.ts`/`.spec.ts`) 내부에 그친다 — 다른 파일로 번지지 않았다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`,
    `trigger-secret-columns.spec.ts`
  - 상세: 라운드 1(vacuous 삼항식 → if/throw 분리), 라운드 2(`existsSync` 방어 분기에
    대조군 `it()` 추가 + 메시지 매칭), 라운드 3(괄호 언랩 분기에 대조군 `it()` 추가) 전부
    "리뷰가 지적한 결함의 최소 수정"이며, 새 기능·새 파일·새 의존성을 추가하지 않았다.
    각 fix 는 plan 체크리스트 `--impl-done` 표에 라운드별로 근거와 함께 기록돼 있다.
  - 판단: 범위 이탈 없음(리뷰 게이트가 요구하는 수정).

포맷팅·주석 전용 변경이 실질 로직 변경과 섞인 사례, 요청받지 않은 기능 확장(over-engineering),
무관한 파일 수정, 불필요한 리팩토링, 불필요한 임포트/설정 변경은 발견되지 않았다.

## 요약

이번 브랜치(라운드 4, +5481/-27, 76개 파일)의 `codebase/**` 변경은 6개 파일에 그치며 각각
plan `trigger-canary-hardening.md` 가 선언한 4개 항목 중 정확히 하나에 1:1로 대응한다. 신설
repo-guard(항목①)의 함수·상수는 정본 1곳 + 사본 2곳만 참조하고, e2e 단언 추가(항목②)는 기존
export 헬퍼를 재사용할 뿐 시그니처를 바꾸지 않으며, 캐너리 주석 정리(항목③)와 teardown 근거
정정(항목④)은 JSDoc/주석 hunk 에 국한되어 실행 로직을 건드리지 않는다. 3라운드에 걸친
`/ai-review` fix 커밋도 전부 항목① 내부에서만 이뤄져 스코프가 번지지 않았다. 트래커 문서의
185줄 diff 는 해당 4항목의 완료 처리와, 권한 밖 발견(spec 오기·harness 번들링 결함 등)을
직접 고치지 않고 새 항목으로만 등재한 부분으로 구성돼 CLAUDE.md 의 developer/planner 권한
경계를 정확히 지킨다. 나머지 70개 파일은 전부 `review/code/**`·`review/consistency/**` 에 위치한
harness 의무 이행 산출물(4회의 `/ai-review`+`--impl-done` 사이클 결과물)이며, 지정된 저장
위치 규약을 따르고 코드 diff 와 섞여도 scope 이탈로 볼 근거가 없다. 스코프 이탈·불필요한
리팩토링·기능 확장·무관한 수정·포맷팅 뒤섞임·불필요한 주석/임포트/설정 변경 어느 것도
관측되지 않았다.

## 위험도

NONE
