# 요구사항(Requirement) 리뷰

## 발견사항

### 파일 1: V055__notification_dismissed_at_add.sql

- **[INFO]** `dismissed_at` 컬럼 추가만 있고, 기존 행에 대한 기본값 처리 명시 없음
  - 위치: `ALTER TABLE notification ADD COLUMN dismissed_at TIMESTAMPTZ NULL`
  - 상세: NULL 허용 컬럼이므로 기존 row 는 자동으로 NULL(= visible) 상태가 된다. 의도한 동작이고 주석에도 명시되어 있으나, 마이그레이션 실행 후 기존 데이터 상태가 spec 과 일치함을 확인하는 쿼리나 검증 단계가 없다.
  - 제안: 보조 주석으로 "기존 row 전부 visible 로 유지됨" 을 명시하거나, migration 완료 후 확인 쿼리(`SELECT COUNT(*) FROM notification WHERE dismissed_at IS NOT NULL`)를 개발 절차서에 포함.

- **[INFO]** partial index 전환을 V056 에 위임하는 구조 — V055 단독 실행 시 인덱스 없음 구간 발생
  - 위치: 파일 하단 주석 "partial index 전환은 별도 V056"
  - 상세: V055 실행 후 V056 실행 전 짧은 구간에 기존 `idx_notification_user_read_created` 는 `dismissed_at IS NULL` 필터 없이 작동하는 반면 쿼리 레이어는 이미 `dismissed_at IS NULL` 조건을 추가할 수 있다. 기능 정확성에는 영향 없으나 인덱스 히트율이 일시 저하될 수 있다.
  - 제안: V055 배포 후 V056 을 가능한 한 빠르게 (또는 같은 배포 사이클에) 실행하도록 배포 절차 명시.

---

### 파일 2 & 3: V056__notification_active_partial_index.conf / .sql

- **[INFO]** DROP 순서 — CREATE 성공 후 DROP 실패 시 두 인덱스가 공존하는 시점 발생 가능
  - 위치: `DROP INDEX CONCURRENTLY IF EXISTS idx_notification_user_read_created`
  - 상세: `IF NOT EXISTS` / `IF EXISTS` 로 재실행 안전성은 확보됐다. 그러나 DROP 이 실패(예: lock 경합)하는 경우 두 인덱스가 잠시 공존한다. 기능 상 문제는 없지만 스토리지를 이중 점유한다.
  - 제안: 배포 후 `idx_notification_user_read_created` 존재 여부를 모니터링하거나 경보를 추가해 미완료 상태를 즉시 감지하도록 권장.

- **[INFO]** partial index 가 `dismissed_at IS NULL` 만 커버 — 관리자용 쿼리(dismissed 포함)는 full scan
  - 위치: SQL 주석 "(workspace_id, created_at DESC) 인덱스는 partial 로 변환하지 않는다"
  - 상세: 주석에 이유가 기술되어 있고 요구사항 기반 설계 의도가 명확하다. 단, 향후 관리자 쿼리가 `user_id` 기반이라면 별도 인덱스가 필요할 수 있다.
  - 제안: spec 의 §3 인덱스 전략 문서에 "dismissed 포함 쿼리는 (workspace_id, created_at DESC) 인덱스를 사용" 임을 명시해 향후 관리자 쿼리 설계 시 혼동 방지.

---

### 파일 4: alerts-evaluator.service.spec.ts

- **[INFO]** `dismiss` / `dismissAll` mock 이 surface 동기화용으로만 추가됐고 실제 평가 로직 테스트에서 호출 여부 검증 없음
  - 위치: `notificationsService` mock의 `dismiss`, `dismissAll` 추가 (라인 186-187)
  - 상세: mock 이 추가된 목적이 "런타임 에러 방지용 surface 동기화"임이 주석에 명시돼 있다. AlertsEvaluator 가 dismiss 를 호출할 비즈니스 로직이 없다면 이는 정상이다. 다만 spec/data-flow/8-notifications.md §4 의 Dismiss 흐름과 AlertsEvaluator 의 관계가 테스트에서 검증되지 않는다.
  - 제안: AlertsEvaluator 가 dismiss 를 호출하지 않음을 명시적으로 테스트에 기록하거나(예: `expect(notificationsService.dismiss).not.toHaveBeenCalled()`), 향후 dismiss 연동 요구사항이 생길 경우 테스트를 추가한다.

