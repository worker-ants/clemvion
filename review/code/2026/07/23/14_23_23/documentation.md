# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `_is_git_push()` 에 요약 독스트링 부재
  - 위치: `.claude/hooks/guard_review_before_push.py:402-411` (`_is_git_push`)
  - 상세: 이번 변경으로 이 함수는 "정규식 1회 매치"에서 "blind 매치 → `_redact_inert_text` 로
    비활성 텍스트 제거 → 재매치" 라는 2단계 판정으로 복잡도가 늘었다. 바로 옆에 추가된
    `_owns_heredoc_as_message`/`_is_inert`/`_blank`/`_redact_inert_text`/`_blank_commit_heredocs`
    는 전부 한 줄 독스트링이 있는데, 정작 이 판정들을 최종 소비하는 진입점 함수만 독스트링이
    없고 인라인 주석으로만 설명된다(주석 자체는 정확하고 충분함).
  - 제안: `"""blind pass 가 잡고, redaction 후에도 살아남는 매치만 True."""` 수준의 한 줄
    요약을 추가하면 IDE hover/`help()` 로도 설계 의도가 즉시 보인다. 차단 사항 아님 — 기존
    `_read_payload`/`main` 도 이 파일 관례상 독스트링이 없어 신규 헬퍼들과의 상대적 비일관일 뿐.

- **[INFO]** 파일 상단 모듈 독스트링이 새 blind+allowlist 설계를 언급하지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:201-224` (모듈 docstring)
  - 상세: 모듈 최상단 독스트링은 훅의 계약(exit code, REVIEW/PLAN 게이트, BYPASS 변수)만
    설명하고, `_GIT_PUSH` 판정 자체의 설계(blind 정규식 + 열거된 allowlist, SoR 문서)는
    바로 아래 블록 주석(`# ---`, 251번 줄~)에만 있다. 파일을 위에서부터 훑는 독자는 모듈
    독스트링만 보고 지나칠 수 있다. 다만 실제로 그 판정 로직을 만지려는 개발자는 코드를
    따라 내려가다 반드시 그 블록 주석을 보게 되므로 실질적 피해는 낮다.
  - 제안: 모듈 독스트링 끝에 "push 탐지 자체의 설계(blind+allowlist)는 `_GIT_PUSH` 정의
    바로 위 주석 참고" 한 줄만 추가해도 발견성이 개선된다. 선택 사항.

## 확인된 강점 (참고)

- `_redact_inert_text`/`_blank_commit_heredocs`/`_owns_heredoc_as_message`/`_is_inert`/`_blank`
  전부 "무엇을·왜"를 함께 설명하는 독스트링·인라인 주석을 갖췄고, 앞선 3라운드 리뷰에서 실패한
  대안(예: heredoc "언급" 판정이 `echo "git commit -F -" | bash <<'EOF'` 로 뚫린 사례)까지
  코드 옆에 남겨 재발을 막는다 — 이례적으로 높은 수준.
- `.claude/hooks/guard_review_before_push.py` 의 `_GIT_PUSH` 정규식 주석이 "DO NOT EDIT" +
  SoR 링크(`plan/in-progress/harness-push-guard-subcommand-detection.md`) + 테스트가 이
  정확한 문자열을 pin 한다는 사실까지 명시 — 코드·주석·테스트·plan 4곳이 서로를 참조하며
  일관됨을 실측 확인함(`test_blind_pattern_is_frozen` 통과, `_LEGACY_PATTERN` 문자열 동일).
- `.claude/tests/test_push_guard_allowlist.py` 모듈 독스트링이 차등 테스트 전략·회귀 이력·
  테스트 매핑을 상세히 설명. 플랜 문서가 주장하는 "17건" 도 실행 확인 결과 정확
  (`python3 -m unittest test_push_guard_allowlist` → `Ran 17 tests … OK`).
- `plan/in-progress/harness-push-guard-subcommand-detection.md` 와
  `plan/in-progress/harness-guard-followups.md` 갱신이 구현 완료 상태(체크박스)·초안 결함과
  교정 이력·잔여 항목(C 항목 "선행 해소, 착수 가능"으로 정확히 미완료 표시)을 정직하게 반영—
  체크박스와 실제 코드 상태 간 불일치 없음.
- 이 저장소는 `.claude/` 내부 하네스 변경에 `CHANGELOG.md` 를 쓰지 않는 것이 기존 관례임을
  git log 로 확인(`fix(harness): …` 계열 커밋들이 CHANGELOG.md 를 건드리지 않음) — 본 변경도
  같은 관례를 따르므로 CHANGELOG 미기재는 결함이 아님. README/API 문서·환경변수 문서 대상
  변경도 없음(신규 공개 API·엔드포인트·환경변수 없음, 기존 `BYPASS_REVIEW_GUARD`/
  `BYPASS_PLAN_GUARD` 그대로).

## 요약

리뷰 대상 4개 파일(훅 본체, 신규 테스트, plan 2건) 모두 문서화 수준이 평균 이상이다. 특히
"왜 이 설계인가"·"왜 이전 시도가 실패했는가"를 코드 주석·테스트 독스트링·plan 세 층위에 중복
기록해 두어, 향후 누군가 같은 실패를 반복하지 않도록 하는 의도가 뚜렷하다(실제로 SoR 링크·
동결된 정규식 문자열·pin 테스트가 서로 교차 검증됨을 실측 확인). 남은 지적은 신규 최종 진입점
함수의 독스트링 부재와 모듈 상단 독스트링의 발견성 정도로, 둘 다 인라인 주석이 이미 내용을
커버하고 있어 실질적 위험은 없는 개선 제안 수준이다.

## 위험도

LOW
