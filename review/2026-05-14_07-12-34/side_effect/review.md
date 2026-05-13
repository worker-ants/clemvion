## 발견사항

---

### [WARNING] `providerMeta` 암호화 Transformer 우회 위험
- **위치**: `integration-oauth-state.entity.ts` (providerMeta 컬럼), `integration-oauth.service.cafe24.spec.ts` (stateRepo mock)
- **상세**: `providerMeta` 컬럼은 `encryptedJsonTransformer`를 통해 AES-256-GCM으로 암호화되어 DB에 저장된다. 그런데 `handleCallback`이 (기존 패턴대로) DELETE-RETURNING raw SQL(`dataSource.query()`)로 state row를 원자적으로 소비한다면, TypeORM entity transformer가 적용되지 않아 `provider_meta`가 암호화된 blob 문자열로 반환된다. 테스트에서는 `dataSource.query`를 평문 객체로 mock하기 때문에 이 버그가 노출되지 않는다.
- **제안**: `integration-oauth.service.ts`(diff 생략됨)에서 callback 시 state row를 어떻게 읽는지 반드시 확인. raw SQL을 사용하는 경우 `providerMeta` 필드를 수동으로 decrypt하거나, `stateRepo.findOne()` → DELETE 패턴으로 전환해야 한다.

---

### [WARNING] `cafe24ApiClient` optional 타입과 실제 필수 사용 불일치
- **위치**: `cafe24.component.ts:15`, `node-component.interface.ts` (`cafe24ApiClient?`)
- **상세**: `HandlerDependencies.cafe24ApiClient`는 `?` optional로 선언되어 있지만, `cafe24.component.ts`에서는 `deps.cafe24ApiClient`를 null 체크 없이 `Cafe24Handler`에 직접 전달한다. DI 실패, 테스트 환경, 또는 `Cafe24Module` import 누락 시 `undefined`가 전달되어 런타임에서 cafe24 노드 실행이 crash한다.
- **제안**: 
  ```ts
  createHandler: (deps) => {
    if (!deps.cafe24ApiClient) throw new Error('Cafe24ApiClient not injected');
    return new Cafe24Handler(deps.integrationsService, deps.cafe24ApiClient);
  }
  ```

---

### [WARNING] `CAFE24_RESOURCES` 목록 중복 — 프론트엔드/백엔드 drift 위험
- **위치**: `metadata/types.ts:63-82` (백엔드), `integration-configs.tsx:248-267` (프론트엔드)
- **상세**: 18개 리소스 목록이 두 곳에 각각 하드코딩되어 있다. 백엔드에 새 리소스를 추가하면 프론트엔드의 `CAFE24_RESOURCES`를 수동으로 동기화해야 한다. 이 사실이 어디에도 강제되지 않는다.
- **제안**: 장기적으로는 백엔드 metadata API endpoint에서 리소스 목록을 fetch하는 방식을 검토. 단기적으로는 `integration-configs.tsx`의 주석에 "백엔드 `metadata/types.ts`와 동기화 필요" 를 명시한다.

---

### [WARNING] `handleCallback` 내 `providerMeta` 역참조 안전성 불명확
- **위치**: `integration-oauth.service.cafe24.spec.ts:196-214` (stateRecord mock)
- **상세**: callback stub flow 테스트에서 `dataSource.query`가 `providerMeta`가 이미 파싱된 plain object인 stateRecord를 반환하도록 mock되어 있다. 실제 production에서 `encryptedJsonTransformer`는 컬럼값을 암호화 문자열로 저장하므로, raw query를 통해 읽을 경우 `{ mall_id: 'myshop', ... }`가 아닌 암호화된 JSONB 값이 돌아온다. 테스트와 실제 동작이 다를 수 있다.
- **제안**: (위 첫 번째 WARNING과 동일한 근본 원인) integration test 또는 e2e test에서 실제 DB를 통해 save → query 왕복을 검증해야 한다.

---

