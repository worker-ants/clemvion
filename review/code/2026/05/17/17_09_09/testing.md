# Testing 리뷰 결과

## 발견사항

### 파일 10 (integration-oauth.service.cafe24.spec.ts) — 회귀 테스트 삭제

- **[CRITICAL]** `cafe24 token exchange parses expires_at ISO string into tokenExpiresAt` 및 `cafe24 token exchange falls back to 2h default` 두 테스트가 삭제됨
  - 위치: 파일 10 diff, 라인 4612–4783
  - 상세: 해당 테스트들은 "회귀 보호(2026-05-17)"로 명시된 케이스로, Cafe24 의 `expires_at` ISO 파싱 결함(`tokenExpiresAt`이 null로 저장되어 proactive refresh가 실행되지 않던 버그)과 fallback 2h 로직을 검증하는 명시적 회귀 가드였다. 이 두 테스트가 삭제되면 같은 버그가 재발하더라도 자동으로 감지할 수 없게 된다. diff 에 해당 구현 코드의 변경이 없으므로, 테스트만 삭제한 상태다. 삭제 사유가 diff·PR·commit 어디에도 명시되지 않았다.
  - 제안: 삭제 사유를 확인하고, 구현이 변경되어 해당 경로가 없어진 게 아니라면 두 테스트를 복원한다. 만약 해당 구현 코드가 이번 PR 외부 커밋에서 이미 변경됐다면 새 shape에 맞게 재작성해야 한다.

---

### 파일 7 (workflow-errors.ts) — 커스텀 에러 클래스 삭제와 테스트 회귀 리스크

- **[WARNING]** `WorkflowNotFoundError`, `SubWorkflowTimeoutError` 커스텀 클래스가 삭제되고 일반 `Error`로 전환됨
  - 위치: 파일 7 (전체 파일 삭제), 파일 6 diff (4곳의 throw 변경)
  - 상세: 기존 `workflow-errors.ts` 의 jsdoc은 "핸들러가 `err instanceof WorkflowNotFoundError` 처럼 typed 분기를 1차로 사용"한다고 명시하고 있었다. 일반 `Error` 전환으로 `instanceof` 타입 분기가 불가능해지고, `workflow.handler.ts` 등 핸들러에서 메시지 문자열 매칭에만 의존해야 한다. 현재 `execution-engine.service.spec.ts`의 테스트들은 `toThrow('Workflow not found:')`, `toThrow(/timed out after 50ms/)` 패턴으로 문자열을 검증하므로 메시지 포맷이 바뀌면 조용히 깨질 수 있다. 또한 핸들러 레이어에서 typed 분기로 에러를 분류하는 코드가 있었다면 해당 경로의 테스트가 없을 수 있다.
  - 제안: `workflow.handler.ts`(또는 에러를 분류하는 핸들러 코드)에서 `instanceof WorkflowNotFoundError` / `instanceof SubWorkflowTimeoutError`를 사용하던 분기가 제거됐는지, 혹은 메시지 매칭으로 대체됐는지 확인하고, 해당 분기 경로의 테스트를 보강한다. 최소한 `workflow.handler.ts`의 에러 분류 분기(SUB_WORKFLOW_FAILED 등)에 대한 단위 테스트가 필요하다.

---

### 파일 8 (integration-action-required-notifier.service.ts) — 테스트 부재

- **[WARNING]** `IntegrationActionRequiredNotifier.notify()`에 대한 전용 테스트 파일이 이번 변경에 없음
  - 위치: 파일 8 전체
  - 상세: `channel` 타입 확장(`| 'email'` 추가)은 `channel` 값 결정 로직(`wantsEmail ? 'both' : 'in_app'`)은 변경하지 않았으므로 직접적인 동작 변경은 없다. 그러나 `notify()` 전체 흐름(24h 중복 방지, 수신자 해석, email 토글 적용, 에러 swallow)에 대한 테스트가 제공되지 않았다. `integration-action-required-notifier.service.spec.ts` 파일이 존재하지 않거나 이번 변경셋에 포함되지 않았다.
  - 제안: `IntegrationActionRequiredNotifier.notify()`에 대해 최소한 (1) personal scope → 소유자 1인 수신, (2) organization scope → admin 전원 수신, (3) `alreadyNotified=true` 시 createMany 미호출, (4) `wantsEmail=true` 시 channel='both', (5) 내부 에러 swallow(createMany 실패 시 throw 없이 경고 로그) 케이스를 커버하는 테스트를 추가한다.

---

### 파일 4 & 9 (mock surface 동기화 — dismiss/dismissAll)

