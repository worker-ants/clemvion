# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: execution-engine.service.spec.ts

- **[WARNING]** `withWorkspace` 헬퍼와 인라인 `context.variables` 직접 조작이 혼재
  - 위치: `차단: 호출자 workspace 와 sub-workflow workspace 불일치 (W-6)` 테스트 (라인 1165-1169), `통과: 동일 workspace (W-6)` 테스트 (라인 1204-1207)
  - 상세: 이번 변경에서 `withWorkspace` 헬퍼를 도입하여 `__workspaceId` 주입을 캡슐화했음에도, `executeInline — Sub-Workflow parent linking` describe 블록 내 두 개 테스트는 동일한 주입을 `context.variables = { ...(context.variables ?? {}), __workspaceId: ... }` 인라인 방식으로 수행한다. `withWorkspace` 구현과 구조가 동일하므로 헬퍼 로직이 변경되면 인라인 복사본은 갱신되지 않는 불일치 위험이 생긴다.
  - 제안: 두 테스트를 `withWorkspace(context, 'ws-attacker')`, `withWorkspace(context, 'ws-1')` 형태로 통일하여 헬퍼 단일 진실 원칙을 관철한다.

- **[INFO]** 동일 describe 블록 내 테스트 설명 언어 혼재
  - 위치: `executeSync`/`executeAsync` 관련 추가 테스트
  - 상세: 같은 블록의 기존 테스트는 영어(`throws when sub-workflow status is FAILED`)이지만 이번에 추가된 테스트는 한국어 주석(`// W-6 fail-closed — public sub-workflow API ...`)만 있고 it 제목은 영어로 작성되었다. `executeInline` 블록 추가 테스트는 한국어 제목(`차단(fail-closed): ...`)을 사용한다. 블록 경계를 넘어 언어 정책이 일관되지 않다.
  - 제안: 같은 describe 블록 내 it 제목 언어를 통일한다. 추가 부담이 크다면 현재 혼재 상태를 팀 컨벤션으로 문서화하는 것으로 대체 가능하다.

- **[INFO]** `withWorkspace` 헬퍼가 컨텍스트를 뮤테이션(mutation)함
  - 위치: `withWorkspace` 헬퍼 정의 (describe 블록 최상단)
  - 상세: `withWorkspace`는 `ctx.variables`를 직접 교체하고 같은 인스턴스를 반환한다. 이는 순수 함수처럼 보이지만(`return ctx`) 입력 객체를 변경하므로 호출 이후 원본 `context.variables`가 변경된다. 대부분의 테스트에서는 문제없으나, 한 context를 여러 단계에서 재사용하는 테스트에서 예상치 못한 부작용이 생길 수 있다.
  - 제안: 뮤테이션 의도를 명시하는 주석을 추가하거나, `context.variables` 를 새 객체로 대체하므로 기존 참조에는 영향이 없음을 확인하여 문서화한다.

### 파일 2: execution-engine.service.ts

- **[INFO]** `assertSameWorkspace` 에러가 문자열 접두어 기반 코드 포함
  - 위치: `assertSameWorkspace` 메서드 (라인 2274-2284)
  - 상세: `throw new Error('WORKFLOW_FORBIDDEN_WORKSPACE: Sub-workflow ...')` 패턴은 에러 코드를 메시지 문자열 접두어로 삽입한다. 소비자(테스트, 상위 catch 블록)가 `error.message`를 regex로 파싱해야 한다. 같은 파일의 `WorkflowNotFoundError`, `InvalidExecutionStateError` 등은 전용 클래스에 `code` 프로퍼티를 선언하여 `instanceof`/`error.code`로 구분 가능한 패턴을 사용한다.
  - 제안: `workflow-errors.ts`에 `WorkflowForbiddenWorkspaceError` 클래스를 추가하고 `code = 'WORKFLOW_FORBIDDEN_WORKSPACE'` 를 타입으로 선언하면 소비자 코드에서 메시지 파싱 의존이 제거된다. 현재 동작에 기능 문제는 없으므로 우선순위는 낮다.

- **[INFO]** `assertSameWorkspace` 메서드에 JSDoc 블록이 중복 존재
  - 위치: `assertSameWorkspace` 선언 직전 두 개의 연속 JSDoc 블록 (라인 2258-2269 및 2259-2269)
  - 상세: 전체 파일 컨텍스트에서 `assertSameWorkspace` 위에 두 개의 `/** ... */` 블록이 연속 존재한다(클래스 본문 상단의 설명과 메서드 직전 설명이 동일 내용으로 중복). 이는 diff 이전부터 존재했을 수 있으나 이번 변경에서 두 블록이 동시에 갱신되어 중복이 유지된 상태다.
  - 제안: 두 JSDoc 블록 중 하나를 제거하여 단일 문서화 지점을 유지한다.

## 요약

이번 변경은 W-6 workspace 격리 정책을 fail-open에서 fail-closed로 전환하는 보안 강화이며, 전반적인 코드 의도가 주석과 테스트 설명으로 충분히 문서화되어 있다. 가독성과 네이밍은 양호하고 추가된 함수(`withWorkspace`, `assertSameWorkspace` 수정)가 단일 책임을 가진다. 주요 유지보수성 우려는 `withWorkspace` 헬퍼 도입 이후에도 일부 테스트가 동일 로직을 인라인으로 반복하여 헬퍼가 변경될 때 불일치가 발생할 수 있다는 점이며, 프로덕션 코드에서는 에러 코드를 문자열 접두어로 포함시키는 방식이 기존 전용 에러 클래스 패턴과 일관되지 않다는 INFO 수준의 문제가 있다.

## 위험도

LOW
