# 성능(Performance) 리뷰 결과

## 발견사항

### 발견사항 1
- **[WARNING]** `node-linker=hoisted` 선택으로 인한 Docker 이미지 크기 미최적화 — backend runner 단계에서 devDeps 포함
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/Dockerfile` — runner 단계 주석 및 `COPY --from=builder /app ./`
  - 상세: 기존 backend Dockerfile은 `npm prune --omit=dev`로 devDependencies를 제거한 후 필요한 파일만 선택 복사(`packages/`, `backend/node_modules`, `backend/dist`, `backend/package.json`)했다. 신규 구조에서는 `COPY --from=builder --chown=node:node /app ./`로 workspace 전체를 복사하며, 주석에 "devDeps 까지 포함 — 이미지 크기 최적화는 후속 과제"라고 명시되어 있다. hoisted 레이아웃에서 devDeps pruning은 루트 `node_modules`를 대상으로 해야 하는데 `pnpm deploy`를 쓰거나 별도 prune 단계가 없으면 모든 devDeps(tsc, jest, eslint 등)이 프로덕션 이미지에 포함된다. backend 기준 devDeps의 크기는 node_modules 전체 크기의 상당 비율을 차지하므로 이미지 레이어 풀 속도와 컨테이너 시작 메모리 오버헤드에 직접적인 영향을 준다.
  - 제안: 단기 — `pnpm deploy --filter backend /deploy` 또는 `pnpm install --prod --filter backend...` 후 별도 runner 복사를 적용한다. 중기 — strict linker(symlink)로 전환하면 `pnpm deploy`가 pruned 독립 디렉터리를 생성해 이미지 크기를 대폭 줄일 수 있다. 별도 PR로 이미 defer 되어 있으므로 해당 이슈를 추적 티켓으로 등록할 것을 권장한다.

### 발견사항 2
- **[WARNING]** playwright-runner 컨테이너가 레포 전체(`./:/app`)를 마운트하고 매 실행마다 `pnpm install`을 수행
  - 위치: `/Volumes/project/private/clemvion/docker-compose.e2e.yml` — playwright-runner volumes 및 command 섹션
  - 상세: 기존 구조에서는 `./codebase/frontend:/app/frontend`만 마운트해 설치 범위가 frontend 단일 패키지였다. 신규 구조에서는 `./:/app`으로 레포 루트 전체를 마운트한 뒤 `pnpm install --frozen-lockfile --filter frontend...`를 실행한다. pnpm은 workspace 전체 manifest를 파싱한 후 filter를 적용하므로 설치되는 실제 패키지는 frontend subtree로 제한되지만, hoisted node_modules 익명 볼륨이 `/app/node_modules`, `/app/codebase/frontend/node_modules` 등 여러 경로로 분산 마운트되어 레이어 수가 늘었다. 또한 `corepack enable`이 매 실행마다 포함되어 있어 corepack 설치 오버헤드가 발생한다.
  - 제안: playwright-runner 이미지를 사전 빌드한 별도 이미지에 node_modules를 bake-in하거나, Dockerfile의 `deps` 스테이지를 재활용하는 방식으로 매 e2e 실행 시 `pnpm install` 비용을 제거한다. `corepack enable`은 base image에 포함시키거나 Dockerfile에서 처리한다.

### 발견사항 3
- **[WARNING]** `.claude/test-stages.sh`의 `_ensure_deps`가 루트 `node_modules` 존재 여부만 확인 — 부분 설치 상태를 감지하지 못함
  - 위치: `/Volumes/project/private/clemvion/.claude/test-stages.sh` — `_ensure_deps` 함수
  - 상세: `[ -d node_modules ] || pnpm install --frozen-lockfile` 은 단순 디렉터리 존재 확인이다. 새 패키지가 추가된 후 `node_modules`가 이미 존재하는 경우(부분 설치, 잘못된 버전) 설치를 스킵해 이후 `pnpm --filter <pkg> <cmd>` 호출이 missing module 에러로 실패하거나 stale 버전을 참조하게 된다. 기존 `_ensure_web_chat_deps`도 동일 패턴이었으나 scope가 좁았고, 이제 전체 workspace에 같은 패턴이 적용된다.
  - 제안: 존재 확인 대신 `pnpm install --frozen-lockfile` 을 무조건 실행하거나, lockfile 수정 시각과 `node_modules/.modules.yaml` 타임스탬프를 비교하는 방식으로 stale 감지를 강화한다. `pnpm install`은 이미 설치된 상태에서는 빠르게 no-op으로 처리되므로 매번 실행해도 큰 비용이 없다.

### 발견사항 4
- **[INFO]** 내부 패키지 `prepare` 스크립트가 Docker build 중 매 레이어마다 tsc를 실행
  - 위치: `codebase/backend/Dockerfile` 및 `codebase/frontend/Dockerfile` — `COPY codebase/packages ./codebase/packages` + `RUN pnpm install --frozen-lockfile --filter "backend..."` 레이어
  - 상세: `COPY codebase/packages ./codebase/packages`가 단일 레이어로 묶여 있어 어떤 내부 패키지 소스 파일 하나라도 바뀌면 이 COPY 레이어와 이후 `pnpm install`(+`prepare` tsc 빌드) 전체가 캐시 미스가 된다. 기존 구조에서는 패키지별로 COPY/RUN을 분리해 변경된 패키지만 재빌드했다. 현재 방식은 하나의 패키지 변경이 모든 내부 패키지의 tsc 재실행을 유발할 수 있다.
  - 제안: 내부 패키지 소스를 개별 `COPY codebase/packages/<name>/src ./codebase/packages/<name>/src`로 분리하면 변경된 패키지만 재빌드 트리거가 되어 Docker layer 캐시 효율이 개선된다. 단, Dockerfile 복잡도가 증가하므로 내부 패키지 변경 빈도와 tradeoff를 고려한다.

### 발견사항 5
- **[INFO]** CI 워크플로우 `frontend-checks.yml`에서 `--filter "frontend..."`(upstream 포함)로 설치하여 frontend와 무관한 패키지 소스까지 설치 범위에 포함될 수 있음
  - 위치: `/Volumes/project/private/clemvion/.github/workflows/frontend-checks.yml` — "Install frontend workspace" 단계
  - 상세: `pnpm install --frozen-lockfile --filter "frontend..."` 의 `...` suffix는 frontend의 workspace 의존성(upstream)을 포함하는 필터다. `workspace:*`로 연결된 내부 패키지들의 `prepare` 스크립트가 실행되므로 모든 내부 패키지의 tsc 빌드가 CI install 단계에서 발생한다. 내부 패키지가 많아질수록 설치 시간이 선형적으로 늘어난다. 현재는 허용 범위이나 추적이 필요하다.
  - 제안: 내부 패키지의 `prepare` 스크립트를 `if-not-dist` 조건부 또는 pre-built artifact(CI 캐시)로 대체하면 반복 실행 비용을 줄일 수 있다. 현재 구조에서는 `onlyBuiltDependencies`가 native 바이너리만 제어하므로 내부 tsc 빌드는 별도 제어가 필요하다.

---

## 요약

이번 변경은 npm 다중 lockfile 구조에서 pnpm workspace 단일 lockfile 구조로 전환하는 빌드 인프라 리팩터링이다. 성능 관점의 핵심 우려는 두 가지다. 첫째, backend Dockerfile의 runner 단계가 devDependencies를 포함한 workspace 전체를 이미지에 탑재해 프로덕션 이미지 크기가 이전 대비 증가했으며, 이는 컨테이너 풀 지연과 메모리 오버헤드로 이어진다(후속 과제로 defer된 상태). 둘째, docker-compose.e2e.yml의 playwright-runner가 레포 전체를 마운트하고 매 실행마다 `pnpm install`과 `corepack enable`을 수행해 e2e 기동 시간이 늘었다. 나머지는 Docker layer 캐시 효율 저하(내부 패키지 소스를 단일 COPY로 묶음)와 test-stages.sh의 stale 설치 감지 미흡으로 런타임 오류 가능성이 있다. 런타임 애플리케이션 성능(알고리즘, DB 쿼리, 메모리 누수)에는 영향이 없는 변경이며, 빌드·CI 파이프라인 성능의 단기 회귀를 감수하고 장기 워크트리 설치 비용을 해소한 합리적 트레이드오프다.

---

## 위험도

LOW
