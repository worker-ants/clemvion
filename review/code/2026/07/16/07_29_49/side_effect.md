# 부작용(Side Effect) 리뷰 — playwright-runner 사전빌드 이미지 전환

대상: `codebase/frontend/Dockerfile.playwright-e2e` (신규), `docker-compose.e2e.yml` (playwright-runner 서비스)

## 발견사항

- **[WARNING]** `COPY codebase/packages ./codebase/packages` 가 closure 로 좁혀지지 않아 sdk/web-chat-sdk 변경도 이미지 빌드 캐시를 무효화한다
  - 위치: `codebase/frontend/Dockerfile.playwright-e2e` L66-67 (`# 내부 패키지 소스 — prepare(tsc)가 install 중 dist 를 빌드한다.` / `COPY codebase/packages ./codebase/packages`)
  - 상세: 이 Dockerfile 자신의 주석(L69-70)은 "frontend + 그 workspace 의존만 설치(playwright e2e 는 page.route 로 backend 를 mock 해 위젯·backend 의존 없음)" 라고 명시하고, 실제로 `RUN pnpm install --frozen-lockfile --filter "frontend..."` 만 실행한다(운영용 `codebase/frontend/Dockerfile` 처럼 `--filter "channel-web-chat..." --filter "@workflow/web-chat..."` 를 추가하지 않음). 즉 이 이미지의 진짜 closure 는 `sdk`/`web-chat-sdk` 를 **포함하지 않는다** — `frontend/package.json` 의 workspace 의존은 `chat-channel-validation`/`expression-engine`/`graph-warning-rules`/`node-summary` 4개뿐이다(직접 확인함). 그럼에도 소스 COPY 는 6개 패키지 전체(`codebase/packages` 통째)를 대상으로 해, `codebase/packages/sdk` 또는 `codebase/packages/web-chat-sdk` 소스가 바뀔 때마다(EIA SDK·웹채팅 위젯은 활발히 개발 중) 이 e2e 전용 이미지의 Docker layer 캐시가 불필요하게 무효화되어 `pnpm install` + `playwright install chromium` 이 매번 재실행된다. 이는 바로 하루 전 커밋(`8a5c667bc`, "내부패키지 소스 COPY 를 backend closure 4개로")이 `codebase/backend/Dockerfile` 에서 동일한 문제를 해결하기 위해 도입한 컨벤션과 정확히 반대되는 패턴이며, 그 커밋 메시지는 명시적으로 "frontend Dockerfile 은 closure 가 6개 전체에 걸쳐 제외 대상이 없다"고 근거를 댔는데 — 그 근거는 **운영용** `codebase/frontend/Dockerfile`(위젯 빌드를 포함해 6개 전부 필요)에는 맞지만, 이번에 새로 추가된 **e2e 전용** `Dockerfile.playwright-e2e`(위젯 빌드 없음, closure 4개)에는 적용되지 않는다.
  - 제안: `COPY codebase/packages ./codebase/packages` 를 `codebase/backend/Dockerfile` 과 동일한 패턴으로 4개 패키지(`expression-engine`/`node-summary`/`chat-channel-validation`/`graph-warning-rules`) 개별 COPY 로 좁혀, sdk/web-chat-sdk 소스 변경이 이 이미지의 빌드 캐시를 건드리지 않게 한다. manifest(package.json) COPY 는 `--frozen-lockfile` 검증을 위해 6개 전부 유지해야 하므로 그대로 둔다.

- **[INFO]** `--with-deps` 제거는 근거 있고 46건 실측 통과로 검증됐으나, 향후 `@playwright/test` 버전 드리프트 시 무음(silent) 실패로 이어질 수 있다
  - 위치: `codebase/frontend/Dockerfile.playwright-e2e` L74-77 (chromium install 주석 + `RUN pnpm --filter frontend exec playwright install chromium`), `docker-compose.e2e.yml` L150-153 (버전 정렬 주석)
  - 상세: base 이미지(`mcr.microsoft.com/playwright:v1.59.1-jammy`)에는 OS 의존성이 이미 설치돼 있으므로 현재 시점엔 `--with-deps` 없이도 문제가 없다는 설명이 타당하고 검증도 됐다. 다만 이 안전장치(런타임에서 매번 `--with-deps` 로 apt 를 재확인하던 것)가 완전히 사라졌고, `frontend/package.json` 의 `@playwright/test` 버전과 base 이미지 태그의 major.minor 정렬은 사람이 두 파일(Dockerfile 주석 + package.json)을 동시에 갱신해야 유지되는 수동 불변식이다. 향후 누군가 `@playwright/test` 만 올리고 이 Dockerfile 의 base 태그를 놓치면, `playwright install chromium`(--with-deps 없음)이 base 이미지에 없는 새 OS 라이브러리를 요구하는 chromium revision 을 내려받을 수 있고, 이 경우 실패는 build 단계가 아니라 런타임에 "browser not found"/공유 라이브러리 누락 형태로 늦게, 불명확하게 나타난다. 이는 사양대로 동작하는 기존 설계(주석에 이미 "상향 시 함께 갱신" 이라고 명시)의 연장으로 신규 버그는 아니지만, `--with-deps` 를 런타임 매번 실행하던 이전 방식이 갖고 있던 암묵적 회복력(설령 base 에 부족해도 apt 로 보정)이 없어졌다는 점은 side-effect 관점에서 명시할 가치가 있다.
  - 제안: 필수는 아니나, CI 에 `frontend/package.json` 의 `@playwright/test` 버전과 `Dockerfile.playwright-e2e`/`docker-compose.e2e.yml` 의 base 태그 major.minor 일치를 확인하는 간단한 가드(스크립트 1줄 grep 비교) 추가를 고려. 또는 `RUN pnpm ... playwright install chromium` 을 유지하되 `--with-deps` 를 다시 붙여도 빌드 시 1회 비용만 추가되고 캐시되므로 안전망으로 저렴하다.

