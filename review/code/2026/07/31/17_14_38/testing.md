STATUS=success ISSUES=3
===REPORT_MARKDOWN_BELOW===
# Testing Review — harness bundle correctness (consistency/code-review orchestrators)

## 검증 방법

프롬프트로 받은 diff/컨텍스트 외에, 실제 저장소 파일(`Read`/`grep`)과 `python3 -m unittest
discover -s .claude/tests -p 'test_*.py'` 실행으로 교차 검증했다. 전체 하니스 스위트
**708개 테스트 전부 PASS** (기존 회귀 포함). 이에 더해 아래 발견사항 1·2 는 **뮤테이션 테스트로
직접 확증**했다 — 대상 라인을 되돌린 뒤 관련 스위트를 재실행해 RED 가 뜨는지 확인하고, 확인 후
`cp` 백업으로 원복(`git diff --exit-code` 로 무변경 확인 완료, 작업 트리는 리뷰 종료 시점 clean).

## 발견사항

- **[WARNING]** `--plan` / `--impl-done` diff 섹션의 sentinel 방어(`_neutralize_sentinel`)가
  테스트로 전혀 고정되지 않음 — 뮤테이션으로 무결함 확인
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:561`
    (`--plan` 분기의 `target_doc = _neutralize_sentinel(read_text_file(target_abs))`),
    그리고 `:594` (`--impl-done` diff 섹션의
    `f"\`\`\`diff\n{_neutralize_sentinel(diff_text)}\n\`\`\`\n"`)
  - 상세: 이번 PR 의 커밋 메시지 자체가 "sentinel 방어가 4개 진입점 중 2곳만 덮던 CRITICAL
    3건" 이라고 밝히는, 바로 그 결함 클래스다. 코드는 현재 `_neutralize_sentinel` 을
    `format_file_bundle`(368행) · `extract_rationale_sections`(465행) · `--spec`(554행) ·
    `--plan`(561행) · `--impl-done` diff(594행) 5곳 모두에 적용한다. 그런데
    `test_consistency_context_budget.py` 의 신규 `ContentCannotForgeAFileBoundaryTest` 는
    `format_file_bundle` / `extract_rationale_sections` / `--spec`(`test_raw_spec_target_is_neutralised`,
    222행) 3곳만 직접 pin 한다. `--plan` 과 `--impl-done` diff 는 어떤 테스트도 건드리지 않는다.
    직접 확인(뮤테이션): 561행·594행 각각에서 `_neutralize_sentinel(...)` 호출을 제거하고
    `.claude/tests/test_consistency_*.py` 전체(54건)를 재실행한 결과 **양쪽 모두 실패 0건**
    — 즉 두 진입점 중 하나가 회귀해 실제 boundary-forging 버그가 되살아나도 현재 스위트는
    감지하지 못한다. 이 프로젝트가 이미 "동일 결함이 대칭 진입점마다 별도 표면" 이라는 교훈을
    반복 기록해 온 정확히 그 패턴이다.
  - 제안: `test_raw_spec_target_is_neutralised` 를 본떠 두 케이스를 추가한다 — (1) `class A`
    에서 `spec` 대신 `plan = f` 로 설정해 동일한 sentinel-forging 초안이 `--plan` 경로에서도
    중화되는지, (2) `--impl-done` 모드에서 `_collect_code_diff` 를 sentinel 리터럴을 포함한
    diff 문자열을 반환하도록 스텁/몽키패치해 diff 섹션도 boundary 를 위조하지 못하는지 (chunk
    수 또는 `OMITTED_FILES_HEADING` 오탐 여부로 단언).

- **[WARNING]** `collect_markdown_files` 의 `_natural_key` 정렬 키 변경이 어떤 테스트로도
  검증되지 않음 — 전체 스위트 뮤테이션으로 확인
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:266`
    (`files.sort(key=_natural_key)`, 종전 `files.sort()`)
  - 상세: 이 줄을 되돌려 원래의 순수 사전순 `.sort()` 로 만든 뒤
    `.claude/tests/test_consistency_*.py` 전체(54건)를 재실행 — **실패 0건**. 원인은
    `collect_markdown_files` 의 모든 호출부(`plan_dir` 스캔 1곳 제외 — 그건 텍스트 concat 이라
    순서 무관)가 즉시 `_prioritized`/`prioritize_bundle_files` 를 다시 거치는데, 그 함수가
    `sorted(file_paths, key=lambda p: (tier(p), _natural_key(p)))` 로 **완전히 새로 정렬**하기
    때문이다(기존 순서에 의존하는 안정 정렬 tie-break 가 아니라 전체 키 재계산). 즉 266행의
    변경은 현재 테스트에서도, 실제 런타임 경로에서도 관측 가능한 효과가 전혀 없다. 이
    natural-sort 자체는 8회 재발한 프로덕션 결함의 핵심 수정이고(`plan/in-progress/harness-
    consistency-summary-downgrade-rule.md` 참조), `prioritize_bundle_files` 쪽 tie-break 는
    `test_ties_use_natural_order_not_lexicographic`(`test_consistency_bundle_priority.py:184`)
    로 잘 pin 되어 있다 — 그런데 **같은 수정의 자매 진입점(`collect_markdown_files` 자신의
    정렬)은 대칭적으로 커버되지 않는다.**
  - 제안: (a) `collect_markdown_files` 단독에 대해 `1-x.md`/`4-x.md`/`10-x.md` 를 담은 임시
    디렉터리로 자연정렬을 직접 pin 하거나, (b) 이 줄이 정말 다운스트림 재정렬로 인해 항상
    가려지는 것이 의도(미래 호출부를 위한 방어적 대칭)라면 그 사실과 근거를 주석으로 남겨
    "왜 관측 불가능한 변경인지" 를 문서화한다. 둘 중 하나가 없으면 이 줄은 죽은 코드이거나
    커버리지 구멍 둘 중 하나로 남는다.

