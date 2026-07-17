# 유지보수성(Maintainability) 리뷰

대상: `.claude/docs/worktree-policy.md`, `.claude/hooks/guard_review_before_push.py`,
`.claude/tests/README.md`, `.claude/tests/test_push_detection.py`(신규),
`.claude/tests/test_reap_merged_worktrees.py`, `.claude/tools/bootstrap-session.sh`,
`.claude/tools/reap-merged-worktrees.sh`, `plan/in-progress/harness-session-anchor-guards.md`

## 발견사항

- **[INFO]** `_is_git_push` 의 세그먼트 판정 조건이 루프 내부와 루프 이후("flush") 두 곳에 중복
  - 위치: `.claude/hooks/guard_review_before_push.py` `_is_git_push()` (약 297~307행)
  - 상세: `_git_subcommand(segment) == "push"` 비교가 `for token in tokens` 루프 안(구분자를 만났을 때)과 루프 종료 후 마지막 세그먼트 처리에 한 번씩, 총 두 번 등장한다. "누적하다가 끝에서 한 번 더 flush" 하는 흔한 패턴이라 실질적 위험은 낮지만, 향후 이 조건(`== "push"`)이 바뀔 때 두 곳을 함께 고쳐야 한다.
  - 제안: 사소한 수준이라 필수는 아니나, 원한다면 `_SEGMENT_SEPARATORS`를 만난 토큰까지 포함해 세그먼트 리스트를 먼저 모두 만든 뒤(`itertools.groupby` 등) 한 곳에서 판정하도록 리팩터링할 수 있다. 현재도 각 분기에 짧고 명확한 주석이 있어 그대로 두어도 무방.

- **[INFO]** `keep_paths` 누적에 파일 내 다른 개행-생성 관례(`printf '...\n'`)와 다른 방식(소스에 리터럴 개행을 직접 삽입) 사용
  - 위치: `.claude/tools/reap-merged-worktrees.sh` `--keep)` 케이스 블록 (약 65~72행)
    ```bash
    keep_paths="${keep_paths}$(realpath_p "$1")
    "
    ```
  - 상세: 같은 파일의 다른 개행 구분자 생성 지점(`_parse_worktrees`의 `printf '%s\t%s\n' ...`, `is_kept`의 `printf '%s\n' "$keep_paths"`)은 모두 `printf`로 명시적으로 `\n`을 넣는다. 반면 `keep_paths` 대입은 닫는 따옴표를 다음 줄로 내려 실제 개행 문자를 문자열 리터럴 안에 그대로 심는다. 동작은 올바르고 문제는 없지만, diff/에디터에서 훑어볼 때 의도적 개행인지 우발적 줄바꿈(포맷 실수)인지 한 번에 구분되지 않는다.
  - 제안: `keep_paths="${keep_paths}$(realpath_p "$1")"$'\n'` (ANSI-C 따옴표) 또는 `keep_paths="${keep_paths}$(printf '%s\n' "$(realpath_p "$1")")"` 처럼 파일의 기존 관례(`printf` 기반 개행)에 맞추면 한 줄로 끝나 가독성이 조금 더 좋아진다. 급하지 않음.

- **[INFO]** "앵커가 reap 되면 세션이 wedge 된다" 는 동일 진단 설명이 5개 산출물에 거의 그대로 반복
  - 위치: `.claude/docs/worktree-policy.md` §7 불변식 / `.claude/tools/bootstrap-session.sh` 4번 섹션 주석 / `.claude/tools/reap-merged-worktrees.sh` 헤더의 `--keep` 설명 / `.claude/tests/test_reap_merged_worktrees.py` 모듈 docstring / `plan/in-progress/harness-session-anchor-guards.md` 본문
  - 상세: 코드 중복은 아니지만, 같은 근본 원인 서술("모든 훅이 `$CLAUDE_PROJECT_DIR/.claude/hooks/*.py` 로 실행되므로 앵커를 reap 하면 Bash/Write/Edit 전부 로드 실패")이 5곳에 각각 다른 표현으로 재작성되어 있다. 이 저장소의 "각 산출물에 자기완결적 근거를 남긴다"는 기존 관례(스킬 문서·plan Rationale 패턴)와 일치하므로 결함으로 보지는 않지만, 이 진단이 훗날 정정될 경우(과거 "terminal 메커니즘" 오설명 사례처럼, 커밋 `5cd821d19` 참고) 5곳을 동시에 고쳐야 drift 가 안 생긴다는 점은 유지보수 관점에서 기록해 둘 가치가 있다.
  - 제안: 액션 아이템 아님. 추후 이 진단을 수정할 일이 생기면 위 5개 위치를 체크리스트로 삼을 것을 권장.

## 요약

전반적으로 가독성·네이밍·함수 길이·중첩 깊이·복잡도 모든 축에서 우수하다. `guard_review_before_push.py`의 `_tokenize`/`_git_subcommand`/`_is_git_push`는 각각 단일 책임의 짧은 함수로 분리되어 있고, 왜 그렇게 구현했는지(`shlex` 분리 이유, `commenters` 초기화 이유, basename 사용 이유 등)를 코드 옆 주석으로 남겨 판단 근거 추적이 쉽다. `reap-merged-worktrees.sh`의 `--keep` 추가는 기존 가드 절(guard-clause, 얕은 중첩) 스타일과 `realpath_p`/`is_kept` 같은 기존 네이밍 패턴(`is_ancestor`)을 그대로 따라 일관성이 높고, `--keep` 문서화가 스크립트 헤더 주석에 있어 기존 `-h/--help` 추출 메커니즘(헤더 주석을 그대로 잘라 출력)에 자동으로 반영되는 점도 이중 관리 부담을 줄인다. 신규 테스트(`test_push_detection.py`, `test_reap_merged_worktrees.py`의 `--keep` 케이스)는 데이터 기반(MUST_BLOCK/MUST_ALLOW) 또는 명확한 단일 목적 메서드로 구성되어 있고, 각 테스트가 "왜 이 케이스가 non-vacuous 한지"까지 docstring/주석으로 남겨 회귀 방지 가치가 높다(예: `_install_bootstrap`이 앵커 워크트리를 clean 상태로 만들어 dirty-skip 에 의한 거짓 통과를 차단). 문서 변경(`worktree-policy.md`, `tests/README.md`, plan 파일)도 기존 문서의 정보 밀도 높은 서술 스타일과 표 형식을 그대로 유지해 일관적이다. 위에서 지적한 항목은 모두 INFO 수준의 사소한 스타일 제안으로, 병합을 막을 이유가 되지 않는다.

## 위험도

LOW
