# 부작용(Side Effect) 리뷰

## 발견사항

### 파일 1 & 2: integration-expiry-scanner.service.ts / .spec.ts

- **[WARNING]** `isCafe24RefreshCapable` 헬퍼 함수 — `credentials` 필드를 `Record<string, unknown>` 으로 캐스팅 후 `refresh_token` 의 존재 여부를 런타임에 읽음
  - 위치: `integration-expiry-scanner.service.ts` +272~+280 (`isCafe24RefreshCapable` 함수)
  - 상세: `integration.credentials` 는 AES 암호화 column transformer 를 통해 복호화된 JSONB 이므로 런타임 타입 보장이 없다. 현재 코드는 `creds?.refresh_token` 으로 optional chaining 을 사용하고 있어 null/undefined 에 대한 방어는 돼 있다. 그러나 credentials 내부 스키마 변경이 생기면 이 함수의 동작이 조용히 바뀐다 — 타입 가드가 `typeof rt === 'string' && rt.length > 0` 수준에 그쳐서 새로운 credentials 구조(예: nested `oauth.refresh_token`)는 누락된다.
  - 제안: `Cafe24Credentials` 타입 단언을 `as Cafe24Credentials` 형태로 적용하거나, 별도 `hasCafe24RefreshToken(credentials: unknown): boolean` 유틸을 credentials 타입 정의 옆에 두어 스키마 변경 시 단일 진실로 관리.

- **[WARNING]** `connected-expiry` 0d 분기: cafe24 행에 대해 `integrationsToUpdate`(DB save) 생략 후 큐 enqueue — 알림은 여전히 `notificationsService.createMany` 로 발사되는 비대칭 부작용
  - 위치: `integration-expiry-scanner.service.ts` 수정된 0d 분기 (라인 +227~+254)
  - 상세: 기존 코드는 "DB 상태 변경 → 알림 발사" 순서로 짝을 이뤘다. 변경 후 cafe24 refresh capable 행은 DB 상태 변경 없이 알림이 발사된다. enqueue 가 성공하고 worker 가 토큰을 갱신하면 사용자는 `integration_expired` 알림을 받은 후 통합이 정상 동작하는 혼란스러운 UX 를 경험할 수 있다. 또한 enqueue 실패(Redis 장애) 시 알림만 발사되고 DB 상태·큐 모두 아무 변화 없이 패스가 종료되어 다음 날 스캐너가 같은 행을 다시 처리(재시도) 가능하다는 점은 설계 의도대로이나, 코드 주석에 "알림은 그대로 발사하여 사용자에게 가시성 유지"라고 명시된 것이 스펙과 일치함을 확인함 — 의도적 선택이므로 WARNING 수준으로만 기록.
  - 제안: 알림 발사 조건에 "이미 큐에 enqueue 됐으므로 알림 타이틀/메시지를 'refresh 진행 중' 계열로 분기"하거나, 스펙 주석에 "의도적: 사용자 가시성 우선, worker 성공 시 connected 유지 알림 별도 없음" 을 명확히 남길 것.

- **[INFO]** `cafe24RefreshQueue.add` 옵션에 `attempts: 1` 설정 — 재시도 없음
  - 위치: `integration-expiry-scanner.service.ts` +234~+239
  - 상세: 같은 패스의 `DAILY_PASS_OPTS`(`attempts: 3`)와 달리 refresh 큐 잡은 `attempts: 1`로 설정된다. Redis 순간 장애로 enqueue 자체가 실패해도 예외를 삼키고(`try/catch`) 다음 일일 패스에서 재시도되는 구조이므로 큐 잡 자체의 재시도가 없어도 운영상 문제는 없다. 그러나 worker 내부 로직의 일시적 실패(예: DB 잠금 경합)는 재시도 기회가 없다는 점은 잠재적 신뢰성 갭이다.
  - 제안: `Cafe24TokenRefreshProcessor` worker 가 이미 내부적으로 retry 정책을 가지고 있는지 확인하고, 없다면 `attempts` 값 재검토.

---

### 파일 3: ai-agent.handler.ts

