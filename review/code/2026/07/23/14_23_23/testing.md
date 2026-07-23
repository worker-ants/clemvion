# 테스트(Testing) 리뷰 — push guard allowlist (`guard_review_before_push.py` + `test_push_guard_allowlist.py`)

## 발견사항

- **[CRITICAL]** 차등 테스트 코퍼스 갭 — `legacy(c) ⇒ new(c)` 불변식을 실제로 깨는, 재현 가능한 케이스가 코퍼스에 없어 테스트가 통과한다
  - 위치: `.claude/hooks/guard_review_before_push.py::_redact_inert_text`(`-m`/`-F` 메시지 값 블랭킹) + `.claude/tests/test_push_guard_allowlist.py::CORPUS`/`RELEASED`
  - 상세: 커밋 메시지에 우연히 "push" 라는 단어가 들어 있고(이 저장소 자체가 매우 자주 쓰는 단어), **같은 압축 명령 안 다른 곳에 `$(git push ...)` 형태의 진짜 실행 가능한 push 가 별도 인자로 존재**하면, 새 가드는 이를 조용히 통과(release)시킨다. 실측:
    ```
    legacy=True  new=False
    git commit -m "fix: retry push notification bug" && echo "log: $(git push origin main)"
    legacy=True  new=False
    git commit -m "docs: mention push guard" && VAR="$(git push)" && echo "$VAR"
    ```
    원인: `$(...)` 안의 `git push` 는 앞에 `^`/`&&`/`;`/`|` 가 직접 오지 않으면 blind 1차 정규식 자체가 절대 못 잡는다(이는 plan 문서가 "알려진 선재 갭" 으로 이미 인정한 한계 — `printf %s "$(git push)"` 단독으로도 legacy/new 둘 다 `False`). 문제는 **레거시가 이 조합에서 "우연히"(메시지 속 무관한 "push" 단어 매칭으로) `True` 를 반환했었는데**, 이번 PR 의 `-m` 값 블랭킹 규칙이 그 "우연한 매치"를 정확히 지워버려 **결과적으로 실제 push 는 하나도 탐지되지 않은 채 전체가 `False` 로 뒤집힌다**는 것. `test_no_new_false_negatives` 는 오직 고정 `CORPUS` 리스트만 순회하므로, 이 조합 shape 가 코퍼스에 없어 테스트는 초록이지만 스위트 자신이 선언한 안전 불변식(`legacy(c) and not new(c)` ⇒ 반드시 `RELEASED` 에 등재)은 실제로는 깨져 있다.
  - 왜 CRITICAL 인가: (1) 트리거 조건이 지어낸 것이 아니라 이 저장소가 실제로 자주 쓰는 커밋 메시지 패턴(예: "push guard", "push 오탐" 등 — 최근 커밋 로그·plan 문서에 반복 등장)과 결합하면 바로 재현된다. (2) 가드의 존재 이유가 "리뷰 없는 push 를 막는 유일한 hard gate" 라고 파일 docstring 이 명시하는데, 바로 그 대칭 테스트(`test_no_new_false_negatives`)가 이 케이스를 놓친다. (3) `_MESSAGE_ARG` 규칙 자체(값 안의 `$(`/backtick 검사)는 정확하지만, "블랭킹 대상이 아닌 나머지 문자열에 이미 존재하던 다른 실행 가능 표현식"까지는 검토 범위 밖이라는 설계상 사각지대다.
  - 제안: 이 조합 shape 를 `CORPUS` 에 최소 1~2건 추가해 실패를 드러낸 뒤, 다음 중 하나로 명시적으로 처리한다 — (a) `KnownRemainingFalsePositiveTest` 처럼 "이미 존재하던 선재 갭의 연장선"으로 의도적으로 pin 하고 plan 문서에 이유를 남기거나, (b) `_redact_inert_text` 가 "블랭킹 후 전체 문자열에 `$(`/backtick/`${` 라이브 토큰이 하나라도 남아 있으면 release 자체를 보류"하도록 좀 더 보수적으로 만든다(현재는 라이브 토큰 검사가 매칭된 `body` 국소 범위에만 적용됨). 어느 쪽이든 지금처럼 "코퍼스에 없어서 안 걸림" 상태로 두면 안 된다.

- **[WARNING]** `git tag ... -F -` heredoc 해제 경로가 완전히 무테스트
  - 위치: `.claude/hooks/guard_review_before_push.py::_COMMIT_STDIN_CMD`(정규식이 `(?:commit|tag)` 로 명시적으로 `tag` 를 지원) / `.claude/tests/test_push_guard_allowlist.py`
  - 상세: `CORPUS`·`RELEASED`·전용 테스트 어디에도 `"tag"` 문자열이 한 번도 등장하지 않는다(`grep -n tag test_push_guard_allowlist.py` 결과 0건). 직접 실행해 확인한 결과 `git tag -F - <<'EOF'\n...\nEOF` 형태는 실제로 해제되어 동작은 맞다:
    ```
    git tag -F - <<'EOF'\nrelease notes mention push\nEOF  -> False (released)
    git tag -a v1.0 -F - <<'EOF'\nfoo && git push\nEOF      -> False (released)
    ```
    하지만 이 분기는 완전히 미검증 상태라, 향후 `_COMMIT_STDIN_CMD` 리팩터링 시 `tag` 대체분기가 조용히 깨져도(또는 우발적으로 과확장돼도) 어떤 테스트도 잡지 못한다.
  - 제안: `CORPUS`/`RELEASED` 에 `git tag -F -` 케이스 1~2건, 그리고 `ReleaseRefusedTest` 계열에 "tag 인데 소유 세그먼트 위장" 같은 대칭 케이스를 최소 1건 추가.

