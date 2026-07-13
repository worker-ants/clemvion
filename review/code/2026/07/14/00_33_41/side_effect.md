# 부작용(Side Effect) 리뷰

대상: `codebase/backend/Dockerfile`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `plan/in-progress/pnpm-migration-followups.md`

## 발견사항

- **[WARNING] `injectWorkspacePackages: true` 는 workspace-global 설정 — backend 만이 아니라 frontend·web-chat-sdk 의 링크 방식도 함께 바뀐다**
  - 위치: `pnpm-workspace.yaml` (+`injectWorkspacePackages: true`), `pnpm-lock.yaml` `settings.injectWorkspacePackages`
  - 상세: `pnpm-workspace.yaml` 최상위 `settings`는 워크스페이스 전체(모든 importer)에 적용되는 global 옵션이다. 도입 목적은 backend `pnpm --filter=backend deploy`(non-legacy)가 요구하는 `ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE` 회피지만, 이 스코프를 backend 로 좁힐 수 없다 — `codebase/frontend`(`@workflow/expression-engine`·`chat-channel-validation`·`graph-warning-rules`·`node-summary` workspace:* 4개), `codebase/packages/web-chat-sdk`(`@workflow/sdk` workspace:*)도 동일 lockfile 로 `pnpm install`할 때 내부 `@workflow/*` 링크가 symlink → injected(copy) 로 바뀐다. 이는 `pnpm deploy` 호출 경로뿐 아니라, 이 lockfile로 `pnpm install`을 수행하는 모든 경로(로컬 host dev, `docker-compose.yml`의 backend/frontend 앱 프로파일 — 둘 다 `target: deps`, CI의 `frontend-checks.yml`/`packages-checks.yml`/`web-chat-checks.yml`, e2e의 `playwright-runner`) 에 적용된다.
  - 제안: plan 문서·PR 설명에서 "backend deploy 전용" 처럼 스코프가 좁아 보이는 서술을 정정하고, frontend/web-chat-sdk 쪽에서 실제로 symlink→injected 전환이 일어났는지, 그로 인한 영향이 없는지 별도로 명시적으로 검증한 근거를 남긴다.

- **[WARNING] frontend `next.config.ts`의 "symlinked package" 전제와 충돌 가능 — 재검증 근거 없음**
  - 위치: `codebase/frontend/next.config.ts:14-21` (`outputFileTracingRoot` 주석 "hoist 된 node_modules 를 누락한다", `transpilePackages: ["@workflow/expression-engine"]` 주석 "Local symlinked package — ... Turbopack cannot follow symlinked local packages"), `codebase/frontend/package.json:7-8`(`dev`/`build` 모두 강제 `--webpack`), `codebase/frontend/Dockerfile:65-66`(runner 주석 "hoist 된 node_modules + codebase/frontend/server.js + codebase/packages/* 를 포함한다")
  - 상세: 이 설정·주석들은 모두 "`@workflow/expression-engine`이 `codebase/packages/expression-engine`을 가리키는 symlink"라는 전제 위에 있다. `injectWorkspacePackages: true` 적용 후 frontend의 `node_modules/@workflow/expression-engine`이 symlink 대신 injected(하드링크/복사) copy 가 되면 (a) 위 주석들의 "symlinked" 서술이 더 이상 정확하지 않고, (b) Next standalone file-tracer 가 이전에는 워크스페이스 바깥(`codebase/packages/*`)의 실제 파일을 추적해 포함시켰지만 이제는 frontend 자신의 `node_modules` 안에 있는 일반 패키지처럼 추적하게 되어 standalone 산출물 구성이 달라질 수 있고, (c) Turbopack 회피(`--webpack` 강제)가 순전히 symlink 추적 실패 때문이었다면 injected 전환 후에는 더 이상 필요 없는 워크어라운드일 수 있다. 이번 diff 4개 파일 중 어느 것도 `next.config.ts`/`package.json`/`Dockerfile`(frontend) 를 건드리거나 이 가정의 재검증을 언급하지 않는다. plan 문서의 "Next standalone·native 위험 없음" 서술은 backend Docker 이미지·e2e 관점 검증이며, frontend 의 symlink 가정 자체를 명시적으로 확인한 근거는 아니다.
  - 제안: `pnpm install` 이후 `codebase/frontend/node_modules/@workflow/expression-engine` 이 symlink 인지 injected copy 인지 `ls -la`/`readlink -f` 로 직접 확인하고, 전환이 일어났다면 (1) 주석 갱신, (2) `transpilePackages`/`--webpack` 강제가 여전히 필요한지 재검토, (3) `frontend-checks.yml`(이 PR 의 `pnpm-lock.yaml`/`pnpm-workspace.yaml` 변경으로 트리거됨)의 `next build` 통과 여부를 명시적으로 근거에 포함.

