# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 차단 메시지에 `worktree:` 줄 추가는 핵심 fix(worktree 스코프 확장) 범위를 살짝 벗어나는 부수 개선
  - 위치: `.claude/hooks/guard_review_before_push.py` 455행 (`_REVIEW_MSG` 의 `"  worktree:  {worktree}\n"`), 478행 (`_PLAN_MSG` 동일), 그리고 `_run_gate` 내부 렌더 호출부 517-518행 (`render(result, target if scoped else os.getcwd())`)
  - 상세: 이번 작업의 선언된 의도는 "게이트가 평가하는 worktree 를 cwd 단일 대상에서 push 대상(들)로 확장"하는 correctness fix 다. 여기에 차단 메시지 포맷에 `worktree:` 줄을 신설한 것은 그 자체로는 별개의 UX 개선이다. 다만 (1) `plan/in-progress/push-guard-worktree-scope.md` 의 `## 부수 개선` 절(61-62행)에 사전 고지돼 있고, (2) 이제 게이트가 여러 worktree 를 평가하는 구조로 바뀐 이상 "어느 worktree 가 막았는지" 를 밝히지 않으면 차단 사유가 모호해져 사실상 이 fix 의 자연스러운 부산물에 가깝다. 신규 테스트(`test_false_allow_hole_is_closed`, `test_cwd_worktree_is_still_evaluated`, `test_plan_gate_is_scoped_too` 등)도 이 줄을 명시적으로 단언하고 있어 은닉된 확장이 아니다.
  - 제안: 조치 불요 — 투명하게 문서화·테스트된 확장.

- **[INFO]** REVIEW/PLAN 루프를 `_run_gate()` 공용 헬퍼로 추출한 리팩토링이 diff 에 섞여 있음
  - 위치: `.claude/hooks/guard_review_before_push.py` 494-520행(`_run_gate` 신설), 541-561행(`main()` 의 REVIEW/PLAN 호출부를 `_run_gate(...)` 로 교체)
  - 상세: 이 구조 변경 자체는 "worktree 스코프 확장"이라는 핵심 의도와 직교하는 리팩토링처럼 보일 수 있지만, `plan/in-progress/push-guard-worktree-scope.md` §"1차 리뷰(17_28_02) 반영" 표의 WARNING 4("REVIEW/PLAN 루프 중복(DRY)")에 대한 명시적 대응이며, `review/code/2026/07/23/17_28_02/RESOLUTION.md` 에도 반영 근거가 기록돼 있다. 즉 요청받지 않은 자발적 리팩토링이 아니라 직전 리뷰 라운드의 피드백에 대한 documented 대응이다. 두 게이트를 스코프 확장 없이 그대로 두면 동일 for-loop 골격이 그대로 두 번 복제된 채 남았을 것이므로, 오히려 이번 스코프 확장(REVIEW 루프 → PLAN 루프 각각에 target 순회를 새로 심어야 하는 지점)과 결합해서 봐야 자연스러운 타이밍의 변경이다.
  - 제안: 조치 불요 — 리뷰 피드백에 대한 응답으로 정당화됨.

- **[INFO]** `review/code/2026/07/23/17_28_02/*` 13개 파일(신규)이 이번 diff 에 포함됨 — 코드 변경이 아닌 이전 리뷰 라운드의 산출물
  - 위치: `review/code/2026/07/23/17_28_02/{RESOLUTION.md, SUMMARY.md, meta.json, _retry_state.json, architecture.md, documentation.md, maintainability.md, performance.md, requirement.md, scope.md, security.md, side_effect.md, testing.md}` (전부 `new file mode 100644`)
  - 상세: 이 파일들은 이번 diff 의 핵심 코드 변경(`guard_review_before_push.py`)에 대한 **직전 리뷰 라운드**(17:28:02 실행)의 자동 산출물이다. CLAUDE.md 폴더 구조 규약(`review/` = 코드 리뷰 산출물 위치) 및 프로젝트 관례("review/ 는 gitignored 아님, SUMMARY·RESOLUTION 도 커밋")에 정확히 부합하는 감사 추적(audit trail)이며, 이번 작업이 스스로 만들어낸 무관한 산출물이 아니라 developer 워크플로의 필수 구성요소(구현 → `/ai-review` → RESOLUTION 반영 → 커밋)다. `guard_review_before_push.py`/plan 문서에 대한 실제 코드 수정과 성격이 다른 별도 파일군이라는 점만 기록해 둔다.
  - 제안: 조치 불요 — 정상적인 워크플로 산출물.

