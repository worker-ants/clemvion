# 변경 범위(Scope) 리뷰

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_guard_review_before_push_main.py`,
`plan/in-progress/harness-guard-followups.md`, `review/code/2026/07/23/16_55_04/*` (13개 리뷰 산출물 신규 파일)

## 배경 확인

`git diff --stat origin/main...HEAD` 결과가 이 리뷰 payload 의 파일 16개와 정확히 일치함(추가 파일 없음,
누락 없음). 커밋 이력(`635874d5f feat(harness): push 게이트 fail-open 을 관측 가능하게 (§E)` →
`2a94de331 fix(harness): §E 리뷰 Warning 9건 반영`)을 보면 이 diff 는 "① `plan/in-progress/harness-guard-followups.md`
§E 사용자 결정(3안: fail-open 유지+관측가능화) 구현 → ② 프로젝트 상시 의무인 `/ai-review` 실행
(review/code/2026/07/23/16_55_04) → ③ 그 SUMMARY 의 Warning 9건을 `resolution-applier` 로 반영"까지의
단일 작업 사이클이다. `.claude/hooks/guard_review_before_push.py:559` 확인 결과 W1(중복 `__main__` 블록)도
실제로 1개만 남아 RESOLUTION.md 서술과 일치한다.

## 발견사항

- **[INFO]** review/ 산출물 13개 신규 파일(SUMMARY.md·RESOLUTION.md·개별 리뷰어 9개·`meta.json`·`_retry_state.json`)이 코드 변경과 함께 커밋됨
  - 위치: `review/code/2026/07/23/16_55_04/*`
  - 상세: CLAUDE.md 정보 저장 위치 표("코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`")와 기존 관례("review/ 는 gitignored 아님, SUMMARY·RESOLUTION 도 커밋")에 정확히 부합한다. 이번 코드 변경(§E 구현)에 대한 필수 리뷰 사이클의 산출물이므로 "무관한 파일 추가"가 아니라 동일 작업 사이클의 일부다.
  - 제안: 조치 불요.

- **[INFO]** 이번 diff 에 구현 본체(§E 신규 기능) 외에 리뷰 Warning 9건(W1~W9) 반영분이 섞여 있음
  - 위치: `.claude/hooks/guard_review_before_push.py`(`_Outcome` 도입·`_run_gates`/`main` 분리·`bypassed`/`answered`/`degraded` 3분류·DETECTION 게이트), `.claude/tests/test_guard_review_before_push_main.py`(신규 테스트 다수)
  - 상세: CLAUDE.md 는 "구현 완료 후 `/ai-review` + Critical/Warning fix 는 같은 턴의 강제 의무"라고 명시한다. 즉 이 반영은 "요청 이상의 추가 수정"이 아니라 프로젝트가 사전 승인한 표준 워크플로다. `_run_gates` 리팩터(원래 `main()` 내부 인라인 로직을 분리)도 각 게이트의 bypassed/degraded/answered 를 구분해야 하는 기능 요구(W2) 때문에 필요한 구조 변경이며, 관련 없는 코드 정리는 아니다.
  - 제안: 조치 불요.

- **[INFO]** plan 파일에서 §E 항목뿐 아니라 최상위 체크리스트 한 줄(`- [ ] E …` → `- [x] E … 구현 완료 (별건 PR)`, `plan/in-progress/harness-guard-followups.md` 최상위 체크리스트)도 갱신됨
  - 위치: `plan/in-progress/harness-guard-followups.md` (본문 §E 문단 + 최상위 체크리스트 E 항목)
  - 상세: "plan 체크박스 = 실제 상태" 원칙과 W9(RESOLUTION.md) 이 요구한 정합화로, 이번 구현이 완료됐다는 사실 자체를 반영하는 것이지 다른 항목(B/C/D/F/G/H)은 손대지 않았다(diff 확인 결과 E 줄 1개만 변경).
  - 제안: 조치 불요.

특이하게 볼 만한 "의도 이상의 변경", "무관한 파일 수정", "불필요한 리팩토링", "요청하지 않은 기능 확장",
"의미 없는 포맷팅/주석/임포트/설정 변경"은 발견되지 않았다. 코드 파일(`guard_review_before_push.py`)의
모든 diff hunk 가 §E 기능(3-outcome 분류, DETECTION 게이트, streak 파일 I/O, 보고 로직)에 직접 연결되며,
docstring 확장(21~33행)도 신규 부작용을 설명하는 데 필요한 범위에 머문다. 테스트 파일도 신규 기능 검증에만
쓰이고, 기존 테스트에 추가된 `CLAUDE_PROJECT_DIR` 격리 한 줄은 새 테스트가 실제 저장소 state 를 오염시키지
않기 위한 필수 전제조건이다.

## 요약

이 diff 는 "plan §E 정책 결정 구현 → 의무 `/ai-review` → Warning 9건 반영"이라는 프로젝트 표준 사이클을
한 changeset 으로 포함하며, `git diff --stat` 으로 확인한 실제 변경 파일 16개가 리뷰 payload 와 완전히
일치한다. 코드 변경은 전부 fail-open 관측성 기능과 그 후속 리뷰 수정에 직접 연결되고, 관련 없는 리팩토링·
기능 확장·포맷팅/주석/임포트/설정 잡음은 발견되지 않았다. review/ 산출물 신규 파일들도 이 프로젝트의
문서화된 저장 위치·워크플로 규약에 정확히 부합해 "무관한 파일"이 아니다.

## 위험도
NONE
