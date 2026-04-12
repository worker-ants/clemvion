## 부작용 코드 리뷰 결과

### 발견사항

---

**[WARNING] `oauthCallback` 엔드포인트 — `@Public()` 데코레이터로 인증 우회**
- 위치: `integrations.controller.ts` — `oauthCallback` 메서드
- 상세: OAuth callback 엔드포인트는 인증 없이 외부에서 접근 가능합니다. `state` 파라미터로 CSRF를 방어하지만, 이 엔드포인트를 통해 임의의 `provider` 값을 넘겨 `handleCallback`을 호출할 수 있습니다. `provider` 파라미터 화이트리스트 검증이 없으면 예상치 못한 코드 경로가 실행될 수 있습니다.
- 제안: `const ALLOWED_PROVIDERS = ['slack', 'google', 'github']`를 정의하고 컨트롤러 진입 시 검증. `integration-oauth.service.ts`의 `authorizeUrls` 맵에 없는 provider는 이미 실패하지만 state DB 조회까지 진행됩니다.

---

**[WARNING] `purgeExpired()` — 모든 `begin()` 호출에서 DB 삭제 수행 (fire-and-forget)**
- 위치: `integration-oauth.service.ts` — `purgeExpired()` / `begin()` 내 호출
- 상세: `begin()`이 호출될 때마다 `integration_oauth_state`와 `integration_oauth_preview` 전체에 대해 `DELETE WHERE expires_at < NOW()`를 실행합니다. 동시 요청이 많은 환경에서 불필요한 DB 부하가 발생하며, 대형 테이블에서 성능 저하를 일으킬 수 있습니다. 에러는 warn만 하고 무시되므로 만료 레코드가 영구 축적될 수 있습니다.
- 제안: 스캐너처럼 별도 BullMQ 주기 작업으로 분리하거나, 최소한 마지막 purge 타임스탬프를 메모리에 캐싱해 과도한 호출 방지.

---

**[WARNING] `integration.entity.ts` — `@Unique` 제약 추가로 기존 데이터 마이그레이션 위험**
- 위치: `integration.entity.ts` — `@Unique('integration_workspace_name_unique', ['workspaceId', 'name'])`
- 상세: 엔티티에 `@Unique` 데코레이터가 추가되었고, `V008` 마이그레이션에도 `ADD CONSTRAINT ... UNIQUE`가 있습니다. 기존 DB에 동일 `(workspace_id, name)` 조합의 레코드가 이미 존재한다면 마이그레이션이 실패합니다. 롤백 전략이 없습니다.
- 제안: 마이그레이션 전 중복 데이터 확인 쿼리 추가: `SELECT workspace_id, name, COUNT(*) FROM integration GROUP BY 1,2 HAVING COUNT(*) > 1`.

---

**[WARNING] `IntegrationExpiryScannerService` — `status: Not('error')` 필터가 `expired` 상태도 포함**
- 위치: `integration-expiry-scanner.service.ts` — `run()` 메서드
- 상세: `Not('error')`는 `connected`와 `expired` 모두 포함합니다. 이미 `expired` 상태인 integration도 스캔 대상이 되어, `0d` threshold의 `claimThreshold` 중복 체크가 없으면 매일 `expired` 상태로 재저장하고 `integration_expiry_dispatch` 삽입을 시도합니다. `UNIQUE` 제약으로 두 번째 삽입은 실패(`23505`)하지만, `integrationRepository.save`는 `0d` claimed 이후에도 실행됩니다.
- 제안: `status: Not('error')` → `status: 'connected'`로 제한하거나, `run()` 내 `threshold === '0d'` 분기에서 이미 `expired`인 경우 save 스킵.

---

**[WARNING] `renderCallbackHtml()` — XSS 부분 방어**
- 위치: `integrations.controller.ts` — `renderCallbackHtml()` 함수 끝
- 상세: `JSON.stringify(payload).replace(/</g, '\\u003c')`로 `<` 문자는 이스케이프하지만, HTML 본문의 `input.error` 값이 직접 삽입됩니다:
  ```js
  'OAuth failed: ' + input.error
  ```
  `input.error`에 `<script>`, `"`, `'` 등이 포함되면 HTML 주입이 가능합니다.
- 제안: `input.error`를 HTML 이스케이프 처리 후 삽입:
  ```ts
  const safeError = input.error.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  ```

---

