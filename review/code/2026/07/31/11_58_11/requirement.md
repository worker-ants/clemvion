# 요구사항(Requirement) Review — harness-review-gate-fixes-1bd6aa

## 조사 방법

`git diff origin/main...HEAD`(이 브랜치 8개 커밋)로 실제 변경분을 확인했다. 프롬프트 크기 제한으로
전체가 실리지 않은 3개 파일(`review_guard.py`/`code_review_orchestrator.py`/
`consistency_orchestrator.py`)은 `Read` 로 직접 열람했다. 핵심 계약(`evaluate_review`의
`in_flight_ok` opt-in, `warn_if_committed_work_is_missing`, `prioritize_bundle_files`,
`build_files_section`의 신규 생략-고지)은 소스 판독에 그치지 않고 실제로 실행해 검증했다:

- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 실행 → **693 tests, FAILURES=1**.
- 실패 테스트(`test_prompt_stays_within_the_size_cap`)를 격리 재현하고, `code_review_orchestrator`
  모듈을 직접 import 해 `_omitted_content_note` 유무에 따른 `_router.md` 크기 차이를 직접 계산해
  원인을 이 diff 로 귀속시켰다(아래 CRITICAL 참조).
- `build_files_section`을 합성 change_info(큰 diff + full_content)로 직접 호출해 두 번째 분기의
  누락도 재현했다(아래 WARNING #1).
- push 가드(`guard_review_before_push.py`)의 `_accepts_cwd`/`_evaluate_over_targets` 를 읽어
  `in_flight_ok` 가 실제로 opt-in 밖에 못 나가는지 확인했다.
- `prioritize_bundle_files`의 secondary sort key를 읽고 `test_consistency_bundle_priority.py`의
  `test_ties_stay_alphabetical`과 대조해 natural-sort 미구현을 확인했다.

이 세션의 다른 reviewer(testing/documentation/maintainability)도 `build_files_section`의
두 갈래 결함을 독립적으로 발견해 실측치가 일치한다(예: 143,620 vs 143,605, 생략 고지 14건 ×
~146자 = 2,042자) — 아래 CRITICAL/WARNING #1 은 그 결과와 수렴하며, 본 리뷰는 "요구사항 충족"
관점(선언된 완료 상태 vs 실제 코드 상태)에서 별도로 재구성한 것이다.

## 발견사항

- **[CRITICAL]** 신규 생략-고지(`_omitted_content_note`) 자신의 바이트 비용이 예산 계산에서
  빠져, `build_files_section`이 스스로의 "예산을 지킨다"는 계약을 어기고 — 하네스 자신의
  회귀 테스트가 **이 브랜치에서 지금 실제로 FAIL** 한다. plan 문서가 이 결함을 "수정 완료"로
  선언한 것과도 어긋난다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` —
    `_omitted_content_note` 정의(561-584행), `build_files_section`(587행)의 예산 차감 루프
    (672-694행: `remaining_budget`/`content_wrapper_overhead`/`include_content`)와 그 결과를
    쓰는 렌더 루프(696-707행, 특히 701-705행 `elif fp["full_content"]: section +=
    _omitted_content_note(...)`). 회귀 테스트: `.claude/tests/test_line_anchors.py`
    `PromptPayloadIntegrationTest.test_prompt_stays_within_the_size_cap`(490-512행 — 사전
    존재 테스트, 이번 diff 대상 아님).
  - 상세: `include_content`를 채우는 672-694행 루프는 "포함시킬 콘텐츠"의 크기만
    `remaining_budget`에서 차감한다. 그런데 696-707행 렌더 루프는 `i not in include_content`
    이면서 `fp["full_content"]`가 있는 **모든** 파일에 대해 `_omitted_content_note(...)`(파일당
    약 140-150자)를 예산 확인 없이 무조건 덧붙인다 — 이 문자열의 길이는 어디에서도
    `remaining_budget`/`max_total_size`와 비교되지 않는다. 즉 생략 대상 파일 수가 늘수록
    최종 문서는 그 개수에 비례해 **선언된 예산을 초과**하며, 상한이 없다.
    직접 재현: `code_review_orchestrator`를 import 해 이 브랜치의 실제 커밋
    (`0279f4333`, 최근 리뷰 세션 산출물 19개 파일 커밋)을 `--commit`으로 조립하면
    `_router.md` = 143,620자(생략 고지 14건). `_omitted_content_note`가 만드는 그 14개 문자열의
    실제 길이 합을 계산하면 정확히 2,042자이고, `143620 - 2042 = 141578` — 즉 이 고지가
    없었다면 143,605(cap+slack) 문턱을 여유 있게 통과했을 크기다. 격리 재실행으로도 결정적으로
    재현됨(`AssertionError: 143620 not less than or equal to 143605`).
    같은 파일의 자매 함수 `truncate_file_bundle`(`consistency_orchestrator.py:642`,
    특히 671-677행)은 정확히 이 실패 형태를 이미 겪고 고친 전례가 있다 — "안내문 자체의 길이도
    매 반복마다 다시 측정해 예산에 넣는다"(`len(head) + sum(...) + len(notice) <= budget`).
    `_omitted_content_note`의 docstring(576-578행)은 "Mirrors the same fix already made on
    the consistency side"라 명시하지만, 실제로는 "생략을 알린다" 절반만 이식되고 "안내문
    자신도 예산에 넣는다" 절반은 빠졌다 — 함수명·주석이 약속한 것과 실제 구현이 어긋난 사례다.
    또한 `plan/in-progress/harness-review-gate-ci-backstop.md`의 상단 배너(19-25행)는 이
    누락 수정을 "**수정 완료**"로 선언하는데, 그 선언의 근거로 삼은 `RESOLUTION.md`
    (`review/code/2026/07/31/11_07_48/RESOLUTION.md:45`)조차 "harness 스위트: 693 tests OK"
    라고 적어 뒀다 — 지금 같은 693개를 다시 돌리면 1건이 FAIL 이다. 이 모순은 검증 시점(그
    라운드 자신의 리뷰 산출물을 커밋하기 **전**)과 결과가 실제로 관측되는 시점(그 산출물이
    `pick_commit_fixture()`의 대상이 된 **후**)이 갈린 데서 온 것이지, "693 tests OK" 주장이
    거짓으로 작성됐다는 뜻은 아니다. 그러나 결과적으로 지금 트리에서 "완료"·"OK" 선언과 실제
    테스트 실행 결과가 어긋나 있다는 사실 자체는 남는다.
  - 제안: 생략-고지 분기에서도 `truncate_file_bundle`과 동일하게 안내문 길이를 예산 차감에
    포함시키거나(안내 대상 파일 수를 먼저 추정해 `remaining_budget`에서 선반영), 최소한 최종
    조립 후 `len(result) > max_total_size`이면 안내를 압축(파일별 나열 대신 개수만 표기)하는
    안전판을 둘 것. `test_prompt_omission_notice.py`에 "생략 대상 파일이 충분히 많아 안내문
    누적만으로 예산을 넘길 수 있는" 케이스를 추가해 회귀를 고정.

- **[WARNING]** `build_files_section`의 또 다른 예산 초과 분기(diff만으로 이미 예산을 넘는
  경우)는 이번 수정이 전혀 닿지 않아, 이 PR이 없애려는 바로 그 "무표시 통째 누락"이 그대로
  재현된다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
    `build_files_section`의 `if base_size >= max_total_size:` 분기(644-670행), 특히 669행
    `sections = [fp["header"] + fp["diff"] for fp in file_parts]`.
  - 상세: 이 분기는 header+diff만으로 이미 `max_total_size`를 넘는 경우(예: 대형 diff를 가진
    변경이 많은 리뷰)를 처리한다. 여기서는 diff를 깎아 넣을 뿐, `file_parts[i]["full_content"]`
    필드는 참조조차 되지 않는다 — `FULL_CONTEXT_HEADING`도, 신규 `_omitted_content_note`도
    렌더되지 않는다. 직접 재현: 합성 change_info 5개(각각 diff 2000줄 + full_content 500줄)로
    `build_files_section(infos, 10_000_000, 2000)`을 호출하면, diff는 절단 고지가 붙어 있지만
    (`"생략 — 원본 파일 참조"` 존재) `FULL_CONTEXT_HEADING`/생략-고지는 **0건**이었다 — 5개
    파일 각각 500줄의 실제 파일 내용이 아무 흔적 없이 사라진다. `.claude/tests/*.py` 전체에서
    `build_files_section`을 호출하는 파일은 `test_prompt_omission_notice.py` 단 하나뿐이고,
    그 fixture(`SMALL/BIG/BIGGER`, `diff_content=""`, `max_total=2000`)는 diff가 항상
    비어 있어 `base_size`가 헤더뿐이므로 이 분기를 밟지 않는다 — 즉 "이번 PR로 완전히
    닫혔다"고 보기엔 이르다.
  - 제안: 이 분기에서도 diff 절단 후 여유가 있으면 `_omitted_content_note`(또는 축약형)를
    붙이거나, 최소한 "diff도 절단됐고 원본 내용도 전혀 실리지 않았다"는 별도 고지를 추가.
    `test_prompt_omission_notice.py`에 큰 diff + full_content를 가진 다중 파일로
    `base_size >= max_total_size`를 강제하는 케이스를 추가해 "생략되면 반드시 고지가 붙는다"
    불변식을 diff-전용 분기까지 확장할 것.

- **[WARNING]** `plan/in-progress/harness-consistency-summary-downgrade-rule.md`의 상단
  배너가 "8회 재발한 번들 예산 결함"을 **종결/수정 완료**로 선언하지만, 근본 원인인 사전식
  정렬(natural sort 부재)은 여전히 코드에 남아 있고 그 사실이 같은 문서의 미체크 항목으로
  명시돼 있다 — 특정 재발 증상은 닫혔지만 일반화된 결함 클래스는 열려 있다.
  - 위치: 배너 12행("부속 관측(번들 예산 결함, 8회 재발) — 수정 완료") vs 같은 문서의
    §관련 관측 미체크 항목(94, 97, 99, 107, 111행), 특히 99행 "**정렬이 사전순이라 두 자리
    번호가 한 자리를 앞선다 — natural sort 로 교체**". 코드측:
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`의
    `prioritize_bundle_files`(267-309행), 특히 secondary sort key인 309행
    `sorted(file_paths, key=lambda p: (tier(p), p))` — `p`는 순수 문자열 비교라 tier가 같은
    파일들 사이에서는 여전히 사전순이다. `.claude/tests/test_consistency_bundle_priority.py`의
    `test_ties_stay_alphabetical`(162-163행)이 "동일 tier 타이는 알파벳순 유지"를 테스트로
    명시적으로 고정해, 이것이 우연한 잔존이 아니라 의도된 현재 동작임을 보여준다.
  - 상세: 이번에 신설된 4-tier 우선순위(branch-changed / plan-mentioned / 나머지 / catalog
    최후순위)는 "8회 재발" 기록에 실제로 등재된 각 사례(대상 파일이 `--impl-done`에서
    branch-changed 이거나 `--impl-prep`에서 plan 본문에 언급된 경우)는 정확히 해소한다 —
    거기까지는 검증했고 정확하다. 그러나 대상 파일이 **branch-changed 도 아니고 plan에도
    언급되지 않는** 세션(예: 코드는 이전 커밋에서 이미 반영돼 diff-base 이후로는 "변경"으로
    안 잡히거나, plan 문서가 파일명을 직접 언급하지 않는 경우)에서는 대상 파일이 여전히 다른
    두 자리 번호 파일들과 같은 tier(2)에 놓이고, 그 tier 안에서는 `1-auth.md` <
    `10-graph-rag.md` < `11-mcp-client.md` < `4-execution-engine.md` 순의 사전식 비교가
    그대로 적용돼 8회 재발의 근본 패턴이 재현될 수 있다. 이는 문서 자신의 미체크 항목이 이미
    인정하는 잔여 범위이므로 "은폐된" 결함은 아니지만, 상단 배너의 "종결"·"수정 완료" 언어가
    그 잔여 범위를 명확히 구분하지 않고 뭉뚱그려, 이 티켓이 완전히 닫혔다는 인상을 준다.
  - 제안: 배너의 "수정 완료" 범위를 "8회 기록된 특정 재발 증상(대상이 tier 0/1로 승격되는
    경우)"으로 좁혀 쓰고, natural sort 항목은 여전히 열려 있는 후속임을 배너에도 반영할 것
    (본문 체크박스와는 이미 일치하므로, 상단 요약 문구만 정정하면 된다).

- **[INFO]** 이 변경 영역(`.claude/` 하네스 도구)에는 `spec/` 문서가 없다 — 제품 spec 은
  `codebase/`를 대상으로 하고 이 PR은 리뷰/일관성 게이트 자체(harness)를 다루므로 대상 밖이다.
  대신 `plan/in-progress/harness-consistency-summary-downgrade-rule.md` /
  `harness-review-gate-ci-backstop.md`(작업 SoT), `.claude/agents/consistency-summary.md`,
  `.claude/skills/consistency-checker/SKILL.md`를 spec 대용으로 삼아 line-level 대조했다.
  핵심 요구사항(하향 금지 + planner 인계 §요약 지침 3/4, `in_flight_ok` opt-in 분리, 기본
  changeset 경고)은 코드·테스트와 문서 간 항목 번호까지 정확히 일치한다(예:
  `SKILL.md`가 인용하는 "`consistency-summary.md §요약 지침 3`"은 실제로 "하향 금지" 항목이다).
  불일치는 위 두 WARNING(완료 선언 범위)뿐이었다.

## 요약

`in_flight_ok` opt-in 분리(push는 절대 opt-in 하지 않음을 실제 서브프로세스로 확인),
`consistency-summary`의 하향 금지 + planner 인계 경로 신설, 기본 `--prepare` changeset 의
브랜치 diff 누락 경고, `prioritize_bundle_files`를 통한 4-tier 번들 우선순위 — 이 네 가지
핵심 요구사항은 코드·테스트·문서 삼자가 정확히 맞물려 구현됐고 직접 실행으로 재확인했다.
다만 같은 diff에 포함된 다섯 번째 항목("예산 초과 파일 무표시 누락" 수정)은 부분적으로만
구현됐다: 새로 추가한 생략-고지 자체가 예산 계산 밖에 있어 하네스 자신의 회귀 테스트
(`test_prompt_stays_within_the_size_cap`)를 **지금 이 브랜치에서 실제로 깨뜨리고 있고**,
구조적으로 동일한 두 번째 분기(diff-only 초과)는 이번 수정이 아예 닿지 않았다. 부수적으로,
같은 PR이 참조하는 번들-우선순위 수정도 상단 배너의 "종결" 언어와 달리 근본 원인(natural
sort 부재)은 문서 자신의 체크리스트에도 열려 있는 채로 남아 있다. 즉 이 브랜치는 "완료"로
선언된 항목 중 최소 2건이 선언보다 좁은 범위만 실제로 닫혔으며, 그중 하나는 눈에 보이는
테스트 실패로 이어진다 — merge 전 CRITICAL 항목(예산 미계상)의 수정과 테스트 재실행이
필요하다.

## 위험도
CRITICAL
