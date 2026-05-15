## 발견사항

### [CRITICAL] `handleInstall` 테스트의 state.mode 어설션 오류
- **위치**: `integration-oauth.service.cafe24.spec.ts` — `handleInstall` happy path 테스트
- **상세**: 서비스 코드는 `stateRepository.create({ ..., mode: 'reauthorize', ... })`를 호출하지만, 테스트는 `expect(savedState.mode).toBe('reconnect')`를 단언한다. `makeRepo().create`는 인자를 그대로 반환하므로 `stateRepo.create.mock.calls[0][0].mode`는 `'reauthorize'`이고, 이 테스트는 **현재 상태로 실행 시 반드시 실패**한다.
- **제안**: 단언을 `'reconnect'` → `'reauthorize'`로 수정

---

### [CRITICAL] `handleCallback`의 `pending_install` 분기에 대한 테스트 부재
- **위치**: `integration-oauth.service.ts:393–396` (새 OR 조건), `integration-oauth.service.cafe24.spec.ts`
- **상세**: 콜백 처리에서 `integration.status === 'pending_install'` 조건이 추가되었으나, 기존 콜백 테스트(`handleCallback — cafe24 stub flow`)는 이 분기를 전혀 실행하지 않는다. `installToken = null` 초기화(`service.ts:413`)도 마찬가지로 미검증 상태다.
- **제안**: `state.mode = 'reconnect'` + `integration.status = 'pending_install'`인 픽스처로 콜백 테스트 추가; `integration.installToken`이 `null`로 저장되는지 검증

---

### [WARNING] HMAC 불일치 시나리오 테스트 누락 (후보 존재 케이스)
- **위치**: `handleInstall — Cafe24 private app App URL` describe 블록
- **상세**: 현재 "HMAC 검증 실패" 테스트(`throws CAFE24_INSTALL_INVALID_HMAC`)는 후보 목록이 비어있는 경우만 다룬다. `pending_install` Integration이 존재하지만 `client_secret`이 다른 경우(HMAC 서명 불일치) 또는 `mall_id`가 일치하지 않는 후보만 있는 경우에 대한 테스트가 없다.
- **제안**: `makeQueryBuilder([makePendingCandidate({ credentials: { ...wrongSecret } })])` 시나리오 추가

---

### [WARNING] `cafe24Install` 컨트롤러 엔드포인트 테스트 전무
- **위치**: `integrations.controller.ts` — `cafe24Install` 메서드
- **상세**: 컨트롤러 계층의 로직(필수 파라미터 누락 체크, `req.url.split('?', 2)[1]`을 통한 `rawQuery` 추출, 에러 상태 코드 매핑)은 단위 테스트가 전혀 없다. 특히 `rawQuery` 추출은 프록시 헤더나 URL 인코딩 처리가 관여하는 복잡한 경계값을 가진다.
- **제안**: `req.url` 목업을 포함한 컨트롤러 단위 테스트 추가; 파라미터 누락 → 400, `handleInstall` throw → 에러 코드 매핑 검증

---

### [WARNING] 프론트엔드 변경사항 테스트 없음
- **위치**: `status-badge.tsx`, `new/page.tsx`
- **상세**: `needsAttention` 함수의 로직 변경(`pending_install` 상태에서 `false` 반환)과 `Cafe24PrivatePendingStep` 컴포넌트가 테스트 없이 추가되었다. 특히 `needsAttention`은 순수 함수라 단위 테스트 작성이 용이하다.
- **제안**: `needsAttention('pending_install')` → `false`, `needsAttention('connected', 만료임박)` → `true` 등 단위 테스트 추가

---

### [INFO] 타임스탬프 NaN 분기 미검증
- **위치**: `integration-oauth.service.ts` — `handleInstall`, `parseInt(query.timestamp, 10)` 검사
- **상세**: `timestamp: 'abc'` 같은 비숫자 입력 시 `isNaN(timestampSec)` 조건으로 거부되지만, 이를 다루는 테스트 케이스가 없다.
- **제안**: `timestamp: 'not-a-number'`로 `BadRequestException` 발생 여부 단언하는 케이스 추가 (한 줄 추가로 해결)

---

### [INFO] 복수 후보 순회 시나리오 미검증
- **위치**: `handleInstall` 내 for 루프 (service.ts)
- **상세**: 같은 `mall_id`에 대해 `pending_install` Integration이 여러 개 있고, 첫 번째 후보의 HMAC은 불일치하고 두 번째가 일치하는 시나리오가 테스트되지 않는다.
- **제안**: `makeQueryBuilder([makePendingCandidate({ credentials: { ...wrongSecret } }), candidate])` 형태의 테스트 추가

---

## 요약

신규 도입된 `handleInstall` 테스트 구조(HMAC 검증 헬퍼, QueryBuilder 목업, 타임스탬프 재전송 방어 테스트)는 전반적으로 잘 설계되어 있다. 그러나 happy path 테스트의 `mode: 'reconnect'` 단언이 실제 서비스가 저장하는 `'reauthorize'`와 불일치해 **현재 테스트 스위트가 실행 불가** 상태이며, `pending_install → connected` 전환 경로(`handleCallback` 신규 분기 + `installToken = null`)에 대한 검증이 전혀 없다는 점이 가장 큰 위험 요소다.

## 위험도

**HIGH** — CRITICAL 수준의 테스트 실패(단언 오류)와 핵심 상태 전이 경로의 테스트 공백이 동시에 존재한다.