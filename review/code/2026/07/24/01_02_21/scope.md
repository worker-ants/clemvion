# 변경 범위(Scope) 리뷰 (01_02_21)

## 검증 방법

프롬프트 페이로드(`_prompts/scope.md`)에 포함된 12개 파일 전문을 모두 읽었다. 추가로 대상
worktree(`/Volumes/project/private/clemvion/.claude/worktrees/push-guard-worktree-scope-20044c`)에서
`git log --oneline`, `git show --stat`(HEAD=`3dc3a160a`)을 직접 실행해 이번 라운드가 실제로 리뷰
대상으로 삼아야 할 커밋의 진짜 변경 파일 목록과, 페이로드에 전달된 파일 목록을 대조했다. 같은 세션의
다른 reviewer 프롬프트(`_prompts/*.md`) 12개도 grep 으로 대조해 이 갭이 scope 프롬프트에만 국한된
문제인지 확인했다.

## 발견사항

- **[WARNING]** 이번 라운드 diff 페이로드에 실제 코드 변경이 통째로 누락 — scope 판정 근거가 리뷰
  산출물(문서) 파일에 한정되고, 이 라운드가 리뷰해야 할 실질 코드 diff 는 어떤 reviewer 에게도 전달되지
  않았다
  - 위치: 게이트 있는 줄 없음(누락된 파일에 대한 발견). 대상 커밋 `3dc3a160a`(worktree
    `push-guard-worktree-scope-20044c` HEAD) — `.claude/hooks/guard_review_before_push.py`,
    `.claude/tests/README.md`, `.claude/tests/test_push_guard_worktree_scope.py`
  - 상세: `git show --stat 3dc3a160a` 로 직접 확인한 결과, 이 커밋은 15개 파일을 변경한다 — 코드
    3개(`guard_review_before_push.py` 47줄, `README.md` 2줄, `test_push_guard_worktree_scope.py`
    90줄)와 리뷰 산출물 12개(`review/code/2026/07/24/00_34_09/*`). 그런데 이번 라운드
    `_prompts/scope.md`(및 동일 세션의 다른 13개 reviewer 프롬프트 전부, grep 으로 대조 확인)에는
    `review/code/2026/07/24/00_34_09/*` 12개 파일만 들어 있고, 코드 3개는 어디에도 없다.
    `_router.md`(router 프롬프트) 자신도 "변경 파일 12개 중 소스 코드 파일 **0개**"라고 명시해, 이
    갭이 scope reviewer 한정이 아니라 이번 라운드의 diff 준비 단계 자체에서 발생했음을 뒷받침한다.
    페이로드 안의 `RESOLUTION.md`(파일 1)는 "다음 라운드는 코드가 실질 변경됐으므로 fresh 리뷰 1회"라고
    스스로 명시하는데, 정작 "실질 변경된 코드"가 이번 fresh 리뷰 라운드 어디에도 나타나지 않는다 —
    직전 라운드(00_34_09)가 이미 리뷰했던 회고성 산출물만 다시 보고 있는 셈이다. 이는 CLAUDE.md 폴더
    구조 규약("코드 리뷰 산출물은 `review/code/**`에 커밋") 자체에 반하는 문제는 아니지만(그 문서들이
    diff 에 나타나는 것 자체는 정상 — 같은 커밋에 코드와 함께 커밋됐으므로), scope reviewer 로서 "이
    코드 변경이 의도된 범위를 벗어나는지"를 판단할 실질 대상이 없다는 점에서 이번 라운드의 판정 신뢰도에
    직접 영향을 준다.
  - 제안: 이 라운드의 diff 준비(prepare) 단계가 `3dc3a160a` 의 코드 파일 3개를 왜 누락했는지 조사할 것
    (예: 이전 라운드의 대형 `review/` 아티팩트 diff 에 필터/정렬이 밀려 코드 파일이 잘렸을 가능성 —
    `testing.md`(00_34_09) 가 이미 `test_line_anchors.py` 임계치 오탐을 "review/ 아티팩트가 만드는
    self-referential 크기" 문제로 지적한 바 있어 같은 클래스의 원인일 개연성이 있다). 코드 diff 를
    포함해 이 라운드를 재실행하기 전까지는, 이번 세션의 CRITICAL/WARNING 부재 판정은 "리뷰 산출물 파일
    자체"에만 유효하며 실제 코드 수정(worktree 경로 매칭 확장, TARGET_SELECTION degraded 기록,
    docstring 복원, README/테스트 docstring 이름 정정, `sys.path` 헬퍼)의 스코프는 아직 이 라운드에서
    검증되지 않았다는 점을 SUMMARY 에 명시할 것.

- **[INFO]** 페이로드에 실제로 보이는 12개 파일(review 산출물) 자체는 의도된 범위 안 — 별도 조치 불요
  - 위치: `review/code/2026/07/24/00_34_09/{RESOLUTION,SUMMARY,_retry_state.json,meta.json,
    architecture,documentation,maintainability,requirement,scope,security,side_effect,testing}.md(.json)`
    (모두 신규 파일, 전체가 게이트 대상)
  - 상세: 위 12개 파일은 전부 직전 리뷰 라운드(00_34_09)가 실제로 산출한 결과물이며, 그 라운드 자신의
    `scope.md`(파일 9, `## 위험도` → NONE)가 이미 "review/ 산출물 커밋은 CLAUDE.md 관례와 일치"라고
    검증해 둔 항목과 동일 클래스다. 내용 간 상호 참조(SUMMARY 의 WARNING 표 ↔ RESOLUTION 의 "반영/미조치"
    표 ↔ 개별 reviewer 파일의 발견사항)가 일관되고, 이번 커밋(`3dc3a160a`)의 커밋 메시지가 그 WARNING
    6건을 "반영"했다고 명시한 것과 RESOLUTION.md 본문이 정확히 대응한다. 불필요한 리팩토링·기능
    확장·무관한 파일·포맷팅/주석/임포트/설정 변경 등 다른 7개 점검 관점에서도 이 12개 파일에서는 아무런
    이상 신호가 없다(전부 신규 추가 문서이며 기존 내용을 건드리지 않음).
  - 제안: 조치 불요.

## 요약

프롬프트로 전달된 12개 파일(모두 `review/code/2026/07/24/00_34_09/*` 리뷰 산출물)만 놓고 보면 의도된
범위를 벗어난 변경은 없다 — 전부 직전 리뷰 라운드의 결과물이 그 라운드가 유발한 코드 수정과 함께
커밋된 것으로, project 관례(`review/`는 커밋 대상)와 정확히 일치한다. 다만 이번 라운드의 진짜 리뷰
대상이어야 할 실질 코드 diff(`.claude/hooks/guard_review_before_push.py` 등 3개 파일, 커밋
`3dc3a160a`)가 이 세션의 어떤 reviewer 프롬프트에도 전달되지 않았음을 `git show --stat` 로 직접
확인했다 — router 자신도 "소스 코드 파일 0개"라 명시한다. 그 결과 이번 scope 라운드는 실제로는
"코드 변경의 스코프"가 아니라 "이미 검증된 리뷰 산출물 문서의 스코프"만 확인한 셈이 되어, RESOLUTION.md
가 요청한 "코드가 실질 변경됐으므로 fresh 리뷰 1회"라는 목적을 충족하지 못한다. 코드 자체에서 발견된
스코프 이탈은 없으나(애초에 볼 수 없었으므로), 이 diff 준비 갭 자체를 WARNING 으로 기록하고 코드 diff
를 포함한 재실행을 권고한다.

## 위험도

WARNING