### [WARNING] AI Agent 실행 체인에 전방위적 Cafe24 provider 삽입
- **위치**: `ai-agent.component.ts:19-36`
- **상세**: `deps.cafe24ApiClient`가 존재하면 (ExecutionEngineModule에서 항상 주입됨) 모든 AI Agent 실행 — Cafe24 통합을 사용하지 않는 워크플로 포함 — 에서 `Cafe24McpToolProvider.buildTools()`가 호출된다. 각 실행마다 `integrationsService.getForExecution()` 호출이 추가로 발생한다. 대규모 동시 실행 환경에서는 DB 부하가 증가한다.
- **제안**: 허용 가능한 오버헤드이나, `config.mcpServers`가 없거나 비어있으면 즉시 early-return하는 guard가 `Cafe24McpToolProvider.buildTools()` 상단에 있는지 확인한다.

---

### [INFO] `OAuthBeginDto` Cafe24 필수 필드가 DTO 레벨에서 all-optional
- **위치**: `integration.dto.ts:242-305`
- **상세**: `mallId`, `appType`은 Cafe24 흐름에서 사실상 필수이지만 DTO는 `@IsOptional()`로 선언. 비즈니스 필수 검증은 서비스 레이어에서 처리한다고 테스트로 확인되나, Swagger 문서에서 "optional"로 표시되어 API 사용자를 혼란스럽게 할 수 있다.
- **제안**: `@ApiPropertyOptional` 대신 `@ApiProperty({ description: 'cafe24 한정 필수' })` 사용 고려.

---

### [INFO] `clientSecret` HTTP POST body 전송 — 로그 노출 주의
- **위치**: `integrations.controller.ts:161-172`, `frontend/.../new/page.tsx:134-147`
- **상세**: private 앱의 `clientSecret`이 POST body에 평문으로 전송된다. HTTPS로 전송은 안전하지만, 미들웨어나 요청 로깅이 POST body를 기록한다면 시크릿이 서버 로그에 노출된다. DB에는 `encryptedJsonTransformer`로 암호화 저장되나 전송 경로는 보호되지 않는다.
- **제안**: 서버 요청 로거에서 `clientSecret` 필드를 redact하도록 설정 확인.

---

### [INFO] `detect-pending-user-config.ts` — `cafe24` 추가로 기존 검증 동작 변경
- **위치**: `detect-pending-user-config.ts:61`
- **상세**: `SUPPORTED_INTEGRATION_SERVICE_TYPES`에 `cafe24` 추가 이전에는 cafe24 노드가 있어도 pending config 감지를 무시했다. 추가 이후 cafe24 노드가 있는 모든 워크플로에서 integration 미설정 감지가 동작한다. 신규 기능이므로 기존 워크플로에 cafe24 노드가 없다면 영향 없다.

---

### [INFO] `candidate-lookup.service.ts` — `sublabel` 필드 추가는 additive
- **위치**: `candidate-lookup.service.ts:175`
- **상세**: MCP candidate 객체에 `sublabel: i.serviceType` 필드가 추가됨. 기존 소비자가 strict shape destructuring을 하지 않는 이상 breaking change가 아니다. 프론트엔드의 MCP server picker가 이 필드를 어떻게 소비하는지 별도 확인 필요.

---

## 요약

이번 변경은 전반적으로 잘 격리된 Cafe24 통합 추가이며 기존 Google/GitHub OAuth 흐름에 직접 영향을 주는 breaking change는 없다. 그러나 가장 주의가 필요한 지점은 **`providerMeta`의 암호화 Transformer와 raw SQL 우회 가능성**이다 — `handleCallback`이 DELETE-RETURNING raw query를 사용한다면, `encryptedJsonTransformer`가 적용되지 않아 `providerMeta`가 암호화된 blob으로 반환되고 Cafe24 콜백 처리가 실패한다. 테스트 mock이 이를 은닉하고 있어 integration 또는 e2e 레벨에서 실제 DB 왕복 검증이 반드시 필요하다. 나머지 WARNING들은 설계상의 취약점(optional/non-null 불일치, 리소스 목록 이중관리)으로 기능 장애보다는 유지보수 부채에 해당한다.

## 위험도

**MEDIUM** — Transformer bypass 이슈가 Production에서 실제 동작하는지 여부에 따라 HIGH로 상향될 수 있음.