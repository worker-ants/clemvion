# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 내부 패키지 목록이 harness 3개 함수에 각각 수동 나열되어 DRY 위반, drift 위험
  - 위치: `.claude/test-stages.sh` `cmd_lint` / `cmd_unit` / `cmd_build`
  - 상세: `@workflow/sdk`, `@workflow/expression-engine`, `@workflow/graph-warning-rules`, `@workflow/node-summary`, `@workflow/chat-channel-validation` 5개 패키지명이 `cmd_lint`·`cmd_unit`·`cmd_build` 세 함수에 각각 별도로 하드코딩되어 총 15줄(5×3)이 추가됐다. 본 PR 자체가 "내부 패키지 5개가 harness 배선에서 누락됐던 갭"을 메우는 residual 작업이라는 점이 이 나열 방식의 위험을 스스로 증명한다 — 향후 신규 내부 패키지 추가 시 3곳 모두 갱신해야 하고, 한 곳이라도 빠지면 이번과 동일한 종류의 회귀(CI/lint 미검증)가 재발한다.
  - 제안: 패키지명 리스트를 배열/변수로 뽑아 `for pkg in "${INTERNAL_PACKAGES[@]}"; do pnpm --filter "$pkg" lint || return 1; done` 형태로 3개 함수가 공유하도록 리팩터. 단, `cmd_lint`/`cmd_unit`/`cmd_build` 는 이미 순서·구성원(예: `channel-web-chat` 위치, `typecheck` 추가 스텝)이 함수별로 조금씩 다른 기존 관례가 있어 완전 통합보다는 "내부 packages 블록"만 부분 추출하는 선에서 충분함. 즉시 조치가 아니어도 되나 다음 내부 패키지 추가 시 우선 처리 권장.

- **[INFO]** 5개 `eslint.config.mjs` 가 주석 1줄(패키지명)을 제외하고 완전히 동일한 27줄 보일러플레이트
  - 위치: `codebase/packages/{chat-channel-validation,expression-engine,graph-warning-rules,node-summary,sdk}/eslint.config.mjs`
  - 상세: `diff` 로 대조한 결과 5개 파일이 패키지명이 들어간 헤더 주석 한 줄만 다르고 나머지(ignores, `eslint.configs.recommended`, `tseslint.configs.recommended`, `globals.node/jest`, `no-unused-vars` 커스텀 규칙)는 바이트 단위로 동일하다. 다만 이 저장소는 `backend`/`frontend`/`channel-web-chat`/`web-chat-sdk` 도 각자 독립 `eslint.config.mjs` 를 보유하는 기존 관행(공유 base config 패키지 부재)이 이미 있어, 이번 5개 파일은 그 기존 패턴을 그대로 답습한 것이다 — 새로운 안티패턴이 아니라 기존 컨벤션 일관성 유지다.
  - 제안: 당장 리팩터를 요구하지는 않되, 내부 packages(`expression-engine`/`graph-warning-rules`/`node-summary`/`chat-channel-validation`/`sdk`)처럼 "Node lib + jest" 조합이 반복되는 그룹에 한해 향후 6번째 패키지가 추가되는 시점에 공유 `eslint-config-node-lib.mjs` (혹은 workspace 내부 패키지)로 추출할 가치를 재평가할 것.

- **[INFO]** harness 주석이 신규 배선된 5개 내부 패키지를 반영하지 않음
  - 위치: `.claude/test-stages.sh` L9-12 (`_ensure_deps` 위 주석: "lint/unit/build 는 backend + frontend + web-chat 전부 실행한다...")
  - 상세: 해당 주석은 PR-E3 핫픽스 사례를 근거로 "backend + frontend + web-chat" 를 묶어 돌리는 이유를 설명하는데, 이번 diff 로 `cmd_lint`/`cmd_unit`/`cmd_build` 각각 5개 내부 패키지가 추가되어 실제 커버리지가 주석보다 훨씬 넓어졌다. 최신 상태를 반영하지 않으면 다음에 이 파일을 읽는 사람이 "harness 가 무엇을 커버하는지"를 코드와 주석 사이에서 재조합해야 한다.
  - 제안: 주석에 "+ 내부 공유 packages(sdk/expression-engine/graph-warning-rules/node-summary/chat-channel-validation)" 정도의 문구를 추가해 목록을 최신화.

