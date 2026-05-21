# 아키텍처(Architecture) 코드 리뷰

> 검토 대상: External Interaction API (PR2) — SDK 패키지 + Frontend i18n 변경
> 검토 파일: 14개 (codebase/packages/sdk/src/*, codebase/frontend/src/lib/i18n/dict/ko/triggers.ts, plan/complete/external-interaction-api.md, review/consistency/*)

---

## 발견사항

### [INFO] SDK 패키지 구조 — Facade 패턴 적절히 적용
- 위치: `codebase/packages/sdk/src/client.ts`
- 상세: `ClemvionClient` 는 외부 API 표면(triggerWebhook / interact / subscribeToExecution 등)을 단일 Facade 클래스로 감싸고 있다. 내부 HTTP/SSE 세부 사항이 호출자에게 노출되지 않는 구조로, EIA spec §4~§5 의 "facade" 원칙을 SDK 레이어에서도 충실히 따른다. 모듈 경계가 명확하다.
- 제안: 없음.

### [INFO] 모듈 분리 — client.ts / signature.ts 책임 분리 양호
- 위치: `codebase/packages/sdk/src/client.ts`, `codebase/packages/sdk/src/signature.ts`
- 상세: HTTP 클라이언트 로직(`client.ts`)과 HMAC 서명 검증 로직(`signature.ts`)이 파일 단위로 분리되어 있다. 단일 책임 원칙(SRP)을 준수하며, 외부 시스템이 클라이언트 없이 서명 검증만 사용하는 경우(`import { verifyNotificationSignature } from '@workflow/sdk'`)를 독립적으로 지원할 수 있다.
- 제안: 없음.

### [WARNING] ClemvionClient 내부 SSE 구현 — 단일 클래스의 책임 과부하
- 위치: `codebase/packages/sdk/src/client.ts` (L1101~L1166, `subscribeToExecution`)
- 상세: `ClemvionClient` 클래스가 HTTP REST 호출(triggerWebhook, interact, cancel 등)과 SSE 스트림 파싱(`subscribeToExecution` 내부 ReadableStream + TextDecoder + SSE frame 파싱 루프)을 모두 담당한다. SSE 연결 관리는 별도의 `SseStream` 또는 `EventStreamReader` 클래스로 분리할 수 있으며, 이렇게 하면 SRP 를 더 엄격히 준수하고 향후 자동 재연결 정책 추가 시 변경 범위를 최소화할 수 있다. 현재 구현에서 `subscribeToExecution` 은 376줄짜리 파일에서 65줄 가량을 차지하며, HTTP 호출 메서드들과 서로 다른 추상화 수준이 혼재한다.
- 제안: `SseStreamReader` 내부 클래스 또는 독립 함수로 분리해 `subscribeToExecution` 에서 위임. `parseSseFrame` 은 이미 모듈 레벨 함수로 분리된 점은 양호.

### [WARNING] SSE 자동 재연결 미지원 — 확장성 갭
- 위치: `codebase/packages/sdk/src/client.ts` L1096~L1100 (JSDoc 주석)
- 상세: 주석에서 "v1 에서 자동 재연결 미지원 — 호출자가 직접 재연결" 이라 명시되어 있다. `SseSubscription` 인터페이스에 `lastSeq` 가 노출되어 있어 외부에서 재연결이 가능하지만, `subscribeToExecution` 의 시그니처에 재연결 로직이 포함되지 않은 채 남겨두면 소비자 코드마다 재연결 패턴이 중복 구현된다. 이는 SDK 의 목적(복잡한 재연결 로직을 내부화)에 반하는 설계 방향이다. 현재는 v1 이므로 허용 가능하지만, 인터페이스 설계 시 재연결 옵션을 `handlers` 파라미터에 `reconnect?: boolean | { maxRetries?: number; delayMs?: number }` 형태로 예약해 두는 것이 향후 확장성에 유리하다.
- 제안: `handlers` 옵션 객체에 `reconnect` 예약 필드를 `never` 타입으로 라도 추가해 API 표면 변경 없이 v2 에서 활성화할 수 있도록 확장점을 보유.

### [WARNING] SSE 에서 Bearer 토큰을 Query String 으로 전달 — 보안 아키텍처 우려
- 위치: `codebase/packages/sdk/src/client.ts` L1112~L1114
- 상세: SSE 스트림 URL 에 `?token=<iext_*>` 를 query string 으로 포함한다. 브라우저 `EventSource` 는 커스텀 헤더를 지원하지 않아 불가피한 선택이지만, query string 토큰은 서버 액세스 로그·proxy 로그·Referer 헤더에 노출될 수 있다. spec 에서 이 결정이 문서화되어 있는지(EIA §R3 / §R5) 는 확인 가능하나, SDK 의 `subscribeToExecution` 주석이나 README 에 이 보안 trade-off 를 명시하지 않는다. 소비자가 토큰 노출 위험을 인지하지 못할 수 있다.
- 제안: `subscribeToExecution` JSDoc 또는 README 에 "SSE endpoint 는 token 을 query string 으로 전달하므로 로그에 노출될 수 있음" 을 보안 주의사항으로 명시.

### [INFO] `randomUUID` 의존성 — Node.js `crypto` 모듈 직접 사용
- 위치: `codebase/packages/sdk/src/client.ts` L860
- 상세: `import { randomUUID } from 'crypto'` 로 Node.js 내장 모듈에 직접 의존한다. `tsconfig.json` 의 `"lib": ["ES2020", "DOM"]` 설정과 `"engines": { "node": ">=20.0.0" }` 선언을 감안하면 Node 환경 전제가 명확하다. 그러나 README 에서 "브라우저 환경에서 fetchImpl 주입으로 사용 가능" 이라 설명하면서, 브라우저에서 `crypto` 모듈을 사용하면 런타임 오류가 발생할 수 있다. 브라우저에서는 `globalThis.crypto.randomUUID()` (Web Crypto API, 브라우저 지원 있음) 를 사용해야 한다.
- 제안: `import { randomUUID } from 'crypto'` 대신 `const randomUUID = () => (globalThis.crypto?.randomUUID?.() ?? fallback)` 패턴으로 교체하거나, `ClemvionClientOptions` 에 `uuidImpl` 주입 옵션을 추가해 브라우저 호환성을 보장.

### [WARNING] `parseJsonOrThrow` 의 암묵적 타입 캐스팅 — 타입 안전성 우려
- 위치: `codebase/packages/sdk/src/client.ts` L1179~L1189
- 상세:
  ```ts
  const parsed = (await res.json()) as { data?: T };
  return (parsed.data ?? (parsed as unknown as T));
  ```
  백엔드가 `{ data: ... }` 래퍼를 사용하거나 사용하지 않는 두 가지 경우를 모두 수용하기 위해 `as unknown as T` 이중 캐스팅을 사용한다. 이는 실제 응답 shape 이 `T` 와 다를 경우 런타임 오류가 아닌 undefined 접근으로 조용히 실패하는 취약점이 있다. 동일 패턴이 `triggerWebhook` 에서도 반복된다(L1019~L1021). API 응답 shape 의 불일치는 SDK 수준에서는 schema validation 보다 "신뢰하되 명세화" 가 일반적이지만, 최소한 타입 보호(type guard)나 필수 필드 존재 확인을 추가해 오류를 더 일찍 드러낼 수 있다.
- 제안: `executionId` 같은 필수 필드 존재 여부를 확인하는 최소한의 runtime check 추가. 또는 API 응답이 항상 `{ data: T }` 래퍼를 사용하도록 백엔드 계약을 확정하고 SDK 에서 래퍼 없는 경로를 제거.

### [INFO] 의존성 역전 — fetchImpl 주입으로 테스트 가능성 확보
- 위치: `codebase/packages/sdk/src/client.ts` L888, `codebase/packages/sdk/src/client.spec.ts`
- 상세: `ClemvionClientOptions.fetchImpl` 을 통한 fetch 구현체 주입은 의존성 역전 원칙(DIP)을 SDK 레벨에서 올바르게 적용한 사례다. 테스트에서 `jest.fn()` 으로 fetch 를 대체해 네트워크 의존 없이 단위 테스트가 가능하며, 브라우저·polyfill 환경도 지원한다.
- 제안: 없음.

### [INFO] i18n 키 구조 — 중첩 객체로 도메인 응집도 유지
- 위치: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts`
- 상세: 기존 `triggers` 객체의 flat 키 구조와 달리, `externalInteraction` 키를 중첩 객체로 추가했다. 도메인 경계가 명확해 `notification` 과 `interaction` 두 채널의 라벨이 논리적으로 분리된다. 향후 EN 사전 파일에도 동일 구조가 적용되어야 parity 가 유지된다(i18n-userguide.md Principle 1 요구사항).
- 제안: 없음 (i18n 구조 자체는 적절). 단 EN 사전 파일(`dict/en/triggers.ts`)의 대응 키 추가가 본 변경에 포함되지 않았다면 별도 확인 필요.

### [INFO] package.json — 외부 런타임 의존성 없음 (zero-dependency SDK)
- 위치: `codebase/packages/sdk/package.json`
- 상세: `"dependencies": {}` — 런타임 의존성이 없다. Node 내장 `crypto` 와 전역 `fetch` 만 사용하므로 패키지 크기가 최소화되고 의존성 충돌 위험이 없다. 외부 SDK 설계에서 바람직한 패턴이다.
- 제안: 없음.

### [INFO] tsconfig.json — module: commonjs vs ESM 이중 빌드 부재
- 위치: `codebase/packages/sdk/tsconfig.json`
- 상세: `"module": "commonjs"` 로만 빌드된다. 현대 ESM-only 프로젝트(예: Next.js 13+, Vite 등)에서 CJS 전용 패키지를 사용할 때 `require()` 호환 문제가 발생할 수 있다. 단기적으로는 Node.js 서버 SDK 용도이므로 CJS 로 충분하지만, `package.json` 에 `"exports"` 필드를 추가해 ESM/CJS 조건부 진입점을 정의하면 확장성이 향상된다.
- 제안: 즉시 수정 불필요. 향후 브라우저·ESM 환경 지원 시 `tsconfig.esm.json` + dual build 추가를 follow-up 으로 등록.

---

## 요약

이번 변경의 아키텍처적 핵심은 `@workflow/sdk` 패키지 신설이다. 전체적으로 Facade 패턴, 의존성 주입(fetchImpl), 책임 분리(client.ts / signature.ts)가 잘 적용되어 있으며 외부 SDK 로서의 경계가 명확하다. 주요 우려사항은 세 가지다. 첫째, `subscribeToExecution` 이 SSE 스트림 파싱·연결 관리를 직접 담당해 클라이언트 클래스의 책임이 과부하 상태이며, 자동 재연결 미지원이 인터페이스 설계 차원에서 확장 갭으로 남는다. 둘째, `import { randomUUID } from 'crypto'` 는 README 에서 지원을 암시하는 브라우저 환경에서 런타임 오류를 유발할 수 있어 브라우저 호환성 보장이 필요하다. 셋째, `as unknown as T` 이중 캐스팅 패턴이 API 응답 불일치를 조용히 삼킬 위험이 있다. i18n 변경은 도메인 응집도를 유지하는 적절한 구조이며, 백엔드 아키텍처 관점(R10 단일 sink, EIA-RL-04 commit 후 emit)의 주요 결정은 이미 consistency check 를 통해 식별되고 plan 에 반영된 상태다.

## 위험도

LOW

STATUS=success
