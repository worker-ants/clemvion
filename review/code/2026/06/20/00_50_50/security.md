# 보안(Security) 리뷰 결과

## 발견사항

### 의존성 보안

- **[INFO]** `js-yaml` moderate 취약점 미해소 — accept 결정
  - 위치: `package.json` `pnpm.overrides` / 커밋 메시지 "잔여 js-yaml moderate = accept"
  - 상세: `pnpm audit 0 high·0 critical` 이지만 js-yaml moderate 취약점이 잔존한다. moderate 는 즉각 차단 수준은 아니나, js-yaml 이 yaml 파싱에 쓰이는 라이브러리라 임의 코드 실행(Prototype Pollution 계열) CVE 가 존재하는 경우 accept 결정에 명시적 CVE 번호와 영향 범위 분석이 없어 추적성이 부족하다.
  - 제안: accept 결정을 `package.json` 주석 또는 별도 security-accept 문서에 CVE ID 와 "이 프로젝트에서의 js-yaml 사용 경로가 공격자 입력과 교차하지 않음" 근거를 기록한다.

- **[INFO]** `@nestjs/swagger 11.2.7` exact 핀 — 구버전 유지
  - 위치: `package.json` `pnpm.overrides["@nestjs/swagger": "11.2.7"]`
  - 상세: 이 버전이 마이그레이션 편의로 고정되어 있으나, 11.2.x 와 11.4.x 사이에 보안 수정이 포함되어 있을 수 있다. deep-import 경로 정리가 별도 PR 로 예정되어 있으나 일정이 확정되지 않았다.
  - 제안: `@nestjs/swagger` changelog 에서 11.2.7 → 11.4.x 간 보안 수정 여부를 확인하고, 있다면 deep-import 정리를 우선순위화한다. 없다면 현 상태 유지 가능.

- **[INFO]** `undici@>=7.0.0 <7.28.0` 취약 범위를 `^7.28.0` 으로 강제 — 적절
  - 위치: `package.json` `pnpm.overrides["undici@>=7.0.0 <7.28.0": "^7.28.0"]`
  - 상세: frontend 의 transitive `undici` 7.x 취약 버전에 대한 override 가 올바르게 구성되었다. backend 의 직접 의존 `^6` 은 별개 범위라 영향 없음.
  - 제안: 이상 없음.

### 의존성 공급망 보안 (Supply Chain)

- **[WARNING]** `onlyBuiltDependencies` 허용 목록 — lifecycle 스크립트 실행 허용 범위 검토 필요
  - 위치: `package.json` `pnpm.onlyBuiltDependencies` (lines 2476-2482)
  - 상세: pnpm v10 이 기본 차단하는 lifecycle 빌드 스크립트를 `isolated-vm`, `bcrypt`, `esbuild`, `@swc/core`, `@tailwindcss/oxide` 에 대해 허용한다. 이 목록은 공급망 공격 표면이다. 특히 `esbuild`, `@swc/core`, `@tailwindcss/oxide` 는 devDependency 로서 빌드 툴인데 네이티브 컴파일이 정당하지만, 이 목록이 향후 확장될 때 검증 없이 임의 패키지가 추가될 위험이 있다.
  - 제안: `onlyBuiltDependencies` 목록 변경 시 PR 설명에 추가 사유를 의무화하는 lint 또는 코드 리뷰 게이트를 두는 것을 권고한다. 현재 목록 자체는 합리적이다.

### Docker / 컨테이너 보안

- **[WARNING]** backend runner 스테이지 — devDependencies 포함 이미지
  - 위치: `codebase/backend/Dockerfile` runner 스테이지 주석 "(devDeps 까지 포함 — 이미지 크기 최적화는 후속 과제)"
  - 상세: 이전 구현은 `npm prune --omit=dev` 로 devDependencies 를 제거하고 최소 파일만 runner 에 복사했다. 현재 변경은 `COPY --from=builder /app ./` 로 전체 workspace 를 복사하므로, `typescript`, `eslint`, `jest`, `ts-jest` 등 devDependencies 가 프로덕션 이미지에 포함된다. 이는 (a) 공격 표면 확대(TypeScript 컴파일러 등을 통한 원격 코드 실행 체인 가능성), (b) 이미지 내 소스 코드 노출 위험을 높인다.
  - 제안: pnpm workspace 에서 devDeps 만 제거하려면 `pnpm deploy` 명령(pnpm 전용 prune + copy)을 사용하거나, builder 스테이지에서 `pnpm --filter backend --prod deploy /app/deploy` 후 runner 에 `/app/deploy` 만 복사하는 방식으로 최소화한다. "후속 과제"로 남기는 것은 보안 관점에서 위험 수용이므로 tracking issue 를 명시하고 릴리즈 전 해소를 권고한다.

