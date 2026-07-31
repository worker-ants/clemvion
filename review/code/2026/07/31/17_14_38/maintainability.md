# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `build_files_section` 이 여전히(그리고 이번 diff 로 한 번 더) 4가지 서로 다른 절단 전략을 한 함수 안에 겸임하는 god function 이다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:607-807` (이번 diff 가 실제로 손댄 부분은 `633-664`의 `numbered`/`total_lines`/`source_lines` 신설, `694`의 `_charge_notice` 적용, `735-772`의 예약·환불 산술)
  - 상세: 이 함수 하나가 (1) 파일별 header/diff/full-content 조립, (2) `max_total_size<=0` 무제한 통과, (3) header+diff 만으로도 예산 초과 시 diff 를 역순으로 재절단하는 루프, (4) 정상 예산에서 "예약(reserve)·환불(refund)" 산술로 콘텐츠 포함 여부를 정하며 그 안에 중첩 함수 `_notice_text`/`_render`까지 정의하는 분기, (5) 그마저 넘치면 개별 알림을 집계 알림으로 접는 2차 폴백까지 전부 처리한다. 이번 diff 는 `_charge_notice`라는 이름 있는 헬퍼를 뽑아 예산 차감 산술 자체는 정리했지만(좋은 개선), 그 헬퍼가 다시 이 함수 본문 3곳에 인라인으로 흩뿌려지는 구조는 그대로이고, 새 필드(`source_lines`/`total_lines`) 2개가 이미 붐비는 per-file dict 에 추가로 얹히며 함수는 오히려 더 길어졌다(diffstat 기준 이 함수 본문만 net 약 +15~20줄). 순환 복잡도가 높아 어느 분기를 고치는지 착각하기 쉬운 구조이고, 실제로 직전 라운드에서 바로 이 함수의 절단 로직 수정이 회귀 테스트 없이 들어갔다가 이번 라운드에 와서야 fixture 로 잠긴 이력이 있다 — 함수가 작게 쪼개져 있었다면 "이 분기는 아직 테스트가 없다"는 사실이 훨씬 눈에 띄었을 것이다.
  - 제안: (2)/(3)/(4)/(5) 네 전략을 각각 이름 있는 top-level 함수로 추출(예: `_render_unlimited`, `_shrink_diffs_to_fit`, `_budget_full_content`, `_collapse_to_aggregate_notice`). 최소한 이번 diff 가 만진 "1차+2차 절단" 경로만이라도 별도 함수로 뽑으면 다음 회귀는 더 작은 표면에서 재현·수정 가능하다.

- **[WARNING]** `collect_context` 도 동일 계열의 god function 이며, 이번 diff 가 그 안에 코드를 더 얹었다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:473-654` (이번 diff 가 추가한 부분은 `--impl-done` 분기 내 `585-608`, 특히 `_DIFF_LABEL`/`diff_section` 조립)
  - 상세: diff_base 계산 → ranking 입력(`_rank_changed`, `_rank_plan_text`) 준비 → 중첩 함수 `_prioritized`/`_require_target` 정의 → 4개 모드(`--spec`/`--plan`/`--impl-prep`/`--impl-done`) 분기 → spec/conventions/plan 번들 조립까지 한 함수가 전부 처리한다. 이번 diff 는 `--impl-done` 분기에 diff 섹션용 sentinel 경계·라벨 조립 로직을 몇 줄 더 추가했는데(정당한 버그 수정이지만) 위치는 여전히 이 거대 함수의 내부다. 지역 변수 수가 많아(`diff_base`, `_rank_changed`, `_rank_plan_text`, `excluded`, `target_path_rel`, `target_doc`, `mode_label` 등) 함수 전체 흐름을 추적하려면 위아래로 계속 오가야 한다.
  - 제안: 최소한 "모드별 target 확정"과 "보조 번들(spec/conventions/plan) 조립"을 두 단계 함수로 분리 권장. `--impl-done`의 diff 섹션 조립(`_DIFF_LABEL` 포함)만이라도 `_build_diff_section(diff_base, root)` 같은 별도 함수로 뽑으면 이번 diff 가 만든 로직의 단위 테스트가 더 쉬워진다.

- **[INFO]** 새로 도입된 지역 변수 `_DIFF_LABEL`이 모듈 상수 컨벤션(ALL_CAPS)을 함수 지역 변수에 잘못 적용했다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:590`
  - 상세: `_DIFF_LABEL = f"<git diff {diff_base}...HEAD -- code_areas>"`는 `collect_context` 함수 안, `--impl-done` 분기에 국한된 지역 변수이고 매 호출마다 `diff_base`값에 따라 새로 계산된다. 그런데 이름은 모듈 레벨 상수에 쓰는 ALL_CAPS 스타일이다. 같은 파일과 `code_review_orchestrator.py` 전체를 검색해도 함수 지역 변수에 이 스타일을 쓴 곳은 이 한 곳뿐이라(grep 확인), 나머지 코드베이스의 snake_case 지역 변수 관례와 어긋난다. 실질적 버그는 아니지만, 이후 누군가 "이미 상수화돼 있으니 모듈 레벨로 끌어올려도 되겠다"고 오판할 여지가 있다.
  - 제안: `diff_label`로 소문자화(snake_case).

