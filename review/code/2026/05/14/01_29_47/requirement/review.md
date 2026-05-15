## 발견사항

### [WARNING] `OAuthBeginDto.mallId` 에 SSRF 방어 정규식 검증 누락
- **위치**: `backend/src/modules/integrations/dto/integration.dto.ts`, `mallId` 필드
- **상세**: 필드 주석에 `Validation /^[a-z0-9-]{3,50}$/` — SSRF 방어 + Cafe24 mall_id 규약이라 명시되어 있지만 `@Matches()` 데코레이터와 `@MinLength(3)`이 없음. 현재 `@IsString()` + `@MaxLength(50)`만 적용되어 있어 `BAD shop!`이나 `ab` 같은 값이 DTO 검증을 통과해 서비스 레이어까지 도달함.
- **제안**: `@Matches(/^[a-z0-9-]{3,50}$/, { message: 'mall_id must be 3–50 lowercase letters, digits, or hyphens' })` + `@MinLength(3)` 추가. SSRF 방어는 DTO에서 먼저 차단해야 함.

---

### [WARNING] `Cafe24Config` 의 `fields` 상태가 첫 편집 후 파괴됨
- **위치**: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx`, `Cafe24Config` 컴포넌트
- **상세**: `const fields = (config.fields as Array<{key, value}>) ?? []` 로 배열로 읽지만, `onChange` 핸들러에서 `fields: obj` (`Record<string, string>`) 형태로 저장함. 사용자가 필드를 한 번 수정하면 `config.fields`가 plain object가 되고, 다음 렌더에서 `fields.map(...)` 호출 시 `TypeError: fields.map is not a function` 런타임 에러 발생. 주석에는 "BOTH the keyvalue list (for UI round-trip) and the resolved object form" 을 저장한다고 설명하지만 실제로는 object form 만 저장됨.
- **제안**: `onChange({ ...config, fields: obj })` 대신 배열 형태도 유지하거나, 읽을 때 object를 array로 역변환하는 로직 추가. 예: `const fields = config.fields instanceof Array ? config.fields : Object.entries(config.fields ?? {}).map(([k, v]) => ({ key: k, value: String(v) }));`

---

### [INFO] 핵심 구현 diff 누락으로 OAuth 플로우 전체 검증 불가
- **위치**: `integration-oauth.service.ts`, `cafe24-api.client.ts`, `cafe24.handler.ts`, `cafe24-mcp-tool-provider.ts` (모두 diff 생략됨)
- **상세**: OAuth begin→callback 전 과정, API 호출 토큰 갱신, rate-limit 재시도, MCP 도구 디스패치 등 핵심 로직이 프롬프트 크기 제한으로 누락됨. 테스트 코드를 통해 의도는 파악되나 실제 구현의 엣지 케이스(예: state row 만료 시 callback 처리, refresh 중 동시 요청 처리)는 직접 확인 불가.
- **제안**: 해당 파일들을 별도로 리뷰 대상에 포함시켜 재검토 필요.

---

### [INFO] `cafe24.component.ts` — `cafe24ApiClient` null 가드 없이 전달
- **위치**: `backend/src/nodes/integration/cafe24/cafe24.component.ts`
- **상세**: `createHandler: (deps) => new Cafe24Handler(deps.integrationsService, deps.cafe24ApiClient)` — `HandlerDependencies.cafe24ApiClient`는 optional(`?`)로 선언되어 있음. `ai-agent.component.ts`는 `if (deps.cafe24ApiClient)` 가드를 사용하지만 `cafe24.component.ts`는 가드 없이 undefined를 그대로 전달. `Cafe24Handler`가 이를 내부에서 처리하지 않으면 런타임 오류 발생 가능.
- **제안**: `Cafe24Handler` 생성자에서 `cafe24ApiClient`가 없을 때 명시적 에러를 던지거나, 컴포넌트 레벨에서 null check 추가.

---

### [INFO] `mcp-server-selector.tsx` 그룹 헤딩 i18n 미적용
- **위치**: `frontend/src/components/integrations/mcp-server-selector.tsx`, 186–225행
- **상세**: `"🌐 Generic MCP (HTTP) servers"` / `"🛒 Cafe24 stores (Internal Bridge)"` 가 하드코딩된 영어. 다른 UI 텍스트는 `useT()` 훅을 통해 다국어 처리되는데 이 부분만 예외.
- **제안**: 번역 키를 추가하거나, 최소한 `t()` 래핑으로 일관성 유지.

---

### [INFO] `order_list` — `requiredFields`에 날짜 범위 강제
- **위치**: `backend/src/nodes/integration/cafe24/metadata/order.ts`
- **상세**: `requiredFields: ['shop_no', 'start_date', 'end_date']`로 날짜 범위가 필수. 주문 최신 1건 조회 같은 단순 조회 시나리오에서 사용자가 반드시 날짜를 지정해야 하는 제약이 UX 마찰을 일으킬 수 있음. Cafe24 API 원본이 이를 요구한다면 의도적이지만, AI Agent가 자동 호출할 때 date 파라미터를 추론해야 하는 부담이 생김.
- **제안**: Cafe24 API 원본 스펙과 비교해 `start_date`/`end_date`가 실제로 필수인지 재확인.

---

## 요약

이번 변경은 Cafe24 OAuth 인증 플로우부터 API 클라이언트, AI Agent MCP Internal Bridge, 프론트엔드 UI까지 전 계층에 걸친 통합 구현으로 전반적으로 요구사항을 체계적으로 반영하고 있다. 다만 두 가지 실질적인 결함이 있다: DTO 레이어의 SSRF 방어 정규식 누락(`mallId` 미검증)과 프론트엔드 `Cafe24Config`의 fields 상태 타입 불일치로 인한 런타임 크래시. 핵심 파일(OAuth 서비스, API 클라이언트, 핸들러)의 diff가 프롬프트 크기 제한으로 누락되어 OAuth 토큰 교환과 갱신 로직의 엣지 케이스는 완전히 검증되지 않은 상태로, 별도 리뷰가 필요하다.

## 위험도

**MEDIUM** — 프론트엔드 fields 편집 시 런타임 크래시와 SSRF 방어 레이어 누락이 있으나, 코어 기능은 동작 가능하고 서비스 레이어에 보조 검증이 존재하여 즉각적인 시스템 장애로는 이어지지 않음.