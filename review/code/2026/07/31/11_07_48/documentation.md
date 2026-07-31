STATUS=success documentation review complete — 11 files, 1 CRITICAL (harness prompt-assembly, pre-existing/out-of-diff), 0 WARNING, 3 INFO

===REPORT_MARKDOWN_BELOW===

# 문서화(Documentation) Review — harness-review-gate-fixes-1bd6aa

## 조사 방법

`_prompts/documentation.md`의 파일 1(`_lib/review_guard.py`)·파일 3(`code_review_orchestrator.py`)
항목에 unified diff 도 전체 파일 컨텍스트도 전혀 실려 있지 않아(헤더 두 줄뿐), 두 파일의 실제
변경분을 확인할 수 없었다. 이 세션(`review/code/2026/07/31/11_07_48/`) 자체를 대상으로
`git diff origin/main...HEAD`를 워크트리에서 직접 실행해 11개 변경 파일 전체의 실제 diff를
확보하고, 관련 소스(`code_review_orchestrator.py`의 `build_files_section`, `review_guard.py`,
`guard_review_before_stop.py` 등)를 `Read`로 직접 열람해 아래 발견사항을 작성했다. 인용하는
줄 번호는 모두 이렇게 직접 연 원본 파일의 실제 줄 번호이며, 프롬프트 문서 내 오프셋이 아니다.

## 발견사항

- **[CRITICAL]** 이 리뷰 세션 자체에서 실측됨 — `code_review_orchestrator.py`의 프롬프트
  조립 로직이 정확히 이 PR의 핵심 파일 2개(`review_guard.py`, `code_review_orchestrator.py`
  자신)를 **14개 reviewer 프롬프트 전원에서 아무 표시 없이 통째로 누락**시켰다. (diff 자체가
  건드리지 않은 사전 존재 결함이지만, 이 PR 리뷰 도중 실제로 발생해 리뷰 신뢰성에 직접 영향)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 함수
    `build_files_section` 내 "remaining_budget" 분기(대략 643~673행, 특히 예산 소진 시
    `break`로 루프를 끝내는 지점) — 프롬프트가 아니라 소스 파일을 직접 `Read`해 확인한 실제
    줄 번호.
  - 상세: 세션의 `meta.json`을 보면 이번 호출은 `route_mode: "all"` + `agents_explicit: false`,
    `_retry_state.json`의 `routing_skip_reason: "--route=all"`로, 변경 파일 11개를 positional
    인자로 명시해 호출됐다(plan 문서가 기록한 그 "우회" 방식과 일치). 이 모드에서는
    `diff_getter`가 없어 `code`(diff)가 모든 파일에서 공란이 되고, `full_file_content`만
    현재 워킹트리에서 채워진다. `build_files_section`은 `full_content_size` **오름차순**으로
    파일을 정렬해 예산이 허용하는 한 순서대로 전체 내용을 채우다가, 예산이 바닥나는 시점에
    처리 중이던 파일 **하나만** "...(프롬프트 크기 제한으로 N/M 줄만 표시)..." 노트와 함께
    잘라 넣고 `break`로 루프를 완전히 끝낸다. 정렬상 그보다 더 큰 나머지 파일들은
    `include_content`에 아예 들어가지 못하고, diff도 이번 세션 한정으로 전부 공란이라
    **헤더 한 줄만 남고 코드가 전혀 없다.** 실측: 11개 파일을 줄 수 오름차순 정렬하면 정확히
    `consistency_orchestrator.py`(938줄)에서 예산이 소진돼 370/938로 부분 절단되고, 그보다
    큰 `review_guard.py`(960줄)와 `code_review_orchestrator.py`(1,357줄, 최대 파일)는 diff·
    전체 내용 모두 완전히 비어 있다. `_prompts/documentation.md`뿐 아니라 같은 세션의
    `_prompts/security.md`에서도 파일 1·파일 3이 바이트 단위로 동일하게 비어 있음을 직접
    대조 확인했다 — 특정 reviewer 프롬프트만의 문제가 아니라 세션 조립 단계 전체에 영향을
    준다. `scope` reviewer(`scope.md`)도 독립적으로 같은 두 파일의 누락을 관측해
    `git diff`로 직접 우회했다고 기록했지만(조사 방법 절), 이를 "조사 방법" 각주로만 남기고
    정식 발견사항으로 올리지 않은 채 위험도 NONE으로 마감했다 — 본 리뷰는 문서화/관측가능성
    관점에서 이를 정식 결함으로 승격한다.
  - 왜 중요한가: 이 두 파일에는 정확히 이번 PR의 핵심 수정(`evaluate_review`의
    `in_flight_ok` opt-in 스코프 축소, `warn_if_committed_work_is_missing` 신설)이 들어
    있다. 프롬프트만 받은 reviewer는 아무 근거 없이 "문제 없음"을 낼 수 있고, 이는 이 PR
    자체가 8회 재발로 지목한 "`BLOCK: NO`가 '검증했음'이 아니라 '검증 대상이 프롬프트에
    없었음'을 의미할 수 있다"는 바로 그 실패 패턴을 code-review-agents 오케스트레이터에서도
    재현한다 — 다만 이번 PR은 그 패턴을 consistency-checker(`prioritize_bundle_files`,
    `truncate_file_bundle`의 생략 목록) 쪽만 고쳤고, code-review-agents의 이 경로는 손대지
    않았다.
  - 제안: `remaining_budget` 분기에서 예산을 다 채우지 못한 파일에 대해 `break` 대신
    `continue`하되, 내용을 전혀 못 넣은 파일에도 반드시 **명시적 생략 표시**를 header 아래
    남길 것 — `consistency_orchestrator.py`가 이번 PR에서 신설한 `truncate_file_bundle`의
    누락 목록(`OMITTED_FILES_HEADING`) 패턴을 그대로 재사용하거나, 이미 diff-truncation
    분기(라인 638)에 있는 `"... (프롬프트 크기 제한으로 diff 생략 — 원본 파일 참조) ..."`
    placeholder를 full-content 분기에도 적용할 것. 헤더만 있고 아무 본문도 없는 상태를
    "정상적으로 아주 작은 파일"과 구분할 수 없게 두면 안 된다.

