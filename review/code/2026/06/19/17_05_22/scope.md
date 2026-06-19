# 변경 범위(Scope) 리뷰 결과

## 발견사항

### 파일 1: execution-engine.service.ts

- **[INFO]** 변경 범위 정확히 일치
  - 위치: `assertSameWorkspace` 메서드 (라인 541 부근)
  - 상세: W-6 workspace 격리 정책을 fail-open(로그 후 통과)에서 fail-closed(throw)로 전환하는 단일 목적에 충실하다. JSDoc 주석 갱신은 동작 변경을 정확히 반영하기 위한 필수 문서화이며 과잉이 아니다. 코드 변경은 `if (!callerWorkspaceId)` 블록 내부를 `this.logger.warn(...); return;` 에서 `throw new Error(...)` 로 교체하는 것뿐이다. 다른 메서드·임포트·설정 파일에 대한 수정 없음.
  - 제안: 없음

### 파일 2: execution-engine.service.spec.ts

- **[INFO]** 기존 테스트 픽스처 수정은 범위 내
  - 위치: `mockWorkflow` 객체 (라인 130 부근) + `withWorkspace` 헬퍼 + 기존 테스트 다수
  - 상세: fail-closed 전환으로 `executeInline`/`executeSync`/`executeAsync` 에 workspace 컨텍스트가 없으면 throw 하므로, 기존 workspace-무관 테스트들이 깨진다. `mockWorkflow.workspaceId: 'ws-1'` 추가와 `withWorkspace()` 헬퍼를 통한 `__workspaceId` 주입은 이 브레이킹 변경에 대응하는 최소 픽스다. 범위 위반 아님.

- **[INFO]** 신규 fail-closed 검증 테스트 3건 추가
  - 위치: `executeInline` describe (라인 910~137), `executeSync` describe (라인 1831~), `executeAsync` describe (라인 1925~)
  - 상세: `차단(fail-closed): 호출자 workspace 컨텍스트 누락 (W-6)`, `throws WORKFLOW_FORBIDDEN_WORKSPACE when parentWorkspaceId is absent (fail-closed)` (×2) — 모두 W-6 변경의 직접적 행동을 검증한다. 범위 내.

- **[INFO]** `_callStack` 관련 테스트 4건의 `__workspaceId` 주입 (라인 12468~12579)
  - 위치: `invokerNodeId 있을 때 frame 이 _callStack 에 push 된다` 등
  - 상세: `executeInline` 내부를 사용하는 기존 `_callStack` 테스트들이 fail-closed 전환으로 깨지므로 workspace 컨텍스트를 주입한다. `withWorkspace()` 헬퍼 대신 인라인으로 직접 `context.variables` 를 세팅한 것은 스타일 차이지만 해당 describe 블록이 `withWorkspace` 를 가져오기 어려운 스코프에 있어 납득 가능하다. 범위 내.

- **[INFO]** 주석 추가 분량이 많지만 전부 W-6 맥락 설명
  - 위치: 전체 diff 주석 라인
  - 상세: 모든 추가 주석이 `W-6 fail-closed` 레이블을 달고 격리 검사 통과 조건을 설명한다. 관련 없는 주제 없음. 과잉이라 볼 수 없다.

## 요약

두 파일의 변경은 W-6 workspace 격리 정책을 fail-open에서 fail-closed로 전환하는 단일 목적에 완전히 부합한다. `execution-engine.service.ts`는 `assertSameWorkspace` 메서드의 동작 한 줄과 JSDoc만 수정했고, `execution-engine.service.spec.ts`는 해당 브레이킹 변경으로 깨지는 기존 테스트를 최소 픽스하고 새 동작을 검증하는 테스트 3건을 추가했다. 불필요한 리팩토링, 무관한 파일 수정, 임포트 변경, 설정 파일 변경은 없다.

## 위험도

NONE
