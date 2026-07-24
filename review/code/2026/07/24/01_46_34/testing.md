# 테스트(Testing) 리뷰

## 리뷰 대상

- `.claude/hooks/guard_default_branch_bash.py` (`_MUTATING` — 후행 `\S+` 폴백 복원, docstring 갱신)
- `.claude/hooks/guard_review_before_push.py` (`_GIT_PUSH` 동일 변경, SoR 경로 정정)
- `.claude/tests/_harness.py` (`ENV_VALUE_SHAPES` 공유 상수 신설)
- `.claude/tests/test_guard_default_branch_bash_mutating.py` (`OldEnvPrefixSupersetTest` 신설, 회귀 테스트 뒤집기)
- `.claude/tests/test_push_guard_allowlist.py` (`_BLIND_PATTERN` 미러, `GeneratedFloorTest`/`KnownFalseNegativeTest` 신설, §K→§L 정정)
- `.claude/tests/README.md`, `plan/in-progress/harness-guard-followups.md` (문서 갱신)
- `review/code/2026/07/24/01_25_14/*` (직전 리뷰 라운드 산출물 — SUMMARY/RESOLUTION/per-agent 리포트, 코드 아님)

본 diff는 직전 리뷰(`01_25_14`, RISK=MEDIUM, Critical 0, Warning 4)의 RESOLUTION 반영 결과다. W1(모듈 docstring 자기모순)·W2(§K/§L 오기)·W3(`_VALUES` 중복→`_harness.ENV_VALUE_SHAPES` 단일화)·W4(`OldEnvPrefixSupersetTest`에 `test_no_duplicate_values`·`_MIN_COVERAGE` 비대칭 해소) 4건 전부를 소스에서 직접 확인했다 — 문서 서술이 아니라 실제 코드로 검증됨:

- `guard_default_branch_bash.py:33-37` — "unclosed quote 는 이제 매치됨, empty value 만 미매치"로 정정됨 (W1 확인).
- `test_push_guard_allowlist.py` 전체에 "§K" 잔존 없음, `KnownFalseNegativeTest`·plan 모두 "§L"로 일치 (W2 확인).
- `_harness.ENV_VALUE_SHAPES` (29개 값, 중복 없음)를 두 테스트 파일이 공유 (W3 확인).
- `OldEnvPrefixSupersetTest.test_no_duplicate_values` + `_MIN_COVERAGE = 10` 존재 (W4 확인).

로컬 재현:
```
python3 -m unittest test_guard_default_branch_bash_mutating test_push_guard_allowlist -v
→ Ran 71 tests ... OK  (214 subtests 포함, 결정적)
```

`_pre_quoted_is_mutating`가 `guard._MUTATING.pattern`을 `_SPLIT_MARKER = r"\s+)*(?:"`로 스플릿해 옛 프리픽스와 합성하는 방식도 직접 검증함 — 해당 마커는 컴파일된 패턴 문자열에 정확히 1회만 출현하여(`pattern.count(marker) == 1`) 스플릿이 모호하지 않음을 확인했다.

## 발견사항

