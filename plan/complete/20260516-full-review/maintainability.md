# 유지보수성(Maintainability) 리뷰

검토 기준 커밋: `bbd838ef`

---

## 발견사항

### 중복 코드

- **[WARNING]** `APP_URL` 폴백 리터럴 `'http://localhost:3011'` 이 두 파일에 걸쳐 6회 반복
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:830`, `1076` / `codebase/backend/src/modules/integrations/integration-oauth.service.ts:490`, `968`, `1079`, `1359`
  - 상세: `process.env.APP_URL || 'http://localhost:3011'` 표현이 두 서비스에 총 6곳에 흩어져 있다. 정수(3011)와 함께 변경되어야 하는 두 파일 중 하나를 놓치는 오염 경로가 명확히 존재한다. `buildCafe24AppUrl` 내부의 `.replace(/\/$/, '')` 체인이 `requestScopes` 내부의 동일 체인과 불일치(`integrations.service.ts:830` 는 strip 없음)해 엣지 케이스에서 이중 슬래시 URL 가능성도 남는다.
  - 제안: `third-party-oauth.constants.ts` 또는 별도 `app-config.ts`에 `function getAppBaseUrl(): string` 하나를 정의하고 전 지점에서 임포트. 폴백 포트도 상수로 추출.

- **[WARNING]** `LAST_ERROR_MESSAGE_MAX_LEN = 200` (OAuth 서비스) vs `MCP_ERROR_MESSAGE_MAX_LEN = 2048` (MCP 에러 코드) — 두 개의 서로 다른 메시지 길이 상한 상수가 공존하며 `clampMessage` 와 `sanitizeLastErrorMessage` 두 개의 유사한 클램프 함수가 별도로 구현되어 있다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:193,220` / `codebase/backend/src/modules/mcp/mcp-error-codes.ts:35` / `codebase/backend/src/modules/integrations/integrations.service.ts:99`
  - 상세: `clampMessage` (integrations.service.ts)는 `MCP_ERROR_MESSAGE_MAX_LEN`(2048)을 사용하고, `sanitizeLastErrorMessage` (integration-oauth.service.ts)는 `LAST_ERROR_MESSAGE_MAX_LEN`(200)을 사용한다. 두 함수는 목적은 동일하지만 길이 한도, 비밀 마스킹 여부, fallback 처리 방식이 모두 다르다. 동일 `Integration.last_error` 컬럼을 쓰는 두 경로의 메시지 길이가 다르다.
  - 제안: `mcp-error-codes.ts`의 `sanitizeMcpErrorMessage`를 공용 함수로 확장하거나, 두 함수를 `integrations-error-utils.ts`로 통합하여 단일 진실 지점 확보.

- **[WARNING]** `extractSid` / `extractOperationId` 내부 파싱 로직이 `Cafe24McpToolProvider` 와 `McpToolProvider`(`parseMcpToolName`) 에 별도로 구현되어 있다
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts:454-468` / `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts:150-161`
  - 상세: 두 클래스 모두 `mcp_<sid>__<rest>` 형식의 도구 이름을 파싱하지만 구현이 분리되어 있다. `McpToolProvider`는 `parseMcpToolName` 유틸을 export하고 있으나 `Cafe24McpToolProvider`는 이를 재사용하지 않고 private 메서드 두 개로 따로 파싱한다. 향후 형식이 변경되면 두 곳을 동시에 고쳐야 한다.
  - 제안: `Cafe24McpToolProvider.extractSid` / `extractOperationId` 를 제거하고 `parseMcpToolName` 을 임포트해 재사용. `extractOperationId` 의 로직은 `parseMcpToolName` 반환값의 `toolNameSanitized` 에 이미 해당하므로 코드 삭제로 단순화 가능.

- **[INFO]** `sanitizeId` (ai-agent.handler.ts)와 `sanitizeToolName` (mcp-tool-provider.ts)가 동일한 정규식 `[^a-zA-Z0-9_]`으로 동일한 변환을 수행
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:138` / `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts:93`
  - 상세: 두 함수 모두 LLM-safe 도구 이름 생성을 위해 알파누메릭+언더스코어 이외 문자를 `_`으로 치환하는 동일 로직이다.
  - 제안: 공용 유틸리티 함수로 추출하거나, `mcp-tool-provider.ts`의 `sanitizeToolName`을 export하고 handler에서 임포트.

---

### 로깅 일관성