- **[WARNING] 내부 패키지 dev 워크플로(hot-reload) 저하 가능성 — 검증 범위 밖**
  - 위치: `pnpm-workspace.yaml`(injectWorkspacePackages), `docker-compose.yml`의 `backend`/`frontend` 서비스(둘 다 `target: deps`, `backend_node_modules`/`frontend_node_modules` named volume)
  - 상세: symlink 방식에서는 `codebase/packages/expression-engine` 등 내부 패키지 소스를 수정하고 `tsc`(watch)가 `dist`를 재생성하면, 소비 프로젝트(node_modules 안 symlink)가 이를 즉시 반영한다. injected(copy) 방식에서는 install 시점에 파일이 복제되므로, 이후 원본 `dist` 변경이 소비 프로젝트의 `node_modules`에 자동 반영된다는 보장이 없다(재반영에는 `pnpm install` 재실행이 필요할 개연성이 높다). 로컬 host 개발이나 `docker-compose --profile app`(backend/frontend 모두 `deps` 스테이지 재사용) 에서 내부 패키지와 소비 앱을 동시에 iterate 하는 워크플로가 있다면 "고쳤는데 반영이 안 된다"는 형태의 개발 경험 회귀가 발생할 수 있다. 이번 검증(lint/unit/build/e2e)은 1회성 fresh install → build/run 파이프라인만 확인했을 뿐, watch 기반 반복 개발 루프는 검증 대상이 아니었다.
  - 제안: 개발 가이드에 "내부 `@workflow/*` 패키지 소스 변경 후 소비 앱에 반영하려면 `pnpm install` 재실행 필요" 안내를 추가하거나, 최소한 plan 문서의 "잔여" 섹션에 이 dev-loop 영향 가능성을 명시적으로 기록해 후속 담당자가 인지하도록 한다.

- **[INFO] runner 이미지 파일 레이아웃 축소 — 영향 범위는 이미 실측됐으나 향후 회귀 방지 필요**
  - 위치: `codebase/backend/Dockerfile` (신규 `deploy` 스테이지, `runner`의 선별 `COPY`)
  - 상세: 이전 runner 는 워크스페이스 루트(`/app`) 전체(hoisted node_modules, 다른 앱 소스 등)를 포함했으나, 이제는 `/app/codebase/backend` 하위에 선별된 `node_modules`/`package.json`/`dist` 만 존재한다. `docker-compose.yml`(dev, `target: deps`)과 `docker-compose.e2e.yml`의 `backend-e2e-runner`(`target: deps`)는 이번 diff 가 건드리지 않는 `deps` 스테이지를 그대로 쓰므로 영향이 없고, `backend-e2e`(`target: runner`)는 새 레이아웃으로 e2e(253)에서 실측 검증됐다(WORKDIR 경로 계약 `/app/codebase/backend` 도 보존). 다만 향후 누군가 `docker exec`로 `/app/node_modules`나 워크스페이스 루트 파일을 참조하는 운영/디버깅 스크립트를 작성하면(과거엔 존재, 이제는 부재) 조용히 깨질 수 있다.
  - 제안: 운영 런북/CLAUDE 문서에 "prod 컨테이너는 `/app/codebase/backend` 하위만 존재, 워크스페이스 루트 파일 없음"을 한 줄 남기고, §1-(b) 백로그(devDeps 부재 CI 스모크 가드)에 "워크스페이스 루트 파일 부재 스모크"도 함께 검토 항목으로 추가할 만하다.

- **[INFO] pnpm 필드 무시 이슈는 이번 diff 가 유발한 새 부작용이 아님 — 참고만**
  - 위치: `plan/in-progress/pnpm-migration-followups.md`의 "부수 발견 — pnpm 필드 무시" 단락
  - 상세: `package.json`의 `pnpm.overrides`/`pnpm.onlyBuiltDependencies`가 pnpm 10.23 에서 더 이상 읽히지 않는 문제는 pnpm 버전 자체의 사양이며, 이번 diff(4개 파일)가 새로 만든 부작용이 아니다. 문서에도 "별도 follow-up"으로 명시돼 있어 이번 리뷰의 차단 사유로 잡지 않는다.
  - 제안: 없음(이미 추적됨, §2 와 함께 다루기로 계획됨을 재확인).

## 요약

핵심 변경은 backend 프로덕션 이미지의 devDeps/프런트 스택 잔존 문제를 `pnpm deploy`(격리 self-contained bundle)로 해결한 것으로, Dockerfile 자체의 스테이지 재구성(`deploy` 신설, `runner` 선별 COPY)은 대상 범위(backend runner)에 한해 e2e(253, `backend-e2e` 서비스가 `target: runner` 사용)로 실측 검증되어 있고 WORKDIR 경로 계약도 보존돼 직접적인 회귀 근거는 낮다. 다만 이를 가능케 한 `injectWorkspacePackages: true`는 `pnpm-workspace.yaml`의 workspace-global 설정이라 backend 로 스코프를 좁힐 수 없으며, 동일 lockfile로 install 하는 frontend(`@workflow/expression-engine` 등 4개 workspace:* 의존)와 `packages/web-chat-sdk`(`@workflow/sdk`)의 내부 패키지 링크 방식도 symlink → injected(copy)로 함께 바뀐다. 특히 frontend `next.config.ts`가 "`@workflow/expression-engine`은 symlinked package"라는 전제로 `outputFileTracingRoot`·`transpilePackages`·강제 `--webpack`(Turbopack 회피)을 구성해 두었는데, 이 전제가 이번 변경으로 깨질 수 있음에도 diff 안에 해당 가정의 재검증이나 문서 갱신이 없다. 또한 내부 패키지 소스를 수정하며 소비 앱(dev 서버)에서 즉시 반영을 기대하는 로컬 개발 루프가 symlink→injected 전환으로 저하될 가능성도 검증 범위 밖에 있다. 이번 PR의 lint/unit/build/e2e(253) 통과는 "1회성 fresh install → build/run" 경로에 대한 근거로는 유효하지만, frontend 의 symlink 가정 재검증이나 dev-loop hot-reload 영향까지 커버한다는 직접적 증거는 확인되지 않았다.

## 위험도

MEDIUM
