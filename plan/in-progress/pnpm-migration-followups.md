---
worktree: pnpm-migration-followups-b97d48
started: 2026-06-20
owner: developer
---

# pnpm 마이그레이션 — 후속 과제

> npm → pnpm workspace 전환 PR(`build(deps): npm → pnpm workspace 모노레포 전환`)에서
> 핵심 전환(매니페스트·lockfile·Docker·CI·하니스·문서)을 완료하고 build/unit/e2e 로 검증했다.
> 아래는 그 PR 의 `/ai-review`(0 Critical / 10 Warning) 에서 **별도 PR 로 분리하기로 결정한**
> 항목들이다. 마이그레이션의 정합성·동작에는 영향이 없으나 최적화·정리 성격.

## 1. backend 프로덕션 이미지 devDependencies 제거 (review WARNING #1, 우선)

`codebase/backend/Dockerfile` runner 가 `COPY --from=builder /app ./` 로 빌드 산출물
전체(devDeps 포함)를 옮긴다 — **정합성 위해 단순 채택**했으나 이미지 크기·공격 표면 증가.

- 옵션 A: `pnpm deploy --filter backend --prod <dir>` (단 gitignored `dist` 제외 문제 — `files` 필드 또는 deploy 후 dist 별도 처리 필요).
- 옵션 B: 전용 prod-deps 스테이지에서 `pnpm install --prod --frozen-lockfile --filter "backend..."` 후 dist + prod node_modules 만 COPY.
- frontend 는 이미 Next standalone 으로 pruned (해당 없음).
- 검증: docker build + e2e + 이미지 크기 before/after.

**완료(2026-07-12, PR pnpm-migration-followups)**: 옵션 B 변형 — 신규 `prod-deps` 스테이지(`FROM builder` + `CI=true pnpm install --prod --frozen-lockfile --filter "backend..."`)에서 devDeps 를 prune 한 뒤 runner 가 통째 COPY. `pnpm install --prod` 가 modules 를 재구성하므로 `--ignore-scripts` 없이 native(bcrypt/isolated-vm)·내부 패키지 prepare 를 재빌드(빌드툴은 deps 스테이지 존재), 비대화형이라 `CI=true`. hoisted node_modules layout(root + backend 로컬 `@workflow` 링크)·built dist 보존. 검증: docker build 성공 + e2e(253) 무회귀 + 이미지 **1.4GB → 1.23GB**.

> **스코프 정직화(ai-review 23_21_17 실측)**: 이 170MB 절감은 **backend 자신의 devDeps(jest/eslint/ts-jest 등)** 제거분이다. **더 큰 덩어리는 남아 있다** — `node-linker=hoisted` 가 워크스페이스를 단일 flat `node_modules` 로 구체화해, `--filter "backend..."` 설치인데도 **프런트엔드 스택(`next` 169MB·`@next` 238MB(native SWC 포함)·webpack·react-dom ≈ 415MB, 최종 이미지의 ~33%)이 backend 이미지에 잔존**한다(typescript/ts-node 도 hoist 로 잔존). 본 diff 회귀 아님(구 builder 동일) — hoisted 특성. 원본 TS 소스 전체도 runner 에 잔존(dist 선별 COPY 안 함).
>
> **후속(별도)**: (a) **프런트엔드 스택·원본소스 제거** — §3(`node-linker=hoisted`→`strict` 전환)으로 backend node_modules 에서 타 프로젝트 deps 격리, 또는 기각됐던 옵션 A(`pnpm deploy --filter backend --prod <dir>`)로 self-contained prod dir 생성. 이미지 크기의 대부분을 좌우해 우선순위 높음. (b) **devDeps 부재 CI 스모크 가드** — 이미지 내 `node_modules/jest` 부재 assert 등으로 prod-deps 우회·오변경 자동 포착(현재 1회성 수기 검증뿐, ai-review testing WARNING).

### 1-(a) 완료(2026-07-14, 옵션 A 채택 + injected deploy)

runner 를 `prod-deps` 통째 COPY → **`pnpm deploy` 격리 번들** COPY 로 교체. runner 가 deploy 산출 `node_modules`(backend prod 의존만·`@workflow/*` 주입·프런트 스택 없음) + builder 산출 `dist` + `package.json` 만 선별 COPY. `files` 필드 불필요, 원본 src/test 는 deploy 중간 stage 에서 폐기.

