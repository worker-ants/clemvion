# 요구사항(Requirement) 리뷰 — 내부 패키지 등록 목록 4곳 drift 가드 (#968 후속)

## 검증 방법
- 실제 저장소에서 `pnpm vitest run src/lib/repo-guards/__tests__/internal-package-registration.test.ts` 실행 → **40/40 통과** 확인(vacuity 방지 · 실측 대조 · 합성 fixture 회귀 전부 포함).
- `codebase/packages/*` 7개 디렉터리(ai-end-reason, chat-channel-validation, expression-engine, graph-warning-rules, node-summary, sdk, web-chat-sdk→`@workflow/web-chat`) 실측과 `INTERNAL_PACKAGES`(6개) + `cmd_*` 의 `@workflow/web-chat` 전용 스텝을 대조 → 7개 전부 커버됨을 확인.
- `codebase/backend/package.json` 의 `@workflow/*` 의존 5개(ai-end-reason·chat-channel-validation·expression-engine·graph-warning-rules·node-summary) 와 `packages-checks.yml` 의 `pull_request.paths`/`push.paths`/`matrix.pkg` 5개 항목이 일치함을 확인.
- `explicitFilterCalls`/`missingFromStage`/`listAtPath`/`fnBody` 의 정규식·블록 추출 로직을 node 로 직접 시뮬레이션해 경계 조건(heredoc, here-string, 형제 YAML 키, 5단 중첩 경로, 조기 열림/닫힘) 을 개별 검증.

## 발견사항

