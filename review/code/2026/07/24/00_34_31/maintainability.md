# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 정규식은 고쳤지만 바로 위 "KNOWN DEFECT ... fix pending in its own PR" 주석이 그대로 남아, 이미 고쳐진 결함을 여전히 "대기 중"이라고 서술한다.
  - 위치: `.claude/hooks/guard_review_before_push.py:97-106` (`_GIT_PUSH` 정의 바로 위 블록 주석)
  - 상세: 이 diff 는 `_GIT_PUSH` 의 env-prefix 그룹을 `\S+` → `(?:'[^']*'|"[^"]*"|[^\s'\"]\S*)` 로 수정해 §J 결함(따옴표 안 공백값이 push 탐지를 무력화하는 문제)을 실제로 해소했다. 그런데 바로 위 97~106행 주석은 여전히 "KNOWN DEFECT (harness-guard-followups §J, fix pending in its own PR)"·"The fix is `(?:'[^']*'|"[^"]*"|[^\s'\"]\S*)` (already applied in guard_default_branch_bash.py), but changing THIS string also means updating the byte-for-byte pin ... hence the separate PR" 라고 적어 놓았다. 즉 코드는 이미 그 "별도 PR"이 된 상태인데, 주석은 여전히 "아직 안 고쳤다"는 과거 시제로 남아 모순이 발생한다. 이 파일은 자기 자신을 "review-before-push 의 유일한 hard gate"라 규정하고 주석을 사실상 SoT 로 다루는 코드베이스(§`DO NOT EDIT` 류 지시)이므로, 다음 유지보수자가 이 주석만 보고 "아직 안 고쳐진 결함"으로 오인해 중복 조사·중복 PR 을 만들 위험이 있다.
  - 제안: 97~106행을 코드 변경과 같은 커밋에서 "FIXED (§J, resolved 2026-07-24)" 류로 되돌아보는 서술로 교체하거나, `_SEGMENT_IS_GIT` 은 여전히 옛 `\S+` 를 의도적으로 유지한다는 사실만 남기고 `_GIT_PUSH` 관련 "pending" 서술은 제거한다.

- **[WARNING]** 위와 같은 이유로, 이 diff 밖의 자매 파일 주석도 이제 사실과 어긋난다.
  - 위치: `.claude/hooks/guard_default_branch_bash.py:95-98` (diff 대상 파일은 아니지만 이 변경으로 인해 내용이 stale 해짐)
  - 상세: "NOTE: `guard_review_before_push.py` carries a near-identical env-prefix group in `_GIT_PUSH`/`_SEGMENT_IS_GIT` and still has the `\S+` form ... Tracked separately as harness-guard-followups §J" 라고 되어 있다. 이번 수정으로 `_GIT_PUSH` 는 더 이상 `\S+` 형태가 아니고(`_SEGMENT_IS_GIT` 만 의도적으로 남음), §J 도 plan 상 해소(✅)로 표시됐다. 두 파일이 서로를 참조하며 "동기화해서 봐야 한다"고 명시한 만큼, 한쪽만 고치고 다른 쪽 주석을 갱신하지 않으면 바로 이 코드베이스가 반복해서 겪어온 "손으로 동기화해야 하는 문서 drift" 패턴이 재발한다.
  - 제안: 같은 PR(또는 즉시 후속)에서 이 NOTE 를 "`_GIT_PUSH` 는 §J 로 이미 수정 완료, `_SEGMENT_IS_GIT` 만 의도적으로 `\S+` 유지(release 경로라 안전 방향)"로 갱신.

- **[INFO]** `(?:'[^']*'|"[^"]*"|[^\s'\"]\S*)` 서브패턴이 두 훅 파일(`guard_review_before_push.py::_GIT_PUSH`, `guard_default_branch_bash.py::_MUTATING`)과 테스트 파일(`test_push_guard_allowlist.py::_BLIND_PATTERN`)에 리터럴로 3중 중복되어 있고, 이를 강제하는 자동 크로스파일 동일성 테스트는 없다("byte-identical 하게 유지" 라는 주석상 약속뿐).
  - 위치: `.claude/hooks/guard_review_before_push.py:108`, `.claude/tests/test_push_guard_allowlist.py:69-72`
  - 상세: `test_blind_pattern_is_frozen` 은 `guard._GIT_PUSH.pattern == _BLIND_PATTERN`(같은 파일 내부 핀)만 검증하고, `guard_default_branch_bash._MUTATING` 과의 동일성은 어떤 테스트도 확인하지 않는다. §C 백로그가 "판정 로직 자체의 공유"는 이득이 없다고 결론 냈지만, 이 좁은 서브패턴 리터럴의 수기 동기화 문제는 별개 사안이라 여전히 남아있다.
  - 제안: 급하지 않으나, 두 훅의 env-value 서브패턴이 실제로 문자열 동일한지 asserting 하는 소규모 pin 테스트 하나를 추가하면(예: `test_push_guard_allowlist.py` 에서 `guard_default_branch_bash` 를 import 해 부분 문자열 비교) drift 를 자동으로 잡을 수 있다.

- **[INFO]** `assertGreater(..., 10, ...)` vacuity-가드 임계값 `10` 이 `test_no_new_false_negatives`/`test_no_new_blocks` 두 곳에 매직 넘버로 중복.
  - 위치: `.claude/tests/test_push_guard_allowlist.py` `DifferentialTest.test_no_new_false_negatives`(`compared` 카운터)와 `test_no_new_blocks`(`blocked` 카운터)
  - 상세: 두 자리 모두 "테스트가 실질적으로 뭔가 비교/차단했는지" 를 검증하는 동일한 목적의 임계값 `10` 을 하드코딩한다. 의미상 관련된 숫자를 이름 있는 상수로 뽑으면 왜 `10`인지(코퍼스 크기 대비 최소 커버리지)와 두 테스트가 같은 하한을 공유한다는 의도가 더 분명해진다.
  - 제안: 모듈 레벨에 `_MIN_CORPUS_COVERAGE = 10` 같은 상수를 두고 두 곳에서 재사용.

- **[INFO]** `legacy_is_push(command)` 가 `test_no_new_false_negatives` 루프 안에서 매 반복마다 두 번 호출된다.
  - 위치: `.claude/tests/test_push_guard_allowlist.py` `DifferentialTest.test_no_new_false_negatives`
  - 상세: `if legacy_is_push(command): compared += 1` 다음 줄에서 `if legacy_is_push(command) and not guard._is_git_push(command):` 로 같은 함수를 다시 호출한다. 순수 함수라 정확성엔 문제 없지만 중복 호출이며, 지역 변수로 한 번만 계산해 재사용하면 더 읽기 쉽다.
  - 제안: `is_legacy = legacy_is_push(command)` 로 한 번 계산 후 두 조건에서 재사용.

- **[INFO]** `legacy_is_push`/`blind_is_push` 두 헬퍼 함수가 컴파일된 패턴 참조 하나만 다르고 몸체가 완전히 동일하다.
  - 위치: `.claude/tests/test_push_guard_allowlist.py:76-87`
  - 상세: 각 4줄짜리 짧은 함수라 실질 비용은 낮지만, "push" 부분 문자열 가드 + `.search()` 패턴이 그대로 반복된다.
  - 제안: 원한다면 `def _matches(pattern, command) -> bool: return bool(command) and "push" in command and bool(pattern.search(command))` 형태 공용 헬퍼로 묶을 수 있으나, 두 함수가 서로 다른 의미(legacy vs blind)를 대표하는 이름으로 남는 편이 테스트 가독성엔 더 나을 수도 있어 우선순위는 낮다.

## 요약

이번 변경은 §J(따옴표를 포함한 env 접두 값이 push 탐지를 무력화하던 차단성 결함)를 정확히 겨냥한 좁은 범위의 수정이며, 정규식 자체는 이미 자매 훅(`guard_default_branch_bash.py::_MUTATING`)에서 검증된 3-대안 패턴을 그대로 재사용했고, 회귀 코퍼스·차등 테스트·핀 테스트·"release 경로는 의도적으로 안 넓힌다"는 경계 테스트까지 꼼꼼히 갖췄다는 점에서 코드 품질 자체는 높다. 다만 정작 고쳐진 결함을 설명하던 "KNOWN DEFECT ... fix pending" 주석 블록이 같은 커밋에서 갱신되지 않아 코드와 주석이 서로 모순되며, 이 모순은 자매 파일의 상호 참조 주석까지 전염되어 있다 — 이 코드베이스가 반복해서 겪어온 "문서/주석 수기 동기화 drift" 패턴의 재발이다. 그 외에는 매직 넘버 하드코딩, 서브패턴 3중 리터럴 중복(자동 동일성 검증 부재), 사소한 중복 호출 등 경미한 사항뿐이다.

## 위험도
LOW