- **[INFO]** 익명 볼륨의 baked node_modules 보존 — 문제 없음 확인
  - 위치: `docker-compose.e2e.yml` L427-438 (volumes 목록, 이번 diff 로 변경되지 않음)
  - 상세: 볼륨 목록(`/app/node_modules`, `/app/codebase/frontend/node_modules`, 4개 내부 패키지 node_modules)은 `frontend...` filter 가 실제로 설치하는 workspace 범위(frontend + chat-channel-validation/expression-engine/graph-warning-rules/node-summary)와 정확히 일치한다. `docker compose run --rm` 은 매 실행 새 컨테이너를 만들고, 익명 볼륨은 최초 생성 시 이미지 해당 경로의 콘텐츠(build time 에 baking 된 node_modules)로 채워진 뒤 `./codebase` bind-mount 위에 얹히므로, host 소스가 컨테이너 경로를 덮어써도 baked node_modules 는 마스킹되지 않고 보존된다 — 기존 `backend-e2e-runner`(target: deps prebuild) 와 동형 패턴이며 올바르게 동작한다.

- **[INFO]** `make e2e-test-full` 의 `run --rm --build playwright-runner` — 신규 이미지 정상 리빌드 확인
  - 위치: `Makefile` L72-75 (`e2e-test-full` 타깃, 이번 diff 로 변경되지 않음), `docker-compose.e2e.yml` L154-157 (`build:` 블록 신규 추가)
  - 상세: 서비스가 `image:` + `build:`(context/dockerfile) 를 모두 갖게 되어 `--build` 플래그가 `Dockerfile.playwright-e2e` 기준으로 이미지를 (레이어 캐시를 활용해) 리빌드한 뒤 컨테이너를 기동한다 — `migrate`/`backend-e2e`/`backend-e2e-runner` 서비스와 동일한 기존 패턴이라 회귀 없음.

- **[INFO]** 브라우저 바이너리(base 이미지의 `/ms-playwright`)가 volume 에 마스킹될 위험 없음
  - 위치: `docker-compose.e2e.yml` L427-438 (volumes 목록)
  - 상세: `Dockerfile.playwright-e2e` 는 `PLAYWRIGHT_BROWSERS_PATH` 를 오버라이드하지 않으므로 base 이미지가 기본으로 쓰는 브라우저 경로(`/ms-playwright`, `/app` 바깥)를 그대로 사용한다. compose 의 bind-mount(`./codebase:/app/codebase` 등)와 익명 volume 목록은 전부 `/app` 하위 경로만 다루므로 브라우저 디렉터리와 교차하지 않는다 — 마스킹 위험 없음.

## 요약

핵심 기능(빌드 타임 baking, 익명 볼륨을 통한 node_modules 보존, `--build` 를 통한 재빌드, chromium 경로 비마스킹)은 모두 올바르게 설계·검증돼 있어 correctness 측면의 side effect 는 없다. 다만 신규 `Dockerfile.playwright-e2e` 가 `COPY codebase/packages ./codebase/packages` 를 closure(4개)로 좁히지 않아, 바로 전날 `codebase/backend/Dockerfile` 에 적용된 동일 문제에 대한 캐시-효율 컨벤션과 어긋나고 이 파일 자신의 "위젯·sdk 의존 없음" 주석과도 모순되어, sdk/web-chat-sdk 소스 변경 시 불필요한 이미지 재빌드(캐시 무효화)라는 실질적 side effect 를 유발할 수 있다. 또한 `--with-deps` 제거는 현재는 안전하나 향후 `@playwright/test` 버전 드리프트 시 무음 실패로 이어질 잔여 리스크가 있다(둘 다 기능 정지가 아닌 유지보수/효율 리스크).

## 위험도

LOW
