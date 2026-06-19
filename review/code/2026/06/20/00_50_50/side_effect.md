# 부작용(Side Effect) 리뷰 결과

## 발견사항

### **[WARNING]** `_ensure_deps` 가 CWD 기준으로 `node_modules` 를 검사 — 워크트리 루트 불일치 가능성
- 위치: `.claude/test-stages.sh`, `_ensure_deps()` 함수
- 상세: `[ -d node_modules ] || pnpm install --frozen-lockfile` 는 호출 시점의 현재 디렉터리에서 `node_modules` 존재 여부를 확인한다. `run-test.sh` 가 스크립트를 source 하는 위치가 워크스페이스 루트(`/`)가 아닌 다른 디렉터리일 경우, 루트 `node_modules` 가 존재해도 오탐(false negative)으로 `pnpm install` 을 건너뛰거나, 반대로 하위 디렉터리의 `node_modules` 를 보고 설치를 건너뛰는 부작용이 생길 수 있다. `pnpm install --frozen-lockfile` 자체는 재현성 있는 설치를 보장하지만, **체크 조건이 잘못된 경로를 보면** 오래된 node_modules 가 그대로 사용되어 테스트가 잘못 통과할 위험이 있다.
- 제안: `[ -d "$(git rev-parse --show-toplevel)/node_modules" ] || pnpm install --frozen-lockfile` 처럼 절대 경로를 사용하거나, 혹은 체크를 제거하고 항상 `pnpm install --frozen-lockfile` 을 실행(멱등 연산이므로 overhead 미미)하는 방식으로 변경.

### **[WARNING]** backend Dockerfile runner 스테이지 — devDependencies 포함 배포 이미지
- 위치: `codebase/backend/Dockerfile`, runner 스테이지 (`COPY --from=builder /app ./`)
- 상세: 이전 Dockerfile 은 `npm prune --omit=dev` 로 devDependencies 를 제거한 뒤 필요한 파일만 선별 복사했다. 변경 후 runner 스테이지는 `COPY --from=builder --chown=node:node /app ./` 로 빌드 전체를 그대로 복사한다. 주석에 "devDeps 까지 포함 — 이미지 크기 최적화는 후속 과제"라고 명시되어 있으나, 이는 의도된 부작용이며 **배포 이미지 크기 증가 및 공격 표면 확대**(예: typescript, ts-jest 등 devDep 이 production 컨테이너에 적재)라는 실질적인 부작용을 유발한다. 보안 감사 또는 크기 제약이 있는 환경에서 문제가 될 수 있다.
- 제안: 후속 PR 에서 `pnpm deploy --filter backend --prod /app/deploy` 패턴 또는 multi-stage prune 을 도입. 현재 PR 이 명시적으로 defer 를 인식하고 있으므로 차단 수준은 아니나, 후속 plan 에 트래킹이 필요하다.

### **[WARNING]** docker-compose.e2e.yml playwright-runner — 워크스페이스 루트 전체를 컨테이너에 마운트
- 위치: `docker-compose.e2e.yml`, playwright-runner service volumes
- 상세: 이전에는 `./codebase/frontend:/app/frontend` 만 마운트했으나, 변경 후 `./:/app` 으로 **레포 전체**(`.git/`, `.claude/`, `spec/`, `plan/`, 모든 민감 파일)가 컨테이너 안으로 노출된다. playwright 컨테이너 안에서 임의 코드가 실행될 경우(테스트 취약점, 악성 npm script 등) 호스트 파일시스템 전체에 접근 가능해진다.
- 제안: 마운트 범위를 `./codebase:/app/codebase` + `./pnpm-lock.yaml:/app/pnpm-lock.yaml` + `./pnpm-workspace.yaml:/app/pnpm-workspace.yaml` + `./package.json:/app/package.json` + `./.npmrc:/app/.npmrc` 처럼 필요한 파일/디렉터리만 선별 마운트. `.git/` 과 `.claude/` 는 e2e 에 불필요하므로 제외.

### **[WARNING]** `codebase/packages/web-chat-sdk/package.json` — `build` 스크립트 내 `npm run` 잔존
- 위치: `codebase/packages/web-chat-sdk/package.json`, `"build"` 스크립트
- 상세: `"build": "tsc && pnpm run build:loader"` 로 수정됐으나, pnpm workspace 환경에서 `pnpm run build:loader` 는 현재 패키지 컨텍스트에서 실행되므로 문제없다. 그러나 `tsc` 이후 `pnpm run build:loader` 실패 시 exit code 는 올바르게 전파된다. 이 자체가 부작용은 아니나, **`prepare` 스크립트 `[ -d dist ] || tsc`** 는 dist 가 비어있는 stale 상태일 때 증분 빌드를 건너뛸 수 있다. pnpm install 의 `prepare` hook 에서 dist 내용이 오래된 경우에도 재빌드가 생략될 수 있어 stale artifact 가 배포에 포함될 위험이 있다.
- 제안: `prepare` 스크립트를 `tsc` 만으로 단순화하거나, `dist` 의 timestamp 기반 검사를 도입.

