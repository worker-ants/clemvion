# Architecture Review

## 발견사항

### [CRITICAL] `WorkflowNotFoundError` / `SubWorkflowTimeoutError` 삭제로 타입 계층 퇴행

- **위치**: `backend/src/modules/execution-engine/workflow-errors.ts` (파일 전체 삭제), `execution-engine.service.ts` diff (lines 2160-2265)
- **상세**: `workflow-errors.ts`는 삭제 코멘트에서 스스로 명시했듯이 "handler가 부분문자열 매칭으로 분류하던 문제(W-17)를 typed 분기로 해결"하기 위해 도입된 파일이다. 이번 PR에서 이 파일을 전부 삭제하고 `throw new Error('Workflow not found: ...')` 형태의 범용 `Error`로 대체했다. 이는 다음을 퇴행시킨다: (1) 호출부(`workflow.handler.ts`)가 `instanceof WorkflowNotFoundError` 타입 분기 대신 다시 문자열 매칭이나 그냥 catch-all에 의존해야 한다. (2) `WorkflowNotFoundError.workflowId`, `SubWorkflowTimeoutError.timeoutMs` 같은 구조화된 컨텍스트 필드가 사라진다. (3) 미래 호출자가 타임아웃과 not-found를 프로그램적으로 구분할 방법이 없어진다.
- **제안**: 파일 삭제를 되돌리거나, 에러 클래스를 `execution-engine.service.ts`내 혹은 별도 `errors/` 디렉토리로 옮겨 typed 계층을 유지한다. `throw new Error(...)` 패턴은 "메시지 포맷 보존" 의도는 있지만, 내부 코드에서 `instanceof`로 분기하는 능력을 잃는 것은 아키텍처 퇴행이다.

---

### [WARNING] `ExecutionEngineService` 의 단일 책임 원칙(SRP) 위반 — 이미 알려진 문제이나 이번 PR에서 더 깊어짐

- **위치**: `backend/src/modules/execution-engine/execution-engine.service.ts` (전체 파일 컨텍스트, 주석에서 "~4200줄로 크기가 크므로 PR-H/I에서 점진적 분해 예정" 언급)
- **상세**: `ExecutionEngineService`는 단일 클래스에 그래프 순회, 노드 dispatch, 상태 머신 전이, 이벤트 발행, 분산 실행(Redis pub/sub), 복구 로직, Sub-Workflow orchestration, AI 대화 관리 등 매우 이질적인 책임이 공존한다. 이번 diff에서 `buildConversationConfigFromOutput`의 output shape 변경(`output.result.*` → `output.*`)과 `workflow-errors.ts` 삭제가 서비스 내부에 직접 인라인되는 방향으로 진행되어, 클래스가 더 많은 도메인 세부사항을 직접 담게 됐다. `forwardRef(() => NodeHandlerDependenciesProvider)` 순환 의존도 해소되지 않은 채 유지된다.
- **제안**: PR 주석이 "PR-H/I에서 점진적 분해"를 예고하고 있으나, workflow-errors 타입 계층을 복원하는 것이 분해의 전제 조건이다. 당장 분리가 어렵다면 적어도 에러 타입만큼은 복원하는 것이 최소 조치다.

---

### [WARNING] `integration-oauth.service.ts`에서 `parseTokenExpiresAt` 함수 삭제 — Cafe24 expires_at 처리 로직 소실

