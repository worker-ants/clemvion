### 발견사항

---

**[CRITICAL] `expirePendingInstalls` — find() 인수 미검증**
- 위치: `integration-expiry-scanner.service.spec.ts` — `expirePendingInstalls` describe block
- 상세: 두 테스트 모두 `integrationRepo.find.mockResolvedValue(stale)` 만 설정하고, `find`가 `{ status: 'pending_install', createdAt: LessThan(cutoff) }` 로 호출됐는지 검증하지 않는다. TTL 상수(`PENDING_INSTALL_TTL_HOURS = 24`)가 잘못 바뀌거나 `LessThan(cutoff)` 대신 `LessThanOrEqual`·`MoreThan` 등으로 변경돼도 테스트는 여전히 통과한다. 핵심 TTL 경계 로직이 보호되지 않는다.
- 제안:
  ```ts
  expect(integrationRepo.find).toHaveBeenCalledWith({
    where: {
      status: 'pending_install',
      createdAt: expect.objectContaining({ _type: 'lessThan' }), // TypeORM FindOperator
    },
  });
  // cutoff = now - 24h 임을 검증
  const callArg = integrationRepo.find.mock.calls[0][0];
  const cutoff = callArg.where.createdAt.value as Date;
  expect(now.getTime() - cutoff.getTime()).toBeCloseTo(24 * 3600 * 1000, -3);
  ```

---

**[CRITICAL] `process()` 의 독립 에러 핸들링 미검증**
- 위치: `integration-expiry-scanner.service.ts` — `process()` 메서드
- 상세: 세 개의 패스(`run`, `expirePendingInstalls`, `pruneUsageLogs`)가 각자 `.catch()`로 격리돼 있는 것이 핵심 설계인데, 이를 검증하는 테스트가 없다. `run`이 throw해도 `expirePendingInstalls`·`pruneUsageLogs`가 실행되는지, 그 반대도 마찬가지다. spec §1.4("독립 실행, 실패 격리")에 명시된 계약이 무보증 상태다.
- 제안:
  ```ts
  it('pruneUsageLogs runs even when expirePendingInstalls throws', async () => {
    jest.spyOn(scanner, 'expirePendingInstalls').mockRejectedValue(new Error('boom'));
    jest.spyOn(scanner, 'pruneUsageLogs').mockResolvedValue(0);
    await expect(scanner.process(job)).resolves.not.toThrow();
    expect(scanner.pruneUsageLogs).toHaveBeenCalled();
  });
  ```

---

**[WARNING] 컨트롤러 레이어 — 신규·레거시 라우트 무테스트**
- 위치: `integrations.controller.ts` — `@Get('oauth/install/cafe24/:installToken')`, `@Get('oauth/install/cafe24')`
- 상세: `:installToken` param 바인딩(`@Param('installToken')`)과 레거시 410 응답(`cafe24InstallLegacy`)에 대한 컨트롤러 단위 테스트나 e2e 테스트가 없다. NestJS 라우트 충돌(`:installToken` 라우트가 정적 `oauth/install/cafe24` 라우트보다 먼저 매칭될 수 있음), param 추출 실패, 410 응답 body 형식이 배포 시점까지 검증되지 않는다.
- 제안: 컨트롤러 spec에 다음 케이스 추가
  - `GET /oauth/install/cafe24` → 410, body에 `CAFE24_INSTALL_LEGACY_PATH`
  - `GET /oauth/install/cafe24/sometoken` → `oauthService.handleInstall('sometoken', ...)` 호출됨
  - `handleInstall` throw 시 → 302 → error HTML로 리다이렉트

---

**[WARNING] `buildIntegrationMeta` — 전용 단위 테스트 없음**
- 위치: `integrations.service.ts` — `buildIntegrationMeta()`
- 상세: 새로 추가된 private 메서드가 `toPublic`을 통해 간접적으로만 호출되며 직접 단위 테스트가 없다. 다음 경계 케이스들이 미검증이다: (1) `app_type`이 `'public'`/`'private'` 외의 값일 때 `null` 반환, (2) cafe24 + `isUnreadableCredentials(true)` → `null`, (3) non-cafe24 serviceType → `null`.
- 제안: `integrations.service.spec.ts`에 `buildIntegrationMeta` describe 블록 추가. 또는 `public`으로 승격하여 직접 테스트.

---

