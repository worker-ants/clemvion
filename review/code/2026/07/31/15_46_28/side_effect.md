# Side Effect Review — code-review/consistency-checker orchestrator 번들 정확성

## 검토 범위

`git diff origin/main...HEAD` 기준 3개 커밋(`1c8f16e6f`, `ad9701b3e`, `0b99b3757`)이 건드린 실제 코드 diff를
직접 대조해 분석했다(프롬프트에는 unified diff 없이 전체 파일 컨텍스트만 실려 있어, 어느 줄이 실제로
바뀌었는지는 `git diff`로 별도 확인).

- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` — `_charge_notice` 헬퍼 추출(예산 차감 산술 4곳 통합)
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` — `_natural_key`(natural sort) 도입 + 파일 경계 마커를 `\n#### \`` → `_BUNDLE_FILE_SENTINEL`(`"\n<!-- @bundle-file -->\n"`)로 교체
- `.claude/tests/test_consistency_bundle_priority.py`, `.claude/tests/test_consistency_context_budget.py` — 위 변경에 대응하는 테스트 갱신/추가
- `plan/in-progress/harness-consistency-summary-downgrade-rule.md` — 문서 갱신(체크박스·서술)

## 발견사항

- **[INFO]** 신규 파일 경계 sentinel 이 "본문이 위조할 수 없는 문자열"이라는 전제에 의존하는데, 그 전제가 구조적으로 보장되지 않는다 — 같은 diff 안에서 거의 재현될 뻔했다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:679`(정의) / `plan/in-progress/harness-consistency-summary-downgrade-rule.md:124`
  - 상세: `_BUNDLE_FILE_SENTINEL = "\n<!-- @bundle-file -->\n"`는 "본문이 만들 수 없는 sentinel"(코드 주석 원문)이라는 전제로 도입됐다. 그런데 이 값은 구조적으로 유일하게 만들 수 있는 게 아니라 평범한 리터럴 문자열이다. 실제로 이 PR 자신의 `plan/in-progress/harness-consistency-summary-downgrade-rule.md:124`가 이 정확한 문자열(`<!-- @bundle-file -->`)을 산문으로 인용한다. 직접 대조 결과(`sentinel in text` == False) 지금은 트리거되지 않는다 — 인라인 백틱 안에 있어 앞뒤에 개행이 오지 않으므로 `\n<!-- @bundle-file -->\n` 전체 일치가 성립하지 않는다. 하지만 이 문장을 코드블록으로 재서식하거나, 다른 spec/plan/컨벤션 문서가 harness 내부 동작을 예시로 들며 이 문자열을 독립된 줄로 적으면, 이 변경이 고치려던 "본문의 레벨-4 헤딩이 파일 경계로 오인되는" 버그 클래스가 동일한 메커니즘으로 재발한다. 이 plan 파일 자체도 `format_file_bundle`이 향후 세션에서 그대로 번들에 포함시키는 대상(`plan/in-progress/**`)이라는 점에서 이론적 사례가 아니라 실제 소비 경로 위에 있다.
  - 제안: 현재 동작을 바꿀 필요까지는 없으나(오늘은 안전), 상수 옆에 "이 리터럴 문자열을 spec/plan 문서에 개행으로 둘러싸 그대로 적지 말 것" 같은 방어 주석을 남기거나, 세션마다 달라지는 마커(예: 해시 기반)로 바꾸면 이 회귀 가능성 자체를 구조적으로 닫을 수 있다.

- **[INFO]** 파일 청크마다 삽입되는 sentinel 이 checker 프롬프트에 설명 없이 그대로 노출된다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:351`, `:447` (`format_file_bundle`, `extract_rationale_sections`)
  - 상세: 두 함수 모두 매 파일 청크 앞에 리터럴 `<!-- @bundle-file -->` 텍스트를 삽입해 5개 checker sub-agent(`cross_spec`/`rationale_continuity`/`convention_compliance`/`plan_coherence`/`naming_collision`)에게 원문 그대로 전달한다. `.claude/agents/*-checker.md` 나 `role_instructions.py` 어디에도 이 마커의 의미가 설명되어 있지 않다. HTML 주석이라 실질적 위험은 낮지만(대부분의 LLM 이 무해한 메타 표기로 취급), "harness 가 삽입한 경계 마커이니 판단 대상이 아니다"라는 안내가 없는 채 매 세션 프롬프트에 새로운 리터럴 노이즈가 추가된 것은 사실이다.
  - 제안: 필요시 checker 공통 프리앰블에 한 줄 안내를 추가.

- **검증 후 기각(참고)**: `code_review_orchestrator.py`의 `_charge_notice` 추출은 4곳의 예산 차감 산술(`overflow`, `remaining_budget`, `refund`, `available`)을 수기로 대조해 기존 공식과 대수적으로 동일함을 확인했다 — 순수 리팩터이며 동작 변화 없음. `consistency_orchestrator.py`의 `_natural_key` 전면 도입은 `re.split(r"(\d+)", ...)`이 인덱스 홀짝에 따라 항상 str/int 타입을 고정 배치하므로(도크스트링이 주장하는 대로) 서로 다른 경로를 비교해도 `TypeError`가 발생할 수 없음을 직접 추론으로 확인했다. `collect_markdown_files`의 정렬 변경(사전순→natural)은 현재 5개 호출부 전수 확인 결과 모두 이후 `prioritize_bundle_files`로 재정렬되므로 실사용 순서에 영향이 없다. `_BUNDLE_FILE_MARKER`/`format_file_bundle` 등은 `.claude/tests/**`와 자기 자신 외 외부(코드베이스·다른 스크립트) 소비자가 없음을 grep 으로 확인 — 시그니처·공개 인터페이스 파급 없음.

## 요약

이번 변경은 리뷰/일관성-체크 harness의 내부 orchestrator 두 스크립트에 대한 리팩터(예산 차감 산술 통합)와 버그 수정(자연 정렬 도입, 파일-경계 마커를 sentinel로 교체)이다. 함수 시그니처·전역 가변 상태·파일시스템 쓰기 경로·환경변수·네트워크 호출 어느 것도 변경되지 않았고, 새로 도입된 상수·헬퍼(`_charge_notice`, `_natural_key`, `_BUNDLE_FILE_SENTINEL`)는 각 스크립트 내부와 대응 테스트 외에는 소비자가 없어 외부 인터페이스 파급이 없다. 유일하게 주목할 점은 새 sentinel이 "본문이 위조할 수 없는 문자열"이라는 전제에 기대는데 그 전제가 리터럴 문자열이라 구조적으로 보장되지 않는다는 것 — 같은 PR의 plan 문서가 그 문자열을 산문으로 인용하면서 우연히 이 전제를 거의 무너뜨릴 뻔했다(직접 대조 결과 현재는 미발생). 활성 결함은 없으나 재발 방지 관점의 경미한 관찰 2건을 INFO로 남긴다.

## 위험도

LOW
