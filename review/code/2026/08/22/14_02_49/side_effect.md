# 부작용(Side Effect) 리뷰 — mirror-guard-single-copy

## 검토 방법

diff 대상 18개 파일 중 실제 코드/워크플로 변경은 8개(.claude 테스트 하네스 2 · GitHub Actions
워크플로 2 · TS 가드/spec 4)이고, 나머지는 plan 문서 2개와 이번 세션 자체가 생성한
`review/consistency/**` 산출물 6개다. 부작용 관점에서는 (a) 신규/변경된 CI 워크플로가 트리거·권한·
중복 실행 측면에서 의도치 않은 이벤트를 만드는지, (b) backend 가드 사본 삭제가 다른 곳에서 참조되는
"시그니처/인터페이스"를 깨는지, (c) 하네스 레지스트리 동기화가 실제로 전수인지를 실측했다.

- `grep -rn "masked-marker-mirror-guard\|masked-marker-mirror.spec"` → 삭제 대상 backend 파일 2개를
  가리키는 잔존 참조 0건 (frontend 사본 제외).
- `codebase/backend/src/repo-guards/__tests__/` 잔여 파일 6개 확인 → 디렉터리가 비지 않아
  `pnpm --filter backend test` 가 "no tests found" 로 죽지 않음.
- `.claude/tests/test_workflow_yaml_structure.py` 의 4개 레지스트리(`_STEP_GATES`/유사 dict,
  `_SKIP_JOB_WORKFLOWS`, `_PULL_REQUEST_KEYS`, `_PERMISSIONS`) 전수 grep → `repo-guards.yml` 이
  4곳 모두에 등재됨을 확인, 드리프트 없음.
- `codebase/frontend/src/lib/repo-guards/__tests__/{typescript-toolchain,internal-package-registration}-guard.ts`
  헤더 확인 → 두 가드 모두 "실제 게이트는 로컬 `run-test.sh`"라고 스스로 명시하며 CI 트리거 범위에
  의존하지 않음. `frontend-checks.yml` 의 `codebase/channel-web-chat/**` pathspec 제거가 이 두
  가드의 실효 커버리지를 깨지 않음을 확인.

## 발견사항

- **[INFO]** 신규 CI 워크플로 `repo-guards.yml` 이 `codebase/**` 를 건드리는 모든 PR 에서 항상 잡을
  하나 더 만든다 (mirror-guard).
  - 위치: `.github/workflows/repo-guards.yml:21-23`, `:44-86`
  - 상세: `frontend-checks.yml` 을 건드리는 PR 은 이제 미러 가드 spec
    (`masked-marker-mirror.test.ts`) 이 `frontend-checks`(vitest 전체 스위트 안)와
    `repo-guards`(전용 vitest 단일 실행) 두 워크플로에서 **중복 실행**된다. 워크플로 헤더 주석
    (`:21-23`)이 이를 명시적으로 인지하고 "로컬 `run-test.sh unit` 이 별도 배선 없이 돌게 하기
    위한 의도적 수용"이라고 밝혀 뒀으므로 결함은 아니다. 다만 새 이벤트(CI job)가 상시로 추가된다는
    점은 부작용 관점에서 기록할 가치가 있다 — 향후 이 워크플로에 스택별 가드가 더 얹히면 중복 실행
    비용이 누적될 수 있다.
  - 제안: 없음(의도적, 문서화됨). 후속 가드를 이 워크플로에 추가할 때 "저장소 전체 스캔이 필요한
    가드만" 이라는 범위 원칙(`repo-guards.yml:15-19`)을 계속 지킬 것.

