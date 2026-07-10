# 변경 범위(Scope) Review

대상 커밋: `c89f0ffb9` (`refactor(ci): flaky surfacing fresh 리뷰(11_30_32) Warning 2 조치`).
`git show --stat`으로 실제 커밋 경계(13개 파일, +728/-5)를 교차 검증하고, 커밋 메시지가 명시한
W1/W2/INFO 항목 목록을 기준으로 각 hunk를 대조했다.

## 발견사항

- **[NONE]** 커밋 범위가 커밋 메시지와 1:1 대응 — 스코프 일탈 없음
  - 위치: `.claude/tests/test_report_playwright_flaky.py` (+24/-5), `scripts/report_playwright_flaky.py` (+4/-2, "6 +-" stat)
  - 상세: 테스트 파일 변경은 정확히 (1) 모듈 docstring 정정(W2: `scripts/**` 글롭 → 개별 경로 등재 서술), (2) `test_flaky_table_lists_each`에 `self.assertIn("테스트 2", md)` 복원(W1), (3) `GhaEscapeTest`에 `\r` 케이스 추가, (4) `_emit_annotations` 전용 테스트(`test_emit_annotations_escapes_title`) 신설, (5) `test_unexpected_schema_does_not_crash`에 `written == ""` 단언 추가 — 5건 모두 커밋 메시지의 W1/W2/INFO 목록에 정확히 대응한다. 스크립트 변경은 정확히 (1) `typing.Iterator` → `collections.abc.Iterator` import 재배치, (2) `_emit_annotations` docstring 추가, (3) `# noqa: BLE001` → 일반 주석 — 역시 INFO 목록과 1:1 대응한다. `e2e.yml`/`harness-checks.yml`/`PROJECT.md`/`playwright.config.ts`는 이번 diff에서 전혀 건드리지 않았다(직전 커밋 `926bb1ecf`의 영역이며 이번 커밋은 그 후속 회귀만 다룬다). 기능과 무관한 리팩터링, 요청 밖 기능 추가, 무관한 파일/영역 수정, 실질 변경과 뒤섞인 순수 포맷팅, 불필요한 주석 변경, 미사용 임포트, 의도치 않은 설정 변경 — 전부 해당 없음.
  - 제안: 조치 불필요.

- **[NONE]** `review/code/2026/07/10/11_30_32/*` (11개 신규 파일) 동반 커밋은 관례에 부합
  - 위치: `review/code/2026/07/10/11_30_32/{SUMMARY,RESOLUTION,meta,_retry_state,documentation,maintainability,requirement,scope,security,side_effect,testing}.{md,json}`
  - 상세: 이 파일들은 이번 fix가 조치하는 바로 그 직전 리뷰 세션의 산출물이다. `review/`는 gitignore 대상이 아니며, 리뷰 후 SUMMARY/RESOLUTION(및 각 subagent 산출물)을 fix 커밋과 함께 커밋하는 것은 본 저장소의 표준 워크플로(developer SKILL §REVIEW WORKFLOW)다. 무관한 파일 추가가 아니다.
  - 제안: 조치 불필요.

- **[INFO]** (참고, 조치 불필요) 이 커밋은 "리뷰가 지적한 스코프 위반(WARNING)을 정확히 되돌리는" 사례
  - 위치: 커밋 메시지 W1 vs `review/code/2026/07/10/11_30_32/scope.md`의 직전 WARNING #1(`self.assertIn("테스트 2", md)` 삭제)
  - 상세: 직전 fix 커밋(`926bb1ecf`)의 scope 리뷰가 지적한 "커밋 메시지에 없는 assertion 삭제" WARNING을 이번 커밋이 정확히 그 assertion만 복원해 해소했다. 반면 같은 리뷰가 INFO로만 분류한 `_spec()` docstring 파라미터 설명 축약이나 순수 포맷팅 축약 3건은 이번 diff에서도 되돌리지 않았는데, 이는 RESOLUTION.md가 명시한 "INFO 미조치(정당)" 결정과 일치한다 — WARNING만 fix하고 INFO는 defer한 선택이 스코프 판단과 실제 diff 사이에서 정확히 재현됨.
  - 제안: 조치 불필요.

## 요약
이 커밋은 직전 fix(`926bb1ecf`)의 fresh 리뷰가 지적한 Warning 2건(W1: 다건 렌더 assertion 삭제 복원, W2: docstring의 harness-checks 트리거 서술 정정)과 명시된 INFO 항목들만 정확히 다루는 매우 좁은 후속 fix 커밋이다. 테스트 파일·스크립트 파일의 모든 hunk가 커밋 메시지 항목과 1:1 대응하며, 의도 이상의 변경·불필요한 리팩토링·요청 밖 기능·무관한 파일 수정·실질 변경과 섞인 포맷팅·불필요한 주석/임포트/설정 변경이 전혀 발견되지 않았다. 함께 커밋된 11개 review 산출물 파일은 이 fix가 조치하는 바로 그 리뷰 세션의 결과물로, 프로젝트 표준 워크플로에 부합하는 정상 동반 커밋이다.

## 위험도
NONE
