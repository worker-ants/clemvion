# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1-3: V055, V056 마이그레이션 SQL

- **[INFO]** SQL 주석 품질이 우수함 — spec 참조, 설계 근거, 실행 순서, 재실행 안전성까지 명확히 기술
  - 위치: V055, V056 파일 헤더 주석
  - 상세: CONCURRENTLY 사용 이유, IF NOT EXISTS/IF EXISTS 배치 근거, 트랜잭션 분리 이유 등 의사결정 배경이 명시적으로 기술되어 있음. 향후 유지보수자가 맥락을 추측하지 않아도 됨.
  - 제안: 유지. 이 수준을 패턴으로 삼을 것.

- **[INFO]** `.conf` 파일이 SQL과 분리되어 있어 파일 커플링이 존재
  - 위치: `V056__notification_active_partial_index.conf`, `.sql`
  - 상세: `.conf` 파일에 `executeInTransaction=false` 한 줄만 있고 해당 SQL 파일 헤더에 그 이유가 충분히 설명되어 있어 이해에 어려움은 없음. Flyway 컨벤션을 따른 것으로 적절한 분리.
  - 제안: 현행 유지.

---

### 파일 4: `alerts-evaluator.service.spec.ts`

- **[INFO]** mock surface 동기화 주석이 명확함
  - 위치: 라인 186-187 추가 부분
  - 상세: `dismiss`/`dismissAll` 추가 시 spec 링크와 목적(surface 동기화)이 주석으로 병기됨. 테스트가 직접 호출하지 않는 메서드를 왜 mock하는지 이해 가능.
  - 제안: 현행 유지.

- **[INFO]** `notificationsService` 타입 선언이 명시적 interface 없이 인라인으로 관리됨
  - 위치: 라인 276 `let notificationsService: { createMany: Mock; hasRecentByResource: Mock };` (전체 파일 컨텍스트)
  - 상세: `dismiss`/`dismissAll` 추가로 타입 선언과 `beforeEach` 초기화 두 곳을 동시에 수정해야 한다. 메서드가 늘어날수록 drift 위험이 커짐. 현재 diff 에서는 `beforeEach` 만 수정됐고 `let notificationsService` 타입 선언은 갱신되지 않아 타입 미스매치가 있음.
  - 제안: `notificationsService` 변수 선언의 타입을 `dismiss: Mock; dismissAll: Mock;` 로 함께 갱신하거나, `Partial<NotificationsService>` 등 실제 서비스 타입을 기반으로 mock 타입을 파생시킨다.

---

### 파일 5: `execution-engine.service.spec.ts`

- **[WARNING]** `output.result.*` → `output.*` 리팩터 후 D6 회귀 차단 테스트 삭제로 퇴행 방지 능력 저하
  - 위치: 라인 660-675 삭제 구간 (`it('ignores legacy top-level message/messages/turnCount/maxTurns (D6 정합)', ...)`)
  - 상세: D6 마이그레이션으로 데이터 구조가 반전된 것이 확인됨 — 이전에 "이 경로는 무시해야 한다"고 검증하던 테스트가 삭제되면서 새로운 스펙("이 경로를 읽어야 한다")에 대한 역방향 회귀 보호가 빠졌다. 기존 D6 테스트는 "old shape → ignored" 를 검증했고, 신규 테스트는 "new flat shape → recognized" 를 검증하나 "result 래핑 shape → ignored" 를 명시하는 테스트는 없어졌다.
  - 제안: `it('ignores result-wrapped shape (pre-D6 handler regression guard)', () => { ... })` 형태로 역방향 회귀 테스트를 추가해 핸들러가 `output.result.*` 로 회귀했을 때 빈 conversationConfig 가 emit 되는 결함을 잡도록 한다.

- **[INFO]** 대규모 테스트 파일(6,000+ 줄)의 구조는 `describe` 계층으로 잘 정리되어 있음
  - 위치: 파일 전체
  - 상세: `describe` 네스팅이 의미 단위로 분리되어 있고 테스트 설명이 구체적이어서 실패 시 원인 식별이 빠름. 파일 크기 자체는 다루는 서비스의 복잡도를 반영한 불가피한 측면이 있음.
  - 제안: 신규 테스트 추가 시 기존 describe 구조 준수를 유지할 것.

---

### 파일 6: `execution-engine.service.ts`

