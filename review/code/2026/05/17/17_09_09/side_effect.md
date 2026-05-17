# 부작용(Side Effect) 리뷰

## 발견사항

---

### 파일 6 & 7: `execution-engine.service.ts` / `workflow-errors.ts` — 커스텀 에러 클래스 제거

- **[WARNING]** `WorkflowNotFoundError`, `SubWorkflowTimeoutError` 클래스 삭제로 인한 호출자 `instanceof` 분기 파괴
  - 위치: `workflow-errors.ts` 전체 삭제 / `execution-engine.service.ts` 라인 1220, 1230, 1251, 1262
  - 상세: 이 두 클래스는 주석(`@param W-17`)에서 명시했듯이 `workflow.handler.ts` (Sub-Workflow 핸들러) 가 `err instanceof WorkflowNotFoundError` 와 `err instanceof SubWorkflowTimeoutError` 로 타입 분기를 수행하기 위해 도입됐다. 파일이 삭제되고 throw 지점이 `new Error(...)` 로 교체됨으로써, 핸들러에 해당 `instanceof` 분기가 아직 남아 있다면 모든 `NOT_FOUND` / `TIMEOUT` 케이스가 fallback(`SUB_WORKFLOW_FAILED`)으로 떨어지는 **silent regression** 이 발생한다. 삭제된 파일의 주석("W-17" 경고)이 이 위험을 명시적으로 기술했음에도 handler 측 조치가 이번 diff 에 포함되어 있지 않다.
  - 제안: `workflow.handler.ts` 에서 `instanceof WorkflowNotFoundError` / `instanceof SubWorkflowTimeoutError` 분기를 사용하는지 확인하고, 사용 중이라면 해당 파일을 먼저 message-string 매칭(`error.message.includes('Workflow not found:')` 등) 으로 교체하거나, 동일한 커스텀 클래스를 service 내부에서 유지한 뒤 export 하는 방식으로 하위 호환성을 지켜야 한다.

- **[WARNING]** `buildConversationConfigFromOutput` 의 출력 데이터 경로 변경 (`output.result.*` → `output.*`) 이 생산 코드와 웹소켓 이벤트 payload 에 영향
  - 위치: `execution-engine.service.ts` 라인 293–331 (함수 본문), `execution-engine.service.spec.ts` 라인 440–680 (테스트 변경)
  - 상세: 이 함수는 AI Agent 핸들러가 push 하는 `NodeHandlerOutput.output` 에서 `message`, `messages`, `turnCount`, `maxTurns` 를 읽어 WebSocket 이벤트 `conversationConfig` 블록을 구성한다. D6 변경으로 읽기 경로가 `output.result.*` → `output.*` 로 바뀌었다. 만약 런타임에서 AI Agent 핸들러가 아직 `output.result.*` shape 를 반환하고 있다면, WebSocket 이벤트의 `conversationConfig.message`, `messages`, `turnCount` 가 모두 기본값(`''`, `[]`, `0`)으로 내려가 클라이언트에서 대화가 표시되지 않는다. 이번 diff 에서 제거된 회귀 테스트("ignores legacy top-level message/messages/turnCount/maxTurns (D6 정합)")는 핸들러 side 의 shape 가 동기화되었음을 전제하므로, **AI Agent 핸들러 (`ai-agent.handler.ts` 또는 동등 파일) 의 output shape 변경이 동일 PR 에 포함되어 있는지** 반드시 검증해야 한다.
  - 제안: PR diff 에 AI Agent 핸들러의 `output.result.*` → `output.*` 전환이 포함되어 있지 않다면, 본 함수 변경과 핸들러 변경을 원자적으로 묶어야 한다. 그렇지 않으면 배포 창 동안 WebSocket 대화 데이터가 클라이언트에 전달되지 않는다.

---

### 파일 1 & 3: `V055` / `V056` 마이그레이션 — 스키마 변경의 런타임 부작용

