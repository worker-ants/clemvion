# Architecture Review — node-linker=hoisted → isolated 전역 전환

Scope: `origin/main..HEAD` (19252b21e) — `.npmrc`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
`codebase/backend/{Dockerfile,package.json}`, `codebase/frontend/{Dockerfile,next.config.ts}`,
`docker-compose.e2e.yml`, `plan/in-progress/pnpm-migration-followups.md`.

## 발견사항

- **[INFO]** playwright-runner anonymous-volume mask 목록은 frontend 의존 클로저와 수동 동기화이며 fail-fast 보장이 없다
  - 위치: `docker-compose.e2e.yml:254-259` (playwright-runner volumes), 대비 `codebase/frontend/Dockerfile.playwright-e2e:24-31` (COPY closure)
  - 상세: `.npmrc` 의 isolated 전환이 내세우는 핵심 이득은 "선언 안 한 의존은 빌드에서 fail-fast 로 드러난다"(`.npmrc:5-6`) 는 것인데, 이 보장은 Dockerfile 의 `COPY codebase/packages/<pkg>` 클로저(누락 시 `pnpm install --frozen-lockfile` 자체가 해당 패키지 소스 부재로 실패)에만 적용된다. `docker-compose.e2e.yml` 의 anonymous-volume 마스킹 목록(`/app/codebase/packages/<pkg>/node_modules` 4줄)은 별도로 손으로 유지되는 병렬 목록이며, 신규 항목 누락 시 컴포즈는 조용히 통과한다 — 그 패키지의 `node_modules` 가 마스킹되지 않아 호스트 bind-mount 내용(가능하면 macOS 네이티브 바이너리·부재 상태)이 컨테이너에 노출될 뿐 빌드 실패로 이어지지 않는다. 현재는 frontend 실제 의존(chat-channel-validation·expression-engine·graph-warning-rules·node-summary) 4개와 정확히 일치함을 확인했으나(`codebase/frontend/package.json:36-39`), 이 일치는 코드 주석("신규 내부 패키지 추가 시 아래 마스킹 목록도 보충")에만 의존한다.
  - 제안: 신규 아님(이번 diff 로 인한 회귀 아님) — 다만 isolated 전환이 "phantom 위생의 상시 강제"를 셀링포인트로 내세운 만큼, 이 병렬 목록도 같은 fail-fast 속성을 갖도록(예: CI 스크립트가 frontend package.json 의 `@workflow/*` 목록과 compose 마스킹 목록을 대조) 후속 검토 가치가 있다.

- **[INFO]** `codebase/backend/jest.config.ts` 의 stale 주석이 현재 pnpm 표준화 사실과 모순
  - 위치: `codebase/backend/jest.config.ts:20-22`
  - 상세: `transformIgnorePatterns` 규칙의 `\.pnpm/[^/]+/node_modules/` optional prefix 에 대한 주석이 "a leftover from a prior pnpm install ... though the project itself now standardizes on npm (see CLAUDE.md)" 라고 서술한다. 그러나 루트 `package.json` 은 `"packageManager": "pnpm@10.23.0"` 이고 본 PR 자체가 pnpm node-linker 전환이다 — npm 표준화 서술은 사실과 반대다. 또한 이 PR 이전에는 hoisted 링커라 대부분의 전이 의존이 flat 최상위 `node_modules/<pkg>` 로 해소돼 이 prefix 분기가 사실상 edge-case 였지만, isolated 전환 이후에는 `.pnpm/<pkg>@ver>/node_modules/<pkg>` 형태가 기본 경로가 되어 이 정규식의 optional-prefix 분기가 실제로 상시 사용되는 live path 로 바뀐다. 정확히 이 주제를 다루는 PR 임에도 인접 stale 주석을 정정하지 않았다.
  - 제안: 기능 결함은 아님(정규식이 두 형태를 모두 optional 로 커버해 backend unit 14 PASS 는 이 파일 미변경으로도 영향 없음) — 문서 정확성을 위해 "이제 npm 표준" 문장을 pnpm/isolated 서술로 교체 권장. Diff 범위 밖이라 CRITICAL/WARNING 아님.

- **[INFO]** (확인, 결함 아님) k8s 매니페스트는 node_modules/빌드 레이아웃에 무결합
  - 위치: `k8s/base/*.yaml`, `k8s/overlays/**/*.yaml`
  - 상세: `k8s/**` 전체를 grep 했으나 `node_modules` 참조가 전혀 없다 — 배포는 순수 이미지 참조(`backend-deployment.yaml`/`frontend-deployment.yaml`) 기반이라 node-linker 전환의 blast radius 는 Docker 빌드 스테이지 내부로 완전히 봉쇄된다.

