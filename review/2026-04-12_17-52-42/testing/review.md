### 발견사항

---

**[WARNING] `IntegrationOAuthService.purgeExpired()` 테스트 누락**
- 위치: `integration-oauth.service.ts` — `purgeExpired()` private method
- 상세: `begin()` 호출 시 fire-and-forget으로 실행되는 만료 레코드 정리 로직이 테스트되지 않음. `purgeExpired`가 throw해도 무시되는지, stateRepo/previewRepo의 `delete`가 각각 호출되는지 검증 필요.
- 제안:
  ```ts
  it('silently ignores purgeExpired errors during begin', async () => {
    process.env.SLACK_CLIENT_ID = 'cid';
    stateRepo.delete.mockRejectedValueOnce(new Error('db error'));
    await expect(service.begin({ ..., mode: 'new' })).resolves.toBeDefined();
    delete process.env.SLACK_CLIENT_ID;
  });
  ```

---

**[WARNING] `handleCallback` — 만료된 OAuth state 처리 테스트 누락**
- 위치: `integration-oauth.service.spec.ts` — `handleCallback` describe 블록
- 상세: `record.expiresAt < Date.now()` 분기(state 만료 시 삭제 후 예외)가 테스트되지 않음. 실제로 stateRepo.delete가 호출되는지도 검증되어야 함.
- 제안:
  ```ts
  it('rejects and deletes expired state', async () => {
    stateRepo.findOne.mockResolvedValue({
      id: 'st-x', state: 'abc', provider: 'slack',
      expiresAt: new Date(Date.now() - 1000), ...
    });
    await expect(service.handleCallback('slack', { code: 'c', state: 'abc' }))
      .rejects.toThrow(BadRequestException);
    expect(stateRepo.delete).toHaveBeenCalledWith('st-x');
  });
  ```

---

**[WARNING] `handleCallback` — provider mismatch 테스트 누락**
- 위치: `integration-oauth.service.spec.ts`
- 상세: `record.provider !== provider` 분기가 테스트되지 않음.
- 제안:
  ```ts
  it('rejects on provider mismatch', async () => {
    stateRepo.findOne.mockResolvedValue({
      provider: 'google', expiresAt: new Date(Date.now() + 60_000), ...
    });
    await expect(service.handleCallback('slack', { code: 'c', state: 'abc' }))
      .rejects.toThrow(BadRequestException);
  });
  ```

---

**[WARNING] `handleCallback` — `request_scopes` 모드 테스트 누락**
- 위치: `integration-oauth.service.spec.ts`
- 상세: `reauthorize` 모드는 테스트되지만 `request_scopes` 모드(기존 credentials 머지 로직)에 대한 테스트 없음. 특히 integrationId 없는 경우(`OAUTH_STATE_INVALID`) 분기도 미검증.
- 제안: `request_scopes` 모드 성공 케이스와 `integrationId` 누락 케이스를 별도 테스트로 추가.

---

**[WARNING] `consumePreviewToken` — 만료된 preview token 테스트 누락**
- 위치: `integration-oauth.service.spec.ts` — `consumePreviewToken` describe
- 상세: `expiresAt < Date.now()` 분기(삭제 후 예외)가 테스트되지 않음.
- 제안:
  ```ts
  it('rejects and deletes expired preview token', async () => {
    previewRepo.findOne.mockResolvedValue({
      previewToken: 'tmp_x', workspaceId: 'ws-1', userId: 'u-1',
      expiresAt: new Date(Date.now() - 1000), ...
    });
    await expect(service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'))
      .rejects.toThrow(BadRequestException);
    expect(previewRepo.delete).toHaveBeenCalledWith('tmp_x');
  });
  ```

---

**[WARNING] `IntegrationExpiryScannerService` — `tokenExpiresAt` 없는 항목 skip 테스트 누락**
- 위치: `integration-expiry-scanner.service.spec.ts`
- 상세: `run()` 내부 `if (!integration.tokenExpiresAt) continue;` 분기(만료일 없는 항목 건너뜀)에 대한 테스트 없음.
- 제안:
  ```ts
  it('skips integrations without tokenExpiresAt', async () => {
    integrationRepo.find.mockResolvedValue([
      { id: 'int-x', tokenExpiresAt: null, ... }
    ]);
    const count = await scanner.run(new Date());
    expect(count).toBe(0);
    expect(notificationRepo.save).not.toHaveBeenCalled();
  });
  ```

---