- **위치**: `backend/src/modules/integrations/integration-oauth.service.ts` diff (lines 6174-6230)
- **상세**: 이번 PR에서 `parseTokenExpiresAt(provider, data)` 함수가 삭제되었다. 이 함수는 Cafe24가 표준 OAuth의 `expires_in` 대신 `expires_at` (ISO8601)을 반환하는 provider 특이사항을 처리하는 유일한 로직이었다. 대체 코드는 `expires_in`만 읽고 없으면 null을 반환한다:
  ```ts
  const expiresIn = readNumber(data, 'expires_in');
  const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
  ```
  즉 Cafe24의 `expires_at` ISO string 파싱과 "expires_in/expires_at 둘 다 없을 때 2h fallback" 로직이 동시에 제거된다. 삭제된 테스트 두 개(`cafe24 token exchange parses expires_at ISO string into tokenExpiresAt`, `cafe24 token exchange falls back to 2h default when neither expires_in nor expires_at present`)가 이 로직을 검증하던 것이었다. 이 변경이 의도적이라면(예: Cafe24 토큰 갱신 경로가 다른 곳으로 이전된 경우) 명시적인 주석이나 spec 참조가 필요하다. 의도치 않은 삭제라면 운영 환경에서 Cafe24 통합의 `tokenExpiresAt`이 다시 null로 저장되는 회귀가 발생한다.
- **제안**: 삭제 의도를 명확히 한다. 다른 경로(예: `Cafe24ApiClient`, `cafe24-token-refresh` 서비스)에서 이 책임을 인수받지 않았다면 롤백한다. 삭제가 맞다면 해당 이유를 diff 또는 spec에 기록한다.

---

### [WARNING] `buildConversationConfigFromOutput`의 output shape 변경 — 계약 일관성

- **위치**: `execution-engine.service.ts` diff (lines 2186-2265), `execution-engine.service.spec.ts` diff
- **상세**: `output.result.*` 단일 경로에서 `output.*` (top-level) 로 되돌아갔다. spec에는 D6(2026-05-17)로 `output.result.*` 단일 경로 전환이 기록돼 있었고, 이번 PR은 그것을 되돌린다. 스펙 자체가 바뀐 것인지, 핸들러 구현이 스펙을 따르지 못해 일시적으로 서비스 레이어만 맞춘 것인지 불명확하다. 아키텍처 관점에서 핸들러와 서비스 레이어 간의 계약(output shape)이 불안정하게 진동하는 것은 결합도 증가의 신호다. `D6 회귀 차단` 테스트(레거시 top-level shape가 무시됨을 검증)도 함께 제거됐다.
- **제안**: `NodeHandlerOutput`의 output shape를 인터페이스 레벨에서 명확히 고정하고, shape 변경 시 타입 시스템이 불일치를 컴파일 타임에 감지할 수 있도록 한다. `Record<string, unknown>` 대신 구체적인 discriminated union 또는 Zod schema로 계약을 강제하는 방향을 검토한다.

---

### [WARNING] `integration-action-required-notifier.service.ts`에서 타입 캐스팅 확장이 의미 없는 방어적 패턴

- **위치**: `backend/src/modules/integrations/integration-action-required-notifier.service.ts` diff (lines 3779-3783)
- **상세**: `channel` 필드의 타입 단언이 `'both' | 'in_app'`에서 `'both' | 'in_app' | 'email'`로 확장됐다. 그런데 해당 코드에서 `channel`은 항상 `wantsEmail ? 'both' : 'in_app'` 결과물이므로 실제로 `'email'`이 할당되는 경우가 없다. 타입 단언만 넓히고 실제 로직은 바뀌지 않아 타입 정보가 실제 동작을 올바르게 표현하지 않게 됐다. 이 패턴은 타입 시스템이 제공하는 narrowing 보증을 무력화한다.
- **제안**: 근본 원인을 확인한다. `NotificationsService.createMany`가 `'email'` 채널을 수락하도록 시그니처가 바뀌었다면, 해당 타입을 공유 유니온으로 추출해 캐스팅 없이 사용한다. 임시 방편 타입 widening은 피한다.

---

### [WARNING] 모크 surface 동기화 방식 — NotificationsService 인터페이스의 암묵적 계약

