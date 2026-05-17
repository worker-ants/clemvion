# 변경 범위(Scope) 리뷰 결과

## 발견사항

### 파일 11: backend/src/modules/integrations/integration-oauth.service.ts

- **[CRITICAL]** `parseTokenExpiresAt` 함수 삭제 — notification dismiss 작업과 무관한 Cafe24 OAuth 토큰 파싱 로직 제거
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` (+6173 ~ +6213 삭제)
  - 상세: 본 PR 의 주요 목적은 알림 dismiss 기능(soft delete) 도입이다. 그런데 이 파일에서 `parseTokenExpiresAt` exported function 이 삭제되고 `normalizeTokenResponse` 안에서 `expires_in` 만 읽는 단순 로직으로 대체됐다. 이 변경은 "Cafe24 `expires_at` ISO string 파싱 + 2h fallback" 로직을 제거하는 기능 복구(revert)로, notification dismiss 와 직접적 연관이 없는 별도 버그 픽스/리버트다. `parseTokenExpiresAt` 은 별도 파일(`cafe24-api.client.spec.ts`) 에 전용 테스트가 있었고, 그 테스트도 함께 삭제됐다.
  - 제안: 이 변경을 별도 PR 로 분리하거나, PR 설명에 명시적으로 의도적 revert 임을 기록해야 한다.

### 파일 22: backend/src/nodes/integration/cafe24/cafe24-api.client.ts

- **[CRITICAL]** `ensureFreshToken` 의 null expiry 처리 로직 revert — notification dismiss 와 무관한 동작 변경
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` (라인 548 부근)
  - 상세: 이전 버전에서 `expiresAtMs === null` 을 "needs refresh" 로 해석하여 null expiry 로 저장된 기존 통합이 자가 회복되도록 했으나, 본 PR 에서 `if (expiresAtMs === null) return;` 으로 되돌렸다. 또한 refresh 응답에서 `expires_at` ISO string 파싱 로직도 제거하고 `expires_in` + 2h fallback 만 남겼다. 이는 이미 배포된 Cafe24 OAuth 버그 픽스를 되돌리는 동작으로, notification dismiss PR 의 범위를 크게 벗어난다.
  - 제안: Cafe24 토큰 파싱 변경이 의도적 결정이라면 독립 PR 로 분리해 이력을 명확히 남겨야 한다.

### 파일 21: backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts

- **[CRITICAL]** null expiry self-heal 회귀 테스트 삭제 — notification dismiss 와 무관
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` (라인 732~1024 부근, 94줄 삭제)
  - 상세: "refreshes proactively when both tokenExpiresAt and credentials.expires_at are NULL" 테스트가 삭제됐다. 이 테스트는 파일 11/22 의 Cafe24 OAuth 버그 픽스를 보호하는 회귀 잠금으로, 같은 기능의 revert 와 함께 삭제됐다. 그러나 notification dismiss 와는 완전히 무관한 영역이다.
  - 제안: 파일 11/22 와 함께 별도 PR 로 이동.

### 파일 7: backend/src/modules/execution-engine/workflow-errors.ts

- **[CRITICAL]** `WorkflowNotFoundError` / `SubWorkflowTimeoutError` typed error 계층 삭제 — notification dismiss 와 무관
  - 위치: `backend/src/modules/execution-engine/workflow-errors.ts` (파일 전체 삭제, 42줄)
  - 상세: 이 파일은 sub-workflow 에러를 타입-안전하게 분기하기 위해 도입된 typed error 클래스를 정의한다. notification dismiss PR 에서 이 파일이 삭제되고, 호출 지점에서 plain `Error` 로 대체됐다. 이는 notification dismiss 기능과 완전히 무관한 별도의 아키텍처 결정(typed error 계층 폐기)이다.
  - 제안: notification dismiss PR 범위에서 제외하고 별도 PR 로 추적.

### 파일 6: backend/src/modules/execution-engine/execution-engine.service.ts

- **[CRITICAL]** `WorkflowNotFoundError` / `SubWorkflowTimeoutError` import 삭제 및 plain Error 로 대체 — notification dismiss 와 무관
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` (diff 라인 2164~2253 부근)
  - 상세: `workflow-errors.ts` 삭제에 연동하여 3개 호출 지점에서 typed error 를 plain `Error` 로 교체했다. 또한 `buildConversationConfigFromOutput` 함수에서 `output.result.*` 단일 경로 → top-level `output.*` 로의 구조 변경이 포함됐다. 이 두 변경 모두 notification dismiss 와 무관하다.
  - 제안: 파일 7 과 함께 별도 PR 로 분리.

### 파일 5: backend/src/modules/execution-engine/execution-engine.service.spec.ts

