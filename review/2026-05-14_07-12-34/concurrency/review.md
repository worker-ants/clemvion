### 발견사항

**[WARNING] `ownedSids` Set 공유로 인한 동시 실행 세션 간 race condition**
- 위치: `cafe24-mcp-tool-provider.ts:47, 133, 362`
- 상세: `ownedSids`는 `Cafe24McpToolProvider` 인스턴스 전체에서 공유되는 `Set<string>`이다. `sid`는 `integration.id`의 앞 8자로 파생된다(`sanitizeSid`). 동일한 Cafe24 Integration을 사용하는 두 AI Agent 실행(executionA, executionB)이 동시에 진행될 경우, executionA의 `cleanup()`이 `ownedSids.delete(sid)`를 호출하면 executionB에서도 동일 sid가 제거된다. 이후 executionB의 `matches()` 호출이 `false`를 반환해 tool call이 `CAFE24_MCP_NO_SESSION` 또는 `McpToolProvider`로 오라우팅된다.
- 제안: `ownedSids`를 reference-counting 방식의 `Map<string, number>`로 교체한다. `buildTools`에서 카운트를 증가시키고, `cleanup`에서 감소시켜 0이 될 때만 삭제한다.

```typescript
// 현재
private readonly ownedSids = new Set<string>();

// 권장
private readonly ownedSidRefCounts = new Map<string, number>();

// buildTools 내
const prev = this.ownedSidRefCounts.get(sid) ?? 0;
this.ownedSidRefCounts.set(sid, prev + 1);

// cleanupInternal 내
for (const sid of state.sidToIntegration.keys()) {
  const count = (this.ownedSidRefCounts.get(sid) ?? 1) - 1;
  if (count <= 0) this.ownedSidRefCounts.delete(sid);
  else this.ownedSidRefCounts.set(sid, count);
}
// matches() → this.ownedSidRefCounts.has(sid)
```

---

**[INFO] 멀티 인스턴스 배포 시 토큰 refresh race**
- 위치: `cafe24-api.client.ts:265-292` (`refreshAccessToken` → DB transaction)
- 상세: `integrationLocks`는 process-scoped이다. 두 개의 백엔드 인스턴스가 동시에 같은 Integration의 토큰 만료를 감지하면, 두 인스턴스 모두 `findOne → save` 트랜잭션을 실행한다. Cafe24가 refresh 시 refresh_token을 로테이션하는 경우, 두 번째 저장이 첫 번째 저장의 새 refresh_token을 덮어쓸 수 있다. spec §9.6에 known trade-off로 명시됨.
- 제안: 현재 단일 인스턴스 배포라면 무시 가능. 수평 스케일링 시에는 DB advisory lock 또는 Redis 분산 mutex 도입 필요.

---

**[INFO] `prev.then(task, task)` — 이전 task 실패 시 queued caller 연쇄 실패**
- 위치: `cafe24-api.client.ts:117`
- 상세: `const next = prev.then(task, task)` — rejection handler도 `task`를 호출한다. 동일 Integration에 N개 call이 큐에 쌓인 상태에서 첫 번째 call이 `CAFE24_AUTH_FAILED`로 실패하면, 이후 모든 queued call이 순차적으로 실행되어 각각 auth failure를 겪는다. 단락(short-circuit)되지 않는다.
- 제안: 기능상 무해하지만(각 call은 독립적), auth_failed 상태임을 먼저 확인하여 queued call을 즉시 거부하면 불필요한 API 호출을 줄일 수 있다.

---

### 요약

코드의 핵심 동시성 설계(process-level mutex chain `withIntegrationLock`)는 Node.js 단일 스레드 이벤트 루프 기반으로 올바르게 구현되었다. `get → chain → set` 사이에 `await`가 없어 원자성이 보장된다. 주요 문제는 `Cafe24McpToolProvider.ownedSids`가 reference-count 없이 단순 `Set`으로 관리되어, 동일 Integration을 쓰는 두 AI Agent 실행이 동시에 진행되면 하나의 cleanup이 다른 실행의 `matches()` 상태를 무효화한다는 점이다. 데이터 손상이나 보안 문제는 아니지만 tool call 오류로 이어지는 실제 버그이다.

### 위험도
**MEDIUM**