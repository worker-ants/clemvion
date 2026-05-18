# Performance Review

## 발견사항

### 파일: cafe24-mcp-tool-provider.ts — `tryRecoverExpired`

- **[WARNING]** `tryRecoverExpired` 의 직렬 2-hop DB 조회 (refresh 성공 후 re-fetch)
  - 위치: `cafe24-mcp-tool-provider.ts` — `tryRecoverExpired()` 내 `this.integrationsService.getForExecution()` 두 번째 호출 (파일 기준 diff +1192~+1208)
  - 상세: `expired` 행이 검출되면 (1) `refreshTokenViaQueue` (큐 enqueue → BullMQ worker 완료 대기), (2) `getForExecution` 재조회 순으로 직렬 실행된다. `buildTools` 자체가 `mcpServers[]` 루프 내에서 await 하므로, expired cafe24 Integration 이 N개일 때 최악 O(N) 개의 refresh 왕복 지연이 누적된다. BullMQ worker 가 완료될 때까지 `buildTools` 호출이 블로킹되므로 AI Agent 노드 실행 latency 에 직접 영향을 준다. 단일 expired 통합이라면 영향이 미미하지만, 여러 통합이 동시에 expired 인 경우 latency 가 선형 누적된다.
  - 제안: 현 설계(직렬 1회 시도)는 "정상 케이스에선 추가 latency 없음" 을 spec 에서 명시하고 있고, 실제 expired+refresh_token 케이스가 드문 예외 경로임을 전제로 허용 가능한 범위다. 다만 `mcpServers[]` 가 커지는 환경을 대비해, refresh 시도를 병렬(`Promise.allSettled`)로 실행하는 전략을 follow-up 으로 검토할 것을 권장한다.

- **[INFO]** `tryRecoverExpired` 내 non-auth 오류의 동일 `skipReason` 처리
  - 위치: `cafe24-mcp-tool-provider.ts` diff +1182~+1187
  - 상세: `Cafe24AuthFailedError` 가 아닌 transport/네트워크 오류도 `expired_refresh_failed` 로 반환한다. 실패 구분 없이 동일 skip 처리로 재시도 없이 skip 하는 것은 일시적 네트워크 오류에서 불필요한 스킵을 유발할 수 있다. 다음 `buildTools` 호출(다음 AI Agent turn)에서 재시도되므로 영속 실패는 아니지만, 같은 노드 실행 내에서는 recover 기회가 없다.
  - 제안: 현재 구현 범위(1회 시도)는 spec 설계 의도와 일치하므로 허용 가능. transport 오류 재시도 필요 시 별도 spec 갱신 후 진행.

---

### 파일: integration-expiry-scanner.service.ts — `run()` 의 0d 분기

- **[INFO]** 루프 내 순차 `cafe24RefreshQueue.add` 호출
  - 위치: `integration-expiry-scanner.service.ts` diff +229~+249, 루프 내 `await this.cafe24RefreshQueue.add(...)` 패턴
  - 상세: `run()` 의 기존 루프 구조 내에서 cafe24 + refresh_token 행마다 순차 await 로 큐 enqueue 한다. BullMQ 의 `add()` 는 Redis 단일 명령으로 빠르게 완료되므로 실질적 병목은 낮으나, 대량 행 처리 시 N회 순차 Redis 왕복이 발생한다. `addBulk` 를 사용하면 단일 요청으로 줄일 수 있다.
  - 제안: 큐 enqueue 대상을 루프에서 수집 후 `cafe24RefreshQueue.addBulk([...])` 로 일괄 처리하는 리팩토링을 검토. 현재 통합 수가 적을 경우 영향 미미하며, 현 구조가 에러 격리(개별 try-catch)를 단순하게 유지하는 장점이 있으므로 즉시 필수 수정은 아니다.

---

### 파일: ai-agent.handler.ts — `mcpDiagnosticsAcc` 배열

- **[INFO]** multi-turn 에서 매 turn 마다 새 `McpServerSummary[]` 배열 생성
  - 위치: `ai-agent.handler.ts` diff +492, +1390 (single-turn 및 multi-turn 각 핸들러 내 `const mcpDiagnosticsAcc: McpServerSummary[] = []`)
  - 상세: spec 설계 의도 ("매 turn buildTools 재호출 → 매 turn 새 snapshot") 와 일치하며, 배열 크기는 `mcpServers[]` 수에 비례해 소규모다. 메모리 및 GC 부담 무시 가능.
  - 제안: 현재 설계 유지. 우려 없음.

- **[INFO]** `buildMcpDiagnosticsMeta` 의 spread 연산자 패턴
  - 위치: `ai-agent.handler.ts` diff +481, +538, +555 — `...(AiAgentHandler.buildMcpDiagnosticsMeta(...) ?? {})`
  - 상세: 빈 배열이면 `undefined`를 반환해 spread 대상이 `{}` 가 되는 단락 패턴이다. 불필요한 빈 객체 spread(`{}`)가 반복적으로 발생하지만, JS 엔진 최적화 대상이므로 실질 비용은 없다.
  - 제안: 가독성 개선 목적이라면 null-coalescing 없이 `buildMcpDiagnosticsMeta` 가 `{}` 를 직접 반환하도록 시그니처를 변경할 수 있으나 필수 아님.

---

### 파일: mcp-diagnostics.ts — `pushMcpServerSummary`

- **[INFO]** helper 함수가 `undefined` guard 외에 로직 없음 — 인라인 push 와 동등
  - 위치: `mcp-diagnostics.ts` `pushMcpServerSummary` 함수 (전체)
  - 상세: `acc.push(entry)` 단순 래퍼로 런타임 비용 무시. 단, 호출 지점이 여러 provider 로 분산될 때 일관성을 보장하는 방어 패턴으로 유효하다.
  - 제안: 현재 설계 유지. 성능 관점에서 우려 없음.

---

## 요약

이번 변경은 cafe24 expired 통합의 자가 회복 경로를 두 계층(scanner 0d 분기 + buildTools refresh-then-include)으로 추가한 것으로, 성능 관점에서 주요 위험은 `Cafe24McpToolProvider.tryRecoverExpired()` 의 직렬 refresh 왕복이다. `mcpServers[]` 에 expired 항목이 복수 존재할 경우 AI Agent 노드 실행 latency 가 O(N) 으로 누적되는 구조이나, spec 이 이를 "드문 예외 경로, 정상 케이스에선 latency 없음" 으로 전제하고 있어 현 범위에서는 허용 가능하다. `integration-expiry-scanner` 의 루프 내 순차 enqueue 도 실질 영향은 미미하다. 전반적으로 새로 추가된 코드는 메모리 누수·무한 루프·과도한 객체 생성 등의 고위험 패턴 없이 설계되어 있다.

## 위험도

LOW
