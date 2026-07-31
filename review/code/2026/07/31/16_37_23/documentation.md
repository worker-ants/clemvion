STATUS=success ISSUES=2

# Documentation Review — harness 번들 정확성 (natural sort 잔여분 · `_charge_notice` 통합 · sentinel 파일경계 · 1R CRITICAL 반영)

## 검토 방법

`git diff origin/main...HEAD`로 이번 브랜치가 실제로 건드린 4개 커밋(`1c8f16e6f` sentinel splitter, `ad9701b3e` `_charge_notice` 통합, `0b99b3757` natural sort, `e7bb8fb28` 1R 리뷰 반영)의 순변경분을 확인하고, 페이로드의 "전체 파일 컨텍스트" 게이트 번호를 실제 소스 라인 번호와 대조(`grep -n`)했다. 또한 직전 리뷰 라운드(`review/code/2026/07/31/15_46_28/documentation.md`, WARNING 3건 + INFO 1건)가 남긴 항목이 이번 diff에서 실제로 해소됐는지 하나씩 재확인했다.

## 발견사항

- **[INFO]** `.claude/tests/README.md`의 두 테스트-요약 행이 이번 작업으로 새로 추가된 보장을 반영하지 않음
  - 위치: `.claude/tests/README.md:56`(`test_consistency_context_budget.py` 행), `.claude/tests/README.md:57`(`test_consistency_bundle_priority.py` 행) — 이번 diff 5개 파일에는 포함되지 않으나 파급 확인 결과
  - 상세: 이번 브랜치는 `test_consistency_context_budget.py`에 `ContentCannotForgeAFileBoundaryTest` 클래스(레벨-4 헤딩이 파일 경계로 오인되지 않음 + 문서가 sentinel 리터럴 자체를 인라인으로 써도 경계를 위조하지 못함, 총 3개 테스트 메서드)를 신설했고, `test_consistency_bundle_priority.py`의 동일-tier tie-break를 자연정렬(`_natural_key`)로 바꿨다. 그런데 `README.md:56`은 여전히 "Pins both halves of the fix: 예산 분할 + 잘린 파일 명시"까지만 나열해 sentinel/경계-위조 방지 보장을 언급하지 않고, `README.md:57`은 "`collect_markdown_files` sorted alphabetically"라고 서술해 이제 부정확하다(tie-break는 자연정렬). `:57`의 자연정렬 누락은 직전 리뷰 라운드(`review/code/2026/07/31/15_46_28/documentation.md` INFO, "이번 diff 범위 밖의 후속"으로 의도적 보류)가 이미 지적한 항목이라 재확인 성격이고, `:56`의 sentinel-위조-방지 테스트 클래스 누락은 이번에 추가로 확인한 것이다(그 라운드도 sentinel splitter 커밋을 이미 리뷰 대상에 포함했었는데 이 각도는 짚지 않았다).
  - 제안: 여유 있을 때 두 행에 한 문장씩 추가 — `:57`엔 "ties within a tier resolve by natural, not lexicographic, order", `:56`엔 "a document that writes the sentinel literal itself cannot forge a file boundary". 이 파일은 doc-sync-matrix/CI 가드 대상이 아니므로 선택 사항.

- **[INFO]** plan의 아직 열려 있는 체크리스트 항목 문구가 같은 문서에서 이미 구현 완료로 기록된 tiering/자연정렬을 반영하지 못해 부정확
  - 위치: `plan/in-progress/harness-consistency-summary-downgrade-rule.md:104-105`
  - 상세: "target 번들 조립 시 plan frontmatter 의 `spec_impact` 목록을 folder dump 보다 우선 포함... 지금은 알파벳순 폴더 dump 가 예산을 선점한다"는 문장이, 바로 아래(`:149-157`, 기완료 표시)에 기록된 `prioritize_bundle_files` 4-tier 도입 및 자연정렬 tie-break 도입 이후에도 그대로 남아 있다. 실제로는 tier 0(브랜치-변경)·tier 1(plan 본문 언급) 파일은 이미 폴더 dump 순서의 영향을 받지 않고, tier 2("나머지")도 이제 알파벳순이 아니라 자연정렬이다. 남은 진짜 갭(구조화된 `spec_impact` frontmatter를 tier 1 신호로 직접 소비 — 현재는 plan 본문 텍스트 언급 여부만 봄, `:154-155`에 그 설계 근거가 이미 명문화되어 있음)은 여전히 유효한 요청이지만, `:105` 문구 자체는 "이 문제에 대해 아직 아무 조치도 없다"는 인상을 준다 — 정확히 몇 줄 아래 자기 자신의 완료 기록과 어긋나는 표현이다.
  - 제안: "지금은 알파벳순 폴더 dump 가 예산을 선점한다"를 "tier 1(plan 본문 언급)·자연정렬은 이미 처리하지만, `spec_impact` frontmatter 는 구조화된 신호로 아직 직접 읽지 않는다"처럼 갱신.