- **[WARNING]** `OldEnvPrefixSupersetTest`가 "할당 개수" 축을 전혀 생성하지 않음 — 자신의 존재 이유로 삼은 그 축을 스스로 빠뜨림
  - 위치: `.claude/tests/test_guard_default_branch_bash_mutating.py:236` (`_COMMANDS`), `:249-250` (`_cases`)
  - 상세: 짝 클래스 `GeneratedFloorTest`(`test_push_guard_allowlist.py`)는 자신의 docstring에서 "두 회귀 모두 이 두 축의 상호작용이었다: env 값의 SHAPE, 그리고 명령 앞에 몇 개의 할당이 오는지"라고 명시하고, 실제로 `_TEMPLATES`에 `"A=1 B={v} git push"`, `"A={v} B=z git push"`, `"A={v} B={v} git push"` 등 값이 첫 번째가 아닌 위치·복수 할당에 놓이는 경우를 포함한다. 반면 넛지 훅의 `OldEnvPrefixSupersetTest._cases()`는 `[f"A={v} {c}" for v in self._VALUES for c in self._COMMANDS]`로, 값이 항상 유일하고 유일한 할당인 경우만 생성한다 — "할당 개수" 축이 고정(=1)이다. `_MUTATING`의 프리픽스도 동일한 반복 그룹(`(?:...=...\s+)*`)이므로, 어떤 위치의 반복이든 대안 실패 시 프리픽스가 그 지점에서 붕괴하는 동일한 회귀 메커니즘을 공유한다. 두 훅이 "같은 방식으로 두 번 회귀"했다는 이번 diff 전체의 전제(plan J-후속 절)에 비춰보면, 짝 테스트 한쪽만 이 축을 검증하는 것은 실제 커버리지 갭이다 — 값 형태는 첫 위치에서 항상 정상이지만 두 번째 이후 위치에서만 실패하는 (가상의) 미래 리팩터링을 이 테스트는 잡지 못한다.
  - 제안: `OldEnvPrefixSupersetTest._cases()`에도 `GeneratedFloorTest._TEMPLATES`와 대칭적으로 `f"A=1 B={{v}} {{c}}"`, `f"A={{v}} B=z {{c}}"` 같은 다중 할당 템플릿을 추가. (분리자(`&&`/`;`/`|`) 임베디드 템플릿은 넛지 훅이 매칭 전에 `_SEGMENT_SPLIT`로 이미 세그먼트 분리를 하므로 대칭 불필요 — 이 부분만 push 가드와 다른 게 아키텍처 차이로 정당함.)

- **[INFO]** §L(닫는 따옴표 뒤 문자가 붙는 값) 캐너리가 push 가드에만 있고 넛지 훅에는 없음 — 이미 "공유 갭"으로 문서화된 채 방치
  - 위치: `.claude/tests/test_push_guard_allowlist.py:891-928` (`KnownFalseNegativeTest`, push 가드 전용); `.claude/tests/test_guard_default_branch_bash_mutating.py` 전체 — 대응 클래스 없음
  - 상세: `plan/in-progress/harness-guard-followups.md` §L 절은 "넛지 훅 `_MUTATING` 도 같은 갭을 공유한다(넛지라 영향은 작음)"이라고 서술하지만, 이 주장을 검증하는 테스트는 없다 — 산문으로만 존재한다. `_harness.ENV_VALUE_SHAPES`에 §L 형태(`'"a b"c'` 등)가 이미 포함돼 `OldEnvPrefixSupersetTest`의 생성 케이스에도 들어가지만, 그 클래스는 "옛 패턴 대비 손실 없음"만 검증할 뿐 §L 형태가 옛 패턴에서도 새 패턴에서도 똑같이 실패한다는 사실 자체는 어느 assertion 도 명시적으로 확인하지 않는다(우연히 둘 다 실패해 `test_no_classification_is_lost`를 통과시킬 뿐).
  - 제안: 넛지 훅 쪽에도 `KnownFalseNegativeTest`의 축소판(`_is_mutating("A=\"a b\"c mkdir foo")`가 여전히 `False`임을 pin)을 추가하면, plan의 "공유 갭" 주장이 산문이 아니라 실행 가능한 단언이 된다. 우선순위는 낮음(넛지는 차단하지 않음, 이미 백로그에 기록됨) — 조치 불요로 종결해도 무방.

- **[INFO]** `_MIN_COVERAGE`/`_MIN_CORPUS_COVERAGE = 10` 비-vacuity 하한이 훨씬 커진 생성 케이스 모집단 대비 매우 느슨함
  - 위치: `.claude/tests/test_guard_default_branch_bash_mutating.py:239` (`_MIN_COVERAGE = 10`); `.claude/tests/test_push_guard_allowlist.py:66` (`_MIN_CORPUS_COVERAGE = 10`, 재사용처는 `:391` `test_the_generated_set_actually_exercises_the_floor`)
  - 상세: 이 상수는 원래 손으로 작성한 `CORPUS`(수십 건)의 vacuity 방지용으로 존재했다. 이번 diff가 신설한 `GeneratedFloorTest`/`OldEnvPrefixSupersetTest`는 각각 116건(29값×4명령)·203건(29값×7템플릿) 규모의 생성 케이스에 같은 절대값 10을 재사용한다 — 전체의 5~9%만 엔진에 걸려도 "vacuous 아님" 판정을 통과한다. 리팩터링이 생성 케이스의 대부분(예: 90%)을 조용히 무력화해도 이 하한은 여전히 초록일 수 있다.
  - 제안: 절대값 대신 `len(self._cases()) * 비율` 같은 상대적 하한으로 바꾸거나, 최소한 현재 실측치(84/116, 68/108 등 — 직전 리뷰 SUMMARY가 이미 인용한 수치)에 근접한 값으로 상수를 올리는 것을 검토. 우선순위는 낮음 — 기존 설계(고정 상수 10)를 그대로 답습한 것이므로 이번 diff가 새로 들여온 결함은 아니다.

