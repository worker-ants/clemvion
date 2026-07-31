# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `_load_state`/`_save_state`/`_reconcile_state_with_disk`/`_apply_status_update`/`_emit_summary_state` 가 두 orchestrator 파일에 사실상 동일 로직으로 중복 구현되어 있고, "Change both" 주석에 의한 수동 동기화에 의존한다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:183-374`(특히 `_reconcile_state_with_disk` 197-242, `_apply_status_update` 340-374) ↔ `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:87-192`(동일 함수군, `_reconcile_state_with_disk` 101-140, `_apply_status_update` 163-192)
  - 상세: 두 함수의 본문을 대조하면 `_apply_status_update`는 공백·docstring 유무를 빼면 바이트 단위로 동일하고, `_reconcile_state_with_disk`도 로직이 그대로다. 각 docstring 이 스스로 "Mirrors `X._reconcile_state_with_disk`. Change both."(code_review_orchestrator.py:207, consistency_orchestrator.py:109)라고 명시해 이 중복을 인지하고 있음을 보여준다. 더 눈에 띄는 점은, 바로 몇 줄 위(code_review_orchestrator.py:43-47)에 "Report location/validity is shared with the push/stop gate ... each keeping its own copy behind a 'change both' comment already diverged inside one PR" 라는 주석이 있다는 것 — 즉 이 파일은 정확히 같은 "두 벌 유지 + change-both 주석" 패턴이 실제로 divergence 를 낸 전례가 있어 `report_paths.py`를 `_shared/`로 추출했다고 스스로 기록하면서도, `_load_state`/`_save_state`/`_reconcile_state_with_disk`/`_apply_status_update`류는 아직 그 처방을 적용하지 않은 상태다. 동일 위험군이 그대로 남아있는 셈이다.
  - 제안: `report_paths.py`를 추출했던 것과 같은 방식으로 `_shared/retry_state.py`(가칭)에 `_load_state`/`_save_state`/`_reconcile_state_with_disk`/`_apply_status_update`/`_emit_summary_state`의 공통 로직을 추출 권장. "agent"/"checker" 라는 호출자별 용어 차이는 파라미터(라벨 문자열)로 흡수 가능하며, `agents_forced`처럼 한쪽에만 있는 필드는 `.get(..., [])` 로 이미 방어되어 있어 통합 장벽이 낮다.

- **[WARNING]** `build_files_section` 함수가 지나치게 길고(201줄) 서로 다른 4가지 전략을 한 함수 안에서 처리한다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:607-807`
  - 상세: 이 함수 하나가 (1) 파일별 header/diff/full-content part 조립, (2) `max_total_size<=0`일 때의 무제한 분기, (3) header+diff 합만으로도 예산을 넘는 경우 diff 를 파일별로 역순 재절단하는 for 루프(3~4단 중첩: `for idx, fp in indexed` → `if new_len > 0: ... else: ...`), (4) 정상 예산에서 파일별 include/truncate 여부를 "예약(reserve)·환불(refund)" 산술로 결정하며 그 안에 중첩 함수 `_notice_text`/`_render`까지 정의하는 분기, (5) 그마저 넘치면 개별 알림을 집계 알림 하나로 접는 2차 폴백까지 담당한다. 순환 복잡도가 매우 높아 전체를 한 번에 머릿속에 담기 어렵고, 수정 시 어느 분기를 건드리는지 착각하기 쉬운 구조다. 같은 함수 안에 매직넘버 `200`(line 761, `if available > 200:`)도 있는데 왜 200인지 근거 주석이 없다(다른 상수들은 `_GUTTER_OVERHEAD`처럼 실측 근거를 남기는 이 파일의 관례에서 벗어남).
  - 제안: (2)/(3)/(4)/(5) 네 전략을 각각 이름 있는 top-level 함수로 추출(예: `_render_unlimited`, `_shrink_diffs_to_fit`, `_budget_full_content`, `_collapse_to_aggregate_notice`)하고, `200`은 `_MIN_WORTHWHILE_TRUNCATION_CHARS` 등으로 상수화 + 선정 근거 주석 추가.

- **[WARNING]** `collect_context` 함수가 지나치게 길고(176줄) 여러 책임을 겸한다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:473-648`
  - 상세: diff_base 계산 → ranking 입력(`_rank_changed`, `_rank_plan_text`) 준비 → 중첩 함수 `_prioritized`/`_require_target` 정의 → 4개 모드(`--spec`/`--plan`/`--impl-prep`/`--impl-done`) 분기 → spec/conventions/plan 번들 조립 → rationale 추출까지 한 함수가 전부 처리한다. 지역 변수 수가 많고(`diff_base`, `_rank_changed`, `_rank_plan_text`, `excluded`, `target_path_rel`, `target_doc`, `mode_label`, `all_spec_files`, `convention_files`, `other_spec_files`, `plan_files` 등) 함수 전체 흐름을 추적하려면 위아래로 계속 오가야 한다. `build_files_section`과 같은 계열의 문제로, 이 코드베이스의 "prepare용 컨텍스트 조립 함수가 계속 커진다"는 반복 패턴으로 보인다.
  - 제안: 최소한 "모드별 target 확정"(spec/plan/impl_prep/impl_done 분기)과 "보조 번들(spec/conventions/plan) 조립"을 두 단계 함수로 분리 권장. 4개 모드 분기는 각각 별도 헬퍼로 뽑으면 개별 모드만 수정할 때 diff 가 작아진다.