## 점검하고 결함 없음을 확인한 항목 (참고)

- **직전 라운드(15_46_28) WARNING 3건 전부 해소 확인**: (1) plan 상단 배너 vs 체크리스트 자기모순 — 배너가 "2026-07-31 잔여분도 종결"로 정정되고 `test_ties_stay_alphabetical` 참조도 제거됨. (2) `code_review_orchestrator.py:753-755` 부근 3줄 중복 인라인 주석 — `grep -c`로 재확인 결과 현재 사본 1개만 존재. (3) `test_consistency_bundle_priority.py:7-9` 모듈 docstring의 현재시제 "returns/drops" 서술 — "used to return... (tie-break is natural sort now)"로 과거형 정정됨. 세 건 모두 커밋 `e7bb8fb28`에서 반영.
- **신규 함수 docstring**: `_charge_notice`(`code_review_orchestrator.py:561`), `_neutralize_sentinel`(`consistency_orchestrator.py:213`), `_natural_key`(`consistency_orchestrator.py:229`) 모두 근거·실측치(예: "143,620 against a 143,605 cap", "18개 중 12번째 → 4번째")를 포함한 docstring을 갖춤. 코드와 docstring의 주장(예: `_natural_key`의 "str/int 타입이 인덱스 홀짝마다 고정" 주장, `source_lines`/`total_lines`가 첫 번째 절단의 주석을 포함하지 않는다는 주장)을 구현과 직접 대조해 확인 — 불일치 없음.
- **rename 잔존 참조**: `_BUNDLE_FILE_MARKER`(구 이름) · `_notice_cost`(구 이름) · `test_ties_stay_alphabetical`(삭제된 테스트명)를 저장소 전체(`review/**` 과거 산출물 제외) grep — 0건. rename이 콜사이트·테스트 전부에 일관되게 반영됨.
- **CHANGELOG.md**: 갱신 불필요 — `CHANGELOG.md`는 `codebase/` 제품 변경 전용이며 `harness(.claude/)` 내부 도구 변경을 다룬 과거 커밋이 전무함(직전 라운드가 19건 전수 확인, 이번 라운드도 결론 동일).
- **설정 문서(env var)**: 이번 diff는 신규 `os.environ`/`getenv` 호출을 추가하지 않음. 기존 상수(`REVIEW_MAX_FILE_SIZE`/`REVIEW_MAX_PROMPT_SIZE`/`CONSISTENCY_MAX_CONTEXT_SIZE`)는 diff 밖이고 값 변경도 없음.
- **API 문서**: API 엔드포인트 변경 없음(순수 `.claude/` 하네스 스크립트).
- **테스트 개수 인용**: plan(`:157`)이 인용한 "`test_consistency_bundle_priority.py` 18건"을 `grep -c "    def test_"`로 직접 세어 확인 — 정확히 18건 일치.
- **plan이 인용한 sentinel 리터럴**: `_neutralize_sentinel` docstring이 "the plan describing this very fix quotes the literal"이라 주장하는 부분을 plan 본문(`:125`)에서 직접 확인 — `<!-- @bundle-file -->`를 인라인으로 실제로 인용하고 있어 주장이 정확함.

## 요약

이번 세션(`e7bb8fb28`)은 문서화 관점에서 직전 라운드가 남긴 WARNING 3건(배너-체크리스트 자기모순, 중복 인라인 주석, 테스트 docstring 시제 오류)을 모두 정확히 닫았고, 새로 추가된 함수(`_charge_notice`/`_neutralize_sentinel`/`_natural_key`)와 테스트 클래스는 이 코드베이스의 평소 기준에서도 예외적으로 근거·실측치가 풍부한 docstring을 갖춰 새로운 CRITICAL/WARNING급 결함은 발견되지 않았다. 남은 항목은 diff 범위 밖 파생 문서 2건(`test/README.md`의 두 요약 행, plan 체크리스트의 한 문구)이 신규 보장/기완료 항목을 아직 반영하지 못한 INFO 수준 정밀도 문제뿐이며, 그중 하나는 직전 라운드가 이미 의도적으로 "여유 있을 때" 처리로 미뤄둔 것이다.

## 위험도

LOW