- **위치**: `alerts-evaluator.service.spec.ts`, `integration-expiry-scanner.service.spec.ts` diff
- **상세**: `notificationsService` 목에 `dismiss`, `dismissAll` 메서드를 수동으로 추가했다. 이 패턴은 이미 `hasRecentByResource`(W-75)에서도 사용됐다. 서비스 인터페이스가 커질수록 테스트 전체에 흩어진 목 객체들이 drift될 위험이 있다. 이미 두 번째 동기화 사례가 발생한 것은 이 패턴의 유지보수 부담을 시사한다.
- **제안**: `NotificationsService`의 최소 테스트 인터페이스를 별도 타입(`type NotificationsServiceMock = Pick<NotificationsService, 'createMany' | 'hasRecentByResource' | 'dismiss' | 'dismissAll'>`)으로 추출하거나, `jest.createMockFromModule`/NestJS testing 유틸리티를 활용해 구조적 일치를 컴파일 타임에 보장한다.

---

### [INFO] V055/V056 마이그레이션 분리 전략 — 명확한 책임 분리

- **위치**: `backend/migrations/V055__notification_dismissed_at_add.sql`, `backend/migrations/V056__notification_active_partial_index.sql`, `backend/migrations/V056__notification_active_partial_index.conf`
- **상세**: `ALTER TABLE ADD COLUMN NULL`(트랜잭션 안전)과 `CREATE/DROP INDEX CONCURRENTLY`(트랜잭션 불가)를 별도 마이그레이션(V055/V056)으로 분리한 것은 올바른 전략이다. `executeInTransaction=false` 설정 파일(`.conf`)을 SQL과 동명으로 쌍으로 두어 Flyway 설정을 명시하는 것도 적절하다. `IF NOT EXISTS / IF EXISTS`로 재실행 안전성을 확보하고, `(workspace_id, created_at DESC)` 인덱스를 partial로 변환하지 않은 이유(admin/감사 쿼리 대비)를 주석으로 명시한 점도 좋다. 전체적으로 데이터 레이어 변경의 아키텍처 결정이 잘 문서화된 사례다.

---

### [INFO] `integration-oauth.service.cafe24.spec.ts` — 테스트 삭제(expires_at/fallback)와 기능 삭제의 대칭성

- **위치**: `integration-oauth.service.cafe24.spec.ts` diff (lines 4615-4783)
- **상세**: `cafe24 token exchange parses expires_at ISO string into tokenExpiresAt` 및 `cafe24 token exchange falls back to 2h default` 테스트가 삭제됐다. 이는 [WARNING] parseTokenExpiresAt 삭제와 대칭을 이룬다. 테스트와 구현이 함께 삭제된 점은 의도적인 결정처럼 보이지만, 삭제된 기능이 다른 경로에서 보장되는지 확인이 필요하다.

---

### [INFO] `integration-oauth.service.ts`의 `IntegrationOAuthService` 클래스 크기

- **위치**: `backend/src/modules/integrations/integration-oauth.service.ts` (전체 컨텍스트)
- **상세**: 이 파일도 OAuth begin/callback/install/precheck/state management/token normalization/HMAC 검증 등 다수의 책임을 단일 클래스에 담고 있다. 내부 헬퍼 함수(`normalizeTokenResponse`, `normalizeRawStateRow`, `parseTokenExpiresAt` 등)가 파일 말미에 module-level로 분산돼 있어 클래스와의 경계가 불명확하다.

---

## 요약

이번 PR의 핵심 아키텍처 이슈는 세 가지다. 첫째, `workflow-errors.ts` 삭제로 인해 이전 PR에서 의도적으로 도입한 typed 에러 계층이 제거되어 런타임 문자열 매칭 의존도가 다시 높아졌다. 둘째, `parseTokenExpiresAt` 삭제로 Cafe24의 `expires_at` ISO string 파싱 및 2h fallback 로직이 제거됐으며, 이 책임이 다른 경로에서 보장되는지 명확하지 않아 운영 회귀 위험이 있다. 셋째, `buildConversationConfigFromOutput`의 output shape가 D6 이후 다시 되돌려짐으로써 핸들러-서비스 계약이 불안정하게 진동하고 있으며, `Record<string, unknown>` 계약으로는 컴파일 타임 보호가 불가능하다. 마이그레이션(V055/V056) 분리, mock surface 동기화, 테스트 커버리지 보강 등 나머지 변경은 적절한 수준이다.

## 위험도

HIGH
