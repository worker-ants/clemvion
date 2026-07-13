# 의존성(Dependency) 리뷰 — backend Dockerfile `pnpm deploy` 전환 + `injectWorkspacePackages`

대상: `codebase/backend/Dockerfile`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`(settings 1줄), `plan/in-progress/pnpm-migration-followups.md`

## 발견사항

### [WARNING] `injectWorkspacePackages: true` 는 workspace 전역 설정 — backend 로 스코프되지 않는다

- 위치: `pnpm-workspace.yaml` (파일 루트, `settings:` 하위 아님) / `pnpm-lock.yaml` `settings.injectWorkspacePackages`
- 상세: 이 설정은 특정 importer(backend)에 한정되지 않고 **workspace 전체**에 적용된다. `codebase/frontend`,
  `codebase/channel-web-chat`, `codebase/packages/web-chat-sdk` 도 `@workflow/*` 를 `workspace:*` 로 의존하는데
  (lockfile 확인: frontend → `@workflow/chat-channel-validation|expression-engine|graph-warning-rules|node-summary`,
  web-chat-sdk → `@workflow/sdk`), 이 설정이 켜지면 이들 컨슈머도 symlink 대신 **injected(물리 복사)** 방식으로
  전환될 수 있다. 실제로 pnpm 10 은 `pnpm deploy`(non-legacy) 요구사항 때문에 이 값을 도입했지만, 설정 자체는
  deploy 전용이 아니라 일반 `pnpm install` 의 workspace 링크 전략에도 적용되는 전역 lockfile 세팅이다.
  Dockerfile 주석·plan 문서는 "node-linker 는 hoisted 유지 — Next standalone·native 위험 없음" 이라고만
  검증했고, 이번 diff 의 실제 검증 범위(build/unit/e2e)는 **backend** 기준(253 e2e, schedule-trigger 포함)으로
  기술되어 있다. frontend/channel-web-chat 자체 Docker 빌드·devDependency 설치(`pnpm install --frozen-lockfile
  --filter "frontend..." --filter "channel-web-chat..." --filter "@workflow/web-chat..."`, 이 workflow 도 같은
  lockfile/workspace 설정을 공유)가 이 전역 플래그 하에서도 동일하게 동작하는지는 이 diff 만으로 확인되지 않는다.
- 제안: (1) frontend/channel-web-chat Docker 빌드 + 각자 e2e/unit 을 이번 플래그 반영 후 별도로 1회 확인해
  회귀 여부를 명시적으로 기록한다. (2) injected 모드에서는 workspace 패키지가 **설치 시점 스냅샷 복사**이므로,
  로컬 개발 중 `codebase/packages/*` 소스를 수정해도 frontend/backend 쪽에 symlink 라이브 반영되지 않고
  `pnpm install` 재실행이 필요할 수 있다 — 이 워크플로 변화가 실제로 발생하는지 확인해 필요 시
  `PROJECT.md`/CONTRIBUTING 류 문서에 반영한다.

### [WARNING] `package.json` 의 `pnpm.overrides`/`pnpm.onlyBuiltDependencies` 가 pnpm 10.23 에서 더 이상 읽히지 않음 — 보안 핀 거버넌스 공백

- 위치: 루트 `package.json` `pnpm` 필드 (lines 10-43, 확인함 — `overrides` 19개 항목·`@nestjs/swagger: 11.2.7` 포함,
  `onlyBuiltDependencies: [isolated-vm, bcrypt, esbuild, @swc/core, @tailwindcss/oxide]`) / `pnpm-workspace.yaml`
  (현재 `overrides`·`onlyBuiltDependencies` 키 **부재** 확인함) / `pnpm-lock.yaml` (build-approval 상태를
  기록하는 필드 없음 확인함)
- 상세: `plan/in-progress/pnpm-migration-followups.md` 의 "부수 발견" 항목이 정확히 지적한 사실을 코드베이스에서
  직접 재확인했다 — pnpm 10.23 은 `package.json.pnpm.*` 를 읽지 않고 "The pnpm field ... is no longer read" 경고를
  낸다. 그런데 이 설정을 **pnpm 10 의 정규 위치인 `pnpm-workspace.yaml`** 로는 아직 옮기지 않은 상태다. 즉 현재:
  - 보안 취약점 우회용 전이 의존성 오버라이드(lodash/ws/form-data/uuid/`@grpc/grpc-js`/undici 범위-스코프 등
    19건, CVE 대응 커밋 `b2bbb49e` 참조)와 `@nestjs/swagger` 11.2.7 핀은 **현재 lockfile 에 이미 박제된 값**으로만
    유지되고, 그 값을 만드는 설정 자체는 죽어 있다.
  - `onlyBuiltDependencies`(native 모듈 lifecycle 스크립트 허용목록: `isolated-vm`/`bcrypt`/`esbuild`/`@swc/core`/
    `@tailwindcss/oxide`)도 같은 이유로 현재 설정 소스가 없다 — Dockerfile 의 `deps` 스테이지가
    `pnpm install --frozen-lockfile` 로 native 모듈을 재컴파일한다고 주석에 쓰여 있는데, 이 승인 메커니즘이
    실제로 무엇을 근거로 동작하는지(lockfile 관성/이전 pnpm 버전 시점의 잔재/다른 암묵적 기본값) 이 diff 만으로는
    확인되지 않는다.
  - 저장소 전체를 grep 한 결과 CI/Docker 는 예외 없이 `--frozen-lockfile` 만 사용한다(`.github/workflows/*.yml`,
    `codebase/{backend,frontend}/Dockerfile`) — 그래서 지금 당장 깨지지는 않는다. 그러나 **개발자가 신규
    패키지 추가·업그레이드를 위해 로컬에서 non-frozen `pnpm install` 을 돌리는 순간**, 이 오버라이드와
    build-script 허용목록은 적용되지 않는 상태로 lockfile 이 재생성될 위험이 있다 — CVE 패치 핀이 조용히
    사라지거나, `bcrypt`/`isolated-vm` native 빌드가 스킵될 수 있다. 이를 잡아내는 자동 가드가 없다.
- 제안: plan 문서는 이 수정을 §2(swagger 11.2.7→11.4.x deep-import 교체, 버전 bump 리스크 있는 별도 작업)와
  묶어 후순위로 미루고 있다. `overrides`/`onlyBuiltDependencies` 를 `pnpm-workspace.yaml` 로 옮기는 작업은
  **버전 변경이 없는 기계적 이전**(swagger 버전 자체는 그대로 11.2.7 유지, deep-import 교체와 무관)이므로
  swagger deep-import 리팩터와 디커플해 더 빨리(별도의 작은 PR로) 처리할 것을 권장한다. 추가로 CI 에
  `pnpm install`(non-frozen, 별도 job/스크립트) 실행 시 "no longer read" 경고가 다시 나타나지 않는지 체크하는
  스모크 가드를 추가하면 이 회귀를 자동으로 재탐지할 수 있다.

### [INFO] cron-parser 버전 해소 오류 수정 — injected deploy 로 검증됨

- 위치: `codebase/backend/Dockerfile` 신규 `deploy` 스테이지 주석 / `pnpm-lock.yaml`
- 상세: `cron-parser` 는 backend 직접 의존(`^5.5.0`→`5.5.0`)과 `bullmq` 전이 의존(`4.9.0`, 고정)이 동시에
  존재하는 duplicate-version 케이스다. 실제 lockfile 을 확인한 결과 두 버전이 별도 snapshot 으로 존재하고
  (`bullmq@5.79.0` → `dependencies: cron-parser: 4.9.0`, backend importer → `cron-parser: specifier: ^5.5.0
  version: 5.5.0`), legacy(flat) `pnpm deploy --legacy` 는 이 duplicate 를 backend 쪽까지 4.9.0 으로
  collapse 해 `CronExpressionParser`(v5 전용 API) 가 `undefined` 가 되는 실사용 버그(schedule-trigger 400)를
  냈다는 서술이 타당하다. injected(비-legacy) deploy + `injectWorkspacePackages: true` 조합으로 패키지별 isolated
  resolution 을 보존해 이 문제를 없앤 것은 올바른 해결책이며, e2e(`schedule-trigger` 포함, 253건)로 회귀
  검증도 이뤄졌다고 기술되어 있다. 새 패키지 추가나 버전 변경 없이(lockfile diff 는 `injectWorkspacePackages: true`
  한 줄) 순수 해소 전략만 바꿔 버그를 고친 점은 의존성 관점에서 바람직하다.

### [INFO] 이미지 크기·공격 표면 대폭 축소 — 의존성 크기 관점 긍정적

- 위치: `codebase/backend/Dockerfile` `runner` 스테이지
- 상세: `pnpm deploy --prod` 격리 번들로 전환하며 이미지가 1.23GB → 551MB(-679MB, 약 55%↓)로 감소했다고
  기술되어 있다. 이전에는 `node-linker=hoisted` 특성상 `--filter "backend..."` 설치임에도 프런트엔드/테스트
  스택(next·`@next`·three·lucide-react·playwright 등, ~600MB+)과 backend 원본 TS 소스가 프로덕션 이미지에
  같이 실렸는데, 이번 변경으로 제거됐다. devDeps 제거(이전 커밋)에 이은 자연스러운 후속으로, 프로덕션
  이미지의 불필요 의존성 노출(공격 표면)도 함께 줄어든다.

### [INFO] `pnpm deploy` 명령에 `--frozen-lockfile` 미지정 (경미, 일관성)

- 위치: `codebase/backend/Dockerfile` line 60 — `RUN CI=true pnpm --filter=backend deploy --prod /prod/backend`
- 상세: 같은 Dockerfile 의 `deps` 스테이지(`pnpm install --frozen-lockfile --filter "backend..."`)는 결정성
  보장을 위해 `--frozen-lockfile` 을 명시하는데, `deploy` 명령에는 이 플래그가 없다. `deploy` 는 `builder`
  (= `deps` 위) 스테이지에서 실행되어 이미 고정된 store/lockfile 상태를 재사용하므로 실질적 위험은 낮지만,
  결정성 보장 플래그를 스테이지마다 일관되게 명시하는 편이 이후 유지보수자가 "이 스테이지는 lockfile 을
  변경할 수 있는가?" 를 코드만 보고 판단하기 쉽게 한다.
- 제안: pnpm 이 `deploy` 서브커맨드에서 `--frozen-lockfile` 을 지원한다면 명시적으로 추가 검토(필수는 아님).

### [INFO] 내부 워크스페이스 의존(`@workflow/*`) — deploy 산출물에 정상 포함 확인

- 위치: `codebase/backend/Dockerfile` `runner` 스테이지 COPY 목록
- 상세: backend 가 직접 의존하는 `@workflow/chat-channel-validation`·`@workflow/expression-engine`·
  `@workflow/graph-warning-rules`·`@workflow/node-summary` 4개 내부 패키지는 `injectWorkspacePackages: true`
  덕분에 `pnpm deploy` 산출 `node_modules` 에 injected copy + 각 패키지의 빌드된 `dist` 로 포함된다고
  plan 문서에 기술되어 있고, e2e 통과로 뒷받침된다. 신규 외부 의존성은 없고 라이선스·취약점 이슈도 없다.

## 요약

이번 변경은 새 외부 패키지 추가나 버전 업그레이드가 전혀 없는 **순수 빌드 전략 변경**(hoisted flat COPY →
`pnpm deploy` 격리 번들)으로, `cron-parser` duplicate-version 오해소 버그를 근본적으로 고치고 프로덕션 이미지를
55% 줄이는 명확한 개선이다. lockfile 버전 churn 도 0(`injectWorkspacePackages: true` 한 줄만 추가)이라 기존
의존성 그래프에 대한 회귀 위험은 낮다. 다만 두 가지는 후속 확인이 필요하다 — (1) `injectWorkspacePackages`
는 backend 전용이 아니라 workspace 전역 설정이라 frontend/channel-web-chat 의 내부 패키지 링크 방식도 함께
바뀔 수 있는데 이번 diff 의 검증 범위는 backend 중심으로 서술돼 있어 다른 프로젝트에 대한 명시적 재검증이
빠져 있고, (2) 이번 작업 중 발견된 "pnpm 10.23 이 `package.json.pnpm.overrides`/`onlyBuiltDependencies` 를
더 이상 읽지 않는다" 는 사실은 보안 오버라이드 핀의 실질 시행력을 lockfile 관성에만 의존하게 만드는
잠재적 공백이며, 이미 plan 문서에 추적되고는 있으나 스코프상 낮은 우선순위 작업(swagger deep-import 교체)에
묶여 있어 더 빨리 분리 처리하는 편이 안전하다.

## 위험도

MEDIUM
