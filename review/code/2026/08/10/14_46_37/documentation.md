# 문서화(Documentation) 리뷰

## 조사 방법

리뷰 대상으로 나열된 파일 다수(파일 10번 이후)는 이전 라운드(`08_32_48`~`14_32_02`)의 리뷰/일관성
산출물이 `review/` 미커밋 상태로 함께 실린 것으로, 실질적인 코드/문서 변경은 orchestrator 가
명시한 9개 파일(`ai-review.md`, `code-review-agents/README.md`, `code-review-agents/SKILL.md`,
`lib/session.py`, `code_review_orchestrator.py`, `.claude/tests/README.md`,
`test_line_anchors.py`, `test_review_prepare_single_session.py`,
`plan/in-progress/harness-review-gate-followups.md`)뿐이다(`meta.json` 확인). 프롬프트에서
diff 가 생략된 파일은 `git diff origin/main...HEAD -- <path>` 로 직접 대조했다.

지시대로, 직전 라운드(`14_32_02`)가 "닫은 결함을 아직 열려 있다고 적는 자리" 4곳
(`lib/session.py` ×2 · `pick_commit_fixture` docstring · `tests/README.md`)을 고친 것과 **같은
클래스가 저장소에 더 남아 있는지** `batch`/`분할`/`마지막 줄`/`미해결`/`open item` 축으로
전수 grep 했다. 네 곳 모두 여전히 정정된 상태로 남아 있고(재발 없음), 나머지 매치는 전부
무관한 문맥(convention 문서의 일반 용어, `test_branch_diff_shared.py`/`merge-coordinate.md`의
무관한 "마지막 줄" 용례, `plan/complete/*` 의 다른 티켓)이었다 — 단 아래 WARNING 하나는 **이번
diff 자신이** 같은 클래스를 새로 하나 남겼다.

## 발견사항

- **[WARNING]** "이유는 아래 셋이다" 라는 개수 주장이, 바로 아래 세 항목 중 하나를 이번 diff
  자신이 종결 처리하면서 stale 해졌다 — 이 PR 이 반복해서 고치고 있는 바로 그 클래스(개수
  주장이 조치 뒤 안 따라감)가 같은 파일·같은 diff 안에서 재발했다.
  - 위치: `plan/in-progress/harness-review-gate-followups.md:25` (`` `in-progress/` 에 남는
    이유는 아래 셋이다: ``), 이어지는 불릿 `:27-32`
  - 상세: 25행은 "`in-progress/` 에 남는 이유는 아래 **셋**이다" 라고 단언하고, 27-32행에 그
    세 항목(§11 잔여 · origin 기본 브랜치 해석 4곳 · 미해결 조사 1건)을 나열한다. 그런데 바로
    이번 diff 가 세 번째 항목("미해결 조사 1건")을 `~~취소선~~` 처리하고 "**종결
    (2026-08-10)**" 으로 정정했다(diff 확인: `git diff origin/main...HEAD` 에서 이 세 줄이
    수정됨). 즉 in-progress 로 남아 있는 **유효한** 이유는 이제 §11 잔여와 origin 브랜치 해석
    둘뿐인데, 표제 문장은 여전히 "셋"이라고 말한다. 취소선과 "종결" 표기 덕에 꼼꼼히 읽으면
    오도되지 않지만, 표제만 훑는 독자(다음에 이 plan 을 여는 사람, 또는 lifecycle 완료 조건을
    판정하는 사람)에게는 "아직 3개가 막고 있다"로 읽힌다. 이 PR 이 다른 곳에서 정확히 이
    실패("닫힌 결함을 아직 열려 있다고 세는 것")를 세 번(§테스트 개수 17→19, 상위 체크박스,
    tests/README.md) 잡아 고쳤는데, 그 수정 자체가 만든 새 문장에서 넷째 사례가 생겼다.
  - 제안: "셋이다" → "둘이다(+ 종결된 조사 1건의 기록)" 또는 "아래 항목들이다"처럼 정확한
    개수를 다시 세거나 개수 자체를 언급하지 않는 서술로 바꾼다. 최소 수정으로는 25행 끝에
    "(그중 하나는 이번에 종결 — 아래 참조)"를 덧붙여도 된다.