- **[INFO]** `alerts-evaluator.service.spec.ts`, `integration-expiry-scanner.service.spec.ts`에서 NotificationsService mock에 `dismiss`, `dismissAll` 추가
  - 위치: 파일 4 라인 186–187, 파일 9 라인 3940–3941
  - 상세: mock surface 동기화 목적으로 추가된 것은 올바른 패턴이다. 그러나 `dismiss`, `dismissAll`에 대한 실제 동작 테스트(어떤 조건에서 dismiss가 호출되어야 하는지, affected 수가 반환되는지 등)는 이번 변경셋에 포함되지 않았다. `dismissAll.mockResolvedValue({ affected: 0 })`의 기본값만 설정되어 있고, 이를 검증하는 테스트 케이스는 없다.
  - 제안: `NotificationsService.dismiss`와 `dismissAll`에 대한 단위 테스트(notifications.service.spec.ts 또는 별도 spec)를 추가해 실제 동작(dismissed_at 업데이트, affected 반환값, 존재하지 않는 ID 처리 등)을 커버한다.

---

### 파일 5 (execution-engine.service.spec.ts) — output.result.* → output.* 구조 변경

- **[INFO]** 다수의 테스트에서 `output.result.{message,messages,turnCount,maxTurns}` → `output.{message,messages,turnCount,maxTurns}`로 경로 변경
  - 위치: 파일 5 diff, 다수 위치
  - 상세: 구조 변경 반영은 적절하다. 특히 삭제된 "D6 회귀 차단" 테스트(`ignores legacy top-level message/messages/turnCount/maxTurns (D6 정합)`)가 D6 이전의 top-level shape가 이제 정상 shape가 되었음을 반영한다. 변경 자체는 논리적이다. 다만 `buildConversationConfigFromOutput`이 `output.result.*`와 `output.*`를 동시에 받을 때의 우선순위, 혹은 `output.result`가 존재할 때 어떻게 동작하는지(무시 여부)에 대한 명시적 테스트가 없다. 구현에서 `o.result`를 더 이상 읽지 않으므로 혼합 입력 시 `result` 안의 값이 silently 무시되는데, 이에 대한 안전망이 없다.
  - 제안: `buildConversationConfigFromOutput`에 `output.result.*` shape가 들어왔을 때 빈 conversationConfig(message='', messages=[], turnCount=0)가 반환되는 회귀 가드를 추가해, 핸들러가 실수로 `result` 중첩을 사용했을 때 즉시 감지할 수 있도록 한다.

---

### 파일 1–3 (DB 마이그레이션 — V055, V056)

- **[INFO]** SQL 마이그레이션에 대한 통합/e2e 테스트가 이번 변경셋에 포함되지 않음
  - 위치: 파일 1, 2, 3
  - 상세: `dismissed_at` 컬럼 추가(V055)와 partial index 전환(V056)에 대해 단위 테스트로 커버할 수 없는 영역이다. 마이그레이션 자체는 단순 DDL이므로 별도 SQL 테스트가 없어도 무방하지만, 마이그레이션 적용 후 `dismissed_at IS NULL` 필터가 실제 쿼리 경로(목록 조회, 미읽음 카운트)에 정확히 적용되는지 검증하는 e2e 또는 통합 테스트가 부재하다.
  - 제안: Notification 서비스의 목록·카운트 쿼리에 `dismissed_at IS NULL` 조건이 포함되는지를 검증하는 통합 테스트를 추가한다. 최소한 `dismissed_at`이 채워진 행이 목록 API 결과에서 제외되는지 확인하는 시나리오가 필요하다.

---

## 요약

이번 변경셋은 대체로 기존 테스트를 신규 구조에 정합적으로 동기화하고 있으며, mock surface 동기화 패턴과 회귀 가드 확보 노력이 잘 보인다. 그러나 세 가지 주요 갭이 있다. 첫째, Cafe24 `expires_at` 파싱과 fallback 2h 로직에 대한 회귀 테스트 두 건이 삭제됐는데 삭제 근거가 불명확하다 — 이는 실제 운영 장애로 이어진 버그의 가드였으므로 복원 또는 동등 테스트 재작성이 필요하다. 둘째, `WorkflowNotFoundError`·`SubWorkflowTimeoutError` 커스텀 클래스 삭제로 인해 핸들러 레이어의 에러 분류 경로에 대한 typed 분기 테스트가 사라질 위험이 있다. 셋째, `IntegrationActionRequiredNotifier`는 신규 기능임에도 전용 테스트가 없어 핵심 동작(24h 중복 방지, email 채널 분기, 에러 swallow)이 비검증 상태다. DB 마이그레이션과 dismiss 기능에 대한 통합 수준 테스트도 후속으로 보강이 필요하다.

## 위험도

HIGH