- **[INFO]** local checkout 의 mixed-linker 전환 리스크는 문서(plan)로만 완화, 자동 가드 없음
  - 위치: `plan/in-progress/pnpm-migration-followups.md` "후속 install 주의" 절, `.npmrc:1-12`
  - 상세: plan 문서가 "hoisted↔isolated 를 in-place 로 오가면 구 flat 트리 잔재가 남는 하이브리드가 될 수 있다"고 명시하고 clean install 을 요구하지만, 이를 강제하는 preinstall/postinstall 스크립트나 CI 프리플라이트는 없다. 다만 실질 리스크는 낮다 — CI(`actions/setup-node` `cache: pnpm`)는 lockfile-keyed pnpm store(콘텐츠 주소 지정, 링커 무관) 만 캐시하고 `node_modules` 는 매 실행 처음부터 재생성되므로 CI/Docker 는 영향받지 않는다. 영향은 장기 보존되는 로컬 개발자 checkout 에 한정되고, `node_modules` 는 derived state(gitignore)라 `rm -rf node_modules && pnpm install` 로 자가치유 가능하다.
  - 제안: 심각도 낮음 — 필요시 root `package.json` 에 `postinstall` 가드(예: 혼재 감지 시 경고)를 추가할 수 있으나 현재로선 문서화 수준으로 충분.

## 확인된 안전 지점 (참고)

- backend 4개 phantom 의존(`express`/`ip-address`/`dotenv`/`@jest/globals`) 은 실제 소스 사용처가 확인되고(`auth.controller.ts`, `auth-configs.service.ts`, `src/scripts/*.ts`, `*.spec.ts`), prod/dev 분류가 런타임 필요성과 일치한다(`dist/scripts/*.js` 를 실행하는 `cleanup:queue-jobs`/`encrypt-auth-config` 는 prod 클로저에 있어야 하고 실제로 `dependencies` 에 추가됨).
- `express@5.2.1` 는 `pnpm-lock.yaml` 상 단일 버전으로 해소되어 `@nestjs/platform-express@11.1.27` 의 내부 express 와 충돌/이중 버전 없음.
- `docker-compose.e2e.yml` 의 volume-mask 목록은 현재 frontend 실제 `@workflow/*` 의존(4개)과 정확히 일치, `sdk`/`web-chat-sdk`(frontend 미의존, playwright 클로저 미설치) 는 의도적으로 제외되어 정합.
- `.claude/test-stages.sh:_cmd_backend_image_hygiene_smoke` 의 `[ -d "node_modules/$d" ]` 프런트/테스트 스택 부재 검증은 isolated 링커(symlink) 에서도 `-d` 가 심링크 타깃을 따라가므로 유효 — 회귀 없음.
- `pnpm deploy` 산출물은 (변경 전부터) 워크스페이스 밖 self-contained 디렉터리에 자체 해소 그래프를 구성해 부모 `.npmrc` 의 node-linker 설정과 무관하게 이미 isolated 형태였다는 점이 기존 주석에 명시돼 있어, 이번 루트 링커 플립이 deploy 스테이지 자체의 산출 레이아웃을 바꾸지 않는다(신규 리스크 없음).
- `pnpm-lock.yaml` 변경분은 신규 direct edge 4개 + 무관한 `eslint-plugin-import` peer-string 재계산/`picomatch` patch bump 뿐 — node-linker 전환 자체는 lockfile 그래프에 영향 없음(plan 문서 주장과 일치).

## 요약

이번 변경은 애플리케이션 레이어 설계에는 개입하지 않는 순수 빌드-인프라 전환(pnpm node-linker hoisted→isolated)이며, 드러난 4개 backend phantom 의존을 직접 선언으로 전환해 오히려 "암묵적 hoisting 우연"에 의존하던 의존성 계약을 명시적으로 만든 점은 의존성 위생 관점에서 긍정적이다. Docker 빌드 토폴로지(deps→builder→deploy→runner, injected `pnpm deploy`, Next standalone COPY, playwright 사전빌드 이미지)는 COPY 목록과 스모크 검증이 이미 isolated 레이아웃(virtual store + symlink farm)에 대해 robust 하게 작성돼 있어 구조적으로 안전하다. k8s 는 완전히 무결합. 유일하게 남는 구조적 debt 는 docker-compose e2e 의 anonymous-volume 마스킹 목록이 Dockerfile COPY 클로저와 달리 fail-fast 보장 없이 수동 동기화된다는 점과, 인접한 stale 문서(jest.config.ts 주석)를 이번 PR 이 정리하지 않았다는 점 — 둘 다 낮은 심각도의 문서/유지보수성 이슈로, 이번 diff 의 정확성이나 되돌림 가능성에는 영향이 없다.

## 위험도

LOW
