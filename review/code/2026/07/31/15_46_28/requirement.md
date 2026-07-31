# Requirement Review — harness bundle correctness (natural sort / sentinel boundary / `_charge_notice`)

대상 커밋 3개 (origin/main...HEAD):
- `1c8f16e6f` fix: 번들 splitter 가 파일 본문의 레벨-4 헤딩을 파일 경계로 오인하던 결함 (sentinel 도입)
- `ad9701b3e` refactor: 안내문 예산 계상을 `_charge_notice` 하나로
- `0b99b3757` fix: 번들 정렬을 natural sort 로 + plan 체크박스 정리

## 발견사항

- **[WARNING]** 신규 natural-sort 회귀 테스트가 전체 하네스 스위트 실행 시 드물게 flaky — 격리 실행에서는 항상 통과하나, 전체 스위트 컨텍스트에서 1회 실패가 실측됐고 그 실패는 정확히 "고쳐지기 전" 사전순 결과를 반환했다.
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:183` (`test_ties_use_natural_order_not_lexicographic`)
  - 상세: `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` (704 tests) 를 반복 실행하며 관측:
    - 기본 설정(바이트코드 캐싱 활성) 전체 스위트 6회 중 **1회 실패**. 실패 시 단언 비교값이 `['1-auth.md', '10-graph-rag.md', '11-mcp-client.md', '4-execution-engine.md']`(사전순, 수정 전 동작)로 나왔다 — 기대값(자연순, `1 → 4 → 10 → 11`)이 아니라 **정확히 옛 버그 동작**이 재현됐다.
    - 이 파일만 격리 실행(`unittest discover -s .claude/tests -p 'test_consistency_bundle_priority.py'`) 20회 반복 → **20/20 통과**.
    - `PYTHONDONTWRITEBYTECODE=1` 로 전체 스위트 4회 반복 → **4/4 통과** (바이트코드 캐시 비활성 시 미재현).
    - 코드 자체(`_natural_key`, `prioritize_bundle_files` 의 tie-break)는 수식으로도 재검증했다 — `re.split(r"(\d+)", path)` 캡처 그룹이 짝수/홀수 인덱스에 항상 str/int 를 교대로 배치하므로 두 경로의 키를 비교할 때 타입 불일치가 구조적으로 불가능하고, `_FIVE_SYSTEM` 4개 파일 기준 정렬 결과도 손으로 재도출해 테스트 기대값과 일치함을 확인했다. 즉 **구현 로직 자체의 결함은 아니다.**
    - 이 파일을 포함해 `test_consistency_context_budget.py`/`test_line_anchors.py`/`test_prompt_omission_notice.py`/`test_router_decision_trust.py` 등 다수가 "fresh interpreter" 컨벤션(`importlib.util.spec_from_file_location` + `exec_module` 을 서브프로세스에서 실행)으로 같은 대상 스크립트를 반복 로드하는데, 이 로더는 `SourceFileLoader` 라 `__pycache__/*.pyc` 캐시 유효성 검사를 그대로 탄다 — 관측된 패턴(격리=항상 안정, 전체 스위트=드물게 "수정 전" 상태 재현, 바이트코드 비활성화 시 미재현)은 이 캐시 경로의 신뢰성 문제를 시사한다. 이 프로젝트 메모리에도 "코드는 맞는데 테스트만 실패 → stale `__pycache__`" 가 기존에 기록된 재발 클래스다.
  - 제안: 근본 원인은 이 diff 의 스코프 밖(harness 테스트 공용 프리앰블)일 가능성이 높으므로 이 PR 을 막을 사유는 아니다. 다만 커밋 메시지의 "harness 스위트 704 tests OK" 를 무조건적 안전망으로 과신하지 말 것 — 공유 "fresh interpreter" 프리앰블에 `sys.dont_write_bytecode = True` 를 추가하거나 스위트 시작 시 대상 `__pycache__` 를 정리하는 방안을 별도 후속으로 검토 권고. (본 발견은 diff 가 아니라 diff 를 검증하는 하네스의 신뢰도에 대한 것이며, 리뷰 중 실측된 사실이라 기록한다.)

- **[INFO]** `_charge_notice` 리팩터의 docstring 은 "네 budget 지점 모두를 한 곳으로 라우팅한다"고 서술하지만, 실제로는 3개 호출부만 `_charge_notice` 를 거치고 네 번째(`_aggregate_omission_note` 의 `room` 계산)는 여전히 인라인 뺄셈이다. 산술적으로는 동일해 동작 결함은 아니다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:561-578` (`_charge_notice` 정의) 및 `:790-794` (`return body + _aggregate_omission_note([...], max_total_size - len(body))`)
  - 상세: `_charge_notice(budget, *notes) = budget - sum(len(n) for n in notes)`. `_aggregate_omission_note` 호출부는 `room = max_total_size - len(body)` 를 직접 계산하는데, 이는 `_charge_notice(max_total_size, body)` 와 값이 동일하다 — `_aggregate_omission_note` 자신이 `room` 안에서 스스로 내용을 잘라 넣으므로 별도 note 텍스트를 추가로 계상할 필요가 없어 결과적으로 버그는 아니다. 다만 리팩터 docstring 이 말하는 "이 질문(무엇을 더 붙이는가)을 모든 지점에 놓는다"는 목적에서 이 한 지점만 예외로 남아, 문서화된 완결성 주장과 실제 커버리지 사이에 사소한 괴리가 있다.
  - 제안: 기능 변경은 불필요. 원한다면 스타일 일관성을 위해 `_charge_notice(max_total_size, body)` 로 통일 가능(동작 무변화).

- **[INFO]** 이번 diff 는 순수 harness 도구 코드(`.claude/skills/**`)이며 `spec/` 에는 이를 규정하는 문서가 없다 (`prioritize_bundle_files`/`_natural_key`/`_BUNDLE_FILE_SENTINEL`/`_charge_notice`/`OMITTED_FILES_HEADING`/`truncate_file_bundle` grep 결과 `spec/` 0건). 관련 SKILL.md(`consistency-checker/SKILL.md`) 는 "브랜치가 변경한 파일이 예산 앞자리를 받는다"는 상위 수준 서술만 있고 이번 natural-sort/sentinel 세부 구현과 충돌하지 않는다. dimension 9 관점에서 결함 아님, 참고용 INFO.
  - 위치: 해당 없음 (부재 확인)

## 검증한 항목 (결함 없음 확인)

- `_charge_notice` 도입 전/후 세 호출부(overflow 분기의 `global_note`, per-file 예약분, 단일 파일 `available` 계산) 모두 수식을 손으로 재도출해 **완전히 동치**임을 확인했고, `test_prompt_omission_notice.py`(7 tests, 특히 `test_notices_are_paid_for_out_of_the_same_budget`)가 격리 실행에서 전부 통과함을 재확인했다 — "순수 리팩터, 동작 무변경" 주장은 사실과 부합.
- `_BUNDLE_FILE_SENTINEL` 도입은 writer 두 곳(`format_file_bundle`, `extract_rationale_sections`)·reader 한 곳(`truncate_file_bundle`) 전부 일관되게 적용됐고, 옛 마커(`\n#### \``) 잔존 사용처는 grep 으로 0건 확인. `rel_of()` 의 백틱 분할 로직도 sentinel 삽입 후에도 올바르게 동작함을 코드 추적으로 확인.
- `_natural_key` 는 `re.split(r"(\d+)", path)` 의 캡처 그룹 교대 특성상 비교 시 str/int 타입 불일치가 구조적으로 발생할 수 없다는 docstring 의 주장을 재검증해 참으로 확인. `collect_markdown_files`/`prioritize_bundle_files` 두 tie-break 지점 모두 적용됨.
- `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 의 체크박스 갱신 내용을 실제 코드 상태와 대조 — "정리 후 진짜 열린 항목은 2건만 남는다"는 서술이 실측(`- [ ]` grep 결과 정확히 2건: scope diff 공백 확인, `spec_impact` 우선 번들링)과 일치.
- TODO/FIXME/HACK/XXX 신규 도입 없음 (diff 추가 라인 grep 0건).

## 요약

이번 diff 는 세 개의 독립적이고 목적이 명확한 수정이다 — (1) 번들 splitter 가 spec 본문의 레벨-4 헤딩(`#### \`$trigger\`` 등)을 파일 경계로 오인하던 결함을 렌더 불가능한 sentinel(`<!-- @bundle-file -->`) 로 해결, (2) 예산 계상 산술을 `_charge_notice` 하나로 통합하는 순수 리팩터, (3) 8회 재발한 번들 우선순위 결함의 잔여 표면(동일 tier 내 tie-break)을 자연 정렬로 교체. 세 가지 모두 의도한 기능을 정확히 구현하고 있음을 코드 추적·수식 재도출·테스트 실행으로 확인했고, 동반된 plan 체크박스 정리도 실제 코드 상태와 정확히 일치한다. CRITICAL 급 결함은 발견되지 않았다. 유일하게 주목할 사항은 신규 회귀 테스트가 전체 하네스 스위트 컨텍스트에서 드물게(관측 표본 기준 6회 중 1회) 옛 동작을 재현하는 flaky 증상인데, 이는 구현 로직의 결함이 아니라 다수 테스트 파일이 공유하는 서브프로세스 "fresh interpreter" 로딩 컨벤션의 바이트코드 캐시 신뢰성 문제로 보이며, diff 자체를 막을 사유는 아니되 후속 조치 대상으로 기록해 둘 가치가 있다.

## 위험도

LOW
