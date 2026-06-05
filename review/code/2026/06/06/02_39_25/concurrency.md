# 동시성(Concurrency) 리뷰

## 발견사항

### [WARNING] `searched` / `done` / `failed` 카운터 비원자적 증감 (eval-retrieval.ts, generate-golden-set.ts)

- **위치**: `codebase/backend/src/scripts/eval-retrieval.ts` L1862–1891 (`searched += 1`, `skipped += 1`); `codebase/backend/src/scripts/generate-golden-set.ts` L285–286 (`done += 1`, `failed += 1`)
- **상세**: `SEARCH_CONCURRENCY = 4` / `CHUNK_LLM_CONCURRENCY = 4` 로 `pLimit` 을 통해 최대 4개의 async task 가 동시 실행된다. Node.js 는 단일 스레드 이벤트 루프이므로 `+=` 연산 자체는 실제로 인터리빙되지 않는다. 그러나 `finally` 블록 내 `if (searched % 20 === 0 || searched === goldenSet.entries.length)` 조건은 비결정적 완료 순서에 따라 로깅 조건이 중복 출력되거나 누락될 수 있다(기능 버그 아님, 진행 표시 부정확). 현재는 안전하나 Worker Threads 등으로 확장 시 즉시 문제가 된다.
- **제안**: 현재는 안전하다. 단일 스레드 가정에 의존함을 주석으로 명시하거나 Worker Threads 확장 시 `Atomics` 사용을 고려한다.

### [INFO] `wsCache` Map 에 대한 check-then-act 패턴 (eval-retrieval.ts)

- **위치**: `codebase/backend/src/scripts/eval-retrieval.ts` L1848–1858 (`wsCache`)
- **상세**: `resolveWorkspace` 는 `wsCache.has(kbId)` 확인 후 DB 조회 결과를 `wsCache.set(kbId, ws)` 로 캐싱한다. 동일 `kbId` 로 첫 도착한 다수의 concurrent task 가 동시에 `has()` 를 false 로 보고 각자 DB 쿼리를 발행할 수 있다(중복 쿼리 발생). Node.js 단일 스레드 환경에서도 `await` 경계를 넘어 복수 task 가 진입 가능하다.
- **제안**: Promise 를 캐시 값으로 저장해 중복 쿼리를 방지한다.

```typescript
const wsCache = new Map<string, Promise<string | null>>();
const resolveWorkspace = (kbId: string): Promise<string | null> => {
  if (!wsCache.has(kbId)) {
    wsCache.set(kbId, dataSource.query(
      `SELECT workspace_id FROM knowledge_base WHERE id = $1`, [kbId]
    ).then((rows: Array<{ workspace_id: string }>) => rows[0]?.workspace_id ?? null));
  }
  return wsCache.get(kbId)!;
};
```

### [INFO] `retrievedByEntryId` 객체 중복 id 쓰기 묵시적 동작 (eval-retrieval.ts)

- **위치**: `codebase/backend/src/scripts/eval-retrieval.ts` L1861, L1871, L1881–1884
- **상세**: `entry.id` 키별로 쓰기가 이루어지며, JS 단일 스레드 특성상 동시성 문제는 없다. 그러나 골든셋에 중복 id 가 있는 경우 마지막 write 가 이기는 묵시적 동작이 발생한다.
- **제안**: 실행 전 골든셋 중복 id 사전 검증(`new Set(entries.map(e => e.id)).size !== entries.length` 체크)을 추가하면 진단이 쉬워진다.

## 요약

변경된 코드에는 `pLimit(4)` 를 이용한 제한적 병렬 처리가 eval-retrieval.ts 와 generate-golden-set.ts 두 CLI 스크립트에 도입되었다. Node.js 단일 스레드 이벤트 루프 특성상 실질적 경쟁 조건이나 데드락은 없으며, 공유 상태(`retrievedByEntryId`, `generated`, 카운터)에 대한 접근도 await 경계 바깥에서 이루어져 안전하다. 그러나 `wsCache` 의 check-then-act 패턴은 동일 kbId 에 대한 중복 DB 쿼리를 유발할 수 있고, 카운터 증감이 단일 스레드 가정에 묵시적으로 의존하는 점은 문서화 또는 방어 코드가 권장된다. 전반적으로 동시성 설계는 CLI 스크립트 용도에 적합하며 즉각 차단이 필요한 이슈는 없다.

## 위험도

LOW