- **[WARNING]** `WorkflowNotFoundError` / `SubWorkflowTimeoutError` 삭제로 에러 분류 능력 저하
  - 위치: diff 삭제 구간 및 `workflow-errors.ts` 삭제 (파일 7)
  - 상세: 삭제된 `workflow-errors.ts`의 JSDoc은 "핸들러가 `err instanceof WorkflowNotFoundError` 처럼 typed 분기를 1차로 사용"한다고 명시했었다. 이를 `new Error(...)` 로 교체하면 호출자가 에러 종류를 문자열 매칭으로 구별해야 하는 취약한 패턴으로 회귀한다. 현재 `workflow.handler.ts` 등 호출자가 어떻게 대응하는지 이 diff만으로는 확인이 어려우나, typed error class가 제공하는 의도 명확성과 instanceof 분기 가능성이 사라진다.
  - 제안: 호출자(workflow.handler.ts 등)가 `instanceof` 대신 메시지 문자열 매칭으로 분기하도록 이미 변경됐는지 확인. 그렇다면 현재 상태가 일관적이지만, 향후 에러 종류가 늘어날 때를 위해 에러 코드 필드(`code: 'WORKFLOW_NOT_FOUND'`)를 Error 객체에 부착하는 간단한 방식이라도 도입을 검토한다.

- **[WARNING]** `Workflow not found: ${workflowId}` 에러 메시지가 4곳에 하드코딩으로 반복
  - 위치: `execute()`, `executeInline()`, `executeAsync()`, `executeSync()` 각각의 `throw new Error(...)` 구문
  - 상세: 동일 메시지 패턴이 4회 중복된다. 메시지 포맷 변경(예: 한국어 통일, 오탈자 수정) 시 4곳을 모두 찾아야 한다. 이전의 `WorkflowNotFoundError(workflowId)` 클래스는 이 중복을 한 곳에서 관리했었다.
  - 제안: `function throwWorkflowNotFound(workflowId: string): never { throw new Error(...) }` 헬퍼 함수로 추출하거나, 최소한 메시지 템플릿 상수(`const WORKFLOW_NOT_FOUND_MSG = (id: string) => ...`)를 선언해 중복을 제거한다.

- **[INFO]** `executeSync()`와 `executeAsync()`의 공통 recursion depth 체크·workflow 조회·workspace assert 로직이 복사됨
  - 위치: `executeSync` (라인 3340-3354), `executeAsync` (라인 3448-3461)
  - 상세: 두 메서드 상단부 4~5줄의 로직이 거의 동일하다. 해당 서비스가 이미 ~4200줄 규모로 크기가 크다고 자체 주석에 명시되어 있으며, PR-H/I에서 점진적 분해 예정이라는 맥락이 있어 지금 당장 강제 리팩터보다는 backlog 아이템으로 트래킹이 현실적.
  - 제안: 현행 유지하되, `validateAndLoadWorkflow(workflowId, options)` 같은 private 헬퍼로 추출하는 작업을 PR-H/I 분해 대상에 포함시킨다.

- **[INFO]** `buildConversationConfigFromOutput` 함수의 복잡한 반환 타입이 인라인으로 정의됨
  - 위치: 라인 2568-2577 (전체 파일 컨텍스트)
  - 상세: 반환 타입이 7개 필드의 인라인 객체 타입이다. 같은 shape를 호출 측에서 재사용할 경우 중복이 발생할 수 있다.
  - 제안: `ConversationConfig` 또는 `WsConversationConfigPayload` 등의 named interface로 추출한다.

---

### 파일 7: `workflow-errors.ts` (삭제)

- **[WARNING]** 파일 7 삭제에 대해 파일 6 항목과 동일하게 반복 언급하지 않음 — 위에서 통합 서술.

---

### 파일 8: `integration-action-required-notifier.service.ts`

- **[WARNING]** channel 타입 캐스팅에 `'email'` 리터럴이 추가되었으나 실제 비즈니스 로직에서 `'email'` 단독이 선택될 경우 없음
  - 위치: 라인 3872-3875
  - 상세: `(wantsEmail ? 'both' : 'in_app') as | 'both' | 'in_app' | 'email'` 는 `'email'` 이 실제로 선택될 수 없음에도 union에 포함시킨다. 이는 `NotificationsService.createMany`의 인수 타입과 맞추기 위한 캐스팅으로 보이나, 실제 허용 값과 타입 집합의 불일치가 의도를 모호하게 만든다. "우리는 이 경로에서 `'email'` 을 절대 보내지 않지만 타입 때문에 union에 넣었다"는 사실이 코드에서 드러나지 않는다.
  - 제안: `NotificationsService.createMany`의 `channel` 파라미터 타입을 확인하고, 그 타입을 직접 import해서 캐스팅 대신 할당하는 방향을 고려한다. 또는 inline 로직에 주석으로 `// 'email' 단독은 이 경로에서 발생하지 않음` 을 명시한다.

