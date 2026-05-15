### 발견사항

---

**[WARNING] `mcp-server-selector.tsx` — 그룹핑 로직이 `MCP_CAPABLE_SERVICE_TYPES` 상수와 비동기화**
- 위치: `mcp-server-selector.tsx:187-226`
- 상세: `MCP_CAPABLE_SERVICE_TYPES = ["mcp", "cafe24"]` 상수를 쿼리 필터에는 참조하지만, 렌더링 그룹 배열은 `"mcp"` / `"cafe24"` 두 항목을 인라인 리터럴로 하드코딩한다. 다음 Internal Bridge 서비스 타입(`shopify` 등)을 추가할 때 상수 파일만 수정해서는 렌더링에 반영되지 않는다 — 이 컴포넌트도 함께 수정해야 함을 컴파일 타임에 강제할 방법이 없다.
- 제안: 그룹 배열을 `MCP_CAPABLE_SERVICE_TYPES`에서 파생하거나, `McpCapableServiceType`을 exhaustive check 대상으로 만들어 타입 시스템이 누락을 감지하도록 구성:

```ts
// McpCapableServiceType 각 값에 대한 레이블 맵을 별도 상수로 관리
const GROUP_LABELS: Record<McpCapableServiceType, string> = {
  mcp: "Generic MCP (HTTP) servers",
  cafe24: "Cafe24 stores (Internal Bridge)",
};
```

---

**[WARNING] `integrations.ts` — 프론트엔드 API 클라이언트에 서비스별 필드 누적 패턴**
- 위치: `integrations.ts` — `beginOAuth` params 타입 확장부
- 상세: `mallId`, `appType`, `clientId`, `clientSecret` 네 개의 Cafe24 전용 필드가 제네릭 OAuth begin 파라미터 타입에 직접 추가됐다. 백엔드의 `OAuthBeginDto` 오염과 동일한 패턴이 프론트엔드 API 클라이언트 레이어에도 확산된다. 다음 provider(Naver, Shopify 등)가 추가될 때마다 이 타입이 계속 확장된다.
- 제안: `providerMeta?: Record<string, unknown>` 단일 필드로 통합하거나, `Cafe24OAuthParams` 인터페이스로 분리한 후 호출부에서 spread:

```ts
beginOAuth(params: OAuthBeginParams & { providerMeta?: Record<string, unknown> })
```

---

**[WARNING] `mcp-capable-service-types.ts` — 프론트엔드-백엔드 상수 이중화의 구조적 취약성**
- 위치: `mcp-capable-service-types.ts:1-12`
- 상세: 파일 자체의 주석이 "두 목록이 함께 움직여야 한다"고 경고하고 있지만, 이를 강제하는 메커니즘이 없다. 백엔드 twin 파일을 수정하면서 이 파일을 누락해도 TypeScript는 물론 테스트도 잡지 못한다. 현재 `as const` 배열이라 exhaustive check도 불가하다.
- 제안: 단기적으로는 두 파일에 `// SYNC: backend/src/modules/integrations/services/mcp-capable-service-types.ts` 주석으로 쌍방 참조를 명시. 중기적으로는 파일 코멘트에 언급된 `/api/integrations/services` 엔드포인트를 통해 단일 진실 소스로 통합.

---

**[INFO] `override-registry.ts` — 레지스트리 패턴 자체는 적절**
- 위치: `override-registry.ts:74+`
- 상세: `OVERRIDE_REGISTRY`에 `cafe24: Cafe24Config` 한 줄 추가로 끝났다. 기존 registry 패턴을 그대로 따르고 있어 구조적 문제 없음.

---

### 요약

이번 프론트엔드 변경에서 직접 확인 가능한 아키텍처 이슈의 핵심은 **상수 단일 진실 소스 미확보**와 **제네릭 인터페이스의 서비스별 오염**이다. `MCP_CAPABLE_SERVICE_TYPES`를 쿼리 필터에는 참조하면서 렌더링 그룹 배열과 분리 관리하는 것은 DRY 원칙 위반으로, 다음 통합 추가 시 silent bug의 진입점이 된다. `integrations.ts`의 DTO 오염은 백엔드의 `OAuthBeginDto` 문제와 완전히 대칭적이며, 이 두 레이어가 함께 `providerMeta` 방향으로 리팩터링되어야 한다. 이미 `RESOLUTION.md`에서 follow-up으로 분류된 W4(상수 단일화)·W6(`providerMeta` 통합) 항목이 이 변경들의 구조적 뿌리이므로, 다음 Internal Bridge 통합 추가 전에 처리하는 것이 권장된다.

### 위험도
**MEDIUM**