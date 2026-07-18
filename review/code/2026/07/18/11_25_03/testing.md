# 테스트(Testing) 리뷰 — internal-package-registration drift 가드 (3차 리뷰)

## 검증 수행
- `pnpm vitest run src/lib/repo-guards/__tests__/internal-package-registration.test.ts` → **35/35 pass** 확인(실제 실행 가능·green).
- `git log --oneline`으로 이 파일의 이력 확인: 원 커밋(`7a4c69959`) 이후 이미 ai-review WARNING 2라운드가 반영됨(`86de33a32`: fnBody heredoc fail-loud + 합성 fixture, `e210032c8`: discoverPackages/backendWorkflowDeps 순수 코어 분리 + fixture). 직전 리뷰(`review/code/2026/07/18/11_11_24/testing.md`)가 지적한 WARNING·INFO 4건 모두 현재 파일에서 확인상 해소됨(`collectPackages`/`workflowDepsOf` 분리+fixture, `<<-EOF` fixture, tsconfig 주석 수정).
- `codebase/packages/*` 7개 디렉터리 vs `INTERNAL_PACKAGES`/`packages-checks.yml` 실측 대조 → 현재 저장소 상태에서 전부 일치(`@workflow/web-chat` 은 전용 스텝으로 커버, backend 5-package 클로저는 devDependencies 0개로 flat).
- `explicitFilterCalls` 정규식을 실측 payload 로 직접 실행해 봄(node 스니펫) — 아래 WARNING 근거.

## 발견사항