- **[INFO]** plan 문서의 테스트 개수 실측 오차 — `test_review_changeset_warning.py`
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md` — "테스트
    `test_review_changeset_warning.py` 9건 + mutation 4종 RED." 문구가 있는 항목
    (diff 상 새로 추가된 §(2) 처리 기록 블록 안).
  - 상세: 실제 실행 결과 이 파일의 테스트 메서드는 10개다(`python3 -m unittest
    test_review_changeset_warning -v` → `Ran 10 tests`, `grep -c "    def test_"`도 10).
    문서는 "9건"으로 1개 적게 기재했다. `test_consistency_bundle_priority.py`의 "10건"
    기재는 실측과 정확히 일치함을 함께 확인했다(대조군).
  - 제안: "10건"으로 정정.

- **[INFO]** plan 문서의 줄 번호 인용이 실제 호출부가 아니라 그 위 설명 주석의 시작 줄을 가리킴
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md` — "stop
    가드(`guard_review_before_stop.py:340`)"라고 인용한 부분.
  - 상세: 실제 `evaluate_review(in_flight_ok=True)` 호출은 `guard_review_before_stop.py:344`
    이고, 340행은 그 위 설명 주석("`in_flight_ok=True` is Stop-only: ...")의 첫 줄이다. 같은
    문장이 짝으로 인용한 `guard_review_before_push.py:846`은 실제 호출 인자가 있는 줄을
    정확히 가리키는 것과 비교하면 정밀도가 떨어진다(범위 안이라 완전히 틀렸다고 보긴 어려움).
  - 제안: 필요시 "340-344" 또는 "344"로 정정.

- **[INFO]** 신설된 `warn_if_committed_work_is_missing` 어드바이저리가 SKILL.md 사용자 문서에는
  반영되지 않음
  - 위치: `.claude/skills/code-review-agents/SKILL.md` §1 "옵션" 목록 (해당 함수 자체는
    `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`에 신설).
  - 상세: SKILL.md의 "인자 없음 → git diff (staged + unstaged + untracked)" 서술은 이 변경
    이후에도 여전히 참이며 깨지지 않았다. 다만 "인자 없음으로 실행했을 때 이미 커밋된
    브랜치 작업이 changeset에서 빠지면 stderr 경고가 뜨고 `--branch <base>` 재실행을
    안내한다"는 사용자 관점의 새 동작은 스킬 문서에 한 줄도 없다. 필수 사항은 아니다(동작은
    완전 자동이고 advisory-only라 워크플로 자체가 바뀌지 않으며, 기존 서술의 사실성도
    훼손되지 않았다).
  - 제안: 우선순위 낮음(nice-to-have) — §1 옵션 아래 한 줄 추가를 검토.

