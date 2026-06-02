# 성능(Performance) 리뷰

## 발견사항

### [WARNING] `PublicWebhookThrottleGuard`: 매 요청마다 DB 조회 — 캐싱 부재
- **위치**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` `canActivate()` trigger findOne 구간
- **상세**: Guard 가 `POST /api/hooks/:endpointPath` 요청마다 `triggerRepository.findOne({ where: { endpointPath, type: 'webhook' }, select: { authConfigId } })` 를 수행한다. 이 조회는 `HooksService` 도 동일 endpointPath 로 trigger 를 재조회하므로, 단일 요청당 **동일 PK 조회가 최소 2회** 발생한다(Guard 1회 + Service 1회). 공개 webhook 이 초당 다수 호출될 수 있는 엔드포인트에서는 DB 로드 증가가 직접적이다.
- **제안**: 옵션 A — Guard 조회 결과를 `ExecutionContext` request 객체에 `req.__trigger` 등으로 붙여 Service 가 재사용하도록 한다(가장 저비용). 옵션 B — `authConfigId IS NULL` 인 공개 trigger endpointPath 목록을 짧은 TTL(예: 60초) 로 인-메모리 캐싱하거나 Redis 에 저장해 매 요청 DB 조회를 제거한다. 현재 구조에서는 옵션 A 가 가장 단순하다.

---

### [WARNING] `PublicWebhookQuotaService.incrWithWindow`: Redis 왕복 2회 직렬화 — INCR + EXPIRE 순차 await
- **위치**: `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` `incrWithWindow()` (private 메서드)
- **상세**: `incrWithWindow` 는 `INCR key` 후 결과가 1(첫 호출)이면 `EXPIRE key windowSec` 를 순차 await 로 호출한다. `consumeStart` 는 minute + hour 두 키를 순차적으로 처리하므로 **최악 경로(두 키 모두 첫 증가)에서 Redis 왕복 4회**가 직렬로 발생한다. 단일 요청 레이턴시를 최대 ~4×RTT 만큼 증가시킨다.
- **제안**: Redis `pipeline` 으로 `INCR` + `EXPIRE` 를 단일 왕복으로 묶는다. `EXPIRE` 를 매번 설정해도 fixed-window 정확도에는 실질적 영향이 없다(윈도우 시작 의미는 유지됨). minute/hour 두 키를 하나의 pipeline 에 묶으면 Redis 왕복을 최대 4→1로 줄일 수 있다.

---

### [INFO] `measureBodyBytes`: rawBody 부재 시 JSON.stringify 임시 메모리 할당
- **위치**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` `measureBodyBytes()` private 메서드
- **상세**: `rawBody` 가 없을 때 `JSON.stringify(body)` 로 전체 body 를 다시 직렬화해 바이트를 측정한다. body 가 이미 파싱된 객체라면 이 경로는 추가 문자열 메모리를 임시 할당한다. 32KB 상한에 근접한 요청에서는 ~32KB 문자열을 한 번 더 생성하는 셈이다. GC 압력은 미미하지만 rawBody 가 없는 환경에서는 크기 추정 오류(JSON 직렬화 vs 실제 bytes 차이)도 발생할 수 있다.
- **제안**: NestJS body parser 에 `rawBody: true` 옵션을 활성화해 `rawBody` 가 항상 존재하도록 만들면 이 경로 자체를 제거할 수 있다. 현재 fallback 경로는 기능상 동작하나 rawBody 활성화가 더 정확하고 효율적이다.

---

### [INFO] `WidgetBridge.off()`: Set 비워질 때 Map 에서 즉시 삭제 — 메모리 관리 양호
- **위치**: `codebase/packages/web-chat-sdk/src/bridge.ts` `off()` 신규 구현
- **상세**: `cb` 지정 시 `set.delete(cb)` 후 `set.size === 0` 이면 `listeners.delete(event)` 를 호출해 빈 Set 이 Map 에 잔존하지 않도록 정리한다. SPA 언마운트 시 메모리 누수를 방지하는 올바른 구현이다. 별도 조치 불필요.

---

### [INFO] `installGlobal`: 큐 replay 선형 순회 — 성능 이슈 없음
- **위치**: `codebase/packages/web-chat-sdk/src/loader.ts` `installGlobal()` 큐 replay 루프
- **상세**: 스니펫 큐 호출을 순차 replay 하며 형식 불량/예외를 개별 흡수한다. 큐 크기는 통상 1-5건(boot + 소수 API 호출)으로 O(n) 선형 처리는 문제 없다.

---

## 요약

성능 관점에서 주목할 사항은 두 가지다. 첫째, `PublicWebhookThrottleGuard` 가 매 요청마다 DB 에서 trigger 를 조회하는데 `HooksService` 도 같은 조회를 수행하므로 단일 요청당 동일 DB 조회가 2회 발생한다. Guard 결과를 request 객체에 전달하는 방식으로 쉽게 제거 가능하다. 둘째, `PublicWebhookQuotaService.incrWithWindow` 가 INCR + EXPIRE 를 직렬 await 하므로 최악 경로에서 Redis 왕복이 4회 발생한다. Redis pipeline 으로 단일 왕복으로 통합하면 레이턴시를 개선할 수 있다. 나머지 변경(SDK bridge `off()` 구현, loader installGlobal 확장, wc:resize 처리)은 O(1) 또는 소규모 연산으로 성능 상 문제가 없다.

## 위험도

LOW
