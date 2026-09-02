# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `.claude/tests/README.md` 의 `test_typecheck_ratchet.py` 행이, 이번 PR 자신이 겪은
  세 가지 실제 사고(회귀)를 막는 새 테스트 클래스들을 서술하지 않는다 — 이 파일의 다른 모든 행이
  따르는 "무엇이 조용히 통과할 뻔했는가" 서술 관례에서 벗어난 자리.
  - 위치: `.claude/tests/README.md:44` (`test_typecheck_ratchet.py` 행 — 직접 `Read` 로 실제 파일
    줄 번호 확인, 프롬프트 diff 게이트와 일치)
  - 상세: 이 README 는 자기 자신의 컨벤션이 매우 뚜렷하다 — 예컨대 바로 옆 행
    `test_workflow_yaml_structure.py` 는 `DetectorTest`·`KNOWN_COVERAGE_DEPENDENCIES`·
    `FailClosedSiteCountTest`·`MultipleMatchTest` 처럼 **구체적 클래스/상수 이름**을 들어
    "이것이 어떤 과거 사고를 재발 방지하는가"를 낱낱이 서술한다. `test_typecheck_ratchet.py` 행도
    같은 파일 안에서 그 패턴을 따라 fail-closed 분기·decrease 판정·continuation 줄 배제·
    `tsconfig.typecheck.json` 의 `exclude` 재선언/`incremental` 비활성화까지는 서술하지만, 정작
    이 PR 의 첫 리뷰 라운드(`review/code/2026/09/02/11_27_26/`)가 재현·확정한 세 가지 실제
    회귀와 그것을 막는 신규 테스트 클래스는 언급이 없다.
    1. **CRITICAL(requirement) 재발** — `DIAGNOSTIC` 정규식이 첫 `(` 에서 파일명 매칭을 멈춰
       Next.js route group(`src/app/(main)/…`) 아래 진단을 통째로 놓쳤다(baseline 이 실측
       52/15 대비 51/14 로 커밋됐던 사고). 이를 고정하는
       `.claude/tests/test_typecheck_ratchet.py:136-152` 의
       `test_paths_containing_parentheses_are_counted` 가 신설됐는데 README 행에는 등장하지 않는다.
    2. **WARNING(testing) 재발** — 공유 코어를 테스트가 `"typecheck_ratchet_core"` 라는 별도
       이름으로 이중 로드해, 엔트리포인트의 실제 `CONFIG`/`main` 배선이 어떤 테스트에서도
       end-to-end 로 검증되지 않았던 문제. 이를 고정하는
       `.claude/tests/test_typecheck_ratchet.py:386-418` 의 `EntrypointWiringTest`
       (`test_configs_are_instances_of_the_core_dataclass`·
       `test_committed_baseline_round_trips_through_real_main`)가 신설됐는데 역시 행에 없다.
    3. **WARNING(requirement/maintainability) 재발** — frontend `TEST_FILE_RULES` 정규식이
       tsconfig 의 실제 `exclude` 목록(`*.spec.ts(x)` 갈래)과 비대칭이었던 문제. 이를 전수
       열거로 고정하는 `.claude/tests/test_typecheck_ratchet.py:421-463` 의
       `FrontendExcludeCoverageTest`(+ 전제 테스트 `test_sample_set_matches_the_real_tsconfig`)도
       README 행에는 없다.

    셋 다 "이 PR 이 스스로 막으려던 실패 클래스가 이 PR 안에서 재발했다"는, 이 저장소가 유난히
    중요하게 취급하는 성격의 사고이고(`review/code/2026/09/02/11_27_26/RESOLUTION.md` 가 정확히
    그렇게 요약한다), README 자체가 "다음에 조사할 사람이 왜 이 클래스가 존재하는지 알게 한다"는
    목적을 명시적으로 갖고 있는 문서다. 기능상 위험은 없다(테스트는 실행되고 통과한다) — 순수하게
    이 저장소의 자기 컨벤션 대비 문서 완결성 갭이다.
  - 제안: 해당 행에 세 문장 정도를 추가: route group 경로 파싱 회귀 픽스처
    (`test_paths_containing_parentheses_are_counted`), 엔트리포인트-코어 이중 로드로 인한 무증거
    end-to-end 배선 (`EntrypointWiringTest`), frontend exclude 대칭성 전수 확인
    (`FrontendExcludeCoverageTest`)을 각각 한 줄로 요약.