- **[INFO]** 매직 넘버 `20`이 이름 없이 반복된다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:902-903`
  - 상세: `src_paths[:20]`과 `len(src_paths) - 20`에서 리터럴 `20`이 두 곳에 나오며 왜 20인지 설명이 없다.
  - 제안: `_ROUTER_FILE_LIST_PREVIEW = 20` 같은 이름의 모듈 상수로 추출.

- **[INFO]** 테스트 하네스 보일러플레이트(`ORCH`/`_PREAMBLE`/`run_in_orchestrator`)가 두 테스트 파일에 거의 그대로 중복되어 있고, 그 사이에서 같은 개념에 다른 변수명을 쓴다.
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:35-69` ↔ `.claude/tests/test_consistency_context_budget.py:45-86`
  - 상세: "fresh interpreter 로 `consistency_orchestrator.py`를 import 해 subprocess 로 실행"하는 `_PREAMBLE`/`run_in_orchestrator` 골격이 두 파일에 거의 동일하게 복사돼 있다. 그 와중에 자식 프로세스 안에서 저장소 루트를 가리키는 변수명이 한쪽은 `ROOT`(test_consistency_bundle_priority.py:47), 다른 쪽은 `REPO_ROOT`(test_consistency_context_budget.py:57)로 서로 달라 "복사 후 갈라짐"의 전형적 징후를 보인다. `test_consistency_context_budget.py` 자체 docstring이 "`test_line_anchors` 는 같은 collision 을 같은 방식으로 회피한다"고 적어 두어, 최소 3개 테스트 파일이 동일한 subprocess 하네스를 각자 재구현 중임을 시사한다(`test_line_anchors.py:34`도 자체 `ORCH` 상수를 가짐 — 리뷰 대상 파일은 아니라 상세 비교는 생략).
  - 제안: 공용 헬퍼(예: `_harness.run_in_fresh_interpreter(module_path, snippet, arg)`)로 통합하고 변수명도 통일. 3파일 중 하나를 고치고 나머지를 잊는 실수를 원천 차단.

- **[INFO]** 이진 파일 스니핑 청크 크기 `8192`가 이름 없는 리터럴.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:117`
  - 상세: `f.read(8192)`에 대한 설명이 없다. 관용적인 값(8KB)이라 위험도는 낮지만, 이 파일이 다른 상수들(`_GUTTER_OVERHEAD`, `DEFAULT_MAX_FILE_SIZE` 등)에는 상세한 근거를 남기는 관례와 대비된다.
  - 제안: `_BINARY_SNIFF_BYTES = 8192` 로 이름 부여.

- **[INFO]** 결정 배경을 남기는 서술형 주석의 밀도가 매우 높아, 실제 로직보다 배경 설명이 훨씬 긴 블록이 여러 곳에 있다.
  - 위치: 예) `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:52-72`(`_GUTTER_OVERHEAD` 산정 근거), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:656-670`(`CHECKER_BUDGET_RATIO` 산정 근거)
  - 상세: 실측치·회귀 이력을 코드 옆에 남기는 것은 이 코드베이스의 확립된 관례이고 감사(audit) 관점에서 분명한 장점이지만, 처음 파일을 훑는 사람 입장에서는 몇 줄짜리 로직을 찾기 위해 문단 단위 주석을 여러 개 지나쳐야 한다. 결함이라기보다 트레이드오프이며, 별도 조치를 요구하지는 않는다.

## 요약

전반적으로 두 orchestrator 는 스타일·패턴이 서로 매우 일관되고(동일한 CLI 서브커맨드 구조, `debug_log`/`sys.exit` 관례, 상세한 근거 주석), 새로 추가된 `prioritize_bundle_files`/자연 정렬/sentinel 기반 파일 경계 분리/예산 배분 로직은 각각 대응하는 테스트(`test_consistency_bundle_priority.py`, `test_consistency_context_budget.py`)로 뒷받침되어 있어 회귀 위험은 낮다. 다만 두 가지 구조적 패턴이 반복해서 나타난다: (1) 재시도 상태 관리 헬퍼 5종이 두 파일에 사실상 동일 코드로 복제되어 "change both" 주석에만 의존하는데, 이 파일은 바로 그 패턴이 실제로 divergence 를 낸 전례(`report_paths.py` 추출 사유)를 스스로 기록하고 있어 잠재 위험이 가설이 아니라 실증된 것이고, (2) 컨텍스트/프롬프트 조립을 담당하는 핵심 함수(`build_files_section`, `collect_context`)가 각각 200줄 안팎으로 비대해지며 여러 전략을 한 함수 안에서 처리해 순환 복잡도가 높다. 두 항목 모두 당장 오동작을 유발하지는 않지만 향후 수정 시 "한쪽만 고치고 반대쪽을 잊는" 또는 "긴 함수의 특정 분기만 건드리다 다른 분기를 깨는" 형태의 회귀를 유발하기 쉬운 구조다. 그 외 매직 넘버(200, 20, 8192)와 테스트 하네스 중복은 경미한 수준이다.

## 위험도

MEDIUM
