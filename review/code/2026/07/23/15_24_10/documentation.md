# 문서화(Documentation) 리뷰 — push guard allowlist (3라운드 누적 diff)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_guard_review_before_push_main.py`,
`.claude/tests/test_push_guard_allowlist.py`, `plan/in-progress/harness-guard-followups.md`,
`plan/in-progress/harness-push-guard-subcommand-detection.md`,
`review/code/2026/07/23/{14_23_23,14_57_32}/*`(직전 두 라운드 리뷰 산출물, 이번 diff 에 커밋됨).

이번 diff 는 3개 커밋(`6eec7cb80` 구현 → `837ebba33` CRITICAL 3건 수정 → `cef183faf` 2라운드
WARNING 4건 수정)의 누적이며, 그중 W3/W4 두 건이 정확히 "문서 drift" 항목이었다. 이 두 항목이
실제로 코드에 반영됐는지 직접 파일을 읽고 테스트를 실행해 검증했다 — claim 을 그대로 믿지 않았다.

## 검증 방법 (재현·실측)

- `.claude/hooks/guard_review_before_push.py` 전체를 직접 읽어 모든 함수의 독스트링·인라인 주석과
  실제 로직을 대조.
- `.claude/tests/test_push_guard_allowlist.py` 를 직접 실행: **32/32 통과**
  (`python3 -m unittest test_push_guard_allowlist`), RESOLUTION.md(라운드 2)의 "32건" 주장과 일치.
- `plan/in-progress/harness-push-guard-subcommand-detection.md` 체크리스트에서 "17건/359건" 같은
  하드코딩된 stale 수치가 남아있는지 grep — 0건. `RESOLUTION.md` 참조로 교체돼 있음을 확인.
- `.claude/tests/test_guard_review_before_push_main.py` 모듈 독스트링을 `test_push_guard_allowlist.py`
  모듈 독스트링과 교차 대조 — 서로 상호 참조하며 내용이 모순 없음.
- `git log --oneline -- .claude/hooks/` 로 커밋 이력을 실제 확인해 RESOLUTION.md 들이 인용하는
  커밋 해시(`6eec7cb80`/`837ebba33`/`cef183faf`)가 실재함을 확인.

## 발견사항

