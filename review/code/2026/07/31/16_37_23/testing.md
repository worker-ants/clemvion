# Testing Review — harness bundle correctness (code_review_orchestrator.py / consistency_orchestrator.py)

## 검증 방법

정적 분석에 더해, 아래 CRITICAL/WARNING 항목은 실제로 코드를 일시적으로 되돌려(mutation) 관련
테스트 스위트를 재실행하는 방식으로 **회귀 포착 여부를 실측**했다. 사용한 백업/복원은 `cp` +
절대경로(원본 커밋 상태로 sha256 대조 확인 후 `git status` clean 확인, `git checkout` 미사용).
최종적으로 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 로 전체 스위트가
`Ran 705 tests ... OK` (커밋 메시지의 주장과 일치) 임을 재확인했다.

## 발견사항

- **[CRITICAL]** 이번 커밋이 스스로 "CRITICAL" 로 표시한 2단계 절단 버그 수정에 회귀 테스트가 전혀 없다 — mutation 으로 실측 확인
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:633-663`(`source_lines`/`total_lines` 보존), `:745-772`(`content_indices` 루프의 `else` 분기, 2차 절단)
  - 상세: `build_files_section` 은 파일을 두 번 자를 수 있다(1차: `max_file_size`, 2차: `max_total_size`). 수정 전 코드는 2차 절단 시 이미 1차 절단 주석이 붙은 `full_content` 에서 다시 줄 수를 세어 "총 줄 수"로 보고했다(커밋 메시지: 실제 1,531줄 파일이 "356/580"으로 보고됨). 이번 커밋은 `source_lines`(주석 없는 원본)/`total_lines`(진짜 총량)를 `file_parts` 에 보존해 고쳤다.
    직접 검증: (1) 사전 커밋(`e7bb8fb28~1`)의 `code_review_orchestrator.py` 를 가져와 1,531줄 파일 + filler 파일로 재현 — cap 5000→"315/580", cap 3000→"172/580" (총량이 계속 틀리게 보고됨). 같은 fixture 를 수정 후 코드로 돌리면 모든 cap 에서 "*/1531"로 정확히 보고됨. (2) 현재 저장소의 수정 코드를 정확히 사전-수정 형태로 되돌리는 mutation 을 적용하고 `test_prompt_omission_notice.py` + `test_line_anchors.py` + `test_review_changeset_warning.py` 전체(56 tests, 5 subtests)를 실행 — **전부 GREEN**. 원인: 두 파일의 `build_files_section` 호출부(`test_prompt_omission_notice.py:97,140,174,202,227`)가 전부 `max_file_size=10_000_000` 을 넘겨 1차 절단이 아예 발생하지 않는다. 즉 `full_content == source_lines` 인 상태만 테스트되고, 정작 버그가 살아있던 "이미 1차로 잘린 문자열에서 2차로 다시 재는" 경로는 이 diff 의 어떤 테스트도 밟지 않는다.
    같은 커밋 안에서 sentinel 중화(아래 참고)는 "mutation: 중화 제거 시 위조 테스트 RED 확인" 이라고 명시했지만, 이 CRITICAL 항목은 그런 확인이 없다 — 같은 커밋 안에서 회귀 방지 기준이 불균등하게 적용됐다.
  - 제안: `test_prompt_omission_notice.py` 에 `max_file_size` 를 작게(예: 8000) 주고 `max_total_size` 도 함께 작게 주어 1차+2차 절단이 모두 발동하는 fixture 를 추가하고, 최종 노트의 `total`(`.../N 줄만 표시`) 이 파일의 **진짜** 총 줄 수와 같아야 함을 단언한다. 이 테스트가 없으면 향후 리팩터가 "이미 잘린 문자열에서 다시 줄 수를 센다"는 동일 결함 클래스를 조용히 재도입해도 스위트가 GREEN 을 유지한다.

- **[WARNING]** `collect_markdown_files` 자신의 natural-sort(`_natural_key`) 적용은 어떤 테스트로도 검증되지 않는다 — mutation 으로 실측 확인
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:266` (`files.sort(key=_natural_key)`)
  - 상세: `collect_markdown_files` 의 반환값은 예외 없이(예: `collect_context` 의 `all_spec_files`/`convention_files`/`plan_files`/`scope_files`, consistency_orchestrator.py:567,578,609,618,620) 이후 `_prioritized()`→`prioritize_bundle_files()` 를 거치는데, 이 함수는 `sorted(file_paths, key=lambda p: (tier(p), _natural_key(p)))` 로 **입력 순서와 무관하게** 자체적으로 재정렬한다. 즉 `collect_markdown_files` 가 어떤 순서로 넘기든 최종 순서는 동일하다.
    직접 검증: line 266 을 `files.sort()`(키 없음, 순수 사전순)로 되돌리고 `test_consistency_bundle_priority.py` + `test_consistency_context_budget.py` + `test_consistency_target_validation.py` + `test_consistency_impl_done.py` 전체(45 tests, 29 subtests)를 실행 — **전부 GREEN**. `_natural_key` 를 직접(즉 `prioritize_bundle_files` 경유 없이) `collect_markdown_files` 출력 자체에 대해 단언하는 테스트는 존재하지 않는다(grep 결과 `_natural_key` 는 docstring 에서만 언급됨).
    현재 호출 그래프에서는 무해(dead effect)하지만, 방어적 이중화가 "의도"라면 그 의도를 지키는 직접 테스트가 없고, 만약 실수라면(즉 이 줄이 정말 아무 효과가 없다면) 이번 수정 범위에 원래 불필요했던 변경이 섞여 있다는 뜻이다.
  - 제안: `collect_markdown_files` 를 실제 임시 디렉터리에 두 자리/한 자리 파일명이 섞인 픽스처로 직접 호출해 반환 리스트 순서를 단언하는 테스트를 추가하거나, 이 줄이 정말 불필요하면 제거해 "정말 필요한 두 곳(collect_markdown_files, prioritize_bundle_files)에 각각 자체 정당성이 있는지"를 명확히 한다.