**[WARNING] `handleInstall` — `secret` 타입 체크·빈 토큰 분기 미검증**
- 위치: `integration-oauth.service.cafe24.spec.ts`
- 상세: `typeof secret !== 'string'` 분기와 `installToken.length === 0` 체크(`!installToken`)가 테스트에 없다. 특히 credentials에 `client_secret`이 없는 pending row가 조회될 때 ForbiddenException을 던지는 경로가 무보증이다.
- 제안:
  ```ts
  it('throws CAFE24_INSTALL_INVALID_HMAC when client_secret is missing from row', async () => {
    integrationRepo.findOne.mockResolvedValue(makePendingRow({
      credentials: { mall_id: 'priv-shop', app_type: 'private', scopes: [] },
      // client_secret 없음
    }));
    const error = await service.handleInstall(INSTALL_TOKEN, { ... }).catch(e => e);
    expect(error.response?.code).toBe('CAFE24_INSTALL_INVALID_HMAC');
  });
  ```

---

**[WARNING] V043 마이그레이션 — Partial UNIQUE 동작 미검증**
- 위치: `V043__cafe24_install_token_index.sql`
- 상세: Partial UNIQUE 인덱스(`WHERE install_token IS NOT NULL`)의 핵심 특성인 "NULL은 다수 허용, 비-NULL은 중복 불허"가 e2e/integration 테스트로 검증되지 않는다. 마이그레이션 의도와 인덱스 DDL이 일치하는지 DB에서 직접 확인할 테스트가 없다.
- 제안: e2e suite에 마이그레이션 상태 검증 추가 — `pg_indexes` 조회로 `indpred` 확인 또는 실제 NULL·비-NULL row 삽입으로 제약 동작 검증.

---

**[WARNING] 프론트엔드 — 폴링 로직·팝업 감지 무테스트**
- 위치: `frontend/src/app/(main)/integrations/new/page.tsx` — `useEffect` popup closed 감지, `Cafe24PrivatePendingStep` polling
- 상세: popup `.closed` 감지(500ms 인터벌 + 1500ms 지연), 10분 타임아웃 후 폴링 정지, `connected` 전이 시 route.replace 등 사용자 흐름의 핵심 로직이 RTL 테스트로 커버되지 않는다. `transitionedRef` 가드도 검증 불가 상태.
- 제안: `Cafe24PrivatePendingStep` RTL 테스트 추가. mock `useQuery`로 `pending_install → connected` 전이 시뮬레이션, `router.replace` 호출 검증.

---

**[INFO] `ERROR_CLOSE_DELAY_MS` 상수화 — 테스트 개선**
- 위치: `oauth-callback.template.spec.ts` L91
- 상세: `>= 1000` → `.toBe(ERROR_CLOSE_DELAY_MS)` 로 변경된 것은 올바른 방향. 상수가 바뀌면 테스트가 같이 바뀌고, magic number가 제거됐다. 양호.

---

**[INFO] `isReauthorizeDisabled` — 커버리지 양호**
- 위치: `status-badge.test.tsx`
- 상세: 5가지 케이스(pending_install, expired+install_timeout, cafe24 private, cafe24 public, non-cafe24)가 모두 독립적으로 테스트됨. `meta?.appType` optional chaining 처리도 암묵적으로 검증된다.

---

**[INFO] DTO 필드 변경 반영 누락 위험**
- 위치: `status-badge.test.tsx` L22-23 — `lastCheckedAt`/`expiresAt` → `lastUsedAt`/`lastRotatedAt`
- 상세: 테스트 factory가 필드명 변경을 반영했는데, 이는 `IntegrationDto` 타입과 동기화된 것으로 보인다. 단, 실제 API 응답의 필드명과 DTO 타입이 일치하는지는 e2e 테스트로만 보장 가능하다.

---

### 요약

전반적으로 단위 테스트 구조는 양호하다. `isReauthorizeDisabled`·`computeStatus`·`expirePendingInstalls` no-op·handleInstall 에러 분기 등 핵심 경로가 커버됐다. 그러나 두 개의 Critical 갭이 있다: (1) `expirePendingInstalls`의 TTL cutoff 계산이 find() 호출 인수를 검증하지 않아 24h 경계 로직이 무보증 상태이고, (2) `process()` 의 독립 에러 격리 패턴(spec §1.4 계약)이 전혀 테스트되지 않는다. 컨트롤러 레이어(신규 `:installToken` 라우트·410 레거시 응답)와 `buildIntegrationMeta` 메서드 테스트가 누락됐으며, 프론트엔드 폴링·팝업 감지 로직은 RTL 테스트 없이 배포된다.

### 위험도
**HIGH**