### 발견사항

- **[WARNING]** `worktree-policy.md`(하네스 D 정책의 SoT)의 세그먼트 구분자 서술이 코드·테스트·docstring 과 달리 단일 `&`(백그라운드 연산자)를 빠뜨렸다
  - 위치: `.claude/docs/worktree-policy.md:73`
  - 상세: 이번 diff 는 `_SEGMENT_SPLIT` 을 `&&|[;|\n]` 에서 `&&|\|\||[;|&\n]` 로 바꿔 단일 `&` 도 구분자에 포함시켰다(`plan/in-progress/harness-guard-followups.md` §C 체크리스트 "단일 `&`(백그라운드) 도 구분자에 포함" 항목, `test_guard_default_branch_bash_mutating.py::SegmentTest::test_mutating_command_after_separator_is_caught` 의 `"sleep 5 & rm -rf x"` 케이스로 확인). `guard_default_branch_bash.py` 모듈 docstring(25행, "the command is split on `&&`/`||`/`;`/`|`/`&`/newline")도 이를 정확히 반영한다. 그런데 정책 SoT 인 `worktree-policy.md:73` 은 여전히 "명령을 `&&`/`||`/`;`/`|`/개행으로 나눈 각 세그먼트의 첫 토큰…"이라고만 서술해 `&` 를 빠뜨렸다. `worktree-policy.md` §0 은 CLAUDE.md 에서 "정책·운영 규칙의 SSOT" 로 명시된 문서이므로, 코드 동작이 바뀌면 함께 갱신하는 것이 이 프로젝트의 명시된 규약이다(같은 파일의 §5 표·다른 절들이 정확히 그 규약을 지키고 있다). 실제 확인 결과 파일 전체에 `` `&` `` 나 "백그라운드" 언급이 이 절 어디에도 없다.
  - 제안: `worktree-policy.md:73` 의 구분자 나열에 `` `&` `` 를 추가해 코드·테스트·docstring·plan 과 동기화한다.

- **[WARNING]** `guard_review_before_push.py` 의 §J(차단성, 최우선) 교차 참조 주석이 실제 결함 위치(`_GIT_PUSH`)가 아니라 안전한 쪽(`_SEGMENT_IS_GIT`) 옆에 붙어 있어, "the `\S+` above" 가 어느 정규식을 가리키는지 모호하다
  - 위치: `.claude/hooks/guard_review_before_push.py:142-148` (주석), 대조 대상 `_GIT_PUSH` 는 `:96-98`, `_SEGMENT_IS_GIT` 은 `:134`
  - 상세: 이번 diff 가 추가한 주석(142-148행)은 "`guard_default_branch_bash.py` 가 따옴표 값을 허용하는 반면 **the `\S+` above** 는 그렇지 않아 `GIT_SSH_COMMAND="ssh -i k" git push` 가 아예 탐지되지 않는다"고 경고하며 harness-guard-followups §J 를 가리킨다. 그러나 이 주석은 `_SEGMENT_IS_GIT`(134행, release/allowlist 경로에서 쓰이는 정규식) 바로 아래, `_SEGMENT_SPLIT`(149행) 바로 위에 있어 "above" 가 가장 자연스럽게 가리키는 대상은 `_SEGMENT_IS_GIT` 이다. 그런데 실제 §J 결함(`_is_git_push()` 가 `GIT_SSH_COMMAND="…"` 를 탐지하지 못해 리뷰 게이트 전체가 우회되는 문제)은 45행 위쪽에 있는 별개 정규식 `_GIT_PUSH`(96-98행, `_is_git_push()` 가 실제로 사용하는 패턴)의 버그이며, `plan/in-progress/harness-guard-followups.md` §J 와 `review/code/2026/07/23/20_02_29/RESOLUTION.md` 모두 `_GIT_PUSH`/`_is_git_push` 를 명시적으로 지목하고 `_SEGMENT_IS_GIT` 쪽의 동일한 `\S+` 는 "release 경로라 미매치=안전, 별개"라고 따로 구분해 둔다. 즉 plan 문서는 두 `\S+` 를 정확히 구분하지만, 코드 안의 유일한 §J 브레드크럼(주석)은 위치·대명사 지시 때문에 그 구분을 흐린다 — `_GIT_PUSH` 자체의 주석(80-95행)에는 §J 언급이나 이 버그에 대한 언급이 전혀 없다. §J 를 별건 PR 로 착수할 담당자가 코드 주석만 보고 `_SEGMENT_IS_GIT` 를 고치는 실수를 할 여지가 있다(다행히 `test_push_guard_allowlist.py` 의 byte-for-byte 핀이 있어 실제로 틀린 패턴을 커밋하면 테스트가 잡아내지만, 주석 자체의 정확성 문제는 남는다).
  - 제안: 주석을 `_GIT_PUSH` 정의(96행) 바로 위/옆으로 옮기거나, 최소한 "the `\S+` above" 를 "`_GIT_PUSH`(위 96행)의 `\S+`" 처럼 명시적으로 지칭하도록 고쳐 대명사 참조 모호성을 없앤다.