- **legacy(flat) deploy 는 채택 불가** — `--legacy` 는 backend 직접 의존 `cron-parser@^5.5.0` 을 bullmq 전이 `4.9.0` 으로 잘못 collapse(직접 의존을 버림)해 `CronExpressionParser`(v5 API)가 `undefined` → schedule 이 **유효 cron 도 400**. e2e `schedule-trigger` 가 포착. duplicate-version 을 조용히 오해소하므로 이 트리에 unsafe.
- **해법: injected deploy** — `pnpm-workspace.yaml` 에 `injectWorkspacePackages: true` 추가(lockfile +1줄, 버전 churn 0) 후 비-legacy `pnpm deploy`. 격리 node_modules 로 패키지별 버전 정확(backend→5.5.0, bullmq→4.9.0). **`node-linker` 는 hoisted 유지** — §3(strict flip)은 미포함, Next standalone·native 위험 없음.
- **`injectWorkspacePackages` 실효 범위(실측)**: workspace-global 설정이지만 일반 `pnpm install`(frozen) 의 링크는 여전히 **symlink** — backend·frontend·web-chat-sdk 모두 `node_modules/@workflow/*` 가 `codebase/packages/*` 로의 symlink 로 유지됨을 확인. 즉 frontend `next.config.ts` 의 symlink 전제·dev hot-reload 는 불변이고, 실효 영향은 `pnpm deploy` 산출물 한정이다. frontend Next standalone 빌드도 이 설정 하에서 통과(build stage).
- **검증**: lint·unit(14)·build·e2e(**253**, schedule-trigger 포함) 전부 통과. 이미지 **1.23GB → 551MB**(−679MB, 55%↓). native(bcrypt·isolated-vm) 런타임 로드 OK, `@workflow/*` 4개 주입+dist, ops 스크립트(`dist/scripts/cleanup-invalid-queue-jobs`·`encrypt-auth-config`)·`corepack` 보존.
- **(b) devDeps/프런트 스택 부재 CI 스모크 가드 — 완료(본 PR)**: `.claude/test-stages.sh` `_cmd_backend_image_hygiene_smoke` 추가. build 스테이지에서 프로덕션 이미지에 대해 `jest·next·@next·three·playwright-core` 부재 + `dist/main.js` 존재 + `cron-parser` v5 해소(직접 의존 오해소 회귀 가드)를 assert. 이 클래스 회귀(이미지가 조용히 나빠짐)가 지금껏 ai-review 로만 잡히던 것을 CI 가드로 고정. (typescript/ts-node 는 prod closure 정상 포함이라 제외.)
- **잔여**: §3 full strict 전환은 별도 백로그 유지(본 작업은 `injectWorkspacePackages` 만, node-linker=hoisted 유지).

> **부수 발견 — pnpm 필드 무시 → 완료(2026-07-14, 본 PR)**: pnpm 10.23 은 `package.json` 의 `pnpm.overrides`·`pnpm.onlyBuiltDependencies` 를 **더 이상 읽지 않는다**(`The "pnpm" field ... is no longer read` 경고)는 사실을 실측하고, 보안 핀(overrides 20건, `@nestjs/swagger` 11.2.7 포함)이 lockfile 관성으로만 유지되던 거버넌스 공백을 해소했다. **조치**: `overrides`·`onlyBuiltDependencies` 를 `package.json` `pnpm` 필드 → `pnpm-workspace.yaml`(pnpm 10 정규 위치)로 이전 + lockfile 재생성. **검증**: (1) 경고 소멸(설정이 정규 위치에서 읽힘), (2) `--lockfile-only` 재해소가 lockfile 을 **byte-identical** 로 유지 → overrides 가 읽혀 재적용됨을 증명(무시됐다면 재해소 시 핀이 빠졌을 것), **버전 drift 0**, (3) `onlyBuiltDependencies` 허용목록(bcrypt/isolated-vm/esbuild/@swc/@tailwindcss)이 fresh Docker install 에서 native 정상 빌드, (4) lint·unit·build·e2e 통과. 이제 non-frozen `pnpm install` 에서도 핀이 보존된다. `PROJECT.md` 버전 핀 정책도 정규 위치로 갱신.

