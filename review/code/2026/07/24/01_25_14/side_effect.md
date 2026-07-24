# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 블로킹 게이트 `_GIT_PUSH` 판정 경계 변경 — 의도된 확장, 하위호환 아님
  - 위치: `.claude/hooks/guard_review_before_push.py:119` (`_GIT_PUSH` 세 번째 대안 `[^\s'"]\S*` → `\S+`)
  - 상세: 이 정규식은 `git push` 실행마다 도는 **차단 게이트**(`_is_git_push` → `main()` → `_run_gates()`)의 1차 판정을 바꾼다. env 접두값이 따옴표로 시작해 닫히지 않는 형태(`A='x git push`)가 기존에는 접두 그룹 붕괴로 **탐지 자체가 안 돼 게이트가 통째로 skip** 됐는데, 이제는 탐지되어 REVIEW/PLAN 게이트가 정상 작동한다. 즉 이 변경은 "이전에 아무 검사도 없이 통과되던 push 커맨드 형태"를 이제부터 검사 대상으로 편입시킨다 — 동작을 좁히는 게 아니라 넓히는 방향이고, 목적(§J 계열 게이트 우회 봉쇄)에 부합하지만 실질적으로 "이전에 무검사로 통과하던 명령이 이제 검사·차단될 수 있다"는 관측 가능한 동작 변화이므로 기록해 둔다.
  - 근거: `\S+` 는 이전 대안 `[^\s'"]\S*` 의 진부분집합이 아니라 상위집합(따옴표 문자까지 포함해 매칭 가능)이라 이 alternation 이 포함된 그룹은 `.search()` 매칭 범위를 단조 확장만 한다 — 실측(`GeneratedFloorTest`, 168조합: 손실 0건/획득 12건)과 코드 상으로 확인. 회귀 방향(false negative 축소)이 명확히 안전한 방향이라 위험도는 낮다.
  - 제안: 조치 불필요 — 이미 `GeneratedFloorTest`/`BlindPassFrozenTest`/`DifferentialTest` 로 회귀 플로어가 지켜지고 있고, PLAN 문서(`plan/in-progress/harness-guard-followups.md` §J-후속)에 근거·측정치가 기록돼 있다. 다만 이런 "게이트 판정 경계 확장"은 향후 push 실패 리포트가 늘면 원인 추적 시 참고할 문서로 남겨둠.

