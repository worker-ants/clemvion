### 발견사항

---

#### 취약점 (CVE)

- **[CRITICAL]** `protobufjs` 다중 CVE — 코드 인젝션·DoS·Prototype pollution
  - 위치: `codebase/backend/package.json` (간접 dep: `@google/genai`, `@opentelemetry/sdk-node`)
  - 상세: GHSA-66ff-xgx4-vchm (code injection via bytes field default), GHSA-2pr8-phx7-x9h3 (DoS via crafted field name), GHSA-fx83-v9x8-x52w (prototype injection), GHSA-75px-5xx7-5xc7 (prototype pollution gadget), GHSA-jvwf-75h9-cwgg (unsafe option path), GHSA-685m-2w69-288q (unbounded recursion). 설치 버전 `7.5.5` 전부 영향을 받는다. `npm audit fixAvailable: true`.
  - 제안: `npm audit fix` 또는 `overrides.protobufjs`를 취약하지 않은 버전으로 고정. `@google/genai`와 OTel 패키지 각각 최신 버전으로 업데이트.

- **[WARNING]** `@opentelemetry/sdk-node` / `@opentelemetry/auto-instrumentations-node` / `@opentelemetry/exporter-prometheus` — Prometheus DoS (CVSS 7.5 HIGH)
  - 위치: `codebase/backend/package.json` — `@opentelemetry/auto-instrumentations-node: "^0.55.0"`, `@opentelemetry/sdk-node: "^0.205.0"`
  - 상세: GHSA-q7rr-3cgh-j5r3. 악의적 HTTP 요청으로 Prometheus exporter 프로세스 크래시. `@opentelemetry/auto-instrumentations-node@0.55.3`이 내부적으로 오래된 `@opentelemetry/sdk-node@0.57.2`를 당겨오고, 그 아래에 취약한 `@opentelemetry/exporter-prometheus`가 포함된다. Prometheus 엔드포인트를 직접 노출하지 않더라도 패키지가 설치되어 있어 잠재적 공격 면적이 존재한다. fix: `@opentelemetry/auto-instrumentations-node@0.76.0+`, `@opentelemetry/sdk-node@0.218.0+` (semver major bump 필요).
  - 제안: `@opentelemetry/auto-instrumentations-node`를 `^0.76.0`으로 올리고, `@opentelemetry/sdk-node`를 `^0.218.0`으로 함께 업데이트.

- **[WARNING]** `fast-uri` — path traversal · host confusion (CVSS 7.5 HIGH, x2 CVE)
  - 위치: `codebase/backend/package.json` 간접 dep (`@modelcontextprotocol/sdk` → `ajv` → `fast-uri@3.1.0`)
  - 상세: GHSA-q3j6-qgpj-74h6 (퍼센트 인코딩 dot segment path traversal), GHSA-v39h-62p7-jpjc (authority delimiter host confusion). 설치 버전 `3.1.0`는 두 취약점 모두 해당. `npm view fast-uri version`으로 최신판은 `3.1.2`이나, 이 또한 `<=3.1.1` 범위에 해당한다. `fixAvailable: true`.
  - 제안: `codebase/backend/package.json` `overrides`에 `"fast-uri": ">=3.2.0"` 추가. 현재 overrides에 `lodash`, `picomatch` 등은 있으나 `fast-uri`가 누락되어 있다.

- **[WARNING]** `hono` — JWT 검증 오류 · CSS 인젝션 · cross-user 캐시 누수 (MODERATE)
  - 위치: `codebase/backend/package.json` 간접 dep (`@modelcontextprotocol/sdk@1.29.0` → `hono@4.12.16`)
  - 상세: GHSA-hm8q-7f3q-5f36 (NumericDate JWT claim 검증 부적절), GHSA-qp7p-654g-cw7p (JSX SSR CSS 인젝션), GHSA-p77w-8qqv-26rm (Vary header 기반 cross-user 캐시 누수). 직접 사용하지 않는 간접 dep이나 `@modelcontextprotocol/sdk` 업데이트 시 따라 해소된다.
  - 제안: `@modelcontextprotocol/sdk`를 최신 버전으로 업데이트해 hono를 취약하지 않은 버전으로 교체.

---

#### 버전 고정 / 일관성