- **[INFO]** `frontend-checks.yml` 의 트리거 pathspec 에서 `codebase/channel-web-chat/**` 가
  제거되어, channel-web-chat 전용 PR 에서 `frontend-checks` 의 `test-and-build` 잡이 실제로는
  no-op(안내 echo 만) 으로 통과하도록 동작이 바뀐다.
  - 위치: `.github/workflows/frontend-checks.yml:41-47` (diff, 삭제된 줄은 이 구간의 문맥에 있었음 —
    구 pathspec 목록에 `codebase/channel-web-chat/**` 1줄이 더 있었음)
  - 상세: 제거 사유(주석)는 "미러 가드가 이 잡에 얹혀 있었기 때문"이었는데 미러 가드가
    `repo-guards.yml` 로 이관되며 그 근거가 소멸했다는 설명은 diff 상 정확하다. 실측 결과 frontend
    앱은 `codebase/channel-web-chat` 를 소스에서 import 하지 않고(`package.json` 의존 없음),
    frontend 트리에 있는 다른 저장소 전역 스캔 가드(`typescript-toolchain-guard.ts`,
    `internal-package-registration-guard.ts`)도 자기 헤더에서 "실제 게이트는 CI 가 아니라 로컬
    `run-test.sh`"라고 명시하므로 CI 트리거 범위 축소로 인한 커버리지 손실은 없다. 즉 이 변경은
    안전하지만, `test-and-build`(vitest+`next build`) 잡이 web-chat 전용 PR 에서 이제 항상
    skip-report 로만 끝난다는 점은 이 diff 가 만드는 **의도된 이벤트 변경**이므로 기록한다. 이미
    같은 세션의 `review/consistency/2026/08/22/13_20_18/plan_coherence.md` (Plan Coherence
    checker, INFO #3, `plan_coherence.md` 참조)에서도 같은 지점을 지적했다.
  - 제안: 없음(실측상 안전). 다만 향후 frontend 가 channel-web-chat 소스를 직접 참조하게 되면 이
    pathspec 을 재검토해야 한다.

- **[INFO]** backend 미러 가드 사본 2파일(`masked-marker-mirror-guard.ts`,
  `masked-marker-mirror.spec.ts`) 삭제가 export 표면(`SOT_DIR`, `SOT_SYMBOLS`,
  `resolveScanDirs`, `findRedeclaredSymbols`, `findMirrorRedeclarations`)을 완전히 제거하는
  인터페이스 변경이지만, 실측 결과 이 심볼을 backend 트리 다른 곳에서 import 하는 코드가 없다
  (`grep -rn "masked-marker" codebase/backend/src` 결과 `sanitize-error-message` 관련 항목만
  남음). `codebase/backend/src/repo-guards/__tests__/` 디렉터리에는 삭제 후에도 6개 파일이
  남아 있어 `pnpm --filter backend test` 가 빈 스위트로 실패하지도 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` (전체 삭제),
    `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` (전체 삭제)
  - 상세: 위험 없음 — 파일 전체 삭제이나 죽은 코드 제거이며 외부 참조가 없다.
  - 제안: 없음.

- **[INFO]** `.claude/tests/test_workflow_yaml_structure.py` 의 4개 독립 레지스트리(스텝 조건
  dict, `_SKIP_JOB_WORKFLOWS`, `_PULL_REQUEST_KEYS`, `_PERMISSIONS`)와
  `test_required_check_skip_jobs.py` 의 `CONVERTED` 목록에 `repo-guards.yml` 이 전수
  등재됐음을 실측 확인. 하네스 자체가 `test_the_two_registries_agree` 로 두 파일 간 드리프트를
  강제하므로, 등록 누락이 있었다면 이 리뷰 이전에 이미 RED 였을 것이다.
  - 위치: `.claude/tests/test_workflow_yaml_structure.py:260`, `:294`, `:365`, `:418`;
    `.claude/tests/test_required_check_skip_jobs.py:60`
  - 상세: 부작용 없음 — 확인 목적의 기록.
  - 제안: 없음.

## 요약

이번 PR 은 CI 워크플로 신설(`repo-guards.yml`)과 그에 따른 트리거 범위 재배치(`frontend-checks.yml`
pathspec 축소), 그리고 중복돼 있던 backend 테스트 가드 2파일 삭제로 구성된다. 삭제된 backend 심볼을
가리키는 잔존 참조가 없어 시그니처/인터페이스 파손은 없고, 신설 워크플로는 하네스 레지스트리 4곳에
빠짐없이 등록되어 정합성 가드를 통과한다. 유일하게 부작용으로 기록할 만한 지점은 (1) 신규 워크플로가
모든 `codebase/**` PR 에 상시 CI 잡을 하나 더 추가하고 frontend PR 에서는 미러 가드 테스트가
2회 중복 실행된다는 점, (2) `frontend-checks.yml` 트리거 범위 축소로 channel-web-chat 전용 PR 에서
`test-and-build` 잡이 이제 no-op 으로만 도는 점이다. 둘 다 커밋 메시지·워크플로 주석·plan 문서에
근거와 함께 명시적으로 의도된 변경이며, 실측으로 안전성(다른 가드의 실효 커버리지 손실 없음)을
검증했다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도
LOW
