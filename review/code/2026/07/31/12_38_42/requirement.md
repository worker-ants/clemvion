# 요구사항(Requirement) Review — harness-review-gate-fixes-1bd6aa (3차 라운드)

## 조사 방법

`git diff origin/main...HEAD`(9개 커밋)로 실제 변경분을 확인했다. 프롬프트 크기 제한으로 전체가
실리지 않은 4개 파일(`review_guard.py` / `code_review_orchestrator.py` /
`consistency_orchestrator.py` / `tests/README.md`)은 `Read`/`grep -n`으로 직접 열람해 실제
소스 줄번호를 확보했다. 이 브랜치는 이미 2회의 리뷰-수정 라운드를 거쳤다
(`review/code/2026/07/31/11_58_11` → 커밋 `426f8bd40` "2R 리뷰 반영"). 본 라운드는 **11_58_11
라운드가 지적한 CRITICAL/WARNING 이 실제로 닫혔는지**를 재검증하는 데 집중했다:

- 핵심 계약(`evaluate_review`의 `in_flight_ok` opt-in, `warn_if_committed_work_is_missing`,
  `prioritize_bundle_files`, `build_files_section`의 생략-고지)을 코드 판독 + 직접 실행으로
  검증.
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 전체 실행 → **695 tests, OK**
  (11_58_11 라운드 당시 "693 tests, 1 FAIL" 이었던 `test_prompt_stays_within_the_size_cap` 포함,
  전부 통과 확인).
- `guard_review_before_push.py`에서 `evaluate_review`가 실제로 `in_flight_ok=True`를 절대
  넘기지 않는지 소스 레벨로 재확인(`_accepts_cwd`/`_evaluate_over_targets`).
- **11_58_11 라운드가 CRITICAL 로 지적한 "생략-고지 자신의 바이트 비용이 예산에 안 잡힘" 결함의
  수정(`426f8bd40`)이 실제로 일반적으로 성립하는지**를 `build_files_section`을 직접 import 해
  다양한 파일 수·예산으로 재현 테스트했다 — 그 결과가 아래 CRITICAL 이다(이미 고쳐진 것을
  재지적하는 것이 아니라, 그 수정 자체가 불완전함을 새로 발견한 것).

## 발견사항

