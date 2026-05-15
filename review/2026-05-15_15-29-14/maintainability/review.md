### 발견사항

---

**[WARNING] `useMemo` 가 실질적 메모이제이션 없이 사용됨**
- 위치: `background-run-section.tsx` — `NodeExecutionsList` 내 `const sorted = useMemo(() => nodes, [nodes]);`
- 상세: `nodes` 배열을 그대로 반환하는 `useMemo` 는 참조 동등성만 보전하며 실제 계산 비용을 줄이지 않음. 읽는 사람이 "여기에 정렬 로직이 있어야 했나?" 라는 의문을 갖게 만듦.
- 제안: `const sorted = nodes;` 로 단순화하거나, 컴포넌트 이름·변수명을 `nodes` 그대로 유지해 의도를 명확히 함.

---

**[WARNING] JSDoc 과 구현 사이의 필드명 불일치**
- 위치: `query-background-run.dto.ts` L7 — `cursor 는 opaque base64 — 서버가 { lastCreatedAt, lastId } 를 직렬화`
- 상세: 실제 `CursorPayload` 는 `{ s: string; i: string }` 이고, `s` 는 `startedAt` 기준. JSDoc 은 `lastCreatedAt` 를 언급해 구현과 불일치. 정렬 키가 바뀔 때 JSDoc 업데이트가 누락될 위험.
- 제안: JSDoc 을 `{ lastStartedAt, lastId }` 로 수정하거나, 구현 쪽 필드명을 서술적으로(`startedAt`, `id`) 변경.

---

**[WARNING] `BackgroundRunStatus` 타입에 포함된 `'cancelled'` 가 서버 파생 로직에서 도달 불가**
- 위치: `background-run-response.dto.ts` L6, `background-runs.service.ts` — `deriveBackgroundRunStatus`
- 상세: 응답 DTO 와 프론트엔드 타입 모두 `'cancelled'` 를 유효한 상태로 정의하지만, `deriveBackgroundRunStatus` 는 `pending | running | completed | failed` 만 반환. `RunStatusBadge` 에는 `'cancelled'` 분기가 있으므로 사용자가 의도한 기능이 조용히 작동하지 않음.
- 제안: `maxDurationMs` 초과 등 취소 경로에서 `'cancelled'` 를 실제 반환하거나, 그 전까지 `BackgroundRunStatus` 에서 `'cancelled'` 를 제거하고 TODO 주석으로 남겨 의도를 명확히 함.

---

**[WARNING] `backgroundRunId: string` — 빈 문자열로 "없음"을 표현하는 설계**
- 위치: `background-execution.queue.ts` — `BackgroundExecutionJob.backgroundRunId`, `execution-engine.service.ts` L3695–3703
- 상세: TypeScript 인터페이스가 `string` 로 선언되어 있어 빈 문자열이 "값 없음"을 표현. 코드 전반에 `if (!data.backgroundRunId)` 가드가 4~5 곳에 분산됨. `string | null` 로 선언하면 TypeScript 가 null 체크를 강제해 누락 가드를 컴파일 타임에 잡을 수 있음.
- 제안: `backgroundRunId: string | null` 로 변경. 빈 문자열 fallback 대신 `null` 사용.

---

**[WARNING] 집계 쿼리에 하드코딩된 SQL 상태 문자열**
- 위치: `background-runs.service.ts` L290–305 — `aggregateBodyStatus`
- 상세: `'pending'`, `'running'`, `'failed'` 등이 SQL 리터럴로 하드코딩되어 있음. `NodeExecutionStatus` enum 값이 바뀌면 런타임 오류가 발생하지만 TypeScript 컴파일러가 잡아주지 않음.
- 제안: 상수 배열 또는 enum 값을 참조하는 방식으로 교체. 예: `` `SUM(CASE WHEN ne.status = '${NodeExecutionStatus.PENDING}' THEN 1 ELSE 0 END)` ``

---

**[WARNING] `eslint-disable-next-line react-hooks/exhaustive-deps` — 의존성 누락 가능성 은폐**
- 위치: `use-background-run.ts` L101
- 상세: `queryClient` 와 `queryKey` 가 deps 에 빠져 있음. `queryKey` 는 렌더마다 재생성되어 의도적으로 제외한 것이지만, `queryClient` 누락은 테스트 환경에서 오래된 클라이언트를 참조할 수 있음.
- 제안: `queryClient` 를 deps 에 추가. `queryKey` 는 `useMemo` 로 안정화하거나 `const queryKey = [QUERY_KEY, executionId, backgroundRunId]` 를 `useMemo` 로 감쌀 것.

---

**[INFO] `verifyBackgroundRunOwnership` 의 raw 테이블명 vs 나머지 서비스의 엔티티명 혼용**
- 위치: `background-runs.service.ts` L64–72 — `innerJoin('execution', 'e', ...)` vs `findBackgroundNodeExecution` 의 `ne.executionId`
- 상세: `verifyBackgroundRunOwnership` 는 raw SQL 테이블명(`'execution'`, `'workflow'`)을 직접 사용하지만, 동일 서비스의 다른 메서드는 TypeORM 엔티티 프로퍼티명을 사용. 혼용 패턴은 onboarding 시 혼란.
- 제안: `innerJoin(Execution, 'e', ...)` 처럼 엔티티 클래스를 참조해 통일.

---

**[INFO] 서비스 파일 하단 re-export**
- 위치: `background-runs.service.ts` L402 — `export { NodeExecutionStatus };`
- 상세: "Re-export for test convenience" 주석이 달려 있으나 테스트 파일은 직접 `node-execution.entity` 에서 import 하면 됨. 서비스 파일의 public API 에 무관한 심볼이 노출됨.
- 제안: 테스트 파일에서 직접 import 후 re-export 제거.

---

**[INFO] `toNodeExecutionDto` 에서 `parentNodeExecutionId ?? ''` 빈 문자열 fallback**
- 위치: `background-runs.service.ts` L261
- 상세: `parentNodeExecutionId` 가 null 인 NodeExecution 은 논리적으로 이 API 에서 반환되지 않아야 함(Background 노드의 직계 자식만 조회). 빈 문자열 fallback 이 downstream 클라이언트에 유효 UUID 로 오인될 수 있음.
- 제안: 타입을 `string | null` 로 유지하거나, null 이면 early throw 로 방어.

---

### 요약

전체 코드는 책임 분리, 명명, 테스트 커버리지 면에서 높은 수준을 유지하고 있다. `BackgroundRunsService` 는 400줄 규모지만 단일 책임을 잘 지키며 private 메서드로 세분화되어 있고, 프론트엔드 hook 과 컴포넌트도 적절한 크기로 나뉘어 있다. 다만 `BackgroundRunStatus` 에 구현되지 않은 `'cancelled'` 상태 포함, JSDoc 과 실제 cursor 필드명 불일치, 집계 쿼리의 SQL 리터럴 하드코딩, `backgroundRunId: string` 의 빈 문자열 "없음" 표현 패턴 등이 향후 상태 확장·enum 변경 시 조용한 버그로 이어질 수 있는 취약점이다. 이들을 정리하면 장기 유지보수 비용이 의미 있게 줄어든다.

### 위험도

**LOW**