**[WARNING] `IntegrationsService.create()` 시그니처 변경 — 기존 호출자 영향**
- 위치: `integrations.controller.ts` → `integrations.service.ts`
- 상세: `create(workspaceId, userId, body)` → `create(workspaceId, userId, role, body)`로 시그니처가 변경되었습니다. `role`은 컨트롤러에서 `resolveRole()`을 별도 호출해 주입하므로, 만약 다른 모듈이 `IntegrationsService`를 직접 주입해 `create`를 호출하고 있다면 런타임 에러가 발생합니다. `exports`에 `IntegrationsService`가 포함되어 있어 외부 사용 가능성이 있습니다.
- 제안: `reauthorize`도 동일하게 시그니처가 변경(`workspaceId, userId` 추가)되었으므로, `exports: [IntegrationsService]`를 통해 외부에서 사용하는 위치 전수 확인 필요.

---

**[INFO] `ListIntegrationsQueryDto` — `status: 'expiring'`이 DB 필드값과 불일치**
- 위치: `integrations.dto.ts` — `INTEGRATION_STATUSES`, `integration.entity.ts` — `IntegrationStatus`
- 상세: `IntegrationStatus` 타입은 `'connected' | 'expired' | 'error'`이지만, `ListStatusFilter`에는 `'expiring'`이 추가되었습니다. 서비스 레이어에서 `status === 'expiring'`을 별도 처리(예: `tokenExpiresAt <= NOW() + 7d AND status = 'connected'`)하지 않으면 빈 결과를 반환합니다.
- 제안: `integrations.service.ts`의 `findAll()`에서 `expiring` 필터를 명시적으로 `BETWEEN` 조건으로 변환하는 코드가 있는지 확인. 없다면 추가 필요.

---

**[INFO] `integration-oauth.service.ts` — 토큰 교환이 stub 구현**
- 위치: `integration-oauth.service.ts` — `handleCallback()` 내 `syntheticCredentials`
- 상세: 실제 provider 토큰 엔드포인트 호출 없이 `stub-${randomBytes}` 형태의 가짜 토큰을 저장합니다. 프로덕션 배포 시 이 상태로 나가면 연결된 것처럼 보이지만 실제로는 동작하지 않습니다. 주석에 "stub"임을 명시했으나, feature flag나 환경 변수 가드가 없습니다.
- 제안: `if (process.env.NODE_ENV === 'production') throw new Error('Real token exchange not implemented')`와 같은 가드 추가 또는 TODO 이슈 추적.

---

**[INFO] `onModuleInit` 중복 등록 위험 — `IntegrationExpiryScannerService`와 `ScheduleRunnerService`**
- 위치: `integration-expiry-scanner.service.ts:onModuleInit()`, `schedule-runner.service.ts:onModuleInit()`
- 상세: 두 서비스 모두 `onModuleInit`에서 `upsertJobScheduler`를 호출합니다. 멀티 인스턴스 배포(수평 스케일링)에서 여러 인스턴스가 동시에 `upsertJobScheduler`를 호출해도 BullMQ의 upsert 특성상 안전하지만, 로그가 인스턴스 수만큼 출력됩니다. 이는 의도된 동작입니다.

---

**[INFO] `service.scopes` — 프론트엔드에서 `service.scopes`를 항상 배열로 가정**
- 위치: `frontend/src/app/(main)/integrations/new/page.tsx` — `syncedVariant` 블록
- 상세: `service.scopes.filter(...)` 호출 시 `ServiceDefinition.scopes`가 `undefined`일 수 있습니다(`service-registry.ts`에서 `http`, `database`, `email`, `webhook` 타입은 `scopes` 없음). 백엔드 `getAvailableServices()`가 항상 배열을 반환한다면 안전하지만, 타입 정의 `scopes: ScopeOption[]` (non-optional)과 실제 데이터가 불일치할 수 있습니다.
- 제안: `service.scopes?.filter(...)` 또는 백엔드에서 항상 빈 배열 `[]`로 직렬화 보장.

---

### 요약

이번 변경은 Integration 모듈을 대폭 확장한 것으로, 핵심 부작용 위험은 세 가지입니다. 첫째, OAuth 콜백 엔드포인트의 HTML 응답에서 `input.error` 값이 직접 HTML에 삽입되어 XSS가 가능합니다 (즉시 수정 필요). 둘째, `create`/`reauthorize` 메서드 시그니처 변경으로 `IntegrationsService`를 외부에서 직접 사용하는 코드가 있다면 런타임 오류가 발생합니다. 셋째, 토큰 교환이 stub 구현으로, 프로덕션에 그대로 배포될 경우 기능이 동작하지 않습니다. 나머지 사항들(purge 성능, expiry 스캐너 로직, `expiring` 필터 처리)은 중간 위험도이며 정상 동작에 영향을 줄 수 있습니다.

---

### 위험도

**MEDIUM** (XSS 취약점 및 stub 토큰 교환을 고려하면 프로덕션 배포 전 HIGH로 상향 조정 권고)