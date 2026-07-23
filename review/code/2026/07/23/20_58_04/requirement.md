### 발견사항

- **[INFO]** (검증 완료) 1R/2R WARNING(W1 SPEC-DRIFT·W2 포인터 오배치·W3 테스트 HEAD 결속)이 전부 소스에 정확히 반영됨
  - 위치: `.claude/docs/worktree-policy.md:73`, `.claude/hooks/guard_review_before_push.py:97-106`(§J 주석이 `_GIT_PUSH` 로 이동 확인), `.claude/tests/test_line_anchors.py:328-372`(`_pick_commit_fixture`/`_MIN_FIXTURE_CHANGED_LINES=80`/`_FIXTURE_SEARCH_DEPTH=40`)
  - 상세: 직접 파일을 Read/Bash 로 열어 재검증했다. (1) `worktree-policy.md:73` 는 이제 "`&&`/`||`/`;`/`|`/`&`/개행" 6종을 서술해 코드(`guard_default_branch_bash.py:25` docstring, `_SEGMENT_SPLIT = re.compile(r"&&|\|\||[;|&\n]")`)·테스트(`SegmentTest`)와 line-level 로 일치 — 이전 라운드가 지적한 SPEC-DRIFT(단일 `&` 누락)가 해소됐다. (2) `guard_review_before_push.py` 의 §J 교차 참조 주석("KNOWN DEFECT... the env-prefix group below uses `\S+`")이 이제 `_GIT_PUSH` 정의(97-106행) 바로 위에 있고, `_SEGMENT_IS_GIT` 옆(155행)에는 "§J 결함은 위쪽 `_GIT_PUSH` 에 있다"는 안내만 남아, 담당자가 엉뚱한 정규식을 고칠 위험이 사라졌다. (3) `test_line_anchors.py::_pick_commit_fixture()` 가 최근 40커밋 중 변경 라인 ≥80 인 첫 커밋을 fixture 로 선택하도록 바뀌어 `--commit HEAD` 결속 문제를 해소했다 — 실행 확인: `python3 -m pytest .claude/tests/test_guard_default_branch_bash_mutating.py .claude/tests/test_line_anchors.py -q` → `47 passed, 39 subtests passed`, 회귀 없음.
  - 제안: 없음(검증 완료).

- **[INFO]** 핵심 요구사항(§C 체크리스트 6개 항목) 전부 구현·테스트로 고정됨을 실측 확인
  - 위치: `.claude/hooks/guard_default_branch_bash.py:99-157`(`_MUTATING`/`_SEGMENT_SPLIT`/`_is_mutating`), `.claude/tests/test_guard_default_branch_bash_mutating.py`(`NoFalsePositiveClassTest`×2, `SegmentTest`×2, `AcknowledgedFalsePositiveTest`×2, `OutOfScopeTest`×1, `EnvPrefixTest`×4, `BacktrackingTest`×1, `EmptyInputTest`×1 = 13 메서드)
  - 상세: `plan/in-progress/harness-guard-followups.md` §C 체크리스트("세그먼트 분할 + 앵커 적용", "VAR=value 접두 건너뛰기(따옴표 값 포함)", "단일 `&` 구분자 포함", "테스트 12건→13건")가 실제 코드·테스트와 1:1 대응한다. `test_quoted_env_value_containing_spaces_is_skipped`(`GIT_SSH_COMMAND="ssh -i ~/.key" git commit -m "x"` 등)와 `test_malformed_env_values_stay_unmatched`(빈 값 `VAR= git commit`, 닫히지 않은 따옴표 `A="unclosed git commit`) 를 직접 읽고 모듈 docstring(34-36행)의 "두 형태가 미매치로 남는다"는 서술과 정확히 일치함을 확인했다. `.claude/tests/README.md:46` 도 "the two residual FPs (a quoted separator; a heredoc body line)"로 정확히 2종을 서술해 이전 라운드의 "1종만 언급" 지적이 해소됐다.
  - 제안: 없음(검증 완료).

- **[INFO]** (계속 추적, 이번 diff 미해결·의도적) `guard_review_before_push.py` `_GIT_PUSH` 의 따옴표 env-prefix 우회가 실측상 여전히 살아 있음
  - 위치: `.claude/hooks/guard_review_before_push.py:107-109`(`_GIT_PUSH`), `:335`(`_is_git_push` 가 이 패턴만 사용); 근거 `plan/in-progress/harness-guard-followups.md` §J(체크리스트 최상단, "차단성, 최우선")
  - 상세: 직접 격리 실행으로 재현했다 — `guard._is_git_push('GIT_SSH_COMMAND="ssh -i ~/.key" git push origin main')` → `False`, `guard._is_git_push('GIT_AUTHOR_NAME="John Doe" git push --force origin main')` → `False`, 반면 `git push origin main` → `True`. 탐지 실패 시 `main()` 이 즉시 `return 0` 하므로 review-before-push 게이트 자체가 조용히 우회된다(2R security 리뷰가 CRITICAL 로 최초 문서화). 이번(3R) diff 는 이 파일에 주석만 추가했고(§J 포인터 재배치, W2), 정규식 자체는 변경하지 않았다 — `test_push_guard_allowlist.py` 의 byte-for-byte 핀·차등 코퍼스 때문에 별건 PR 로 명시적으로 분리한 결정(RESOLUTION.md 2R·3R)은 합리적이며, plan 체크리스트에 "차단성 최우선"으로 투명하게 등록돼 있다. 이 이슈는 "이번 diff 가 만든 요구사항 미충족"이 아니라 "이번 diff 가 처음 발견해 정확히 스코프 아웃한 기존 결함"이므로 requirement 리뷰의 CRITICAL 로 재상정하지 않는다(2R 에서도 requirement/scope 리뷰는 동일하게 LOW·스코프 타당으로 판정했고, security 가 CRITICAL 을 전담). 다만 "review-before-push 는 항상 발동해야 한다"는 요구사항이 현재 라이브 코드에서 실제로 깨져 있다는 사실 자체는 3R 시점에도 변함이 없으므로 최종 SUMMARY 가 이 상태를 다시 반영해야 한다.
  - 제안: 조치는 이번 PR 스코프 밖. §J 별건 PR 착수 우선순위 유지 확인만 필요.

