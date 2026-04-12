### 발견사항

---

**[CRITICAL]** `IntegrationExpiryScannerService.run()` — 루프 내 개별 notification save (N+1 write)
- 위치: `integration-expiry-scanner.service.ts`, `for...of` 루프 내 `notificationRepository.save(notification)` 단건 호출
- 상세: integration당 recipient 수만큼 개별 `INSERT`가 직렬로 발생. 예: integration 10개 × 조직 멤버 5명 = 50회 개별 쓰기. 매일 실행되는 배치 잡이라 누적 부하가 큼
- 제안: `notificationRepository.save(notificationsArray)`를 루프 밖에서 일괄 호출하거나 `INSERT ... VALUES (...), (...)` 형태의 bulk insert 사용

```ts
// 현재
for (const userId of recipients) {
  await this.notificationRepository.save(notification);
}

// 개선
const notifications = recipients.map(userId => this.notificationRepository.create({ ... }));
await this.notificationRepository.save(notifications); // single INSERT
```

---

**[WARNING]** `resolveRecipients()` — 전체 멤버 로드 후 JS 필터링
- 위치: `integration-expiry-scanner.service.ts:resolveRecipients()`
- 상세: `memberRepository.find({ where: { workspaceId } })`로 전체 멤버를 메모리에 적재한 뒤 `owner/admin` 조건을 애플리케이션 레이어에서 필터링. 워크스페이스 멤버가 많을수록 불필요한 데이터 전송
- 제안: DB 레벨 필터링으로 변경

```ts
const admins = await this.memberRepository.find({
  where: {
    workspaceId: integration.workspaceId,
    role: In(['owner', 'admin']),
  },
  select: ['userId'],
});
```

---

**[WARNING]** `purgeExpired()` — OAuth begin 매 요청마다 동기 실행 + 직렬 DELETE
- 위치: `integration-oauth.service.ts:purgeExpired()`, `begin()` 내 `await this.purgeExpired()`
- 상세: OAuth flow 시작 시마다 state/preview 테이블을 청소하는데, 두 DELETE가 직렬 실행됨. 소량 데이터에서는 무시할 수준이지만, 동시 OAuth begin 요청이 많을 때 불필요한 지연 유발
- 제안: `Promise.all`로 병렬화하거나, begin 흐름에서 완전히 분리해 별도 스케줄러(일 1회 등)로 위임

```ts
// 개선 (최소한 병렬화)
await Promise.all([
  this.stateRepository.delete({ expiresAt: LessThan(now) }),
  this.previewRepository.delete({ expiresAt: LessThan(now) }),
]);
```

---

**[WARNING]** `resolveRole()` — 컨트롤러 엔드포인트별 중복 DB 조회
- 위치: `integrations.controller.ts`, `create`, `rotate`, `requestScopes`, `updateScope` 각각에서 `await this.integrationsService.resolveRole(workspaceId, user.sub)` 호출
- 상세: 각 요청당 1회이므로 N+1은 아니지만, 동일한 사용자 요청에서 역할 조회가 매 엔드포인트 핸들러에서 독립적으로 실행됨. NestJS Guard나 request-scoped 캐싱으로 중앙화 가능
- 제안: `WorkspaceRoleGuard`에서 역할을 한번 조회 후 `request` 객체에 주입, 컨트롤러에서 `@WorkspaceRole()` 데코레이터로 재사용

---

**[WARNING]** 프론트엔드 리스트 쿼리 — `limit: 100` 하드코딩
- 위치: `frontend/src/app/(main)/integrations/page.tsx`, `queryFn` 내 `limit: 100`
- 상세: 페이지네이션 없이 최대 100건을 한 번에 로드. 통합 수가 늘어날수록 초기 로딩 페이로드가 선형 증가
- 제안: 서버사이드 필터링(`q`, `scope`, `serviceType`, `status`)이 이미 구현되어 있으므로 `limit: 30~50`으로 줄이고 스크롤 기반 페이지네이션 또는 명시적 페이지 UI 추가

---

**[INFO]** `IntegrationUsageLog` 엔티티 인덱스 — DESC 정렬 지원 불가
- 위치: `integration-usage-log.entity.ts`, `@Index('idx_integration_usage_log_integration_at', ['integrationId', 'at'])`
- 상세: SQL 마이그레이션(`V008`)에는 `(integration_id, at DESC)`로 DESC 정렬 인덱스가 생성되어 있으나, TypeORM `@Index` 데코레이터는 열 정렬 방향을 지정할 수 없음. activity 조회는 최신순(`at DESC`) 쿼리가 대부분이므로 ORM이 재생성할 경우 인덱스 효율 저하
- 제안: 엔티티 인덱스 데코레이터 제거하고 마이그레이션 SQL 인덱스에만 의존, 또는 `synchronize: false` 확인

---

**[INFO]** `integrations.controller.ts:activity()` — 불필요한 이중 변환
- 위치: `integrations.controller.ts`, `activity()` 핸들러
- 상세: `query.limit`를 `Number()`로 변환 후, 다시 `Number.isFinite(limit)`로 유효성 검사하는 이중 로직이 있음. `ActivityQueryDto`에서 `@Type(() => Number) @IsInt()`로 class-transformer 변환을 처리하면 컨트롤러 로직 단순화 가능
- 제안: DTO에 `@Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number` 추가로 파이프 레벨에서 처리

---

### 요약

대부분의 변경사항(포맷터 리포맷, 새 엔티티 등록, DTO 추가)은 성능 영향이 없거나 긍정적(인덱스 추가, 복합 쿼리 최적화)이다. 핵심 성능 위험은 `IntegrationExpiryScannerService`의 배치 잡 구현에 집중되어 있다: 루프 내 단건 notification INSERT(N+1 write)와 전체 멤버 로드 후 JS 필터링이 결합되면, 조직 규모에 따라 매일 실행되는 스캔 잡의 실행 시간이 선형적으로 늘어난다. OAuth begin 경로의 `purgeExpired` 직렬 실행과 프론트엔드의 고정 100건 로드는 트래픽 증가 시 보조적 병목이 될 수 있다.

### 위험도
**MEDIUM** — 현재 데이터 규모에서는 허용 가능하나, expiry scanner의 N+1 write 패턴은 조직 멤버 수×만료 integration 수에 따라 HIGH로 상승할 수 있음