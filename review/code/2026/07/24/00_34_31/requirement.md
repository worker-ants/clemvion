# 요구사항(Requirement) Review

## 발견사항

- **[CRITICAL]** §J 수정이 불완전하다 — 큰따옴표 env 값에 **이스케이프된 내부 큰따옴표**(`\"`)가 있으면 여전히 push 탐지가 완전히 우회된다 (실측 재현).
  - 위치: `.claude/hooks/guard_review_before_push.py:108` (`_GIT_PUSH` 의 `"[^"]*"` 대안); 관련 테스트 갭 `.claude/tests/test_push_guard_allowlist.py` CORPUS 신규 항목(94~109 부근, §J 커버리지); 완료 표기 `plan/in-progress/harness-guard-followups.md:449`, `:483`("✅ 해소").
  - 상세: 실제로 코드를 실행해 재현했다.
    ```python
    guard._is_git_push('GIT_AUTHOR_NAME="A \\"B\\" C" git push')          # -> False (탐지 안 됨)
    guard._is_git_push('GIT_COMMITTER_NAME="John \\"JD\\" Doe" git push') # -> False (탐지 안 됨)
    guard._is_git_push('cd /tmp && GIT_AUTHOR_NAME="A \\"B\\" C" git push') # -> False
    ```
    이 값들은 유효한 bash 구문이다(`\"` 는 큰따옴표 문자열 내부에서 이스케이프된 리터럴 큰따옴표). `_is_git_push` 가 `False` 를 반환하면 `main()` 은 `_is_git_push` 검사에서 즉시 `return 0` 하므로 REVIEW/PLAN 두 게이트 모두 실행되지 않고, **fail-open 배너조차 뜨지 않는다** — 이 hook 의 최상단 docstring 이 스스로 "가장 조용한 실패"라고 명시하는 바로 그 실패 모드다. §J 는 정확히 "따옴표 안에 공백이 있으면 `\S+` 가 끊긴다"는 결함을 고치는 것이 목적이었는데, 새 대안 `"[^"]*"` 은 공백 문제는 고쳤지만 **이스케이프 인식이 없어** 내부에 `\"` 가 있는 값에서는 여전히 조기 종료 후 `\s+` 매치가 실패해 전체 패턴이 매치되지 않는다. legacy 패턴도 이 특정 케이스는 원래 놓쳤으므로(사전 검증함) 회귀는 아니지만, plan 체크리스트(`harness-guard-followups.md` §J, `- [x] ✅ ... 해소`)는 "차단성 — 최우선" 항목을 **완전히 해소**했다고 선언하는데 실제로는 같은 취약점 클래스의 변형이 여전히 열려 있다.
    흥미롭게도 같은 파일 안 `_MESSAGE_ARG` 는 이미 이스케이프-인식 큰따옴표 바디(`(?:\\.|[^"\\])*`)를 올바르게 구현하고 있다(C1/C2 리뷰에서 다듬어짐) — 새 env-prefix 대안이 그 기법을 재사용하지 않고 `guard_default_branch_bash._MUTATING` 의 순진한 `"[^"]*"` 를 그대로 가져온 탓에 이 갭이 생겼다.
  - 제안: env-prefix 큰따옴표 대안에도 `_MESSAGE_ARG` 와 동일한 이스케이프-인식 바디(`(?:\\.|[^"\\])*`)를 적용하거나(양쪽 훅 동시 갱신 + byte-for-byte 핀·차등 코퍼스 갱신), 최소한 이 잔여 갭을 `KnownRemainingFalsePositiveTest` 류로 명시적으로 문서화·코퍼스에 등재하고 plan §J 를 "완전 해소"가 아니라 "부분 해소 + 잔여 갭"으로 정정한다.