**[WARNING] `IntegrationExpiryScannerService` — organization scope 알림 수신자 없는 케이스 누락**
- 위치: `integration-expiry-scanner.service.spec.ts`
- 상세: org-scope 통합에 admin/owner가 한 명도 없을 때(`members`가 모두 `member` role이거나 빈 경우) 알림이 0건으로 올바르게 처리되는지 미검증.

---

**[WARNING] `IntegrationsService.getActivity()` 테스트 누락**
- 위치: `integrations.service.spec.ts`
- 상세: `getActivity()` 메서드에 대한 테스트가 전혀 없음. `usageLogRepo.createQueryBuilder`가 mock 되어 있음에도 이를 검증하는 테스트 케이스가 없음.

---

**[WARNING] `IntegrationsService.findAll()` 테스트 누락**
- 위치: `integrations.service.spec.ts`
- 상세: 핵심 목록 조회(`findAll`)에 대한 테스트 없음. 검색(`q`), `scope` 필터, `status` 필터(특히 `expiring` 필터 — `tokenExpiresAt` 기반 조건) 처리 경로가 미검증.

---

**[WARNING] `IntegrationsService.previewTest()` 테스트 누락**
- 위치: `integrations.service.spec.ts`
- 상세: `POST /integrations/preview-test` 엔드포인트를 처리하는 `previewTest()` 로직이 테스트되지 않음.

---

**[INFO] `renderCallbackHtml()` — XSS 방어 로직 테스트 부재**
- 위치: `integrations.controller.ts` — `renderCallbackHtml` 함수
- 상세: `JSON.stringify(payload).replace(/</g, '\\u003c')` 이스케이핑 로직이 단위 테스트로 검증되지 않음. HTML 인젝션 방어를 신뢰하려면 별도 단위 테스트가 권장됨.

---

**[INFO] `ActivityQueryDto` — `limit`/`days` 타입이 `string`으로 선언**
- 위치: `dto/integration.dto.ts`, `integrations.controller.ts:activity()`
- 상세: `@IsString()`으로 받은 값을 컨트롤러에서 `Number()` 변환 후 `Number.isFinite()` 검사를 하고 있으나, `@IsInt()` + `@Type(() => Number)` 방식이 더 안전하며 변환 실패 케이스가 DTO 레벨에서 거부되어야 함. 현재 `"abc"` 같은 값이 DTO 통과 후 `NaN → 기본값` 처리되는 동작은 암묵적이어서 테스트로 의도 명시 필요.

---

**[INFO] `IntegrationUsageLog` 인덱스 방향 불일치**
- 위치: `integration-usage-log.entity.ts` vs `V008__integration_usage_log_and_metadata.sql`
- 상세: SQL 마이그레이션에서는 `(integration_id, at DESC)` 인덱스이지만, 엔티티의 `@Index` 데코레이터는 방향 지정 없이 `['integrationId', 'at']`만 선언. 기능 동작에 영향은 없지만, 인덱스 정의 의도가 엔티티에 반영되지 않음.

---

**[INFO] `makeQueryBuilder` 헬퍼 — `addSelect`, `innerJoin` 등 실제 미사용 메서드 포함**
- 위치: `integrations.service.spec.ts` — `makeQueryBuilder`
- 상세: mock 헬퍼에 정의된 여러 메서드가 테스트에서 실제 호출 검증 없이 fluent chain을 위해 추가됨. 이는 서비스 구현의 query builder 사용 패턴이 바뀌어도 테스트가 통과하는 false-positive 위험이 있음. 핵심 assertion은 충분하나, 실제 쿼리 조건(`andWhere` 인자 등)을 일부라도 검증하는 것을 권장.

---

### 요약

전반적으로 테스트 구조는 잘 설계되어 있으며 `makeIntegration`, `makeQueryBuilder` 같은 팩토리 헬퍼 도입으로 가독성이 높습니다. 핵심 비즈니스 로직(create, rotate, remove, updateScope, requestScopes, reauthorize)에 대한 단위 테스트는 충실하게 작성되어 있습니다. 그러나 `IntegrationOAuthService`의 분기 커버리지 갭(만료된 state/preview token, provider mismatch, request_scopes 모드)과 `IntegrationsService`의 `findAll`, `getActivity`, `previewTest` 미검증이 주요 위험 요소입니다. 특히 OAuth 플로우는 보안에 민감한 경로이므로 모든 분기 검증이 필수적입니다.

### 위험도

**MEDIUM**