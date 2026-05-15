### 발견사항

---

**[WARNING] OAuth 콜백 상태 토큰의 TOCTOU(Time-of-Check-Time-of-Use) 경쟁 조건**
- 위치: `integration-oauth.service.ts` — `handleCallback()`
- 상세: `findOne`으로 상태 레코드를 읽은 후, `finally` 블록에서 `delete`하는 흐름이 원자적이지 않습니다. 네트워크 재시도나 브라우저 중복 요청으로 동일한 `state` 파라미터로 두 요청이 거의 동시에 도달할 경우, 두 요청 모두 `findOne` 통과 → 유효성 검사 통과 → `new` 모드 시 previewToken 이중 생성, `reauthorize` 모드 시 integration 이중 갱신이 발생할 수 있습니다.
- 제안: `DELETE ... WHERE state = ? RETURNING *` 형식의 원자적 claim-and-delete를 사용하거나, `SELECT ... FOR UPDATE` 후 삭제하는 방식으로 변경하세요. TypeORM 기준으로는 raw query 또는 트랜잭션 내 비관적 락 사용이 적합합니다.

```typescript
// 현재 (비원자적)
const record = await this.stateRepository.findOne({ where: { state } });
if (!record) throw ...;
// ... 작업 수행 ...
finally { await this.stateRepository.delete(record.id); }

// 권장: 트랜잭션 + FOR UPDATE
const record = await dataSource.transaction(async (em) => {
  const r = await em.findOne(IntegrationOAuthState, {
    where: { state },
    lock: { mode: 'pessimistic_write' },
  });
  if (!r) return null;
  await em.delete(IntegrationOAuthState, r.id);
  return r;
});
if (!record) throw new BadRequestException(...);
```

---

**[WARNING] previewToken 비원자적 소비 — 일회성 토큰 재사용 가능**
- 위치: `integration-oauth.service.ts` — `consumePreviewToken()`
- 상세: `findOne`으로 previewToken을 읽고 유효성을 검사한 후 `delete`하는 구조가 원자적이지 않습니다. 동일한 previewToken으로 두 요청이 동시에 들어오면 두 요청 모두 `findOne` 통과 → 자격증명 반환 → `create` 뮤테이션이 각각 실행될 수 있습니다. OAuth 자격증명이 여러 Integration에 중복 저장될 수 있습니다.
- 제안: `handleCallback`과 동일하게 DELETE RETURNING 패턴으로 원자적으로 처리하세요.

```typescript
// 권장: 원자적 소비
const result = await this.previewRepository
  .createQueryBuilder()
  .delete()
  .where('preview_token = :token AND workspace_id = :ws AND user_id = :uid AND expires_at > NOW()',
    { token: previewToken, ws: workspaceId, uid: userId })
  .returning('*')
  .execute();
if (!result.raw.length) throw new BadRequestException(...);
```

---

**[INFO] `run()` 내부 알림 직렬 생성 — 대규모 스캔 시 지연 가능**
- 위치: `integration-expiry-scanner.service.ts` — `run()` 내부 중첩 for 루프
- 상세: 모든 integration과 각 수신자에 대한 알림을 순차적으로 `await`합니다. 만료 임박 integration이 많거나 대규모 조직인 경우 단일 스캔 실행 시간이 늘어나 BullMQ job 타임아웃에 근접할 수 있습니다.
- 제안: 알림 생성은 `Promise.all()`로 병렬화하거나, `notificationRepository.save([])`로 배치 삽입하세요.

---

**[INFO] `claimThreshold()` — DB 유니크 제약 기반 분산 중복 방지는 올바름**
- 위치: `integration-expiry-scanner.service.ts` — `claimThreshold()`
- 상세: `INSERT` 실패 시 PostgreSQL `23505` 코드를 잡아 "이미 처리됨"으로 판단하는 패턴은 수평 확장(다중 워커) 환경에서 분산 중복 실행 방지의 올바른 구현입니다. 별도 코멘트 없음.

---

**[INFO] `purgeExpired()`의 `await` 호출과 주석 불일치**
- 위치: `integration-oauth.service.ts` — `begin()` 및 `purgeExpired()` 주석
- 상세: `purgeExpired`의 JSDoc에 "Fire-and-forget"이라 적혀 있지만 `begin()`에서 `await this.purgeExpired()`로 호출합니다. 내부에 try-catch가 있으므로 실질적 오동작은 없지만, 주석이 오해를 유발합니다.
- 제안: 주석을 "Non-critical cleanup; errors are swallowed"로 수정하거나, fire-and-forget이 의도라면 `void this.purgeExpired()`로 변경하세요.

---

### 요약

전반적으로 동시성 설계는 의도적으로 구성되어 있으며 BullMQ 기반 스케줄 처리와 DB 유니크 제약을 활용한 분산 중복 방지는 올바르게 구현되어 있습니다. 다만 OAuth 흐름의 두 핵심 지점 — `handleCallback`의 상태 토큰 소비와 `consumePreviewToken`의 일회성 토큰 처리 — 에서 동일한 TOCTOU 패턴이 발생합니다. OAuth 콜백은 일반적으로 단발성이지만 브라우저 재시도, 네트워크 레이어 재전송, 또는 테스트 환경에서의 중복 요청 시나리오에서 실제로 트리거될 수 있으므로 원자적 DELETE RETURNING 패턴으로 보강하는 것이 권장됩니다.

### 위험도

**MEDIUM**