### 발견사항

**[WARNING] `handleCallback` — null `providerMeta` 역방향 호환성 미검증**
- 위치: `integration-oauth.service.cafe24.spec.ts`, `handleCallback` describe 블록
- 상세: 기존 state row에 `providerMeta`가 `null`인 경우(마이그레이션 전 생성된 row, 또는 google/github 흐름) `handleCallback`이 어떻게 처리하는지 테스트가 없음. 컬럼이 `nullable`이므로 콜백 코드가 null guard를 누락하면 런타임 crash 가능.
- 제안: `providerMeta: null`인 state row로 `handleCallback` 호출 시 cafe24 경로와 다른 provider 경로 각각 검증하는 테스트 추가

**[WARNING] state 소비 후 row 삭제 검증 없음**
- 위치: `integration-oauth.service.cafe24.spec.ts`, `handleCallback` describe 블록
- 상세: spec 코멘트에 "DELETE-RETURNING on callback consumption"이라고 명시되어 있으나, `handleCallback` 테스트들이 `dataSource.query` 혹은 `delete` 호출 여부를 전혀 assert하지 않음. 상태 row가 실제로 삭제되는지 보장이 없음.
- 제안: `dataSource.query`(DELETE-RETURNING) 또는 `stateRepo.delete` 호출 여부 + 인수 검증 추가

**[WARNING] 컨트롤러 레벨 `providerMeta` 조립 로직에 테스트 없음**
- 위치: `integrations.controller.ts:158–180`
- 상세: `body.service === 'cafe24'`일 때 `mall_id`, `app_type`, `client_id`/`client_secret` 조립 로직이 컨트롤러에 있으나, 이 변경에 대응하는 컨트롤러 테스트가 추가되지 않음. `body.mallId`가 `undefined`일 때 `mall_id: undefined`가 포함된 채 넘어가는 엣지 케이스도 uncovered.
- 제안: `IntegrationsController` spec(또는 e2e)에서 cafe24 `oauthBegin` 엔드포인트 — public/private 앱 양쪽 케이스 + non-cafe24 service에서 `providerMeta: undefined` 케이스 추가

**[WARNING] `__resetCafe24LocksForTesting` — 프로덕션 번들에 테스트 전용 심볼 노출**
- 위치: `cafe24-api.client.spec.ts:9`, `cafe24-api.client.ts` (export)
- 상세: 모듈 레벨 가변 상태(lock map)를 테스트에서 리셋하기 위한 `__resetCafe24LocksForTesting`가 프로덕션 소스에서 export됨. 테스트 간 병렬 실행 시 race condition 위험도 있고, 프로덕션 번들에 불필요한 테스트 인터페이스가 포함됨.
- 제안: lock 상태를 별도 클래스/모듈로 분리하거나, `process.env.NODE_ENV === 'test'` guard 후 조건부 export, 혹은 DI로 추상화

**[WARNING] 동시 토큰 리프레시(locking) 시나리오 미검증**
- 위치: `cafe24-api.client.spec.ts`
- 상세: `__resetCafe24LocksForTesting`의 존재로 보아 per-integration 토큰 refresh lock이 구현된 것으로 보이나, 두 concurrent call이 동일 integration에 대해 동시에 refresh를 시도할 때 lock이 올바로 작동하는지 테스트 없음.
- 제안: 두 `client.call()` 호출을 `Promise.all`로 동시 실행 시 refresh API가 1회만 호출되는지 검증하는 테스트 추가

**[WARNING] 크로스 리소스 operation ID 중복 미검증**
- 위치: `metadata.spec.ts:29–44`
- 상세: "operation ids are unique within each resource"는 검증하나, `Cafe24McpToolProvider`가 `listAllCafe24Operations()`로 전체 op를 열거해 `mcp_<sid>__<op_id>` 형식으로 툴 이름을 만들기 때문에, 서로 다른 리소스에 동일 op ID가 존재하면 툴 이름 충돌 발생. 현재 메타데이터에서는 중복이 없지만 테스트로 보장되지 않음.
- 제안: `listAllCafe24Operations()` 결과에서 `op.id` 전역 중복 검사 테스트 추가

