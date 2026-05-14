### 발견사항

---

**[WARNING] `expirePendingInstalls()` — TypeORM `.save(array)` 가 행 수만큼 개별 UPDATE 발행**
- 위치: `integration-expiry-scanner.service.ts`, `expirePendingInstalls()` 내 `await this.integrationRepository.save(stale)` (~line 110)
- 상세: TypeORM `Repository.save(entities[])` 는 배열을 받아도 내부적으로 엔티티별로 개별 `UPDATE` 쿼리를 실행한다. stale 행이 N개이면 DB 왕복이 N회 발생한다. 스캐너는 일일 1회 실행이라 운영 중에는 낮은 빈도지만, TTL 만료가 한꺼번에 몰리는 상황(예: 서비스 장애 후 24시간 경과)에서는 불필요한 왕복이 누적된다.
- 제안: `QueryBuilder` 를 이용한 단일 bulk UPDATE 로 교체.
  ```ts
  await this.integrationRepository
    .createQueryBuilder()
    .update()
    .set({ status: 'expired', statusReason: 'install_timeout', installToken: null })
    .where('id IN (:...ids)', { ids: stale.map(r => r.id) })
    .execute();
  ```
  이렇게 하면 1회 왕복으로 완료되고 in-memory mutation 루프도 제거된다.

---

**[WARNING] `beginCafe24Private()` — 워크스페이스 전체 cafe24 행 적재 후 in-memory 필터링**
- 위치: `integration-oauth.service.ts`, `beginCafe24Private()` ~line 760–780
- 상세: 해당 워크스페이스의 `serviceType='cafe24'` 행을 전부 로드한 뒤 `credentials.mall_id`·`credentials.app_type` 을 애플리케이션 레이어에서 필터링한다. 코드 주석에 "typical bound: <10" 이라고 명시되어 있으나, 이는 운영 가정에 불과하다. 하나의 워크스페이스에 cafe24 연동이 수십 개 쌓이거나, 향후 다른 서비스 타입이 같은 패턴을 재사용하면 복호화 비용이 선형으로 증가한다. 현재 설계에서 credentials는 암호화 JSONB 이므로 DB 레벨 필터가 불가능하다는 제약은 유효하다.
- 제안: 단기적으로는 허용 가능하나, `mall_id` 를 별도 plain 컬럼으로 분리(plan 문서에도 언급된 옵션)하면 인덱스 필터가 가능해지고 복호화 대상을 최소화할 수 있다. 또는 `take(20)` 같은 방어적 상한을 추가해 최악의 경우를 제한한다.

---

**[INFO] `process()` — 독립적인 세 패스가 순차 실행**
- 위치: `integration-expiry-scanner.service.ts`, `process()` ~line 65–90
- 상세: `run()`, `expirePendingInstalls()`, `pruneUsageLogs()` 세 메서드가 순차적으로 호출된다. 각각 독립 쿼리이고 실패 격리도 되어 있으므로 `Promise.allSettled()` 로 병렬화하면 스캔 완료 시간을 단축할 수 있다.
- 제안:
  ```ts
  await Promise.allSettled([
    this.run(now).catch(...),
    this.expirePendingInstalls(now).catch(...),
    this.pruneUsageLogs(now).catch(...),
  ]);
  ```
  스캐너가 일일 1회이므로 총 지연이 크지 않지만, 각 패스가 무거워질수록 효과가 커진다.

---

**[INFO] `toPublic()` — `isUnreadableCredentials()` 이중 호출**
- 위치: `integrations.service.ts`, `toPublic()` + `buildIntegrationMeta()` (~line 842–870)
- 상세: `buildIntegrationMeta(entity)` 내부에서 `isUnreadableCredentials(entity.credentials)` 를 한 번 호출하고, `toPublic()` 진입 직후에도 동일 함수를 호출한다. 동일 엔티티에 대해 두 번 실행되는 중복 연산이다. 함수가 순수하고 비용이 작지만, 인터페이스 목록 응답에서 N개 행을 직렬화할 때 N×2 회 실행된다.
- 제안: `toPublic()` 상단에서 결과를 변수에 저장하고 두 곳에서 재사용:
  ```ts
  const unreadable = isUnreadableCredentials(entity.credentials);
  const meta = this.buildIntegrationMeta(entity, unreadable);
  if (unreadable) { ... }
  ```

---

**[INFO] 통합 목록 `staleTime: 0` — 탭 포커스마다 목록 API 재호출**
- 위치: `frontend/integrations/page.tsx`, `useQuery` 옵션
- 상세: `staleTime: 0` + `refetchOnWindowFocus: true` 조합은 사용자가 탭을 전환할 때마다 전체 목록 API 를 재요청한다. Cafe24 Private 완료 감지 목적으로는 유효하나, 통합이 많은 워크스페이스에서 탭 전환을 자주 하는 사용자는 불필요한 요청을 지속적으로 발생시킨다.
- 제안: `staleTime: 5_000` (5초) 정도로 완화해도 Cafe24 UX를 실질적으로 저하시키지 않으면서 중복 요청을 줄일 수 있다. 또는 `pending_install` 행이 있는 경우에만 단기 staleTime 을 적용하는 조건부 처리도 가능하다.

---

**[INFO] `Cafe24PrivatePendingStep` 3초 폴링 — 탭 방치 시 지속 요청**
- 위치: `frontend/integrations/new/page.tsx`, `useQuery refetchInterval`
- 상세: 3초 간격 폴링은 사용자가 대기 화면을 열어 두고 자리를 비웠을 때 10분 타임아웃까지 총 200회의 API 요청을 생성한다. 10분 타임아웃 자체는 적절하다.
- 제안: 현재 구조로도 허용 가능하지만, exponential backoff (예: 3s → 5s → 10s) 또는 `refetchOnWindowFocus` 활용과 긴 interval 조합으로 대기 중 백그라운드 요청을 줄일 수 있다.

---

### 요약

이번 변경의 핵심 성능 개선은 명확하다 — `handleInstall()` 의 O(N) in-memory HMAC trial + `.take(100)` 풀스캔이 V043 partial unique index 기반 단일 `findOne()` + 1회 HMAC 검증으로 교체된 것은 정확하고 효과적인 개선이다. 남은 성능 위험은 두 곳이다: `expirePendingInstalls()` 의 TypeORM batch save 가 실제로는 N회 UPDATE 를 발행하는 숨겨진 N+1 쓰기 패턴(batch가 한꺼번에 만료되는 시나리오에서 누적 가능), 그리고 `beginCafe24Private()` 의 workspace 전체 행 복호화 후 in-memory 필터(현재 운영 규모에서는 허용 가능하나 `mall_id` plain 컬럼 분리 전까지는 구조적 취약점). 프론트엔드 측의 `staleTime: 0` 과 3초 폴링은 의도된 UX 트레이드오프이지만, 장기 방치 시 서버 부하를 주의할 필요가 있다.

### 위험도

**LOW** — 핵심 조회 경로는 정확히 개선되었고, 잔여 문제는 현재 규모에서 운영 위험을 즉시 초래하지 않는다. 단, `expirePendingInstalls()` 의 N+1 쓰기는 bulk update 로 교체하는 것이 권장된다.