## 조치 불요로 확인된 항목 (참고용)

- **[README 상호 참조 수치]** 이전 리뷰 라운드(`11_27_26`)가 지적한 두 항목이 이번 diff 에서
  실제로 정정됨을 직접 대조 확인했다:
  - "the PR" 대명사 모호성(WARNING #7, `README.md:44`) → 현재 문장은
    `"...committed 199/38 (that 2026-08-09 PR — the frontend half below landed separately on
    2026-09-02)."` 로 명시됨.
  - `jest-axe.d.ts` shadowing 진단 건수 불일치(INFO #3, "1,128 vs 1,256") →
    `codebase/frontend/src/test/vitest-matchers.d.ts:13` 이 현재 "**1,256**건" 으로 통일됐고
    `README.md:44`·`scripts/check-frontend-typecheck-ratchet.py:20`·
    `plan/in-progress/harness-review-gate-followups.md:212` 전부 1,256 로 일치.
  - `check-frontend-typecheck-ratchet.py:32` 의 재래핑 누락(INFO)도 현재는 인접 줄과 같은 폭으로
    정리돼 있음.
- **[CHANGELOG]** `CHANGELOG.md` 는 이 저장소에서 제품/백엔드 동작 변경 전용으로 쓰이며(모든
  `## Unreleased` 항목이 실행·마스킹·감사로그 등 런타임 동작), 2026-08-09 의 backend typecheck
  ratchet 신설 PR 도 CHANGELOG 항목을 남기지 않은 선례가 있다(`git log`/grep 확인). 이번 harness/CI
  전용 변경도 같은 분류이므로 CHANGELOG 갱신 불요로 판단.
- **[설정 문서]** 신규 `codebase/frontend/tsconfig.typecheck.json` 은 `"//"` 배열로 왜
  존재하는지·`exclude` 재선언 이유·`incremental` 비활성화 이유를 그 자리에서 문서화하고 있어
  별도 설정 가이드가 필요 없다. 신규 baseline JSON(`scripts/frontend-typecheck-baseline.json`)도
  같은 패턴으로 자기 서술적이다.
- **[예제 코드]** 두 엔트리포인트 스크립트 docstring 모두 `python3 scripts/check-*-typecheck-ratchet.py`
  / `--update` 사용례를 포함하고, `.claude/tools/run-test.sh` 4단계 wrapper 밖이라는 사실까지
  명시해 실행 방법에 모호함이 없다.
- **[주석 정확성 — 정본 대조]** `.github/workflows/frontend-checks.yml`/`backend-checks.yml`/
  `harness-checks.yml` 의 pathspec 등재 주석("판정 규칙이 사는 공유 코어…", "판정 규칙은
  `_typecheck_ratchet.py` 하나에 있고 두 엔트리포인트가 설정만 담는다…")을 실제 `pathspecs:`
  블록·`_typecheck_ratchet.py` import 배선과 대조 — 전부 사실과 일치하며, 이전 라운드 C2(pathspec
  미등재) 가 실제로 세 워크플로 모두에서 해소됐음을 직접 확인했다.

## 요약

핵심 변경(backend/frontend 공유 typecheck ratchet 코어, frontend 전용 게이트 신설, `jest-axe.d.ts`
shadowing 수정, CI pathspec 등재)은 문서화 밀도가 이 저장소 평균보다도 높다 — 모든 신규 파일이
"왜 필요한가"·판정 규칙·fail-closed 근거·실측 수치를 자기 서술하고, 이전 리뷰 라운드가 지적한 수치
불일치·모호한 대명사·재래핑 누락까지 이번 diff 에서 실제로 정정된 것을 직접 대조 확인했다. 유일한
갭은 `.claude/tests/README.md` 의 `test_typecheck_ratchet.py` 행이 같은 문서의 다른 행들처럼 "이
사고를 어떤 클래스가 재발 방지하는가"를 구체적으로 서술하지 않아, 이 PR 이 스스로 겪고 고친 세 개의
실제 회귀(route group 파싱, 이중 모듈 로드로 인한 무증거 배선, frontend exclude 규칙 비대칭)에 대응하는
신규 테스트 클래스가 README 에는 이름조차 등장하지 않는다는 점이다. 기능적 위험은 없고 순수하게
문서 완결성 문제라 WARNING 으로 남긴다.

## 위험도

LOW
