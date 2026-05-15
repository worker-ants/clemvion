### 발견사항

- **[WARNING]** `evaluateReviewGuard` 내 `Promise.all`에서 공유 `Map`을 동시 변형
  - 위치: `workflow-assistant-stream.service.ts` — `pendingByNode.set(n.id, pending)` 패턴
  - 상세: Node.js는 단일 스레드 이벤트 루프이므로 실제 race condition은 발생하지 않지만, `Promise.all` 콜백 내에서 외부 `Map`을 직접 변형하는 패턴은 의미론적으로 불안전하다. 여러 `async` 작업이 같은 참조를 공유하며 각자 `set()`을 호출하므로, 추후 Worker Thread나 Cluster 환경으로 전환 시 즉시 race condition이 된다.
  - 제안: 불변 패턴으로 전환 — `Promise.all`이 `[nodeId, pending]` 쌍을 반환하게 하고, `new Map(entries)`로 한 번에 생성

```typescript
// 현재 (변형 패턴)
const pendingByNode = new Map<string, PendingUserConfigField[]>();
await Promise.all(
  snapshot.nodes.map(async (n) => {
    const pending = await this.collectPendingUserConfigWithCandidates(...);
    pendingByNode.set(n.id, pending); // 외부 Map 변형
  }),
);

// 권장 (불변 패턴)
const pendingByNode = new Map(
  await Promise.all(
    snapshot.nodes.map(async (n) => {
      const pending = await this.collectPendingUserConfigWithCandidates(...);
      return [n.id, pending] as const;
    }),
  ),
);
```

---

- **[WARNING]** 중첩 `Promise.all`로 인한 DB 커넥션 폭발 가능성
  - 위치: `evaluateReviewGuard`의 외부 `Promise.all` × `fillCandidates`의 내부 `Promise.all`
  - 상세: 외부에서 노드 N개를 동시 조회하고, 각 노드마다 `fillCandidates`가 selector 필드 M개를 다시 `Promise.all`로 동시 조회한다. 최악의 경우 N × M개의 DB 쿼리가 동시에 발사된다. `MAX_CANDIDATES = 20`이 반환 건수를 제한하지만 발사되는 쿼리 수 자체는 제한하지 않는다. 노드가 30개이고 각 노드에 selector가 3개면 최대 90개의 병렬 DB 쿼리가 생성된다.
  - 제안: 단기적으로는 현실적 워크플로 규모(노드 30개 이하)에서 TypeORM 커넥션 풀 기본값(10)으로 충분히 흡수된다. 단, 운영 환경에서 복잡한 워크플로가 많아지면 `p-limit`으로 외부 `Promise.all`의 동시성을 제한(예: concurrency 5)하는 것이 안전하다.

---

- **[INFO]** 외부 `Promise.all`에 오류 전파 방어 없음
  - 위치: `evaluateReviewGuard` 내 `Promise.all(snapshot.nodes.map(...))`
  - 상세: `CandidateLookupService.lookup`은 try-catch로 개별 오류를 흡수하므로 실제 throw 가능성은 낮지만, `collectPendingUserConfigWithCandidates` 자체가 예외를 발생시키면(예: `shadow` 참조 오류) `Promise.all`이 전체 reject되어 guard 로직 전체가 실패할 수 있다. 현재 catch 경로가 없어 스트리밍 응답에 예상치 못한 오류가 전파될 수 있다.
  - 제안: 외부 `Promise.all` 자체를 try-catch로 감싸거나, `.map` 내 각 항목을 `.catch(() => [])` 처리

---

- **[INFO]** `updateNodeConfigField`의 `pushUndo()` + `set()` 비원자성
  - 위치: `editor-store.ts:updateNodeConfigField`
  - 상세: `get().pushUndo()`와 `set(...)` 사이에 다른 상태 업데이트가 끼어들 수 있다. 그러나 Zustand는 React 렌더 사이클에서 업데이트를 배치하고, picker는 `setConfirmed(true)`로 즉시 재클릭을 차단하므로 실용적 위험은 없다.
  - 제안: 현재 수준에서 허용 가능. 향후 `transact` 패턴이 필요하면 Zustand의 `immer` 미들웨어 도입 고려

---

### 요약

변경된 코드는 Node.js 단일 스레드 이벤트 루프 모델 안에서 async/await와 `Promise.all`을 전반적으로 올바르게 사용한다. `evaluateReviewGuard`의 동기→비동기 전환도 `await` 누락 없이 정확하게 처리되었으며, 에러 격리(`lookup`의 try-catch)와 불변 반환(`fillCandidates`의 spread)도 적절하다. 주요 우려 사항은 두 가지다: (1) `Promise.all` 콜백 내 외부 `Map` 변형 — 현재는 안전하지만 향후 멀티스레드 환경 전환 시 즉각적인 race condition 소지가 있고, (2) 노드 수 × 필드 수 비례로 증가하는 병렬 DB 쿼리 — 현실적 워크플로 규모에서는 커넥션 풀이 흡수하겠지만 대형 워크플로에서는 병목이 될 수 있다.

### 위험도

**LOW**