- **[WARNING]** `console.warn` 이 NestJS `Logger` 대신 사용된 위치가 4곳 존재하며 구조화 로깅 파이프라인에서 누락된다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:702` / `codebase/backend/src/modules/integrations/integration-oauth.service.ts:307` / `codebase/backend/src/modules/integrations/services/credentials-transformer.ts:45,58`
  - 상세: `IntegrationsService.logUsage` 의 catch 블록은 `console.warn`을 사용한다. `credentials-transformer.ts` 는 모듈 수준(비-클래스)이라 NestJS Logger 주입이 불가하지만, 전용 Logger 인스턴스(`new Logger(...)`)는 사용 가능하다. `integration-oauth.service.ts:307` 는 `this.logger`가 이미 존재하는 클래스 내부의 함수에서 `console.warn`을 사용하는 형태다.
  - 제안: `credentials-transformer.ts`는 `const logger = new Logger('CredentialsTransformer')`로 교체. `integrations.service.ts:702`와 `integration-oauth.service.ts:307`은 해당 클래스의 `this.logger.warn`으로 통일.

- **[WARNING]** `table.handler.ts`의 `safeEvaluate`에 `console.error` 3연속 호출이 남아 있다
  - 위치: `codebase/backend/src/nodes/presentation/table/table.handler.ts:264-269`
  - 상세: 프로덕션 코드에서 `console.error` 3개가 연속 호출되며, 각각 template, ctx.$sourceItem, ctx.$var 전체를 출력한다. `ctx.$var`에는 사용자 데이터나 민감 값이 포함될 수 있고, NestJS 로깅 인프라를 우회한다. `TableHandler`에는 `Logger`가 주입되어 있을 것으로 예상되는데 이 경로만 `console.*`을 사용한다.
  - 제안: `this.logger.error`로 교체하고, `ctx.$var` 전체를 로그에 노출하는 것이 적절한지 보안 검토 후 필요시 필드를 제한.

- **[INFO]** `node-handler.registry.ts:89`에 `console.warn`이 비-프로덕션 전용 분기에 존재
  - 위치: `codebase/backend/src/nodes/core/node-handler.registry.ts:89`
  - 상세: `(non-production)` 주석과 함께 `console.warn`을 사용하지만 NestJS Logger와 일관성이 없다.
  - 제안: `new Logger('NodeHandlerRegistry').warn(...)` 으로 교체.

---

### 매직 넘버 / 문자열

- **[WARNING]** `EXPIRING_SOON_INTERVAL = "INTERVAL '7 days'"` 가 SQL 내장 문자열 리터럴로 하드코딩되어 있으며 프론트엔드의 `EXPIRING_SOON_DAYS = 7` 과 주석으로만 동기화를 안내한다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:250`
  - 상세: 코드 주석에 "Update both layers together"라고 명시되어 있으나, 이는 컴파일 타임 보장이 아니다. 백엔드 `7 days`와 프론트엔드 `EXPIRING_SOON_DAYS = 7`은 테스트 실패 없이 서로 다른 값으로 표류할 수 있다.
  - 제안: 7이라는 숫자를 `cafe24-token-refresh.constants.ts` 등의 공유 상수로 추출하거나, 적어도 백엔드 쪽도 `const EXPIRING_SOON_DAYS = 7`를 선언하고 `INTERVAL '${EXPIRING_SOON_DAYS} days'`로 사용해 숫자를 한 곳에서만 관리.

