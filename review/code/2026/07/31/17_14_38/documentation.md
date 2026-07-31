STATUS=success ISSUES=3

# Documentation Review — harness 번들 정확성 (2R: sentinel 방어 4개 진입점 중 2곳 누락 CRITICAL 3건 반영)

## 검토 방법

`git log origin/main..HEAD`로 이 브랜치의 5개 커밋(`1c8f16e6f`→`ad9701b3e`→`0b99b3757`→`e7bb8fb28`→`fdc8e423f`)을 확인하고, `git diff e7bb8fb28..fdc8e423f`로 이번 라운드(2R, HEAD)가 직전 라운드(`review/code/2026/07/31/16_37_23`가 검토한 `e7bb8fb28`) 대비 **실제로 순변경한 3개 파일**(consistency_orchestrator.py, test_consistency_context_budget.py, test_prompt_omission_notice.py)만 델타로 분리했다. 그 위에서 직전 두 라운드(`15_46_28` MEDIUM, `16_37_23` LOW)가 남긴 항목이 이번 diff에서 해소/잔존하는지 재확인하고, 페이로드의 게이트 번호를 `Read`로 실제 소스와 대조했다.

## 발견사항

- **[WARNING]** `--impl-done` target_doc 조립부 주석이 이번 수정으로 스스로 낡았다 — 절단 메커니즘 서술이 더 이상 맞지 않음
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:601-603`
  - 상세: `# HEAD-basis notice goes FIRST so it survives target_doc truncation\n# (truncate_to_budget trims the tail) and the checker reads the\n# current-code SoT before anything else.` — 이 주석(origin/main에 이미 존재하던 것, 이번 브랜치가 손대지 않은 줄)은 "생존 메커니즘"을 `session.truncate_to_budget`(문자 단위, 꼬리부터 자름)로 지목한다. 그런데 `truncate_file_bundle`은 `text.partition(_BUNDLE_FILE_SENTINEL)`로 sentinel이 **하나라도** 있으면 그 경로를 타지 않고 파일/청크 단위 드롭 경로로 간다(`:738-743`). `--impl-done`에서 `spec_bundle`이 비어 있는 경우(`format_file_bundle([])`→`"(없음)"`, sentinel 없음) 이전에는 `diff_section`도 sentinel이 없어(구 포맷 `"## 구현 변경 사항 ..."`) target_doc 전체에 sentinel이 0개가 될 수 있었고, 그때만 주석이 정확했다. 이번 라운드(`fdc8e423f`, `git diff e7bb8fb28..fdc8e423f`로 확인)가 `diff_section`을 두 분기 모두 `f"{_BUNDLE_FILE_SENTINEL}#### \`{_DIFF_LABEL}\`\n\n..."`로 바꾸면서, `--impl-done`의 target_doc은 `spec_bundle`이 비어도 `diff_section` 자신이 항상 sentinel을 갖게 됐다(`:590-599`) — 즉 이 경로에서 `session.truncate_to_budget` 폴백은 이제 도달 불가능하고, 항상 `truncate_file_bundle`의 청크-드롭(이름을 남기며 통째로 버림)이 적용된다. "notice가 살아남는다"는 결론 자체는 여전히 참이고 오히려 더 강하게 보장되지만, 괄호 안 메커니즘 지목은 이번 diff가 만든 현재 코드와 어긋난다.
  - 제안: 괄호 부분을 예) `(dropped chunks are named and cut whole — see truncate_file_bundle; the diff section's own sentinel, added for --impl-done, means target_doc never falls back to plain truncate_to_budget here)`처럼 정정.

