## 발견사항

### [WARNING] 테스트와 구현 간 `mode` 값 불일치
- **위치**: `integration-oauth.service.cafe24.spec.ts:344` vs `integration-oauth.service.ts:~686`
- **상세**: `handleInstall` 구현에서 OAuthState를 `mode: 'reauthorize'`로 생성하지만, 테스트는 `expect(savedState.mode).toBe('reconnect')`로 단언한다. 이 테스트는 현재 구현 기준으로 실패한다.
- **제안**: 구현(`'reauthorize'`)과 테스트(`'reconnect'`) 중 하나를 통일할 것. OAuthState의 유효 mode 목록을 확인하여 어느 쪽이 맞는지 결정 필요.

---

### [WARNING] `install_token` 컬럼이 생성되지만 실제로 사용되지 않음
- **위치**: `integration-oauth.service.ts:createPrivatePendingIntegration` 및 `handleInstall`
- **상세**: Migration에서 `install_token`을 추가하고, `createPrivatePendingIntegration`에서 `randomBytes(32).toString('hex')`로 생성해 저장한다. 하지만 `handleInstall`의 매칭 로직은 `install_token`을 전혀 읽지 않고 HMAC + `mall_id`만으로 대상 Integration을 식별한다. `install_token`은 callback 완료 후 `null`로 지워질 뿐, 실제 식별에 기여하지 않는다.
- **제안**: `install_token`을 실제로 사용(쿼리 조건 추가)하거나, 미사용이 확정이라면 컬럼과 관련 코드를 이 PR에서 제거할 것. 현재는 dead code + dead column이다.

---

### [INFO] `spec/4-nodes/4-integration/4-cafe24.md` — `pending_install → active` 오기
- **위치**: `spec/4-nodes/4-integration/4-cafe24.md:5번째 단계`
- **상세**: `Integration 'pending_install → active'`로 기술되어 있으나, 실제 status는 `connected`다. 마이그레이션, entity 타입, status-badge, `4-integration.md` 모두 `connected`를 사용한다.
- **제안**: `active` → `connected`로 수정.

---

### [INFO] `integrations.service.ts` — `requestScopes`/`reauthorize` 반환 타입 과도하게 확장
- **위치**: `integrations.service.ts:666, 738`
- **상세**: `{ authUrl: string; state: string }` → `BeginResult`로 반환 타입이 확장되었다. 기술적으로는 `begin()`의 반환 타입과 일치시킨 것이지만, `requestScopes`/`reauthorize` 경로에서 `cafe24_private_pending` 결과가 반환될 수 있는 경우는 실제로 없다(mode가 `new`가 아니기 때문). 호출자 입장에서 실제로 도달할 수 없는 union branch를 처리해야 하는 부담이 생긴다.
- **제안**: 영향 범위가 작으므로 현 상태도 허용 가능하나, 해당 메서드들의 반환 타입을 `{ authUrl: string; state: string }`으로 유지하거나 narrow assertion을 추가하는 것이 더 정확하다.

---

## 요약

변경 범위는 명확하게 의도된 기능(Cafe24 Private 앱 `pending_install` + App URL HMAC 흐름)에 집중되어 있다. 무관한 파일 수정, 불필요한 리팩토링, 요청되지 않은 기능 추가는 없다. 단, 두 가지 실질적 문제가 있다: 테스트와 구현 간 `mode` 값 불일치(현재 테스트 실패 가능성), 그리고 Migration으로 추가된 `install_token` 컬럼이 실제 `handleInstall` 로직에서 전혀 활용되지 않는 dead code 상태. 나머지는 문서의 사소한 오기다.

## 위험도

**MEDIUM** — 테스트 실패 가능성(mode 불일치)과 설계된 보안 보조 수단(`install_token`)이 실제로 동작하지 않는 문제가 공존한다.