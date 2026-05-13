## 발견사항

### **[WARNING]** 토큰 갱신 동시 요청 경쟁 조건 — 검증 필요

- **위치**: `cafe24-api.client.ts` (diff 생략됨), `cafe24-api.client.spec.ts`의 `__resetCafe24LocksForTesting` import
- **상세**: `__resetCafe24LocksForTesting`이 exported되는 것은 모듈 수준의 갱신 락 (`Map<integrationId, Promise>`) 이 존재함을 강하게 시사한다. 그러나 전체 구현이 diff에서 생략되어 실제로 올바르게 구현됐는지 확인 불가. 동일 Integration을 공유하는 여러 워크플로 실행이 동시에 토큰 만료 60초 이내를 감지하면, 락 없이는 이중 refresh 요청 → `invalid_grant` 오류가 발생한다.
- **제안**: `cafe24-api.client.ts`에서 per-integrationId 프로미스 체인 방식(`Map<string, Promise<Tokens>>`)으로 직렬화되는지 반드시 확인. `__resetCafe24LocksForTesting`은 테스트 격리를 위한 올바른 패턴이므로, 구현이 존재한다면 설계는 적합하다.

---

### **[WARNING]** Rate Limit 429 재시도 — 동시 요청 쏠림 미완화

- **위치**: `cafe24-api.client.spec.ts:224–240` ("retries on 429 with sleep")
- **상세**: 여러 동시 요청이 동시에 429를 받으면 모두 `max(call_remain_secs, time_remain_secs) * 1000ms`를 sleep한 뒤 동시에 재시도한다. Cafe24의 call limit(`x-api-call-limit: "5/40"` 형태)은 분당 총량이므로, 동시 재시도가 다시 429를 유발하는 thundering herd 패턴이 된다.
- **제안**: 재시도에 `Math.random() * 500` 수준의 jitter를 추가하거나, per-mall_id 요청 큐를 통해 직렬화하는 것을 고려.

---

### **[INFO]** `Cafe24McpToolProvider` 인메모리 세션 상태 — Node.js 단일 스레드로 안전

- **위치**: `cafe24-mcp-tool-provider.spec.ts:244–259` ("CAFE24_MCP_NO_SESSION"), `cafe24-mcp-tool-provider.ts` (diff 생략)
- **상세**: `buildTools`가 `executionId` 키로 세션 상태를 `Map`에 저장하고 `matches()`와 `cleanup()`이 이를 참조하는 구조다. NestJS의 singleton DI에서 여러 동시 실행이 같은 provider 인스턴스를 공유하지만, Node.js 이벤트 루프가 단일 스레드이므로 `Map` 읽기/쓰기는 원자적이다. 안전하다.
- **단, 주의할 점**: SID는 `integrationId.substring(0, 8)` 기반으로 생성되므로, 동일 실행 내에서 UUID 앞 8자가 일치하는 두 Cafe24 Integration이 있으면 SID가 충돌한다. UUID 충돌 확률은 낮지만 이론적으로 가능하다.

---

### **[INFO]** OAuth State 소비 — DB 수준 원자성으로 안전

- **위치**: `V041__integration_oauth_state_provider_meta.sql`, `integration-oauth-state.entity.ts`
- **상세**: callback 소비 시 DELETE-RETURNING을 사용하는 것이 주석에 명시되어 있다. PostgreSQL에서 이는 원자적이므로 같은 state 토큰을 두 요청이 동시에 소비하려 해도 한 쪽만 성공한다. TTL 10분 + DELETE-RETURNING 조합은 correct하다.

---

### **[INFO]** 프론트엔드 동시성 — 해당 없음

- **위치**: `new/page.tsx`, `mcp-server-selector.tsx`, `integration-configs.tsx`
- **상세**: React 컴포넌트는 단일 브라우저 탭 내 단일 스레드이며, `useMutation`과 `useQuery`는 React Query가 중복 요청을 dedupe하므로 동시성 문제 없음.

---

## 요약

동시성 측면에서 가장 주목할 지점은 **Cafe24 토큰 갱신 직렬화**와 **429 재시도 thundering herd** 두 가지다. 전자는 `__resetCafe24LocksForTesting`의 존재로 per-integration 락이 구현된 것으로 추정되나 full diff 부재로 검증 불가하고, 후자는 jitter 없이 동일 슬립 후 동시 재시도하는 구조가 남아 있다. OAuth state의 DB 원자성, `Cafe24McpToolProvider`의 executionId 격리는 Node.js 단일 스레드 모델 하에서 안전하게 설계되어 있다. 전반적으로 동시성 설계 방향은 올바르나, 토큰 갱신 락 구현 확인과 rate limit 재시도 jitter 추가가 권장된다.

## 위험도

**MEDIUM**