- **[INFO]** `mcpDiagnosticsAcc` 배열이 `buildTools` 호출 시 `mcpDiagnostics` 인자로 전달되어 provider 내부에서 `push` 됨 — 공유 참조에 의한 암묵적 변이(mutation)
  - 위치: `ai-agent.handler.ts` +457, +465, +492 (single-turn) 및 +1392, +1505 (multi-turn)
  - 상세: `mcpDiagnosticsAcc` 는 핸들러가 소유하고 provider 가 `push` 만 하도록 설계되어 있으며 인터페이스 주석에 명확히 명시돼 있다. 그러나 provider 가 `push` 대신 `splice`, `length = 0`, 배열 교체 등의 연산을 실수로 수행해도 TypeScript 컴파일 타임에 탐지되지 않는다. 의도적 설계이나 약한 계약(contract)이다.
  - 제안: `ReadonlyArray<McpServerSummary>` 타입이 아닌 이상 현재 설계에서 강제할 방법이 없으므로 인터페이스 주석을 유지하되 허용 연산(`push` 만)을 테스트로 보장하는 것이 최선 — 이미 spec.ts 에서 검증 중.

- **[INFO]** `buildMcpDiagnosticsMeta` 가 `static private` 으로 정의되어 있으나 인스턴스 상태에 의존하지 않음 — 부작용 없음
  - 위치: `ai-agent.handler.ts` +570~+575
  - 상세: 순수 함수로 전역·클래스·인스턴스 상태를 변경하지 않으며 외부 호출도 없음. 부작용 없음.

- **[INFO]** `buildTools` 시그니처에 `mcpDiagnostics?: McpServerSummary[]` 파라미터 추가 — 기존 호출자 영향
  - 위치: `ai-agent.handler.ts` +2077~+2082 (`buildTools` 메서드 시그니처)
  - 상세: `buildTools` 는 `private` 메서드이므로 클래스 외부 호출자가 없다. 선택적 파라미터(`?`)로 추가됐으므로 기존 내부 호출 위치에서 누락해도 컴파일 오류 없이 `undefined` 로 처리된다 — provider 는 `mcpDiagnostics` 가 `undefined` 일 때 no-op(silent)하므로 기능적 퇴행 없음.

---

### 파일 4: agent-tool-provider.interface.ts

- **[INFO]** `ProviderBuildCtx` 인터페이스에 `mcpDiagnostics?: McpServerSummary[]` 필드 추가 — 인터페이스 변경
  - 위치: `agent-tool-provider.interface.ts` +621~+627
  - 상세: optional 필드 추가이므로 기존 `ProviderBuildCtx` 구현체(테스트 포함)가 해당 필드를 제공하지 않아도 컴파일 오류가 발생하지 않는다. `AgentToolProvider.buildTools(ctx)` 를 구현하는 모든 provider 는 `ctx.mcpDiagnostics` 가 `undefined` 일 수 있음을 인지해야 하며, 이를 스펙 주석에 명시("미주입 시 silently no-op")하여 계약을 문서화함. 기존 호출자 영향 없음.

---

### 파일 6: cafe24-mcp-tool-provider.ts

- **[CRITICAL]** `tryRecoverExpired` 내에서 `refreshTokenViaQueue` 호출 후 worker 가 DB 상태를 갱신하기를 기다리지 않고 즉시 `getForExecution` 재조회 — race condition 가능성
  - 위치: `cafe24-mcp-tool-provider.ts` +1175~+1207 (`tryRecoverExpired`)
  - 상세: `refreshTokenViaQueue` 는 BullMQ 큐에 잡을 enqueue 하고 `QueueEvents` 로 완료 이벤트를 대기하는 방식(`refreshViaQueue`)을 사용할 것으로 보인다. 그러나 큐 미바인딩 환경(`this.refreshQueue && this.refreshQueueEvents` 거짓)에서는 in-process `refreshAccessToken` 으로 폴백하여 `integration` 엔티티를 직접 변경한다(파일 7 참조). 이 경우 `getForExecution` 재조회는 DB 에서 신선한 row 를 가져오는데, `refreshAccessToken` 이 `integration` 객체를 in-memory 변경 후 `save()` 한다면 재조회가 갱신된 row 를 볼 수 있다. 반면 **큐 경유** 경로에서 worker 가 비동기로 실행되고 `refreshViaQueue` 가 `completed` 이벤트를 기다리는 경우, 이벤트를 받은 시점과 DB commit 시점 사이의 짧은 간격(PostgreSQL READ COMMITTED 수준)에서 재조회가 stale row 를 반환할 수 있다. `fresh.status !== 'connected'` 판별에서 간헐적 `expired_refresh_failed` 오탐이 발생할 수 있다.
  - 제안: `refreshViaQueue` 내부가 worker 의 DB commit 완료 후 이벤트를 발행함을 확인하거나, `getForExecution` 재조회에 짧은 대기(예: 1회 재시도 + 100ms 대기)를 추가하거나, `refreshViaQueue` 가 반환되는 시점에 갱신된 credentials/status 를 payload 로 돌려받는 설계로 전환하는 것을 검토할 것.