- **[WARNING]** 신규 테스트 2건이 편입된 클래스 docstring이 "헤딩 위장" 시나리오만 서술 — 이제 과반(6건 중 3건)인 "sentinel 리터럴 위장" 시나리오는 언급 없음
  - 위치: `.claude/tests/test_consistency_context_budget.py:105-130`(`ContentCannotForgeAFileBoundaryTest` 클래스 docstring), 대비 `:196-220`(`test_rationale_sections_are_neutralised_too`, 이번 라운드 신설)·`:222-259`(`test_raw_spec_target_is_neutralised`, 이번 라운드 신설)
  - 상세: 클래스 docstring은 전적으로 "레벨-4 헤딩이 파일 경계로 오인됨"(`#### \`$trigger\`` 등, `5-expression-language.md`)이라는 **첫 번째** 위협 모델만 서술한다. 이번 커밋(`fdc8e423f`)이 같은 클래스에 추가한 두 테스트는 그것과 다른 **두 번째** 위협 모델 — "문서 본문이 sentinel 리터럴 자체(`<!-- @bundle-file -->`)를 독립 줄로 씀"(CRITICAL 1: `--spec`/`--plan` 원시 target_doc 미중화, WARNING: `extract_rationale_sections` 미검증) — 을 검증한다. (이 두 번째 시나리오를 처음 도입한 `test_a_document_that_writes_the_sentinel_cannot_forge_a_boundary`, `:163-193`는 직전 두 라운드에서 이미 존재했고 15_46_28 라운드는 이 클래스 docstring을 "모범적"으로 평가했다 — 당시엔 4건 중 1건만 이 시나리오였다.) 이번 라운드가 같은 클래스에 2건을 더 얹으면서 비중이 4건 중 1건→6건 중 3건(과반)으로 바뀌었는데 docstring은 갱신되지 않았다. 클래스 docstring만 훑는 독자는 이 클래스가 여전히 "스펙 헤딩 오인" 하나만 지킨다고 오해하고, 이번 2R의 핵심 CRITICAL 수정(원시 target_doc 경로)을 보호하는 회귀 테스트라는 사실을 놓치기 쉽다.
  - 제안: docstring 서두에 한 단락 추가 — 예) "Two distinct forgery shapes share this class: a spec body's own heading (above), and a document that writes the sentinel literal itself (below, `test_a_document_that_writes_the_sentinel_cannot_forge_a_boundary` 이하 3건 — the `--spec`/`--plan` raw target and `extract_rationale_sections` call sites)."

- **[WARNING]** plan 체크리스트가 "writer 2곳 모두 적용"으로 완료 선언했지만, 이번 라운드가 실제로는 **2곳을 더** 찾아 고쳤다 — 완료 서술이 스코프를 과소평가
  - 위치: `plan/in-progress/harness-consistency-summary-downgrade-rule.md:121-125`
  - 상세: 이 체크리스트 항목(`[x]`, "근본 결함이었다, 수정 완료... 본문이 만들 수 없는 sentinel(\`<!-- @bundle-file -->\`)로 경계 이전. writer 2곳 모두 적용.")은 `format_file_bundle`/`extract_rationale_sections` 두 writer 함수만 언급하고 "완료"로 닫혀 있다. 그런데 이번 라운드 커밋(`fdc8e423f`) 메시지 자체가 "sentinel 방어가 **4개 진입점 중 2곳만** 덮던 CRITICAL 3건"이라고 명시한다 — `--spec`/`--plan`의 원시 target_doc(CRITICAL 1, `format_file_bundle`을 아예 거치지 않아 "writer 2곳" 방어가 닿지 않음)과 `--impl-done`의 diff 섹션(CRITICAL 2, 경계/이름 자체가 없었음)이 별도로 발견·수정됐다. `grep -n "진입점\|raw.*target\|extract_rationale_sections\|neutraliz"` 로 plan 파일 전체를 확인한 결과 이 확장된 스코프(4개 진입점)에 대한 언급이 어디에도 없다 — 즉 fdc8e423f는 이 plan 파일을 전혀 갱신하지 않았다(파일 stat 확인: 이번 라운드가 건드린 3개 파일에 plan 파일 불포함). 이 plan 문서는 CLAUDE.md가 지정한 "진행 중 작업"의 SoT인데, 지금 상태로는 이후 이 항목을 참고하는 독자(다른 세션·planner 등)가 "sentinel 방어는 2곳으로 완결됐다"고 오인할 수 있다 — 실제로는 4곳 중 2곳만 원래 알려졌고 나머지 2곳은 이 라운드에 와서야 발견·수정됐다.
  - 제안: `:125` 뒤에 한 줄 추가 — 예) "**2026-07-31 (2R) 추가 확장**: 'writer 2곳'은 불충분했다 — \`--spec\`/\`--plan\` 원시 target_doc과 \`--impl-done\` diff 섹션도 `format_file_bundle`을 거치지 않아 별도로 중화·명명 처리함(진입점 총 4개)."

## 점검하고 결함 없음을 확인한 항목 (참고)