- **[CRITICAL]** `output.result.*` → `output.*` 구조 변경 반영 및 D6 회귀 차단 테스트 삭제 — notification dismiss 와 무관
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.spec.ts` (diff 라인 429~680)
  - 상세: 다수의 테스트에서 `output: { result: { messages, message, turnCount } }` → `output: { messages, message, turnCount }` 로 구조가 변경됐고, D6(2026-05-17) 회귀 차단 테스트 ("ignores legacy top-level message/messages/turnCount/maxTurns") 가 삭제됐다. 이는 execution-engine 의 multi-turn output 컨트랙트 변경으로 notification dismiss 범위와 무관하다.
  - 제안: 파일 6/7 과 함께 별도 PR.

### 파일 20: backend/src/nodes/flow/workflow/workflow.handler.ts

- **[WARNING]** `mapSubWorkflowError` 시그니처 변경 (typed error → string 매칭) — notification dismiss 와 무관
  - 위치: `backend/src/nodes/flow/workflow/workflow.handler.ts` (라인 9597~9665)
  - 상세: `mapSubWorkflowError(err: unknown)` → `mapSubWorkflowError(message: string)` 로 파라미터 타입이 변경되고 `instanceof` 분기가 제거됐다. `workflow-errors.ts` 삭제에 연동된 변경이지만 notification dismiss 와는 무관하다.
  - 제안: 파일 7 과 함께 별도 PR.

### 파일 19: backend/src/nodes/flow/workflow/workflow.handler.spec.ts

- **[WARNING]** typed error 분기 테스트 3건 삭제 — notification dismiss 와 무관
  - 위치: `backend/src/nodes/flow/workflow/workflow.handler.spec.ts` (diff 라인 8905~8945)
  - 상세: `WorkflowNotFoundError` / `SubWorkflowTimeoutError` 인스턴스를 사용한 `mapSubWorkflowError` 테스트 3건이 삭제됐다. 파일 7/20 변경에 연동되어 있으나 notification dismiss 와 무관하다.
  - 제안: 파일 20 과 함께 별도 PR.

### 파일 63: spec/4-nodes/4-integration/0-common.md

- **[WARNING]** Integration 공통 에러 경로 spec 롤백 — D4 결정 폐기 — notification dismiss 와 무관
  - 위치: `spec/4-nodes/4-integration/0-common.md` (라인 25539~25580)
  - 상세: D4 결정 (2026-05-17, "pre-flight `IntegrationError` throw 경로 폐기. Integration 4종 모두 `port: 'error'` 단일 경로") 이 롤백되어 종전 pre-flight throw 경로가 복구됐다. §7 색인에서도 Pre-flight throw 열이 복구됐고 CHANGELOG 의 D4 결정 행이 삭제됐다. 이는 notification dismiss 범위와 무관한 spec 롤백이다.
  - 제안: 별도 spec PR 로 이력 명시.

### 파일 64~66, 68: spec/4-nodes/4-integration/{1-http-request, 2-database-query, 3-send-email}.md, spec/data-flow/8-notifications.md

- **[INFO]** 파일 64~66 의 변경은 파일 63 (D4 롤백) 에 연동된 것으로, notification dismiss 범위에는 포함되지 않는다. 8-notifications.md 변경은 dismiss 도입 spec 의 핵심으로 본 PR 의 정당한 범위다.
  - 위치: 파일 64~66
  - 상세: D4 rollback 으로 http-request / database-query / send-email spec 의 §5.8 pre-flight throw 섹션이 복구됐다. 이는 notification dismiss PR 에서 처리되어야 할 내용이 아니다.
  - 제안: 파일 63 과 함께 별도 spec PR.

### 파일 8: backend/src/modules/integrations/integration-action-required-notifier.service.ts

- **[INFO]** `channel` 타입 캐스트에 `'email'` 추가 — notification dismiss 와의 관련성 낮음
  - 위치: `backend/src/modules/integrations/integration-action-required-notifier.service.ts` (라인 3770~3784)
  - 상세: `channel` 타입을 `'both' | 'in_app'` → `'both' | 'in_app' | 'email'` 로 확장했다. 이는 dismiss 도입과 함께 notification 관련 타입 정합화 차원에서 수행된 것으로 보이나, 직접적 기능 연관이 없다.
  - 제안: dismiss 도입 범위에서 필요한 타입 변경이라면 PR 설명에 근거를 명시.

### 파일 33: plan/in-progress/node-output-redesign/README.md

- **[INFO]** D4 행 표기 간소화 — execution engine / node-output-redesign plan 의 메타데이터 갱신
  - 위치: `plan/in-progress/node-output-redesign/README.md` (라인 19519~19520)
  - 상세: D4 행에서 상세 설명을 제거하고 별도 README 링크로 대체했다. plan 라이프사이클 관리 차원의 변경이지만, D4 롤백과 연동되어 있어 별도 범위에 속한다.
  - 제안: spec 63/64~66 변경과 함께 별도 PR 로 이동.

---

## 요약

본 PR 은 알림 dismiss(soft delete) 기능 도입을 목적으로 한다. 해당 목적에 부합하는 변경 — V055/V056 마이그레이션, notification 엔티티/서비스/컨트롤러/DTO 추가, sidebar UI 의 dismiss 액션, e2e 테스트, spec/1-data-model.md·spec/data-flow/8-notifications.md·spec/2-navigation/_layout.md 갱신, plan 파일 추가 — 은 명확하게 의도된 범위에 속한다. 그러나 동일 PR 에 **최소 5개의 독립된 의도 이상 변경**이 혼재해 있다: (1) Cafe24 OAuth `parseTokenExpiresAt` 함수 삭제 및 null-expiry self-heal 로직 revert, (2) execution-engine 의 `output.result.*` → `output.*` multi-turn 컨트랙트 변경(D6 revert), (3) `workflow-errors.ts` typed error 계층 삭제 및 plain Error 대체, (4) Integration 노드 D4 결정 롤백(pre-flight throw 경로 복구), (5) 그에 따른 각 spec 및 테스트 변경. 이 중 (1)~(4) 는 notification dismiss 와 기능적 연관이 없으며, 각각 별도의 설계 결정으로 이력이 추적되어야 한다. 특히 Cafe24 OAuth 변경은 이전에 사용자 보고 기반으로 도입된 버그 픽스를 되돌리는 것으로 CRITICAL 수준의 범위 초과에 해당한다.

## 위험도

HIGH