## 2. @nestjs/swagger 11.2.7 핀 제거 + deep-import 정리 (review WARNING #6 / INFO #3,#18)

`codebase/backend/src/common/swagger/api-wrapped.ts` 가 `@nestjs/swagger/dist/interfaces/open-api-spec.interface`
(`SchemaObject`) **deep-import** 을 쓰는데 swagger 11.4.x 의 `exports` 가 이 내부 경로를 차단한다.
마이그레이션은 버전 중립성 위해 `overrides` 로 11.2.7 에 핀했다(보안 패치 영구 차단 위험). 핀 위치는 2026-07-14 `package.json` → `pnpm-workspace.yaml` 로 이전됨(§1 부수 발견).

- deep-import 를 공개 경로로 교체 (SchemaObject 공개 re-export 없음 → openapi3-ts 등 대체 타입 소스 조사).
- 교체 완료 시 `pnpm-workspace.yaml` `overrides` 의 `@nestjs/swagger` 핀 제거 (= **이 작업의 명시적 완료 조건**).
- 11.2.7 → 11.4.x changelog 의 보안 수정 여부 확인해 우선순위 결정.

**조사(2026-07-12, defer)**: 실측 — `@nestjs/swagger` 11.2.7 은 `SchemaObject` 를 root 로 공개 export 하지 않고(`'SchemaObject' in require('@nestjs/swagger')` = false) openapi3-ts 를 의존하지도 않는다(미설치). 완료하려면 (a) `openapi3-ts` **신규 devDep 추가** + deep-import 3곳(`api-wrapped.ts` + EIA 응답 DTO spec 2곳: `execution-status-response.dto.spec.ts`·`interact-ack-response.dto.spec.ts`) 교체 + 타입 호환 검증, (b) 핀 제거 → 11.2.7→11.4.x **버전 bump** 의 `SwaggerModule.createDocument` 출력 회귀 검증. 신규 의존성 + 버전 bump 리스크(DTO 스키마 회귀 테스트 다수 의존)라 별 focused PR 로 분리한다. 보안 측면(11.2.7 핀이 패치 영구 차단)에서 우선순위는 있음.

**완료(2026-07-14)**: 위 조사의 openapi3-ts 경로보다 **나은 방식** 확인 — `SchemaObject` 를 **공개 타입에서 파생**(`type SchemaObject = ApiResponseSchemaHost['schema']`; `ApiResponseSchemaHost` 는 root 공개 export 이고 그 `schema` 필드가 곧 `ApiOkResponse({ schema })` 가 받는 타입)해 **신규 의존성 없이** deep-import 3곳을 모두 제거. `OpenAPIObject` 는 원래부터 root 공개라 root import. `@nestjs/swagger` `^11.2.7`→`^11.4.5`(11.4.5) 상향 + `pnpm-workspace.yaml` overrides 핀 제거. **검증**: DTO 스키마 회귀 가드 3 suites/28 tests + lint·unit·build·e2e(253) 통과, `SwaggerModule.createDocument` 출력 불변, peer/라이선스 불변, 활성 CVE 0(예방적 — 향후 패치 차단 해소). `/consistency-check --impl-done` BLOCK: NO. **주의**: lockfile 재생성 시 overrides(picomatch·postcss 등) 가 latest-satisfying 으로 재평가돼 swagger 외 benign patch bump(js-yaml/nanoid/picomatch/postcss, 신규 top-level·major 없음)가 동반됨 — pnpm override 재해소의 불가피한 특성(origin/main 미포함분). base 가 origin/main 대비 2 commit behind 라 PR 전 rebase 필요.

## 3. node-linker=hoisted → strict(isolated) 전역 전환 (review INFO #9)

`.npmrc` 가 NestJS/Next standalone·native dep 호환을 위해 `node-linker=hoisted`(flat) 로 출발했다.
green 안정 후 strict isolation 으로 좁혀 phantom-dependency 위생을 강제하는 것을 검토.