- **[INFO]** `_charge_notice` 신규 헬퍼의 직접 유닛 테스트 부재 (단, 간접 커버리지는 확인됨)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` —
    `_charge_notice` 함수 (562행 부근 신설)
  - 상세: 뮤테이션으로 확인한 결과 — `return budget - sum(len(n) for n in notes)` 를
    `return budget` (뺄셈 누락 뮤턴트) 로 바꾸자 `test_prompt_omission_notice.py` 8건 중
    7건이 즉시 FAIL 했다. 즉 세 호출부 모두 end-to-end 예산 준수 단언을 통해 **간접적으로는
    잘 커버**되어 있어 실질 위험은 낮다. 다만 이 헬퍼가 신설된 이유 자체가 "예산 차감을 매번
    수동으로 하다가 두 번 깜빡했다" 는 반복 실수를 원천 차단하려는 것이므로, 회귀 시 실패
    메시지가 더 직접적이도록(현재는 8개 통합 테스트가 동시에 깨지며 원인 특정에 약간의 해석이
    필요) `_charge_notice(100, "ab", "c") == 97` 류의 값싼 표 기반 단위 테스트를 하나 추가하는
    것을 권한다. 블로킹 사유는 아니다.

## 회귀 테스트 확인

`.claude/tests/test_consistency_bundle_priority.py`(18건) · `test_consistency_context_budget.py`
(21건) · `test_prompt_omission_notice.py`(8건) · `test_consistency_impl_done.py`(2건) 개별
실행 및 하니스 전체 `unittest discover`(708건) 모두 GREEN 을 직접 재현했다. 특히
`test_prompt_omission_notice.py::test_a_twice_cut_file_reports_its_real_total` 는 "1R 리뷰
CRITICAL"(2단계 절단 시 총 줄 수 오보고)을 위한 정확한 표적 픽스처이고(수동 트레이스로
`max_file=8000/max_total=5000/total=1531` 조합이 실제로 두 번의 절단을 모두 유발함을
확인), `test_ties_use_natural_order_not_lexicographic` 는 구 계약(사전순)을 고정하던
`test_ties_stay_alphabetical` 을 삭제·대체하는 형태라 legacy 계약이 새 계약과 충돌하지
않는다. Sentinel 관련 4개 신규 테스트(`ContentCannotForgeAFileBoundaryTest`)는 실제 writer
함수(`format_file_bundle`/`extract_rationale_sections`/`collect_context`)를 통해 구동되며
헬퍼(`_neutralize_sentinel`)를 직접 부르지 않는 설계 — "호출부가 사라져도 헬퍼 테스트만으론
GREEN" 이라는, 이 프로젝트가 이미 겪은 실패 패턴을 의식적으로 피한 좋은 설계다. CI 트리거 경로
(`harness-checks.yml`)도 `.claude/skills/**`·`.claude/tests/**` 를 포함해 이번 변경이 실제로
스위트를 태운다.

## 요약

기능적으로는 문제가 없다 — 전체 708건 하니스 테스트가 이번 변경 이후에도 모두 통과하고, 이
PR 이 고치는 두 개의 실제 CRITICAL(2단계 절단 총계 오보고, sentinel 방어 진입점 누락)에 대해
정밀하게 타겟팅된 회귀 테스트가 새로 추가됐으며 수동 트레이스로 그 타겟팅이 정확함을 확인했다.
다만 두 가지 커버리지 갭을 뮤테이션 테스트로 직접 확증했다: (1) `--plan`/`--impl-done` diff
섹션의 sentinel 중화 — 코드는 5개 진입점 모두를 고쳤는데 테스트는 3곳만 pin 해, 이 PR 이
스스로 "CRITICAL" 이라 명명한 것과 동일한 비대칭 패턴이 회귀 안전망에 남아 있다. (2)
`collect_markdown_files` 의 natural-key 정렬 변경은 다운스트림 재정렬 때문에 테스트에서도
런타임에서도 현재 관측 불가능하다 — 죽은 코드이거나 문서화되지 않은 방어 코드다. 두 갭 모두
"현재 동작은 맞지만 안전망에 구멍" 범주이지 실사용 결함은 아니므로 즉시 차단할 사안은 아니지만,
이 프로젝트의 이력(자연정렬 8회 재발, sentinel 방어 2/4 CRITICAL)을 볼 때 방치 시 재발
가능성이 낮지 않다.

## 위험도

MEDIUM
