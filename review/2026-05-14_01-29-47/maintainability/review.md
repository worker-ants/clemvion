### 발견사항

---

**[WARNING] 프론트엔드 resource 목록 중복 정의**
- 위치: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx:248-267` vs `backend/src/nodes/integration/cafe24/metadata/types.ts`
- 상세: `CAFE24_RESOURCES` 배열이 프론트엔드(integration-configs.tsx)와 백엔드(types.ts)에 각각 독립적으로 하드코딩되어 있음. 레이블 문자열(`"Store (상점)"` 등)도 백엔드 `CAFE24_RESOURCE_LABELS`와 동일하게 복제됨.
- 제안: 프론트엔드가 `/api/integrations/cafe24/resources` 엔드포인트나 기존 서비스 레지스트리에서 리소스 목록을 가져오거나, 공유 패키지로 추출. 최소한 타입 레벨에서 `CAFE24_RESOURCES` 배열을 가져와 컴파일 타임에 동기화를 강제.

---

**[WARNING] `OAuthBeginDto`에 Cafe24 전용 필드를 범용 DTO에 혼합**
- 위치: `backend/src/modules/integrations/dto/integration.dto.ts:237-282`
- 상세: `OAuthBeginDto`는 모든 OAuth provider의 begin 요청을 처리하는 공용 클래스인데, Cafe24 전용 필드 4개(`mallId`, `appType`, `clientId`, `clientSecret`)가 추가됨. 이후 다른 provider도 유사한 요구사항이 생기면 DTO가 무한히 증가하는 패턴.
- 제안: `providerMeta?: Record<string, unknown>` 단일 필드로 대체하거나, discriminated union 접근법(`providerOptions?: Cafe24BeginOptions | ...`) 사용.

---

**[WARNING] 컨트롤러에서 Cafe24 전용 로직이 인라인 분기로 처리**
- 위치: `backend/src/modules/integrations/integrations.controller.ts:161-172`
- 상세: `body.service === 'cafe24'` 조건으로 `providerMeta` 조립 로직이 컨트롤러에 직접 작성됨. 이 패턴은 provider 추가마다 컨트롤러를 수정해야 함.
- 제안: `IntegrationOAuthService.begin()` 또는 별도의 `Cafe24OAuthBeginAdapter`로 이동해 컨트롤러는 DTO 변환만 담당.

---

**[WARNING] `Cafe24McpToolProvider`의 `matches()` 동작이 mutable 상태에 의존**
- 위치: `backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` (파일 15, diff 생략)
- 상세: `buildTools()` 호출 후에야 `matches()`가 올바르게 동작하는 설계. 테스트 파일(파일 14)에서 `'buildTools was not called'` 케이스를 별도로 검증해야 할 만큼 암묵적 초기화 의존성이 존재.
- 제안: `matches()` 메서드에 precondition이 명확하도록 인터페이스 문서화 강화, 또는 `sid` Set을 생성자 주입으로 변경.

---

**[WARNING] `ai-agent.component.ts`의 provider 순서가 주석에만 의존**
- 위치: `backend/src/nodes/ai/ai-agent/ai-agent.component.ts:27-31`
- 상세: `Cafe24McpToolProvider`가 `McpToolProvider` **이전**에 등록되어야 한다는 순서 의존성이 주석으로만 설명됨. 배열 순서가 바뀌면 버그가 발생하지만 컴파일/테스트로 감지 불가.
- 제안: `AgentToolProvider` 인터페이스에 `priority?: number` 필드를 추가하거나, `AiAgentHandler`가 `matches()` 결과 기반으로 명시적으로 우선순위를 처리.

---

**[WARNING] `HandlerDependencies`에 Cafe24 전용 optional 필드 추가**
- 위치: `backend/src/nodes/core/node-component.interface.ts:272-274`
- 상세: `cafe24ApiClient?: Cafe24ApiClient`가 모든 노드가 공유하는 `HandlerDependencies`에 추가됨. 이 패턴이 반복되면 의존성 객체가 provider별 선택적 필드로 오염됨.
- 제안: 노드별 DI가 필요한 경우 `createHandler(deps, extras?: Record<string, unknown>)` 오버로드 또는 별도의 `Cafe24HandlerDependencies extends HandlerDependencies` 타입 사용.

---

**[INFO] `providerMeta`의 타입이 `Record<string, unknown>`으로 광범위**
- 위치: `backend/src/modules/integrations/entities/integration-oauth-state.entity.ts:79`
- 상세: `providerMeta: Record<string, unknown> | null` — JSONB 컬럼이지만 타입 정보가 없어 접근 시마다 캐스팅 필요.
- 제안: `Cafe24ProviderMeta` 인터페이스를 선언하고 `providerMeta: Cafe24ProviderMeta | null`로 타입 좁히기. 또는 tagged union `{ provider: 'cafe24'; mall_id: string; app_type: 'public' | 'private'; ... }`.

---

**[INFO] `mcp-server-selector.tsx`의 그룹 헤딩에 이모지 하드코딩**
- 위치: `frontend/src/components/integrations/mcp-server-selector.tsx:198-201`
- 상세: `"🌐 Generic MCP..."`, `"🛒 Cafe24..."` 문자열이 인라인 상수로 작성됨. i18n 지원이 필요해지면 수정 지점이 증가.
- 제안: 상단에 `const GROUP_LABELS` 상수로 추출.

---

**[INFO] 프론트엔드 `Cafe24ExtraFields`의 mall_id 유효성 정규식이 백엔드와 별도로 관리**
- 위치: `frontend/src/app/(main)/integrations/new/page.tsx:232`
- 상세: `/^[a-z0-9-]{3,50}$/` 정규식이 백엔드 DTO 검증과 독립적으로 복사됨. 규칙 변경 시 두 곳을 동시에 수정해야 함.
- 제안: 공유 validation 상수 파일로 추출하거나 API 스펙(OpenAPI) 기반 자동 생성 고려.

---

**[INFO] `integration-configs.tsx`의 `Cafe24Config` operation 입력이 자유 텍스트**
- 위치: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx:299-305`
- 상세: Operation을 `ExpressionInput`(자유 텍스트)으로 입력받아 사용자가 임의 문자열을 입력할 수 있음. Resource 변경 시 reset하는 로직은 있으나 드롭다운이 더 안전.
- 제안: 백엔드 metadata API에서 선택된 resource의 operation 목록을 가져와 `SelectField`로 교체.

---

### 요약

전체적으로 Cafe24 통합 구현은 메타데이터 기반 단일 진실 원칙(`CAFE24_OPERATIONS_BY_RESOURCE`), 명시적 에러 클래스 계층, 테스트 커버리지 측면에서 유지보수성이 양호하다. 다만 **DTO 오염**(OAuthBeginDto에 provider별 필드 누적), **프론트-백 중복 상수**(resource 목록, 정규식), **HandlerDependencies 오염**(전역 의존성 객체에 특정 노드 의존성 추가)의 세 가지 구조적 문제가 이후 provider 추가 시 반복될 수 있는 패턴을 형성한다는 점이 주요 유지보수성 리스크다. Provider 순서 의존성이 주석으로만 보호되는 점도 잠재적 회귀 위험이다.

### 위험도

**MEDIUM**