- **[INFO]** 동일 완화가 넛지(비차단) 훅에도 적용됨 — 부작용 범위는 최소
  - 위치: `.claude/hooks/guard_default_branch_bash.py:110` (`_MUTATING` 세 번째 대안)
  - 상세: 이 훅은 절대 차단하지 않고 세션당 1회 stdout reminder만 출력하므로, 판정 경계가 넓어져도 부작용은 "reminder 가 이전보다 조금 더 자주 뜬다" 수준이다. `_already_warned`/`_mark_warned` 를 통한 세션별 dedupe 로직·상태 파일 위치(`.claude/state/main_worktree_bash_warned/<session_id>`)는 이번 diff 에서 변경되지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** 두 훅 + 테스트 미러 3곳 간 patttern 동기화 확인됨
  - 위치: `.claude/hooks/guard_default_branch_bash.py:110`, `.claude/hooks/guard_review_before_push.py:119`, `.claude/tests/test_push_guard_allowlist.py:82`
  - 상세: `grep` 으로 세 곳 모두 동일하게 `\S+` 폴백으로 갱신됐음을 직접 확인했다. `EnvValueSubpatternSharedTest.test_both_hooks_use_the_same_env_value_alternation` 이 두 훅 간 drift 를, `BlindPassFrozenTest.test_blind_pattern_is_frozen` 이 테스트-미러 drift 를 각각 검출하도록 되어 있어 "한쪽만 고치고 다른 쪽을 빠뜨리는" 부작용 클래스는 이미 가드되어 있다. `.claude/tests/test_guard_default_branch_bash_mutating.py` 안의 `OldEnvPrefixSupersetTest._PRE_QUOTED_PREFIX` 는 의도적으로 **옛(pre-quoted) 형태를 고정**해 상위집합 비교 기준점으로 쓰는 것이라 이번 폴백 변경과 무관 — 혼동 아님을 확인.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/harness-guard-followups.md` 의 SoR 경로 갱신(`plan/in-progress/...` → `plan/complete/harness-push-guard-subcommand-detection.md`)
  - 위치: `.claude/hooks/guard_review_before_push.py:91` 주석, `.claude/tests/test_push_guard_allowlist.py:4`
  - 상세: 실제로 `plan/complete/harness-push-guard-subcommand-detection.md` 가 존재하고 `plan/in-progress/` 에는 해당 파일이 없음을 직접 확인했다(이미 과거 커밋에서 이동됨). 코드 동작에는 영향 없는 문서 포인터 정정이며, 참조 무결성도 확인됨.
  - 제안: 조치 불필요.

- **[INFO]** 신규 `import re` (테스트 파일) — 부작용 없음
  - 위치: `.claude/tests/test_guard_default_branch_bash_mutating.py:30`
  - 상세: `OldEnvPrefixSupersetTest` 가 프리픽스만 재조합한 정규식을 즉석 컴파일하기 위해 필요한 표준 라이브러리 import. 전역 상태·부작용 없음.

## 점검했으나 문제 없음으로 판단한 항목

- **전역 변수/상태**: 새 전역 변수 없음. `_MUTATING`/`_GIT_PUSH`/`_BLIND_PATTERN` 모두 모듈 레벨 상수(불변, 재바인딩 없음)이며 리터럴 값만 바뀜.
- **파일시스템 부작용**: 훅의 `_mark_warned`/상태 파일 쓰기 로직(`guard_default_branch_bash.py`), fail-open 카운터 파일 쓰기(`guard_review_before_push.py` → `_lib/failopen_state.py`)는 이번 diff 에서 손대지 않음.
- **함수 시그니처**: `_is_mutating(command)`, `_is_git_push(command)` 등 모든 함수 시그니처 불변. 내부 정규식 리터럴만 변경.
- **공개 인터페이스**: 이 두 파일은 PreToolUse 훅으로, `.claude/settings.json` 등록·exit code 계약(0/2/기타) 모두 불변. 외부에서 이 모듈을 import 하는 다른 소비처는 확인되지 않음(hook 자체 실행 또는 테스트에서만 import).
- **환경 변수**: `BYPASS_DEFAULT_BRANCH_GUARD`, `BYPASS_REVIEW_GUARD`, `BYPASS_PLAN_GUARD`, `CLAUDE_PROJECT_DIR` 읽기 로직 불변, 신규 env var 없음.
- **네트워크 호출**: 없음.
- **이벤트/콜백**: 없음 — `print()`/`return`/`sys.exit()` 뿐이며 호출 순서·조건 변경 없음.
- **성능/hang 회귀**: `BacktrackingTest`(양쪽 스위트) 가 서브프로세스+timeout 으로 catastrophic backtracking 부재를 재확인하며 통과(`69 passed, 214 subtests passed`, 직접 실행 확인). 매 Bash/`git push` 호출마다 도는 hot-path 이므로 성능 회귀는 사실상 시스템 전역 부작용이 될 수 있는 지점인데, 여기서는 empirically 선형성 유지가 재확인됨.
- **테스트 실행 확인**: `python3 -m pytest .claude/tests/test_guard_default_branch_bash_mutating.py .claude/tests/test_push_guard_allowlist.py -q` 직접 실행 — 전량 통과.

## 요약

이번 변경은 두 PreToolUse 훅(`guard_default_branch_bash.py`, `guard_review_before_push.py`)과 그 미러 테스트에서 env-접두 정규식의 마지막 대안을 `[^\s'"]\S*` → `\S+` 로 넓혀, "따옴표를 열고 닫지 않는 값"이 판정 자체를 무력화하던 진짜 게이트 우회(§J-후속)를 막는다. 함수 시그니처·공개 인터페이스·전역 상태·환경변수·파일시스템·네트워크 호출은 전혀 건드리지 않았고, 유일한 관측 가능한 동작 변화는 "이전에 무검사로 통과되던 특정 push 커맨드 형태가 이제 검사(및 필요 시 차단) 대상이 된다"는 점인데, 이는 이 diff 의 명시적 목적이며 생성 기반 회귀 테스트(`GeneratedFloorTest`, 168조합: 손실 0/획득 12)로 "이전에 잡던 것은 하나도 안 잃는 엄밀한 상위집합"임이 실측 검증됐다. 두 훅 간 patttern drift, 테스트-대상 drift 를 잡는 전용 테스트(`EnvValueSubpatternSharedTest`, `BlindPassFrozenTest`)도 그대로 유지·통과 중이라 "한쪽만 고치는" 부작용 클래스도 이미 방지돼 있다. plan 문서의 SoR 경로 정정도 실제 파일 위치와 일치함을 직접 확인했다. 전반적으로 부작용 관점에서 위험 요소는 발견되지 않았다.

## 위험도

LOW
