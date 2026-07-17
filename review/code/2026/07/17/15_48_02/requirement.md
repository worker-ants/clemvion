# Requirement Review — report-paths-shared

## 검증 방법 (요약)

- `.claude/hooks/_lib/review_guard.py`, `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
  `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 전체(diff 밖 컨텍스트 포함)를 Read.
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 실행 → **265/265 pass** (CI `harness-checks.yml`
  과 동일 커맨드). 신규 `test_report_paths_shared.py`·`test_forced_coverage_selection.py` 포함, 기존
  `test_review_guard.py`/`test_orchestrator_state.py` 등 회귀 없음 확인.
- `npx vitest run sidebar-nav-href.test.tsx sidebar.test.tsx` → **11/11 pass**. `npx eslint` 3개 신규/변경
  frontend 파일 clean. `npx tsc --noEmit` 0 errors.
- `spec/2-navigation/_layout.md` frontmatter `code:` glob 및 §2.2 본문과 sidebar 테스트 assertion 대조.
- `.claude/skills/spec-coverage`, `.claude/skills/merge-coordinator` 등 미포함 스크립트에 동일 패턴의
  잔존 복제본이 없는지 grep 으로 확인(완전성 점검).

## 발견사항

- **[WARNING]** plan 완료 문서의 `spec_impact: none` 근거 서술이 실제 diff 와 불일치
  - 위치: `plan/complete/harness-report-contract-followups.md` frontmatter 주석
    (`# .claude/** + 프론트 테스트 헬퍼 전용 — 어떤 spec 의 code: glob 에도 매칭되지 않는다.`)
  - 상세: 변경 파일 중 3개 —
    `codebase/frontend/src/components/layout/__tests__/sidebar-nav-href.test.tsx`,
    `sidebar-test-utils.tsx`, `sidebar.test.tsx` — 는 `spec/2-navigation/_layout.md` frontmatter
    `code: codebase/frontend/src/components/layout/**` 글로브에 실제로 매칭된다(grep 로 확인).
    `spec_impact: none` 이라는 최종 판단 자체는 여전히 방어 가능하다 — 이 3개 파일 변경은
    assertion·동작을 전혀 바꾸지 않는 순수 mock/setup 추출 리팩터이고, vitest 로 11/11 동일 통과를
    재확인했다. 그러나 근거로 명시한 "어떤 spec 의 code: glob 에도 매칭되지 않는다" 는 문장 자체는
    사실이 아니다. `spec-plan-completion.test.ts`(Gate C) 는 이 선언을 diff 기반으로 교차검증하지
    않는 설계(`spec/conventions/spec-impl-evidence.md` R-8 — 의도적으로 "git history 분석" 을
    피함)라 빌드는 걸리지 않지만, 이 문서를 근거자료로 신뢰하는 향후 `/spec-coverage` audit 나
    사람에게는 오도 소지가 있다. 특히 이 문서는 바로 위 §1 에서 "_lib 충돌로 공유 불가는 과장이었다
    (정정)" 이라며 스스로의 이전 과장을 바로잡는 걸 강조하는 문서라, 같은 종류의 부정확한 단정이
    같은 문서에 남아있는 점이 눈에 띈다.
  - 제안: frontmatter 주석을 "`components/layout/**` 는 `spec/2-navigation/_layout.md` 의 `code:`
    glob 에 매칭되나, 본 PR 은 assertion·동작 변경이 없는 순수 mock/setup 리팩터라 spec 갱신이
    불필요하다"는 식으로 정정. `plan/**` 은 developer 쓰기 권한 범위이므로 spec 수정 위임 없이
    코멘트 문구만 고치면 된다.

- **[WARNING]** `review_guard.py` 의 "Fail loudly" 주석이 실제 production 동작(호출부의 broad
  try/except)과 어긋남 — 의도(주석) vs 구현(호출 체인) 괴리
  - 위치: `.claude/hooks/_lib/review_guard.py` (신규 삽입) `# NOT wrapped in a try/except fallback:
    ... Fail loudly.` 주석 블록, `from _shared import report_paths as _report_paths_lib` 직전.
  - 상세: 주석은 "이 import 를 감싸지 않아야 coverage gate 가 (silent 하게) 전부 통과하는 실패모드를
    막는다" 고 주장한다. 그러나 실제 production 진입점인
    `.claude/hooks/guard_review_before_push.py`(L39-43)와 `guard_review_before_stop.py`(L53-57)는
    `from review_guard import evaluate_review` **전체**를 `try/except Exception` 으로 감싸고 있어,
    `_shared` import 실패로 인한 `review_guard` 모듈 자체의 `ImportError` 를 그대로 흡수해
    `evaluate_review = None` 으로 처리한다 — 즉 게이트는 production 에서도 결국 fail-open(모두
    허용)된다. 유일한 차이는 `traceback.print_exc(file=sys.stderr)` 로 트레이스백이 찍힌다는 점뿐이며,
    "coverage gate 가 전부 통과한다" 는 결과 자체는 이 설계로 방지되지 않는다. 이 "감싸지 않음" 이
    실질적 차이를 만드는 대상은 오직 이 import 를 자체 try/except 없이 직접 쓰는 소비자 —
    즉 `.claude/tests/test_review_guard*.py`/`test_forced_coverage_selection.py` 류의 단위테스트뿐이다
    (`from _lib import review_guard as rg` 를 감싸지 않으므로 import 실패 시 테스트가 크게 실패한다).
    기능적 회귀나 보안 구멍은 아니다 — production hook 은 모듈 최상단 docstring 이 명시한 "any
    internal error → fail-open; a guard must never wedge the session" 원칙과 여전히 일치한다.
    다만 인라인 주석의 "prevent" 표현이 실제로 보장하는 범위(테스트 레이어)보다 넓게 읽혀 향후
    유지보수자가 "이 import 가 깨지면 production 에서도 뭔가 다르게 동작한다" 고 오해할 소지가 있다.
  - 제안: 주석을 "hook 진입점(guard_review_before_push/stop.py)은 이 실패도 결국 자신의 broad
    try/except 로 fail-open 흡수한다 — 여기서 감싸지 않는 실익은 그 두 스크립트를 거치지 않는 직접
    importer(단위테스트)가 조용히 넘어가지 않고 크게 실패하게 만드는 것" 정도로 범위를 정확히 좁혀
    서술.