- **[WARNING]** `explicitFilterCalls` 의 명령 분절 로직이 quote-불인식이라, 주석/로그 문자열 안에 `;` 가 포함된 `pnpm --filter` 텍스트를 실제 호출로 오인식할 수 있다(이 가드 자신이 막으려는 #968급 "조용한 무검증 통과"를 재현하는 사각지대).
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:170-180` (`explicitFilterCalls`, 특히 `line.split(/&&|\|\||[;|]/)` 분절 후 `^\s*pnpm\s+--filter…` 매치)
  - 상세: 모듈 헤더 주석은 "명령 위치의 pnpm 만 실제 실행으로 친다" 며 라인 주석(`# pnpm --filter …`)과 `&&` 로 분절된 echo 로그(`echo "… pnpm --filter …"`) 를 오탐 없이 배제하도록 설계·테스트했다(`internal-package-registration.test.ts` 의 "라인 주석 안의 pnpm --filter"·"echo 로그 문자열 안의 pnpm --filter" 케이스). 그러나 실제 시뮬레이션 결과, 인용부호 **안**에 `;` 가 들어간 문자열은 뚫린다:
    ```
    explicitFilterCalls('echo "abc; pnpm --filter @workflow/ghost lint"')
    // => [ { name: '@workflow/ghost', script: 'lint' } ]   ← 오탐(실제로는 echo 문자열의 일부일 뿐)
    ```
    분절기가 문자열 리터럴을 인식하지 못한 채 `;`/`|` 를 그대로 명령 구분자로 취급하기 때문이다. 현재 `.claude/test-stages.sh` 실제 파일에는 이 패턴(echo/주석 문자열 안에 `;` + `pnpm --filter` 조합)이 없어 **현재는 실동작 버그가 아니다**. 다만 이 파서가 스스로 표방하는 방어 기준("주석·로그 문자열 안의 pnpm --filter 는 실제 커버로 오인하지 않는다")을 완전히 충족하지 못하는 미검증 경계이며, 향후 진단 메시지·echo 문구에 세미콜론이 섞인 pnpm --filter 텍스트가 들어오면(예: 에러 메시지에 "…하려면 `pnpm --filter x lint`; 참고: …" 식 문구) 그 패키지가 실제로는 어떤 스테이지에서도 실행되지 않는데 가드가 "커버됨"으로 오판해 조용히 통과시킬 수 있다 — 정확히 이 가드가 막으려는 실패 모드.
  - 제안: 분절 전에 따옴표(홑/겹) 내부의 `;`/`|`/`&&`/`||` 를 마스킹하거나, quote-depth 를 추적하는 간단한 토크나이저로 교체. 또는 최소한 회귀 테스트에 "따옴표 안의 세미콜론을 포함한 echo 문자열" 케이스를 추가해 이 사각지대를 명시적으로 문서화(현재는 `&&` 분절 케이스만 커버되고 `;`/`|` 케이스는 미검증).

- **[INFO]** 관련 `spec/` 문서 없음 — 본 변경(`.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`, `codebase/frontend/src/lib/repo-guards/__tests__/*`)은 제품 스펙이 아니라 저장소 CI/테스트 하니스 컨벤션이다. `spec/conventions/` 하위에도 `INTERNAL_PACKAGES`·`packages-checks.yml`·이 drift 가드를 규정하는 문서가 없다(grep 확인). 이는 프로젝트 정보 저장 규약상 정상(하니스 규약은 `spec/` 대상이 아님) — 결함이 아니라 "해당 없음"으로 기록.
  - 위치: N/A
  - 상세: `spec/` 전체와 `.claude/docs/` 를 grep 했으나 `INTERNAL_PACKAGES`/`packages-checks`/`internal-package-registration` 을 참조하는 문서가 없음.
  - 제안: 없음(spec 대상 아님). 다만 `.claude/docs/test-wrapper.md` 에 이 신규 4곳 등록 컨벤션을 한 줄 링크로 추가하면 향후 신규 패키지 추가 작업자의 발견성이 좋아진다(선택 사항, 비차단).

- **[INFO]** `packages-checks.yml`/`.claude/test-stages.sh` 자체의 실제 변경분은 헤더 주석 추가뿐(+5/+6 줄) 이고 실행 로직(배열·워크플로 스텝) 은 무변경 — 즉 이번 diff 의 기능적 실체는 신규 가드 테스트 2 파일(`internal-package-registration-guard.ts` + `internal-package-registration.test.ts`) 뿐이다. 두 설정 파일의 헤더 주석은 코드-문서 상호 참조로서 정확하며(가드 파일 경로·"현재 inert" 근거 등) 실측과 일치한다.

## 요구사항 충족 관점 평가

의도한 기능(신규 내부 공유 패키지 추가 시 `.claude/test-stages.sh`의 `INTERNAL_PACKAGES`와 `.github/workflows/packages-checks.yml`의 3개 목록 — 도합 4곳 — 이 실제 패키지 집합과 어긋나면 CI/로컬 테스트가 red 로 드러나게 한다)은 실측 검증(vitest 40/40 통과, 실제 저장소 상태와 4곳 전수 대조 재현)과 코드 리딩을 통해 대부분 견고하게 구현되어 있다. 파서(bash 함수 본문 추출, YAML 서브셋 리스트 추출)는 스스로의 한계를 인지하고 조기 열림/조기 닫힘(heredoc)·here-string 등 위험 패턴을 fail-loud 로 차단하도록 방어적으로 설계됐고, "vacuity 방지" 전용 테스트군으로 파싱 결과가 조용히 빈 값이 되는 상황(이 저장소의 과거 반복 실패형 #960·#962·#968)을 별도로 못 박았다. 반환값·엣지 케이스·TODO/FIXME 여부·spec 정합성(해당 없음, 하니스 영역) 모두 문제 없다. 유일한 실질적 갭은 `explicitFilterCalls` 의 명령 분절기가 quote-비인식이라 따옴표 안 세미콜론이 낀 echo/로그 문자열을 실제 pnpm 호출로 오탐할 수 있다는 점인데, 현재 실제 파일들에는 그 패턴이 존재하지 않아 지금 당장 실패를 유발하진 않으나, 이 가드 자신이 표방하는 방어 기준(주석·로그 문자열 오인식 차단)을 완전히 충족하지는 못하는 미검증 경계다.

## 위험도
LOW