- **[INFO]** `TOOL_RESULT_PREVIEW_CHARS = 200`, `MAX_DESCRIPTION_LEN = 500`, `MAX_INTEGRATION_NAME_LEN = 80` 등 LLM 관련 길이 상수들이 여러 파일에 분산
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:66` / `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts:35-37`
  - 상세: 서로 다른 성격의 상수들이지만, AI Agent 관련 조정 시 여러 파일을 함께 파악해야 한다.
  - 제안: `ai-agent-limits.constants.ts` 같은 파일로 통합하거나, 현재 위치를 유지하되 관련 상수를 한 파일에서만 정의하고 다른 파일이 임포트하도록 정리.

---

### 파일/함수 길이

- **[WARNING]** `integration-oauth.service.ts` 가 1818줄이며 Cafe24 Private/Public 분기, HMAC 검증, 토큰 교환, 콜백 처리, nonce 등 다수의 책임을 단일 클래스에 담고 있다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (전체)
  - 상세: `begin`, `handleCallback`, `handleInstall`, `precheckCafe24Mall`, `tryRecoverByMallId`, `createPrivatePendingIntegration`, `exchangeCodeForToken`, `purgeExpired` 등 OAuth 흐름 전반과 Cafe24-특화 로직이 혼재한다. 새로운 OAuth 제공자 추가 또는 Cafe24 로직 변경 시 파일 전체를 파악해야 한다.
  - 제안: Cafe24 특화 로직(`handleInstall`, `tryRecoverByMallId`, `createPrivatePendingIntegration`, `precheckCafe24Mall`, HMAC 검증)을 `cafe24-oauth.service.ts`로 분리하고 `IntegrationOAuthService`가 위임하는 구조로 리팩토링. 단기적으로는 파일 내 섹션 구분자를 명시적으로 유지.

- **[WARNING]** `ai-agent.handler.ts` 가 2099줄이며 단일 턴, 멀티 턴, 컨디션 평가, RAG 누적, 도구 실행, WebSocket 이벤트 등 AI 에이전트의 거의 모든 책임을 포함한다
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (전체)
  - 상세: `executeSingleTurn` (~103줄), `executeMultiTurn` (~150줄), `processMultiTurnMessageInner` (~500줄 추정) 등 각 메서드 자체는 합리적이지만, 파일 하나가 너무 많은 기능 단위를 포함한다. `RagAccumulator` 클래스, 다수의 모듈-레벨 함수, 여러 인터페이스가 혼재한다.
  - 제안: `RagAccumulator`를 `rag-accumulator.ts`로, `mapTurnsToChatMessages` 등 렌더링 유틸을 `ai-agent-utils.ts`로 추출. 멀티-턴 상태 관리 로직을 별도 클래스로 분리 고려.

- **[INFO]** `codebase/frontend/src/components/editor/run-results/result-detail.tsx` 1111줄
  - 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx` (전체)
  - 상세: 단일 컴포넌트 파일이 결과 표시, 상태 배지, 대화 인스펙터, 배경 실행 섹션, 폼 UI 등을 모두 포함한다.
  - 제안: `StatusBadge`, `NodeResultTabs` 등 독립적인 UI 단위를 별도 파일로 추출하여 파일 크기를 줄임.

---

### 네이밍 일관성

- **[INFO]** `errMsg` 헬퍼가 `Cafe24McpToolProvider`(private 메서드)와 동일한 패턴의 인라인 표현 `err instanceof Error ? err.message : String(err)`이 여러 파일에 반복
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts:544` / 다수 catch 블록
  - 상세: `cafe24-mcp-tool-provider.ts`는 `private errMsg(err: unknown): string`를 별도 메서드로 갖고 있으나 다른 파일들은 동일 패턴을 인라인으로 쓴다. 패턴이 일관되지 않아 lint 등으로 추적하기 어렵다.
  - 제안: 공용 `toErrorMessage(err: unknown): string` 유틸리티 함수를 `common/utils/error.ts` 에 두고 전 파일에서 임포트.

- **[INFO]** `requestScopes` 메서드 내 로컬 변수 `creds` 와 같은 라인의 `entity.credentials` 가 함께 사용되어 혼란 야기
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:817`
  - 상세: `const creds = entity.credentials;` 선언 후 바로 아래에서 `entity.credentials`를 직접 참조하는 줄이 섞여 있다. 두 가지 참조 방식이 같은 함수 내에서 혼용된다.
  - 제안: 함수 내에서 `creds` 또는 `entity.credentials` 중 하나만 사용하도록 통일.

---

### 데드 코드 / 잔여 임시조치

- **[WARNING]** `workflow.handler.ts:216`의 TODO가 정리되지 않은 채 잔존
  - 위치: `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts:216`
  - 상세: `// TODO: replace with instanceof WorkflowNotFoundError / WorkflowTimeoutError` — 에러 타입 판별 로직이 문자열 매칭으로 남아 있으며 리팩토링 의도가 코드에 기록만 된 상태다.
  - 제안: `WorkflowNotFoundError` / `WorkflowTimeoutError` 타입을 정의하고 instanceof 분기로 교체하거나, 명확한 완료 기한을 plan 문서에 기록.

- **[INFO]** `review-workflow.ts:716`의 TODO(`ED-AI-39 legacy fallback`)가 잔존
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/review-workflow.ts:716`
  - 상세: `// TODO(ED-AI-39): legacy fallback 은 기존 세션의 pre-ED-AI-39 row 를 위한` — 신규 세션은 이미 새 구조를 따르므로 legacy 분기의 수명이 언제 끝나는지 기준이 없다.
  - 제안: 마이그레이션 완료 시점 기준(예: 2주 또는 특정 배포 버전 이후)을 명시하고, plan/in-progress에 제거 항목으로 등록.

---

### 복잡도 / 중첩