---

### 파일 5: execution-engine.service.spec.ts

- **[WARNING]** D6 회귀 차단 테스트 삭제 — output shape 변경의 역방향 회귀 보호가 제거됨
  - 위치: 삭제된 테스트 `'ignores legacy top-level message/messages/turnCount/maxTurns (D6 정합)'` (라인 664-675)
  - 상세: 이 테스트는 "핸들러가 옛 shape(`output.message` 등 top-level)으로 회귀하면 빈 conversationConfig 가 emit 된다"는 동작을 검증하던 회귀 가드였다. 삭제되면서 현재 변경이 D6 와 반대 방향(top-level 로 복원)임에도 불구하고 이 전환 자체가 올바른 스펙 방향인지를 확인하는 테스트가 없다. 새 shape(`output.message` / `output.messages`)가 spec 상 정식 경로임을 확인하는 역방향 보호 테스트가 누락됐다.
  - 제안: 새 top-level shape 가 정식이라면, "핸들러가 `output.result.*` nested 구조를 쓰면 무시된다"는 역방향 회귀 테스트를 추가해 D6 이전 경로로의 회귀를 차단한다.

- **[INFO]** `buildConversationConfigFromOutput` 의 `undefined` input 처리 테스트는 유지됨 — 엣지케이스 적절히 커버
  - 위치: `'returns defaults when output is undefined'` 테스트
  - 상세: `output=undefined` 입력에 대해 기본값이 반환되는지 검증하고 있다.

- **[INFO]** `continueAiConversation` 10000자 초과 guard 테스트 — 경계값 `10_001` 만 검증, `10_000` 경계 미검증
  - 위치: `'continueAiConversation 은 10000자 초과 시 throw 하고 publish 하지 않는다'` 테스트
  - 상세: 10,001자는 throw, 10,000자(정확한 경계)는 통과해야 함이 검증되지 않는다. 실제 구현이 `>` 또는 `>=` 중 어느 방향인지 모호하다.
  - 제안: `'x'.repeat(10_000)` 케이스도 추가하여 정확히 10,000자는 통과함을 검증.

---

### 파일 6: execution-engine.service.ts

- **[WARNING]** `WorkflowNotFoundError` / `SubWorkflowTimeoutError` 삭제 — 타입 기반 에러 분기가 제네릭 `Error` 로 강등
  - 위치: `workflow-errors.ts` 전체 삭제 및 4개 호출부에서 `new WorkflowNotFoundError(workflowId)` → `new Error(`Workflow not found: ${workflowId}`)` 로 대체
  - 상세: 삭제된 `workflow-errors.ts` 의 주석에 명시된 바와 같이, 이 클래스들은 "핸들러가 `err instanceof WorkflowNotFoundError` 처럼 typed 분기"를 사용하기 위해 도입됐다. 삭제 후 `workflow.handler.ts` 또는 다른 호출자가 여전히 `instanceof` 분기를 사용하고 있다면, 이제 모든 케이스가 `instanceof Error` 만 통과하여 NOT_FOUND / TIMEOUT 구별이 불가능해질 수 있다.
  - 제안: `workflow.handler.ts` 에서 `WorkflowNotFoundError` / `SubWorkflowTimeoutError` 의 `instanceof` 분기가 남아있다면 함께 제거하거나 메시지 패턴 매칭으로 대체했는지 확인 필요. 변경 사유(왜 typed error 가 불필요해졌는지)를 PR 설명 또는 코드 주석에 기술하는 것을 권장.

- **[INFO]** `assertSameWorkspace` 의 `callerWorkspaceId` 미전달 시 warn + 통과 정책 — fail-open 유지
  - 위치: `assertSameWorkspace` 메서드, 라인 2699-2704
  - 상세: 주석에 "점진적 도입을 위한 임시 정책"임이 명시돼 있다. 요구사항(Requirement) 관점에서 이 fail-open 경로가 언제 fail-closed 로 전환될지 미정이다.
  - 제안: plan 또는 spec 에 "모든 호출자가 `parentWorkspaceId` 를 전달하도록 정착되면 fail-closed 로 전환" 타임라인을 추가.