## 확인한 강점 (조치 불요, 참고용)

- 지시받은 "같은 클래스 전수 재검사"는 통과했다 — 직전 라운드가 고친 4곳(`lib/session.py`
  모듈 주석·`create_session_dir` docstring, `pick_commit_fixture` docstring, `tests/README.md`
  행)은 전부 현재형("지금은 분할이 없다" / "여전히 발생한다")과 과거형 서술이 정확히 갈려
  있고, 근거(실측 수치, 커밋 SHA)는 역사 기록으로 보존하면서 "지금은 아니다"를 명시한다.
  재발이 없다.
- `.claude/skills/code-review-agents/README.md`·`SKILL.md`의 `REVIEW_BATCH_SIZE` 행 두 곳이
  동일 문구("세션은 분할하지 않는다")로 완전히 동기화되어 있다 — 한쪽만 고치고 다른 쪽을
  놓치는, 이 저장소가 반복 겪은 실패 클래스를 이번엔 피했다.
- `code_review_orchestrator.py`의 신규 함수 3개(`_warn_large_changeset`,
  `_bulleted_path_sample`, `_source_files_missing_from_changeset`) 모두 "왜 존재하는가"를
  실측 수치(forced 7→2, 60파일 프로브)와 함께 docstring 에 남겼고, 모듈 최상단 docstring 의
  "Prints one line per batch" 서술도 "exactly one" 으로 정확히 갱신됐다.
  `test_line_anchors.py`의 `pick_commit_fixture` docstring 은 "Third variant, 2026-08-10"으로
  세 번째 변종을 명확히 순서대로 이어 붙여, 직전 라운드가 지적한 "2종만 기술" 문제가 완전히
  해소됐다.
- `test_review_prepare_single_session.py`(신규 308줄)는 실측 확인 결과 테스트 19건으로
  `.claude/tests/README.md` 행·`plan/in-progress/harness-review-gate-followups.md` 양쪽이
  주장하는 "19건"과 정확히 일치한다(drift 없음).
- `plan/in-progress/harness-review-gate-followups.md`의 체크박스 정정 패턴(`[x]`로 전환하되
  원문을 `[~]`로 표시해 "처분의 근거로 보존")은 이력을 지우지 않으면서 상태를 정확히 갱신하는
  좋은 관례다.
- 이번 변경 세트는 내부 개발 하네스(`.claude/`)와 plan 문서에 한정되며 사용자 대면
  기능·API·환경변수 신설이 없어 `CHANGELOG.md`(제품/spec 링크 전용)·README(제품)·API 문서
  갱신 대상이 아니다. 새 env var 도 도입되지 않았다(기존 `REVIEW_BATCH_SIZE` 의 의미만 "분할
  크기"에서 "안내 임계값"으로 재정의되었고, 그 재정의는 두 문서 모두에 반영돼 있다).

## 요약

이번 diff는 직전 라운드가 지적한 "닫힌 결함을 아직 열려 있다고 서술" 클래스를 정확히 고쳤고,
지시받은 저장소 전수 재검사(`batch`/`분할`/`마지막 줄`/`미해결`/`open item` 축)에서도 그 4곳
외에 같은 결함의 잔존 사례는 발견되지 않았다. 다만 이번 diff 자신이 `harness-review-gate-followups.md`
안에서 "이유는 아래 셋이다"라는 개수 주장을 만들어 놓고 바로 아래에서 그 셋 중 하나를 같은
diff로 종결 처리해, 개수 주장이 조치 직후 stale해지는 동일 클래스의 새 사례를 하나 남겼다.
그 외 문서(README/SKILL.md/ai-review.md, 코드 docstring, 테스트 카탈로그)는 서로 완전히
동기화되어 있고 실측 수치(테스트 개수, forced 리스트 변화)와도 일치한다.

## 위험도

LOW
