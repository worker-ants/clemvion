## 발견사항

### [CRITICAL] 백엔드 신규 서비스 메서드 전체 테스트 미존재
- **위치**: `auth-configs.service.ts:getUsage`, `integrations.service.ts:reauthorize`, `schedules.service.ts:getPreview/getPreviewFromExpression/computeNextRuns`, `statistics.service.ts:getNodeStats/exportData`, `triggers.service.ts:getHistory`
- **상세**: 이번에 추가된 모든 백엔드 서비스 메서드에 단위 테스트가 전혀 없음. 특히 `computeNextRuns`는 외부 라이브러리(`cron-parser`)에 의존하며, `getNodeStats`는 PostgreSQL 전용 캐스팅(`::int`, `::float`, `FILTER (WHERE ...)`)을 사용하는데 테스트 없이는 런타임 오류 감지 불가
- **제안**: 각 서비스에 `.spec.ts` 파일 추가 또는 기존 spec 파일에 테스트 케이스 추가

### [CRITICAL] `importWorkflow` / `exportWorkflow` 테스트 미존재
- **위치**: `workflows.service.spec.ts`, `workflows.service.ts:importWorkflow/exportWorkflow`
- **상세**: `workflows.service.spec.ts`에 `mockEdgeRepository`가 추가되었으나, `importWorkflow`(트랜잭션 처리, 노드 인덱스 매핑, 컨테이너 참조 해결 등 복잡한 로직)와 `exportWorkflow`(노드/엣지 직렬화)에 대한 테스트가 전혀 없음. `importWorkflow`는 실패 시 데이터 불일치가 발생할 수 있는 중요 기능
- **제안**: 아래 케이스 최소 커버 필요
  ```ts
  // importWorkflow 테스트 케이스 예시
  it('should create workflow with nodes and edges')
  it('should resolve containerId index references correctly')
  it('should skip edges with invalid node indices')
  it('should rollback on failure (transaction)')
  ```

### [CRITICAL] `computeNextRuns` 오류 처리 및 테스트 미존재
- **위치**: `schedules.service.ts:148-162`, `schedules.controller.ts:previewExpression`
- **상세**: `CronExpressionParser.parse()`는 잘못된 cron 표현식에 대해 예외를 throw하지만, 서비스와 컨트롤러 모두 이를 catch하지 않음. 클라이언트가 잘못된 표현식을 전달하면 500 오류 발생
- **제안**:
  ```ts
  private computeNextRuns(...): string[] {
    try {
      const interval = CronExpressionParser.parse(cronExpression, { tz: timezone });
      ...
    } catch (e) {
      throw new BadRequestException('Invalid cron expression');
    }
  }
  ```
  + 유효하지 않은 표현식에 대한 테스트 케이스 추가

---

### [WARNING] `reauthorize`의 state 토큰 미저장 — CSRF 보호 무효
- **위치**: `integrations.service.ts:reauthorize:113-145`
- **상세**: OAuth `state` 토큰을 생성하지만 서버 측(세션/Redis/DB)에 저장하지 않아 콜백에서 검증 불가. CSRF 보호가 실질적으로 작동하지 않으며, 테스트도 없음
- **제안**: state를 Redis나 임시 저장소에 저장하거나, 최소한 동작 명세를 문서화하고 테스트에서 검증

### [WARNING] `RunResultsDrawer`의 `activeTab` 인덱스 초과 위험
- **위치**: `run-results-drawer.tsx:88,161`
- **상세**: 새 실행이 시작될 때 `startExecution()`은 `nodeResults`를 초기화하지만, `activeTab` 상태는 컴포넌트 로컬 상태이므로 초기화되지 않음. 이전 실행에 탭이 3개 있다가 새 실행에서 1개만 생기면 `nodeResults[activeTab]`이 `undefined` 반환. 테스트 없음
- **제안**:
  ```ts
  useEffect(() => {
    setActiveTab(0);
  }, [status]); // 실행 시작 시 탭 초기화
  ```

### [WARNING] 신규 프론트엔드 컴포넌트 테스트 미존재
- **위치**: `slide-drawer.tsx`, `run-results-drawer.tsx`, `trigger-detail-drawer.tsx`
- **상세**: 3개의 신규 UI 컴포넌트 모두 테스트 없음. `SlideDrawer`는 Escape 키 처리, body overflow 제어, 애니메이션 상태 등 테스트 가능한 동작이 있음. `TriggerDetailDrawer`는 webhook/schedule 타입별 조건부 렌더링 테스트 필요
- **제안**: 최소한 `SlideDrawer`에 대한 테스트 추가
  ```tsx
  it('calls onClose when Escape key pressed')
  it('renders children when open')
  it('does not render children content when closed')
  ```

