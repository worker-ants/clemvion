# 문서화(Documentation) 리뷰

## 리뷰 범위

이번 diff 는 backend/frontend 공용 타입체크 ratchet 코어(`scripts/_typecheck_ratchet.py`) 추출,
frontend 전용 게이트 신설, `jest-axe.d.ts` 의 vitest 타입 shadowing 버그 수정, 관련 CI
워크플로/harness pathspec 갱신, 그리고 **이 PR 자체의 1·2 라운드 코드 리뷰 산출물**
(`review/code/2026/09/02/11_27_26/**`, `review/code/2026/09/02/15_04_04/**`)의 커밋을 포함한다.
1·2 라운드 documentation 리뷰가 이미 지적한 항목(대명사 모호성 · 진단 건수 불일치(1,128 vs
1,256) · README 행의 회귀-클래스 미서술 · PROJECT.md 의 exclude 목록 누락)은 현재 코드에서
전부 정정돼 있음을 직접 대조 확인했다. 아래는 그 두 라운드가 catch 하지 못한, 현재 상태에
남아 있는 갭이다.

## 발견사항

- **[WARNING]** frontend "테스트 파일" exclude 목록을 서술하는 두 곳의 산문이, 이 PR 이 바로
  이번 라운드에서 코드로 고친 바로 그 누락(`*.spec.ts(x)`)을 여전히 갖고 있다 — 그 중 한 곳은
  같은 문단 안에서 자기모순까지 낸다.
  - 위치: `.claude/tests/test_typecheck_ratchet.py:9` (모듈 docstring, "이 가드가 지키는 것"
    섹션), `.claude/tests/README.md:44` (`test_typecheck_ratchet.py` 행의 첫 문장)
  - 상세: `codebase/frontend/tsconfig.json` 의 실제 `exclude` 는
    `src/test/**`·`src/**/*.test.ts(x)`·`src/**/*.spec.ts(x)`·`src/**/__tests__/**` 다섯 항목이다
    (직접 확인, `codebase/frontend/tsconfig.json:33-39`). 이 PR 은 정확히 이 목록과
    `TEST_FILE_RULES["frontend"]` 정규식이 비대칭이었던 것(`*.spec.ts(x)` 누락)을 리뷰가 지적해
    이번 라운드에 고쳤고, 그 고침을 `FrontendExcludeCoverageTest` 로 회귀 방지까지 했다
    (`.claude/tests/test_typecheck_ratchet.py:81-98` 부근, `FRONTEND_EXCLUDE_SAMPLES` 가 다섯
    항목을 전수 나열). `PROJECT.md` 와 `scripts/check-frontend-typecheck-ratchet.py` 의
    docstring 도 다섯 항목을 정확히 나열하도록 함께 고쳐졌다.

    그런데 그 코드 고침과 짝을 이뤄야 할 **산문 두 곳**은 갱신에서 빠졌다:
    1. `.claude/tests/test_typecheck_ratchet.py:9` — 이 파일 최상단 모듈 docstring("이 가드가
       지키는 것")이 "frontend — `tsconfig.json` **자신이** `src/test/**`·`*.test.ts(x)`·
       `**/__tests__/**` 를 exclude 하고" 라고 **세 항목만** 나열한다. 바로 몇 줄 아래
       `TEST_FILE_RULES["frontend"]` 정의 옆 주석(`:83-85`)은 "frontend 는 tsconfig.json 의
       exclude 목록과 **1:1** 로 맞춘다 ... (초판은 `*.spec.ts(x)` 를 빠뜨렸다 — 이 PR 이
       스스로 경고하는 '규칙이 갈린다' 의 축소판.)" 이라고 **같은 파일 안에서** 정확히 이
       누락을 지적하는데, 그 파일의 최상단 요약 문장 자체가 여전히 그 누락된 형태로 남아 있다.
    2. `.claude/tests/README.md:44` — `test_typecheck_ratchet.py` 행의 첫 문장이 "frontend:
       `tsconfig.json` **itself** excludes `src/test/**`, `*.test.ts(x)` and `**/__tests__/**`."
       라고 역시 세 항목만 나열한다. 그런데 **같은 문단의 뒷부분**이 `FrontendExcludeCoverageTest`
       를 설명하며 "the test-file predicate omitted `.spec.ts(x)`, **one of the globs
       `tsconfig.json` actually excludes**" 라고 명시한다 — 앞 문장의 "세 항목이 전부다" 라는
       서술과 뒷 문장의 "`.spec.ts(x)` 도 tsconfig 가 실제로 exclude 하는 글롭 중 하나다" 라는
       서술이 **한 문단 안에서 직접 모순**된다.

    기능적 영향은 없다 — 판정 로직(`TEST_FILE_RULES`, `FRONTEND_EXCLUDE_SAMPLES`, 실제
    tsconfig)은 전부 올바르게 다섯 항목을 반영하고 있고, 이 두 곳은 순수 설명문이다. 다만 이
    저장소가, 그리고 바로 이 PR 자신이 "같은 목적의 독립 사본이 조용히 갈리는 것" 을 반복해서
    가장 무겁게 다루는 실패 클래스라, 코드 수정과 짝을 이루는 설명문 갱신이 한 파일씩 빠지는
    것 자체가 다음 조사자에게 "무엇이 최신 사양인가" 를 혼동시킬 수 있다(README 문단은 이미
    자기모순 상태다).
  - 제안: `.claude/tests/test_typecheck_ratchet.py:9` 와 `.claude/tests/README.md:44` 의 첫
    문장에 `*.spec.ts(x)` 를 추가해 다섯 항목으로 맞춘다. 가능하면 두 곳 다 "다섯 항목 전수는
    `FRONTEND_EXCLUDE_SAMPLES`/`FrontendExcludeCoverageTest` 참조" 식으로 정본을 가리키게 해,
    향후 tsconfig 의 exclude 가 또 바뀔 때 산문이 다시 뒤처지는 것을 줄인다.

## 조치 불요로 확인된 항목 (참고용)

- **[수치 일관성]** `1,414`/`1,256`/`52·15` 실측 수치가 `codebase/frontend/src/test/vitest-matchers.d.ts:13`,
  `scripts/check-frontend-typecheck-ratchet.py`(docstring), `.claude/tests/README.md:44`,
  `plan/in-progress/harness-review-gate-followups.md` 네 곳 전부에서 일치함을 재확인했다(1R 이
  지적한 "1,128 vs 1,256" 불일치는 이미 해소됨).
- **[README 행의 회귀 클래스 서술]** 2R documentation 리뷰가 지적한 "README 행이 이 PR 자신이
  겪은 세 회귀를 서술하지 않는다"는 현재 `test_paths_containing_parentheses_are_counted` ·
  `EntrypointWiringTest` · `FrontendExcludeCoverageTest` 세 클래스명이 모두 등재돼 해소됐고,
  신규 `test_workflow_run_inputs_covered.py` 행(`.claude/tests/README.md:46`)도 자기 서술적으로
  잘 작성돼 있다.
- **[CI pathspec 등재 주석 — 정본 대조]** `frontend-checks.yml`/`backend-checks.yml`/
  `harness-checks.yml` 의 신규 pathspec 등재 주석을 실제 `pathspecs:` 블록·`_typecheck_ratchet.py`
  import 배선과 대조 — 전부 사실과 일치.
- **[CHANGELOG]** 이 저장소에서 `CHANGELOG.md` 는 제품/런타임 동작 변경 전용이고, 2026-08-09
  backend ratchet 신설 PR 도 CHANGELOG 항목이 없는 선례가 있다. 이번 harness/CI 전용 변경도
  같은 분류로 갱신 불요.
- **[설정 자기문서화]** `codebase/frontend/tsconfig.typecheck.json` 은 `"//"` 배열로 존재 이유·
  `exclude` 재선언 이유·`incremental` 비활성화 이유를 그 자리에서 문서화해 별도 가이드가
  불필요하다.

## 요약

핵심 변경은 문서화 밀도가 이 저장소 평균보다도 높고, 1·2 라운드 리뷰가 지적한 대명사 모호성 ·
진단 건수 불일치 · README 행의 회귀-클래스 미서술 · PROJECT.md 의 exclude 목록 누락은 이번 diff
에서 실제로 정정된 것을 직접 대조 확인했다. 다만 그 정정 스윕이 한 칸 좁았다 — frontend exclude
목록에 `*.spec.ts(x)` 를 추가한 코드 수정(`TEST_FILE_RULES`, `PROJECT.md`,
`check-frontend-typecheck-ratchet.py` docstring)과 짝을 이뤄야 할 두 산문(`test_typecheck_ratchet.py`
모듈 docstring, `.claude/tests/README.md` 해당 행의 첫 문장)이 갱신에서 빠져, 특히 README 쪽은
같은 문단 안에서 자기모순 상태로 남아 있다. 기능 영향은 없으나 이 PR 이 정확히 겨냥하는 "규칙
사본이 조용히 갈리는" 실패 클래스의 축소판이라 WARNING 으로 남긴다.

## 위험도

LOW