- **[WARNING]** Playwright docker 이미지(`v1.47.0-jammy`)와 `devDependencies` 버전(`^1.59.1`) 불일치
  - 위치: `docker-compose.e2e.yml` line 169 vs `codebase/frontend/package.json` devDependencies
  - 상세: e2e runner 컨테이너는 `mcr.microsoft.com/playwright:v1.47.0-jammy`를 사용하지만, 실제 프로젝트에 설치된 `@playwright/test`는 `^1.59.1` 해석 결과 최소 `1.59.x` 이상이다. 두 버전 간 12 minor version 차이가 있어 API 불일치·테스트 불안정 위험이 높다. 컨테이너 내부에서 `npm ci`로 재설치하더라도 playwright 브라우저 바이너리와 라이브러리 버전이 이미지 OS에 맞게 번들된 것과 어긋날 수 있다.
  - 제안: docker 이미지를 `mcr.microsoft.com/playwright:v1.59.1-jammy`(또는 현재 lock 파일에 고정된 버전과 정확히 일치하는 버전)로 업데이트하거나, `package.json`에 exact version(`1.47.0`)으로 고정.

- **[WARNING]** `@opentelemetry` 패키지들의 버전 체계 혼재 — 두 개의 `sdk-node` 동시 설치
  - 위치: `codebase/backend/package.json`
  - 상세: 직접 의존 `@opentelemetry/sdk-node@^0.205.0` (설치: `0.205.0`)과, `@opentelemetry/auto-instrumentations-node@0.55.3`이 내부적으로 요구하는 `@opentelemetry/sdk-node@0.57.2`가 동시에 설치된다. OTel의 패키지 versioning scheme이 `0.5x` → `0.2xx`로 전환되는 과정의 부작용이지만, `node_modules`에 두 SDK 인스턴스가 공존해 텔레메트리 초기화가 중복되거나 trace context 전파가 끊길 수 있다. 또한 `@opentelemetry/exporter-trace-otlp-http`도 `0.205.0`(직접 dep)과 `0.57.2`(auto-instrumentations 서브트리) 두 버전이 공존한다.
  - 제안: `@opentelemetry/auto-instrumentations-node`를 `^0.76.0`으로 올리면 최신 `sdk-node@0.218.0` 계열과 통합되어 버전 혼재가 해소된다. 업데이트 후 OTel 초기화 코드를 점검해 이중 등록 여부 확인.

- **[WARNING]** `@dnd-kit/core@^6.3.1` vs `@dnd-kit/sortable@^10.0.0` — major version 불일치
  - 위치: `codebase/frontend/package.json`
  - 상세: `@dnd-kit/sortable@10.0.0`의 `peerDependencies`는 `@dnd-kit/core: "^6.3.0"`을 요구하므로 현재 조합은 peer dep을 충족한다. 그러나 core가 `6.x`에 머무는 반면 sortable이 `10.x`로 큰 major 도약을 한 상태이며, 패키지 목록만 보면 수상한 버전 차이처럼 보인다. 향후 `@dnd-kit/core`의 major 업데이트 시 누락될 위험이 있다.
  - 제안: `@dnd-kit/core`를 sortable@10과 함께 출시된 최신 major 버전으로 정렬 여부 확인. release notes 기준으로 core가 여전히 6.x 최신이라면 현 상태 유지, 아니라면 함께 업데이트.

- **[INFO]** `codebase/packages/expression-engine/package.json`의 `dayjs` 버전이 상위 패키지보다 낮음
  - 위치: `codebase/packages/expression-engine/package.json`
  - 상세: `dayjs: "^1.11.13"` vs codebase/backend/frontend의 `"^1.11.20"`. npm 설치 시 semver range 충족이 가능한 경우 hoisting으로 같은 버전이 공유되지만, file: 링크 방식의 내부 패키지라 분리 설치될 경우 다른 인스턴스가 적재될 수 있다.
  - 제안: `expression-engine/package.json`의 dayjs를 `"^1.11.20"`으로 상향 통일.

