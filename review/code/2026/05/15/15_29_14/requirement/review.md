## 발견사항

### [WARNING] `cancelled` 상태 미구현 — 요구사항 미충족
- **위치**: `background-runs.service.ts` `deriveBackgroundRunStatus()` / `background-execution.processor.ts`
- **상세**: `BackgroundRunStatus` 타입과 spec §8.2 에서 `cancelled` 상태를 정의하고, 발생 조건으로 "`maxDurationMs` 초과 등"을 명시했다. 그러나 `deriveBackgroundRunStatus()`는 `cancelled`를 절대 반환하지 않으며, `BackgroundExecutionProcessor`도 `config.maxDurationMs` 값을 읽어 타임아웃을 강제하는 로직이 없다. Swagger enum에는 `cancelled`가 포함돼 클라이언트 계약상 유효한 값으로 보이지만 실제로는 반환 불가능한 dead value다.
- **제안**: 타임아웃 요구사항이 현 PR 범위 밖이라면 `BackgroundRunStatus` 타입과 Swagger enum에서 `cancelled`를 제거하고 별도 이슈로 추적한다. 범위 안이라면 processor에 `AbortController` 또는 BullMQ job timeout 연동 후 `deriveBackgroundRunStatus`에 집계 근거를 추가한다.

---

### [WARNING] 권한 검증이 워크스페이스 소속만 확인 — Editor+ 요건 미집행
- **위치**: `background-runs.service.ts` `verifyExecutionAccess()` / `verifyBackgroundRunOwnership()`
- **상세**: spec §8.4는 "워크스페이스 Editor 이상 멤버 또는 실행 시작자"만 조회 가능하다고 명시한다. 그러나 두 메서드 모두 `workflow.workspaceId === userWorkspaceId` 만 확인하며 멤버 role(Viewer vs Editor+) 과 실행 시작자 여부(`Execution.executed_by`)를 검사하지 않는다. 결과적으로 Viewer 역할의 워크스페이스 멤버도 HTTP API 호출과 WebSocket 채널 구독이 허용된다.
- **제안**: 기존 RBAC 가드(예: `ExecutionsController` 패턴)를 참고해 `verifyExecutionAccess`에 `execution.executedBy === userId || member.role >= Editor` 조건을 추가한다. WS 가드용 `verifyBackgroundRunOwnership`도 동일하게 확장이 필요하다. role 체크 추가 전까지 spec §8.7의 403 케이스가 실질적으로 발생하지 않음을 plan에 명시하는 것을 권장한다.

---

### [WARNING] 정렬 키 불일치 — spec vs 구현 괴리
- **위치**: `background-runs.service.ts` `fetchBodyPage()` / `spec/4-nodes/1-logic/12-background.md` §8.3
- **상세**: spec §8.3은 정렬 키를 `NodeExecution.createdAt ASC, id ASC`로 명시하지만, 구현에서는 `ne.startedAt ASC, ne.id ASC`로 정렬한다. `cursor` payload의 필드도 `s` (startedAt)를 키로 사용하며, `query-background-run.dto.ts`의 JSDoc 주석조차 `{ lastCreatedAt, lastId }`로 기재해 세 곳의 명세가 모두 다르다. `startedAt`과 `createdAt`은 대부분의 경우 동일하지만, 재시도·큐 지연 시나리오에서 값이 달라질 수 있고 cursor 연속성이 깨진다.
- **제안**: 구현 의도(시작 시각 기준 정렬)가 맞다면 spec §8.3과 DTO 주석을 `startedAt`으로 일괄 수정한다. `createdAt` 기준이 의도라면 구현과 cursor payload를 수정한다.

---

