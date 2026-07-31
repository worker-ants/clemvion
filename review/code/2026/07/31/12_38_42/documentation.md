# Documentation Review

## 발견사항

- **[WARNING]** 신규 changeset 경고(`warn_if_committed_work_is_missing`)가 code-review-agents SKILL 요약에 반영되지 않음
  - 위치: `.claude/skills/code-review-agents/SKILL.md:41` (관련 구현: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` `warn_if_committed_work_is_missing`/`_default_branch_ref` — 이번 diff 신설)
  - 상세: 이번 PR 이 고친 실제 결함은 "기본 `--prepare` 경로(인자 없음)가 커밋된 브랜치 diff 를 조용히 빼먹어 리뷰가 거의 빈 코퍼스를 받고도 `BLOCK: NO`/`Critical 0` 를 내는" 거짓 수렴이다 (`plan/in-progress/harness-review-gate-ci-backstop.md` §관측(1), 실측: 기본 0건 vs `--branch origin/main` 6건). 함수 docstring·plan 문서·테스트(`test_review_changeset_warning.py`)는 이 사실과 새 stderr 경고를 매우 정확하게 기술하지만, 정작 호출자가 가장 먼저 읽는 SKILL.md §1 "세션 준비" 는 여전히 "인자 없음 → git diff (staged + unstaged + untracked)" 한 줄뿐이라, 이 경로가 커밋 후 브랜치 diff 를 놓칠 수 있다는 caveat 를 SKILL.md 만 읽는 호출자는 알 수 없다. (완화 요인: 경고 자체가 `--branch <base>` remedy 를 stderr 에 직접 안내하므로 완전히 무통보는 아니다.)
  - 제안: SKILL.md §1 옵션 목록(41번 줄 부근)에 "커밋 직후에는 기본 경로가 브랜치 diff 를 놓칠 수 있음 — stderr 경고 시 `--branch <base>` 로 재실행" 한 줄 추가.

- **[INFO]** `consistency-checker` SKILL.md 말미의 README 참조가 대상 파일 없이 매달려 있음 (이번 diff 밖, 기존 결함)
  - 위치: `.claude/skills/consistency-checker/SKILL.md:147`
  - 상세: `세션 디렉토리 스키마·디버그 로그 위치: `./README.md`.` 라고 안내하지만 `.claude/skills/consistency-checker/` 아래에는 `SKILL.md` 만 있고 `README.md` 는 존재한 적이 없다 (`git log --follow` 무이력). 이 줄 자체는 이번 PR 의 diff 대상이 아니지만, 이번 PR 이 같은 파일을 두 곳(§`--impl-done` 설명, §4 BLOCK 처리)이나 편집한 김에 같이 정리할 만하다.
  - 제안: 세션 디렉토리 스키마/디버그 로그 위치를 SKILL.md 본문에 직접 기술하거나, 실제로 그 내용이 있는 문서(예: 상위 `.claude/tests/README.md` 또는 신규 파일)로 링크를 갱신.

- **[INFO]** plan 문서의 재발 횟수 서술("3회")이 바로 아래 표(4행)와 불일치 (이번 diff 밖, 기존 결함)
  - 위치: `plan/in-progress/harness-consistency-summary-downgrade-rule.md:125`
  - 상세: 헤딩 `### 같은 PR 안에서 **3회** 재현` 과 본문 "한 PR 에서만 세 번 나왔다" 바로 아래(129~134줄) 표에는 회차 1~4, 즉 4행이 나열된다. 회차 2(`consistency/2026/07/26/21_06_23`)는 문서의 다른 절("`--impl-done` scope 가 실제 diff 와 무관한 번들을 싣는다")과 동일 세션을 가리켜, 알파벳순-truncation 버그(1·3·4행)와는 다른 축(diff 매칭 없는 scope 산정 결함)이라 "3회" 계수에서 의도적으로 제외된 것으로 보이지만, 그 제외 사유가 표 안에 명시돼 있지 않아 표만 보면 헤딩과 모순돼 보인다. 이번 PR 의 diff 는 이 문단 위(종결 배너)·아래(구현완료 체크박스)를 편집했지만 이 특정 문장은 건드리지 않았다.
  - 제안: 헤딩을 "4회 재현(그중 3회는 동일 truncation 버그, 1회는 별도 scope 결함)" 등으로 정정하거나, 회차 2 행에 "※ 다른 결함 축 — 계수 제외" 각주 추가.

- **[INFO]** `test_review_guard_hardening.py` README 카탈로그 행이 이번 PR 의 핵심 신규 pin(Stop-only `in_flight_ok` 분리)을 명시하지 않음
  - 위치: `.claude/tests/README.md:40`
  - 상세: 이번 PR 은 `EvaluateInFlightShortCircuitTest`(`test_push_path_still_blocks_while_in_flight` / `test_stop_path_opts_in_and_is_allowed`)를 새로 추가해 "in-flight 억제가 push 게이트까지 열던 결함"(이번 PR 의 3대 수정 중 하나, `plan/in-progress/harness-review-gate-ci-backstop.md` §관측(2))을 고정했다. `.claude/tests/README.md` 의 해당 행은 "in-flight suppression" 이라는 기존 general 문구만 있고 이번에 갈린 축(Stop 전용 opt-in, push 는 절대 opt-in 하지 않음)은 별도로 이름 붙지 않았다. `test_tests_readme_catalog.py` 는 행의 "존재" 만 검증하므로 내용 staleness 는 잡지 못한다.
  - 제안: 해당 행에 "Stop-only `in_flight_ok` opt-in — push 는 항상 opt-out(둘 다 같은 `evaluate_review` 를 호출하므로 무조건 억제였다면 push 게이트가 TTL 내내 열렸다)" 구절 추가.

## 요약

이번 PR (in-flight 억제 스코프 축소, consistency 번들 우선순위 재정렬, 리뷰/consistency 프롬프트 무통보 생략 수정)은 문서화 품질이 이례적으로 높다. 변경된 모든 핵심 함수(`evaluate_review`/`_code_review_in_flight`/`prioritize_bundle_files`/`build_files_section`/`warn_if_committed_work_is_missing`)의 docstring 이 "무엇이 왜 바뀌었는지"와 "이전 버그가 정확히 어떤 인과로 발생했는지"까지 갱신·기록했고, 두 plan 문서(`harness-consistency-summary-downgrade-rule.md`, `harness-review-gate-ci-backstop.md`)는 실측 세션 경로·문자 수·테스트 건수를 인용해 남겼다. 직접 대조한 결과 인용된 테스트 건수(13/11/6), 파일 크기(46,745자/55,305자), 참조된 review 세션 디렉토리가 모두 실제와 일치했고, `.claude/tests/README.md` 의 신규 테스트 3건은 자체 동기화 테스트(`test_tests_readme_catalog.py`)로 커버리지가 보장된다. 발견된 항목은 (1) 새로 추가된 changeset 경고가 SKILL.md 요약에는 반영되지 않은 것 1건과, (2) 이번 diff 가 직접 건드리지 않은 기존 상호참조/집계 표기 사소한 불일치 3건뿐이며, 모두 코드 동작이나 계약을 오도하지 않는 수준이다.

## 위험도

LOW
