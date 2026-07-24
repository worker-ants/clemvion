# 테스트(Testing) 리뷰 — push guard §J 따옴표 env 접두 우회 수정

## 검증 방법

리뷰 대상 3파일(`guard_review_before_push.py`, `test_push_guard_allowlist.py`,
`plan/in-progress/harness-guard-followups.md`)을 정적으로 읽은 뒤, 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/zealous-benz-96022b`)에서 직접:

1. `python3 -m pytest .claude/tests/test_push_guard_allowlist.py -q` — 41 passed, 156 subtests passed.
2. `_GIT_PUSH` 를 옛 `\S+` 패턴으로 되돌리는 뮤테이션을 적용해 재실행 — `BlindPassFrozenTest`,
   `QuotedEnvPrefixTest`(6개 subTest 전부), `ReleasePathNarrownessTest` 총 8건이 실패로
   전환됨을 확인(비-vacuity 실측 확인, 이후 원복·clean 재통과 확인).
3. 새 `_GIT_PUSH` 패턴에 대해 직접 adversarial 입력(미종결 따옴표, 8만자 체인 `&&` 분리자 등)으로
   `_GIT_PUSH.search()` 시간을 측정 — 모두 밀리초 단위 선형 스케일링 확인(80,000자 입력 ~0.02s).

## 발견사항

- **[WARNING]** 새로 넓힌 `_GIT_PUSH` env-prefix alternation 에 대한 선형성/ReDoS 회귀 핀(pin)
  테스트가 없다.
  - 위치: `.claude/hooks/guard_review_before_push.py:107` (`_GIT_PUSH = re.compile(...)`) / 대응
    누락 지점은 `.claude/tests/test_push_guard_allowlist.py:372`의 `class BacktrackingTest`
    (여기 세 메서드 중 어느 것도 새 env-prefix alternation 을 adversarial 입력으로 타지 않음).
  - 상세: 이 파일 자체가 "손으로 짠 정규식을 검증 없이 바꾸면 catastrophic backtracking 이
    생긴다"는 실패 클래스를 이미 3라운드에 걸쳐(review 2026/07/23 14_23_23 C2 등) 실제로
    겪었고, 그 결과 `BacktrackingTest`/`InputSizeCapTest`가 "주장하지 말고 subprocess+timeout
    으로 측정하라"는 확립된 관행으로 자리잡았다(`_MESSAGE_ARG`, heredoc 소유권 프로브 각각
    전용 선형성 테스트 보유). 이번 PR 이 `_GIT_PUSH`에 추가한
    `(?:'[^']*'|"[^"]*"|[^\s'"]\S*)` alternation 은 동일 파일의 동일 관행 적용 대상에서
    빠졌다 — `ReleasePathNarrownessTest`(§J 잔여 검토)조차 "측정하지 말고 주장하는 것이 바로
    뒤집히는 종류의 실수"라고 스스로 서술하면서도, 정작 이 PR 의 핵심 변경(블로킹 패턴 자체)에는
    같은 원칙을 적용하지 않았다. 직접 측정 결과 현재는 선형(위 검증 3번)이라 당장 결함은 아니지만,
    이 회귀 핀이 없으므로 향후 이 alternation 을 누군가 다시 손보다가 지수적으로 되돌려도
    이 스위트는 잡지 못한다. 이 훅은 모든 Bash 호출을 동기 게이팅하므로(모듈 docstring 명시),
    그런 회귀는 세션 hang 으로 직결된다.
  - 제안: `BacktrackingTest`에 `_GIT_PUSH`(또는 `_is_git_push`) 전용 케이스를 추가한다 — 예:
    긴 미종결 따옴표 값(`'A="' + 'x'*N`), 다수의 `VAR="v" &&` 체인, 혼합 따옴표 유형 등을
    subprocess+timeout(기존 `_run_guard_out_of_process` 재사용)으로 측정해 상수 임계값을 고정.

- **[INFO]** CORPUS 의 새 §J 엔트리(6건, `'GIT_SSH_COMMAND="ssh -i ~/.key" git push origin main'`
  등)와 `QuotedEnvPrefixTest.test_quoted_env_prefix_is_detected`의 리터럴 문자열이 대부분
  중복된다.
  - 위치: `.claude/tests/test_push_guard_allowlist.py:98-109`(CORPUS 항목) vs
    `test_push_guard_allowlist.py:636-641`(`QuotedEnvPrefixTest` 루프 대상).
  - 상세: 두 위치가 답하는 질문이 다르다는 점(차등 코퍼스 vs 의도 문서화 전용 테스트)은
    파일 전체의 기존 관행과 일치하므로 결함은 아니다. 다만 리터럴이 그대로 반복돼 있어 한쪽만
    갱신되고 다른 쪽이 stale 로 남는 drift 위험은 존재한다(이 PR 자체가 CORPUS/pin 분리로
    §J 를 고친 사례이기도 하다). 낮은 우선순위 — 상수로 추출해 공유하면 이 리스크가 사라지지만,
    현재 두 목적(회귀 플로어/의도 문서화)을 분리해 유지하는 것도 합리적 트레이드오프다.

