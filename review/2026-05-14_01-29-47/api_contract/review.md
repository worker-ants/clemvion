### 발견사항

- **[WARNING]** `OAuthBeginDto.mallId` 패턴 검증 누락
  - 위치: `integration.dto.ts` — `mallId` 필드
  - 상세: 주석에 "Validation `/^[a-z0-9-]{3,50}$/` — SSRF 방어"라고 명시했지만 실제 `@Matches()` 데코레이터가 없음. `@MaxLength(50)` + `@IsString()`만 있어서 대문자, 특수문자, 공백이 포함된 `mallId`가 DTO 레이어를 통과함. 서비스 레이어가 이를 잡긴 하지만 DTO가 첫 번째 방어선 역할을 하지 못함.
  - 제안: `@Matches(/^[a-z0-9-]{3,50}$/, { message: 'mallId must be 3-50 lowercase alphanumeric/hyphen chars' })` 추가

- **[WARNING]** 컨트롤러에서 `providerMeta` 빌드 시 `undefined` 필드 미검증
  - 위치: `integrations.controller.ts` — `oauthBegin` 핸들러
  - 상세: `body.service === 'cafe24'`이지만 `body.mallId`가 제공되지 않으면 `{ mall_id: undefined, app_type: undefined }` 형태의 `providerMeta`가 서비스로 전달됨. 서비스에서 검증하지만 컨트롤러 레이어에서 early guard가 없어 불완전한 객체가 인자로 넘어감.
  - 제안: 컨트롤러에서 `cafe24`일 때 `mallId` 존재 여부 최소 가드 추가, 또는 `OAuthBeginDto`에 조건부 필수 검증 적용

- **[INFO]** `CandidateEntry` 응답에 `sublabel` 필드 추가 — 소비자 영향
  - 위치: `candidate-lookup.service.ts` — `lookupMcpServers` 반환값
  - 상세: `mcp-server-selector` 위젯이 소비하는 `CandidateEntry`에 `sublabel: i.serviceType`이 추가됨. 기존 MCP 항목도 이제 `sublabel: 'mcp'`를 포함해 반환. 추가 필드이므로 REST 계약상 하위 호환이지만 기존 항목의 응답 구조 변화임.
  - 제안: 해당 없음 (additive), 단 타입 정의 업데이트 확인 필요

- **[INFO]** `providerMeta` 엔티티 타입이 지나치게 느슨함
  - 위치: `integration-oauth-state.entity.ts` — `providerMeta: Record<string, unknown> | null`
  - 상세: Cafe24 전용 구조(`mall_id`, `app_type`, `client_id?`, `client_secret?`)가 명확히 정의되어 있음에도 런타임 타입 안전성 없이 `Record<string, unknown>`으로 선언. 콜백 핸들러에서 이 값을 꺼낼 때 타입 캐스팅이 필요해 계약이 암묵적으로 됨.
  - 제안: `Cafe24ProviderMeta` 인터페이스를 정의하고 `providerMeta: Cafe24ProviderMeta | null`로 타입 강화

- **[INFO]** 프론트엔드 React Query 캐시 키 변경
  - 위치: `mcp-server-selector.tsx` — `queryKey: ["integrations", "mcp"]` → `["integrations", "mcp-capable"]`
  - 상세: 캐시 무효화 버그 가능성은 없으나 (다른 컴포넌트에서 동일 키를 공유하지 않는 한), 같은 키로 구독 중인 컴포넌트가 있다면 캐시 미스 발생. 내부 API 계약이므로 영향 범위 확인 필요.
  - 제안: 프로젝트 내 `["integrations", "mcp"]` 키 사용처 grep으로 일괄 확인

- **[INFO]** 기존 `OAuthBeginDto` 소비자 하위 호환 — 이상 없음
  - 위치: `integration.dto.ts`
  - 상세: 신규 필드 4개 모두 `@IsOptional()`. Google/GitHub 등 기존 OAuth 흐름은 해당 필드를 전달하지 않아도 무방. Breaking change 없음.

---

### 요약

전체적으로 하위 호환성은 잘 유지되어 있다. 신규 DTO 필드는 모두 선택적이고, 서비스 레지스트리·엔티티·응답 구조 변경은 기존 Google/GitHub 흐름에 영향을 주지 않는다. 가장 주목할 이슈는 `OAuthBeginDto.mallId`에서 주석으로 명시된 SSRF 방어용 정규식 검증(`@Matches()`)이 실제 구현에 빠진 점으로, 서비스 레이어가 2차 방어를 하지만 DTO 레이어의 계약이 명세와 다르다. 컨트롤러에서 `providerMeta`를 빌드할 때 필수 필드 미제공 시 `undefined`가 흘러들어가는 경로도 보완이 필요하다.

### 위험도
**MEDIUM**