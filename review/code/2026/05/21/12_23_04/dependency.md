# 의존성(Dependency) 리뷰 결과

## 발견사항

### 새 의존성

- **[INFO]** `codebase/packages/sdk/package.json` — `dependencies: {}` 로 런타임 외부 의존성 없음
  - 위치: `/codebase/packages/sdk/package.json` line 14
  - 상세: SDK 의 모든 핵심 기능(HMAC 서명, UUID 생성, fetch, AbortController, ReadableStream, TextDecoder)이 Node.js 20+ 표준 내장 모듈(`node:crypto`, `globalThis.fetch`, Web API)로 구현되어 있다. 외부 npm 패키지를 runtime 의존성으로 도입하지 않은 것은 이상적 설계다.
  - 제안: 현 상태 유지.

### 버전 고정 (Pinning)

- **[WARNING]** devDependencies 전체가 caret(`^`) 범위로 지정되어 있고, lockfile(`package-lock.json` 또는 `pnpm-lock.yaml`)이 이번 diff 에 포함되지 않았다
  - 위치: `/codebase/packages/sdk/package.json` lines 15~20
  - 상세: `"jest": "^30.0.0"`, `"@types/jest": "^30.0.0"`, `"ts-jest": "^29.2.5"`, `"typescript": "^5.7.3"` 모두 caret 범위. 이웃 패키지(`expression-engine`, `node-summary`)도 동일 패턴을 쓰므로 이 프로젝트 전체의 관행이다. lockfile 이 workspace root 또는 각 패키지에 커밋되어 있다면 실질 위험은 낮으나, diff 에서 확인되지 않았다.
  - 제안: monorepo 루트 lockfile(또는 각 패키지 lockfile)이 git 에 포함되어 있는지 확인. 누락된 경우 추가 커밋 필요.

- **[WARNING]** `jest ^30.0.0` 과 `ts-jest ^29.2.5` 사이의 메이저 버전 불일치가 있다
  - 위치: `/codebase/packages/sdk/package.json` lines 18, 20
  - 상세: `ts-jest` 의 현재 최신 안정 버전은 29.x 대이며, Jest 30은 2024~2025 년경 출시된 메이저 버전이다. ts-jest 공식 문서에 따르면 ts-jest ^29.x 는 Jest 29를 지원하고, Jest 30 지원은 ts-jest ^30.x 이상이 필요하다. 이웃 패키지(`expression-engine`, `node-summary`)도 동일한 `jest ^30 + ts-jest ^29.2.5` 조합을 사용 중이므로 프로젝트 전체에 이미 존재하는 상황이다. 실제로 빌드/테스트 파이프라인이 통과하고 있다면 호환이 확인된 것이지만, ts-jest 가 Jest 30 API 의 일부를 지원하지 않을 가능성이 있다.
  - 제안: ts-jest 를 `^30.0.0`으로 올리거나, Jest 를 `^29.x` 로 맞추어 메이저 버전을 일치시킨다. 이웃 패키지와 함께 일괄 적용을 권장한다.

### 라이선스

- **[INFO]** `@workflow/sdk` 패키지의 라이선스가 `Apache-2.0` 으로 선언되어 있으나, `backend` 의 라이선스는 `UNLICENSED` (사내 비공개), `frontend` 는 라이선스 필드 없음(확인 불가)이다
  - 위치: `/codebase/packages/sdk/package.json` line 32, README.md line 118
  - 상세: SDK 는 외부 통합용으로 설계된 공개(public) 라이브러리이므로 Apache-2.0 선택 자체는 합리적이다. 그러나 이 SDK 가 내부 `@workflow/*` scope 아래 있고 monorepo 내 다른 패키지들에 라이선스가 선언되지 않았거나 `UNLICENSED` 인 상황에서 Apache-2.0 으로 npm publish 하면, 이 패키지에서 사용하는 Node.js 내장 모듈만 있어 문제 없으나, 추후 내부 패키지를 의존성으로 추가할 때 라이선스 충돌이 생길 수 있다.
  - 제안: SDK 를 외부에 실제로 publish 할 계획이라면 법무 검토 후 라이선스 일관성을 확인. 현재 내부 패키지로만 사용할 경우 큰 문제 없음.

### 취약점

- **[INFO]** 새로 추가된 런타임 외부 패키지가 없으므로 공급망(supply-chain) 보안 취약점 위험 없음
  - 상세: `dependencies: {}` 로 runtime 의존성이 전무하다. devDependencies(`jest`, `ts-jest`, `typescript`, `@types/*`)는 빌드/테스트 시에만 사용되며 배포 아티팩트에 포함되지 않는다.

### 불필요한 의존성