- **[INFO]** 따옴표 값의 경계 케이스(빈 값 `VAR=""`, 서로 다른 따옴표가 섞인 값
  `A='say "hi"'`, 값 내부에 실제로 `git`/`push` 단어가 들어간 `VAR="git push" git push`)가
  CORPUS 에 없다.
  - 위치: `.claude/tests/test_push_guard_allowlist.py` CORPUS 정의부(§J 섹션,
    게이트 94-109행).
  - 상세: 패턴 구조상(각 alternative 가 첫 글자로 서로소) 문제를 일으킬 가능성은 낮아 보이나,
    이 파일의 다른 섹션들이 "release-rule abuse attempts"·"C1/C2/C3 CRITICAL" 처럼 정확히 이런
    저확률 조합 케이스를 사전에 코퍼스화해 실측으로 반증해온 전례가 있어, 같은 패턴으로 몇 줄
    추가하는 비용 대비 안전판 가치가 있다.

## 긍정적 관찰

- `test_no_new_false_negatives`/`test_no_new_blocks`에 추가된 `assertGreater(compared/blocked,
  10, ...)` 비-vacuity 가드는 실효적이다 — CORPUS 나 `_LEGACY`/`_BLIND` 매칭이 어쩌다 텅 비어도
  테스트가 조용히 통과하지 않도록 막는다.
- `test_the_pin_targets_the_post_fix_pattern`은 핀(pin) 자체를 다시 핀으로 지키는 메타 테스트로,
  `_BLIND_PATTERN`이 실수로 `_LEGACY_PATTERN`으로 재동기화되는 회귀(§J 재발)를 막는다 — 설계가
  꼼꼼하다.
- `QuotedEnvPrefixTest`(구 `KnownFalseNegativeTest`)를 "버그를 assert" → "수정을 assert"로
  플립한 방식은 plan/PR 관행(같은 커밋에서 클래스 형태를 유지한 채 assertion 만 뒤집어 수정
  증명)과 일치하며, 회귀 발생 시 즉시 실패로 드러난다.
- `ReleasePathNarrownessTest`는 "안전 방향이니 괜찮다"는 주장을 실측으로 대체하는 이 파일의
  확립된 원칙을 그대로 따른다 — release 경로(`_SEGMENT_IS_GIT`)를 의도적으로 넓히지 않았음을
  좁은 반례(quoted owner)로 고정.
- 뮤테이션(옛 `\S+` 패턴으로 되돌림)으로 직접 검증한 결과 8개 테스트가 실패로 전환돼, 이 diff의
  테스트가 실제로 §J 결함을 잡아낸다는 주장이 vacuous 하지 않음을 독립적으로 확인했다.
- 모킹이 전혀 없고(`_harness.load_module_by_path`로 실제 모듈 로드), subprocess 기반
  타이밍 테스트도 out-of-process 실행이라 격리가 좋다. 테스트 간 공유 mutable 상태 없음(모듈
  레벨 CORPUS/RELEASED 는 read-only).

## 요약

이번 diff 는 push 게이트가 따옴표 있는 env 값 앞에서 탐지를 놓치던 차단성 결함(§J)을 고치면서,
차등 테스트 구조를 `_LEGACY_PATTERN`(불변 회귀 바닥)과 `_BLIND_PATTERN`(현행 blind 핀)으로
분리하고 새 corpus·전용 테스트 클래스·비-vacuity 가드를 추가했다. 직접 pytest 실행과 뮤테이션
검증으로 이 테스트들이 실제로 결함을 재현·고정함을 확인했으며, 테스트 격리·가독성·회귀 커버리지
모두 이 파일의 확립된 엄격한 관행(assert 대신 measure)을 잘 따른다. 유일한 실질적 갭은, 이
파일이 정확히 같은 이유(손으로 짠 정규식의 미측정 변경)로 세 차례 CRITICAL 을 겪어 만들어낸
`BacktrackingTest` 관행이 이번에 넓힌 `_GIT_PUSH` alternation 자체에는 적용되지 않았다는
점이다 — 직접 측정해 현재는 선형임을 확인했으므로 당장의 결함은 아니지만, 향후 회귀를 잡을
핀이 없다. 나머지는 사소한 코퍼스 확장 제안(INFO) 수준이다.

## 위험도

LOW
