# Requirement Review — harness bundle correctness (2026-07-31 17_14_38)

## 발견사항

- **[INFO]** `_neutralize_sentinel`의 경계 재조합 잔여 틈 — 이전 라운드(`review/code/2026/07/31/16_37_23` INFO #12) 재확인, 이번 수정(커밋 `fdc8e423f`, 3건 CRITICAL 한정) 범위 밖이라 여전히 미해결
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:213-226`(`_neutralize_sentinel`) / `:362-370`(`format_file_bundle`, 특히 369행의 `content` 직후 고정 리터럴 `\n\`\`\`\n`) / `:704`(`_BUNDLE_FILE_SENTINEL = "\n<!-- @bundle-file -->\n"` 정의)
  - 상세: `_neutralize_sentinel`은 정확히 `"\n<!-- @bundle-file -->\n"`(앞뒤 개행 모두 포함)인 부분 문자열만 치환한다. 원본 파일이나 Rationale 섹션이 **정확히 이 sentinel 텍스트로 끝나되 말미 개행이 없는 경우**(즉 파일이 `...\n<!-- @bundle-file -->`로 끝남), neutralize 시점엔 뒤쪽 개행이 없어 매치되지 않고 그대로 통과한다. 이후 `format_file_bundle`이 `content` 바로 뒤에 고정 리터럴 `"\n```\n"`을 이어붙이므로, 최종 문자열에서는 "미치환 sentinel + 템플릿이 공급한 개행"이 합쳐져 정확히 `\n<!-- @bundle-file -->\n`가 재구성된다. `truncate_file_bundle`은 이를 진짜 파일 경계로 오인해 그 지점에서 새 청크를 만들고, `rel_of()`가 그 청크에서 파일명을 뽑지 못해(백틱 3개뿐이라 빈 문자열) 드롭될 경우 빈 파일명이 "생략된 파일" 목록에 등재될 수 있다. 트리거 조건이 좁아(파일이 정확히 sentinel로 끝나고 후행 개행이 없어야 함) 실제 발생 가능성은 낮으며, 직전 라운드에서도 동일 근거로 INFO 처리됐다.
  - 제안: neutralize를 템플릿 조립 **후** 결과 전체에 대해 한 번 더 수행하거나, 입력의 trailing newline을 정규화한 뒤 매칭. (spec 없음 — harness 내부 유틸 코드 fix 대상, 우선순위 낮음)

- **[INFO]** `budget_substitutions`의 corpus 몫이 정수 나눗셈으로 0이 될 수 있음 — 이전 라운드(16_37_23 INFO #11) 재확인, 이번 라운드에서도 미해결
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:795-798`(`budget_substitutions` 내부 `share = int(max_context_size * CHECKER_BUDGET_RATIO["corpus"] / len(keys))`)
  - 상세: `max_context_size`가 아주 작으면(`naming_collision`처럼 `len(keys)==3`인 checker는 `max_context_size` 한 자리 수 대에서) `share`가 정확히 `0`으로 내림된다. `truncate_file_bundle(text, 0)`이 호출되는데, `truncate_file_bundle`과 그것이 위임하는 `session.truncate_to_budget` 둘 다 `budget<=0`을 "무제한"으로 해석한다(`:724-733`). 결과적으로 예산을 줄이려는 호출자의 의도와 반대로 해당 corpus가 무제한 통과한다. `CONSISTENCY_MAX_CONTEXT_SIZE` 기본값(262144)에서는 도달 불가능한 영역이라 실사용 위험은 낮다.
  - 제안: 계산된 `share`가 0이면 최소 양의 하한(예: 1)으로 clip.

- **[INFO]** Spec fidelity — 이 영역을 규정하는 `spec/` 문서 없음(정상 — harness 내부 도구)
  - 위치: 해당 없음 (`grep -rl` 로 `spec/` 전체에서 이번 6개 파일이 다루는 함수/상수명 매치 0건 확인)
  - 상세: 변경 전부가 `.claude/skills/**`(orchestrator)·`.claude/tests/**`·`plan/in-progress/**`이며 제품 기능이 아니라 리뷰/일관성 harness 내부 도구다. CLAUDE.md 규약상 `spec/`은 제품 단일 진실이고 이 영역은 대상이 아니다. 이 작업의 사실상 SoT는 `plan/in-progress/harness-consistency-summary-downgrade-rule.md`이며, 그 문서의 체크리스트(자연정렬·생략 관측·sentinel 경계 이전)와 실제 구현을 대조한 결과 전부 일치했고, 참조된 타 파일(`.claude/agents/consistency-summary.md`의 "3. 하향 금지"/"4. planner 즉시 인계", `.claude/skills/consistency-checker/SKILL.md §4`)도 실재함을 확인했다 — 허위/과장 완료 서술 없음.
  - 제안: 조치 불필요.

## 요약

이번 라운드(커밋 `fdc8e423f`)는 직전 리뷰(`review/code/2026/07/31/16_37_23`)가 지적한 3건의 CRITICAL을 모두 line-level로 정확히 수정했다. (1) `consistency_orchestrator.py`의 `--spec`/`--plan` 분기(:554, :561)가 이제 `_neutralize_sentinel()`을 거치고, (2) `--impl-done`의 diff_section이 자신만의 `_BUNDLE_FILE_SENTINEL` 청크 + 고유 pseudo-path(`_DIFF_LABEL`, :590-599)로 분리되어 neutralize까지 적용되며(더 이상 마지막 spec 파일 청크에 이름 없이 얹혀 통째로 드롭되지 않음), (3) `code_review_orchestrator.py`의 `build_files_section`은 첫 번째 절단(`max_file_size`) 이전의 원본 `numbered`/`total_lines`를 별도 필드로 보존해(:633-634, :662-663) 두 번째 절단이 항상 파일의 참 총 줄 수를 보고하도록 고쳤다(:756-769) — 이를 정확히 겨냥한 회귀 테스트(`test_a_twice_cut_file_reports_its_real_total`, 1531줄 fixture로 1·2차 절단을 모두 강제)가 신설되어 통과함을 직접 확인했다. `extract_rationale_sections`에도 동일 sentinel 방어가 확장되고 짝 테스트가 추가되어 직전 라운드 WARNING #6도 해소됐다. 관련 테스트 3종(`test_consistency_bundle_priority.py` 18건, `test_consistency_context_budget.py`, `test_prompt_omission_notice.py`)과 하네스 전체 스위트(708 tests + 567 subtests)를 직접 실행해 전부 GREEN임을 확인했다. plan 문서의 체크리스트·상단 배너 서술도 실제 코드 및 참조 파일 상태와 대조해 전부 사실과 일치했다(허위 완료 표시 없음). 다만 이전 라운드가 이미 INFO로 분류했던 2건 — `_neutralize_sentinel`의 "sentinel로 끝나고 후행 개행이 없는 파일" 경계 재조합 틈, `budget_substitutions`의 정수 나눗셈 0-몫 시 무제한 통과 — 은 이번 수정 범위(3건 CRITICAL 한정) 밖이라 그대로 남아 있다. 둘 다 트리거 조건이 좁고 기본 설정에서는 도달 불가능해 실질 영향은 낮다. 이 harness 내부 로직을 규정하는 `spec/` 문서는 없으며(제품 spec 대상 아님), plan 문서가 사실상의 SoT 역할을 하고 실제 구현과 일치함을 확인했다.

## 위험도
LOW