- **[CRITICAL]** `build_files_section`의 신규 예산-선반영(reservation) 전략이 "생략 안내는
  반드시 같은 예산 안에서 지불된다"는 자신의 설계 불변식을 **파일 수가 많아지면 다시 위반한다**
  — 11_58_11 라운드가 지적했던 CRITICAL(생략 고지 14건에서 재현)을 고치려고 도입한 바로 그
  메커니즘이, 파일 수가 더 늘면 같은 클래스의 결함을 다시 재현한다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:693-708`
    (`_notice_cost`/선반영 주석 — "The omission notices ... must be paid for out of the same
    budget"), `:710-736`(`include_content`/`refund` 루프), `:738-749`(렌더 루프, 특히
    `:743-747` `elif fp["full_content"]:` 무조건 `_omitted_content_note` 삽입),
    `:577-579`(`_omitted_content_note` docstring의 "Mirrors the same fix already made on the
    consistency side" 주장). 대조: 실제로 안전한 자매 함수
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:650-691`
    (`truncate_file_bundle` — 매 반복마다 "이미 뺀 파일들의 고지 총합 + 남은 파일" 을 다시 실측해
    예산과 비교하는 **iterative re-validation**). 테스트 커버리지 갭:
    `.claude/tests/test_prompt_omission_notice.py:149-174`
    (`test_notices_are_paid_for_out_of_the_same_budget`)는 파일 20개만 사용해 이 일반적
    불변식을 검증하지 못한다.
  - 상세: 현재 구현은 "모든 미포함 파일의 생략-고지 비용을 **한 번에 선반영**하고, 실제로 내용을
    포함시키는 파일마다 그 몫을 환불(refund)"하는 방식이다. 이 방식은 11_58_11 라운드가 실측한
    특정 사례(14개 파일, 143,605자 cap)는 정확히 고친다 — 직접 재실행으로
    `test_prompt_stays_within_the_size_cap`가 지금 GREEN 임을 확인했다. 그러나 이 전략은
    **"선반영한 예산" 자체가 이미 남은 예산(R0 = max_total_size - base_size)을 넘어서면** 그
    사실을 검증하거나 축소하지 않고, 렌더 루프(:743-747)가 미포함 파일 전원에게 여전히 **전체
    길이의** `_omitted_content_note`를 무조건 붙인다. 즉 파일 수가 늘어날수록 총 문서 길이는
    `max_total_size`를 비례해서 초과하며 상한이 없다. 직접 재현(합성 change_info, diff/헤더만
    있고 full_content 는 각각 약 150줄):
    ```
    n=200  files → 실제 반환 길이 142,785자   (DEFAULT_MAX_PROMPT_SIZE=141,557 대비 1.01배, OVERFLOW)
    n=600  files → 실제 반환 길이 162,583자   (1.15배, OVERFLOW)
    n=1200 files → 실제 반환 길이 192,249자   (1.36배, OVERFLOW)
    ```
    (더 작은 예산·짧은 파일명으로는 n=60, max_total=8000 만으로도 9,405자로 넘친다 — 극단적인
    입력이 아니라 이 저장소가 이미 여러 번 겪은 "대량 파일 changeset" 규모에서 재현된다. 이
    저장소 자신도 §카탈로그 자동생성 파일 약 230개, "생략된 파일 46개" 등 유사 규모의 선례를
    이미 문서화하고 있다.) `n=200`은 `build_agent_prompt_body`가 실제로 넘기는
    `DEFAULT_MAX_PROMPT_SIZE`(141,557, `header` 차감 전) 그대로 사용했으므로 프로덕션 경로의
    실제 상한과 동일 조건이다 — 즉 대규모 changeset 리뷰에서 실제로 발생할 수 있는 시나리오다.
    함수 자신의 주석(:693-702)은 "reserve for ALL of them upfront"가 "그렇지 않으면 payload가
    자기 cap을 넘는다"의 해법이라 명시하지만, 파일 수가 충분히 많을 때는 정확히 그 해법 자체가
    똑같이 예산을 넘긴다 — 함수명/주석이 약속하는 불변식과 실제 구현이 어긋난 사례
    (checklist 항목 4 "의도와 구현 간 괴리").
  - 제안: `truncate_file_bundle`이 이미 쓰고 있는 **반복 재검증** 방식으로 통일할 것 — "이미
    생략 확정된 파일들의 고지 총합 + 아직 포함 여부 미정인 파일들"을 한 번에 선반영해 추정하지
    말고, 파일을 하나씩 포함/생략 결정할 때마다 "지금까지 확정된 전체 길이(포함 콘텐츠 + 이미
    생략된 파일들의 고지 총합)"를 실측해 예산과 비교. 최소한의 안전판으로, 최종 조립 후
    `len(result) > max_total_size`이면 개별 파일별 나열 대신 "N개 파일 생략(경로는 하단
    목록)"처럼 압축된 단일 고지로 대체하는 폴백을 추가. `test_prompt_omission_notice.py`에
    파일 수를 수백 개로 늘린(또는 `DEFAULT_MAX_PROMPT_SIZE`급 실규모) 회귀 케이스를 추가해
    "선반영 전략은 N이 커지면 무너진다"를 비-vacuous 하게 고정할 것.

- **[WARNING]** (테스트 견고성 — 이번 diff 의 로직 결함은 아님) 신규
  `test_push_never_opts_into_the_in_flight_concession`가 실제 저장소의 `git worktree list`
  상태에 의존해 드물게 flaky 할 수 있다.
  - 위치: `.claude/tests/test_guard_review_before_push_main.py:152-186`(`_run()` 헬퍼 —
    `subprocess.run`에 `cwd=`를 넘기지 않아 호출 프로세스의 실제 cwd, 즉 이 저장소의 실제
    checkout 을 그대로 상속한다). 같은 파일의 신규 테스트:
    `test_push_never_opts_into_the_in_flight_concession`(214-231행 부근).
  - 상세: pytest 로 이 파일을 다른 4개 신규 테스트 파일과 함께 14회 반복 실행했을 때 **1회**
    `set(observed) == {"True"}` (기대값 `{"False"}`)로 실패했으나, 동일 조합/동일 파일 단독
    실행 모두 이후 13회 연속 통과했고 공식 러너(`python3 -m unittest discover`, 695 tests)도
    통과했다. `guard_review_before_push.py` 소스를 직접 확인한 결과 `evaluate_review`를
    호출하는 유일한 경로(`_evaluate_over_targets` → `evaluate(target)`)는 `in_flight_ok`를
    전혀 전달하지 않으므로, 로직 자체의 회귀는 아닌 것으로 판단한다(재현 실패로 근본 원인은
    100% 특정하지 못함). 다만 `_run()`이 실제 저장소 cwd 를 그대로 쓰는 설계는 같은 스위트의
    형제 테스트(`test_stop_guard_failopen.py`가 `cwd=self.tmp`를 명시)와 다른 패턴이라 견고성
    관점에서 개선 여지가 있다.
  - 제안: `_run()`이 `subprocess.run`에 격리된 임시 git 저장소(또는 최소 `cwd=self.tmp`)를
    넘기도록 해, 이 파일의 모든 서브프로세스 호출이 실제 다중 워크트리 저장소 상태와 무관하게
    결정적으로 동작하도록 할 것.