- **[WARNING]** `extract_rationale_sections` 는 `format_file_bundle` 과 동일한 sentinel 방어 로직을 쓰지만 테스트가 전혀 없다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:449-470` (`extract_rationale_sections`)
  - 상세: 이번 diff 는 `_neutralize_sentinel` + `_BUNDLE_FILE_SENTINEL` 을 `format_file_bundle` 과 `extract_rationale_sections` **두 곳 모두**에 적용했다(커밋 메시지: "writer 2곳 모두 적용"). 그런데 새로 추가된 `test_a_document_that_writes_the_sentinel_cannot_forge_a_boundary`(test_consistency_context_budget.py:163)는 `format_file_bundle` 만 호출한다. `extract_rationale_sections` 를 참조하는 테스트는 저장소 전체에 하나도 없다(grep 0건) — 이 함수는 diff 이전부터 무테스트였고, 이번에 같은 보호 로직을 추가했음에도 그 상태가 유지된다. 향후 두 호출부가 리팩터 중 divergence 를 일으켜도(예: 한쪽만 `_neutralize_sentinel` 호출을 빠뜨림) 감지되지 않는다.
  - 제안: `format_file_bundle` 테스트와 동일한 패턴(임의 rationale 섹션이 sentinel 리터럴을 본문에 포함하는 spec 파일 픽스처)으로 `extract_rationale_sections` 를 직접 호출하는 짝 테스트를 추가한다.

- **[WARNING]** `--impl-done` 의 `diff_section` 은 `_neutralize_sentinel` 을 거치지 않고 동일한 `truncate_file_bundle` 분할 대상 문서에 합쳐진다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:586-594`(`diff_section` 조립, `collect_context` 의 `--impl-done` 분기), `:373-407`(`_collect_code_diff`)
  - 상세: `target_doc = _head_basis_notice(...) + spec_bundle + diff_section` 로 조립되는데(consistency_orchestrator.py:598 부근), `spec_bundle`(`format_file_bundle` 산출)은 sentinel 이 중화되어 있지만 `diff_section`(원본 `git diff` 텍스트)은 그렇지 않다. 이 `target_doc` 전체가 이후 `budget_substitutions`→`truncate_file_bundle` 로 sentinel 기준 분할·절단 대상이 된다. 코드 diff 안에 `\n<!-- @bundle-file -->\n` 과 정확히 일치하는 한 줄(예: 이 sentinel 자체를 언급/구현하는 향후 PR 의 diff)이 우연히 존재하면, `truncate_file_bundle` 은 그 지점을 진짜 파일 경계로 오인해 diff 뒷부분을 별도 "파일"인 것처럼 다루거나 생략 목록에 엉뚱한 항목(`rel_of` 는 백틱 파싱 실패 시 `"?"` 반환)을 만들 수 있다. 이번 PR 이 닫으려던 것과 같은 결함 클래스가 세 번째 경로(diff 텍스트)에는 남아 있고, 이를 확인하는 테스트도 없다.
  - 제안: 발생 확률은 낮지만(diff 가 정확히 그 문자열을 단독 줄로 포함해야 함), `diff_section` 조립 시에도 `_neutralize_sentinel` 을 적용하거나, 최소한 이 경로가 안전함을 보이는 회귀 테스트(diff 텍스트에 sentinel 리터럴을 심어 `--impl-done` 번들이 깨지지 않음을 확인)를 추가한다.