- **[INFO]** `executeSync` 에서 COMPLETED / FAILED 이외 상태(예: WAITING_FOR_INPUT, CANCELLED)가 catch block 에서 FAILED 로 처리됨
  - 위치: catch block `if (reloaded.status !== COMPLETED && reloaded.status !== FAILED)` — CANCELLED 도 FAILED 로 처리
  - 상세: 이 분기는 timeout 에러 경로에서만 진입하므로, 실제로 CANCELLED 인 경우에는 CANCELLED 를 FAILED 로 덮어쓰는 TOCTOU 가 발생할 수 있다. 주석에서 이미 TOCTOU 가능성을 인정하고 있다.
  - 제안: catch block 내 `reloaded.status === CANCELLED` 는 별도 처리하거나 최소한 주석으로 알려진 trade-off 를 기록.

---

### 파일 7: workflow-errors.ts (삭제)

- **[WARNING]** 삭제 후 외부 호출자(workflow.handler.ts 등)의 `instanceof` 분기 처리 여부 미확인
  - 위치: 파일 전체 삭제
  - 상세: 삭제 파일의 원본 주석("핸들러는 `err instanceof WorkflowNotFoundError` 처럼 typed 분기를 1차로 사용하고 옛 메시지 매칭은 defensive backstop")이 있었다. 삭제 후 핸들러 코드가 메시지 문자열 매칭(`.includes('Workflow not found')` 등)으로 대체됐는지, 혹은 아예 분기가 제거됐는지 diff 에서 확인 불가.
  - 제안: `workflow.handler.ts` 및 관련 테스트에서 `WorkflowNotFoundError` / `SubWorkflowTimeoutError` 참조가 완전히 제거됐음을 빌드/lint 로 검증.

---

### 파일 8: integration-action-required-notifier.service.ts

- **[WARNING]** 채널 타입 캐스팅에 `'email'` 이 추가됐지만 실제 로직은 `'both'` 또는 `'in_app'` 만 생성
  - 위치: `channel: (wantsEmail ? 'both' : 'in_app') as | 'both' | 'in_app' | 'email'`
  - 상세: 삼항 연산자 결과가 `'both'` 또는 `'in_app'` 인데, 타입 캐스팅에만 `'email'` 이 추가됐다. 이는 타입 어서션이 실제 값 범위와 불일치한다. `'email'` 을 실제로 emit 해야 하는 비즈니스 요구사항이 없다면 이 추가는 불필요하고 혼란을 유발한다. 반대로 `'email'` 단독 채널을 emit 해야 하는 요구가 있다면 로직이 구현되지 않았다.
  - 제안: (1) `'email'` 단독 채널 요구사항이 없다면 타입 캐스팅에서 `| 'email'` 제거. (2) 요구사항이 있다면 `wantsEmail` 조건을 `'email'` 반환 분기로 확장하는 로직 구현.

- **[INFO]** `personal` scope 통합의 수신자가 `integration.createdBy` 단일 사용자 — 탈퇴/비활성 사용자 처리 없음
  - 위치: `resolveRecipients` 메서드, `return [integration.createdBy]`
  - 상세: 탈퇴/비활성 사용자에게 알림이 전달되지 않더라도 현재 로직은 오류 없이 진행되지만, 전달 실패가 조용히 사라진다.
  - 제안: 기존 패턴과 일관성을 유지한다면 현재 수준으로 충분하나, spec 에 "비활성 사용자에 대한 알림 정책"이 정의되어 있다면 검토 필요.

---

### 파일 9: integration-expiry-scanner.service.spec.ts

- **[INFO]** `expirePendingInstalls` 및 `pruneUsageLogs` 테스트에서 `notificationsService` mock 이 `dismiss` / `dismissAll` 미포함
  - 위치: `IntegrationExpiryScannerService.expirePendingInstalls` / `pruneUsageLogs` describe 블록 내 `makeScanner()`
  - 상세: `IntegrationExpiryScannerService.run()` describe 의 `beforeEach` 에는 `dismiss` / `dismissAll` 가 추가됐으나, `expirePendingInstalls` describe 의 standalone `new IntegrationExpiryScannerService(...)` 생성 시 전달되는 `{ createMany: jest.fn() }` mock 에는 미포함이다. 런타임에서 이 경로가 `dismiss`를 호출하지 않는다면 문제없지만, mock surface 불일치다.
  - 제안: `run` describe 와 동일하게 `expirePendingInstalls` / `pruneUsageLogs` 의 독립 scanner 생성 시에도 `dismiss` / `dismissAll` 를 mock 에 포함하거나, 공통 factory 로 통일.