- **[INFO]** `plan/in-progress/harness-push-guard-subcommand-detection.md` Overview 절의 라인 번호
  인용이 stale (파일 성장으로 어긋남 — 이번 diff 밖, 사전 존재)
  - 위치: `plan/in-progress/harness-push-guard-subcommand-detection.md:16`
    (``.claude/hooks/guard_review_before_push.py:55` 의 정규식이 push 아닌 명령을 차단한다.``)
  - 상세: 실제 `_GIT_PUSH` 정규식은 현재 파일의 68-70번 줄에 있다(모듈 docstring·신규 주석 블록이
    위에 추가되며 밀림). `git diff origin/main -- plan/in-progress/harness-push-guard-subcommand-detection.md`
    로 확인한 결과 이 줄은 이번 diff 의 어떤 hunk 에도 포함되지 않는다 — 이 인용은 2026-07-17
    최초 작성 시점부터 이미 존재했고, 그 뒤 세 커밋이 파일 위쪽에 40여 줄을 추가하면서 조용히
    깨졌다. 기능에는 영향 없음(문서 프로즈이지 실행 코드가 아님)이고 이 diff 가 새로 만든 결함도
    아니지만, 이 plan 문서는 코드 주석이 `SoR` 로 직접 지목하는 사실상의 정본이라 향후 이
    인용을 근거로 코드를 찾는 사람이 헷갈릴 수 있다.
  - 제안: `:55` 를 `:68`(또는 라인 번호 대신 `_GIT_PUSH` 심볼명)로 갱신. 우선순위 낮음 — 이번
    PR 스코프 밖으로 defer 해도 무방.

## 확인된 강점 (직전 두 라운드 WARNING 이 실제로 해소됐는지 실측 확인)

- **W3(라운드 2 WARNING) 해소 확인**: `test_guard_review_before_push_main.py` 모듈 독스트링이
  "`_is_git_push`'s own detection logic ... has no dedicated unit tests at all" 라는 stale 서술에서
  "That lives in `test_push_guard_allowlist.py`, which freezes the blind first pass byte-for-byte
  and runs a differential corpus against it" 로 정정되어 있음을 직접 파일 읽기로 확인. 두 테스트
  파일의 모듈 독스트링이 서로를 정확히 가리키며 모순이 없다.
- **W4(라운드 2 WARNING) 해소 확인**: plan 체크리스트가 하드코딩 수치(`17건/359건`) 대신
  `RESOLUTION.md 및 그 후속 라운드 참조`로 바뀌어 있음을 grep 으로 확인 — "라운드마다 바뀌는 값을
  두 곳에 박으면 같은 drift 가 반복된다"는 RESOLUTION 의 설계 의도가 실제 텍스트에 반영됐다.
  같은 패턴이 `test_push_guard_allowlist.py` 모듈 독스트링에도 적용돼 거기도 구체적 건수를
  박지 않는다(원칙 일관 적용).
- `_redact_inert_text` 독스트링에 3규칙의 **순서 의존성**이 명시됨(`"The rules run in a fixed
  ORDER and it matters: (1) normalises escaped pipes first..."`) — 1라운드 architecture 리뷰의
  INFO 지적이 실제로 반영됨을 코드 실측으로 확인.
- 2라운드에서 새로 추가된 `_SEGMENT_IS_GIT`/`_COMMIT_OR_TAG`/`_STDIN_FILE_FLAG`(W1 수정)와
  `_blank_spans`/`_commit_heredoc_spans`(W2 수정) 전부 "무엇을·왜 분리했는지"(O(n²) 백트래킹
  회피, span 기반 단일 재조립)를 설명하는 독스트링·인라인 주석을 갖췄고, 각 회귀 테스트
  (`BacktrackingTest`, `BlankSpansTest`)의 클래스 독스트링이 "왜 이 방식으로 측정해야 하는가"
  (서브프로세스+하드 타임아웃 필요 이유, timing gate 를 의도적으로 넣지 않은 이유)까지 남겨
  독자가 테스트 설계를 다시 실수하지 않도록 방어한다.
- `_MESSAGE_ARG` 정규식 위 주석이 홑따옴표/겹따옴표 처리 차이를 POSIX 셸 의미론으로 정확히
  설명하고, C1/C2 재현조건을 리뷰 디렉터리명(`review 2026/07/23 14_23_23`)까지 명시해 인용 —
  코드·plan·RESOLUTION 세 곳이 같은 사건을 같은 방식으로 서술해 교차 검증 가능함을 확인.
- `_is_git_push` 인라인 주석의 C3 예시(`git commit -m "fix: retry push bug" && echo "$(git push
  origin main)"`)가 라운드 2 documentation 리뷰가 지적한 "코퍼스 문자열과 축약 불일치"
  상태 그대로 남아있으나, 이는 라운드 2 RESOLUTION 이 "예시임이 문맥상 자명"이라는 근거로
  의도적으로 미반영 처리한 INFO 항목이다 — 재지적 대상 아님(의사결정 존중).
- CHANGELOG.md 미기재는 `.claude/` 내부 하네스 변경에 CHANGELOG 를 쓰지 않는 이 저장소의 기존
  관례(직전 두 라운드가 git log 로 확인)와 일치. 신규 공개 API·엔드포인트·환경변수가 없어
  (`BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 그대로) README·API 문서·설정 문서 갱신 대상도 없다.
- `review/code/2026/07/23/{14_23_23,14_57_32}/*` 아카이브는 프로젝트 컨벤션상 `review/code/**`
  산출물이며(CLAUDE.md "구현 완료 후 `/ai-review` + fix 는 상시 승인된 강제 의무"), 두 라운드
  모두 CRITICAL/WARNING 재현 근거·수정 diff·비-vacuity 뮤턴트 결과를 표로 남겨 감사 가능성이
  높다. 인용된 커밋 해시·테스트 건수(25→32건, 367→374건)를 직접 실행/조회로 대조한 결과
  모두 사실과 일치했다.

## 요약

이번 3라운드 누적 diff 는 문서화 관점에서 직전 두 라운드가 스스로 지적한 "문서 drift" 항목
(W3: 이웃 테스트 파일 독스트링 stale, W4: plan 체크리스트 수치 stale)을 실제로 해소했음을 파일
읽기·테스트 실행으로 직접 확인했다. 코드 신규 헬퍼(`_SEGMENT_IS_GIT` 등, `_blank_spans` 등)도
"왜"를 설명하는 독스트링을 일관되게 갖추고 있고, 각 CRITICAL/WARNING 수정마다 재현 조건·근거·
회귀 테스트를 코드 주석·테스트 독스트링·plan·RESOLUTION 네 층위에 교차 기록해 두어 감사
가능성이 이례적으로 높다. 유일하게 남은 지적은 plan Overview 절의 라인 번호 인용 하나가
파일 성장으로 stale해진 것인데, 이는 이번 diff 가 만든 결함이 아니라 이번 diff 의 hunk 밖(즉
이번 변경 범위 밖)에 있는 사전 존재 사안이며 실질 영향도 낮다. README·API 문서·CHANGELOG·
환경변수 문서 갱신은 이 컴포넌트의 성격(`.claude/` 내부 하네스, 신규 공개 인터페이스 없음)상
해당 사항 없음을 재확인했다.

## 위험도

LOW
