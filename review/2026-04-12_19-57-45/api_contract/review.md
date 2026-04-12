### 발견사항

- **[WARNING]** `getForExecution` 메서드가 인증/인가 없이 복호화된 자격증명을 반환
  - 위치: `integrations.service.ts` - `getForExecution(id, workspaceId)`
  - 상세: `requireEntity`를 그대로 위임하는데, 해당 메서드가 workspaceId 범위 검증만 수행하고 실행 엔진 컨텍스트에서의 추가 권한 검사(예: 워크플로우가 해당 integration에 접근할 수 있는지)가 없음. 자격증명은 완전히 복호화된 상태로 반환됨.
  - 제안: 실행 엔진 전용 호출임을 명시하는 guard 또는 최소한 메서드 계약(JSDoc)에 "caller is responsible for authorization" 명시 강화. 현재 주석만으로는 부족.

- **[WARNING]** `paramsSerializer` 변경이 기존 API 호출 전체에 영향
  - 위치: `frontend/src/lib/api/client.ts`
  - 상세: 전역 axios 인스턴스의 `paramsSerializer`를 변경함. 기존에 배열이 아닌 파라미터를 사용하던 모든 API 엔드포인트는 영향이 없지만, 이미 배열 파라미터를 bracket 방식(`foo[]`)으로 전송했던 코드가 있다면 breaking change가 될 수 있음.
  - 제안: 변경 전 기존 배열 쿼리 파라미터를 사용하는 엔드포인트 목록 확인 필요. 현재 변경은 `integrationsApi.list({ serviceType: [...] })` 사용을 위해 올바른 방향이나, 회귀 위험 있음.

- **[INFO]** `IntegrationsService.logUsage` API가 암묵적 계약으로 핸들러와 공유됨
  - 위치: `integration-handler-base.ts:logUsage`, `send-email.handler.ts:safeLogUsage`
  - 상세: `SendEmailHandler`는 `IntegrationHandlerBase`를 상속하지 않고 독립적으로 `safeLogUsage`를 구현함. `logUsage` 파라미터 구조(`integrationId`, `nodeExecutionId`, `workflowId`, `status`, `durationMs`, `error`)가 두 곳에 중복 정의되어 계약 드리프트 위험이 있음.
  - 제안: `SendEmailHandler`를 `IntegrationHandlerBase`를 상속하도록 리팩토링하거나, `logUsage` 파라미터 타입을 shared 타입으로 추출.

- **[INFO]** `ExecutionContext.nodeExecutionId`가 optional로 추가됨
  - 위치: `node-handler.interface.ts:4`
  - 상세: breaking change는 아니나, `nodeExecutionId`가 없을 때 usage log가 silently 스킵됨(`if (!context.nodeExecutionId) return`). 실행 엔진이 항상 이 값을 설정하는지 계약이 명시적이지 않아 미래 핸들러 구현자가 혼동할 수 있음.
  - 제안: optional 유지 자체는 괜찮으나, "engine always sets this before handler invocation" 주석 보강 또는 타입 레벨에서 required로 두고 엔진에서 assertion 추가 고려.

- **[INFO]** `IntegrationSelector`의 API 쿼리 파라미터 `serviceType`이 배열로 전송됨
  - 위치: `integration-selector.tsx:26`, `client.ts paramsSerializer`
  - 상세: 클라이언트 측에서 `{ serviceType: ["email"] }` 형태로 전송. 백엔드의 해당 DTO에서 `@IsArray()` + `@Transform()` 등으로 배열 파라미터를 올바르게 수신하는지 확인 필요. 변경된 serializer와 백엔드 validation pipe 간 계약이 일치해야 함.
  - 제안: 백엔드 `list` 쿼리 DTO에서 `serviceType`이 배열로 선언되어 있는지 확인.

---

### 요약

이번 변경은 기존 통합(Integration) 노드 핸들러들에 실제 자격증명 기반 실행 능력을 부여하는 실질적인 기능 추가로, API 계약 관점에서 대부분 안전하게 설계되어 있습니다. `getForExecution` 엔드포인트는 workspaceId 범위 격리를 유지하며, `paramsSerializer` 변경은 Express의 기본 쿼리 파싱 방식에 맞게 올바르게 수정되었습니다. 다만 `SendEmailHandler`가 `IntegrationHandlerBase`를 상속하지 않아 `logUsage` 계약이 이중화되는 점, `getForExecution`이 복호화된 자격증명을 반환할 때 추가 인가 계층이 없다는 점은 주의가 필요합니다. 전반적으로 API 계약 breaking change는 없으나 내부 서비스 계약의 일관성을 높일 여지가 있습니다.

### 위험도
**LOW**