### **[INFO]** `pnpm.overrides` 의 `undici@>=7.0.0 <7.28.0` 범위-스코프 override — backend 6.x 에 영향 없는지 확인 필요
- 위치: `package.json`, `pnpm.overrides`
- 상세: `"undici@>=7.0.0 <7.28.0": "^7.28.0"` override 는 7.x 계열 취약 범위를 타겟으로 한다. backend 가 직접 의존하는 `undici ^6` 는 이 범위에 해당하지 않으므로 영향을 받지 않는다고 설명되어 있다. 그러나 pnpm override 의 버전-레인지 스코프가 예상대로 동작하는지 `pnpm ls undici --filter backend` 로 실제 해소 버전을 검증한 결과가 문서에 없다. 만약 범위 스코프가 예상과 다르게 동작하면 backend 의 undici 6.x 가 7.x 로 강제 업그레이드되어 runtime 호환성 문제가 생길 수 있다.
- 제안: CI 또는 로컬에서 `pnpm ls undici --filter backend` 결과를 커밋 메시지 또는 PR 본문에 첨부하여 6.x 불변을 명시적으로 확인.

### **[INFO]** `.npmrc` 루트 신규 도입 — 기존 하위 디렉터리 `.npmrc` 와의 충돌 가능성
- 위치: `.npmrc` (신규)
- 상세: 루트에 `.npmrc` 가 새로 생성되면서 `node-linker=hoisted` 및 `engine-strict=false` 가 모든 workspace 패키지에 전역 적용된다. 만약 `codebase/` 하위에 기존 패키지별 `.npmrc` 가 존재한다면 상위 설정이 병합 또는 오버라이드될 수 있다. diff 에서 하위 `.npmrc` 변경은 보이지 않으므로 현재로서는 충돌 없는 것으로 판단되나, 향후 패키지 추가 시 주의 필요.
- 제안: `find /Volumes/project/private/clemvion -name ".npmrc" ! -path "*/node_modules/*"` 로 하위 `.npmrc` 존재 여부를 점검. (INFO 수준 — 현재 변경 범위에서는 문제 없음)

### **[INFO]** `next.config.ts` `outputFileTracingRoot` 변경 — 빌드 산출물 크기 증가
- 위치: `codebase/frontend/next.config.ts`
- 상세: `outputFileTracingRoot` 를 `codebase/` (한 단계 위) 에서 레포 루트(두 단계 위)로 확장했다. 이로 인해 Next.js standalone 파일 트레이서가 레포 루트 전체를 스캔 대상으로 삼아 `spec/`, `plan/`, `.claude/` 등 애플리케이션 실행에 불필요한 파일이 standalone 번들에 포함될 가능성이 있다. Node.js 파일 트레이서는 import/require 경로를 정적 분석하므로 실제로 참조되지 않는 파일은 제외되지만, `outputFileTracingExcludes` 없이 운영 이미지 크기가 예상보다 커질 수 있다.
- 제안: `next build` 후 `.next/standalone` 디렉터리 내용을 확인하여 불필요한 레포 파일이 포함되지 않는지 점검. 필요시 `outputFileTracingExcludes` 패턴 추가.

### **[INFO]** `@nestjs/swagger 11.2.7` 전역 핀 — `onlyBuiltDependencies` 와 별도 관리 구조
- 위치: `package.json`, `pnpm.overrides`의 `"@nestjs/swagger": "11.2.7"`
- 상세: 이 override 는 `onlyBuiltDependencies` 허용 목록과 별도로 관리되며 명확한 사유 주석이 인라인에 있어 추적 가능하다. 현재 `api-wrapped.ts` 가 deep-import(`@nestjs/swagger/dist/interfaces/...`)를 사용하므로 11.4.x 로 업그레이드 시 런타임 오류가 발생한다. 이 핀이 제거되지 않으면 이후 pnpm update 또는 개별 패키지 upgrade 명령이 해당 버전을 넘어설 수 없으며, 팀이 인지하지 못한 채 장기 방치될 위험이 있다.
- 제안: 별도 PR (deep-import 정리) 의 plan 파일에 이 override 제거를 명시적 완료 조건으로 등록.

## 요약

이번 변경은 npm 다중 lockfile 구조를 pnpm workspace 단일 lockfile 로 전환하는 인프라 리팩터링이다. 런타임 애플리케이션 코드(TypeScript 소스)를 수정하지 않으므로 전역 변수, 이벤트/콜백, 네트워크 호출 관점의 의도치 않은 부작용은 없다. 주요 부작용 위험은 인프라 계층에 집중된다: (1) `_ensure_deps()` 의 CWD 의존적 경로 체크가 잘못된 디렉터리에서 호출될 경우 stale 설치를 건너뛰는 빌드 오염 위험, (2) backend runner Docker 이미지에 devDependencies 가 그대로 적재되는 공격 표면 증가 (명시적 defer), (3) playwright e2e 컨테이너에 레포 루트 전체가 마운트되는 파일시스템 노출 범위 확대가 가장 유의미한 경고 수준 발견이다. undici 버전-레인지 override 및 `outputFileTracingRoot` 확장은 현재 검증(로컬 e2e 205 passed)으로 기능상 확인되었으나 명시적 검증 증적이 부재한 INFO 수준이다.

## 위험도

MEDIUM
