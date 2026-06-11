# 의존성(Dependency) 리뷰 결과

## 발견사항

### C-1: jsonwebtoken devDeps → deps 이동

- **[INFO]** `jsonwebtoken` 9.0.3 이 devDependencies 에서 dependencies 로 이동됨
  - 위치: `codebase/backend/package.json` L62, `package-lock.json` L35
  - 상세: `interaction-token.service.ts` 가 `jsonwebtoken` 을 직접 import 하는데 기존에 devDependencies 에 선언되어 있었음. `npm prune --omit=dev` (Dockerfile 프로덕션 빌드) 실행 시 `@nestjs/jwt` 의 전이 의존성으로 우연히 해결되던 fragile 상태였음. 이동 후 런타임 의존성으로 명시적으로 선언되어 올바름.
  - 제안: 조치 적절. `@types/jsonwebtoken` 은 devDependencies 에 남아 있어 정상.

- **[INFO]** `jsonwebtoken` 9.0.3 이 버전 고정(exact pin) 으로 선언됨
  - 위치: `package.json` L62 — `"jsonwebtoken": "9.0.3"` (caret 없음)
  - 상세: 다른 런타임 의존성들(예: `mysql2: "^3.22.0"`, `ioredis: "^5.10.1"`)은 caret(`^`) 범위를 사용하는데, `jsonwebtoken` 만 exact pin. JWT 서명/검증에 관여하는 보안 민감 패키지이므로 의도적인 exact pin 은 수용 가능한 선택. 단, 보안 패치 출시 시 수동 업데이트 필요.
  - 제안: 현재 방식(exact pin) 유지 시 보안 패치 대응 절차를 팀이 인지하고 있어야 함. 허용 가능.

- **[INFO]** `jsonwebtoken` 과 `@nestjs/jwt` 의 중복 JWT 처리 경로 잠재적 존재
  - 위치: `package.json` — 양쪽 모두 runtime dependency
  - 상세: `@nestjs/jwt` 는 내부적으로 `jsonwebtoken` 을 래핑하므로 직접 사용은 NestJS 권장 패턴 외부. plan 파일에서 옵션 B(`@nestjs/jwt` JwtService 교체)를 백로그로 기록한 것은 적절한 판단. 현재 버전(9.0.3)은 plan에서 검증 완료.
  - 제안: 장기적으로 `@nestjs/jwt` JwtService 를 통한 단일 경로로 리팩토링 권장(백로그 아이템으로 이미 인지 중).

### C-2: hono override 버전 상향

- **[INFO]** `hono` override 범위가 `^4.12.18` → `^4.12.21` 으로 상향됨
  - 위치: `package.json` L578 (`overrides` 섹션), `package-lock.json` L61–65
  - 상세: 실제 resolve 된 버전은 `4.12.25`. `@modelcontextprotocol/sdk` 전이 의존. CVE 4건(IP restriction / Set-Cookie / JWT middleware / path routing) 이 `>=4.12.21` 에서 패치됨. backend 는 MCP **client** 로만 사용하므로 hono 서버가 기동되지 않아 실노출면 낮으나, override floor 를 패치 버전으로 고정하여 fresh resolve 시 취약 구간(4.11.4–4.12.20) 재유입 차단.
  - 제안: 올바른 조치. 현재 `^4.12.21` 범위는 향후 패치 버전(4.12.x)을 허용하므로 유연성과 보안 사이 균형이 적절함.

- **[INFO]** `chokidar` 와 `readdirp` 의 `devOptional` → `dev` 변경
  - 위치: `package-lock.json` L51–52, L73–74
  - 상세: lock 재생성 과정에서 `chokidar` (4.0.3) 와 `readdirp` (4.1.2) 의 필드가 `devOptional: true` 에서 `dev: true` 로 변경됨. npm lock 내부 메타데이터 변화로, `chokidar` 는 `@angular-devkit/core` 의 optional peer dependency 이고 `readdirp` 는 그 종속. 이 변경은 `npm install` 재실행 결과이며 동작에 영향 없음. `devOptional` 은 dev+optional 조합이었으나, npm v8+ 에서는 `dev: true` + optional peer 로 처리됨.
  - 제안: 무해한 lock 내부 변화. 별도 조치 불필요.

### 불필요한 의존성 여부

- **[INFO]** `jsonwebtoken` 은 `@nestjs/jwt` 전이 의존성과 기능 중복이나, plan 에서 직접 import 사용 근거(interaction-token.service.ts)가 확인됨. 현재 변경 범위 내에서는 불필요하지 않음.

### 라이선스

- `jsonwebtoken` — MIT 라이선스. 프로젝트(UNLICENSED) 와 호환.
- `hono` — MIT 라이선스. 호환.

### 알려진 취약점

- `jsonwebtoken` 9.0.3: npm advisory 기준 알려진 취약점 없음 (9.0.0 에서 정식 패치 완료, 이전 버전들의 CVE-2022-23529 등 해소됨).
- `hono` 4.12.25: override 상향으로 CVE 4건 해소됨. `npm audit --omit=dev` 0 확인됨(plan 체크리스트).

## 요약

이번 변경은 두 가지 의존성 위생 개선으로 구성된다. C-1은 프로덕션 런타임에서 직접 사용되는 `jsonwebtoken` 을 devDependencies 에서 dependencies 로 올바르게 이동시켜 Dockerfile `npm prune --omit=dev` 후의 fragile 전이 의존 상태를 해소하였고, C-2는 `hono` 전이 의존의 override floor 를 CVE 4건이 패치된 `^4.12.21` 로 상향하여 재resolve 시 취약 구간 재진입을 차단하였다. 두 변경 모두 소스 코드 변경 없이 package.json·lock 파일만 수정되었으며, exact pin(`jsonwebtoken: 9.0.3`) 방식은 보안 민감 패키지에 대해 수용 가능한 선택이나 향후 패치 대응 시 수동 업데이트 절차가 필요함을 인지해야 한다. 장기적으로는 `jsonwebtoken` 직접 사용을 `@nestjs/jwt` JwtService 로 통합하는 리팩토링(이미 백로그 인지)이 권장된다.

## 위험도

LOW
