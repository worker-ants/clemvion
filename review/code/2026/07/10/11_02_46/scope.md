# 변경 범위(Scope) 리뷰 결과

## 검토 방법

`prompt_file` 의 6개 파일 diff 를 점검하고, 실제 커밋 경계(`git show --stat`)로 교차 검증.
변경은 두 커밋으로 구성:
- `f8638d5e7` (`feat(ci): Playwright flaky(retry-passed) 테스트 CI surfacing`) — 5 파일
  (스크립트 신규 + 테스트 신규 + workflow 1-step 추가 + config 1-hunk + plan rename).
- `c75c8dea0` (`chore(plan): ... 완료 내용 반영`) — plan 문서 1 파일만.

두 커밋 모두 `git show --name-only` 로 실제 변경 파일 목록이 review payload 의 6개 항목과
정확히 일치함을 확인. 워크트리 루트의 미추적 `.DS_Store`/`err.tmp` 는 두 커밋 어디에도
포함되지 않음(스테이징 오염 없음).

## 발견사항

- **[INFO]** `.claude/tests/_harness.py` 의 모듈 docstring은 "harness 자체 Python(hooks·skill
  libs·config)"을 검증 대상으로 서술하는데, 신규 `test_report_playwright_flaky.py` 는
  `.claude/` 바깥의 `scripts/report_playwright_flaky.py`(리포지토리 루트 CI 스크립트)를
  대상으로 한다.
  - 위치: `.claude/tests/test_report_playwright_flaky.py:1-4` (파일 상단 docstring), 대조:
    `.claude/tests/_harness.py:1-5`
  - 상세: 실질적으로는 "product code(`codebase/`) 아닌 CI 인프라 스크립트를 stdlib
    unittest 로 게이트"한다는 점에서 harness-checks 의 취지와 부합하고, 신규 테스트 파일
    자체 docstring 에도 "harness-checks 에서 게이트한다"고 명시해 의도를 밝혔다. `_harness.py`
    상단 주석 범위와는 약간의 어긋남이 있으나 이는 기존 문서 텍스트의 사소한 정확성 이슈일
    뿐이며, 이번 diff 가 `_harness.py` 를 건드리지도 않았으므로 스코프 위반은 아니다.
  - 제안: 조치 불필요(참고용). 필요 시 별도로 `_harness.py` docstring 표현을 넓히는 것은
    이번 PR 의 관심사가 아니다.

## 요약

6개 리뷰 대상 파일은 전부 "CI 에서 retry 로 통과한 flaky 테스트를 능동적으로 노출한다"는
단일 목표(`plan/complete/e2e-retry-visibility-followup.md`)로 수렴한다. `scripts/
report_playwright_flaky.py`(신규 파서/렌더/main)·`.claude/tests/test_report_playwright_
flaky.py`(그 파서의 harness-checks 게이트)·`.github/workflows/e2e.yml`(always() 배선 1
step)·`codebase/frontend/playwright.config.ts`(json reporter 1줄 추가 + 관련 주석 갱신)는
서로 직접적으로 필요한 최소 집합이며, 각 diff hunk 가 기능과 무관한 포맷팅·주석·임포트
정리를 섞지 않았다. plan 문서 이동(`in-progress` → `complete`)은 라이프사이클 컨벤션대로
프런트매터(`spec_impact: none`)와 완료 서술만 갱신했고, 두 번째 커밋은 첫 커밋에서 `git mv`
가 rename 을 구 콘텐츠로 선-스테이징해 편집이 누락된 것을 바로 후속 커밋으로 정정한 것으로
— 결과적으로 두 커밋을 합치면 plan 문서도 "이 작업의 완료 기록" 범위 안에 있다. plan 본문에
언급된 "향후(선택) 확장"(PR 코멘트 surfacing·known-flaky quarantine)은 실제 코드로 구현되지
않고 문서상 명시적 defer 로만 남아, over-engineering 없이 스코프를 지켰다. "곁가지" 절에서
과거 PR(#873, sub-global timeout guard)을 언급하지만 이는 이미 별도 PR 로 완료된 항목을
이번 plan 문서의 완결 기록에 통합 서술한 것일 뿐 이번 diff 에 해당 코드 변경은 없다. 전반적으로
의도 이상의 변경, 무관한 파일 수정, 불필요한 리팩토링/포맷팅/주석/임포트/설정 변경이
발견되지 않는다.

## 위험도

NONE