- **[INFO]** spec fidelity — 이 변경 영역(`.claude/` 하네스 도구)에는 대응하는 `spec/` 문서가
  없다. `spec/conventions/spec-impl-evidence.md` · `user-guide-evidence.md`의 `code:` glob도
  `codebase/frontend/**`만 가리켜 이 PR과 무관함을 확인했다(product spec 대상 밖). 대신
  `.claude/agents/consistency-summary.md`, `.claude/skills/consistency-checker/SKILL.md`,
  `plan/in-progress/harness-consistency-summary-downgrade-rule.md`/
  `harness-review-gate-ci-backstop.md`를 spec 대용으로 line-level 대조했다:
  - `consistency-summary.md`의 신규 §요약 지침 3(하향 금지)/4(planner 인계) + `## planner 인계`
    표(46-58/74-82행)와 `SKILL.md`의 인용("`consistency-summary.md §요약 지침 3`",
    113-121행)이 항목 번호까지 정확히 일치.
  - `--diff-base`의 argparse help(`consistency_orchestrator.py:865-867` 부근)와 `SKILL.md`
    본문이 이제 "전 모드 공통으로 번들 우선순위 산정에도 쓰인다"를 명시해, 11_58_11 라운드가
    지적했던 "문서는 `--impl-done` 전용이라 조용히 스코프 확장" 불일치가 해소됨을 확인.
  - 두 plan 문서의 "수정 완료" 배너가 이번엔 잔여 범위(natural sort 미구현, CI 백스톱 미착수)를
    명시적으로 좁혀 서술해, 11_58_11 라운드가 지적한 "종결 언어가 잔여 범위를 뭉뚱그림" 문제도
    해소됨.
  - 테스트 개수 인용도 실측과 일치(`test_consistency_bundle_priority.py` "13건" = 실제 13,
    `test_review_changeset_warning.py` "11건" = 실제 11).
  - 위 CRITICAL 을 제외하면 문서·코드 간 새로운 불일치는 발견하지 못했다.

- **[INFO]** 실행으로 재확인한 정상 동작(회귀 없음): `evaluate_review(cwd=None, *,
  in_flight_ok=False)` — push 경로(`guard_review_before_push.py`)는 여전히 `in_flight_ok`를
  넘기지 않고, Stop 경로(`guard_review_before_stop.py:344`)만 `in_flight_ok=True`를 넘긴다
  (grep 으로 두 곳뿐임을 확인). `warn_if_committed_work_is_missing`은 기본 changeset 경로에서만
  발화하고 `--branch`/`--range`/`--commit`/`--staged`에서는 침묵하며 git 실패를 흡수한다.
  `prioritize_bundle_files`의 4-tier 우선순위(branch-changed > plan-named > 나머지 >
  catalog-bulk)는 의도된 4개 호출 지점(`--impl-prep`/`--impl-done` scope 번들,
  `related_specs`, `conventions`) 모두에 배선돼 있다(단, `plan_in_progress` 번들은 plan
  문서 자신이 "적용 지점" 목록에서 의도적으로 제외했으므로 여전히 사전순 — 새로운 발견 아님).

## 요약

이 브랜치는 이미 2라운드의 자체 리뷰-수정 사이클을 거쳤고, 그 사이클에서 지적된 CRITICAL 1건 +
WARNING 다수(직전 라운드 SUMMARY 기준)는 실제로 대부분 정확히 닫혔다 — `in_flight_ok` opt-in
분리, 하향 금지 + planner 인계 경로, 기본 changeset 누락 경고, 4-tier 번들 우선순위는 코드·
테스트·문서 삼자가 항목 번호까지 일치하고, 하네스 자체 회귀 테스트(695개)가 전부 GREEN 이다.
다만 그 CRITICAL을 고친 방식("생략 고지 비용을 예산에 선반영") 자체가 일반적으로는 성립하지
않는다는 새로운 결함을 발견했다: 파일 수가 늘어나면(실측상 기본 예산 기준 약 200개, 좁은
예산에서는 훨씬 적은 수로도) 렌더 루프가 여전히 무조건 전체 길이의 생략-고지를 붙여 문서가
`max_total_size`를 다시 초과한다 — 이 PR이 없애려는 바로 그 실패 클래스가 규모만 바뀌어
재발한다. 자매 함수(`truncate_file_bundle`)는 반복 재검증 방식으로 이미 이 문제를 일반적으로
해결해 뒀으므로, 같은 전략으로 통일하는 것이 제안이다. 그 외 테스트 견고성(1건, flaky 의심이나
로직 결함은 아님) 외에는 요구사항 충족·spec 정합성 모두 양호하다.

## 위험도
CRITICAL
