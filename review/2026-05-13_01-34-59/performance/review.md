### 발견사항

- **[WARNING]** `cleanup-invalid-queue-jobs.ts` — 전체 큐를 메모리에 일괄 적재
  - 위치: `sweepQueue()` L61 `await queue.getJobs([...QUEUE_STATES])`
  - 상세: BullMQ `getJobs()`는 기본적으로 `start=0, end=-1` (전체)로 동작한다. 큐에 수만 건 이상의 job이 쌓여 있을 경우 모든 job 객체가 한 번에 힙에 올라온다. `waiting` + `delayed` + `failed` + `paused` 4개 상태를 동시에 조회하므로 실제 적재량은 상태별 최댓값의 합이다.
  - 제안: `queue.getJobs(states, start, end)` 시그니처를 활용해 청크 단위(예: 1000건)로 페이지네이션. 혹은 BullMQ `getJobCountByTypes()`로 규모를 먼저 확인한 뒤 진행 여부를 묻는 UX 추가.

- **[INFO]** `cleanup-invalid-queue-jobs.ts` — `job.remove()` 직렬 실행
  - 위치: `sweepQueue()` L73–81 `for (const job of invalid) { await job.remove(); }`
  - 상세: invalid job이 수백 건이면 Redis round-trip이 그 수만큼 직렬로 발생한다. 일회성 스크립트이므로 서비스 가용성에는 무관하지만 실행 시간이 O(n × RTT)로 선형 증가한다.
  - 제안: `Promise.all(invalid.map(j => j.remove()))` 또는 p-limit로 병렬화. Redis pipeline/multi exec가 BullMQ Job API에서 직접 노출되지 않으므로 단순 병렬화가 현실적이다.

- **[INFO]** `job-payload.util.ts` — 에러 경로에서 `Object.keys` + 문자열 연결
  - 위치: `assertDocumentIdPayload()` L40–46
  - 상세: `Object.keys(job.data ?? {})` 배열 생성과 `JSON.stringify(err.debug)`(프로세서 L54)는 에러 경로에서만 실행되므로 정상 처리량에는 영향 없음. 단, 손상 job 폭주 상황에서는 이 경로가 빈번히 호출될 수 있다.
  - 제안: 현재 코드도 실용적으로 문제없음. 굳이 최적화한다면 `payloadKeys` 를 join 없이 배열 그대로 두고 JSON.stringify는 이미 그렇게 처리됨 — 현재 구현 유지.

- **[INFO]** `variable-modification.handler.ts` — `Object.hasOwn` 채택은 미세 성능 개선
  - 위치: L124 `Object.hasOwn(context.variables, mod.variable)`
  - 상세: `Object.prototype.hasOwnProperty.call`은 prototype 체인을 통한 간접 호출이지만, `Object.hasOwn`은 정적 메서드로 V8에서 인라인 최적화가 더 용이하다. 실측 차이는 미미하지만 의미론적 명확성 측면에서도 올바른 방향이다.
  - 제안: 현재 변경이 이미 정답.

---

### 요약

이번 변경의 핵심인 payload guard 계층(job-payload.util, processor 진입부 검증, service 진입부 조기 반환)은 모두 O(1) 비용으로 불필요한 DB round-trip을 사전 차단하는 방향이라 성능 관점에서 긍정적이다. 주목할 지점은 일회성 정리 스크립트(`cleanup-invalid-queue-jobs.ts`)로, 큐 규모에 따라 `getJobs()` 의 전체 메모리 적재가 운영 환경에서 OOM 위험을 만들 수 있다. 이 스크립트는 dry-run 전 큐 규모를 확인하는 단계를 문서나 코드 수준에서 안내하면 충분히 안전하게 운용 가능하다.

### 위험도

**LOW**