- **[WARNING]** `tryRecoverExpired` 에서 non-auth 에러(`Cafe24AuthFailedError` 아닌 예외) 도 `expired_refresh_failed` skipReason 으로 매핑 — 오해를 유발하는 side effect 분류
  - 위치: `cafe24-mcp-tool-provider.ts` +1182~+1187
  - 상세: Redis 장애, 타임아웃, 네트워크 오류 등의 transient 실패도 `expired_refresh_failed` 로 분류되어 사용자가 "refresh 자체가 실패" (토큰 무효) 와 "인프라 일시 장애"를 구분하지 못한다. 진단 UI(`meta.mcpDiagnostics.serverSummaries`) 의 목적이 사용자가 원인을 즉시 식별하는 것임을 감안하면 오해를 일으킬 수 있다.
  - 제안: `expired_refresh_transient` 같은 별도 skipReason 을 도입하거나, `logger.warn` 메시지를 상세히 남기되 skipReason 에 `(infra)` 구분자를 추가하는 것을 검토.

- **[WARNING]** `if (integration.serviceType !== 'cafe24') continue;` 분기 — 이 경우 `mcpDiagnostics` 에 어떤 summary 도 push 하지 않음 (silent skip)
  - 위치: `cafe24-mcp-tool-provider.ts` +1066~+1068
  - 상세: `service_type` 이 `cafe24` 가 아닌 ref 는 진단 summary 에 포함되지 않는다. 코드 주석에 "McpToolProvider 가 이 ref 를 처리하므로 본 provider 의 summary 에는 포함하지 않는다"고 명시돼 있어 의도적이다. 그러나 `McpToolProvider` 가 실제로 해당 ref 에 대한 summary 를 push 하는지 검증되지 않았다면 사용자는 특정 Integration 이 어떤 provider 에서도 진단되지 않은 채로 사라지는 상황이 발생할 수 있다.
  - 제안: `McpToolProvider.buildTools` 도 동일한 `mcpDiagnostics` 슬롯에 summary 를 push 하는지 확인하고, push 하지 않는다면 `not_capable` skipReason 을 이 위치에서 push 하거나 스펙(§6.2 `not_capable` 정의)과의 정합성을 점검.

---

### 파일 7: cafe24-api.client.ts

- **[WARNING]** `refreshTokenViaQueue` 의 큐 미바인딩 폴백 경로: `refreshAccessToken` 직접 호출 — 테스트 환경과 프로덕션 동작의 비대칭
  - 위치: `cafe24-api.client.ts` +1251~+1257
  - 상세: `this.refreshQueue && this.refreshQueueEvents` 가 falsy 인 경우 in-process `refreshAccessToken` 을 호출한다. `refreshAccessToken` 은 `integration` 객체를 직접 변경하고 DB `save()` 를 호출하는 부작용이 있다. 반면 큐 경유 경로는 worker 가 DB 변경을 담당한다. 테스트 환경에서 `apiClient = { call: jest.fn(), refreshTokenViaQueue: jest.fn().mockResolvedValue(undefined) }` 로 전체를 mock 하기 때문에 이 폴백 분기의 동작이 통합 테스트에서 검증되지 않는다 — 프로덕션과 다른 코드 경로가 테스트 환경에서 사용될 수 있다.
  - 제안: 폴백 경로를 명시적으로 `@VisibleForTesting` 또는 별도 메서드로 노출해 단위 테스트를 추가하거나, 폴백 자체를 제거하고 큐 미바인딩 시 `UnsupportedOperationError` 를 throw 하는 방향으로 계약을 강화.