## 확인한 항목 중 문제 없음 (양호 사례로 기록)

- `review_guard.py`: `_IN_FLIGHT_TTL_SECONDS` 주석과 `_code_review_in_flight`/`evaluate_review`
  docstring 3곳 모두, 이전에 "the push guard still hard-gates"라고 무조건 서술했던 것이 실제로는
  `in_flight_ok` opt-in 없이는 거짓이었다는 사실과 그 결함의 재발 방지 근거(regression 테스트
  `EvaluateInFlightShortCircuitTest` 명시)를 함께 정정 — 버그·원인·수정·회귀테스트를 모두 연결한
  모범적인 주석 갱신.
- `guard_review_before_stop.py`: `evaluate_review(in_flight_ok=True)` 호출부에 왜 Stop 전용
  opt-in인지, push 가드는 왜 이 인자를 안 넘기는지 4줄 인라인 주석으로 명확히 설명.
- `consistency_orchestrator.py`: `prioritize_bundle_files`/`_is_catalog_bulk`/
  `_branch_changed_rels`/`_head_basis_notice` 모두 실측된 실패 사례(8회 재발, 정확한 세션
  경로·측정치)를 인용하는 docstring을 갖췄고, 코드 자체 불변식("Read WITHOUT `excluded`...
  because ranking wants every in-progress plan")도 직접 대조해보니 정확했다(호출 시점에
  `excluded`가 실제로 빈 set임을 확인).
  `collect_context`의 신규 4개 호출부는 이번 PR에 새로 추가된 `test_consistency_bundle_priority.py`의
  `CollectContextUsesPriorityTest`가 "호출됐는지"가 아니라 "결과가 실제로 쓰였는지"를
  effect 기준으로 단언하도록 이미 보강돼 있어 vacuous 테스트 위험도 낮다.
- `code_review_orchestrator.py`의 `warn_if_committed_work_is_missing`/`_default_branch_ref`:
  실측치(기본 0건 vs `--branch` 6건)를 포함한 정확한 docstring, advisory-only 계약 명시.
- `.claude/tests/README.md`: 신규 테스트 파일 2개에 대응하는 행이 정확히 추가돼
  `test_tests_readme_catalog.py`가 강제하는 카탈로그 동기화를 만족.
- 두 `plan/in-progress/*.md` 문서: "2026-07-31 진행" 상단 배너로 처리 상태를 항목별 표로
  요약하고, 체크리스트를 실제 완료 상태(`[x]`)로 갱신했으며, 반증된 전제(예: "`--branch`/
  `--range`가 changeset 산정에 안 쓰인다")를 조용히 지우지 않고 반증 사실 자체를 기록해 둔
  점이 이 저장소의 문서 관례(plan-lifecycle, 실측 우선)에 정확히 부합한다.
- CHANGELOG.md: 이 변경분은 harness(`.claude/**`, `plan/**`) 전용이라 `codebase/` 대상인
  CHANGELOG.md 갱신 대상이 아님을 확인(기존 entries가 전부 `spec/*.md` SoT를 인용하는
  product 변경 전용임을 grep으로 확인) — 갱신 누락이 아니라 스코프 밖.

## 요약

diff 자체의 문서화 품질은 매우 높다 — docstring/인라인 주석이 버그 재현 조건·근거·회귀
테스트를 서로 연결하는 모범 사례이고, plan 문서와 테스트 README도 실측치와 함께 정확히
갱신됐다(사소한 오차 2건: 테스트 개수 1개 오차, 줄 번호 인용 정밀도 저하). 다만 이 리뷰
세션 자체에서, 이 PR의 핵심 파일 2개(`review_guard.py`, `code_review_orchestrator.py`)가
`code_review_orchestrator.py`의 프롬프트 조립 로직 결함으로 인해 14개 reviewer 전원에게
아무 표시 없이 완전히 누락되는 것을 직접 확인했다 — diff가 도입한 결함은 아니지만, 이
PR이 고치려는 "reviewer가 대상을 못 봤는데 `BLOCK: NO`가 나온다"는 정확히 같은 실패
클래스가 사후검증(code-review-agents) 경로에도 살아있다는 실증이므로 별도 후속 조치가
필요하다.

## 위험도

CRITICAL