- **[INFO]** `packages-checks.yml` 과 `web-chat-checks.yml` 의 job 분할 단위 불일치
  - 위치: `.github/workflows/packages-checks.yml` (`jobs.packages` 단일 job 이 4개 패키지의 lint/test/build 를 순차 실행) vs `.github/workflows/web-chat-checks.yml` (`sdk`/`widget`/`sdk-client` 로 패키지별 job 분리)
  - 상세: 두 워크플로 모두 "내부 packages 의 회귀를 캐치하는 CI 가드"라는 동일한 목적을 갖지만, 하나는 패키지당 독립 job(병렬 실행, GitHub UI 상 실패한 패키지가 바로 드러남)이고 다른 하나는 4개 패키지를 한 job 의 순차 스텝으로 묶어 실행한다. 후자는 어느 패키지가 실패했는지 확인하려면 로그를 열어야 하고, 한 패키지의 실패가 뒤 패키지의 실행을 (fail-fast 로) 막는다.
  - 제안: 강제 사항은 아니나, 이 저장소의 CI 워크플로 관례를 하나로 통일할지 검토(예: `packages-checks.yml` 도 매트릭스 `strategy.matrix.package` 로 패키지별 job 분리). 현재도 기능적으로는 정상 동작하므로 급하지 않음.

- **[INFO]** `package.json` devDependencies 정렬 컨벤션이 기존 `web-chat-sdk` 와 다름
  - 위치: `codebase/packages/{chat-channel-validation,expression-engine,graph-warning-rules,node-summary,sdk}/package.json` devDependencies
  - 상세: 이번에 손댄 5개 package.json 은 devDependencies 를 알파벳순으로 정렬한 반면(예: `@eslint/js`, `@types/jest`, `eslint`, `globals`, `jest`, `ts-jest`, `typescript`, `typescript-eslint`), 이미 동일한 lint 스택을 쓰는 `codebase/packages/web-chat-sdk/package.json` 은 비정렬 순서(`typescript`, `@types/jest`, `@eslint/js`, `esbuild`, ...)를 유지하고 있어 워크스페이스 내 package.json 키 정렬 컨벤션이 통일돼 있지 않다.
  - 제안: 강제 규약(예: `sort-package-json`)이 없다면 무시 가능한 사소한 스타일 편차. 다만 향후 lint 스택 관련 패키지를 만질 때 일관되게 정렬할지 결정해두면 좋음.

- **[INFO][긍정]** 죽은 코드 정리 양호
  - 위치: `codebase/packages/expression-engine/src/functions/date.ts` (미사용 `ManipulateUnit` 유니온 타입 제거), `codebase/packages/expression-engine/src/functions/string.ts` (미사용 `FunctionError` import 제거)
  - 상세: 둘 다 신규 lint 가드(`no-unused-vars`) 활성화로 드러난 실제 미사용 코드를 정리한 것으로 보이며, 사이드 이펙트 없는 안전한 정리다. 가독성/일관성 관점에서 긍정적.

## 요약

이번 변경은 harness/CI 배선(`test-stages.sh`, 신규 `packages-checks.yml`, `web-chat-checks.yml` lint 스텝 추가) + 5개 내부 패키지에 대한 `eslint.config.mjs`/devDependencies 신설이 중심이며, 실제 프로덕션 로직 변경은 죽은 코드 제거(`date.ts`/`string.ts`) 2건뿐이라 위험 표면이 작다. 가장 눈에 띄는 유지보수성 이슈는 `test-stages.sh` 세 함수에 동일한 5개 패키지명을 반복 나열한 점인데, 이 PR 자체가 "과거에 그 나열 방식 탓에 패키지가 누락됐던" 사례를 스스로 재확인시켜 준다는 점에서 향후 drift 방지를 위한 리스트 추출을 권장한다. 그 외 5개 `eslint.config.mjs` 의 바이트 단위 중복, CI job 분할 단위 불일치, harness 주석 stale, package.json 키 정렬 편차는 모두 기존 컨벤션(패키지별 독립 config, 명시적 나열 스타일)과 대체로 일관되거나 사소한 수준이라 즉시 조치가 필요하지 않은 INFO 성격이다.

## 위험도

LOW