**결정(2026-07-16): GO — isolated 전역 전환 실행 + 완료.** 저리스크 spike(임시 flip → 전 계층 재검증)로
"실제 깨지는 지점" 을 국소화한 결과, 모노레포 전역의 phantom-dependency 는 **backend 4개뿐**이고
모두 정당한 latent 미선언 의존(선언으로 해소)이었다. 최대 리스크로 지목됐던 frontend Next standalone·
native·workspace symlink 는 격리 트리에서 전부 green — 이득(위생 강제·latent 버그 해소) 대비 수정 비용이
작아 GO.

### 변경 요약
- `.npmrc`: `node-linker=hoisted` → `node-linker=isolated`(pnpm 기본) + 주석 갱신.
- `codebase/backend/package.json`: 전환으로 드러난 phantom 을 직접 의존으로 선언 —
  prod `express@^5.2.1`(NestJS express 어댑터 API 직접 사용: `json`/`urlencoded`/`Express.*`),
  prod `ip-address@^10.2.0`(auth-config IP/CIDR 검증), prod `dotenv@^17.4.1`(운영 ops 스크립트),
  dev `@jest/globals@^30.0.0`(spec 파일). 모두 **기존 전이 의존의 해소 버전과 동일** — 신규 버전 0.
- `pnpm-lock.yaml`: 위 4개 직접 의존 edge 추가(4개 edge 자체 버전 churn 0). 신규 top-level 의존
  추가에 따른 통상적 재해소로 dev-tooling 부수 churn 동반 — `eslint-plugin-import` peer-descriptor
  재전개(버전 불변), `jest-validate`→`picomatch` patch 재해소(`4.0.4`→`4.0.5`, override `^4.0.4` 범위 내,
  둘 다 기존 lockfile 에 있던 값). §2 의 "override 재해소 시 benign patch bump 동반" 선례와 동일 성격.
  node-linker 전환 자체는 lockfile 그래프에 무영향(hoisted↔isolated 재링크는 byte-identical).
- 주석 갱신(stale hoisted 서술 → isolated): `pnpm-workspace.yaml`·backend/frontend `Dockerfile`·
  `next.config.ts`·`docker-compose.e2e.yml`. (Dockerfile 빌드 **명령**은 불변 — injected `pnpm deploy`·
  standalone COPY 레이아웃이 isolated 에서 그대로 동작.)

### 검증 (both-stack 필수 — 전역 변경)
clean install(node_modules 전량 삭제 후 재설치) 기준 전 계층 green:
- lint PASS / unit **14** PASS / build PASS(backend clean-room Docker `nest build` 0 err +
  frontend `next build --webpack` standalone 101/101 + widget build).
- backend e2e **254** PASS(injected isolated deploy runner — express·ip-address·dotenv·native 런타임 해소).
- frontend playwright e2e **46** PASS.
- **frontend standalone 프로덕션 runner** 별도 스모크(빌드→기동→홈 307, `✓ Ready`, MODULE_NOT_FOUND 0) —
  playwright 경로가 안 건드리는 `.next/standalone` 트레이싱 산출을 격리 심링크 기준으로 직접 검증.
