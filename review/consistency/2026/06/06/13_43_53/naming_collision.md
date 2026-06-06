# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md` (--impl-done, diff-base=origin/main)
검토 범위: 이번 브랜치(exec-park-b2b-04a2f8)에서 신규 도입된 식별자

---

## 발견사항

이번 브랜치가 도입한 신규 식별자는 다음과 같다.

**신규 파일**
- `codebase/backend/src/shared/execution-resume/park-release-signal.ts` (origin/main 미존재 → 신규)

**신규 심볼 (기존 파일 수정)**
- `ExecutionContext._callStack` — `node-handler.interface.ts` 에 추가
- `InlineExecutionOptions.invokerNodeId` — `workflow-executor.interface.ts` 에 추가
- `ParkReleaseSignal` 클래스 + `isParkReleaseSignal` 타입 가드 — 위 신규 파일에 정의
- `driveCallStackResume`, `driveResumeFrame`, `injectInvokerOutput` — `execution-engine.service.ts` 의 private 메서드 (테스트에서 `as unknown` 캐스트로 접근)

**이미 origin/main 에 존재하던 식별자 (이번 브랜치가 재사용)**
- `CALL_STACK_SCHEMA_VERSION`, `ResumeCallStack`, `ResumeCallStackFrame` — `resume-call-stack.types.ts` 는 이번 브랜치에서 변경 없음. 이미 main 에 있는 심볼을 테스트·서비스에서 import 해 사용.

---

### 1. CALL_STACK_SCHEMA_VERSION vs CHECKPOINT_SCHEMA_VERSION

- **등급**: INFO
- target 신규 식별자: `CALL_STACK_SCHEMA_VERSION` (import 추가, 이미 origin/main 에 정의됨)
- 기존 사용처: `execution-engine.service.ts:289` — `const CHECKPOINT_SCHEMA_VERSION = 1;` (파일-스코프 상수, 비export)
- 상세: 두 상수는 동일한 숫자값 `1` 을 가지며 이름이 유사하다. `resume-call-stack.types.ts` 주석이 "독립 상수 — 호출 체인 스키마와 checkpoint 스키마가 따로 진화하도록 의도적 분리"임을 명시하고 있어 의미 충돌은 없다. 그러나 둘 다 `= 1` 이고 이름 접두어(CALL_STACK vs CHECKPOINT)만 다르므로, 이후 버전 올릴 때 한쪽만 바꾸면 의도치 않은 비대칭이 생길 수 있다.
- 제안: 충돌은 아니므로 차단 불필요. 다만 `CHECKPOINT_SCHEMA_VERSION` 도 export 하거나, 두 상수가 독립임을 나타내는 주석을 `execution-engine.service.ts` 의 `CHECKPOINT_SCHEMA_VERSION` 선언부에도 추가하면 미래 유지보수 혼선을 줄일 수 있다(INFO 수준).

---

### 2. ParkReleaseSignal — 다른 Signal/Error 클래스와의 혼동 가능성

- **등급**: INFO
- target 신규 식별자: `ParkReleaseSignal` (`park-release-signal.ts` 신규 파일)
- 기존 사용처: 코드베이스에서 `*Signal extends Error` 패턴의 클래스는 `ParkReleaseSignal` 외에 발견되지 않음. 기존 `ExecutionCancelledError`, `RehydrationError` 등은 별도 파일에 다른 이름으로 존재.
- 상세: 명명 충돌 없음. `park-release-signal.ts` 는 이번 브랜치에서 처음 도입되고, 기존 codebase 에 동명 클래스·타입·인터페이스 없음.
- 제안: 충돌 없음. 현행 유지 가능.

---

### 3. _callStack 필드 — ExecutionContext 기존 필드와의 충돌

- **등급**: INFO
- target 신규 식별자: `ExecutionContext._callStack` (`node-handler.interface.ts` 에 추가)
- 기존 사용처: `node-handler.interface.ts` 에 기존의 `_resumeCheckpoint`, `_retryState`, `abortSignal` 등 `_` 접두어 내부 필드가 존재. `_callStack` 이름은 origin/main `ExecutionContext` 에 없음.
- 상세: 명명 충돌 없음. `_` prefix 컨벤션을 기존 internal 필드와 일관되게 따르고 있음.
- 제안: 충돌 없음.

---

### 4. invokerNodeId — InlineExecutionOptions 기존 필드와의 충돌

- **등급**: INFO
- target 신규 식별자: `InlineExecutionOptions.invokerNodeId` (`workflow-executor.interface.ts` 에 추가)
- 기존 사용처: origin/main `InlineExecutionOptions` 에 `invokerNodeId` 미존재. 코드베이스 전체에서 동명 필드는 `ResumeCallStackFrame.invokerNodeId`(이미 main 에 존재) 뿐이며 의미가 동일하다 — sub-workflow 를 호출한 Workflow 노드의 `Node.id`.
- 상세: `InlineExecutionOptions.invokerNodeId` 가 `ResumeCallStackFrame.invokerNodeId` 에 그대로 복사되는 설계이므로 의미도 일치. 충돌 없음.
- 제안: 충돌 없음.

---

### 5. driveCallStackResume / driveResumeFrame / injectInvokerOutput — private 메서드명 충돌

- **등급**: INFO
- target 신규 식별자: `driveCallStackResume`, `driveResumeFrame`, `injectInvokerOutput` (private 메서드)
- 기존 사용처: `execution-engine.service.ts` 내 검색 결과 동명 메서드 없음. `driveResumeDetached` 는 기존에 존재하지만 이름이 다름.
- 상세: 세 메서드 모두 origin/main 에 미존재. `driveResume*` 접두어는 기존의 `driveResumeDetached` 와 패턴 일치 — 일관성 있음. 충돌 없음.
- 제안: 충돌 없음.

---

### 6. 파일 경로 — park-release-signal.ts 위치

- **등급**: INFO
- target 신규 식별자: `codebase/backend/src/shared/execution-resume/park-release-signal.ts`
- 기존 사용처: 동 디렉터리에 `resume-call-stack.types.ts`(기존 main) 존재. `shared/execution-resume/` 는 이미 확립된 경로.
- 상세: 파일명 컨벤션(`kebab-case.ts`) 일치. 동명 파일 없음. 충돌 없음.
- 제안: 충돌 없음.

---

## 요약

이번 브랜치(exec-park-b2b-04a2f8, PR-B2b)가 도입하는 신규 식별자 — `ParkReleaseSignal`/`isParkReleaseSignal`(신규 파일), `ExecutionContext._callStack`(인터페이스 확장), `InlineExecutionOptions.invokerNodeId`(인터페이스 확장), `driveCallStackResume`/`driveResumeFrame`/`injectInvokerOutput`(private 메서드), 그리고 `CALL_STACK_SCHEMA_VERSION`/`ResumeCallStack`/`ResumeCallStackFrame`(이미 origin/main 에 존재하는 심볼의 import 추가) — 중 기존 사용처와 의미가 다른 충돌은 발견되지 않았다. `CALL_STACK_SCHEMA_VERSION`과 `CHECKPOINT_SCHEMA_VERSION`(비export, `= 1`)이 값이 동일하고 이름이 유사하나, 소스 주석에서 독립 상수임을 명시하고 있어 혼동 유발 수준은 낮다. 전체 위험도는 NONE에 준하며 INFO 사항만 존재한다.

## 위험도

NONE
