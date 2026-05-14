## 발견사항

### **[WARNING]** `handleInstall` TOCTOU 경쟁 조건 — OAuthState 중복 생성 가능
- **위치**: `integration-oauth.service.ts` — `handleInstall()` 전체 흐름 (라인 약 ~647~716)
- **상세**: `pending_install` Integration 조회 → HMAC 검증 → OAuthState 저장 까지 트랜잭션/잠금이 없다. Cafe24 가 "테스트 실행"을 짧은 간격으로 두 번 호출하거나 네트워크 재시도가 발생하면 두 요청이 동시에 동일한 `target` Integration 을 찾고 HMAC 을 통과한 뒤 각자 OAuthState 행을 생성한다. 결과적으로 동일 `integrationId` 에 state 행이 두 개 존재하게 되고, 두 callback 이 모두 도달하면 Integration 을 두 번 finalize 하려 한다.
  ```
  Request A: getMany() → HMAC OK → [window] → stateRepo.save()  ──→ callback A
  Request B: getMany() → HMAC OK → [window] → stateRepo.save()  ──→ callback B
                                     ↑ 잠금 없음
  ```
- **제안**: `pending_install` Integration 행을 `SELECT ... FOR UPDATE` 로 잠근 뒤 상태를 `installing` 등 임시 값으로 원자적으로 업데이트하거나, `integrationId`에 대한 unique partial index(status='pending_install')를 이용해 OAuthState 중복 삽입을 DB 레벨에서 차단하는 방법이 현실적이다. 가장 간단한 접근은 `handleInstall` 전체를 `dataSource.transaction()` 으로 감싸고 내부에서 `getRepository(Integration).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } })` 로 타깃을 잠그는 것이다.

---

### **[INFO]** `createPrivatePendingIntegration` — 빠른 중복 호출 시 중복 행 생성 가능
- **위치**: `integration-oauth.service.ts` — `createPrivatePendingIntegration()` (~라인 617~648)
- **상세**: `integrationRepository.create()` + `save()` 사이에 잠금이 없다. 사용자가 [Connect with Cafe24] 를 빠르게 두 번 클릭하면 두 개의 `pending_install` Integration 이 생성된다. `(workspaceId, name)` unique 제약이 있어 이름이 동일하면 DB 에서 걸리지만, 이름이 다르면(예: 타임스탬프 포함 명칭 사용 시) 통과된다. 현재 코드에서 이름을 동적으로 변경하지 않으므로 `UNIQUE_VIOLATION` 으로 최종 막히나, 에러 응답이 불친절할 수 있다.
- **제안**: unique 제약 위반을 catch 해 `CAFE24_PENDING_ALREADY_EXISTS` 등 명시적 오류 코드로 변환하는 것이 권장된다. 근본적으로는 `(workspaceId, serviceType, status='pending_install', mall_id)` 복합 partial unique index를 DB 에 추가하는 것이 더 안전하다.

---

### **[INFO]** `handleInstall` 전체 스캔 → TOCTOU 창(window) 확대
- **위치**: `integration-oauth.service.ts` ~라인 663~677
- **상세**: `pending_install` + `service_type='cafe24'` 조건의 전체 행을 메모리로 로드한 뒤 HMAC 을 순차 검증한다. 행이 많아질수록 반복 시간이 길어지고 TOCTOU 창이 커진다. 또한 `mall_id` 필터가 DB 쿼리 수준에서 없어 불필요한 행을 다 읽는다.
  ```typescript
  // 현재: mall_id 필터 없이 전체 pending 조회
  .where("i.service_type = 'cafe24'")
  .andWhere("i.status = 'pending_install'")
  .getMany();
  ```
- **제안**: 아래처럼 `mall_id` 를 credentials JSONB 로 인덱싱하거나, `.andWhere("i.credentials->>'mall_id' = :mallId", { mallId: query.mall_id })` 조건을 추가해 후보군을 줄이면 스캔 시간 단축과 TOCTOU 창 축소 두 가지를 동시에 얻을 수 있다. (`encryptedJsonTransformer` 가 credentials 를 암호화한다면 DB 쿼리 필터는 적용 불가 — 이 경우 `installToken` 을 App URL 에 query param 으로 포함시켜 인덱스 조회 후 단일 후보만 HMAC 검증하는 구조가 더 안전하다.)

---

## 요약

이번 변경의 동시성 핵심 위험은 `handleInstall` 의 **트랜잭션 없는 read-verify-write 패턴**이다. Cafe24 가 재시도 또는 중복 호출을 보낼 때 같은 `pending_install` Integration 에 대해 OAuthState 행이 두 개 생성될 수 있고, 후속 callback 흐름이 둘 다 도달하면 Integration finalize 가 두 번 시도된다. 실운영에서 Cafe24 의 "테스트 실행" 중복 호출은 드물어 실제 사고 확률은 낮지만, 구조 자체는 안전하지 않다. `createPrivatePendingIntegration` 의 중복 방어는 DB unique 제약이 최후 보루로 작동하고 있어 데이터 정합성은 보호되나 UX(에러 메시지)가 거칠다. 나머지 비동기(`async/await`) 사용, 이벤트 루프 블로킹, 데드락 위험 요소는 없다.

## 위험도

**LOW** (실운영 재현 확률이 낮으나 구조적 결함은 존재함)