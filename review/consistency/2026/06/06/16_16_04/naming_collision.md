# 신규 식별자 충돌 분석

검토 범위: `spec/5-system/4-execution-engine.md` 구현 완료 후 diff (exec-park D6 / PR-B2b + B3)
분석 기준: 코드 변경 diff + 관련 spec/1-data-model.md + 기존 production 코드

---

## 발견사항

### [INFO] `ParkReleaseSignal` — 신규 export class, 충돌 없음
- target 신규 식별자: `ParkReleaseSignal` (class), `isParkReleaseSignal` (함수), `/codebase/backend/src/shared/execution-resume/park-release-signal.ts` (신규 파일)
- 기존 사용처: origin/main 에서 `execution-engine.service.ts` 는 `ParkReleaseSignal` 을 import/use 하지 않았다 (grep 결과 없음). `PARK_RELEASED` Symbol 과 `ParkSignal` type 은 service 파일 내부 private 상수로만 존재했다.
- 상세: `ParkReleaseSignal` class 는 이 PR 에서 신규 도입된다. 기존 `PARK_RELEASED` Symbol(module-private) 과 이름이 유사하지만 용도가 다르다 — `PARK_RELEASED` 는 top-level park 의 반환 sentinel(Symbol), `ParkReleaseSignal` 은 중첩 sub-workflow deep unwind 용 throw sentinel(class). 두 식별자는 같은 파일 안에 공존하며 각자 다른 역할을 한다. 기존 코드베이스에 `ParkReleaseSignal` 이라는 이름의 다른 클래스나 변수는 없다.
- 제안: 충돌 없음. `PARK_RELEASED`(Symbol, top-level 반환)와 `ParkReleaseSignal`(class, 중첩 throw) 의 역할 구분이 코드 주석으로 명확히 설명되어 있다.

### [INFO] `CALL_STACK_SCHEMA_VERSION` — 신규 export 상수, `CHECKPOINT_SCHEMA_VERSION` 과 병치, 충돌 없음
- target 신규 식별자: `CALL_STACK_SCHEMA_VERSION = 1` (`/codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts`)
- 기존 사용처: `CHECKPOINT_SCHEMA_VERSION = 1` 은 `execution-engine.service.ts` 내부 private const 로 존재한다 (line 286). 두 상수는 현재 값이 동일하게 `1` 이다.
- 상세: 두 상수는 의미적으로 독립이다 — `CHECKPOINT_SCHEMA_VERSION` 은 `_resumeCheckpoint` jsonb 직렬화 포맷 버전, `CALL_STACK_SCHEMA_VERSION` 은 `resume_call_stack` jsonb 직렬화 포맷 버전. 현재 둘 다 값이 `1` 이므로 코드 리뷰 시 혼동 가능성이 있으나, 이는 초기 스키마 버전이 우연히 같은 것이며 향후 개별 진화가 의도된 설계다. `resume-call-stack.types.ts` 의 JSDoc 이 이 독립성을 명시한다. 충돌은 없다.
- 제안: 충돌 없음. JSDoc 설명이 독립성을 충분히 명시하고 있다.

### [INFO] `ResumeCallStack`, `ResumeCallStackFrame` — origin/main 에 이미 존재하는 파일에서 변경 없음
- target 신규 식별자: 없음 (이 PR 에서 `resume-call-stack.types.ts` 는 변경 없음 — `git log origin/main..HEAD -- resume-call-stack.types.ts` 결과 없음)
- 기존 사용처: 파일은 이전 PR(PR-B2b step 8) 에서 도입됐으며 origin/main 에 이미 반영됨.
- 상세: 분석 대상 diff 범위 외의 파일이다. 충돌 없음.

### [INFO] `makeCompletionGuard` — test-local 함수, `makeDeadlockGuard` 에서 이름 변경
- target 신규 식별자: `makeCompletionGuard` (test helper, `.spec.ts` 내부)
- 기존 사용처: 동일 파일에 `makeDeadlockGuard` 로 존재했다. 이번 diff 에서 rename.
- 상세: test-only scope 이며 production 코드에는 노출되지 않는다. "deadlock guard" → "completion guard" 로 의미가 변경되었는데 이는 semantics 변화(detach 모델 폐기 → await 모델 전환)를 정확히 반영한다. 충돌 없음.

### [INFO] `AiSubject`, `DriveSubject`, `RehydrationSubject`, `RehydrateCtxSubject` — test-local type alias, 충돌 없음
- target 신규 식별자: `AiSubject`, `DriveSubject` (이번 diff 에서 추가된 test-internal type)
- 기존 사용처: `LoopSubject` 는 이번 diff 에서 제거됐다. `RehydrationSubject`, `RehydrateCtxSubject` 는 기존 존재. 각 type 은 동일 spec.ts 파일의 각 `describe` 블록 scope 안에 정의된다.
- 상세: 모두 `.spec.ts` 내부 `as unknown as XSubject` 패턴의 test-internal cast type 이다. production 코드에 노출되지 않는다. 충돌 없음.

### [INFO] `park-release-signal.ts` 파일 경로 — 신규 파일, 컨벤션 부합
- target 신규 식별자: `/codebase/backend/src/shared/execution-resume/park-release-signal.ts`
- 기존 사용처: 동일 폴더에 `resume-call-stack.types.ts` 가 존재한다. 폴더 이름 `execution-resume` 는 이전 PR 에서 이미 도입됨.
- 상세: 파일명 `kebab-case.ts` 패턴이 기존 파일과 일치한다. 기존 파일 이름과 겹치지 않는다. 충돌 없음.

---

## 요약

이번 diff(exec-park D6 full B3)가 도입하는 식별자는 `ParkReleaseSignal` class / `isParkReleaseSignal` 함수 / `makeCompletionGuard` test helper / `AiSubject`, `DriveSubject` test-local type 이다. `CALL_STACK_SCHEMA_VERSION` 과 `ResumeCallStack*` 타입은 이전 PR 에서 이미 origin/main 에 반영된 것이다. 기존 코드베이스에 같은 이름으로 다른 의미를 가진 식별자가 존재하는 경우는 발견되지 않았다. `PARK_RELEASED`(Symbol) 과 `ParkReleaseSignal`(class) 은 이름이 유사하지만 명확히 분리된 역할과 범위를 가지며, `CALL_STACK_SCHEMA_VERSION` 과 `CHECKPOINT_SCHEMA_VERSION` 은 현재 값이 동일(`1`)하지만 의도적으로 독립적으로 설계됐다. 충돌 위험 식별자는 없다.

## 위험도

NONE