- **[INFO]** `process — per-job routing` describe 의 `makeScanner()` 도 `dismiss` / `dismissAll` 미포함
  - 위치: `IntegrationExpiryScannerService.process — per-job routing` describe 내 `makeScanner()`
  - 상세: 위와 동일한 surface 불일치. 해당 describe 의 테스트들은 BullMQ job routing 만 검증하므로 기능 상 문제는 없다.
  - 제안: 공통 mock factory 또는 helper 를 만들어 `notificationsService` mock 일관성 유지.

---

### 파일 10: integration-oauth.service.cafe24.spec.ts

- **[WARNING]** `expires_at` ISO string 파싱 테스트 2건 삭제 — Cafe24 특수 토큰 만료 파싱 회귀 보호 제거
  - 위치: 삭제된 `'cafe24 token exchange parses expires_at ISO string into tokenExpiresAt (no expires_in)'` 및 `'cafe24 token exchange falls back to 2h default when neither expires_in nor expires_at present'` 테스트
  - 상세: 삭제된 두 테스트는 Cafe24 응답이 OAuth 표준 `expires_in` 대신 `expires_at` ISO 문자열을 반환하는 비표준 동작을 다루는 회귀 보호였다. 주석에 "신규 cafe24 통합이 Cafe24 의 2h 실 TTL 경과 후 첫 호출에서 `access_token time expired (401)` 으로 좌초했다"고 명시한 실제 장애 케이스에 대한 가드다. 삭제 이유가 불명확하며, 대응하는 프로덕션 코드 변경 없이 테스트만 삭제됐다면 기능 회귀가 조용히 발생할 수 있다.
  - 제안: (1) 프로덕션 코드에서 `expires_at` 파싱 로직이 제거됐다면 함께 확인 필요. (2) 로직이 유지된다면 테스트도 복원. (3) 삭제 이유(예: 별도 통합 테스트로 이전, 커버리지 중복 등)를 PR 에 명시.

- **[INFO]** `buildFakeCafe24Integration` 의 `credentialsMallId` 괄호 추가는 의도와 구현이 일치 — 동작 변경 없음
  - 위치: `overrides.credentialsMallId ?? (mallId ?? 'priv-shop')`
  - 상세: `??` 연산자는 왼쪽 결합이므로 괄호 추가 전후 동작이 동일하다. 명시성 향상 목적의 순수 코드 정리.

---

## 요약

이번 변경은 notification dismiss 기능 도입(V055/V056 마이그레이션), AI Agent output shape 변경(D6: `output.result.*` → `output.*` top-level 복원), 워크플로우 에러 클래스 제거, 채널 타입 확장, Cafe24 OAuth 테스트 정리 등 여러 영역에 걸쳐 있다. 요구사항 관점에서 가장 주의할 항목은 두 가지다. 첫째, `WorkflowNotFoundError` / `SubWorkflowTimeoutError` 삭제로 인해 타입 기반 에러 분기를 사용하던 `workflow.handler.ts` 등 호출자의 분기 로직이 함께 수정됐는지 확인이 필요하며, 이 변경이 검증 없이 방치되면 에러 분류 실패가 runtime 에서 silent 하게 발생할 수 있다. 둘째, Cafe24 `expires_at` 파싱 회귀 보호 테스트 2건이 삭제됐는데, 이 테스트들은 실제 장애(토큰 만료 401)를 방지하기 위해 도입된 가드였으므로 삭제 근거와 대체 커버리지 확인이 필요하다. `IntegrationActionRequiredNotifier` 의 채널 타입에 `'email'` 이 추가됐지만 실제 로직에서 `'email'` 이 생성되지 않는 불일치도 비즈니스 규칙 관점에서 명확화가 요구된다.

## 위험도

MEDIUM
