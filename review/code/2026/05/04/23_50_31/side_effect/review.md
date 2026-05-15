## 발견사항

### [CRITICAL] TriggerCell에 undefined source 전달 시 런타임 크래시
- **위치**: `frontend/src/components/executions/trigger-cell.tsx:33`
- **상세**: `const Icon = TRIGGER_ICON[source]`에서 `source`가 `undefined`이거나 열거형에 없는 새 값이면 `Icon`이 `undefined`가 되어 `<Icon className="..." />`가 React 렌더 오류를 발생시킨다. 특히 배포 순서에 따라 프론트엔드가 먼저 배포될 경우, 백엔드 응답에 `triggerSource` 필드가 없어서 `undefined`가 그대로 넘어올 수 있다.
- **제안**:
  ```tsx
  const Icon = TRIGGER_ICON[source] ?? HelpCircle;
  ```
  또는 컴포넌트 상단에 `if (!source || !TRIGGER_ICON[source]) return <FallbackCell />;` 가드 추가.

---

### [WARNING] 기존 React Query 캐시와 새 RecentExecution 인터페이스 불일치
- **위치**: `frontend/src/app/(main)/dashboard/page.tsx:53-55`
- **상세**: 프론트엔드 로컬 `RecentExecution` 인터페이스가 `triggerSource: ExecutionTriggerSource`를 required로 선언하고 있다. 브라우저에 `["dashboard", "recent-executions"]` 캐시가 남아 있는 상황에서 프론트만 먼저 배포되면, 캐시 데이터에 `triggerSource`가 없어 `TriggerCell`에 `undefined`가 전달되어 위 CRITICAL 이슈를 촉발한다.
- **제안**: 배포 순서를 백엔드 → 프론트엔드로 보장하거나, `TriggerCell`에 `source` 가드를 추가해 안전망을 확보한다.

---

### [WARNING] selective leftJoin으로 trigger/executor 관계 객체 컬럼 일부만 로드
- **위치**: `backend/src/modules/dashboard/dashboard.service.ts:145-149`
- **상세**: `leftJoin('e.trigger', 'trigger').addSelect(['trigger.id', 'trigger.type', 'trigger.name'])` 패턴은 `trigger` 관계 객체를 부분 로드한다. 동일 `executionRepository.createQueryBuilder` 결과를 재사용하거나, 미래에 `getRecentExecutions` 반환값에 `trigger.webhookUrl` 등 다른 컬럼을 추가하면 `undefined`가 조용히 반환된다. TypeORM은 이 경우 에러를 던지지 않아 디버깅이 어렵다.
- **제안**: 주석에 "trigger/executor는 id·type·name 3개 컬럼만 로드됨" 명시, 또는 응답 DTO에서 해당 필드를 명시적으로 추출한 뒤 raw entity를 노출하지 않도록 한다.

---

### [WARNING] RecentExecutionDto.triggerSource — required 필드 추가로 인한 API 계약 변경
- **위치**: `backend/src/modules/dashboard/dto/responses/dashboard-response.dto.ts:72-80`
- **상세**: `triggerSource`가 `@ApiProperty`(required)로 추가되었다. 기존 API 사용자가 응답을 strict하게 검증하는 경우 새 필드가 항상 존재한다고 가정하게 된다. 반대로, 이전 API 클라이언트는 `triggerSource`를 모르고 무시한다. 하위 호환은 유지되지만, OpenAPI 스펙 기반 클라이언트 코드 자동 생성 도구는 regeneration 전까지 타입 오류를 낼 수 있다.
- **제안**: 특별한 조치 불필요하나, SDK/클라이언트 코드 regeneration을 배포 절차에 포함할 것을 권장.

---

### [WARNING] websocket.gateway.spec.ts — `as never` 타입 캐스트로 미래 타입 확장 감지 불가
- **위치**: `backend/src/modules/websocket/websocket.gateway.spec.ts:147`
- **상세**: `mockResolvedValue({ id: 'exec-abc' } as never)`는 TypeScript 컴파일러가 mock 객체의 완전성을 검사하지 않도록 억제한다. `ExecutionDetailWithTrigger`에 필수 필드가 추가되더라도 이 테스트는 조용히 컴파일되어 불완전한 mock을 계속 사용한다.
- **제안**: `as Partial<ExecutionDetailWithTrigger> as never` 대신 필요한 최소 필드를 실제로 채워 `as ExecutionDetailWithTrigger`로 캐스팅한다.

---

### [INFO] loadParentWorkflowNames 추출 — 함수 시그니처 변경이 내부에서만 발생
- **위치**: `backend/src/modules/executions/utils/load-parent-workflow-names.ts`
- **상세**: `private loadParentWorkflowNames(executions)` → `loadParentWorkflowNames(repo, executions)`로 시그니처가 변경되었으나, 해당 메서드는 `private`이었으므로 외부 호출자에 영향 없음. 두 호출 지점(`executions.service.ts`, `dashboard.service.ts`) 모두 동시에 업데이트되었다.

---

### [INFO] dashboard.service.ts — loadParentWorkflowNames 항상 호출됨
- **위치**: `backend/src/modules/dashboard/dashboard.service.ts:158`
- **상세**: `executions`가 빈 배열이어도 `loadParentWorkflowNames`가 호출된다. 함수 내부에서 `parentIds.length === 0`이면 조기 반환하므로 추가 DB 쿼리는 발생하지 않지만, 함수 호출 자체는 항상 일어난다. 기존 `ExecutionsService`와 동일한 패턴이므로 새로운 이슈는 아님.

---

## 요약

이번 변경에서 가장 중요한 부작용 위험은 **프론트엔드 `TriggerCell`의 방어 코드 부재**다. `TRIGGER_ICON[source]`가 `undefined`를 반환할 수 있는 두 경우(배포 순서 불일치에 따른 stale 캐시, 또는 백엔드에서 새 trigger type 추가)에 모두 React 렌더 크래시로 이어진다. 백엔드 측은 `private` 메서드를 standalone 유틸리티로 안전하게 추출했으며, selective join 패턴도 `ExecutionsService`와 일관성 있게 적용되었다. `RecentExecution` 인터페이스 확장은 순수한 additive 변경으로 하위 호환성을 유지하나, OpenAPI 클라이언트 regeneration을 배포 절차에 포함해야 한다.

## 위험도

**MEDIUM** — 프론트엔드 크래시 경로가 명확히 존재하나, 배포 순서(백엔드 먼저)를 지키면 새 캐시가 쌓이면서 자연 해소된다. 그러나 `TriggerCell`의 방어 코드 추가는 미래 확장성을 위해 권장된다.