---

### 파일 8~12: spec 문서

- **[INFO]** 스펙 문서(8~12) 는 코드 변경에 대한 사후 기술로서 직접적인 런타임 부작용을 유발하지 않음. 다만 `spec/4-nodes/3-ai/0-common.md §7` 의 `mcpServerSummaries` 필드가 turnDebug 에도 포함된다는 기술과, `ai-agent.handler.ts` 의 실제 구현(turn 단위 delta 에 `mcpServerSummaries` 를 `mcpDiagnosticsAcc` 통째로 넣는 방식)이 일치하는지 확인 필요.
  - 위치: `spec/4-nodes/3-ai/0-common.md` §7 및 `ai-agent.handler.ts` +514, +1514, +1709 (`mcpServerSummaries: mcpDiagnosticsAcc`)
  - 상세: 스펙은 "serverSummaries[] 는 buildTools 결과의 정적 스냅샷으로 노드 실행 단위로 1회 결정"이라고 했으나 구현에서는 `mcpDiagnosticsAcc` 가 `turnDebug[i].mcpServerSummaries` 에도 emit 된다. single-turn 의 경우 build 가 1회이므로 문제없다. multi-turn 에서는 매 turn 마다 새 `mcpDiagnosticsAcc` 를 생성하고 `buildTools` 를 재호출하는 구조이므로, turn 별로 snapshot 이 달라질 수 있다. 이는 스펙의 "재build → snapshot 갱신" 문구와 일치하나, turn 단위 `mcpServerSummaries` 와 최종 `meta.mcpDiagnostics.serverSummaries` 의 관계가 "delta 의 합 = 전체 누적"인 RAG 패턴과 다름을 명확히 해야 한다.
  - 제안: 스펙 §6.2 와 코드 주석 모두에 "multi-turn 에서 turn 의 `mcpServerSummaries` 는 해당 turn 의 buildTools snapshot 이며, 최종 meta 의 `serverSummaries` 는 마지막 turn 의 snapshot 이다 (RAG 누적 합산과 다름)"를 명시.

---

## 요약

이번 변경은 cafe24 통합의 `expired` 상태 자가 회복 경로를 스캐너(0d 분기 → 큐 enqueue 전환)와 `Cafe24McpToolProvider.buildTools` (expired 시 1회 refresh-then-include) 두 층으로 추가하고, 진단 정보를 `meta.mcpDiagnostics.serverSummaries` 로 노출하는 구조이다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 변경, 의도치 않은 네트워크 호출 등의 고전적 부작용은 없다. 가장 주목할 부작용은 두 가지다: (1) `tryRecoverExpired` 내 `refreshViaQueue` 완료 후 즉시 DB 재조회하는 race window — BullMQ `completed` 이벤트 수신 시점과 PostgreSQL commit 전파 사이의 간격으로 stale row 를 읽어 `expired_refresh_failed` 오탐을 낼 수 있다. (2) `refreshTokenViaQueue` 의 큐 미바인딩 폴백이 in-process `refreshAccessToken` 으로 연결되어 테스트와 프로덕션의 코드 경로가 다르게 실행된다. 나머지 발견사항은 운영·진단 가시성 관련 WARNING/INFO 수준이며 즉각적 기능 퇴행을 유발하지 않는다.

---

## 위험도

**MEDIUM**

> CRITICAL 한 건(`tryRecoverExpired` race condition)이 존재하나, 발현 빈도가 refresh 큐 worker 의 DB commit 지연과 재조회 사이의 수 ms 이내 타이밍 충돌에 한정되고, 결과가 "통합 tool 제외(skip)" 수준이며 데이터 손상을 유발하지 않는다. 다음 buildTools 호출(멀티턴 resume 또는 다음 노드 실행)에서 정상 회복된다. 전체 위험도는 MEDIUM 으로 판정한다.