- **[WARNING]** `idx_notification_user_read_created` 인덱스 삭제 (`V056`) 가 비-트랜잭션 실행 실패 시 부분 상태 생성
  - 위치: `V056__notification_active_partial_index.sql` 라인 12–14
  - 상세: `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 와 `DROP INDEX CONCURRENTLY IF EXISTS` 를 비-트랜잭션(`executeInTransaction=false`)으로 순차 실행한다. `CREATE` 성공 후 `DROP` 이 실패하면 두 인덱스가 공존하게 되고, 다음 재실행은 `IF NOT EXISTS` 덕에 `CREATE` 를 건너뛰고 `DROP` 만 재시도한다. 이 재실행 안전성은 주석에 명시되어 있고 설계 의도가 맞다. 그러나 주목해야 할 점은 `DROP` 이후 `idx_notification_user_read_created` 가 사라지면, `dismissed_at IS NOT NULL` 인 행도 포함했던 이전 인덱스가 없어지므로 **admin/감사 쿼리처럼 `dismissed_at` 조건 없이 전체 notification 을 스캔하는 쿼리는 순간적으로 Seq Scan 으로 격하된다**. 이 점은 주석에서 인지("향후 admin/감사 쿼리가 dismissed 포함 전체 row 를 볼 여지를 둔다")하고 있으나, 현재 운영 중인 admin 쿼리가 이 인덱스에 의존하는지 사전 확인이 필요하다.
  - 제안: 운영 배포 전 `EXPLAIN ANALYZE` 로 주요 admin/감사 쿼리의 실행계획을 확인하고, 필요 시 `(workspace_id, created_at DESC)` 인덱스를 admin 용으로 명시적으로 추가하거나, 적어도 인덱스 삭제 후 성능 모니터링 alert 를 준비한다.

- **[INFO]** `V055` 의 `dismissed_at TIMESTAMPTZ NULL` 추가가 기존 쿼리 결과에 미치는 영향
  - 위치: `V055__notification_dismissed_at_add.sql` 라인 5–6
  - 상세: `ALTER TABLE ADD COLUMN NULL` 은 PostgreSQL 에서 메타데이터 전용 변경으로 빠르고 기존 데이터에 영향을 주지 않는다. 단, 이후 서비스 코드가 `WHERE dismissed_at IS NULL` 필터를 **추가하지 않고** notification 목록 쿼리를 실행하면, 마이그레이션 적용 직전까지 모든 기존 row 의 `dismissed_at = NULL` 이므로 결과적으로 전체가 visible 로 보인다. 이는 의도된 동작이나, 새 서비스 코드와 구 서비스 코드가 혼재하는 배포 롤링 구간에 주의가 필요하다.
  - 제안: 롤링 배포 순서를 마이그레이션 → 서비스 코드 순으로 확인하고, 구 버전 코드에서 `dismissed_at` 컬럼 유무에 따른 오류가 없는지 ORM 레이어를 점검한다.

---

### 파일 8: `integration-action-required-notifier.service.ts` — 채널 타입 확장

- **[INFO]** `channel` 타입 캐스팅에 `'email'` 추가가 런타임에 실제로 `'email'` 단독 값을 생산할 가능성 없음 (의도적 타입 확장)
  - 위치: `integration-action-required-notifier.service.ts` 라인 79–83
  - 상세: 표현식 `(wantsEmail ? 'both' : 'in_app')` 은 항상 `'both'` 또는 `'in_app'` 만 생성한다. 타입 캐스팅에 `'email'` 을 추가했지만 실제로 `'email'` 단독 값이 생성되는 경로는 없으므로 런타임 부작용은 없다. 다만 타입만 넓히고 실제 분기를 추가하지 않은 것은 **불일치**로, 향후 `'email'` 채널을 지원하는 코드가 추가되면 이 캐스팅은 올바르지만, 현재 코드만 보면 `as 'both' | 'in_app' | 'email'` 는 의미 없는 확장이다. `NotificationsService.createMany` 가 `'email'` 을 channel 값으로 받아 처리하는 로직이 있는지, 혹은 DB enum 컬럼에 해당 값이 없는지 확인이 필요하다.
  - 제안: `channel` 필드의 허용 값 목록을 중앙 타입(예: `NotificationChannel` union type)으로 관리하고 직접 as-casting 을 제거한다. 또는 실제 `'email'` 분기를 구현하거나, 의도가 "타입 준비만" 이라면 주석으로 명시한다.

---

### 파일 4, 9: 테스트 파일의 mock surface 동기화 (`dismiss`, `dismissAll` 추가)

- **[INFO]** `dismiss`, `dismissAll` 메서드가 테스트 mock 에만 추가되고 실제 `NotificationsService` 구현이 같은 PR 에 포함되어야 함
  - 위치: `alerts-evaluator.service.spec.ts` 라인 185–186, `integration-expiry-scanner.service.spec.ts` 라인 940–941
  - 상세: 두 테스트 파일이 `dismiss: jest.fn()`, `dismissAll: jest.fn().mockResolvedValue({ affected: 0 })` 를 mock 에 추가한다. 이는 `NotificationsService` 에 해당 public 메서드가 신규 도입됨을 뜻한다. mock surface 동기화는 런타임에서 해당 메서드가 실제로 존재하지 않을 경우 TypeScript 컴파일 에러 없이 `undefined` 호출로 이어질 수 있다(특히 `as never` 캐스팅 사용 시). 실제 구현 파일이 같은 PR 에 포함되어 있는지, 또는 다른 PR 에서 선 배포됐는지 확인이 필요하다.
  - 제안: `NotificationsService` 의 `dismiss` / `dismissAll` 구현 파일을 동일 PR 에 포함시키거나, 이미 배포된 경우 CHANGELOG 또는 plan 에 명시하여 추적 가능하게 한다.

---

### 파일 5: `execution-engine.service.spec.ts` — 회귀 테스트 제거

- **[WARNING]** D6 회귀 방지 테스트("ignores legacy top-level message/messages/turnCount/maxTurns") 삭제
  - 위치: `execution-engine.service.spec.ts` 라인 660–675 (삭제)
  - 상세: 삭제된 테스트는 "핸들러가 옛 `output.*` shape 로 회귀했을 때 `buildConversationConfigFromOutput` 이 무시하여 빈 conversationConfig 가 내려가던 버그를 차단"하는 목적이었다. D6 변경(본 PR)으로 `output.result.*` 경로가 폐기되고 `output.*` 가 정규 경로가 됨으로써 이 테스트의 **역할이 반전**된다: 이제 `output.message` 같은 top-level 값이 정상 입력이다. 테스트 삭제는 D6 의도와 일치한다. 그러나 이는 AI Agent 핸들러가 실제로 `output.*` shape 로 동기화되었다는 전제 하에 성립한다. 핸들러 동기화가 완료되지 않은 상태라면 이 테스트 삭제는 **회귀 방어막 제거** 가 된다.
  - 제안: AI Agent 핸들러의 output shape 변경이 이 PR 과 원자적으로 배포됨을 배포 스크립트 또는 plan 문서에서 확인하고, 변경 후 실제 conversation flow E2E 테스트를 실행한다.

---

### 파일 10: `integration-oauth.service.cafe24.spec.ts` — 테스트 삭제

- **[INFO]** Cafe24 `expires_at` 파싱 및 fallback 2h 테스트 2개 삭제
  - 위치: `integration-oauth.service.cafe24.spec.ts` 라인 1627–1783 (삭제)
  - 상세: 삭제된 두 테스트는 `global.fetch` 를 직접 교체하고 `process.env.OAUTH_STUB_MODE` 를 `delete` 하여 실제 HTTP 분기를 타는 방식이었다. 이는 `process.env` 를 테스트 내에서 수정·복원하는 부작용이 있었으며, 복원이 `finally` 블록에서 이루어지지만 테스트 실패 시 teardown 순서에 따라 `process.env.OAUTH_STUB_MODE` 가 이후 테스트에 영향을 줄 수 있었다. 삭제가 해당 환경 변수 side effect 를 제거한다는 점에서 긍정적이지만, `tokenExpiresAt` 파싱 회귀 보호가 사라진다. 이 기능이 다른 테스트로 커버되는지 확인이 필요하다.
  - 제안: `expires_at` ISO 파싱 로직을 단위 레벨로 분리하여 `global.fetch` 교체 없이 순수 함수 테스트로 커버하거나, 동일 보호를 integration test 계층에서 유지한다.

---

## 요약

이번 변경의 가장 큰 부작용 위험은 두 가지다. 첫째, `WorkflowNotFoundError` / `SubWorkflowTimeoutError` 커스텀 클래스 삭제로 인해 `workflow.handler.ts` 등 호출자가 `instanceof` 분기를 사용 중이라면 모든 NOT_FOUND/TIMEOUT 케이스가 generic fallback 으로 소리 없이 흡수될 수 있다. 둘째, `buildConversationConfigFromOutput` 의 output 경로 변경(`output.result.*` → `output.*`)은 AI Agent 핸들러의 shape 동기화가 원자적으로 이루어지지 않는 한, 롤링 배포 구간 또는 핸들러 미변경 상태에서 WebSocket AI 대화 이벤트의 `conversationConfig` 가 빈 값으로 내려간다. DB 마이그레이션(V055/V056)과 mock surface 동기화(dismiss/dismissAll)는 설계 의도에 부합하지만 각각 배포 순서와 실제 구현 파일 포함 여부를 추가로 확인해야 한다.

## 위험도

**MEDIUM**