- **[INFO]** `react` / `react-dom` exact version 고정 (caret 없음)
  - 위치: `codebase/frontend/package.json`
  - 상세: `"react": "19.2.4"`, `"react-dom": "19.2.4"` — caret(`^`) 없이 exact pin. 패치 보안 수정을 자동으로 못 받는다. React 19.x는 아직 초기 단계로 intentional일 수 있으나 명시적 이유가 없다면 `^19.2.4`로 완화를 권고.
  - 제안: 의도적 exact pin이라면 주석으로 이유 기록. 그렇지 않으면 `"^19.2.4"`로 변경.

---

#### 인프라 의존성

- **[WARNING]** `minio/minio:latest` / `minio/mc:latest` — 태그 미고정
  - 위치: `docker-compose.yml` lines 35, 48, `docker-compose.e2e.yml` lines 32, 48 (추정)
  - 상세: `latest` 태그는 이미지 배포자가 업데이트할 때마다 변경된다. CI 재실행 또는 팀원의 `docker pull` 시 다른 버전을 당겨올 수 있어 재현 불가 빌드 위험이 있다. `postgres`(`pgvector/pgvector:pg18`)와 `redis`(`redis:7-alpine`)는 버전이 명시되어 있어 대조적이다.
  - 제안: `minio/minio:RELEASE.2025-xx-xx...` 형식 또는 특정 date-tagged release로 고정.

---

#### 중복 / 불필요 의존성

- **[INFO]** `cron-parser` 프론트엔드·백엔드 동시 설치 — 공유 패키지 후보
  - 위치: `codebase/frontend/package.json`, `codebase/backend/package.json`
  - 상세: 동일 버전(`^5.5.0`)이 각각 설치된다. `cronstrue`(프론트엔드 전용 — cron 표현식 → 사람 친화적 텍스트 변환)는 프론트엔드 전용이 맞으나, `cron-parser`는 표현식 파싱 로직으로 `expression-engine` 내부로 이전 또는 `node-summary`에 공유 가능.
  - 제안: 지금 당장 리팩토링이 필요한 수준은 아니나, 공유 패키지 의존성 목록에 등재해 관리.

- **[INFO]** `p-limit@7` (pure ESM)을 NestJS CJS 환경에서 사용
  - 위치: `codebase/backend/package.json`, 사용처: `execution-engine`, `mcp-client`, `graph-extraction` 등 5개 파일
  - 상세: `p-limit@7.x`는 `"type": "module"` 순수 ESM 패키지다. 백엔드 tsconfig가 `"module": "nodenext"` + `"esModuleInterop": true`를 사용하므로 현재 빌드는 가능하지만, Jest 테스트 환경에서 `ts-jest`가 CJS 변환을 시도할 때 ESM 패키지 로드 실패가 발생할 수 있다. (5개 사용 파일에 대한 단위 테스트 작성 시 위험)
  - 제안: Jest 설정에 `transformIgnorePatterns` 예외 처리 또는 `p-limit@4.x`(CJS 지원) 사용을 검토. 또는 `Promise.all` + 수동 세마포어로 대체 가능.

---

### 요약

backend `npm audit` 결과 HIGH 5건(OTel Prometheus DoS ×3, fast-uri path traversal/host confusion ×2), MODERATE 2건(protobufjs 다중 CVE, hono JWT·캐시 누수)이 확인되었다. protobufjs는 다중 고위험 CVE(코드 인젝션, prototype pollution, DoS)를 포함해 실질적 위협이 크며, `overrides`로 즉시 패치 가능하다. fast-uri 역시 `overrides`에 버전 고정이 없어 패치가 누락된 상태다. OTel 패키지는 major 전환기의 버전 혼재로 두 개의 `sdk-node` 인스턴스가 공존하며, auto-instrumentations 업데이트로 CVE와 버전 혼재를 동시에 해소할 수 있다. 인프라 측에서는 `minio/minio:latest` 태그 미고정과 Playwright docker 이미지(v1.47.0)와 패키지(^1.59.1) 간 12 minor version 불일치가 재현성과 테스트 신뢰성을 위협한다. frontend는 `npm audit` 취약점 0건으로 양호하며, `@dnd-kit` 버전 조합은 peer dep을 충족한다. 전반적으로 패키지 매니저 규약(npm 전용)은 준수되고 있으며, yarn.lock/pnpm-lock 파일은 존재하지 않는다.

### 위험도

HIGH