- **[INFO]** 모듈 docstring 새 문단에 주어-동사 불일치
  - 위치: `.claude/hooks/guard_default_branch_bash.py:31-33`
  - 상세: "The split does not understand quoting; the two false-positive classes / that opens are pinned in `test_guard_default_branch_bash_mutating.py`…" — 복수 주어 "classes" 에 단수 동사 "opens" 가 붙었다("that open" 이 맞다). 의미 전달에는 문제없는 사소한 오타.
  - 제안: "that opens" → "that open".

- **[INFO]** 이전 라운드 산출물 `review/code/2026/07/23/20_02_29/testing.md` 에 sub-agent 반환 프로토콜(STATUS 헤더 + 구분자)이 보고서 본문 안에 그대로 남아 있어, 같은 세션의 다른 6개 리포트(`documentation.md`, `maintainability.md`, `requirement.md`, `scope.md`, `security.md`, `side_effect.md`)와 형식이 다르다
  - 위치: `review/code/2026/07/23/20_02_29/testing.md:1-2` (`STATUS=success testing review complete (2 WARNING)` / `===REPORT_MARKDOWN_BELOW===`)
  - 상세: 같은 세션 디렉토리의 다른 6개 reviewer 결과 파일은 전부 제목(`# ... 리뷰`)으로 시작하는 순수 마크다운인 반면, `testing.md` 만 `.claude/docs/subagent-call-contract.md` §2 예외("Workflow 경유 호출은 STATUS 헤더 + delimiter + 보고서 전문을 반환 메시지에 붙인다")에 해당하는 반환-메시지 형식이 파일 본문에도 그대로 박제되어 있다. 기능상 문제(파싱 실패·판정 오류)는 없어 보이지만(SUMMARY.md 는 "testing: WARNING 2건" 을 정확히 반영했다), 저장소에 영구히 남는 리뷰 아카이브 파일의 형식이 세션 내에서 불일치하는 사소한 아티팩트 위생 문제다.
  - 제안: 우선순위 낮음(과거 세션의 완료된 산출물이라 사후 수정 실익이 적음). 향후 유사 케이스 방지를 위해 orchestrator/workflow 쪽에서 `output_file` 저장 시 STATUS 헤더+구분자를 벗겨내고 본문만 저장하도록 점검을 권고.

### 요약

이번 diff 는 (1) `guard_default_branch_bash.py` 의 세그먼트 분할 결함 수정 + RESOLUTION 반영분(따옴표 env 값 허용, 단일 `&` 추가, ReDoS 주장 철회, plan Overview·"프로브 8건" 정정, docstring 보강)과 (2) 앞선 리뷰 라운드(`20_02_29`)의 SUMMARY/RESOLUTION/개별 reviewer 산출물이 함께 커밋된 것이다. 직접 대조한 결과 RESOLUTION.md 가 주장한 수정 사항(12건 테스트, README "2종" 정정, plan Overview 동기화, `_MUTATING`/`_SEGMENT_SPLIT` 옆 상호 참조 주석)은 모두 현재 코드·문서에 정확히 반영돼 있어 신뢰할 수 있는 자기수정 이력이다. 다만 두 가지 새로운 갭을 발견했다: ① 정책 SoT 인 `worktree-policy.md` 가 이번에 추가된 단일 `&` 구분자를 서술에서 빠뜨려 코드·테스트·docstring 과 어긋났고, ② `guard_review_before_push.py` 에 새로 추가된 §J(차단성 최우선) 교차 참조 주석이 실제 결함 정규식(`_GIT_PUSH`)이 아니라 안전한 쪽(`_SEGMENT_IS_GIT`) 옆에 붙어 있어 대명사 참조가 모호하다 — plan 문서 자체는 정확히 구분하지만 코드 주석만으로는 헷갈릴 수 있다. 그 외에는 사소한 문법 오타 1건과, 과거 세션 산출물 파일 하나에 프로토콜 텍스트가 남아있는 아티팩트 위생 이슈 1건뿐이다. CHANGELOG/API 문서/설정 문서는 이 변경(내부 하네스 훅)의 성격상 대상이 아니다.

### 위험도
LOW
