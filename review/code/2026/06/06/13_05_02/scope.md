# 변경 범위(Scope) Review

## 발견사항

### 파일 1: execution-engine.service.spec.ts

- **[INFO]** 신규 테스트 2건 추가 (`stageDurableResumeSnapshot` 관련)
  - 위치: diff +36~+131
  - 상세: `context._callStack` 직렬화 검증(중첩 frame)과 top-level NULL 재설정 검증. plan §PR-B2b 진행 상태 "8a 영속 stage (unit 2건 green)"에 명시된 항목과 정확히 대응. 관련 없는 기존 테스트 변경 없음.
  - 제안: 없음. 범위 내.

### 파일 2: execution-engine.service.ts

- **[INFO]** `runNodeDispatchLoop` while 루프 → `try/catch(ParkReleaseSignal)` 래핑
  - 위치: diff -670 ~ +694 (전체 루프 들여쓰기 이동)
  - 상세: 실질 로직 변경 없이 catch 블록 추가를 위한 들여쓰기 증가. 로직 동작은 동일하며 catch 추가가 목적. 포맷팅 변경이 크게 보이나 의도된 구조 변경.
  - 제안: 없음. 의미 있는 구조적 변경이며 불필요한 포맷팅 변경 아님.

- **[INFO]** `resumeFromCheckpoint` 내 `driveCallStackResume` 분기 추가
  - 위치: diff +1010~+1064
  - 상세: `resumeCallStack` non-null 시 신규 경로 분기. plan §8c 중첩 재개와 정확히 대응.

- **[INFO]** `driveCallStackResume`, `driveResumeFrame`, `injectInvokerOutput` 신규 메서드 추가
  - 위치: diff +1073~+1411
  - 상세: 중첩 frame-by-frame 재개 핵심 로직. plan §8c 명시 항목.

- **[INFO]** `executeInline` 내 `_callStack` push/pop 추가 및 blocking 3분기 'release' 전환
  - 위치: diff +2756 ~ +3377 구간
  - 상세: plan §8a(call-stack 추적)와 §8d(park-release) 정확히 대응.

- **[INFO]** `stageDurableResumeSnapshot` 확장 + `snapshotCallStack` 신규 private 메서드
  - 위치: diff +9503 ~ +9624
  - 상세: plan §8a(영속 stage) 대응.

- **[INFO]** `waitForFormSubmission` JSDoc 수정 (한국어 설명 보강)
  - 위치: diff -3635 ~ +3635 (주석 변경)
  - 상세: `@todo PR-B2/B3: 두 직교 동작...Strategy 패턴...추출 예정` 항목이 제거되고 현행 동작 설명으로 교체됨. PR-B2b 구현으로 해당 @todo 가 이행됐으므로 삭제는 적절. 인라인 주석도 `Phase B (PR-B1)` 한정 문구에서 공통화(중첩 포함) 설명으로 갱신 — 실질 동작 변경 반영.
  - 제안: 없음. 범위 내.

### 파일 3: node-handler.interface.ts

- **[INFO]** `ExecutionContext` 에 `_callStack?: ResumeCallStackFrame[]` 필드 추가 및 JSDoc
  - 위치: diff +1~+19
  - 상세: plan §8a call-stack 추적의 타입 선언부. 해당 import(ResumeCallStackFrame)도 함께 추가.
  - 제안: 없음. 범위 내.

### 파일 4: workflow-executor.interface.ts

- **[INFO]** `InlineExecutionOptions` 에 `invokerNodeId?: string` 필드 추가 및 JSDoc
  - 위치: diff +30~+16
  - 상세: plan §8a에서 `WorkflowHandler` 가 `context.nodeId` 를 전달하는 경로의 인터페이스 선언. 최소 변경.
  - 제안: 없음. 범위 내.

### 파일 5: workflow.handler.ts

- **[INFO]** `invokerNodeId: context.nodeId` 전달 + `ParkReleaseSignal` re-throw
  - 위치: diff +154~+174 (sync inline 호출부) + +174~+234 (catch 블록)
  - 상세: plan §8a(invokerNodeId 전달)와 §8d(ParkReleaseSignal re-throw)에 정확히 대응.
  - 제안: 없음. 범위 내.

### 파일 6: park-release-signal.ts (신규 파일)

- **[INFO]** 신규 sentinel 클래스 파일 생성
  - 위치: `codebase/backend/src/shared/execution-resume/park-release-signal.ts`
  - 상세: plan 구현 설계 "정의=`src/shared/execution-resume/park-release-signal.ts`(handler·engine 공유 import)" 에 명시된 파일. handler 와 engine 이 공유 import 할 수 있도록 `shared/execution-resume/` 위치 선택은 합리적. `isParkReleaseSignal` 타입가드도 추가됐으나 현재 코드에서 직접 사용 여부는 확인되지 않음 — 단, export API 완성도 차원의 추가로 minor.
  - 제안: 없음. 범위 내.

### 파일 7: plan/in-progress/exec-park-durable-resume.md

- **[INFO]** PR-B2b 진행 메모 및 구현 설계 추가
  - 위치: diff +186~+32 (약 32행 추가)
  - 상세: plan 업데이트는 developer 역할의 정당한 쓰기 영역(`plan/**`). 기존 plan 내용을 수정하지 않고 "PR-B2b 착수" 섹션 + "PR-B2b 구현 설계" + "PR-B2b 진행 상태" 블록을 추가.
  - 제안: 없음. 범위 내.

---

## 요약

PR-B2b 는 plan `exec-park-durable-resume.md §PR-B2b` 에 명시된 step 8a(영속 stage + call-stack 추적), 8d(executeInline park-release), 8c(중첩 frame-by-frame 재개)를 구현하는 변경이다. 7개 파일 모두 해당 step 범위 안에서만 수정됐으며, 불필요한 리팩토링, 무관한 파일 수정, 요청되지 않은 기능 확장은 발견되지 않았다. `waitForFormSubmission` JSDoc 변경은 `@todo PR-B2/B3` 이행 완료로 인한 삭제와 중첩 경로를 반영한 설명 갱신으로 적절하다. `runNodeDispatchLoop` 의 들여쓰기 대규모 변화는 `try/catch` 래핑을 위한 의도된 구조 변경이다. `isParkReleaseSignal` 타입가드는 현 PR 에서 직접 사용되지 않으나 sentinel 클래스의 관용적 export 패턴 범위 내다.

## 위험도

NONE

STATUS: SUCCESS
