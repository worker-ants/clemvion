# 변경 범위(Scope) 리뷰

## 대상

`harness-bundle-correctness-0a4694` 브랜치, `origin/main...HEAD` 5개 커밋
(`1c8f16e6f`, `ad9701b3e`, `0b99b3757`, `e7bb8fb28`, `fdc8e423f`). 변경 파일 6개:

- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
- `.claude/tests/test_consistency_bundle_priority.py`
- `.claude/tests/test_consistency_context_budget.py`
- `.claude/tests/test_prompt_omission_notice.py`
- `plan/in-progress/harness-consistency-summary-downgrade-rule.md`

주제는 하나로 수렴한다 — consistency/code-review 두 orchestrator 가 프롬프트에
번들링하는 파일 목록의 "정확성"(정렬·경계 인식·잘림 보고). 커밋 메시지가 각 라운드에서
CRITICAL/WARNING 항목을 번호까지 매겨 명시하고, "이 줄은 이번 PR 이 직접 건드릴 대상은
아니지만 같은 결함 클래스라 함께 닫는다" 류의 스코프 판단 근거를 그때그때 적어 두고 있어,
스코프 경계를 추적하기 쉬운 편이었다.

## 발견사항

- **[INFO]** 메서드 시그니처 직후에 남은 의미 없는 빈 줄
  - 위치: `.claude/tests/test_prompt_omission_notice.py:273` (`def test_silent_when_everything_fits(self):` 바로 다음 줄, 첫 실행문 앞)
  - 상세: `fdc8e423f` 커밋에서 바로 위에 새 테스트(`test_a_twice_cut_file_reports_its_real_total`)를 삽입하면서, 기존 메서드 `test_silent_when_everything_fits` 의 시그니처와 첫 줄 사이에 빈 줄이 하나 끼어들었다. 독스트링도 없이 시그니처 바로 다음이 공백 줄이라 기능상 영향은 없지만, 실질 변경(sentinel 방어·total_lines 회귀 테스트)과 무관한 포맷팅 부스러기다.
  - 제안: 해당 빈 줄 제거.

- **[INFO]** 같은 클래스 내부 두 테스트 메서드 사이에 빈 줄 2개(관례는 1개)
  - 위치: `.claude/tests/test_consistency_context_budget.py:194-195` (`test_a_document_that_writes_the_sentinel_cannot_forge_a_boundary` 끝과 `test_rationale_sections_are_neutralised_too` 시작 사이)
  - 상세: 이 두 줄 자체는 `fdc8e423f` diff 상 context(불변) 줄이다 — 원래 `1c8f16e6f` 에서 `ContentCannotForgeAFileBoundaryTest` 클래스의 마지막 메서드와 그다음 최상위 `class FileBundleTruncationTest` 사이를 PEP8 관례대로 빈 줄 2개로 띄운 자리였다. `fdc8e423f` 가 바로 그 자리에 새 메서드 2개(`test_rationale_sections_are_neutralised_too`, `test_raw_spec_target_is_neutralised`)를 끼워 넣으면서, 원래는 "클래스 경계"였던 빈 줄 2개가 지금은 "같은 클래스 안 메서드 사이"(파일의 다른 모든 메서드 간격은 빈 줄 1개, 예: 150·162 줄)에 남아 스타일이 어긋났다. 직접 diff 라인이 손댄 건 아니라서 CRITICAL/WARNING 감은 아니고, 순수 스타일 잔여물이다.
  - 제안: 빈 줄 1개로 정리(선택).

## 스코프 판단이 필요했던 항목(위반 아님, 근거 확인됨)

- `code_review_orchestrator.py` 의 `source_lines`/`total_lines`/`_charge_notice` 변경(`ad9701b3e`, `e7bb8fb28`)은 이번 5커밋이 직접 트리거한 코드가 아니라 "같은 결함 클래스(2단계 절단이 총 줄 수를 잘못 보고)"를 다루는 자매 파일이다. 커밋 메시지가 "이 줄 자체는 이번 PR 이 건드리지 않은 기존 코드지만 이 PR 의 주제(번들 정확성)와 같은 결함 클래스"라고 스스로 명시하고 있고, 두 orchestrator 는 다수 함수에 `Mirrors ... Change both.` 주석이 이미 박혀 있어(예: `_reconcile_state_with_disk`) 나란히 고치는 관행이 이 코드베이스의 기존 계약이다. 스코프 이탈이 아니라 정당한 동반 수정으로 판단.
- `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 의 `## 선택지` 체크박스 (a)/(b)/(c) 전체를 `[x]` 로 정리한 변경은 "번들 정확성" 자체와는 결이 다른 하향-금지 규칙 결정처럼 보이지만, 상단 배너에 이미 존재하던(이번 diff 의 context 줄, 즉 이전에 이미 기록된) "사용자 결정: 하향 금지 + planner 즉시 인계" 서술을 체크리스트에 뒤늦게 동기화한 것뿐이다 — 새 결정이 아니라 stale 문서 정합화. `0b99b3757` 커밋 메시지도 "stale 체크박스 정리"를 스코프에 명시적으로 포함하고 있다. 무관한 수정으로 보지 않음.
- `code_review_orchestrator.py` 는 `consistency_orchestrator.py` 와 달리 sentinel 방어(`_BUNDLE_FILE_SENTINEL`)를 이번 변경에서 받지 않았다 — 확인 결과 전자의 `build_files_section` 은 `file_parts` 리스트를 코드로 직접 구조화해 다루고, 문자열을 마커로 재분할하는 방식이 아니라서 애초에 "본문이 마커를 위조" 하는 버그 클래스에 노출되지 않는다. 누락이 아니라 아키텍처 차이로 판단.
- 두 테스트 파일에 추가된 `import re` 는 모두 신설 테스트(`re.findall`/`re.escape`)에서 실사용 확인. 미사용 임포트 없음.

## 요약

6개 파일 모두 "orchestrator 번들 정확성"(정렬·경계 인식·잘림 보고·sentinel 방어) 단일 주제로 수렴하며, 코드 영역(스킬 스크립트+해당 테스트+추적 plan 문서) 밖으로 벗어난 파일이나 무관한 설정 변경은 없다. 리팩토링(`_charge_notice`)과 "직접 트리거되지 않은 기존 코드" 포함은 모두 커밋 메시지에서 스스로 근거를 밝히고 있어 은근슬쩍 끼워 넣은 범위 확장이 아니다. 발견된 것은 편집 도구 삽입 과정에서 남은 미세한 빈 줄 잔여물 2건뿐이며 둘 다 기능·리뷰 가능성에 영향이 없다.

## 위험도

LOW