- **[INFO]** 빈 heredoc 본문(zero-length body) 경계 케이스가 무테스트
  - 위치: `.claude/hooks/guard_review_before_push.py::_blank_commit_heredocs` (주석: "Strictly advance: a zero-length body must not re-scan the same opener.")
  - 상세: 코드에 이 경계를 위한 명시적 방어 주석/로직이 있는데도 회귀 테스트가 없다. 수동 검증(`git commit -F - <<'EOF'\nEOF`, 연속 2개의 빈 heredoc)으로는 무한루프 없이 정상 동작함을 확인했으나, 이 방어 로직 자체를 겨냥한 회귀 테스트가 없어 향후 리팩터링이 이 불변식을 깨도 감지되지 않는다.
  - 제안: 빈 heredoc 본문 1건을 코퍼스 또는 별도 유닛 테스트로 pin(가능하면 `pos` 가 실제로 전진하는지까지 어설션하거나, 최소한 결과값 + 무한루프 없음을 타임아웃 있는 서브프로세스로 확인).

- **[INFO]** `-F "quoted value"` 직접 인자 형태(파일명 인자)가 heredoc `-F -` 관용구와 동일 규칙(`_MESSAGE_ARG`)으로 블랭킹되지만 별도 테스트·문서 구분이 없음
  - 위치: `.claude/hooks/guard_review_before_push.py::_MESSAGE_ARG`(주석: "`-m "…"` / `--message="…"` / `-F "…"` values")
  - 상세: `git commit -F "<파일명>"` 은 실제로는 그 인용 문자열이 메시지 "값"이 아니라 메시지를 읽어올 **파일 경로**다. 코드가 이를 메시지 텍스트인 것처럼 취급해 블랭킹해도 안전 방향(정적 인용 문자열은 라이브 토큰이 없는 한 항상 inert)이라 보안 결함은 아니지만, 테스트/주석이 이 구분을 명시하지 않아 향후 유지보수자가 `-F` 의 진짜 의미(파일 기반 메시지)를 오해한 채 새 규칙을 얹을 여지가 있다.
  - 제안: 우선순위 낮음. 주석에 "`-F` 의 인용 인자는 파일 경로일 수 있지만, 어차피 정적 텍스트라 블랭킹은 안전하다" 정도의 한 줄 명확화만 있어도 충분.

## 회귀·기존 테스트 확인 (직접 실행)

- `.claude/tests/test_push_guard_allowlist.py` 17건 전체 통과, `.claude/tests/test_guard_review_before_push_main.py`(§D, `main()` e2e) 20건 전체 통과, 전체 하네스 스위트(`python3 -m unittest discover`) 359건 전체 통과 — plan 문서의 "전체 스위트 359건" 서술과 일치.
- 비-vacuity 스팟체크: `_MESSAGE_ARG` 매칭에서 `_is_inert()` 필터를 제거하는 뮤턴트를 직접 적용해 재실행한 결과 `test_no_new_false_negatives`(2건) + `ReleaseRefusedTest`(2건) = 4건 실패로 확인됨(plan 이 주장한 "확장 검사 제거 6 실패"와 정확히 일치하진 않지만 — 이쪽은 `-m`/`-F` 인자 규칙만 건드린 부분집합 뮤턴트이므로 — 테스트가 실제로 이 로직을 감시하고 있음은 확인됨). `test_blind_pattern_is_frozen` 은 `_GIT_PUSH.pattern` 을 소스 문자열과 바이트 단위로 비교해 1차 정규식의 무단 변경을 확실히 막는다.
- `test_push_guard_allowlist.py` 는 모듈 레벨에서 `guard` 를 1회 로드해 공유하지만 어느 테스트도 그 모듈의 상태를 변경하지 않으므로(순수 함수 호출만) 테스트 간 격리는 문제없음. `subTest(note=..., command=...)` 사용으로 코퍼스 기반 파라미터라이즈 테스트의 실패 지점이 명확히 드러나 가독성도 좋음.
- 다른 두 변경 파일(`plan/in-progress/*.md`)은 문서 갱신뿐이라 별도 테스트 대상 아님.

## 요약

새 `_redact_inert_text` 로직과 이를 검증하는 `test_push_guard_allowlist.py` 는 방법론적으로 탄탄하다 — 1차 blind 정규식을 바이트 단위로 동결(`test_blind_pattern_is_frozen`)하고, 레거시 대비 차등 테스트(`test_no_new_false_negatives`/`test_no_new_blocks`)와 "해제 목록이 항상 실제로 해제되는지"(`test_every_enumerated_release_actually_releases`)까지 갖춰 스스로 항진명제화되는 것을 막는 설계이며, 실행 결과도 전부 통과하고 직접 수행한 뮤테이션 스팟체크로 비-vacuity도 확인된다. 다만 이 방법론의 안전성은 전적으로 `CORPUS` 의 완전성에 의존하는데, 정확히 그 지점에서 실제로 재현 가능한 갭을 발견했다: 커밋 메시지에 우연히 "push" 라는 단어가 들어 있는(이 저장소가 흔히 쓰는 패턴) 명령이 다른 곳에 `$(git push ...)` 형태의 진짜 push 를 갖고 있으면, 레거시는 (우연히) 차단했지만 새 가드는 조용히 통과시킨다 — 이는 테스트 스위트가 스스로 정의한 `legacy(c) ⇒ new(c)` 불변식의 실제 위반이며, 코퍼스에 없어 어떤 테스트도 지금은 이를 잡지 못한다. 이 외에 `git tag -F -` 해제 경로 무테스트, 빈 heredoc 본문 경계 무테스트 등 상대적으로 가벼운 커버리지 갭도 확인했다.

## 위험도

HIGH