- **[INFO]** 두 문서의 "커밋된 리포트" 실측치 불일치 (4749 vs 4763)
  - 위치: `.claude/_shared/report_paths.py` docstring ("all 4749 committed reports are ≥254 bytes")
    vs `plan/complete/harness-report-contract-followups.md` §2 ("실측(커밋된 리포트 4763개)")
  - 상세: 같은 날짜(2026-07-17) 측정으로 보이는 두 수치가 14건 차이난다 — 측정 스코프(예:
    review/code 단독 vs review/code+consistency 합산) 또는 측정 시점 차이로 추정. 두 수치 모두
    "존재+비어있지 않음" 이라는 임계값 로직 자체에는 영향을 주지 않는 서사적 근거 수치라 기능
    결함은 아니다.
  - 제안: 필요 시 두 문서의 측정 스코프를 명시해 통일 — 낮은 우선순위, 선택 사항.

- **[INFO]** `report_path()` 의 중복 `name` 처리가 이전 구현과 미묘하게 다름(엣지 케이스)
  - 위치: `.claude/_shared/report_paths.py` `report_path()`(`next(...)` — 첫 매치 채택) vs 리팩터
    이전 `code_review_orchestrator._report_paths`/`consistency_orchestrator._report_paths`(dict
    comprehension — 마지막 항목이 덮어씀)
  - 상세: `subagent_invocations` 안에 동일 `name` 이 중복 등록되는 경우(실무적으로 거의 없음 —
    매니페스트는 항상 checker/reviewer 당 1 entry) `report_paths()`(복수형)는 이제 각 name 에 대해
    `report_path()` 를 호출해 항상 **첫** 매치의 `output_file` 을 채택한다. 실질적 영향 관측 없음
    (오케스트레이터가 중복 name invocation 을 생성하는 경로 자체가 없음) — 참고용으로만 기록.

## 요약

본 PR 은 plan(`plan/complete/harness-report-contract-followups.md`) §1·§4·§5 의 처분을 코드로 정확히
구현한다. push/stop 게이트(`review_guard.py`)와 두 오케스트레이터(`code_review_orchestrator.py`,
`consistency_orchestrator.py`)에 독립적으로 존재하던 report-path 해석 로직(세션 디렉토리 재anchor +
비어있지-않음 검증)을 `.claude/_shared/report_paths.py` 로 통합해, PR 스스로 언급한 실제 드리프트
사례(`touch security.md` 가 CLI 는 통과·gate 는 차단)를 근본적으로 닫는다 — grep 으로 harness 전역을
훑어 4번째 잔존 복제본이 없음을 확인했고, `AgreementTest` 가 실제 subprocess CLI + 실제 gate 함수를
나란히 구동해 향후 재드리프트를 회귀 테스트로 고정한다. 직접 재실행한 harness 단위테스트
265/265·frontend vitest 11/11·eslint/tsc 모두 clean 이며, 기존 `_forced_coverage_missing` 소비 테스트
전부가 리팩터 후에도 그대로 통과해 하위호환이 확인됐다. `_newest_resolved_review_mtime` 통합 테스트
7건은 mock 이 아닌 실 세션 디렉토리로 "미충족 세션은 탈락, 최신 충족 세션이 승계" 라는 grandfather-free
전면 적용의 안전 논거를 처음으로 비-mock 근거로 뒷받침한다. sidebar 테스트 헬퍼 추출(§5)은 vitest
hoisting 한계를 정확히 문서화한 채 부분 완료로 마무리됐고 실제 동작 변화가 없다. TODO/FIXME/HACK 류
미완성 표식은 전무하며 plan 체크박스도 전부 `[x]` 다. 발견된 두 WARNING 은 모두 코드 로직 자체가
아니라 **문서/주석의 정확성** 문제다 — (1) plan frontmatter 가 "spec code: glob 미매칭" 이라 단정했지만
실제로는 3개 frontend 테스트 파일이 `spec/2-navigation/_layout.md` 글로브에 매칭되고(다만 순수
리팩터라 `spec_impact: none` 결론 자체는 방어 가능), (2) `review_guard.py` 의 "fail loudly" 주석이
production 레벨에서는 결국 fail-open 으로 흡수된다는 사실(hook 스크립트의 broad try/except)을
반영하지 못해 보호 범위를 과장한다. 둘 다 기능 회귀·보안 구멍이 아니며 낮은 노력으로 정정 가능하다.

## 위험도

LOW