### [WARNING] `getNodeStats`의 PostgreSQL 전용 문법 — 테스트 격리 불가
- **위치**: `statistics.service.ts:200-232`
- **상세**: `COUNT(*)::int`, `AVG(...) FILTER (WHERE ...)` 등은 PostgreSQL 전용 문법. 단위 테스트에서 TypeORM mock으로 `getRawMany()`를 mocking하더라도, 실제 DB 통합 테스트 없이는 쿼리 정확성 보장 불가. 또한 `workspaceId` 필터가 실제로 적용되는지 쿼리 단위 테스트로 검증 불가
- **제안**: 통합 테스트 또는 `getRawMany` mock 반환값을 사용한 단위 테스트 추가

### [WARNING] `exportData`의 `Promise.all` 부분 실패 처리 미테스트
- **위치**: `statistics.service.ts:238-279`
- **상세**: `Promise.all([getSummary, getExecutionsByPeriod, getErrors, getTopWorkflows])`에서 하나라도 실패하면 전체가 reject되나, 이에 대한 테스트 없음
- **제안**: 개별 쿼리 실패 시나리오 테스트 케이스 추가

### [WARNING] `failExecution` 테스트의 구현 정합성 확인 필요
- **위치**: `execution-store.test.ts:116-124`, `execution-store.ts`
- **상세**: 테스트는 `failExecution("Something went wrong")` 호출 시 `nodeStatuses.get("__execution__")`에 에러가 저장될 것을 기대하지만, 제공된 diff에서 `failExecution`의 전체 구현이 보이지 않음. 구현이 누락됐거나 이전 코드에 있다면 테스트와 실제 동작이 일치하지 않을 수 있음
- **제안**: 구현 확인 후 일치 여부 검증

---

### [INFO] `vitest.config.ts` / 테스트 환경 설정 파일 미확인
- **위치**: `frontend/package.json`, 프로젝트 루트
- **상세**: vitest, @testing-library, jsdom이 추가되었으나 `vitest.config.ts` 또는 `vite.config.ts`의 test 설정이 diff에 없음. jsdom 환경 설정(`environment: 'jsdom'`) 및 `@testing-library/jest-dom` setup 파일이 없으면 테스트가 정상 동작하지 않을 수 있음
- **제안**: `vitest.config.ts` 확인 및 setup 파일 존재 여부 점검

### [INFO] `TriggerDetailDrawer`의 히스토리 응답 처리 취약
- **위치**: `trigger-detail-drawer.tsx:62`
- **상세**: `Array.isArray(responseData) ? responseData : responseData.items ?? []`로 두 가지 응답 형태를 처리하나, 실제 `/triggers/:id/history` API는 배열을 직접 반환하므로 `.items` 분기는 dead code. 테스트 없음
- **제안**: API 응답 구조 통일 후 단순화

### [INFO] `auth-configs.service.ts`의 `getUsage` - `triggerIds` 빈 배열 경계 케이스
- **위치**: `auth-configs.service.ts:130-135`
- **상세**: `triggerIds.length === 0`이면 조기 반환하는 로직이 있으나, 이 경로에 대한 테스트 없음. `config.lastUsedAt`이 `null`인 경우도 커버 필요

---

## 요약

이번 변경은 백엔드에 6개 모듈에 걸쳐 10개 이상의 신규 서비스 메서드가 추가되었고, 프론트엔드에는 3개의 신규 컴포넌트와 스토어 확장이 이루어졌다. 프론트엔드 유틸/스토어에 대한 단위 테스트(badge, button, card, stores)가 체계적으로 추가된 점은 긍정적이나, 핵심 비즈니스 로직인 백엔드 서비스 메서드(`importWorkflow`, `getUsage`, `reauthorize`, `computeNextRuns`, `getNodeStats`, `exportData`, `getHistory`) 전체에 테스트가 없는 것이 가장 큰 문제다. 특히 `importWorkflow`는 트랜잭션과 인덱스 매핑 로직이 복잡하여 버그 발생 가능성이 높고, `computeNextRuns`는 잘못된 입력에 대한 예외 처리가 없어 런타임 500 오류를 유발할 수 있다. CSRF 보호를 위해 추가된 state 토큰이 실제로 저장/검증되지 않는 보안 이슈도 테스트 부재로 인해 발견되지 않은 상태다.

## 위험도

**HIGH**