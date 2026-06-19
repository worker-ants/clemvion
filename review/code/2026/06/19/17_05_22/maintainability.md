# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: execution-engine.service.spec.ts

- **[WARNING]** `withWorkspace` 헬퍼 함수가 두 스코프에 중복 정의됨
  - 위치: `describe('executeInline — Sub-Workflow parent linking')` 내부 — diff hunk `@@ -667,9 +672,20 @@`의 `beforeEach` 직후 삽입 정의와 전체 파일 컨텍스트 라인 973의 정의가 동일 describe 블록 안에 공존
  - 상세: 두 `withWorkspace` 정의가 동일 스코프에 있어 후자가 전자를 shadowing하거나 중복 선언 오류를 유발할 수 있다. 실행 시 예상치 못한 동작이 없더라도 코드 리더를 혼란시킨다.
  - 제안: 두 정의 중 하나를 제거하고 describe 블록 최상단에 단일 정의만 유지한다.

- **[WARNING]** describe 블록 범위 밖 테스트 4개에서 `withWorkspace` 미사용으로 동일 4줄 패턴 반복
  - 위치: diff hunk `@@ -12384,6 +12468` ~ `@@ -12477,6 +12579` — `invokerNodeId 있을 때 frame 이 _callStack 에 push 된다` 외 3개 테스트
  - 상세: 이 테스트들은 `withWorkspace`가 선언된 describe 블록 밖에 있어 헬퍼를 재사용하지 못하고, `context.variables = { ...(context.variables ?? {}), __workspaceId: 'ws-1' }`를 4회 중복 작성한다. `__workspaceId` 키 이름이나 기본값 변경 시 4곳을 동시에 수정해야 하는 유지보수 부담이 생긴다.
  - 제안: `withWorkspace`(또는 `injectWorkspaceId(ctx, wsId = 'ws-1')`)를 최상위 describe 스코프나 파일 상단 유틸 영역으로 끌어올려 모든 테스트가 공유하도록 한다.

- **[INFO]** 워크스페이스 픽스처 ID(`'ws-1'`, `'ws-attacker'`, `'ws-target'`)가 인라인 문자열 리터럴로 다수 반복
  - 위치: spec 파일 전체 — `mockWorkflow.workspaceId`, `withWorkspace`, 개별 테스트 body 등
  - 상세: `'ws-1'`은 "호출자 워크스페이스" 픽스처 ID이나 상수화되지 않아 오타 발생 시 추적이 어렵다. `'ws-attacker'`와 `'ws-target'`도 의도를 담고 있으나 문자열만으로는 역할이 즉시 드러나지 않는다.
  - 제안: 파일 상단 mock data 선언부에 `const CALLER_WS_ID = 'ws-1'`, `const ATTACKER_WS_ID = 'ws-attacker'`, `const TARGET_WS_ID = 'ws-target'`를 추가해 상수로 참조한다.

- **[INFO]** 한국어 기조 코드베이스에 일본어 주석 혼재
  - 위치: 전체 파일 컨텍스트 `rehydrateAndResume` catch 블록 — `W19: internal identifiers は structured params へ — error.message は コード分類のみ。BullMQ DLQ Board / 外部ログ集積への情報漏洩防止.`
  - 상세: 이번 diff의 직접 변경 범위는 아니나 전체 파일 컨텍스트에 포함된 서비스 파일 주석이 일본어로 작성되어 코드베이스 언어 일관성을 깨뜨린다.
  - 제안: 한국어로 통일한다.

---

### 파일 2: execution-engine.service.ts

- **[INFO]** `assertSameWorkspace` 에러 메시지에 error code와 본문이 단일 문자열로 혼합되어 기존 패턴과 불일치
  - 위치: `assertSameWorkspace` 메서드 — `throw new Error('WORKFLOW_FORBIDDEN_WORKSPACE: Sub-workflow ...')`
  - 상세: 코드베이스 내 다른 에러(`WorkflowNotFoundError`, `InvalidExecutionStateError`, `SubWorkflowTimeoutError` 등)는 `readonly code` 프로퍼티를 가진 전용 클래스를 사용한다. `assertSameWorkspace`만 `Error.message` prefix 방식을 쓰므로 호출자가 코드 판별을 위해 정규표현식(`/WORKFLOW_FORBIDDEN_WORKSPACE/`)에 의존해야 하는 불일치가 발생한다. 테스트도 `.toThrow(/WORKFLOW_FORBIDDEN_WORKSPACE/)` 패턴을 사용하고 있어 현재 동작하지만 일관성 측면의 기술 부채다.
  - 제안: `workflow-errors.ts`에 `WorkflowForbiddenWorkspaceError` 클래스(`readonly code = 'WORKFLOW_FORBIDDEN_WORKSPACE'`)를 추가하고, `assertSameWorkspace`가 해당 클래스를 throw하도록 변경한다.

- **[INFO]** `assertSameWorkspace` JSDoc이 클래스 필드 위치와 메서드 선언 위치 두 곳에 중복 작성
  - 위치: diff의 `@@ -541,21 +541,24 @@` 블록(첫 번째 JSDoc)과 전체 파일 컨텍스트 라인 ~2241(두 번째 JSDoc)
  - 상세: 메서드 하나에 같은 내용의 JSDoc이 두 위치에 있어 미래 변경 시 한 곳만 갱신하면 두 설명이 불일치하게 된다.
  - 제안: 메서드 선언 직전의 JSDoc 하나만 남기고 나머지를 제거한다.

---

## 요약

W-6 fail-closed 전환의 핵심 로직 변경(`assertSameWorkspace`의 fail-open → fail-closed)은 단 10줄 이내로 집약되어 있고 의도가 명확하다. 테스트 파일에서는 `withWorkspace` 헬퍼 도입으로 전반적인 반복이 크게 줄었으나, 동일 describe 블록 내 이중 정의 문제와 범위 밖 테스트에서의 4회 패턴 중복이 남아 있다. 서비스 파일에서는 `WORKFLOW_FORBIDDEN_WORKSPACE` 에러가 전용 클래스를 사용하는 기존 패턴을 따르지 않아 에러 핸들링 일관성에 기술 부채가 생겼다. 전반적으로 동작 정확성에 문제를 줄 수준은 아니나, 헬퍼 범위 통일과 에러 타입 정규화를 중기 과제로 처리하면 유지보수성이 향상된다.

## 위험도

LOW