- **[WARNING]** `_GIT_PUSH` 바로 위 "KNOWN DEFECT ... fix pending in its own PR" 주석이 이번 diff로 인해 완전히 stale 해졌다 — 주석은 아직 안 고쳤다고 말하지만 바로 아래 코드는 이미 고쳐져 있다.
  - 위치: `.claude/hooks/guard_review_before_push.py:97-106`
  - 상세: 이 주석 블록(97~106행)은 "env-prefix group below uses `\S+`... The fix is `(?:'[^']*'|"[^"]*"|[^\s'"]\S*)` (already applied in guard_default_branch_bash.py), but changing THIS string also means updating the byte-for-byte pin ... hence the separate PR" 라고 서술한다. 그런데 바로 아래 107~110행의 `_GIT_PUSH` 는 이번 diff 에서 정확히 그 "별도 PR"의 수정(따옴표 3-대안)을 이미 적용했다. 즉 주석은 "아직 안 고쳤고 별도 PR 이 필요하다"고 말하는데, 이 diff 자체가 바로 그 별도 PR 이며 수정이 이미 반영된 상태 — 주석과 구현이 정면으로 모순된다. 향후 이 파일을 읽는 개발자/에이전트가 "결함이 아직 살아있다"고 오판하거나 이미 적용된 수정을 중복 시도할 위험이 있다.
  - 제안: 97~106행의 "KNOWN DEFECT ... fix pending in its own PR" 단락을 제거하거나, "FIXED (2026-07-24, harness-guard-followups §J)"로 갱신해 현재 코드 상태와 일치시킨다. `_SEGMENT_IS_GIT` 에 대한 후반부 서술(105~106행, 여전히 정확함)은 유지.

- **[INFO]** `_GIT_PUSH` 의 env-value 대안과 `guard_default_branch_bash._MUTATING` 의 대안이 "byte-identical 하게 유지한다"고 3곳의 주석(`guard_review_before_push.py:108` 부근, `test_push_guard_allowlist.py:67-69`, `test_push_guard_allowlist.py:626-628`)에서 주장되지만, 이를 실제로 대조·고정하는 테스트는 없다. 이 저장소는 정확히 이런 "주장되지만 검증 안 된 동기화" 클래스의 drift 를 여러 번 겪었다(예: `test_dependabot_npm_coverage.py`, `test_e2e_exemption_paths_sync.py` 같은 전용 pin 테스트를 만든 선례). 한쪽 패턴만 나중에 수정되면 아무 테스트도 drift 를 잡지 못한다.
  - 위치: `.claude/hooks/guard_review_before_push.py:108`, `.claude/hooks/guard_default_branch_bash.py:99-101`(해당 파일은 이번 diff 밖)
  - 제안: 두 패턴의 quoted-value 부분 문자열을 직접 비교하는 짧은 pin 테스트 추가(예: `guard._GIT_PUSH.pattern` 에서 env-value 대안 서브스트링을 추출해 `gdbb._MUTATING.pattern` 의 해당 서브스트링과 동일한지 assert). 필수는 아니며 낮은 우선순위.

- **[INFO]** `.claude/hooks/guard_review_before_push.py:91` 의 `SoR: plan/in-progress/harness-push-guard-subcommand-detection.md` 참조가 dangling 이다 — 해당 plan 은 이미 `plan/complete/harness-push-guard-subcommand-detection.md` 로 이동됐다. 이번 diff 가 건드린 줄은 아니고(pre-existing), 낮은 우선순위.
  - 위치: `.claude/hooks/guard_review_before_push.py:91`
  - 제안: 경로를 `plan/complete/harness-push-guard-subcommand-detection.md` 로 갱신(별건으로 처리 가능).

## 스펙 정합성 메모

이 변경은 제품 `spec/` 문서가 아니라 harness 하네스 코드(`.claude/hooks/`, `.claude/tests/`)이며, `spec/` 어디에도 `guard_review_before_push`/`_GIT_PUSH`/"review gate" 참조가 없다(grep 0건) — 이 영역의 단일 진실은 `plan/in-progress/harness-guard-followups.md` §J 이다. 그 plan 본문과 diff 는 "따옴표 안 공백" 케이스에 한해서는 line-level 로 일치한다(3-대안 패턴, `_LEGACY_PATTERN`/`_BLIND_PATTERN` 분리, `test_no_new_blocks` 기준 교정, `_SEGMENT_IS_GIT` 는 의도적으로 그대로 둠 — 모두 실측·테스트로 확인됨). 다만 plan 이 §J 를 "차단성 — 최우선, ✅ 완전 해소"로 표기한 것은 위 CRITICAL 발견사항(이스케이프된 따옴표 변형)이 남아 있어 과장된 서술이다.

## 검증 방법

- `.claude/tests/test_push_guard_allowlist.py` 전체 실행: 41 tests / 156 subtests 모두 통과.
- diff 의 실제 소스(`guard_review_before_push.py`, `guard_default_branch_bash.py`)를 직접 로드해 대화형으로 `_is_git_push`/`_MUTATING`/`_SEGMENT_IS_GIT` 를 재현·검증(위 CRITICAL 은 실제 코드 실행으로 확인, 추정 아님).
- 신규 정규식의 ReDoS 여부를 인접 adversarial 입력(3만자 미종료 따옴표, 반복 `IDENT=` 체인)으로 타이밍 확인 — 선형, 문제 없음.
- `plan/in-progress/harness-guard-followups.md` 체크리스트·본문과 실제 코드/테스트 대조, `plan/complete/`·`plan/in-progress/` 실제 파일 위치 확인.

## 요약

이번 PR 은 harness push-guard 의 §J(따옴표 안에 공백이 있는 env 접두가 push 탐지를 완전히 우회하던 차단성 결함)를 목표한 케이스에 한해 정확히 수정했고, 회귀 방지용 차등 테스트(legacy floor vs blind pin 분리, `test_no_new_blocks` 기준 교정, `ReleasePathNarrownessTest` 로 release 경로 미변경 실측)까지 꼼꼼히 갖췄다 — 전체 테스트(41/156 subtests)도 통과한다. 다만 실제 코드를 실행해 검증한 결과, 새 큰따옴표 대안(`"[^"]*"`)이 이스케이프 인식이 없어 env 값 내부에 `\"` 가 있는 (유효한 bash) 케이스에서는 여전히 push 탐지가 완전히 우회되며 fail-open 배너조차 뜨지 않는다 — §J 가 고치려던 것과 동일한 실패 클래스의 변형이 잔존한다. plan 체크리스트가 이를 "완전 해소"로 표기한 것은 그 잔여 갭을 반영하지 않은 과장이다. 부수적으로 `_GIT_PUSH` 바로 위의 "KNOWN DEFECT ... fix pending in its own PR" 주석이 이번 diff로 인해 코드와 모순되는 stale 상태가 됐다.

## 위험도
HIGH
