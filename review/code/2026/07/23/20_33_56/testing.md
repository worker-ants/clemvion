# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** 이 PR 의 마지막 커밋(HEAD)에서 기존 회귀 테스트 `test_line_anchors.py::PromptPayloadIntegrationTest::test_diff_blocks_are_annotated_and_correct` 가 RED 로 전환됨을 직접 실측 확인
  - 위치: `.claude/tests/test_line_anchors.py:387-406` (`test_diff_blocks_are_annotated_and_correct`, `_prepare_commit()` 은 `--commit HEAD` 로 orchestrator 를 구동). 트리거는 이번 diff 의 마지막 커밋 `004d33ccb`(`plan/in-progress/harness-guard-followups.md` +7줄, 리뷰 대상 파일 7)이 HEAD 가 되는 것.
  - 상세: 리뷰 대상 워크트리(`bash-nudge-segments-4bb22d`, HEAD=`004d33ccb`)에서 `.claude/tests` 전체 스위트를 로컬 실행하면 `528 passed, 1 failed` — 실패 케이스가 정확히 이 테스트다(`AssertionError: 13 not greater than 20 : no annotated diff lines reached the prompt`). 원인은 로직 결함이 아니라 테스트 설계 자체: `_prepare_commit()` 이 항상 "현재 `git` HEAD 딱 1개 커밋"의 diff 만으로 orchestrator 를 돌리는데, 이번 PR 의 마지막 커밋이 7줄짜리 plan 문서 갱신 하나뿐이라 diff 블록의 게이트 라인 수가 임계값(`>20`)을 못 넘긴다. 같은 테스트 파일의 `_prepare_files()` 주석이 이미 "whole-file 블록이 `--commit HEAD` 에 결속되면 그날의 마지막 커밋 크기에 따라 스위트가 통과/실패한다"는 정확히 같은 실패 클래스를 지적하며 고정 파일 목록으로 우회했는데, `test_diff_blocks_are_annotated_and_correct` 쪽은 그 우회가 적용되지 않은 채 `_prepare_commit()` 에 그대로 결속돼 있다. **독립적으로 재현**: `origin/main`(`93e7ac344`, #1000 머지 — diff 가 충분히 큼)을 임시 worktree 로 체크아웃해 동일 테스트를 단독 실행하면 PASS 한다 — 즉 이번 PR 의 코드(리뷰 대상 5개 소스/문서 파일)가 아니라 **"마지막 커밋이 작다"는 사실 자체**가 RED 의 원인임을 배제법으로 확인했다. 이 사실은 `review/code/2026/07/23/20_02_29/RESOLUTION.md` 의 "검증" 절이 단언하는 "하네스 전체 513건 OK" 를 이 PR 의 최종 병합 상태에서는 재현 불가능하게 만든다(그 수치는 이 마지막 docs 커밋이 붙기 전 중간 커밋 시점 기준으로 보인다).
  - 제안: (a) 즉시 조치는 불필요 — 이 테스트는 이후 어떤 커밋이든 더 얹히면 자연 치유되는 "일시적" 플레이크이고, 리뷰 대상 훅의 로직과는 무관하다. 다만 (b) `test_line_anchors.py` 의 `test_diff_blocks_are_annotated_and_correct` 도 `test_whole_file_blocks_are_numbered_and_correct` 가 이미 적용한 것과 동일한 우회(고정된 다중 커밋 범위 또는 충분히 큰 diff 를 보장하는 fixture)를 적용해 "마지막 커밋 크기에 결속되는" 설계 결함을 근본적으로 닫는 후속 항목을 백로그(`harness-guard-followups.md`)에 등록할 것을 권장. (c) 이번 PR 의 "스위트 전체 통과" 검증 문구에 "최종 HEAD 기준 재확인 시 무관한 사전 존재 플레이크 1건 관측"이라는 각주를 남기면 향후 재확인자의 혼란을 막을 수 있다.

- **[INFO]** `_MUTATING` 의 `VAR=value` 값에 대한 "닫히지 않은 따옴표" 입력은 테스트로 pin 되지 않은 채 조용히 `False` 로 떨어진다
  - 위치: `.claude/hooks/guard_default_branch_bash.py:98` (`_MUTATING` 정규식의 env-value 대안 `(?:'[^']*'|"[^"]*"|[^\s'"]\S*)`); 테스트 파일 `.claude/tests/test_guard_default_branch_bash_mutating.py::EnvPrefixTest` (라인 147-182)
  - 상세: 직접 실측(`A="unclosed git commit` → `_is_mutating` = `False`, ReDoS 없음·선형 확인 완료)한 결과, 닫히지 않은 따옴표가 있으면 세 대안 중 어느 것도 매치하지 못해 조용히 넛지가 사라진다. 넛지 훅이라 "안전한 방향(침묵)"이라는 점에서 버그는 아니지만, 이 파일이 이미 `AcknowledgedFalsePositiveTest`/`OutOfScopeTest` 패턴으로 "알려진 갭은 명시적으로 pin 한다"는 컨벤션을 세워둔 만큼, 이 케이스도 같은 패턴으로 명시 pin 하면 향후 "따옴표 파싱을 더 정교하게 고치자"는 시도가 재발할 때 이미 다뤄진 영역임을 즉시 알 수 있다.
  - 제안: `EnvPrefixTest` 또는 `OutOfScopeTest` 에 `test_unterminated_quote_in_env_value_stays_silent` 류 케이스 1건 추가(우선순위 낮음, 있으면 더 좋음).

- **[INFO]** `guard_default_branch_bash.py` 의 오케스트레이션 경로(`main`, `_read_payload`, `_already_warned`, `_mark_warned`, `_state_dir`)는 여전히 테스트 0건 — 이번 diff 로 분류기(`_is_mutating`)만 두텁게 테스트됨
  - 위치: `.claude/hooks/guard_default_branch_bash.py:120-224`
  - 상세: 이번 PR 이전엔 파일 전체가 미테스트였고, 이번 PR 은 그 중 `_is_mutating` 만 12건으로 채웠다(정확한 스코프 판단 — diff 목적이 분류기 FN 해소였으므로 타당). 다만 `_read_payload` 의 `tool_input` vs `input` 키 우선순위, `_already_warned`/`_mark_warned` 의 세션당 1회 dedup 로직은 여전히 회귀 안전망이 없다. 이번 diff 의 스코프 밖이라 이번 리뷰의 차단 사유는 아니지만, 세션 dedup 로직에 회귀가 나면(예: marker 파일 경로 오탈자) "넛지가 매 커맨드마다 스팸되거나 영구 침묵"되는 조용한 실패가 나므로, 다음에 이 파일을 건드릴 때는 `main()` 레벨 테스트(예: `test_guard_review_before_push_main.py` 가 pre-commit 훅에 대해 이미 확립한 패턴 — 실제 프로세스 + 스텁 `_lib`)를 함께 추가할 것을 권장.

- **[INFO]** (긍정 관찰) 테스트 설계 품질이 높음 — 항목화하지 않고 요약에 반영.

## 요약

이번 diff 의 핵심 변경(`_is_mutating` 세그먼트 분할 + `VAR=value` 따옴표 지원)은 `test_guard_default_branch_bash_mutating.py` 12건(신규 3건 포함: `test_quoted_env_value_containing_spaces_is_skipped`, `test_heredoc_body_line_starting_with_a_verb_nudges` 등)으로 잘 커버되며, 실제로 로컬에서 12/12 전부 통과함을 확인했다. 순수 함수(`_is_mutating(command: str) -> bool`)로 남아 있어 mock 없이 직접 호출 테스트가 가능하고(테스트 용이성 우수), `BacktrackingTest` 는 프로젝트가 과거 두 번 겪은 "in-process 타이밍 단언이 C-level `re` 캐쳐스트로픽 백트래킹을 못 잡는다"는 교훈을 정확히 반영해 서브프로세스+timeout 으로 격리했다. `AcknowledgedFalsePositiveTest`/`OutOfScopeTest` 패턴으로 "의도적으로 고치지 않은 갭"을 회귀 감시 대상으로 명시 pin 한 점, `NoFalsePositiveClassTest` 가 plan §C won't-do 결론의 근거를 코드로 고정한 점은 테스트가 문서적 결정의 살아있는 증거 역할까지 겸하는 좋은 사례다. 직접 실측으로 발견한 유일한 실질적 결함은 리뷰 대상 코드 자체가 아니라 **기존** 회귀 테스트 `test_line_anchors.py::test_diff_blocks_are_annotated_and_correct` 가 이 PR 의 마지막(작은) 커밋이 HEAD 가 되는 순간 RED 로 전환된다는 것이며(origin/main 에서는 PASS 함을 별도 임시 worktree 로 배제법 검증), 이는 이 PR 의 RESOLUTION.md 가 단언한 "하네스 전체 스위트 통과"라는 검증 문구를 최종 HEAD 기준으로는 재현 불가능하게 만든다는 점에서 WARNING 으로 기록한다. 그 외 잔여 갭(닫히지 않은 따옴표, 훅 오케스트레이션 미테스트)은 모두 diff 목적 범위 밖이거나 넛지 훅의 "안전한 침묵" 방향이라 낮은 우선순위 INFO 로 남긴다.

## 위험도
LOW
