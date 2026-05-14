## 발견사항

---

### [WARNING] `oauthCallback` — 지원하지 않는 provider 경로 미커버

- **위치**: `third-party-oauth.controller.spec.ts` — `oauthCallback error paths` describe 블록
- **상세**: 컨트롤러는 `ALLOWED_OAUTH_PROVIDERS` 에 없는 provider 에 대해 400 + error HTML 을 반환하는 분기가 존재하지만, 이를 검증하는 테스트가 없다. 예: `controller.oauthCallback('notexist', ...)` 호출 시 400 + `Unsupported OAuth provider` HTML 이 나와야 하지만 스펙이 없다.
- **제안**:
  ```ts
  it('returns 400 with error HTML for unsupported provider', async () => {
    const res = makeRes();
    await controller.oauthCallback('notexist', 'c', 's', undefined, res as never);
    expect(res.statusCode).toBe(400);
    expect(res.body as string).toContain('Unsupported OAuth provider');
    expect(oauthService.handleCallbackWithErrorCapture).not.toHaveBeenCalled();
  });
  ```

---

### [WARNING] `cafe24Install` — `CAFE24_INSTALL_MISSING_PARAMS` 조건의 부분 커버

- **위치**: `third-party-oauth.controller.spec.ts:180–203` (missing params 테스트)
- **상세**: `!mallId || !timestamp || !hmac` 조건 중 `mallId` 누락만 테스트된다. `timestamp` 만 누락되거나 `hmac` 만 누락되는 케이스는 미커버. 세 파라미터 모두 동등한 조건임에도 단일 케이스만 검증하므로 조건식 변경 시 회귀 탐지 불가.
- **제안**: `hmac` 누락 케이스 추가:
  ```ts
  it('returns 400 when hmac is missing', async () => {
    const res = makeRes();
    await controller.cafe24Install(validToken, 'shop', '1700000000', undefined, ...);
    expect(res.statusCode).toBe(400);
    expect((res.body as { code: string }).code).toBe('CAFE24_INSTALL_MISSING_PARAMS');
  });
  ```

---

### [WARNING] `cafe24Install` — 서비스 예외의 status 전파 미검증

- **위치**: `third-party-oauth.controller.ts:138–148` (catch 블록), `third-party-oauth.controller.spec.ts`
- **상세**: 컨트롤러 catch 블록은 `e.status ?? 400` 로 NestJS 예외의 HTTP 상태를 전파한다. `handleInstall` 이 `ForbiddenException(403)` 또는 `NotFoundException(404)` 를 throw 할 때 해당 status 가 응답에 올바르게 반영되는지 검증하는 테스트가 없다. 특히 403/404 분리는 spec 의 보안 전제와 직결된다.
- **제안**:
  ```ts
  it('propagates 403 when handleInstall throws ForbiddenException', async () => {
    oauthService.handleInstall.mockRejectedValue(
      Object.assign(new Error('HMAC mismatch'), {
        status: 403, response: { code: 'CAFE24_INSTALL_INVALID_HMAC', message: 'HMAC fail' }
      })
    );
    const res = makeRes();
    await controller.cafe24Install(validToken, 'shop', '1700000000', 'sig', ...);
    expect(res.statusCode).toBe(403);
    expect((res.body as { code: string }).code).toBe('CAFE24_INSTALL_INVALID_HMAC');
  });
  ```

---

### [WARNING] 토큰 길이 상한 미검증 (23자 케이스 누락)

- **위치**: `third-party-oauth.controller.spec.ts:148–167` (length rejection 테스트)
- **상세**: 정규식 `/^[A-Za-z0-9_-]{22}$/` 은 21자(하한)와 23자(상한) 모두 거부해야 한다. 현재 21자 케이스만 테스트되고 23자(64-hex 보다 짧지만 22자 초과) 케이스는 누락.
- **제안**: 23자 케이스 추가:
  ```ts
  it('rejects 23-char base64url with 404 (too long)', async () => {
    const res = makeRes();
    await controller.cafe24Install('A'.repeat(23), 'shop', ...);
    expect(res.statusCode).toBe(404);
  });
  ```

---

### [INFO] `APP_URL` 단독 설정 시 `targetOrigin` fallback 미검증

- **위치**: `third-party-oauth.controller.spec.ts` — oauthCallback describe 블록
- **상세**: `process.env.APP_URL` 만 설정하고 `FRONTEND_URL` 이 없는 경우, `targetOrigin = process.env.APP_URL` fallback 경로가 동작하는지 검증하는 테스트가 없다. 현재 모든 테스트는 `FRONTEND_URL` 을 설정한 상태에서 실행된다.
- **제안**: `FRONTEND_URL` 미설정 + `APP_URL` 설정 시 정상 처리되는 케이스를 추가.

---

### [INFO] `rawQuery` 빈 문자열 경로 미검증

- **위치**: `third-party-oauth.controller.ts:125–126` — `req.url.includes('?')` 분기
- **상세**: happy path 테스트에서 `req.url` 에 `?` 가 포함된 케이스만 커버된다. `?` 가 없는 URL (`/api/3rd-party/cafe24/install/X` 직접 호출) 시 `rawQuery = ''` 가 되는 분기는 암묵적으로만 커버된다. `handleInstall` 호출 시 `rawQuery: ''` 가 전달됨을 명시적으로 검증하면 HMAC 계산 오류 시 디버깅이 용이해진다.

---

### [INFO] 구 엔드포인트 제거 검증 부재

- **위치**: `integrations.controller.ts` — cafe24 install / callback 핸들러 전체 삭제
- **상세**: `/api/integrations/oauth/install/cafe24/:installToken` 와 `/api/integrations/oauth/callback/:provider` 가 삭제되어 라우트 자체가 404 가 되는지를 검증하는 통합 테스트나 e2e 테스트가 없다. 핸들러 삭제를 실수로 되돌려도 탐지되지 않는다. plan `cafe24-app-url-3rdparty-shorten.md` 의 e2e 보강 항목에서 다루어지지만 현재 커버리지 공백이다.

---

## 요약

`ThirdPartyOAuthController` 의 신규 단위 테스트(`third-party-oauth.controller.spec.ts`)는 토큰 포맷 검증(정규식)·파라미터 누락·happy path·env var 미설정 실패 등 핵심 경로를 충실히 커버하고 있다. `makeRes()` 헬퍼의 체이닝 구현도 실제 Express Response 동작과 잘 일치한다. 다만 지원하지 않는 provider 경로, 서비스 예외의 HTTP status 전파, 23자 토큰 상한 검증 등 경계 케이스에 빈틈이 있으며, 구 엔드포인트 삭제에 대한 회귀 방어가 없다는 점이 아쉽다. `integration-oauth.service.cafe24.spec.ts` 의 수정은 새 토큰 형식과 URL namespace 를 정확히 반영하고 있다.

## 위험도

**LOW** — 핵심 보안 경로(토큰 포맷 가드, env 미설정 시 실패 폐쇄)는 커버됨. 식별된 갭은 대부분 경계 케이스·에러 전파 경로이며, 기능 정확성보다는 회귀 탐지 안전망에 해당한다.