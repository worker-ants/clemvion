## 발견사항

---

**[WARNING] `mcp-capable-service-types.ts` — 프론트/백엔드 동기화를 강제하는 테스트 없음**
- 위치: `frontend/src/lib/integrations/mcp-capable-service-types.ts:1-12`
- 상세: 파일 상단 JSDoc이 "Both lists must move together"라고 경고하지만 이를 강제하는 테스트가 없다. 백엔드에 `'shopify'` 등을 추가하고 프론트엔드를 누락해도 CI가 잡지 못한다.
- 제안: `backend/src/modules/integrations/services/mcp-capable-service-types.ts` 를 직접 import해서 값 동일성을 검증하는 테스트 추가. monorepo 구조라면 공유 상수로 단일화하는 것이 더 근본적 해결.

---

**[WARNING] `mcp-server-selector.tsx` — 그룹핑 로직에 대한 단위 테스트 없음**
- 위치: `mcp-server-selector.tsx:192-226`
- 상세: `available.filter(i => i.serviceType === 'mcp')` / `'cafe24'` 로 두 그룹을 나누는 로직에 테스트가 없다. `MCP_CAPABLE_SERVICE_TYPES`에 신규 타입이 추가됐으나 `groups` 배열에는 추가되지 않으면 해당 타입의 integration이 UI에서 조용히 사라진다. 이 소멸 경로를 잡는 테스트가 없다.
- 제안: (a) 한 그룹에만 항목이 있을 때, (b) 두 그룹 모두 비었을 때, (c) `serviceType`이 알 수 없는 값일 때의 렌더 결과를 React Testing Library로 검증.

---

**[WARNING] `mcp-server-selector.tsx` — queryKey 변경에 대한 캐시 무효화 회귀 테스트 없음**
- 위치: `mcp-server-selector.tsx:63-70`
- 상세: `queryKey: ["integrations", "mcp"]` → `["integrations", "mcp-capable"]` 변경은 기존 캐시 무효화 호출(`invalidateQueries`)이 이 컴포넌트에 더 이상 적용되지 않을 수 있다. `testing/review.md`(review 세션)에서도 지적되었듯 grep 결과 현재는 유일 consumer이지만, 미래의 무효화 누락을 방지하는 테스트가 없다.
- 제안: `queryKey`를 컴포넌트 외부 상수로 export하여 무효화 호출 위치와 동일 상수를 공유하도록 만들면 타입 시스템이 미스매치를 방지할 수 있다.

---

**[WARNING] `override-registry.ts` — `cafe24` 키 등록 검증 테스트 없음**
- 위치: `override-registry.ts:74-80`
- 상세: `OVERRIDE_REGISTRY`에 `cafe24: Cafe24Config` 가 추가됐으나 레지스트리에서 `cafe24` 노드 타입을 렌더할 때 올바른 컴포넌트가 반환되는지 검증하는 테스트가 없다. 잘못된 키 이름(예: `cafe_24`, `CAFE24`)으로 등록되어도 컴파일·빌드는 통과한다.
- 제안: 레지스트리 스펙에 `expect(OVERRIDE_REGISTRY['cafe24']).toBe(Cafe24Config)` 단언 추가.

---

**[INFO] `mcp-capable-service-types.ts` — `as const` 타입에 대한 exhaustiveness 테스트 없음**
- 위치: `mcp-capable-service-types.ts:9-11`
- 상세: `McpCapableServiceType`을 소비하는 코드(그룹 헤딩 배열, `filter` 조건 등)가 모든 타입을 빠짐없이 처리하는지 컴파일 타임 exhaustive check나 런타임 테스트가 없다. `groups` 배열의 `key` 필드를 `McpCapableServiceType`으로 강타입 선언하면 TypeScript가 누락을 잡아줄 수 있다.
- 제안: `groups` 배열의 타입을 `Array<{ key: McpCapableServiceType; ... }>` 로 선언하여 새 서비스 타입 추가 시 exhaustive 처리를 컴파일 타임에 강제.

---

**[INFO] `integrations.ts` — `clientSecret` 프론트엔드 전달 경로에 대한 E2E 테스트 없음**
- 위치: `integrations.ts:171-181`
- 상세: `clientSecret` 필드가 API body에 포함되어 전송되는 흐름에 대해, 이 값이 응답 URL이나 로그에 노출되지 않음을 검증하는 E2E 또는 통합 테스트가 없다. `testing/review.md`의 W9 항목과 동일 맥락.
- 제안: `private` 앱 OAuth begin 요청에서 `clientSecret`이 응답 `authUrl`에 포함되지 않음을 검증하는 테스트 추가 (기존 `integration-oauth.service.cafe24.spec.ts`에 `.not.toContain('client_secret')` 단언).

---

## 요약

변경된 6개 파일 중 프론트엔드 코드 변경(주로 `mcp-server-selector.tsx`와 `mcp-capable-service-types.ts`)에 테스트 공백이 집중되어 있다. 가장 위험한 갭은 두 가지다: (1) 프론트/백엔드 `MCP_CAPABLE_SERVICE_TYPES` 상수의 동기화를 강제하는 메커니즘이 주석 외에 없어 신규 서비스 타입 추가 시 조용한 UI 누락이 발생할 수 있고, (2) 그룹핑 로직이 테스트 없이 렌더 경로에 인라인되어 있어 특정 서비스 타입이 어느 그룹에도 속하지 않는 경우를 감지할 수 없다. 백엔드 테스트 갭(OAuth state 삭제 검증, 동시 토큰 리프레시 lock, controller providerMeta 조립 등)은 기존 `testing/review.md`에서 이미 상세히 지적되어 있으며 RESOLUTION.md의 follow-up 항목으로 분리된 상태다.

## 위험도
**MEDIUM**