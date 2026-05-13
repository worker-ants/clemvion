## 요구사항 코드 리뷰 결과

### 발견사항

---

**[WARNING] `service-registry.ts`: `access_token` / `refresh_token` / `cafe24_operator_id` 가 `required: true`로 마킹됨**
- 위치: `CAFE24_OAUTH_FIELDS` 배열, `access_token`/`refresh_token`/`cafe24_operator_id` 항목
- 상세: 세 필드는 OAuth 콜백 이후 서버가 자동으로 채우는 값이므로 사용자가 OAuth 시작 전에 입력해야 하는 필드가 아님. `required: true` 가 "연결 완료 후 자격증명 검증" 용도이면 문제없지만, `ServiceDefinition` 소비처에서 OAuth begin 전 폼 유효성 검증에 이 플래그를 사용한다면 사용자가 Cafe24 OAuth를 아예 시작할 수 없게 됨.
- 제안: OAuth 완료 후 서버 측에서 채워지는 필드(`access_token`, `refresh_token`, `cafe24_operator_id`)는 `required: false`로 설정하거나, pre-OAuth 필수 여부와 post-OAuth 존재 여부를 구분하는 별도 플래그 도입.

---

**[WARNING] `cafe24.component.ts`: `cafe24ApiClient` null 체크 없이 핸들러에 전달**
- 위치: `createHandler: (deps) => new Cafe24Handler(deps.integrationsService, deps.cafe24ApiClient)`
- 상세: `HandlerDependencies.cafe24ApiClient` 는 `optional` 타입(`Cafe24ApiClient | undefined`). `Cafe24Module` DI 설정이 누락되거나 잘못 구성되면 `undefined` 가 `Cafe24Handler`에 전달되고, 첫 API 호출 시 스택 트레이스 없는 `TypeError`가 발생함.
- 제안: `if (!deps.cafe24ApiClient) throw new Error('Cafe24ApiClient not injected — check Cafe24Module import')` 가드 추가.

---

**[WARNING] `integration.dto.ts`: `clientId` / `clientSecret` 공백 전용 문자열 통과**
- 위치: `OAuthBeginDto.clientId`, `OAuthBeginDto.clientSecret`
- 상세: `@Matches(/^[\x20-\x7E]+$/)` 는 스페이스 1개만으로도 통과. `@MinLength(1)` 은 있으나 공백만으로 구성된 문자열을 걸러내지 못함. private 앱에서 `clientId = " "`가 DTO를 통과하면 서비스 레이어까지 도달함.
- 제안: `@MinLength(1)` 대신 `@Matches(/^[\x21-\x7E][\x20-\x7E]*[\x21-\x7E]$|^[\x21-\x7E]$/)` 로 강화하거나 서비스 레이어에서 `.trim().length > 0` 검증 추가.

---

**[WARNING] `integrations.controller.ts`: `providerMeta` private 앱 필드에 `undefined` 포함 가능**
- 위치: `providerMeta` 구성 블록 (`client_id: body.clientId, client_secret: body.clientSecret`)
- 상세: `body.clientId` 또는 `body.clientSecret` 이 DTO에서 `undefined`로 들어오면 spread 결과 객체에 `{ client_id: undefined, client_secret: undefined }` 가 포함됨. JSON 직렬화 시 키가 제거되지만, `encryptedJsonTransformer` 직렬화 경로에서 처리 방식에 따라 서비스 레이어의 `'client_id' in meta` vs `meta.client_id != null` 체크가 불일치할 수 있음.
- 제안: `body.clientId ? { client_id: body.clientId } : {}` 패턴으로 undefined 필드 명시적 제외.

---

**[INFO] `integration-configs.tsx`: `CAFE24_RESOURCES` 목록 중복**
- 위치: `frontend/src/components/.../integration-configs.tsx` 의 `CAFE24_RESOURCES` 상수
- 상세: 백엔드 `metadata/types.ts`의 `CAFE24_RESOURCE_LABELS` 와 18개 리소스 목록이 완전 중복. 새 리소스 추가 시 양쪽 모두 수정 필요.
- 제안: 공유 패키지로 추출하거나 빌드 타임에 백엔드 메타데이터에서 생성.

---

**[INFO] `new/page.tsx` + `integration-configs.tsx`: Operation ID 자유 입력 — 오타 시 런타임 에러**
- 위치: `Cafe24Config` 컴포넌트의 `ExpressionInput label="Operation"`
- 상세: 50+ 오퍼레이션을 수동 타이핑해야 함. 오타는 실행 시 `CAFE24_UNKNOWN_OPERATION` 에러로만 발견됨. 현재는 spec에 "향후 드롭다운"이 언급되지 않았다면 UX 요구사항 누락.
- 제안: 선택한 Resource에 따라 필터된 오퍼레이션 드롭다운 제공.

---

**[INFO] `mallId` 정규식이 선행/후행 하이픈 허용**
- 위치: `OAuthBeginDto.mallId` `@Matches(/^[a-z0-9-]{3,50}$/)`
- 상세: `-abc`, `abc-`, `--x-` 같은 값이 통과. Cafe24 mall_id 형식 상 선행/후행 하이픈은 실제로 존재하지 않으며, `https://-abc.cafe24api.com` 은 DNS 실패로 이어짐. SSRF 방어는 충분하나 사용자 혼란 유발 가능.
- 제안: `/^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/` 로 선행/후행 하이픈 차단 (3자 최소 길이 보존).

---

### 요약

Cafe24 통합은 메타데이터 기반 디스패치, AES-256-GCM `providerMeta` 암호화, SSRF 방어 정규식, 계층별 테스트 커버리지 등 구조적으로 견고하게 구현되어 있다. 그러나 주요 요구사항 리스크는 두 가지다: (1) `CAFE24_OAUTH_FIELDS`에서 post-OAuth 자격증명 필드(`access_token`, `refresh_token`)를 `required: true`로 마킹해 서비스 레지스트리 소비처에 따라 OAuth 시작 자체가 차단될 수 있으며, (2) `cafe24.component.ts`가 선택적 의존성 `cafe24ApiClient`를 null 체크 없이 핸들러에 전달해 DI 설정 오류 시 명확하지 않은 런타임 오류가 발생한다. `clientId`/`clientSecret` DTO 검증 및 컨트롤러의 `undefined` 필드 문제는 서비스 레이어에서 이중 방어되나 명시적 수정 권장.

### 위험도

**MEDIUM**