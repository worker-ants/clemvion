# 의존성(Dependency) 리뷰 결과

## 발견사항

### 1. 패키지 매니저 전환: pnpm@10.23.0 도입
- **[INFO]** npm → pnpm workspace 전환은 새로운 외부 도구(pnpm)를 패키지 매니저로 도입하는 변경이다.
  - 위치: `/package.json` L8 (`"packageManager": "pnpm@10.23.0"`)
  - 상세: pnpm 은 MIT 라이선스이며, 주요 npm 레지스트리 패키지와 완전 호환된다. `packageManager` 필드 + corepack 조합으로 버전을 정확히 고정(10.23.0)했다. 라이선스·공급망 위험 없음.
  - 제안: 현 상태 유지. corepack 이 버전 고정을 강제하므로 추가 조치 불필요.

### 2. 보안 overrides 단일 루트 통합
- **[INFO]** 기존 `codebase/backend/package.json` 과 `codebase/frontend/package.json` 에 분산되어 있던 `overrides` 블록이 루트 `package.json` 의 `pnpm.overrides` 로 통합되었다.
  - 위치: `/package.json` L13–L40
  - 상세: workspace-global overrides 는 모든 workspace 패키지에 동시 적용된다. 기존 npm overrides 가 커버하던 항목이 모두 이전됐다: `lodash`, `picomatch`, `liquidjs`, `ip-address`, `express-rate-limit`, `protobufjs`, `fast-uri`, `hono`, `uuid`, `ws`, `@grpc/grpc-js`, `multer`, `form-data`, `nodemailer`, `eslint-plugin-react-hooks`, `vite`, `@babel/core`. pnpm audit 0 high·0 critical(잔여 js-yaml moderate accept) 로 검증됨. 이전 대비 보안 overrides 범위가 축소되거나 누락된 항목이 없다.
  - 제안: 현 상태 유지.

### 3. undici override 버전-레인지 스코프
- **[WARNING]** `undici@>=7.0.0 <7.28.0` 버전-레인지 스코프 override 가 도입됐다.
  - 위치: `/package.json` L35 (`"undici@>=7.0.0 <7.28.0": "^7.28.0"`)
  - 상세: backend 는 direct dep 로 `^6`을 쓰고 frontend 는 취약한 7.x 전이 의존성을 가지므로, 7.x 범위만 스코프해 6.x backend 를 건드리지 않는 의도다. 스코프 표기는 pnpm v10 에서 지원되며 올바른 접근이다. 그러나 향후 frontend 의 전이 undici 가 `^7.28.0` 보다 높은 버전으로 요구될 경우(예: next 가 undici@8 로 올라설 때) 이 override 가 강제 다운그레이드 또는 충돌을 일으킬 수 있다. 현재 pnpm audit clean 이므로 즉각 위험은 없으나, 정기 모니터링이 필요하다.
  - 제안: 추후 `next` 또는 undici 전이 체인이 7.28.0 이상으로 올라설 때 이 override 를 제거하고 범위를 재검토할 것. 현재는 수용 가능.

### 4. @nestjs/swagger 11.2.7 exact 핀
- **[WARNING]** `@nestjs/swagger` 를 exact 버전 11.2.7 로 고정했다.
  - 위치: `/package.json` L40 (`"@nestjs/swagger": "11.2.7"`)
  - 상세: `codebase/backend/src/common/swagger/api-wrapped.ts` 가 `@nestjs/swagger/dist/interfaces/open-api-spec.interface` deep-import 를 사용하는데 11.4.x 의 `exports` 필드가 이 경로를 차단한다. exact 핀 + 사유 주석(`//swagger-pin`)이 명시돼 있어 정책(PROJECT.md 버전 핀 정책 §b)을 준수한다. 그러나 exact 핀은 11.2.7 의 잠재적 보안 패치를 영구 차단한다.
  - 제안: deep-import 를 공개 경로로 교체하는 별도 PR 을 계획대로 진행하여 exact 핀을 caret 으로 완화할 것. 핀 유지 기간을 최소화할 것.

### 5. docker-compose.e2e.yml — playwright runner 루트 마운트
- **[WARNING]** playwright-runner 서비스가 workspace 루트 `./:/app` 전체를 컨테이너에 마운트한다.
  - 위치: `/docker-compose.e2e.yml` diff, playwright 서비스 volumes 블록 (`- ./:/app`)
  - 상세: 이전에는 `./codebase/frontend:/app/frontend` 로 frontend 만 마운트했으나, pnpm workspace 특성상 루트 전체가 필요하여 repo 루트를 마운트한다. `.env` 파일, `k8s/`, `scripts/` 등 민감 경로가 playwright 컨테이너 안으로 들어간다. anonymous volume 으로 `node_modules` 5개를 가리고 있어 호스트 바이너리 누수를 방지하지만, `.env` 류 시크릿이 컨테이너 내 파일시스템으로 유입된다. e2e 환경에서 실 시크릿이 없는 경우라면 허용 가능하나, CI 에서 `.env` 를 repo 에 체크인하거나 런타임 주입하는 경우 점검이 필요하다.
  - 제안: playwright 컨테이너에 필요한 경로를 추가 파악하고, 루트 마운트 대신 필수 경로만 선택적으로 마운트하는 방향을 검토할 것(단, pnpm workspace 구조상 node_modules 경로가 루트에 있어 제약이 있음을 인정).