- **[INFO]** `@types/node ^20.0.0` 이 명시되어 있으나 실 사용 모듈(`crypto`, `Buffer`)이 Node.js 20 내장이므로 적절하다
  - 위치: `/codebase/packages/sdk/package.json` line 17
  - 상세: `client.ts` 에서 `import { randomUUID } from 'crypto'`, `signature.ts` 에서 `import { createHmac, timingSafeEqual } from 'crypto'` 와 `Buffer` 를 사용하므로 `@types/node` 가 필요하다. 불필요한 의존성이 아님.

- **[WARNING]** `tsconfig.json` 의 `"lib": ["ES2020", "DOM"]` 에 `DOM` 포함이 불필요할 수 있다
  - 위치: `/codebase/packages/sdk/tsconfig.json` line 5
  - 상세: SDK 는 Node.js 20+ 타겟이며 브라우저 `DOM` API 를 직접 사용하지 않는다. `fetch`, `ReadableStream`, `AbortController`, `TextDecoder` 등은 Node 18+ 부터 global 에 노출되어 있어 `@types/node` 로 커버된다. `DOM` lib 을 포함하면 브라우저 전용 타입과 충돌하거나 불필요한 타입 보강이 일어날 수 있다.
  - 제안: `"lib": ["ES2020"]` 으로 축소하고, fetch 등 Web API 는 `@types/node ^20` 이 제공하는 타입으로 처리. 이웃 패키지(`expression-engine`, `node-summary`)의 tsconfig 를 참조해 일관성 유지.

### 의존성 크기

- **[INFO]** SDK 의 번들 크기 영향은 최소 수준이다
  - 상세: runtime 의존성 없음. 빌드 결과(`dist/`)는 TypeScript 소스 4개 파일(`client.ts`, `signature.ts`, `index.ts`, 스펙 파일 제외)이 CommonJS 로 트랜스파일된 것이므로 수십 KB 이하 예상. 외부 소비자(npm 설치자)가 설치할 시 추가 의존성 트리 없음.

### 호환성

- **[INFO]** `engines: { "node": ">=20.0.0" }` 로 명시되어 있어 적절히 선언되어 있다
  - 위치: `/codebase/packages/sdk/package.json` lines 21~23
  - 상세: `globalThis.fetch` 는 Node.js 18 에서도 실험적으로 지원되지만, 이 SDK 는 Node 20 이상을 명시하여 안정적인 fetch API 를 보장한다.

- **[INFO]** `module: "commonjs"` 로 CJS 전용 빌드이며 ESM 출력이 없다
  - 위치: `/codebase/packages/sdk/tsconfig.json` line 4
  - 상세: 이웃 패키지와 일관된 방식이다. 그러나 외부 npm publish 를 목표로 할 경우, modern Node.js 생태계의 ESM-first 패키지와 상호운용성을 위해 `exports` 필드와 dual CJS/ESM 빌드를 검토할 수 있다. 현재 단계에서는 내부 사용 기준이므로 낮은 우선순위.

### 내부 의존성

- **[INFO]** SDK(`@workflow/sdk`)는 monorepo 내 다른 내부 패키지(`@workflow/expression-engine`, `@workflow/node-summary`)를 의존하지 않는다
  - 상세: 외부 공개 SDK 가 내부 전용 유틸리티를 의존하지 않는 구조는 올바르다. publish 아티팩트가 자체 완결적이다.

- **[INFO]** frontend(`triggers.ts` i18n) 변경은 기존 프론트엔드 i18n 시스템의 단순 키 추가이며 새 의존성을 도입하지 않는다
  - 위치: `/codebase/frontend/src/lib/i18n/dict/ko/triggers.ts`
  - 상세: 기존 `as const` 패턴을 그대로 따르며 외부 i18n 라이브러리를 신규 도입하지 않았다.

---

## 요약

이번 변경의 핵심은 신규 `@workflow/sdk` 패키지 도입이다. SDK 는 runtime 외부 의존성이 전혀 없고, 보안 크리티컬 기능(HMAC 서명·UUID)을 Node.js 내장 `crypto` 모듈로 구현하여 공급망 위험을 원천 차단한 점이 우수하다. 발견된 실질적 위험은 두 가지다: 첫째, `jest ^30.0.0` 과 `ts-jest ^29.2.5` 의 메이저 버전 불일치는 이웃 패키지에도 공통으로 존재하는 문제이며 테스트 실행 안정성에 영향을 줄 수 있다. 둘째, lockfile 이 diff 에 포함되지 않아 재현 가능한 빌드 보장 여부를 확인할 수 없다. `tsconfig.json` 의 `DOM` lib 포함은 Node.js 전용 패키지로서 불필요한 타입 혼입 가능성이 있으나 즉각적인 오동작보다는 유지보수 문제다. 라이선스 측면에서는 외부 공개 예정인 SDK 에 `Apache-2.0` 이 선언되어 있으나 내부 비공개 패키지들과의 라이선스 체계 일관성에 대한 명확한 정책이 필요하다.

## 위험도

LOW

STATUS=success
