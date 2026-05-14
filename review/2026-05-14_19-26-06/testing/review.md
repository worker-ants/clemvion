이제 전체 분석을 수행할 수 있습니다.

---

## Testing Code Review

### 발견사항

---

**[CRITICAL] 컨트롤러 에러 핸들러 경로에 테스트가 전혀 없음**
- **위치**: `integrations.controller.ts:307-319` — `callbackContextOf` + `markIntegrationCallbackError` 호출 블록
- **상세**: 이 변경의 핵심 로직(에러 발생 시 사용자에게 진단 정보를 노출하는 경로)이 완전히 미검증 상태다. `integrations.controller.spec.ts` 파일 자체가 존재하지 않는다. 다음 분기가 전혀 테스트되지 않았다:
  - `callbackContextOf(err)`가 context를 반환할 때 `markIntegrationCallbackError`가 호출되는가
  - context가 없을 때 (`undefined` 반환) 호출되지 않는가
  - `errorCode` 추출 로직: `e.response?.code ?? 'OAUTH_CALLBACK_FAILED'`의 fallback 경로
  - `markIntegrationCallbackError` 자체가 throw해도 HTML 응답이 전송되는가 (`await` 중 예외 시 응답 차단 위험)
- **제안**:
  ```typescript
  // integrations.controller.spec.ts (신규 생성)
  it('calls markIntegrationCallbackError when callbackContextOf returns context', async () => { ... });
  it('uses OAUTH_CALLBACK_FAILED as default errorCode when response.code is absent', async () => { ... });
  it('does not call markIntegrationCallbackError when context is undefined', async () => { ... });
  ```

---

**[WARNING] `computeStatus` 변경에 대한 FE 테스트 부재**
- **위치**: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `computeStatus` 함수
- **상세**: `status-badge.tsx` 및 `computeStatus`를 커버하는 테스트 파일이 존재하지 않는다. 새로 추가된 분기가 모두 무검증 상태다:
  - `pending_install` + `statusReason` 존재 시 → tone `'err'`, detail `'Last error: ...'`
  - `pending_install` + `statusReason` 없을 때 → tone `'warn'`, 기존 메시지 유지
  - `expired` + `statusReason === 'install_timeout'` → 특정 안내 메시지 노출
  
  `computeStatus`는 순수 함수라 단위 테스트 작성 비용이 낮다.
- **제안**:
  ```typescript
  it('shows err tone and Last error detail when pending_install has statusReason', () => {
    const result = computeStatus({ status: 'pending_install', statusReason: 'oauth_token_exchange_failed', ... });
    expect(result.tone).toBe('err');
    expect(result.detail).toBe('Last error: oauth_token_exchange_failed');
  });
  it('shows warn tone when pending_install has no statusReason', () => { ... });
  it('shows install timeout detail for expired with install_timeout reason', () => { ... });
  ```

---

**[WARNING] `handleCallback` 코드 교환 실패 + context 첨부 경로가 직접 테스트되지 않음**
- **위치**: `integration-oauth.service.ts:368-376` — `exchangeCodeForToken` try/catch
- **상세**: `exchangeCodeForToken`이 실패할 때 `withContext(err)`로 context가 첨부되는 경로가 가장 빈번한 실패 시나리오(Cafe24 인증 코드 교환 실패)임에도 불구하고, 새 spec 테스트들은 state-expired와 row-missing 시나리오만 커버한다. 이 경로가 실제로 context를 올바르게 전달하는지 검증하는 테스트가 없다.
- **제안**:
  ```typescript
  it('attaches context when token exchange fails', async () => {
    // mock: valid state row returned, exchangeCodeForToken throws
    mockProviderService.exchangeCode.mockRejectedValue(new Error('network'));
    const error = await service.handleCallback(...).catch(e => e);
    expect(callbackContextOf(error)?.integrationId).toBe('int-42');
  });
  ```

---

**[WARNING] missing-row context 테스트의 검증 범위가 불완전**
- **위치**: `integration-oauth.service.spec.ts` — `attaches callback context when row is missing` 테스트
- **상세**: 같은 describe 블록의 다른 테스트(`state expired`)는 context 전체 형상(`integrationId`, `workspaceId`, `mode`)을 `toEqual`로 검증하지만, missing-row 테스트는 `ctx?.integrationId`만 확인한다. workspaceId나 mode가 잘못 전달돼도 테스트가 통과한다.
- **제안**: `toEqual({ integrationId: 'int-vanished', workspaceId: 'ws-1', mode: 'reauthorize' })` 로 full shape 검증.

---

**[INFO] `callbackContextOf` 헬퍼가 직접 단위 테스트되지 않음**
- **위치**: `integration-oauth.service.ts:132-138` — export된 `callbackContextOf`
- **상세**: 이 함수는 controller에서 직접 import해 사용하는 핵심 헬퍼지만, 자체 단위 테스트가 없다. `context` 필드가 없는 객체, null, 원시값 등에 대한 동작이 암묵적으로만 검증된다.

---

**[INFO] template 테스트의 setTimeout 정규식이 구현 세부사항에 결합됨**
- **위치**: `oauth-callback.template.spec.ts:75` — `html.match(/setTimeout\([^,]+,\s*(\d+)\s*\)/)`
- **상세**: 이 정규식은 `setTimeout(function(){ ... }, 4000)` 형태에 의존한다. arrow function(`() =>`) 또는 다른 호출 형태로 변경되면 정규식이 silently 실패해 `match`가 null을 반환하고, `expect(match).not.toBeNull()` 이 실패하지만 타임아웃 값 검증(`Number(match![1])`)은 `!` 연산자로 인해 런타임 에러가 발생한다. `>= 1000` 상한도 없어 임의로 큰 값(`setTimeout(..., 9999999)`)도 통과한다.

---

**[INFO] `markIntegrationCallbackError`의 `error` 상태 행 처리가 미검증**
- **위치**: `integration-oauth.service.ts:526-533`
- **상세**: `status === 'error'`인 행에 대해 코드는 last_error만 업데이트하고 status를 보존한다(암묵적 fallthrough). 이 동작이 의도적임을 확인하는 테스트가 없어 spec §10.4의 에러 매핑 표와 실제 구현의 정합을 코드만으로 판단해야 한다.

---

### 요약

`markIntegrationCallbackError`의 단위 테스트(5개)와 `handleCallback` context 첨부 테스트(3개), `renderCallbackHtml` delay 테스트(2개)는 명확하고 의도를 잘 표현하며 격리도 잘 되어있다. 그러나 변경 0의 핵심 연결 고리인 **컨트롤러 에러 핸들러 경로가 완전히 미검증**이며, 이 경로가 동작하지 않으면 `markIntegrationCallbackError`의 정밀한 단위 테스트도 실제 사용자 경험에 기여하지 못한다. FE `computeStatus` 변경도 테스트가 전혀 없다. 컨트롤러 spec 신규 작성과 `status-badge` 단위 테스트 추가가 이번 PR의 가장 큰 테스트 갭이다.

### 위험도

**MEDIUM** — 서비스 레이어는 잘 테스트되었으나, 컨트롤러 통합 경로와 프론트엔드 표시 로직의 미검증이 리그레션 위험을 남긴다.