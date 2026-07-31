# 변경 범위(Scope) Review 결과

## 검토 방법

프롬프트 페이로드에는 5개 파일 모두 "전체 파일 컨텍스트"만 실려 있고 unified diff 구간이
없어(explicit file 인자 기반 세션으로 추정), 실제 변경분을 `git diff origin/main...HEAD` 로
직접 대조했다. 브랜치는 origin/main 대비 3개 커밋(`1c8f16e6f`, `ad9701b3e`, `0b99b3757`)만큼
앞서 있고, 변경 파일은 정확히 프롬프트가 지목한 5개와 일치한다(`git diff --stat` 대조 완료).
아래 위치 인용 줄 번호는 실제 소스 파일 줄 번호이며, 프롬프트의 게이트 숫자와 grep 으로
대조해 일치를 확인했다.

## 발견사항

- **[WARNING]** 리팩토링 후 정리되지 않은 중복 주석 블록
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:739-745` (`build_files_section` 함수, per-file 전체 컨텐츠가 예산에 못 맞아 잘라내는 `else` 분기)
  - 상세: `_notice_cost` → `_notice_text` + `_charge_notice` 로 예산 계산을 통합한 리팩토링(`ad9701b3e`)에서, 기존 3줄 주석(739-742줄: "`_truncated_note`... 최댓값(kept==total) 자릿수 예약" 설명)을 지우지 않고 바로 아래(743-745줄)에 같은 내용을 살짝 다른 표현으로 재서술한 주석을 추가로 남겼다. 두 블록은 사실상 동일한 설명을 중복 서술한다. 기능 영향은 없으나, 이 파일 전반이 "왜"를 정교하게 남기는 관례를 갖고 있어 중복은 "두 규칙이 미묘하게 다른 게 있나"라는 불필요한 재해석을 유발한다 — 리팩토링 커밋 자신이 건드린 바로 그 블록에서 나온 정리 누락이라 scope 내부 청소 항목으로 지적한다.
  - 제안: 739-742줄(옛 주석) 또는 743-745줄(신규 주석) 중 하나만 남기고 나머지를 삭제.

- **[INFO]** 신규 테스트 클래스 뒤 빈 줄 1개 (파일 관례는 top-level 클래스 사이 빈 줄 2개)
  - 위치: `.claude/tests/test_consistency_context_budget.py:154` (154번째 줄이 유일한 빈 줄, 155번째 줄에서 `class FileBundleTruncationTest` 시작)
  - 상세: 신규 추가된 `ContentCannotForgeAFileBoundaryTest` 클래스의 마지막 메서드(153줄, `test_every_input_file_is_either_kept_whole_or_named`) 바로 다음에 빈 줄이 하나만 있고 바로 `class FileBundleTruncationTest` 가 이어진다. 같은 파일의 다른 top-level 클래스 경계(228-231`PerCheckerBudgetTest` 앞, 302-305 `RealAreaTargetSurvivalTest` 앞, 그리고 신규 클래스 자신의 앞쪽 98-100)는 모두 관례대로 빈 줄 2개를 쓴다. PEP8(E302) 위반이지만 저장소에 flake8/ruff 설정이 없어 CI 차단 대상은 아니다.
  - 제안: `class FileBundleTruncationTest` 앞에 빈 줄 1개를 추가해 파일 관례와 맞춘다.

## 점검했으나 문제 없음으로 판단한 항목

- **파일 선정**: 변경된 5개 파일(오케스트레이터 스크립트 2개 + 대응 테스트 2개 + 추적용 plan 문서 1개) 모두 "harness 번들 정확성" 하나의 주제로 수렴하며 무관한 파일은 없다.
- **`_charge_notice` / `_natural_key` 신설**: 둘 다 이미 두 차례(전자) 또는 8회(후자) 반복 관측된 구체적 버그 클래스를 겨냥한 최소 크기 헬퍼로, docstring 이 그 재발 이력과 실측치를 근거로 든다. over-engineering 이 아니다.
- **`_BUNDLE_FILE_MARKER` → `_BUNDLE_FILE_SENTINEL` 전면 rename**: 콜사이트 3곳(`format_file_bundle`/`extract_rationale_sections`/`truncate_file_bundle`) 및 테스트 전부 rename 을 반영했고 잔존 참조가 없음을 grep 으로 확인(`_BUNDLE_FILE_MARKER`/`_notice_cost` 매치 0건).
- **plan 문서 갱신(`harness-consistency-summary-downgrade-rule.md`)**: 이번 diff 는 `## 선택지`와 하단 체크리스트만 건드리며, 코드에서 실제로 완료된 항목(natural sort, 생략 가시화, sentinel 경계)에 정확히 대응하는 `[x]` 전환이다. 파일 상단의 종결 배너(consistency-summary.md/SKILL.md 관련 서술)는 이번 diff 대상이 아니라 이미 origin/main 에 있던 이전 커밋(`296d3a232`) 내용이라 이 리뷰의 스코프 밖이다.
- **import**: `test_consistency_context_budget.py` 에 추가된 `import re` 는 신규 테스트에서 실사용됨. 미사용 임포트 없음.
- **측정치 인용 검증**: `_charge_notice` docstring 이 인용한 "143,620 vs 143,605" 수치는 `git log -S`로 대조한 결과 이번 PR 에서 새로 지어낸 것이 아니라 이미 병합된 `296d3a232`에서 실측된 값을 재사용한 것.

## 요약

브랜치의 실제 변경분(origin/main...HEAD, 5파일)은 "harness 번들 정확성" 하나의 주제 — (1) 파일 본문의 레벨-4 헤딩을 파일 경계로 오인하던 splitter 를 sentinel 로 교체, (2) 사전순 정렬을 natural sort 로 교체, (3) 예산 계상 산술을 `_charge_notice` 하나로 통합 — 로 매우 좁고 일관되게 스코프가 잡혀 있다. 무관한 파일·기능 확장·불필요한 리팩토링·설정 변경·미사용 임포트는 발견되지 않았고, 손댄 5개 파일 모두 세 수정과 1:1로 대응한다. 발견된 두 건(중복 주석, 빈 줄 관례 위반)은 스코프 "이탈"이 아니라 스코프 "내부" 청소 누락이며 기능적 영향이 없다.

## 위험도

LOW
