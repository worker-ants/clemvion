# 요구사항(Requirement) 리뷰

## 검토 방법

이 changeset(커밋 `30943e8c8`→`e94230233`→`da3394254`, 18개 파일)은 이미 2회의 코드 리뷰
라운드(`review/code/2026/09/02/11_27_26/`, `review/code/2026/09/02/15_04_04/`)를 거쳤고 그
결과물(SUMMARY/RESOLUTION 포함)도 이번 diff 에 커밋돼 있다. 두 라운드가 찾은 Critical 2건·
Warning 5건이 **실제로 코드에 반영됐는지**를 RESOLUTION 문서의 서술을 그대로 믿지 않고 현재
소스를 직접 `Read`로 열어 재검증했고, 관련 테스트 스위트를 직접 실행해 통과를 확인했다
(`.claude/tests/test_typecheck_ratchet.py` 36 tests OK, `test_workflow_run_inputs_covered.py`
3 tests OK, `test_workflow_yaml_structure.py` 13 tests OK, `test_required_check_skip_jobs.py`
17 tests OK, harness 전체 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` →
**1121 passed**, backend ratchet 199/38 baseline 일치, frontend ratchet 52/15 baseline 일치 —
전부 로컬 재현).

## 발견사항

- **[INFO]** 1R CRITICAL("`DIAGNOSTIC` 정규식이 route group 경로의 `(`에서 끊겨 진단을 조용히
  누락")은 실제로 고쳐져 있다 — 재발 방지 회귀 테스트까지 포함해 확인.
  - 위치: `scripts/_typecheck_ratchet.py:49-51` (`DIAGNOSTIC` non-greedy + `(숫자,숫자): error TS`
    앵커), `.claude/tests/test_typecheck_ratchet.py:136-152`
    (`test_paths_containing_parentheses_are_counted`), `:154-160`
    (`test_indented_continuation_with_a_position_is_still_ignored`, 반대 방향 대조군).
  - 상세: `count_by_file()`을 직접 호출해
    `src/app/(main)/w/[slug]/integrations/[id]/__tests__/scope-tab.test.tsx(44,3): error TS2322: ...`
    가 정확히 세어지는지, 그리고 들여쓴 상세 줄이 우연히 `(1,1): error TS…` 형태를 담아도
    세어지지 않는지 양방향으로 확인했다. 커밋된 `scripts/frontend-typecheck-baseline.json`
    에도 이 route-group 경로가 `"src/app/(main)/w/[slug]/integrations/[id]/__tests__/scope-tab.test.tsx": 1`
    로 실제 포함돼 있어 baseline 자체가 수정된 정규식으로 재생성됐음을 확인했다(합 52, 파일수
    15, `total` 필드와도 일치).
  - 제안: 조치 불요(이미 반영·검증됨). 기록 목적 확인.

- **[INFO]** 1R CRITICAL("신규 게이트가 자기 자신을 트리거하지 못한다" — `frontend-checks.yml`/
  `backend-checks.yml`의 `changes.pathspecs`에 신규 스크립트/baseline/공유 코어 미등재)이
  고쳐졌을 뿐 아니라, 2R에서 **재발 방지 클래스 가드**(`test_workflow_run_inputs_covered.py`)
  까지 신설돼 인스턴스가 아니라 클래스로 닫혔다.
  - 위치: `.github/workflows/frontend-checks.yml:65-72`(`scripts/_typecheck_ratchet.py` ·
    `scripts/check-frontend-typecheck-ratchet.py` · `scripts/frontend-typecheck-baseline.json`
    3개 등재), `.github/workflows/backend-checks.yml:65-68`(`scripts/_typecheck_ratchet.py`
    등재), `.github/workflows/harness-checks.yml:109-119`(같은 5개 파일 + `tsconfig.typecheck.json`
    등재), `.claude/tests/test_workflow_run_inputs_covered.py`(신규, 135줄).
  - 상세: 신규 가드는 하드코딩 워크플로 목록이 아니라 `changes` 잡의 **존재**를 판별 기준으로
    삼아 전 워크플로를 순회하고(`_workflows_with_changes_job`), `run:` 스텝의 파일 토큰을
    추출해 그 워크플로 자신의 `pathspecs`가 덮는지 대조하며, "위반 0건이 검사가 도는 증거는
    아니다"를 전제로 합성 실패 케이스(`test_the_guard_would_catch_a_missing_entry`)까지
    포함한다. 직접 실행해 3 tests 전부 GREEN 을 확인했고, `filter_covers_file`을
    `test_harness_checks_paths_coverage.py`에서 **재사용**해(사본 아님) 두 가드의 glob 의미론이
    갈릴 위험도 없다.
  - 제안: 조치 불요(이미 반영·검증됨). 기록 목적 확인.

- **[INFO]** 2R WARNING("`run_tsc()`의 '진단이 있는 정상 실패' 분기가 어떤 테스트도 태우지
  않았다" — 뮤테이션으로 35/35 GREEN 실증)이 고쳐졌다.
  - 위치: `scripts/_typecheck_ratchet.py:112`(`if proc.returncode != 0 and not out.strip():`),
    `.claude/tests/test_typecheck_ratchet.py:270-286`
    (`test_nonzero_exit_with_diagnostics_is_the_normal_path`).
  - 상세: 현재 코드는 `returncode != 0`이어도 `out.strip()`이 비어있지 않으면(=진단이 있으면)
    `undecidable()`을 호출하지 않고 `out`을 그대로 반환한다. 신규 테스트가 `returncode=2` +
    비어있지 않은 stdout 조합을 직접 주입해 예외 없이 stdout이 그대로 반환되는지 단언한다.
    이 분기를 원래 결함(조건에서 `and not out.strip()` 제거)으로 되돌려도 이 신규 테스트가
    RED 를 내는지 정적으로 확인 가능(조건이 참이 되어 `undecidable()`이 호출되고
    `SystemExit`이 발생 → `assertEqual`이 아니라 예외로 실패).
  - 제안: 조치 불요(이미 반영·검증됨). 기록 목적 확인.

- **[INFO]** 1R WARNING("frontend `TEST_FILE_RULES`가 tsconfig의 `*.spec.ts(x)` exclude 를
  빠뜨려 tsconfig 와 비대칭")이 고쳐졌고, 2R에서 "표본 집합 자체가 실제 tsconfig 와 같은
  집합인가"를 확인하는 전제 테스트까지 추가돼 향후 tsconfig exclude 변경에도 안전하다.
  - 위치: `.claude/tests/test_typecheck_ratchet.py:81-87`(`TEST_FILE_RULES["frontend"]`에
    `\.(?:test|spec)\.tsx?$` 갈래 포함), `:91-98`(`FRONTEND_EXCLUDE_SAMPLES`),
    `:449-481`(`FrontendExcludeCoverageTest`, 3개 테스트: 전수 커버리지·표본=실제 tsconfig
    일치·프로덕션 경로 오분류 방지 대조군).
  - 상세: `codebase/frontend/tsconfig.json:33-39`의 `exclude` 6개 글롭
    (`src/test/**`·`src/**/*.test.ts(x)`·`src/**/*.spec.ts(x)`·`src/**/__tests__/**`)과
    `FRONTEND_EXCLUDE_SAMPLES`의 키 집합이 정확히 일치함을 직접 대조했고,
    `test_sample_set_matches_the_real_tsconfig`가 매 실행 시 그 일치를 재확인한다(런타임
    `test_typecheck_ratchet.py` 통과로 검증 완료).
  - 제안: 조치 불요(이미 반영·검증됨). 기록 목적 확인.

- **[INFO]** 2R testing WARNING("공유 코어가 테스트 하네스 안에서 다른 `sys.modules` 이름으로
  이중 로드돼 `mock.patch.object(CORE, …)`가 실제 실행 경로를 못 건드린다")이 고쳐졌다.
  - 위치: `.claude/tests/test_typecheck_ratchet.py:67`(`CORE = load_module(CORE_PATH,
    "_typecheck_ratchet")` — 엔트리포인트가 쓰는 것과 **같은 이름**), `:404-436`
    (`EntrypointWiringTest`, `isinstance(cfg, CORE.RatchetConfig)` 단언 + 실제 `CONFIG`를
    실제 `main`에 태우는 라운드트립 테스트).
  - 상세: 엔트리포인트(`scripts/check-backend-typecheck-ratchet.py:50`,
    `scripts/check-frontend-typecheck-ratchet.py:53`)의 `from _typecheck_ratchet import ...`가
    이제 테스트가 먼저 등록해 둔 것과 같은 `sys.modules["_typecheck_ratchet"]`을 재사용하므로
    `CONFIGS[label]`은 `CORE.RatchetConfig`의 **진짜 인스턴스**다. `EntrypointWiringTest`를
    직접 실행해 통과를 확인했다.
  - 제안: 조치 불요(이미 반영·검증됨). 기록 목적 확인.

- **[INFO]** spec fidelity — 이번 변경 영역(`.claude/`, `scripts/`, `.github/workflows/`,
  `codebase/frontend/tsconfig*.json`, `codebase/frontend/src/test/*.d.ts`)은 harness/CI 개발
  인프라 계층이며, `spec/` 아래 이를 규정하는 문서는 없다(`grep -rli "typecheck|ratchet" spec/`
  → i18n hardcoded-korean ratchet 관련 우연한 동일 단어 2건만 매치, 대상 무관 확인). 규율
  문서는 `PROJECT.md`(§게이트 표, `frontend-checks.yml` 행 신설)와 `.claude/tests/README.md`
  (`test_typecheck_ratchet.py` 행)이며, 둘 다 직접 확인 결과 실제 코드(신규 job 이름·gating
  조건·tsconfig exclude 4패턴·baseline 수치 52/15·199/38)와 line-level 로 일치한다.
  - 위치: `PROJECT.md:41`, `.claude/tests/README.md:44`.
  - 제안: 조치 불요(대상 spec 문서 부재 확인, 정합).

- **[INFO]** 1R documentation WARNING("동일 결함을 두 문서가 1,128 vs 1,256 으로 다르게
  인용")이 전수 정정됐다 — 현재 저장소 활성 파일(비-`review/` 아카이브) 어디에도 "1,128"
  잔존이 없음을 `grep -rn "1,128|1128"`로 확인했다(매치는 전부 무관한 줄 번호/PR 번호이거나
  round 1·2 review 산출물 안의 역사적 서술).
  - 위치: `codebase/frontend/src/test/vitest-matchers.d.ts:13`,
    `scripts/check-frontend-typecheck-ratchet.py:20`, `.claude/tests/README.md:44`,
    `plan/in-progress/harness-review-gate-followups.md:211-212` — 전부 "1,256"으로 통일.
  - 제안: 조치 불요(이미 반영·검증됨). 기록 목적 확인.

- **[INFO]** `plan/in-progress/harness-review-gate-followups.md`의 체크박스 처분이 실제 완료
  상태·실측치와 일치한다(원칙: 수행 후에만 체크).
  - 위치: `plan/in-progress/harness-review-gate-followups.md:205-224`.
  - 상세: 체크박스가 `[x]`로 바뀌었고, 본문이 최초 착수문의 근거 수치("26파일 → 0건")가
    실제로는 부분 측정치였고 전체 재측정이 1,414→52/15로 이어졌다는 과정을 실측과 함께
    투명하게 남겼다(원 문구는 취소선으로 보존). `git log -S`로 별도 검증하진 않았으나 diff
    안에서 원문이 삭제가 아니라 취소선 처리된 것을 직접 확인했다.
  - 제안: 조치 불요.

- **[INFO]** (기존에 이미 조치 불요로 판정된 잔여 트레이드오프 — 재확인만) `TEST_FILE_RULES`가
  프로덕션 `RatchetConfig` 밖 테스트 전용 딕셔너리에만 존재, `sys.path.insert` 중복 삽입,
  `load_baseline()`의 non-dict 최상위(`[]` 등) 분기 전용 회귀 테스트 부재. 세 항목 모두 1R·2R
  리뷰가 근거를 갖춰 조치 불요로 판정했고 이번 재확인에서도 fail-closed 방향이라 요구사항
  정확성에 영향이 없음을 코드로 재확인했다(`load_baseline`: `files = data.get("files") if
  isinstance(data, dict) else None` → non-dict 최상위도 `files=None`으로 수렴해 동일하게
  `undecidable()`).
  - 위치: `scripts/_typecheck_ratchet.py:141-147`, `.claude/tests/test_typecheck_ratchet.py:81`,
    `scripts/check-backend-typecheck-ratchet.py:48`, `scripts/check-frontend-typecheck-ratchet.py:51`.
  - 제안: 조치 불요(3라운드 연속 동일 판정, 신규 결함 아님).

- **[INFO]** TODO/FIXME/HACK/XXX 마커 없음. `git diff origin/main...HEAD` 대상 파일 전체를
  `grep -niE "TODO|FIXME|HACK|XXX"`로 스윕해 0건 확인.

## 요약

핵심 요구사항("frontend 테스트 코드가 어떤 CI 게이트에서도 타입체크되지 않는 사각을 backend
와 동일한 ratchet 방식으로 봉인")은 완전히 구현돼 있고, 이 changeset 자체가 자기 리뷰
사이클(1R→2R) 안에서 발견한 Critical 2건·Warning 5건 전부를 — RESOLUTION 문서의 서술만이
아니라 현재 소스 코드 직접 열람과 관련 테스트 스위트 **실행**(harness 1121/1121, frontend
ratchet 52/15, backend ratchet 199/38, 전부 커밋된 baseline 과 정확히 일치)으로 — 실제로
해소했음을 독립적으로 재검증했다. Route-group 경로 파싱 버그·게이트 자기미트리거·정규식
비대칭·테스트 하네스 이중 모듈 로드·미검증 정상 실패 경로라는 다섯 가지 실질 결함 모두 코드
레벨에서 고쳐졌고, 각각에 대해 재발을 막는 회귀 테스트(픽스처·반대 방향 대조군·전제 테스트)가
동반됐다. `spec/`는 이 영역(harness/CI 개발 인프라)을 규정하지 않아 spec fidelity 점검 대상
밖이며, 규율 문서(`PROJECT.md`/`.claude/tests/README.md`)는 코드와 line-level 로 일치한다.
반환값·에러 시나리오(`undecidable()` 을 통한 fail-closed exit 2, baseline 증가/감소/신규/소거
4방향 판정)도 모든 경로에서 적절하게 정의돼 있다. 새로 발견한 CRITICAL/WARNING 은 없다 — 남은
항목은 이전 두 라운드가 이미 근거를 갖춰 조치 불요로 판정한 유지보수성 트레이드오프뿐이다.

## 위험도

NONE