- **[INFO]** `composeMessage`에 하드코딩된 문자열 메시지 3종
  - 위치: 라인 3901-3917 (`switch(statusReason)`)
  - 상세: 메시지 문자열이 switch 내부에 직접 정의되어 있다. 이는 국제화나 메시지 변경 시 코드 수정이 필요하지만, 현 프로젝트 규모에서는 과도한 추상화보다 직관적인 편이 낫다.
  - 제안: 현행 유지. 메시지 변경 빈도가 높아지면 상수 맵으로 분리.

---

### 파일 9: `integration-expiry-scanner.service.spec.ts`

- **[INFO]** 파일 4와 같은 mock surface 동기화 패턴 — 일관성 있음
  - 위치: 라인 3939-3941 추가 부분
  - 상세: `dismiss`/`dismissAll` mock을 동일한 방식으로 추가. 코드베이스 전반에 걸쳐 동일 패턴이 적용되어 있어 가독성과 검색 가능성이 높다.
  - 제안: 현행 유지.

- **[INFO]** `notificationsService` 타입이 이 파일에서도 파일 4와 같이 `dismiss`/`dismissAll`이 타입 선언에서 누락됨
  - 위치: 라인 4003-4004 `let notificationsService: { createMany: Mock; hasRecentByResource: Mock };`
  - 상세: 파일 4와 동일한 이슈.
  - 제안: 파일 4에서 제안한 방법과 동일하게 타입 선언을 일치시킨다.

---

### 파일 10: `integration-oauth.service.cafe24.spec.ts`

- **[INFO]** 170줄짜리 두 테스트 삭제 — 파일 크기 감소와 가독성 개선
  - 위치: 라인 4612-4703 삭제 구간 (expires_at / fallback 관련 테스트 2개)
  - 상세: 삭제된 테스트들은 `try/finally` 내부에서 `global.fetch`를 교체·복원하고 `OAUTH_STUB_MODE`를 조작하는 복잡한 setup을 반복했다. 이 기능이 다른 경로로 테스트되거나 구현 자체가 변경되어 삭제된 것으로 보임.
  - 제안: 삭제가 의도적이고 대응하는 구현 변경과 함께라면 적절. 해당 토큰 만료 파싱 로직이 여전히 존재한다면 다른 테스트로 커버가 되는지 확인 필요.

- **[INFO]** `overrides.credentialsMallId ?? (mallId ?? 'priv-shop')` 에 괄호 추가 — 명시성 개선
  - 위치: 라인 4607
  - 상세: 연산자 우선순위가 이미 동일하게 동작하지만 괄호가 "fallback 계층" 의도를 명확하게 한다. ai-review W2 조치로 기록되어 있어 추적 가능.
  - 제안: 현행 유지.

---

## 요약

이번 변경 집합의 유지보수성은 전반적으로 양호하다. SQL 마이그레이션은 설계 근거와 spec 참조가 충실하고, 테스트 mock surface 동기화는 코드베이스 전반에서 일관된 패턴으로 적용되어 있다. 주요 관심사는 두 가지다. 첫째, `workflow-errors.ts` 삭제와 `new Error(...)` 직접 throw로의 전환이 동일 에러 메시지 문자열을 4곳에 분산시켜 향후 변경 시 일관성 유지가 어려워진다. typed error class 또는 메시지 헬퍼 함수로 중복을 제거할 필요가 있다. 둘째, `execution-engine.service.spec.ts`에서 D6 역방향 회귀 차단 테스트가 삭제되어 핸들러가 `output.result.*` 래핑 shape로 회귀했을 때의 감지 능력이 약화됐다. mock 타입 선언과 초기화 사이의 drift 문제는 규모가 작지만 복수 파일에 걸쳐 반복되므로 일괄 정정이 권장된다. `integration-action-required-notifier.service.ts`의 channel 타입 캐스팅에 도달 불가능한 `'email'` 리터럴 포함은 독자에게 혼란을 준다.

## 위험도

MEDIUM
