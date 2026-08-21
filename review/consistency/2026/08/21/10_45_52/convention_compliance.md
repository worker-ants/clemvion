# 정식 규약 준수 검토 — `plan/in-progress/masked-marker-shared-package.md`

## 발견사항

- **[CRITICAL] frontmatter 필수 필드(`started`/`owner`) 누락 — build guard 실측 RED**
  - target 위치: 문서 최상단 frontmatter (`title`/`status`/`worktree`/`spec_impact` 만 존재)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §4 — `plan-frontmatter.test.ts (build 차단)` 항목:
    "top-level `plan/in-progress/*.md` 의 `worktree`(sentinel `(unstarted)` 허용)/`started`(ISO)/`owner`
    **필수**". 규약 SoT 는 [`.claude/docs/plan-lifecycle.md §4`](../../../../.claude/docs/plan-lifecycle.md)
    (line 75): "세 필드(`worktree`·`started`·`owner`)는 top-level `plan/in-progress/*.md` 에서 **필수**
    — build guard `plan-frontmatter.test.ts` 가 강제한다."
  - 상세: target 문서의 frontmatter 에 `started`(ISO 날짜)와 `owner` 키가 아예 없다. 이는 규약 문구상의
    "누락 가능성" 이 아니라 **실측으로 확인된 현재 RED 상태**다 — 직접 실행 결과:
    ```
    $ pnpm vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts
    FAIL … plan/in-progress/masked-marker-shared-package.md > `started` is an ISO date
      AssertionError: expected [ 'started=null' ] to deeply equal []
    FAIL … plan/in-progress/masked-marker-shared-package.md > `owner` is set
      AssertionError: expected [ 'owner=undefined' ] to deeply equal []
    Test Files  1 failed (1) / Tests  2 failed | 155 passed
    ```
    즉 이 plan 문서가 저장소에 존재하는 한 frontend build guard 스위트가 **현재 실패 상태**다 — 다른
    시스템(build gate)이 가정하는 invariant("모든 live in-progress plan 은 3필드를 갖는다")가 이미 깨져 있다.
  - 제안: frontmatter 에 `started: <ISO 날짜>`(예: `started: 2026-08-21`)와 `owner: <역할/이름>`
    (예: `owner: developer`)을 추가한다. `worktree:` 는 이미 있으므로 두 필드만 보강하면 guard 가 통과한다.

- **[WARNING] `worktree:` 값이 스키마 예시·전 plan 선례와 형식이 다름 (경로 vs 디렉토리명)**
  - target 위치: frontmatter `worktree: .claude/worktrees/masked-marker-contract-7d2e14`
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4` 스키마 예시 —
    `worktree: <task_name>-<slug>     # 이 plan 이 살아있는 worktree 디렉토리 이름`. 값은 "디렉토리
    이름" 이지 경로가 아니다.
  - 상세: `plan/in-progress/*.md` 전수(29개 파일 확인) 중 `worktree:` 를 `.claude/worktrees/` 접두
    경로로 적은 문서는 target 이 유일하다 — 나머지는 전부 `eia-r8-cache-scope-4ae434`,
    `harness-review-ci-backstop-91f379`, `retry-atomic-claim-4d9e77` 같은 bare 디렉토리명이다.
    `.claude/hooks/_lib/plan_guard.py` 의 `_normalize_worktree_value()` 가 `.claude/worktrees/x → x`
    형태를 정규화해 흡수하므로 push-gate 연결 판정 자체는 깨지지 않지만(기능적으로는 통과), 문서
    표기가 규약 스키마·100% 선례와 어긋난다 — 다른 사람이 이 문서를 템플릿 삼으면 편차가 번진다.
  - 제안: `worktree: masked-marker-contract-7d2e14` 로 bare 디렉토리명만 남긴다.