### 6. backend Dockerfile — runner 스테이지 devDeps 포함
- **[WARNING]** backend runner 스테이지가 builder 전체(`/app ./`)를 COPY 하여 devDependencies 가 운영 이미지에 포함된다.
  - 위치: `/codebase/backend/Dockerfile` diff, runner 스테이지 (`COPY --from=builder --chown=node:node /app ./`)
  - 상세: 이전에는 `node_modules`, `dist`, `package.json` 만 선택적으로 복사했으나, 이번 PR 에서는 workspace 전체를 복사한다. 주석("devDeps 까지 포함 — 이미지 크기 최적화는 후속 과제")으로 인지되어 있다. 보안 취약점 노출 표면이 커지고 이미지 크기가 증가한다.
  - 제안: 후속 PR 에서 `pnpm deploy` 또는 `--prod` flag 를 이용해 production deps 만 추출하거나, devDeps 를 prune 한 별도 스테이지를 추가할 것. 현재 PR 범위에서 인지·기록된 사항이므로 BLOCK 은 아님.

### 7. 내부 의존성: file:* → workspace:* 전환
- **[INFO]** 6개 내부 패키지(@workflow/chat-channel-validation, @workflow/expression-engine, @workflow/graph-warning-rules, @workflow/node-summary, @workflow/sdk, @workflow/web-chat)의 참조 방식이 `file:../packages/*` → `workspace:*` 로 변경됐다.
  - 위치: `codebase/backend/package.json`, `codebase/frontend/package.json`, `codebase/packages/web-chat-sdk/package.json`
  - 상세: `workspace:*` 는 pnpm 표준 내부 참조 프로토콜로 단일 lockfile 로 수렴하며 symlink 방식을 통해 in-place 참조가 이루어진다. node-linker=hoisted 설정에 의해 실제 파일 시스템상 flat node_modules 를 사용하므로 phantom-dependency 위험이 줄어든다. 전환 전후 의존 관계에 의미 변화가 없다.
  - 제안: 현 상태 유지.

### 8. onlyBuiltDependencies 허용 목록
- **[INFO]** `pnpm.onlyBuiltDependencies` 에 5개 패키지(`isolated-vm`, `bcrypt`, `esbuild`, `@swc/core`, `@tailwindcss/oxide`)가 명시됐다.
  - 위치: `/package.json` L42–L48
  - 상세: pnpm v10 의 기본 lifecycle 차단 정책을 준수하면서 네이티브 빌드가 실제로 필요한 패키지만 허용하는 올바른 접근이다. 추가 패키지 설치 시 'Ignored build scripts' 경고를 통해 발견·보충하는 운영 절차가 주석에 명시돼 있다.
  - 제안: 현 상태 유지.

### 9. js-yaml moderate 취약점 수용
- **[INFO]** pnpm audit 결과 잔여 js-yaml moderate 취약점이 accept 처리됐다.
  - 위치: 커밋 메시지 검증 섹션
  - 상세: moderate 취약점이므로 즉각 위험은 낮다. 명시적 accept 결정이 기록됐다. 그러나 js-yaml 이 어느 패키지의 전이 의존인지, override 로 해소 가능한지를 별도로 추적하는 것이 권장된다.
  - 제안: `pnpm why js-yaml` 로 의존 체인 파악 후, 해소 가능한 경우 overrides 에 추가. 불가한 경우 accept 근거를 issues 또는 문서에 등재.

### 10. CI 미검증: frontend playwright (cross-platform)
- **[INFO]** 커밋 메시지에 "CI 미검증: frontend playwright(cross-platform 로컬 한계)"가 명시됐다.
  - 위치: 커밋 메시지
  - 상세: `.github/workflows/frontend-checks.yml` 의 `pnpm install --frozen-lockfile --filter "frontend..."` 경로가 CI 에서 실행됐는지 미확인이다. playwright 관련 dependency 설치 경로(docker-compose.e2e.yml playwright 서비스의 corepack enable 인라인 명령)가 CI 환경에서 처음 실행될 때 예상치 못한 설치 오류가 발생할 수 있다.
  - 제안: CI 에서 직접 검증 후 merge 할 것. 특히 playwright runner 의 `corepack enable && pnpm install ...` 인라인 명령이 Playwright mcr.microsoft.com 이미지 환경에서 정상 동작하는지 확인 필요.

---

## 요약

이번 변경은 npm → pnpm workspace 전환이라는 패키지 매니저 수준의 인프라 교체로, 새로운 외부 런타임 라이브러리 추가 없이 도구 체계만 교체한다. pnpm@10.23.0 exact 핀(corepack), 단일 pnpm-lock.yaml, 분산 overrides 통합, onlyBuiltDependencies 명시 등 의존성 재현성·보안 측면의 기반이 npm 시절 대비 전반적으로 향상됐다. 즉각적 CRITICAL/HIGH 취약점은 없으며(pnpm audit 0 high·0 critical 확인), 주요 우려는 @nestjs/swagger exact 핀의 보안 업데이트 차단(후속 PR 계획 있음), backend runner 이미지 devDeps 포함(후속 과제로 인지됨), playwright runner 루트 마운트 범위 확대, frontend CI 미검증이다. 모두 이미 PR 작성자가 인지하고 후속 계획을 명시한 사항이며, 현 PR의 핵심 목적(workspace 전환)에 차단 사유가 되지 않는다.

## 위험도

LOW

---

STATUS: SUCCESS
