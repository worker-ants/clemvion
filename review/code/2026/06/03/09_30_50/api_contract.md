# API 계약(API Contract) 리뷰 결과

## 리뷰 대상

- `codebase/backend/src/nodes/data/code/code.handler.ts`
- `codebase/backend/src/nodes/data/code/code.schema.ts`
- `codebase/backend/src/nodes/data/code/code.handler.spec.ts`
- `codebase/backend/src/nodes/data/code/code.schema.spec.ts`

## 발견사항

본 변경은 HTTP REST 엔드포인트가 아닌 Code 노드 sandbox의 내부 실행 계약(sandbox API surface)을 다룬다. "API 계약" 관점은 이 내부 계약 — 즉 사용자 코드가 sandbox 안에서 바라보는 주입 변수·반환 구조·에러 형식 — 에 적용한다.

### 1. 하위 호환성

- **[INFO]** `$node` 및 `$helpers` 는 신규 추가 주입이므로 기존 사용자 코드가 이 이름을 변수로 선언해 사용했을 경우 새 주입값이 그 선언을 덮어쓴다.
  - 위치: `code.handler.ts` `buildSandbox` 함수, `$node` / `$helpers` 주입
  - 상세: sandbox 변수 주입은 최외곽 context 에서 이루어지며 사용자 코드 내 `const $node = ...` 선언은 블록 스코프로 덮어쓸 수 있다. 단, `$helpers` / `$node` 는 `$` 접두어 컨벤션이 이미 `$input` / `$vars` / `$execution` 에서 확립된 네이밍이고 사용자가 같은 이름으로 변수를 선언하는 것은 convention 위반이므로, 실질적 breaking change 가능성은 낮다.
  - 제안: 사용자 문서·hint 문자열(이번 변경에 이미 포함)로 예약 변수 목록을 명시하는 것으로 충분. 추가 조치 불필요.

- **[INFO]** `setTimeout` / `setInterval` / `setImmediate` 를 `undefined` 로 명시 셰도잉함으로써 기존에 이 타이머를 사용하던 사용자 코드가 `is not a function` 에러 대신 `undefined` 참조로 달라질 수 있다.
  - 위치: `code.handler.ts` 라인 829–831 (shadowing 블록)
  - 상세: vm context 는 원래 타이머를 노출하지 않으므로 기존 코드에서 타이머를 성공적으로 사용하는 것 자체가 불가능했다. 에러 타입이 `ReferenceError` 에서 `TypeError: ... is not a function` 으로 바뀔 수 있으나, 어차피 에러 코드는 `CODE_EXECUTION_FAILED` 로 동일하게 정규화된다. 실질 breaking change 아님.
  - 제안: 현재 처리 적절함.

### 2. 버전 관리

- **[INFO]** Code 노드 sandbox API 에 새 주입 변수(`$node`, `$helpers`)가 추가됐으나 별도 버전 필드나 capability negotiation 메커니즘이 없다.
  - 위치: `code.schema.ts` `codeNodeMetadata`
  - 상세: 내부 sandbox API 이므로 HTTP API 버전 관리와 다른 레이어다. `spec §1/§2.1/§2.2` 에서 이미 약속된 기능을 구현한 것이므로 버전 bump 보다는 spec 정합화 성격이 강하다. 현재 아키텍처에서 노드 타입 버전 관리 메커니즘이 존재하지 않는 것은 이 변경의 범위 밖이다.
  - 제안: 이 변경 자체로는 조치 불필요. 장기적으로 노드 스키마 버전 관리 필요 시 별도 이슈로 추적 권장.

### 3. 응답 형식

- **[INFO]** 에러 응답의 `output.error.details.legacyCode` 필드가 내부 구현 상세(`EXECUTION_TIMEOUT`, `CODE_RUNTIME_ERROR`)를 노출한다.
  - 위치: `code.handler.ts` `failure` 메서드, 라인 995 (`legacyCode: errorCode`)
  - 상세: 이 변경에서 직접 도입된 것은 아니나, `$helpers` / `$node` 주입 후에도 정규화 전 내부 코드가 `details.legacyCode` 에 그대로 노출된다. 클라이언트가 `legacyCode` 를 파싱해 분기 처리한다면 내부 코드 변경 시 계약 위반이 된다.
  - 제안: `legacyCode` 를 `output.error.details` 에서 제거하거나, 문서상 "내부 디버그 전용, 파싱 금지"를 명시. 이 PR 범위 밖이면 별도 이슈 등록 권장.