- native(bcrypt·isolated-vm) 로드 OK, 내부 @workflow/* 는 isolated 에서도 symlink 유지(next.config 전제 불변).

### 핵심 발견 / 교훈
- **lockfile 은 linker-agnostic**: hoisted→isolated 재링크에 `--frozen-lockfile` 성공 + lockfile
  **byte-identical**. 전환은 node_modules 레이아웃만 바꾸고 해소 그래프는 불변 → 롤백도 `.npmrc` 한 줄.
- **tsc 통과 ≠ 런타임 안전**: `express` 는 `@types/express` 가 선언돼 있어 tsc(빌드)는 통과했으나
  런타임 `require('express')` 가 격리 deploy 번들에서 MODULE_NOT_FOUND 로 터졌다(auth.controller 부팅).
  build 만으로는 못 잡고 **e2e 가 포착** — 전역 node_modules 변경에 both-stack e2e 의무의 실증. 재발 방지로
  backend/src 의 미선언 value-import 를 정적 스캔(import/require/dynamic-import/re-export/side-effect)해
  잔여 phantom 0 확인.
- 이미지 크기 이득은 §1-(a) injected deploy 로 이미 확보됨(551MB) — isolated 의 추가 이득은 **빌드/개발
  시점 phantom 위생의 상시 강제**(향후 미선언 의존 유입 fail-fast)와 위 latent 버그(hoist 우연 의존) 해소.
- **후속 install 주의**: 기존 checkout(main worktree 포함)은 다음 `pnpm install` 시 isolated 로 재링크된다.
  hoisted↔isolated 를 **in-place** 로 오가면 구 flat 트리 잔재가 남는 하이브리드가 될 수 있어, 링커 전환
  직후 검증은 반드시 node_modules 전량 삭제 후 clean install 로 한다(본 spike 도 clean install 로 확정).

## 4. 기타 (low)

- ~~Docker `COPY codebase/packages` 패키지별 분리(INFO #4)~~ — **완료(2026-07-14)**: backend Dockerfile 의 소스 COPY 를 backend closure 4개(expression-engine·node-summary·chat-channel-validation·graph-warning-rules)로 좁힘 — sdk·web-chat-sdk(프런트 전용) 제외해 그 변경이 backend 캐시 무효화 안 함. manifest 6개 COPY·frontend Dockerfile(closure 6개 전체)은 유지. 검증: build·e2e(253) 통과, /ai-review 0 Critical/0 Warning. (frontend 는 제외 대상 없어 미변경.)
- ~~playwright-runner 사전 빌드 이미지로 매 실행 `pnpm install` 제거(INFO #5)~~ — **완료(2026-07-16)**: 신규 `codebase/frontend/Dockerfile.playwright-e2e`(FROM playwright v1.61.0-jammy, @playwright/test 해석 버전 정렬)가 frontend deps(closure 4개) + chromium 을 build time 에 baking. docker-compose.e2e.yml playwright-runner 를 raw 이미지+런타임 install → 사전 빌드 image/build 로 전환, command 를 `pnpm --filter frontend e2e` 로 축소(backend-e2e-runner target:deps 동형). 검증: 빌드+playwright-runner 46 tests 통과. /ai-review 0 Critical, 2 Warning(base 태그 정렬·COPY closure 4개) fix 완료.
- ~~js-yaml moderate accept 의 CVE ID·영향 경로 문서화(INFO #2,#16)~~ — **완료(2026-07-14)**: `pnpm-workspace.yaml` `auditConfig.ignoreCves` 에 CVE-2026-53550(js-yaml <3.15.0 DoS, 경로 `frontend>gray-matter>js-yaml@3.14.2`, gray-matter 상향 전까지 수용)을 사유·영향경로·해소조건 주석과 함께 codify. 아래 CI 가드와 통합.
- ~~**의존성 보안 거버넌스 CI 가드**(리뷰 08_25_10 security WARNING)~~ — **완료(2026-07-14)**: `.github/workflows/deps-security-checks.yml` 신설 — (a) `scripts/check-pnpm-security-config.py` 로 `overrides`(키+값)·`onlyBuiltDependencies`·`auditConfig.ignoreCves` 를 baseline 스냅샷 대조(무단 삭제·값 약화·CVE 억제 방지), (b) `pnpm audit --audit-level=moderate`(PR·push·주간 스케줄, 수용 CVE 제외). PROJECT.md 정책 문서화. 리뷰 13_00_33: 0 Critical, 2 Warning(값 검증·ignoreCves 가드) fix 완료. **잔여(사용자)**: main branch protection 에 `config-guard`/`audit` 를 required check 로 등록해야 실제 머지 차단.
- **§1~§4 전체 완료(2026-07-16).** §3(node-linker=hoisted→isolated 전역 전환)까지 실행·검증 종료 —
  본 plan 의 review-derived 후속 과제는 모두 소진. 남은 것은 **별개 저우선 후속 2건**뿐: (a) 의존성 거버넌스
  `deps-security-checks` 의 `config-guard`/`audit` job 을 main branch protection required-check 로 등록(**사용자
  액션**), (b) `@playwright/test` 해석 버전 ↔ `Dockerfile.playwright-e2e`/`docker-compose.e2e.yml` base 태그
  major.minor 일치 CI 가드(caret drift 재발 방지). 이 2건은 §1~§4 와 독립이라 별도 plan/이슈로 이관 권장.
