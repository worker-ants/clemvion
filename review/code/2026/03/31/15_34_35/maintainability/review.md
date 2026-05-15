## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] `reauthorize` 서비스에 OAuth 설정 하드코딩**
- 위치: `integrations.service.ts` - `oauthConfigs` 객체
- 상세: Slack, Google, GitHub의 OAuth URL과 스코프가 서비스 코드 내에 하드코딩되어 있음. 새로운 서비스 추가 시 서비스 파일을 직접 수정해야 함
- 제안: 별도 설정 파일(`oauth-providers.config.ts`) 또는 환경변수 기반 설정으로 분리

---

**[WARNING] `formatLabel` 함수의 `if-else` 체인이 확장성에 취약**
- 위치: `custom-edge.tsx` - `formatLabel` 함수
- 상세: `case_`, `branch_` 접두사 처리를 위한 `if-else` 체인이 패턴 추가 시마다 증가. 동일 패턴의 두 분기(`case_`, `branch_`)가 거의 동일한 로직 반복
- 제안:
```ts
const PREFIX_LABELS: Record<string, string> = { case_: 'Case', branch_: 'Branch' };
for (const [prefix, label] of Object.entries(PREFIX_LABELS)) {
  if (port.startsWith(prefix)) return `${label} ${parseInt(port.slice(prefix.length), 10) + 1}`;
}
```

---

**[WARNING] `importWorkflow`의 복잡한 중첩 트랜잭션 로직**
- 위치: `workflows.service.ts` - `importWorkflow` 메서드 (약 50줄)
- 상세: 단일 메서드 내에 노드 생성, ID 매핑, 컨테이너 참조 해결, 엣지 생성이 모두 혼재. 순환 복잡도가 높고, 각 단계가 독립적으로 테스트 불가
- 제안: `createNodesFromImport`, `resolveContainerReferences`, `createEdgesFromImport` 등 private 메서드로 분리

---

**[WARNING] `AuthConfigsService.getUsage`의 N+1 잠재적 쿼리 패턴**
- 위치: `auth-configs.service.ts` - `getUsage` 메서드
- 상세: `triggerRepository.find` 후 triggerIds를 추출하여 두 번의 추가 쿼리를 실행. `triggerIds.length === 0` 조기 반환은 좋으나, 트리거가 많을 때 `IN` 절의 크기 제한 없음
- 제안: 단일 JOIN 쿼리로 통합하거나 IN 절 크기에 상한 추가

---

**[WARNING] `getNodeStats`의 raw SQL 문자열 사용**
- 위치: `statistics.service.ts` - `getNodeStats` 메서드
- 상세: `COUNT(*)::int`, `COALESCE(AVG(...) FILTER (...))::float`, `ROUND(... * 100, 2)::float` 등 PostgreSQL 전용 문법이 서비스 레이어에 직접 노출. DB 변경 시 탐색이 어려움
- 제안: 복잡한 집계는 별도 repository 메서드나 named query로 분리하고 주석 추가

---

**[INFO] `schedules.controller.ts`에서 비즈니스 로직이 컨트롤러에 위치**
- 위치: `schedules.controller.ts` - `runNow` 메서드
- 상세: `workflowId` 검증과 실행 로직이 컨트롤러에 위치. 컨트롤러는 라우팅/직렬화만 담당해야 함
- 제안: `schedulesService.runNow(id, workspaceId, userId)` 형태로 서비스로 이동

---

**[INFO] `RunResultsDrawer`의 `activeTab` 인덱스 기반 상태 관리**
- 위치: `run-results-drawer.tsx`
- 상세: `activeTab`이 인덱스(숫자)로 관리되어 nodeResults 배열 변경 시 인덱스가 무효화될 수 있음
- 제안: `nodeId`를 상태 키로 사용

---

**[INFO] `TriggerDetailDrawer`에서 `triggeredAt` 필드명 불일치 가능성**
- 위치: `trigger-detail-drawer.tsx` - `TriggerHistoryEntry` 인터페이스
- 상세: `TriggerHistoryEntry`는 `triggeredAt`을 사용하지만 백엔드 `getHistory`는 `startedAt`을 반환. 런타임에서만 발견되는 필드명 불일치
- 제안: 백엔드 응답 타입과 프론트엔드 인터페이스를 공유 타입으로 일치시킴

---

**[INFO] `Statistics.exportData`에서 `summary`, `errors`, `topWorkflows` 는 CSV 포맷에서 미사용**
- 위치: `statistics.service.ts` - `exportData` 메서드
- 상세: CSV 분기에서는 `executions`만 사용하지만 `Promise.all`에서 4개 쿼리를 모두 실행. 불필요한 DB 부하 발생
- 제안: format에 따라 필요한 쿼리만 선택적 실행

---

**[INFO] `STATUS_BADGE_VARIANT` 매직 문자열**
- 위치: `authentication/page.tsx`
- 상세: `"completed"`, `"running"`, `"failed"`, `"pending"` 이 문자열 리터럴로 반복. `ExecutionStatus` 타입과 연결 안 됨
- 제안: 백엔드의 `ExecutionStatus` enum을 공유하거나 프론트엔드에 동일한 상수 정의

---

**[INFO] `computeNextRuns`에서 `next().toISOString() ?? new Date().toISOString()` fallback 불필요**
- 위치: `schedules.service.ts` - `computeNextRuns`
- 상세: `CronExpressionParser`의 `next()`는 항상 유효한 날짜를 반환하므로 `?? new Date().toISOString()` fallback이 dead code
- 제안: fallback 제거

---

### 요약

전반적으로 코드 구조와 책임 분리가 잘 이루어져 있으나, 몇 가지 유지보수 위험 요소가 있다. 가장 주목할 부분은 `integrations.service.ts`의 OAuth 설정 하드코딩과 `workflows.service.ts`의 `importWorkflow` 메서드 복잡도로, 이 두 곳은 기능 확장 시 버그 발생 가능성이 높다. `statistics.service.ts`의 raw SQL 집계와 컨트롤러 내 비즈니스 로직 배치도 장기적인 유지보수 부담을 증가시킨다. 타입 인터페이스 불일치(`TriggerHistoryEntry.triggeredAt` vs `startedAt`)는 런타임 버그로 이어질 수 있어 조속한 수정이 권장된다.

### 위험도

**MEDIUM**