- **[INFO]** frontend runner 스테이지 — standalone 출력만 복사, devDeps 없음
  - 위치: `codebase/frontend/Dockerfile` runner 스테이지
  - 상세: `next build --output standalone` 의 standalone 디렉터리만 복사하므로 프로덕션 이미지에 devDependencies 가 포함되지 않는다. backend 와 달리 이 부분은 올바르게 처리되어 있다.
  - 제안: 이상 없음.

- **[INFO]** `corepack enable` 이 Dockerfile 내 root 유저로 실행
  - 위치: `codebase/backend/Dockerfile` line 1128, `codebase/frontend/Dockerfile` line 1494
  - 상세: `corepack enable` 이 root 로 실행되는 것은 빌드 단계(deps/builder 스테이지)에서 이뤄지며, runner 스테이지에서는 `USER node` 로 전환한다. 빌드 이미지의 root 실행 자체는 Docker 레이어 빌드의 일반적 패턴이므로 허용 가능하다.
  - 제안: 이상 없음.

### CI/CD 보안

- **[INFO]** GitHub Actions — `pnpm/action-setup@v4` 사용, 버전 고정
  - 위치: `.github/workflows/frontend-checks.yml`, `web-chat-checks.yml`
  - 상세: `pnpm/action-setup@v4` 가 major 버전 태그로 고정되어 있다. SHA 핀이 아닌 버전 태그 핀은 해당 태그가 강제 push 될 경우 공급망 공격에 노출될 수 있다. 단, 이는 기존 `actions/checkout@v5`, `actions/setup-node@v6` 도 동일한 패턴이므로 이 PR 에서 새로 도입된 문제가 아니라 기존 위험과 동일 수준이다.
  - 제안: 보안 강화가 필요하다면 모든 Action 을 SHA 핀(`pnpm/action-setup@<SHA>`)으로 고정하는 것을 별도 PR 로 검토한다.

- **[INFO]** e2e playwright runner — `- ./:/app` 호스트 전체 마운트
  - 위치: `docker-compose.e2e.yml` line 2239
  - 상세: playwright runner 컨테이너에 레포 루트 전체(`./:/app`)를 마운트한다. 이는 `.env` 파일을 포함한 호스트의 민감 파일이 컨테이너 내부에서 접근 가능함을 의미한다. playwright 테스트 코드가 파일시스템을 탐색하거나 외부에서 주입된 테스트가 실행될 경우 자격증명이 누출될 수 있다.
  - 제안: 테스트에 필요한 최소한의 디렉터리만 마운트하는 방식을 검토한다(예: `./codebase/frontend:/app/codebase/frontend` + 패키지별 mount). 단, pnpm workspace 구조상 루트 mount 없이는 `pnpm install` 이 불가능하고 `.env` 는 `.gitignore` 대상이므로 실제 CI 환경에서는 위험이 낮다. 로컬 개발 환경에서 `.env` 가 레포 루트에 있다면 주의가 필요하다.

### 하드코딩된 시크릿

- **[INFO]** 시크릿 하드코딩 없음
  - 위치: 전체 변경 파일
  - 상세: 검토 대상 파일(Dockerfile, docker-compose, package.json, CI yml, shell script) 어디에도 API 키, 비밀번호, 토큰이 하드코딩되어 있지 않다. `NEXT_PUBLIC_*` 빌드 인수는 더미 값임을 명시하고 있고, `.env` 파일은 `env_file:` 참조로 외부 주입된다.
  - 제안: 이상 없음.

### 인증/인가 및 입력 검증

- **[INFO]** 이 PR 은 패키지 매니저 전환 및 빌드 인프라 변경으로, 인증/인가 로직이나 사용자 입력 처리 코드를 직접 변경하지 않는다. 인젝션, XSS, LDAP, 경로 탐색 등 런타임 취약점 패턴은 이 변경에서 발견되지 않는다.

---

## 요약

이번 변경은 npm 에서 pnpm workspace 로의 패키지 매니저 전환이다. 보안 측면에서 새로운 critical 취약점은 도입되지 않았으며, 기존 보안 override(`undici`, `ws`, `form-data` 등)가 루트 `package.json` 의 `pnpm.overrides` 로 올바르게 통합되었다. 가장 주목할 위험은 backend Dockerfile runner 스테이지가 devDependencies 를 포함한 전체 workspace 를 복사함으로써 프로덕션 이미지 공격 표면이 이전보다 확대된 점이다. 이 문제는 커밋 주석에 "후속 과제"로 명시되어 있으나, tracking issue 없이 남겨둘 경우 장기 미해소 위험이 있다. js-yaml moderate 취약점의 accept 결정과 `onlyBuiltDependencies` 목록 관리는 경미한 추적성 개선이 필요하다.

---

## 위험도

LOW
