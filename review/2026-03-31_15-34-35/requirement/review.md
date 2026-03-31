## 요구사항 관점 코드 리뷰

### 발견사항

---

**[WARNING]** `getHistory` API 응답 필드 불일치
- 위치: `triggers.service.ts` - `getHistory()`, `trigger-detail-drawer.tsx`
- 상세: 서비스는 `startedAt` 필드를 반환하지만, 프론트엔드 `TriggerHistoryEntry`는 `triggeredAt` 필드를 기대함. 실제 데이터가 표시되지 않음.
- 제안: 서비스 반환 타입을 `triggeredAt`으로 통일하거나, 드로어 인터페이스를 `startedAt`으로 수정

---

**[WARNING]** `reauthorize` state 토큰 미저장 — CSRF 보호 무력화
- 위치: `integrations.service.ts` - `reauthorize()`, `integrations/page.tsx`
- 상세: 서버에서 생성한 `state` 토큰을 클라이언트가 받지만 어디에도 저장하지 않음. OAuth callback 시 state 검증이 불가능하여 CSRF 방어가 실질적으로 무효화됨.
- 제안: `state`를 sessionStorage나 쿠키에 저장하고, callback에서 검증하는 로직 추가 필요

---

**[WARNING]** `getWorkflowIdForSchedule`이 trigger relation 로드 여부에 의존
- 위치: `schedules.service.ts` - `getWorkflowIdForSchedule()`, `schedules.controller.ts` - `runNow()`
- 상세: `findById`가 trigger 관계를 eager/join으로 로드하지 않으면 `schedule.trigger`가 `undefined`가 되어 항상 `null` 반환. 컨트롤러에서 BadRequestException 발생.
- 제안: `findById` 내부에서 `relations: ['trigger']` 포함 여부 확인 필요. 또는 서비스 내부에서 직접 쿼리

---

**[WARNING]** `importWorkflow` — `containerId`가 index 기반이나 유효성 미검증
- 위치: `workflows.service.ts` - `importWorkflow()`, `import-workflow.dto.ts`
- 상세: `containerId`를 node index로 해석하는데, 범위 초과 시 `containerNewId`가 `undefined`가 되어 조용히 무시됨. 또한 DTO에서 `containerId`의 타입이 `number | null`로 선언되어 있으나 `@IsNumber()` 데코레이터가 없어 유효성 검증 누락.
- 제안: `containerId` 범위 검증 추가; DTO에 `@IsOptional() @IsNumber()` 추가

---

**[WARNING]** `computeNextRuns` 예외 미처리
- 위치: `schedules.service.ts` - `computeNextRuns()`
- 상세: 잘못된 cron 표현식 또는 유효하지 않은 timezone 전달 시 `CronExpressionParser.parse()`가 예외를 throw하지만 서비스 레이어에서 catch하지 않음. HTTP 500으로 노출됨.
- 제안: try-catch로 감싸고 `BadRequestException` 으로 변환

---

**[WARNING]** 통계 `exportData` — 대용량 데이터 메모리 적재 위험
- 위치: `statistics.service.ts` - `exportData()`
- 상세: `getSummary`, `getExecutionsByPeriod`, `getErrors`, `getTopWorkflows` 4개 쿼리를 동시 실행 후 전체를 메모리에 올림. 장기간 데이터나 워크스페이스 규모에 따라 OOM 위험. 또한 CSV 포맷 시 execution 데이터만 내보내고 summary/errors/topWorkflows는 제외됨.
- 제안: CSV 내보내기 범위를 명확히 문서화하거나 모든 데이터 포함; 대용량 대비 페이지 단위 제한 추가

---

**[WARNING]** `getNodeStats` — PostgreSQL 전용 쿼리
- 위치: `statistics.service.ts` - `getNodeStats()`
- 상세: `::int`, `::float`, `::numeric`, `FILTER (WHERE ...)` 문법은 PostgreSQL 전용. 다른 DB 사용 시 동작하지 않음. 또한 `ROUND(..., 2)::float` 캐스팅 체인이 불필요하게 복잡함.
- 제안: TypeORM의 DB 무관 표현식 사용 또는 PostgreSQL 의존성을 명시적으로 문서화