- **[WARNING]** `IntegrationOAuthService.begin()` 함수가 Cafe24 private/public 분기를 if-else로 깊이 중첩하여 순환 복잡도가 높다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts:364` (함수 전체)
  - 상세: `if (service.oauthProvider === 'cafe24')` → `if (meta.app_type === 'private')` → `if (params.mode !== 'new')` 의 3단 중첩이 있고, public 분기 내부에도 사전 가드 로직이 포함되어 있다. 함수 말미의 공통 OAuth 시작 코드와 Cafe24-특화 조기 반환이 혼재한다.
  - 제안: 앞서 제안한 Cafe24 분리와 연계하여 `begin()`의 Cafe24 분기를 `beginCafe24(params, meta)`로 추출. 얼리 리턴 패턴을 사용하여 중첩 깊이를 줄임.

- **[INFO]** `run()` 메서드 내부의 `resolveRecipients` N+1 패턴이 수동으로 수정(`recipientsByIntegration` + `allRecipientIds`)되었으나 루프 구조가 다소 복잡하다
  - 위치: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts:321-376`
  - 상세: 코드 주석(`B-4-2`)이 최적화 의도를 설명하고 있어 파악 가능하나, 두 번의 candidate 루프(recipients 수집 → 알림 생성)와 `Map<string, string[]>` 누산이 읽기 부담을 높인다. 코드는 올바르게 동작하나 이후 수정자를 위한 접근성이 낮다.
  - 제안: 두 단계 루프를 `collectRecipientsForCandidates` 같은 private 메서드로 추출하여 `run()`의 의도를 더 명확히 표현.

---

### 스펙 준수 / 일관성

- **[WARNING]** `credentials-transformer.ts`의 `warnedMissingKey`, `warnedUnreadable` 가 모듈-수준 변수(전역 상태)로 관리된다
  - 위치: `codebase/backend/src/modules/integrations/services/credentials-transformer.ts:38-39`
  - 상세: 모듈 로드 시 초기화되는 boolean 플래그로 "once-per-process" 경고를 구현한다. 테스트 환경에서 모듈이 캐시되므로 테스트 간 상태가 오염될 가능성이 있다. 실제 NestJS DI 컨텍스트에서는 문제없지만, TypeORM transformer가 클래스 외부 함수이므로 이 상태는 구조적으로 격리가 어렵다.
  - 제안: 경고 로직을 `NestJS Logger` 기반으로 교체하고, 중복 억제가 필요하면 `Logger.overrideLogger` 또는 외부 rate-limiter를 활용. 최소한 테스트에서 모듈 상태를 초기화할 수 있는 hook(`resetWarningFlags()`) 제공.

- **[INFO]** `Cafe24McpToolProvider.__resetForTesting()` 메서드가 public API로 노출되어 있다
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts:388`
  - 상세: 더블 언더스코어 컨벤션(`__`)으로 테스트 전용임을 표시했으나, TypeScript에서는 `private` 이 아닌 public 메서드다. 프로덕션 환경 체크(`NODE_ENV === 'production'`)가 내부에 있어 방어는 되지만, 타입 시스템의 보장이 아니다.
  - 제안: 동일 메서드를 테스트 파일에서만 접근 가능하도록 `@internal` TSDoc 주석을 추가하거나, `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 우회 없이 `(provider as any).__resetForTesting()` 패턴을 테스트에 강제해 의도치 않은 프로덕션 호출을 컴파일 레벨에서 차단.

---

## 요약

전반적으로 코드베이스는 JSDoc/TSDoc, 섹션 구분자, 에러 코드 상수화 등 유지보수를 위한 좋은 관행이 잘 적용되어 있다. 그러나 30여 건의 cafe24 반복 수정이 누적된 결과로 몇 가지 유지보수성 문제가 두드러진다. 첫째, `APP_URL` 폴백 리터럴이 2개 파일 6곳에 분산되어 있고 `replace(/\/$/, '')` 체인이 일부 호출 지점에서 누락되어 동작 차이가 발생할 수 있다. 둘째, 메시지 길이 상한 (`LAST_ERROR_MESSAGE_MAX_LEN = 200` vs `MCP_ERROR_MESSAGE_MAX_LEN = 2048`)과 클램프 함수가 이중으로 구현되어 동일 DB 컬럼을 쓰는 두 경로의 보존 길이가 상이하다. 셋째, `console.warn` / `console.error` 가 NestJS Logger 대신 사용되는 위치가 4곳 남아 구조화 로깅에서 누락된다. `integration-oauth.service.ts`(1818줄)와 `ai-agent.handler.ts`(2099줄)는 단일 파일이 너무 많은 책임을 담고 있어 이후 변경 시 인지 부하가 높다. 위험도가 높은 항목은 없으나, 중복 클램프 함수 문제는 동일 컬럼에 길이가 다른 값이 기록되는 의도치 않은 동작을 유발할 수 있어 우선적 조치를 권장한다.

---

## 위험도

**MEDIUM**