- **[WARNING] "등록 표면" 체크리스트의 안전망 서술이 실제 가드 범위보다 넓다**
  - target 위치: `## 등록 표면 (실측 7곳 + lockfile)` 섹션 — "하나라도 빠지면
    `internal-package-registration.test.ts` 가 잡는다(그게 그 가드의 존재 이유)."
  - 위반 규약: 엄밀히는 `spec/conventions/**` 문서가 아니라 그 가드 자신의 문서화된 범위
    (`codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` 파일
    헤더 주석, "등록 목록 **3곳**": ①`.claude/test-stages.sh` `INTERNAL_PACKAGES` ②
    `packages-checks.yml` `pathspecs` ③ 같은 파일 `matrix.pkg`)와 어긋난다. 이 가드는 이 저장소에서
    "내부 공유 패키지 등록" 을 규율하는 사실상의 conventions 역할을 하므로(형식상 spec/conventions/
    밖에 있을 뿐), 이 항목을 "정식 규약 준수" 검토에 포함한다.
  - 상세: 체크리스트 8항목 중 `internal-package-registration.test.ts` 가 실제로 커버하는 것은
    ①`.claude/test-stages.sh` ②`packages-checks.yml`(pathspec+matrix) 뿐이다. 나머지는 이 가드의
    검증 대상이 **아니다**:
    - `codebase/backend/Dockerfile`, `codebase/frontend/Dockerfile` (일반, non-e2e) — 어떤 가드도
      COPY 목록을 검증하지 않는다(실측: `grep -rl Dockerfile codebase/*/src` 로 찾은 유일한 대조
      스크립트 `scripts/check-e2e-playwright-config.py` 는 `codebase/frontend/Dockerfile.playwright-e2e`
      **한 파일만** 대상이며, 그나마도 `internal-package-registration.test.ts` 가 아니라 별도
      Python 스크립트 + `.github/workflows/e2e.yml` `config-guard` job 소관이다).
    - `codebase/backend/package.json`/`codebase/frontend/package.json` 의 `workspace:` 의존 — 이
      가드는 backend `package.json` 의 `@workflow/*` 의존을 **입력(기대값 도출용 SoT)** 으로만
      읽는다. 즉 새 패키지를 이 두 `package.json` 에 추가하는 걸 "잊었을 때" 이를 탐지하는 assertion
      이 없다 — 의존이 없으면 그 패키지는 애초에 `packages-checks.yml` 기대 목록에도 안 잡히므로
      "누락 탐지" 가 아니라 "조용히 제외" 로 귀결된다.
    - `pnpm-lock.yaml` — 이 가드가 참조하는 `pnpm-lock.yaml` 관련 라인은 `packages-checks.yml`
      pathspec 파싱 fixture(`packageDirsInPaths` 가 lockfile 항목을 걸러내는 로직) 뿐이며, lockfile
      이 실제로 새 패키지의 `pnpm install` 산출을 반영했는지 여부는 검증하지 않는다.
    즉 8항목 중 실제로 자동 안전망이 걸리는 것은 2항목(①②, Dockerfile.playwright-e2e 는 다른
    가드로 커버)뿐이고 나머지 5항목(backend/frontend Dockerfile 2개, package.json 2개, lockfile
    1개)은 순수 수동 확인에 의존한다. "하나라도 빠지면 잡는다" 는 문구를 그대로 믿으면 이 5곳의
    누락은 CI/vitest 어디에서도 적발되지 않은 채 넘어간다.
  - 제안: 문구를 "①②(test-stages.sh, packages-checks.yml)는 `internal-package-registration.test.ts`
    가 자동 검증한다. Dockerfile COPY 3곳·package.json workspace 의존 2곳·lockfile 은 자동 가드가
    없으므로 PR 리뷰에서 수동 대조가 필요하다" 로 정정한다. 필요하면 이번 작업 범위에 Dockerfile/
    package.json 누락을 잡는 가드 확장을 후속 항목으로 남긴다(선택 — 최소한 서술만이라도 정정 필수).

## 요약

target plan 문서는 대부분 실측 기반 근거(§CI 경로 게이팅, §깊이 상한 불변식, §전수 grep)로
설득력 있게 구성돼 있으나, 정식 규약 준수 관점에서 두 층위의 문제가 있다. 첫째, frontmatter
필수 3필드(`worktree`/`started`/`owner`) 중 `started`·`owner` 가 누락돼 `spec/conventions/
spec-impl-evidence.md` §4 가 강제하는 build-blocking guard(`plan-frontmatter.test.ts`)가 **현재
실제로 RED** 임을 직접 실행으로 확인했다 — 즉시 수정이 필요한 CRITICAL 이다. 둘째, `worktree:`
값 표기가 스키마 예시·전 plan 선례와 다르고(경로 vs 디렉토리명, 기능은 정규화로 흡수되나 표기
불일치), 등록 표면 체크리스트의 안전망 서술("하나라도 빠지면 가드가 잡는다")이 실제 가드
(`internal-package-registration.test.ts`) 코드 범위와 어긋난다(8항목 중 2항목만 커버) — 둘 다 실행
전 정정이 바람직한 WARNING 이다.

## 위험도
HIGH
