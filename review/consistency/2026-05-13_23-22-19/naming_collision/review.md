## 발견사항

### 요구사항 ID

- **`INT-SV-05`** (신규): `spec/4-nodes/4-integration/_product-overview.md`에 추가. 기존 `INT-SV-01~04`의 순차 확장. **충돌 없음.**

---

### 엔티티·타입명

- **`service_type='cafe24'`**: 기존 열거(google, github, http, database, email, webhook, mcp)에 없는 신규 값. **충돌 없음.**
- **`Node.type='cafe24'`** (integration 카테고리): 기존 27개 type 목록에 없는 신규 값. **충돌 없음.**
- **`Cafe24McpBridge`**, **`Cafe24ApiClient`**, **`Cafe24OperationMetadata`**, **`cafe24NodeConfigSchema`**: 코퍼스 내 동명 식별자 없음. **충돌 없음.**
- **`IMcpClient`**: 기존 인터페이스. `Cafe24McpBridge`가 구현체로 사용 — 재사용이므로 충돌 없음.
- **`IntegrationSelector` `serviceTypes` prop**: 기존 컴포넌트에 `'cafe24'` 값 추가. 충돌 없음.

---

### API endpoint

- **`POST /api/integrations/oauth/begin`**: 기존 엔드포인트를 cafe24 전용 필드(`mall_id`, `app_type`, `client_id`, `client_secret`)로 확장. 방법·경로 동일 — **기존 contract 후방 호환 유지, 충돌 없음.**
- **`GET /api/integrations/oauth/callback/cafe24`**: `:provider` 파라미터의 신규 값. 기존 `/callback/google`, `/callback/github`와 경로 패턴 동일. **충돌 없음.**

---

### 파일 경로

- **`spec/4-nodes/4-integration/4-cafe24.md`**: `3-send-email.md` 다음 순번. 충돌 없음.
- **`spec/conventions/cafe24-api-metadata.md`**: 기존 `node-output.md`, `swagger.md`, `migrations.md`와 중복 없음. 충돌 없음.

---

### [WARNING] `resource='application'` — Cafe24 앱 관리 API vs. OAuth `app_type` 개념 혼동 위험

- **target 신규 식별자**: `cafe24` 노드 config `resource` enum 의 18개 값 중 `application`
- **기존 사용처**: 동일 Integration 내 credentials의 `app_type: 'public' | 'private'` (OAuth 앱 발급 형태). 시스템 전반에서 "application" 은 소프트웨어 앱 의미로 통용.
- **상세**: `resource='application'` 은 Cafe24 Admin API 의 "Cafe24 앱스토어 앱 관리" 카테고리이며, OAuth 연결 방식인 `app_type` 과 의미가 다르다. 같은 Integration 설정 화면 안에 두 개념이 공존하므로 프론트엔드 구현 시 혼동 위험이 있다.
- **제안**: 식별자 변경 불가 (Cafe24 공식 API 카테고리명). 현재 초안의 `resource='application'` 항목 주석 ("※ Cafe24 앱 관리 API — OAuth 앱 등록과 무관")은 적절하며 반드시 유지. 추가로 `spec/conventions/cafe24-api-metadata.md` §1 디렉토리 목록의 `application.ts` 행에도 동일 주석 명시 권장.

---

### [WARNING] `credentials.user_id` — 내부 `User.id` 와 혼동 가능

- **target 신규 식별자**: Cafe24 credentials JSONB 내 `user_id: string` (Cafe24 OAuth 토큰 응답의 쇼핑몰 운영자 식별자)
- **기존 사용처**: `Integration.created_by` (UUID → User PK), 시스템 전반에서 `user_id` 는 내부 `User` 엔티티 PK를 가리키는 관용 변수명. `IntegrationUsageLog` 등 서비스 레이어에서도 `userId` 는 내부 UUID.
- **상세**: credentials JSONB 는 암호화 저장되어 직접 쿼리되지 않지만, backend가 credentials를 역직렬화하는 시점에 `credentials.user_id` (Cafe24 문자열)와 내부 `user.id` (UUID)를 혼용할 위험이 있다. 특히 `IntegrationUsageLog` 를 조회하거나 권한 검사 로직을 작성할 때 슬립이 발생하기 쉽다.
- **제안**: `credentials.user_id` → `credentials.cafe24_operator_id` 또는 `credentials.mall_user_id` 로 변경하면 혼동을 원천 차단할 수 있다. Cafe24 API 응답의 `user_id` key와는 매핑 레이어에서 명시적으로 변환하면 된다.

---

### [INFO] `Cafe24OperationMetadata.category: 'read' | 'write'` — `Node.category` 와 필드명 동일

- **target 신규 식별자**: `Cafe24OperationMetadata.category` (read/write scope 분류)
- **기존 사용처**: `Node.category: Enum` (logic / flow / ai / integration / data / presentation)
- **상세**: TypeScript 타입이 달라 런타임 충돌은 없으나, backend 코드 검색 시 혼동 가능. Cafe24 맥락에서 `category` 는 scope R/W 를 의미하고, 노드 맥락에서는 기능 그룹을 의미.
- **제안**: `Cafe24OperationMetadata.category` → `scopeType: 'read' | 'write'` 로 변경하면 Cafe24 scope (`mall.read_*` / `mall.write_*`) 와의 의미 연결이 더 명확해지고 기존 `Node.category` 와 혼동이 없어진다.

---

### [INFO] `credentials.expires_at` — `Integration.token_expires_at` 과 이중 관리 명세 미비

- **target 신규 식별자**: `credentials.expires_at: ISO8601` (Cafe24 credentials JSONB 내부)
- **기존 사용처**: `Integration.token_expires_at: Timestamp` (DB 컬럼, 만료 스캐너 §11 이 참조)
- **상세**: 동일 정보가 두 위치에 저장된다. 초안이 "Integration.token_expires_at 컬럼과 동기화"라고 명시하나, **어느 방향**으로 언제 동기화하는지(토큰 갱신 시 credentials 먼저 갱신 → 컬럼 반영, 또는 atomic 동시 갱신)가 spec에 없다. 동기화 실패 시 만료 스캐너가 오동작할 수 있다.
- **제안**: 식별자 변경 불요. `spec/2-navigation/4-integration.md` §10.5 토큰 자동 갱신 절에 "토큰 갱신 성공 시 `Integration.token_expires_at` 컬럼과 `credentials.expires_at` 을 동일 트랜잭션 내에서 원자 갱신" 을 명시 추가 권장.

---

## 요약

신규 도입 식별자 중 **기존 코퍼스와 직접 충돌하는 항목은 없다.** CRITICAL 0건. `application` 리소스명과 `credentials.user_id` 두 항목이 기존 개념과의 혼동 가능성을 내포하며(WARNING), `Cafe24OperationMetadata.category` 필드명과 `credentials.expires_at` 동기화 명세는 보완이 권장된다(INFO). 특히 **`credentials.user_id` → `credentials.cafe24_operator_id` 개명** 은 구현 단계에서 버그를 예방하는 효과가 크므로 spec write 전에 반영을 검토할 것.

## 위험도

**LOW**