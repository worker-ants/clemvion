# 성능(Performance) Review

## 발견사항

### **[INFO]** `run()` 내 `resolveRecipients` 루프 — N+1 부분 해소, 잔존 비용 존재
- **위치**: `integration-expiry-scanner.service.ts` `run()`, 라인 829-833 (전체 파일 컨텍스트 기준)
- **상세**: 기존 패턴이 N+1 DB 호출이었던 것을 `allUsers` 일괄 로딩으로 개선한 점은 긍정적이다. 그러나 이번 변경에서 `isRefreshCapable` 로직이 candidates 루프 앞 `resolveRecipients` 선행 루프보다 먼저 위치하지 않는다. refresh-capable 통합(cafe24·makeshop + refresh_token)은 알림을 발사하지 않으므로 `resolveRecipients` 자체를 호출할 필요가 없다. 현재 구조는 refresh-capable 행에 대해서도 `resolveRecipients` + Set 누적 + `prefsByUser` Map 구성을 수행한 뒤 두 번째 루프에서 `continue` 로 버린다. 전체 candidates 중 refresh-capable 비율이 높을수록 낭비가 커진다 (workspace admin 조회 포함).
- **제안**: `resolveRecipients` 루프 자체를 두 번째 루프 안으로 이동시키거나, 첫 번째 루프에서 `isRefreshCapable` 체크를 선행해 skip하도록 구조를 조정. 단, `resolveRecipients` 가 `workspacesService.findAdminUserIds` 를 호출하는 DB 쿼리라면 이 최적화는 쿼리 절감 효과가 있다.

### **[INFO]** `isRefreshCapable` 매 루프 호출 — credentials JSON 역직렬화 반복
- **위치**: `integration-expiry-scanner.service.ts` `run()` 루프 내 `isRefreshCapable` 호출, `isRefreshCapable` 함수 전체
- **상세**: `isRefreshCapable` 는 `integration.credentials as Record<string, unknown>` 캐스팅 후 `?.refresh_token` 를 체크한다. `credentials` 가 TypeORM transformer 를 통해 DB에서 이미 역직렬화된 객체라면 반복 비용은 미미하다. 그러나 만약 `credentials` 가 raw JSON string 으로 적재되어 매 접근 시 파싱이 발생하는 구조라면, candidates 수(N)에 비례하는 반복 파싱 비용이 존재한다. 이번 변경으로 `isRefreshCapable` 호출 지점이 기존 단일 분기에서 모든 임계 행으로 확대됐다(7d/3d/0d 모두).
- **제안**: TypeORM entity 레벨에서 `credentials` 에 `@Column({ transformer: ... })` 가 적용되어 이미 파싱된 객체임을 확인. 만약 raw JSON string 이라면 `run()` 시작 시점 또는 `isRefreshCapable` 내부에서 결과를 캐시할 것.

### **[INFO]** `enqueueCafe24BackgroundRefresh` — 순차 await 루프
- **위치**: `integration-expiry-scanner.service.ts` `enqueueCafe24BackgroundRefresh()`, 라인 714-737 (전체 컨텍스트)
- **상세**: `for...of targets` 루프 내 `await this.cafe24RefreshQueue.add(...)` 를 순차 실행한다. BullMQ Redis enqueue 는 단일 비동기 I/O 이므로 targets 수가 클 경우 직렬 대기 합산 지연이 발생한다. 이 잡은 6h 주기 백그라운드 패스라 엄격한 레이턴시 요구가 없으나, 수백 건 이상 targets 가 있을 경우 잡 실행 시간이 불필요하게 길어진다.
- **제안**: `Promise.all` 또는 p-limit 기반 제한 병렬화로 교체 검토. 단, Redis 연결 수 및 BullMQ 의 pipeline 지원 여부 확인 후 적용. 현 단계에서는 운영 규모가 명확하지 않으므로 INFO 수준으로 기록.

### **[INFO]** 테스트 헬퍼 `getNotifResourceIds` — 첫 번째 호출 인자만 검사
- **위치**: `integration-expiry-scanner.service.spec.ts` `getNotifResourceIds` 함수, 라인 44-52
- **상세**: 현재 헬퍼는 `mock.calls[0][0]` (첫 번째 호출의 첫 번째 인자)만 검사한다. `notificationsService.createMany` 가 여러 번 호출됐을 때(멀티 batch 시나리오) 두 번째 이후 호출에서 발사된 알림은 검사하지 못한다. 기능 결함은 아니나 알림이 복수 호출로 분산될 경우 assertion 이 false negative 를 허용한다.
- **제안**: 모든 호출을 flat map 하는 방식으로 개선(`mock.calls.flatMap(call => call[0] as Array<{resourceId?: string}>)`). 이를 통해 테스트의 단언 강도가 높아진다.

### **[INFO]** `MONITORED_QUEUES` 배열 순차 `find` — 테스트 내 사용
- **위치**: `system-status.constants.spec.ts` `MONITORED_QUEUES.find(q => q.name === MAKESHOP_REFRESH_QUEUE)`
- **상세**: `MONITORED_QUEUES` 가 배열이므로 `find` 는 O(N) 선형 탐색이다. 현재 큐 수가 14개 수준이라 실제 성능 영향은 없다. 테스트 코드에서의 사용이므로 프로덕션 경로 영향도 없다.
- **제안**: 현재 규모에서는 변경 불필요. 큐 수가 수십 개 이상으로 증가하면 `Map` 변환을 고려.

---

## 요약

이번 변경의 핵심 성능 패턴은 전반적으로 양호하다. `connected-expiry` 패스에서 refresh-capable provider 를 조기 `continue` 로 skip 하는 구조는 claim DB 삽입과 알림 발사 비용을 줄이는 긍정적 변화다. 기존 N+1 user 쿼리 개선(일괄 로딩)도 올바르게 유지된다. 다만 `resolveRecipients` 선행 루프가 refresh-capable 행에 대해서도 실행된 후 skip 되는 순서 비효율이 있으며, `enqueueCafe24BackgroundRefresh` 의 순차 enqueue 는 대규모 targets 환경에서 잠재적 병목이 될 수 있다. 나머지 지적 사항은 테스트 코드 내 assertion 강도 및 소규모 구조 개선 수준으로, 운영 클리티컬 성능 이슈는 없다.

## 위험도

LOW