- **[INFO]** `_pick_commit_fixture` 의 docstring "Deliberately NOT `HEAD`" 문구가 실제 동작보다 강한 불변식을 암시함
  - 위치: `.claude/tests/test_line_anchors.py:332-347`(`_pick_commit_fixture` docstring)
  - 상세: 실측 — 현재 HEAD(`37fcfc494`, 변경 라인 822)에서 `_pick_commit_fixture()` 를 직접 호출하면 **HEAD 자신의 SHA** 를 반환한다(HEAD 가 이미 임계값 80 을 넘기 때문). 즉 이 메서드는 "결과가 HEAD 와 절대 같을 수 없다"가 아니라 "HEAD 인지 여부와 무관하게 임계값을 만족하는 가장 최근 커밋을 고른다"(우연히 HEAD 가 될 수도 있음)는 의미다. docstring 첫 문장 "Deliberately NOT `HEAD`" 를 문자 그대로 읽으면 "반환값이 결코 HEAD 가 아니다"로 오독하기 쉬운데, 이어지는 문단(“Pinning HEAD tied the result to something the test does not measure”)을 읽으면 실제 의도는 "무조건 HEAD 를 쓰도록 하드코딩하지 않는다"임이 드러난다 — 기능 결함은 아니고(회귀 방지 목적은 그대로 달성됨), 함수 docstring 첫 줄과 실제 동작 사이에 오독 여지가 있는 사소한 서술 정확도 문제다.
  - 제안: 필수 아님. 여유가 있으면 "Deliberately NOT hard-coded to `HEAD`" 또는 "may or may not be HEAD — whichever recent commit clears the threshold first" 처럼 첫 줄을 명확히 하면 향후 독자의 오독을 줄일 수 있다.

- **[INFO]** spec fidelity — `spec/` (제품 스펙) 은 이 변경과 무관(전수 grep 결과 `guard_default_branch_bash`/`guard_review_before_push` 를 참조하는 `spec/` 문서 없음). 유일한 관련 "spec" 은 `.claude/docs/worktree-policy.md` §5 이며, 위 첫 항목에서 확인했듯 코드·테스트·plan·docstring 과 현재 line-level 로 완전히 일치한다.
  - 위치: `.claude/docs/worktree-policy.md:73`
  - 상세: (근거는 위 참조)
  - 제안: 조치 불필요.

### 요약

3라운드에 걸친 리뷰·수정 이력을 소스에서 직접 재검증한 결과, 이번 작업의 표제 요구사항("§C won't-do 종결 + default-branch 넛지의 세그먼트 미검사 FN 해소")은 완전히 구현되고 테스트(13건, ReDoS 선형성 서브프로세스 검증 포함)로 고정돼 있으며, 이전 라운드의 WARNING 3건(정책 문서 SPEC-DRIFT, §J 주석 오배치, `test_line_anchors.py` HEAD 결속 flakiness)이 모두 정확히 반영됐음을 실행·grep·직접 호출로 확인했다(`.claude/tests` 관련 파일 47 passed, 39 subtests, 회귀 없음). 코드·docstring·`worktree-policy.md`·plan 문서 사이에 남은 line-level 불일치는 없다. 유일하게 계속 남아 있는 실질적 요구사항 위반은 `guard_review_before_push.py` 의 `_GIT_PUSH` 가 따옴표+공백 포함 `VAR=value` 접두에서 `git push` 를 놓쳐 review-before-push 게이트 전체를 조용히 우회한다는 것인데(재현 확인함), 이는 이번 diff 가 만든 결함이 아니라 이번 diff 가 처음 실측·문서화해 별건 PR(§J, 차단성 최우선)로 투명하게 스코프 아웃한 기존 결함이다 — requirement 관점에서는 스코프 판단이 타당하다고 보되, 최종 SUMMARY 단계에서 이 상태가 여전히 라이브임을 누락 없이 반영해야 한다. 그 외 발견한 것은 신규 테스트 헬퍼 docstring 의 문구가 실제 동작보다 강한 불변식을 암시하는 사소한 서술 문제 정도이며 기능 결함은 아니다.

### 위험도
LOW