---

**[INFO]** `runs7dChangePercent` — 분모가 0일 때 null 반환 처리
- 위치: `dashboard.service.ts`, `dashboard/page.tsx`
- 상세: `runs7dPrevious === 0`이면 `null` 반환하여 UI에서 변화율 표시 안 함. 의도된 동작이나 "이전 기간 데이터 없음" 표시가 없어 사용자가 혼란스러울 수 있음.
- 제안: null인 경우 "N/A" 또는 "첫 주 데이터" 등 명시적 메시지 표시 고려

---

**[INFO]** `SlideDrawer` — `body.style.overflow` 중첩 드로어 충돌
- 위치: `slide-drawer.tsx`
- 상세: 여러 드로어가 동시에 열릴 경우(authentication 페이지와 triggers 페이지 등), 하나가 닫힐 때 cleanup에서 `overflow: ""`로 초기화하여 나머지 드로어도 스크롤 가능해짐.
- 제안: counter 방식 또는 포털 레이어 스택으로 관리

---

**[INFO]** `AuthConfigUsage.lastUsedAt` — `config.lastUsedAt` 필드 존재 여부 미확인
- 위치: `auth-configs.service.ts` - `getUsage()`
- 상세: `AuthConfig` 엔티티에 `lastUsedAt` 필드가 실제로 존재하는지 확인 필요. 없을 경우 항상 `null` 반환.
- 제안: 엔티티 정의 확인 및 필요시 필드 추가

---

**[INFO]** `exportWorkflow` — TODO 제거됨으로 표시했지만 edge `containerId`/`toolOwnerId` 누락
- 위치: `workflows.service.ts` - `exportWorkflow()`
- 상세: 노드 내보내기 시 `containerId`와 `toolOwnerId`를 포함하나, 이들은 UUID(DB ID)로 내보내진다. import 시에는 index 기반으로 재구성하므로 `toolOwnerId`(UUID)는 가져온 워크스페이스에서 유효하지 않을 수 있음.
- 제안: `toolOwnerId` 내보내기/가져오기 전략 명확화 필요

---

**[INFO]** `RunResultsDrawer` — `activeTab` 인덱스가 결과 추가 시 범위 초과 가능성
- 위치: `run-results-drawer.tsx`
- 상세: `activeTab`이 `nodeResults` 배열 index 기반인데, reset 후 새 실행 시작 시 `activeTab`이 이전 값 유지 가능. `nodeResults[activeTab]`이 `undefined`가 될 수 있으나 조건부 렌더링으로 방어됨.
- 제안: `startExecution` 시 `activeTab`을 0으로 리셋하는 로직 추가 권장

---

### 요약

전체적으로 요구사항 기능들(대시보드 비교 지표, 스케줄 미리보기, 트리거 히스토리, 워크플로우 임포트/익스포트, 통계 내보내기, 인증 설정 사용 현황)이 구현되어 있으나, 핵심적인 요구사항 충족 리스크가 존재한다. 가장 심각한 문제는 `getHistory` API 필드 불일치로 인해 트리거 히스토리가 실제로 표시되지 않는 점, OAuth reauthorize의 CSRF state 검증 미구현, 잘못된 cron 표현식에 대한 예외 미처리로 인한 서버 오류 노출이다. `getWorkflowIdForSchedule`의 relation 로딩 의존성도 런타임 오류 가능성을 내포한다. 테스트 커버리지는 store/utils 레이어에 집중되어 있고 신규 서비스 메서드(getUsage, getHistory, getNodeStats, exportData, computeNextRuns, importWorkflow)에 대한 백엔드 단위 테스트가 전무하여 요구사항 검증이 불완전하다.

### 위험도

**MEDIUM**