- **[INFO]** 신규 테스트의 임시 디렉터리가 정리되지 않는다 — 저장소 관행과 불일치
  - 위치: `.claude/tests/test_consistency_context_budget.py:177` (`test_a_document_that_writes_the_sentinel_cannot_forge_a_boundary` 내부 `d = tempfile.mkdtemp()`)
  - 상세: 이 테스트는 서브프로세스 스니펫 안에서 `tempfile.mkdtemp()` 로 디렉터리를 만들고 파일을 쓰지만 정리하지 않는다. 이 저장소의 다른 15개 이상 테스트 파일(`test_bootstrap_mermaid_install.py`, `test_consistency_bundle_priority.py:258-259` 의 `_repo()` 등)은 `self.addCleanup(shutil.rmtree, path, ignore_errors=True)` 또는 `tempfile.TemporaryDirectory()` 로 정리한다. 서브프로세스 안에서 생성되므로 `self.addCleanup` 이 직접 닿지 않는 상황이라 해도, 스니펫 마지막에 `shutil.rmtree(d, ignore_errors=True)` 를 추가하는 것으로 동일한 위생을 지킬 수 있다. 영향은 작다(OS 임시 디렉터리에 파일 2개짜리 폴더가 남는 정도).
  - 제안: 스니펫 안에서 사용 후 `shutil.rmtree(d, ignore_errors=True)` 호출을 추가.

## 강점 (참고용, 감점 아님)

- `test_ties_stay_alphabetical` → `test_ties_use_natural_order_not_lexicographic` 로 교체: 기존 계약이 바뀌면서 "의도된 동작"으로 예전 버그를 고정하던 테스트를 삭제하지 않고 반대 단언으로 정확히 치환했다 — stale 테스트를 방치하는 흔한 실수를 피했다.
- `ContentCannotForgeAFileBoundaryTest` 스위트: "nothing was dropped — case is vacuous" 류의 명시적 vacuous-가드, 개별 파일 고정 대신 kept+dropped 보존 단언, 그리고 "3번째 테스트를 만들었다가 절대 실패할 수 없어서 제거했다"는 문서화까지 — 이 프로젝트가 반복해서 겪은 vacuous-test 패턴을 스스로 경계한 흔적이 뚜렷하다.
- `PriorityThenTruncationTest` 의 기존 테스트가 손으로 적은 `"\n#### \`"` 마커 대신 실제 `orch._BUNDLE_FILE_SENTINEL` 상수를 쓰도록 갱신됨 — writer 가 경계 문자열을 바꿔도 손으로 베낀 마커가 조용히 안 맞게 되는 클래스를 피했다.
- `test_consistency_context_budget.py` 의 `run_in_orchestrator` 에 `timeout=30.0` 추가 — 실측 확인상 이전에는 없었고(diff 로 확인), 형제 파일들과 동일하게 hang 이 전체 실행을 막지 않고 실패로 처리되게 한다.
- 새 raw-docstring 전환(`r"""..."""`)으로 `-W error` 하에서도 구 파일들에서 발생했던 invalid-escape-sequence 경고/에러가 사라짐을 직접 재검증(0건).

## 요약

이번 diff 자체가 새로 추가한 테스트(`_natural_key` tie-break, sentinel 위조 방지, subprocess timeout)는 목적에 정확히 부합하고 vacuous-test 회피 등 품질도 높다. 그러나 같은 커밋이 "CRITICAL"로 표시한 2단계 절단(`total_lines`/`source_lines`) 수정에는 회귀 테스트가 전혀 없으며, mutation 으로 수정을 되돌려도 관련 스위트 전체(56 tests)가 GREEN 을 유지함을 직접 확인했다 — 향후 리팩터가 같은 결함 클래스를 조용히 되살릴 수 있는 상태다. 추가로 `collect_markdown_files` 자체의 natural-sort 도 mutation 검증상 어떤 테스트에도 걸리지 않으며(45 tests GREEN 유지), `extract_rationale_sections` 의 동일 sentinel 방어 로직과 `--impl-done` diff 경로는 아예 테스트 대상 밖에 있다. 코드 자체의 동작은 실측상 올바르므로 활성 결함은 아니지만, 이 PR 의 핵심 주제(번들 정확성 회귀 방지)와 정면으로 관련된 커버리지 공백이 다수 남아 있어 후속 조치가 필요하다.

## 위험도

HIGH