- **[INFO]** 신설 테스트 메서드 본문 시작부에 의도 없는 빈 줄이 남아 있다.
  - 위치: `.claude/tests/test_prompt_omission_notice.py:272-274` (`def test_silent_when_everything_fits(self):` 바로 다음 줄인 273행이 공백)
  - 상세: 바로 위에 새 테스트(`test_a_twice_cut_file_reports_its_real_total`, 243-270행)를 삽입하는 과정에서 남은 편집 잔여물로 보인다. 함수 시그니처와 첫 statement 사이에 의미 없는 빈 줄이 끼어 있어, 이 파일의 다른 테스트 메서드들과 비교했을 때 일관성이 없다.
  - 제안: 273행의 빈 줄 제거.

- **[INFO]** 신설 테스트 클래스 내부에 메서드 사이 빈 줄이 2개로, 같은 클래스 안 다른 메서드 경계(전부 1개)와 다르다.
  - 위치: `.claude/tests/test_consistency_context_budget.py:193-196` (`test_a_document_that_writes_the_sentinel_cannot_forge_a_boundary` 종료(193행)와 `test_rationale_sections_are_neutralised_too` 시작(196행) 사이 194-195행이 모두 공백)
  - 상세: PEP8 관례상 클래스 내부 메서드 간 구분은 빈 줄 1개, 빈 줄 2개는 최상위(top-level) 정의 사이에 쓴다. 이 파일 전체에서 메서드 앞에 빈 줄이 2개인 곳은 이 한 군데뿐이라(스크립트로 전수 확인), 신설 시 발생한 사소한 편집 잔여물로 보인다.
  - 제안: 195행(또는 194행) 삭제해 다른 메서드 경계와 통일.

- **[INFO]** (참고, 이번 diff 대상 아님) 상태관리 헬퍼 5종이 두 orchestrator 파일에 사실상 동일 코드로 복제되어 "Change both" 주석에 의존한다.
  - 위치: `code_review_orchestrator.py:183-374`(`_load_state` 183, `_save_state` 192, `_reconcile_state_with_disk` 197-242, `_emit_summary_state` 245, `_apply_status_update` 340-374) ↔ `consistency_orchestrator.py:87-192`(동일 함수군, 87/96/101-140/143/163-192)
  - 상세: 이번 diff 는 이 함수들을 건드리지 않았지만, 정확히 같은 파일 안에서 이번 diff 가 정리한 `_charge_notice`/`_notice_text` 바로 옆에 위치한 코드라 함께 짚어둔다. 두 orchestrator 의 `_apply_status_update`는 공백·docstring 차이를 빼면 사실상 동일 로직이고, `code_review_orchestrator.py:43-47`의 주석은 바로 이 "두 벌 유지 + change-both 주석" 패턴이 실제로 divergence 를 낸 전례(그래서 `report_paths.py`를 `_shared/`로 뽑았다는 사연)를 스스로 기록하고 있다. 즉 같은 위험군이 아직 남아 있다.
  - 제안: 지금 당장 조치할 필요는 없으나(이번 diff 의 스코프 밖), 다음에 이 함수군 중 하나라도 다시 손대야 할 일이 생기면 `report_paths.py` 선례처럼 `_shared/retry_state.py`(가칭)로 추출하는 것을 고려할 것.

## 요약

이번 diff 자체의 신규 코드(`_charge_notice`, `_natural_key`, `_neutralize_sentinel`, `_notice_cost`→`_notice_text` 재명명, `_DIFF_LABEL`/sentinel 기반 diff 섹션 경계)는 이름이 목적을 잘 드러내고 "왜 이렇게 했는가"를 설명하는 근거 주석이 이 코드베이스의 기존 관례와 일관되게 매우 촘촘하며, 각 변경마다 대응하는 회귀 테스트(`test_a_twice_cut_file_reports_its_real_total`, `test_rationale_sections_are_neutralised_too`, `test_a_document_that_writes_the_sentinel_cannot_forge_a_boundary` 등)가 짝을 이루고 있어 개별 조각의 품질은 높다. `_charge_notice` 추출은 예산 차감 산술이 두 지점에서 각각 다르게 누락됐던 실제 결함 재발을 막는 합리적인 리팩터다. 다만 그 개선이 얹히는 그릇 자체 — `build_files_section`(약 200줄, 전략 4가지 혼재)과 `collect_context`(약 180줄, 4-모드 분기+번들 조립 혼재) — 는 여전히 하나의 함수가 너무 많은 책임을 지는 구조이고, 이번 diff 도 그 함수들을 쪼개지 않은 채 로직을 더 얹었다. 그 외에는 새 지역 변수 하나의 네이밍 컨벤션 불일치와 신설 테스트 2곳의 사소한 빈 줄 잔여물 정도만 눈에 띄며, 전반적으로 회귀 위험은 낮고 구조적 부채만 누적 중인 상태다.

## 위험도

MEDIUM
