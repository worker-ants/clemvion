# 신규 식별자 충돌 검토 결과

## 발견사항

### 발견 없음 — 모든 신규 식별자가 기존 사용처와 일관

이번 diff 는 `execution-engine.service.spec.ts` 의 테스트 코드 전체를 exec-park D6 full B3 기준으로 재작성한 것이다.
아래에서 각 카테고리별로 점검 결과를 기술한다.

---

#### 1. 요구사항 ID 충돌

신규로 부여된 요구사항 ID 없음. 내부 코멘트 레이블(`exec-park D6 full B3`, `CRITICAL #1`, `CRITICAL #2`, `WARNING #8`)은 테스트 파일 내부 주석에만 존재하며, spec 이나 plan 의 동명 ID 와 충돌하지 않는다.

#### 2. 엔티티/타입명 충돌

신규로 도입된 test-scope 타입 별칭:

- `AiSubject` — `execution-engine.service.spec.ts` 내 `describe('W5 …')` 스코프 한정 로컬 타입. 코드베이스 전체에서 이 이름을 다른 의미로 쓰는 파일 없음. 충돌 없음.
- `DriveSubject` — 동 파일 `describe('driveCallStackResume …')` 스코프 한정 로컬 타입. 충돌 없음.
- `ResumeFromCpSubject` — 동 파일 `describe('resumeFromCheckpoint …')` 스코프 한정 로컬 타입. 충돌 없음.

이전에 존재했던 `LoopSubject` 는 삭제됐고, 대체 타입인 `AiSubject` 는 같은 describe 블록 안에만 존재한다.

#### 3. API endpoint 충돌

이번 diff 는 테스트 파일만 변경하며, API endpoint 정의(controller/route)를 건드리지 않음. 충돌 없음.

#### 4. 이벤트/메시지명 충돌

이번 diff 에서 도입·제거되는 이벤트명 없음. 기존에 사용되는 `execution.waiting_for_input`, `execution.completed` 등은 변경 없이 그대로 검증 대상으로 참조된다. 충돌 없음.

#### 5. 환경변수·설정키 충돌

새 ENV var 또는 config key 없음. 충돌 없음.

#### 6. 파일 경로 충돌

이번 diff 에서 신규 파일은 없음. 기존에 추가된 `shared/execution-resume/resume-call-stack.types.ts` 와 `shared/execution-resume/park-release-signal.ts` 는 이번 diff 이전에 이미 존재하며, 테스트 파일이 import 를 추가하는 것이므로 경로 충돌 없음.

---

#### 7. 주요 신규 식별자 단위 검증

| 신규 식별자 | 파일 스코프 | 기존 사용처 충돌 여부 |
|---|---|---|
| `CALL_STACK_SCHEMA_VERSION` (import 추가) | test import | `resume-call-stack.types.ts:48` 에 정의, `execution-engine.service.ts:125` 에 이미 import — 동일 상수 재사용. 충돌 없음 |
| `ParkReleaseSignal` (import 추가) | test import | `park-release-signal.ts:19` 에 정의, `execution-engine.service.ts:123`, `workflow.handler.ts:19` 에 이미 import — 동일 클래스 재사용. 충돌 없음 |
| `makeCompletionGuard` | test-local 함수 | `makeDeadlockGuard` 대체. 동 파일 동일 describe block 에서만 사용. 코드베이스에 다른 `makeCompletionGuard` 없음. 충돌 없음 |
| `driveResumeTurn` | test-local helper | `describe('W5')` 스코프 한정. 생산 코드에 `driveResumeTurn` 없음. 충돌 없음 |
| `rehydrateSpy` | test 변수 | 여러 `it` 블록 내 로컬 변수. 스코프 충돌 없음 |
| `driveSubject` / `rfcSubject` / `ctxSubject` | test-local 헬퍼 | 동 파일 각 describe block 내 한정. 생산 코드에 없음. 충돌 없음 |
| `DriveSubject.driveCallStackResume` | test 타입 시그니처 | 생산 코드 `execution-engine.service.ts:2064` 에 `private async driveCallStackResume` 로 정의. 타입이 일치하며 충돌 없음 |
| `DriveSubject.driveResumeFrame` | test 타입 시그니처 | 생산 코드 `execution-engine.service.ts:2214` 에 `private async driveResumeFrame` 로 정의. 충돌 없음 |
| `DriveSubject.injectInvokerOutput` | test 타입 시그니처 | 생산 코드 `execution-engine.service.ts:2385` 에 `private injectInvokerOutput` 로 정의. 충돌 없음 |
| `DriveSubject.finalizeRehydrationCleanup` | test 타입 시그니처 | 생산 코드 `execution-engine.service.ts:2470` 에 `private finalizeRehydrationCleanup` 로 정의. 충돌 없음 |

---

## 요약

이번 diff 는 `execution-engine.service.spec.ts` 의 테스트 코드를 exec-park D6 full B3 아키텍처 기준으로 전면 재작성하는 작업이다. 새로 도입된 식별자는 (1) 기존 생산 코드에 이미 정의된 상수·클래스의 import 추가(`CALL_STACK_SCHEMA_VERSION`, `ParkReleaseSignal`), (2) 테스트 파일 내 스코프 한정 타입 별칭(`AiSubject`, `DriveSubject`, `ResumeFromCpSubject`)과 헬퍼 함수(`makeCompletionGuard`, `driveResumeTurn`, `driveSubject`, `rfcSubject`)로만 구성된다. 이들 중 어느 것도 기존 코드베이스나 spec 에서 다른 의미로 사용 중인 이름과 겹치지 않는다. 제거된 식별자(`getPendings`, `stubWaitForX`, `makeDeadlockGuard`, `LoopSubject`, `pendingContinuations` 직접 접근)는 생산 코드에서도 이미 제거·주석화됐으며, 남아 있는 참조는 역사적 주석 맥락뿐이다. 파일 경로·API endpoint·이벤트명·환경변수 등 다른 카테고리에서의 신규 도입은 없다.

## 위험도

NONE