- **[INFO]** `$helpers.crypto.hash` 는 `algorithm` 파라미터를 사용자가 자유롭게 지정할 수 있다. `createHash` 에 유효하지 않은 알고리즘이 전달되면 Node.js 레이어에서 `Error` 가 발생하며 이 에러는 `CODE_EXECUTION_FAILED` 로 포장되어 반환된다.
  - 위치: `code.handler.ts` `buildHelpers` 함수, `crypto.hash`
  - 상세: 에러 경로는 기존 handler 의 try/catch 로 정상 처리되므로 계약 위반은 아니다. 다만 `algorithm` 유효성 검증 없이 host realm 에서 실행되어 stack trace 에 Node.js 내부 경로가 노출될 수 있다.
  - 제안: `createHash` 호출 전 알고리즘 화이트리스트 검사(`sha256`, `sha512`, `md5` 등) 또는 try/catch 래핑 추가 고려. 현재 에러는 sandbox 밖에서 발생하지만 `failure()` 메서드에 의해 정상 포장되므로 계약 파괴는 없음.

### 4. 에러 응답

- **[INFO]** `output.error.code` 의 정규화 매핑이 `failure()` 메서드 내 조건문에 하드코딩되어 있다.
  - 위치: `code.handler.ts` 라인 989–994 (`normalizedCode` 분기)
  - 상세: 현재 3가지 코드(`EXECUTION_TIMEOUT` → `CODE_TIMEOUT`, `CODE_RUNTIME_ERROR` → `CODE_EXECUTION_FAILED`, 그 외 그대로)만 처리한다. `$helpers` 함수에서 발생하는 새로운 에러 유형이 추가될 경우 매핑이 누락될 수 있다. 이번 변경으로 실질적으로 새 에러 코드가 추가되지는 않으나 `buildHelpers` 확장 시 계약 확장에 유의 필요.
  - 제안: 에러 코드 카탈로그를 상수로 분리하고 `normalizedCode` 분기를 map 객체로 리팩터. 현재는 정상.

### 5. 요청 검증

- **[WARNING]** `timeout` 필드의 범위 검증 책임이 두 곳(`codeNodeConfigSchema` zod 스키마와 `validateCodeConfig` 함수)으로 분산되어 있다.
  - 위치: `code.schema.ts` 전체
  - 상세: zod 스키마의 `z.number().default(30)` 은 타입만 선언하고 min/max 는 `.meta()` UI 힌트에만 있다. 실제 범위 강제는 `validateCodeConfig` 가 담당한다. 이 의도적 분리는 주석으로 명시되어 있으나, 미래 개발자가 zod 스키마에 `.min(1).max(120)` 을 추가하거나 `validateCodeConfig` 를 삭제하면 이중 검증 또는 검증 누락이 발생한다. 현재 구현에서는 `handler.validate()` 가 `evaluateMetadataBlockingErrors` → `validateCodeConfig` 를 경유하므로 검증 자체는 동작한다.
  - 제안: 두 SoT 의 관계를 더 명확히 문서화(현재 주석이 있으나 분산). zod `.superRefine()` 으로 통합하거나, 현재 구조를 유지한다면 `validateCodeConfig` 를 호출하는 코드패스를 통합 테스트로 커버.

### 6. URL/경로 설계

해당 없음 (HTTP 엔드포인트 변경 없음).

### 7. 페이지네이션

해당 없음.

### 8. 인증/인가

- **[INFO]** sandbox API (`$helpers.crypto.hash`, `$helpers.crypto.uuid`, `$helpers.base64`) 는 코드 노드를 실행하는 사용자라면 누구나 사용 가능하다. 이는 의도된 설계이며, 실제 host realm 접근이 아닌 클로저 기반이므로 권한 escalation 우려 없음. 인증/인가 관점 추가 조치 불필요.

## 요약

이번 변경은 HTTP REST API 계약이 아닌 Code 노드 sandbox 내부 API surface(실행 계약)를 대상으로 한다. `$node` / `$helpers` 주입은 spec 에서 이미 약속된 기능을 구현한 것으로 기존 사용자 코드에 대한 실질적 breaking change 는 없다. 에러 정규화 구조(`output.error.{code, message, details}`)는 기존 컨벤션을 준수하며 일관성이 있다. 주목할 점은 `timeout` 검증 책임이 의도적으로 zod 스키마와 `validateCodeConfig` 로 분산된 구조로, 현재는 주석으로 명시되어 있으나 미래 유지보수 시 혼선 가능성이 있다. `output.error.details.legacyCode` 로 내부 코드가 노출되는 점은 이번 변경에서 직접 도입된 것은 아니지만, 클라이언트 계약 관점에서 장기적으로 정리가 필요하다.

## 위험도

LOW