- **[WARNING]** `explicitFilterCalls` 가 주석·문자열 리터럴 안의 `pnpm --filter X Y` 텍스트를 실제 호출과 구분하지 못해, 이 가드가 막으려는 바로 그 실패 클래스(#968 "조용한 무검증")를 파서 자신이 재현할 수 있다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` 의 `explicitFilterCalls()` (raw diff L497-503, 전체 컨텍스트 L1059-1065), 소비처 `missingFromStage()`.
  - 상세: 정규식 `/pnpm\s+--filter\s+"?([^\s"$]+)"?\s+"?([\w:-]+)"?/g` 는 라인 컨텍스트(주석 `#` 여부, 문자열 리터럴 내부 여부)를 전혀 고려하지 않는다. 실측 재현:
    ```js
    const body = '  # 예: pnpm --filter @workflow/only-in-comment lint (실제 호출 아님, 설명용 주석)\n  _ensure_deps';
    // → [{ name: '@workflow/only-in-comment', script: 'lint' }]  (주석인데 매치됨)

    const body2 = '  echo "run: pnpm --filter @workflow/echoed lint"';
    // → [{ name: '@workflow/echoed', script: 'lint' }]  (echo 문자열인데 매치됨)
    ```
    즉 `cmd_lint()` 본문에 실제 실행문 대신 설명용 주석이나 `echo` 로그 문자열이 `pnpm --filter <pkg> <script>` 형태로 등장하면, `missingFromStage` 는 그 패키지를 "커버됨"으로 오판해 **실제로는 안 도는 패키지를 조용히 통과**시킨다. `listAtPath`(YAML 파서) 쪽은 이미 인라인 `#` 주석을 `replace(/\s+#.*$/, "")` 로 제거하는데, 같은 파일 안의 SH 파서(`explicitFilterCalls`)만 이 처리가 없어 파일 내부 일관성도 어긋난다. 현재 `.claude/test-stages.sh` 의 `cmd_lint`/`cmd_unit`/`cmd_build` 본문에는 그런 주석·echo 가 없어 지금 당장 발현하지 않지만(합성 fixture 로도 이 케이스가 없어 회귀 방지력 0), 향후 누군가 디버깅용 주석/echo 를 추가하면 조용히 뚫린다.
  - 제안: 라인 단위로 `#` 이후 텍스트를 스캔 전에 제거(YAML 파서와 동일 처리)하거나, 매치 위치가 문자열 리터럴 안이 아닌지 확인. 최소한 "주석 안의 `pnpm --filter` 는 커버로 치지 않는다"를 검증하는 합성 fixture 1건을 `explicitFilterCalls` describe 에 추가해 회귀를 고정할 것.

- **[INFO]** `repoRoot()` (marker 기반 상위 디렉터리 탐색, `MAX_DEPTH=12`) 는 이 파일의 다른 순수 함수(`collectPackages`/`workflowDepsOf`/`fnBody`/`listAtPath`/`missingFromStage` 등)와 달리 합성 fixture 테스트가 없다.
  - 위치: `repoRoot()` (전체 컨텍스트 L925-938).
  - 상세: `__dirname`/실제 `fs.existsSync` 에 강결합돼 인자 주입이 안 되어 있어 다른 함수들처럼 손쉽게 격리 테스트하기 어렵다. 다만 이 함수가 깨지면 모듈 로드 시점에 즉시 `throw`(모든 테스트 error)하므로 실패 모드가 크고 시끄럽다 — 이 가드가 경계하는 "조용한 통과" 클래스는 아니라서 CRITICAL/WARNING 은 아니고 완결성 차원의 INFO.
  - 제안: 급하지 않음. 리팩터 시 `startDir`/`exists` 를 인자로 받는 순수 코어를 분리하면 이 파일의 나머지 함수들과 테스트 용이성 기준이 대칭을 이룬다.

- **[INFO]** `listAtPath`/`blockRange` 의 5-단계 중첩 경로(`jobs.packages.strategy.matrix.pkg`) 처리는 실제 `packages-checks.yml` 을 읽는 통합성 테스트로만 검증되고, 합성 fixture(`파서·비교 로직 회귀 가드`)는 2~3단계(`on.pull_request.paths`)까지만 다룬다.
  - 위치: `listAtPath`/`blockRange` (L1078-1104), 합성 fixture `describe("listAtPath + packageDirsInPaths", ...)` (L1367-1399).
  - 상세: 알고리즘 자체는 재귀적으로 동일해 깊이에 따라 별도 버그 클래스가 생길 가능성은 낮지만, `matrix.pkg` 처럼 실제로 가장 깊게 중첩된 경로에 대한 통제된 합성 회귀 케이스가 없어, 향후 `blockRange`/`findKeyLine` 리팩터가 "얕은 경로는 맞고 깊은 경로만 깨지는" 회귀를 만들 경우 합성 fixture 로는 못 잡고 실제 yml 상태(현재 우연히 정렬됨)에만 의존하게 된다.
  - 제안: 5단계 중첩 fixture 1건(`{jobs:{packages:{strategy:{matrix:{pkg:[...]}}}}}` 형태) 추가 권장.

- **[INFO]** heredoc 조기-닫힘 검출 정규식(`/(?<!<)<<-?(?!<)/`)은 본문 내 주석·설명 문자열에 `<<`/`<<-` 문자열이 등장해도 무조건 throw 한다(예: `# 이 함수는 heredoc(<<EOF)을 쓰지 않는다` 같은 설명 주석). fail-closed 설계 철학과 일치해 안전하지만, 실제 heredoc 이 아닌데 스위트가 깨지는 잡음 실패 가능성이 있다. 시급하지 않음(같은 파일이 표방하는 "조용히 틀리느니 깨지게" 원칙에 부합하는 트레이드오프).

## 요약
`internal-package-registration.test.ts` 는 이미 두 차례 ai-review WARNING(순수 함수 분리, heredoc fail-loud, 합성 fixture 고정)을 반영해 성숙도가 높고, 35/35 테스트가 실제로 green 임을 확인했다. vacuity 방지(파싱이 조용히 빈 값을 반환하지 않는지)와 mutation 스타일 합성 fixture 로 대부분의 파서·비교 로직(`internalPackages`/`fnBody`/`collectPackages`/`workflowDepsOf`/`explicitFilterCalls`/`listAtPath`/`missingFromStage`)에 true-positive/negative 회귀 방지력이 잘 갖춰져 있다. 다만 `explicitFilterCalls` 하나가 라인 컨텍스트(주석·문자열 리터럴)를 무시해 "실제로 안 도는데 커버된 것으로 오판"하는 조용한 통과 경로를 여전히 갖고 있다 — 이는 이 가드 전체가 막으려는 #968 결함 클래스가 파서 자신에게 재발한 사례라 WARNING 으로 남긴다(실측 재현 완료, 현재 저장소에선 미발현). 나머지는 완결성 차원의 INFO 로, 당장 병합을 막을 사유는 아니다.

## 위험도
LOW