## 점검 결과 상세

- **의도 이상의 변경**: 없음. 코드 변경은 `guard_review_before_push.py` 한 파일에 국한되며, 그 안에서도 기존 `_is_git_push`/`_redact_inert_text`/`_GIT_PUSH` 등 push 탐지 로직은 diff hunk 밖(`@@ -311,9 +313,146` 는 기존 `return` 문 이후부터 시작)이라 전혀 손대지 않았다. 실제 추가 코드는 전부 "이 push 가 어느 worktree(들)를 publish 하는가" 라는 선언된 목적에 종속됨.
- **불필요한 리팩토링**: `_run_gate()` 추출은 존재하지만, 위 발견사항에서 밝혔듯 직전 리뷰 라운드 WARNING 에 대한 명시적 대응으로 plan/RESOLUTION 에 근거가 남아 있어 "무관한 정리"로 보기 어렵다.
- **기능 확장(over-engineering)**: `_accepts_cwd()` 시그니처 probe 는 방어적이지만, plan 문서(mutation 실측 M3a/M3b)로 "probe 제거 시 실제로 silent fail-open 을 유발한다"는 근거가 실측으로 뒷받침됨 — over-engineering 이 아니라 이 fix 가 성립하기 위한 필수 안전장치.
- **무관한 수정**: 없음. 실제 코드/테스트/문서 변경은 `guard_review_before_push.py`, `test_push_guard_worktree_scope.py`(신규), `.claude/tests/README.md`(1행), `plan/in-progress/push-guard-worktree-scope.md`(신규) 4개로, 전부 이번 worktree-scope 수정과 직접 연관. `review/code/2026/07/23/17_28_02/*` 는 위에서 별도로 다룬 리뷰 산출물.
- **포맷팅 변경**: 실질 변경과 무관한 공백/줄바꿈 변경이 섞여 있지 않음. diff hunk 전부가 순수 추가(+) 또는 대체(구 REVIEW/PLAN 블록 → `_run_gate` 호출)이며 무관한 라인 이동은 없음.
- **주석 변경**: 기존 주석의 삭제/수정 없음. 신규 코드(`_worktree_branches`/`_mentions_branch`/`_accepts_cwd`/`_push_targets`/`_run_gate`)에 대한 신규 설계-근거 주석만 추가됐고, 파일 기존 컨벤션(장문 설계 주석, 회귀 이력 인용)과 스타일이 일치한다.
- **임포트 변경**: `import inspect`(28행), `import subprocess`(32행) 모듈 top-level 추가 — 둘 다 신규 코드(`_worktree_branches`/`_accepts_cwd`)에서 실제 사용되며 불필요한 임포트나 무관한 정리는 없다. (참고: RESOLUTION.md 에 따르면 초안은 함수-지역 import 였다가 INFO 반영으로 top-level 로 옮겼다 — 이 자체도 리뷰 피드백 대응.)
- **설정 변경**: 없음. `.claude/settings.json` 등 설정 파일 미변경.

## 요약

핵심 코드 변경(`guard_review_before_push.py`)과 필수 동반 파일(신규 테스트, README 카탈로그 1행, plan 문서)은 "push 가드가 cwd 단일 대상 대신 push 가 실제로 publish 하는 worktree(들)을 평가하도록 확장한다"는 단일 의도에 밀접하게 종속되어 있으며, 무관한 파일·불필요한 리팩토링·포맷팅·임포트·설정 변경은 발견되지 않았다. `_run_gate()` 추출과 차단 메시지 `worktree:` 줄 추가는 core fix 를 표면적으로는 살짝 넘어서지만 둘 다 직전 리뷰 라운드 피드백에 대한 documented 대응이거나 plan 문서에 사전 고지된 필연적 부산물이라 문제 삼기 어렵다. diff 의 대부분(17개 파일 중 13개)을 차지하는 `review/code/2026/07/23/17_28_02/*` 는 실제 코드 변경이 아니라 프로젝트 관례상 커밋 대상인 이전 리뷰 라운드 산출물(RESOLUTION/SUMMARY/각 리뷰어 리포트)로, scope 관점에서 문제되는 변경이 아니다.

## 위험도

NONE