### [WARNING] `useBackgroundRun` — `queryKey` stale closure
- **위치**: `frontend/src/lib/websocket/use-background-run.ts` L61-75 (useEffect 내부 `handler`)
- **상세**: `queryKey`는 `executionId`, `backgroundRunId`를 포함하지만 `useEffect` 의존성 배열에는 `backgroundRunId`만 있다. `executionId`가 변경되고 `backgroundRunId`가 동일하게 유지되면 `handler` 클로저는 이전 `executionId`를 담은 stale `queryKey`로 `invalidateQueries`를 호출해 잘못된 캐시 항목을 무효화한다. `eslint-disable-next-line react-hooks/exhaustive-deps`로 경고를 억제해 이 버그가 잠복해 있다.
- **제안**: `useEffect` 의존성 배열에 `executionId`를 추가하거나, effect 내부에서 `queryKey`를 다시 계산한다.
  ```typescript
  const queryKey = [QUERY_KEY, executionId, backgroundRunId] as const;
  // useEffect 의존 배열:
  }, [backgroundRunId, executionId, queryClient]);
  ```

---

### [INFO] 403 vs 404 — spec 명세와 구현 의도 불일치
- **위치**: `background-runs.service.ts` `verifyExecutionAccess()` / spec §8.7
- **상세**: spec §8.7은 "워크스페이스 비멤버"에 대해 403 `FORBIDDEN_BACKGROUND_RUN`을 반환한다고 정의한다. 구현은 워크스페이스 불일치와 존재 미확인 모두 404 `EXECUTION_NOT_FOUND`로 통일한다. 코드 주석은 "ID enumeration 방지"를 이유로 명시해 의도적 결정임을 알 수 있으나 spec에 이 결정이 반영되지 않았다.
- **제안**: spec §8.7의 403 케이스를 "워크스페이스 소속 확인 불가 포함 시 404 통일 (IDOR 방지)"로 갱신해 Rationale과 명세를 일치시킨다.

---

### [INFO] `useMemo` 무의미한 사용
- **위치**: `background-run-section.tsx` `NodeExecutionsList` 컴포넌트 L174
- **상세**: `const sorted = useMemo(() => nodes, [nodes]);`는 실질적인 변환 없이 `nodes`를 그대로 반환한다. 정렬이 서버에서 이미 보장되므로 클라이언트 정렬은 불필요하다. 불필요한 메모이제이션 + 변수 이름(`sorted`)이 실제 정렬을 수행한다는 오해를 유발한다.
- **제안**: `useMemo`를 제거하고 `nodes`를 직접 사용한다.

---

### [INFO] `verifyBackgroundRunOwnership`의 raw SQL 컬럼 참조 위험성
- **위치**: `background-runs.service.ts` L65 `.select('w.workspace_id', 'workspaceId')`
- **상세**: TypeORM entity alias가 아닌 raw SQL 컬럼명 `workspace_id`를 직접 사용한다. Entity 컬럼명이 변경되거나 DB alias가 달라지면 런타임까지 감지되지 않는다. `verifyExecutionAccess`는 TypeORM `.select(['e.id', 'workflow.workspaceId'])`를 사용해 일관성이 없다.
- **제안**: 동일 메서드에서 TypeORM QueryBuilder entity path를 사용하거나 최소한 컬럼명 참조를 상수로 분리한다.

---

## 요약

핵심 기능 흐름(backgroundRunId 발급 → 큐 전달 → WS 이벤트 발행 → REST 조회 → 프론트 렌더링)은 일관되게 구현되어 있으며 legacy fallback(빈 문자열)도 명확하게 처리된다. 다만 spec에서 정의한 `cancelled` 상태와 `maxDurationMs` 타임아웃이 processor에서 미구현 상태로 Swagger 계약과 타입 정의에만 잔류해 있고, 권한 검증이 워크스페이스 소속 확인에 그쳐 Editor+ 역할 요건이 실제로 집행되지 않는 점이 주요 요구사항 미충족이다. 정렬 키(spec: `createdAt`, 구현: `startedAt`)와 cursor payload 명세 불일치도 cursor 연속성 관점에서 정리가 필요하다.

## 위험도

**MEDIUM** — 보안 역할 요건 미집행(`cancelled` 미구현은 기능적 누락, 권한 검증 불완전은 의도하지 않은 접근 허용 가능성)