## Mock/격리/가독성 평가

- Mock/stub 없음 — 순수 정규식·함수 호출 기반 테스트(`_is_mutating`, `_is_git_push`, `legacy_is_push`, `blind_is_push`). `_is_git_push`는 실제 훅의 `main()`이 호출하는 바로 그 함수이므로 실제 동작과의 괴리 없음.
- 격리: 파일 I/O·전역 상태·순서 의존성 없음. `OldEnvPrefixSupersetTest`가 `guard._MUTATING.pattern` 문자열을 파싱해 재구성하는 방식은 스스로를 검증하는 자기-점검 테스트(`test_the_frozen_prefix_still_composes`)를 갖추고 있어, 마커 소실 시 조용히 무의미해지는 것을 방지한다 — 직접 실행해 마커가 패턴에 정확히 1회 존재함을 재확인했다.
- 가독성: 각 클래스 docstring이 "왜 생성 방식인지"·"이전에 무엇이 잘못됐는지"를 회귀 근거(리뷰 라운드, PR 번호)까지 인용해 서술 — 저장소 컨벤션과 일치.
- 회귀 테스트 유효성: `test_malformed_env_values_stay_unmatched` → `test_unterminated_quote_still_matches`로 어서션이 뒤집힌 부분은, 이전 리비전이 버그를 "의도된 갭"으로 잘못 pin했던 사실을 스스로 지적하며 교정한 것으로, RESOLUTION.md가 기록한 뮤테이션 검증(Q1/Q2/Q3' 전부 RED 재현)과 함께 신뢰할 수 있음을 직접 실행으로 재확인했다.
- 탈출구 방지: RESOLUTION.md가 스스로 보고한 "공유 리스트에서 미종료 따옴표 형태를 지우면 아무 테스트도 실패하지 않았다"(Q3 GREEN) 문제를 `test_the_regression_shapes_are_still_generated`로 막은 것은 이 리뷰가 특히 높이 평가하는 지점 — 생성 기반 테스트의 전형적 실패 모드(입력을 빼서 실패하는 테스트를 통과시키는 것)를 이름 붙은 회귀 형태 고정으로 구조적으로 차단했다.

## 요약

직전 리뷰(01_25_14)의 Warning 4건(모듈 docstring 자기모순, §K/§L 오기, `_VALUES` 중복, 비대칭 안전장치)이 소스 코드 상에서 정확히 반영됐음을 직접 읽고 실행해 확인했다. 71개 테스트·214개 subtest가 로컬에서 결정적으로 통과하며, `EnvValueSubpatternSharedTest`(3곳 동기화)·`test_blind_pattern_is_frozen`(추가 1곳 동기화)이 훅 2개+테스트 미러 1개의 드리프트를 자동 차단하는 구조도 확인했다. 다만 새로 신설된 두 "생성 기반 floor" 테스트(`GeneratedFloorTest` vs `OldEnvPrefixSupersetTest`)를 나란히 놓고 보면, push 가드 쪽이 명시한 "값 형태 × 할당 개수" 두 축 중 후자를 넛지 훅 쪽이 재현하지 않는 비대칭이 있다 — 이번 diff 전체의 핵심 교훈("두 훅이 같은 방식으로 두 번 회귀했다")에 비춰보면 이는 사소하지 않은 커버리지 갭이라 WARNING으로 기재했다. 나머지(§L 넛지 캐너리 부재, 비-vacuity 하한의 낮은 비율)는 이미 문서화·저우선순위로 관리 중인 사안이라 INFO로 남긴다. 전체적으로 이 diff의 테스트 설계·엄밀성(뮤테이션 검증, 탈출구 차단, 자기-점검 테스트)은 이 저장소의 하네스 테스트 중에서도 상위 수준이다.

## 위험도
LOW