- **이번 라운드 신규 테스트 3건의 docstring 자체 정확성**: `test_a_twice_cut_file_reports_its_real_total`(`test_prompt_omission_notice.py:243-269`)이 주장하는 "1,531줄 파일이 356/580으로 오보고"·"다른 모든 테스트는 max_file_size=10,000,000이라 1차 절단이 발동하지 않음" 등을 실제 fixture(`max_file=8000, max_total=5000`, 1531줄 본문)와 대조 — 주장과 구현 일치. `test_rationale_sections_are_neutralised_too`/`test_raw_spec_target_is_neutralised`도 "헬퍼를 직접 부르지 않고 `collect_context`/`extract_rationale_sections`를 통해 검증"이라는 자기 진술대로 작성돼 있음을 확인.
- **직전 라운드(16_37_23) WARNING 없음 확인 + INFO 2건 잔존 확인(재확인, 신규 아님)**: (1) `.claude/tests/README.md:56-57` — 여전히 sentinel 방어/자연정렬 tie-break 언급 없음. 이번 라운드가 관련 테스트를 2건 더 추가해(위 WARNING 참조) 격차가 소폭 커졌으나, 두 라운드 전부터 "여유 있을 때"로 명시적으로 낮은 우선순위 처리된 항목이라 등급을 올리지 않았다. (2) plan `:104-105`("지금은 알파벳순 폴더 dump 가 예산을 선점한다")도 여전히 미갱신(natural sort/tiering 도입 후에도 남은 문구) — fdc8e423f가 plan 파일을 건드리지 않아 그대로다.
- **CHANGELOG.md**: 이번 라운드도 갱신 대상 아님 — `CHANGELOG.md`는 `codebase/` 제품 변경 전용이고 이번 3개 파일은 전부 `.claude/` 하네스 내부(3라운드 연속 동일 결론).
- **설정 문서(env var)**: 이번 델타(`fdc8e423f`)는 신규 `os.environ`/`getenv` 호출 없음(`grep` 확인 — 기존 5개 상수만 존재, 값 변경 없음).
- **API 문서**: API 엔드포인트 변경 없음 (순수 `.claude/` 하네스 스크립트+테스트).
- **`code_review_orchestrator.py`**: 이번 라운드(`fdc8e423f`)는 이 파일을 건드리지 않았다(직전 16_37_23 라운드가 이미 전수 검토·LOW 확정) — 재검토 불필요.
- **SKILL.md 파급 확인**: `consistency-checker/SKILL.md`·`code-review-agents/SKILL.md`에 "sentinel"·"자연정렬"·"prioritize_bundle_files" 관련 서술이 전혀 없음을 `grep`으로 확인 — 애초에 이 절차 문서가 다루는 추상화 수준보다 낮은 구현 디테일이라 갱신 대상 아님.

## 요약

이번 라운드(`fdc8e423f`, 2R)가 실제로 순변경한 3개 파일 자체의 신규 코드·신규 테스트는 이 코드베이스의 평소 기준에서도 근거·실측치를 갖춘 docstring으로 잘 뒷받침되어 있고 CRITICAL/신규 결함은 없다. 다만 이번 수정이 만들어낸 파급 효과 3건을 발견했다 — 모두 "이번 라운드의 코드 변경이 기존 산문을 낡게 만들었다"는 같은 성격이다: (1) `--impl-done` diff 섹션에 sentinel을 항상 부여한 결과 인접 주석의 절단-메커니즘 서술이 스스로 낡음, (2) 같은 클래스에 2건을 더 추가하면서 클래스 docstring의 위협-모델 서술 비중이 뒤집혔는데 갱신되지 않음, (3) plan 체크리스트의 "writer 2곳 모두 적용" 완료 선언이 이번 라운드가 밝힌 "실제로는 4개 진입점" 스코프를 반영하지 못함 — 이 중 (3)은 이 작업의 SoT인 plan 문서 자체가 자기 작업 범위를 과소평가한 채 남는다는 점에서 조용히 방치되면 향후 세션에 잘못된 "완결" 인식을 줄 수 있어 가장 눈여겨볼 만하다. 직전 라운드가 남긴 두 INFO(README.md 테스트 요약, plan folder-dump 문구)는 여전히 미해결이지만 우선순위는 그대로 낮게 유지했다. 셋 다 위치가 명확하고 한두 문장 추가로 닫히는 저비용 결함이며 기능적 결함은 아니다.

## 위험도

LOW