**[WARNING] `Cafe24McpToolProvider.execute` — 알 수 없는 에러 타입 미검증**
- 위치: `cafe24-mcp-tool-provider.spec.ts`
- 상세: `Cafe24AuthFailedError`, `Cafe24RateLimitedError`에 대한 error 변환 테스트는 있으나, `Cafe24TransportFailedError` 및 일반 `Error` 발생 시 동작(에러 코드, `logUsage` 호출 여부)이 uncovered.
- 제안: `Cafe24TransportFailedError` → `CAFE24_TRANSPORT_FAILED`, generic Error → fallback 코드 케이스 추가

**[WARNING] `ai-agent.component.ts` — `cafe24ApiClient` 존재/부재에 따른 provider 등록 순서 테스트 없음**
- 위치: `ai-agent.component.ts`
- 상세: `cafe24ApiClient`가 있을 때 `Cafe24McpToolProvider`가 `McpToolProvider` 앞에 등록되어야 함(코멘트 명시). 없을 때 등록 생략해야 함. 이 ordering 로직에 대한 단위 테스트 없음. 향후 실수로 순서가 바뀌어도 테스트가 잡지 못함.
- 제안: `createHandler`에 mock deps를 주입해 provider 배열 구성 및 순서 검증 테스트 추가

**[INFO] 프론트엔드 `Cafe24ExtraFields` — 컴포넌트 테스트 없음**
- 위치: `frontend/src/app/(main)/integrations/new/page.tsx:586–689`
- 상세: mall_id 정규식(`/^[a-z0-9-]{3,50}$/`)이 프론트엔드에 하드코딩되어 있으나 백엔드와 동기화를 보장하는 테스트 없음. `Cafe24ExtraFields` 컴포넌트(private/public 전환, 필드 노출/숨김)에 대한 React Testing Library 테스트 없음.
- 제안: 프론트엔드 scope 밖이더라도 백엔드 DTO validation regex와 프론트엔드 regex를 단일 상수로 공유하거나, 최소한 양쪽 regex 패턴 문자열 일치 단언 추가

**[INFO] `detect-pending-user-config.ts` — 'cafe24' 추가에 대한 테스트 없음**
- 위치: `detect-pending-user-config.ts:58`
- 상세: `SUPPORTED_INTEGRATION_SERVICE_TYPES`에 `'cafe24'` 추가로 Cafe24 노드가 pending-config 감지 대상이 됐으나, 이를 검증하는 테스트가 없음.
- 제안: `detect-pending-user-config` 관련 테스트에 `serviceType: 'cafe24'` 케이스 추가

**[INFO] `metadata.spec.ts` — throw vs Jest matcher 불일치**
- 위치: `metadata.spec.ts:99–124`, `137–162`
- 상세: `Core categories` 블록에서 `expect(findCafe24Operation(...)).toBeDefined()` 대신 `throw new Error(...)`를 직접 사용. Jest reporter가 fail 위치를 정확히 표시하지 못할 수 있음.
- 제안: `expect(findCafe24Operation(resource, opId)).toBeDefined()` 패턴으로 통일

---

### 요약

백엔드 핵심 레이어(API 클라이언트, MCP 프로바이더, OAuth begin/callback, 메타데이터)는 단위 테스트로 상당히 잘 커버되어 있다. 그러나 OAuth state 소비 시 row 삭제 검증, null `providerMeta` 역방향 호환성, 컨트롤러 레벨 providerMeta 조립 로직, AI Agent provider 등록 순서 등 중요한 갭이 존재하며, `__resetCafe24LocksForTesting`처럼 프로덕션 코드에 테스트 전용 인터페이스가 노출되는 구조적 문제도 있다. 프론트엔드는 주요 컴포넌트(`Cafe24ExtraFields`)와 mall_id 검증 로직에 대한 테스트가 전혀 없어 백엔드와의 유효성 검사 일치 여부를 보장할 수 없다.

### 위험도
**MEDIUM**