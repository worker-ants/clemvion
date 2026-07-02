### 발견사항

- **[WARNING]** `claimResumeEntry` — 예외를 제어 흐름으로 쓰는 패턴(throw-to-abort-transaction)이 국소 매직 문자열에 의존
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:862-920` (`claimResumeEntry`)
  - 상세: 짝 전이(Execution UPDATE) 가 `affected=0`일 때 `execMismatch = true` 플래그를 세팅하고 `throw new Error('__resume_claim_exec_terminal__')` 로 트랜잭션을 롤백시킨 뒤, 바깥 `.catch((err) => execMismatch ? false : throw err)` 에서 플래그로 분기한다. 문자열 자체는 어디서도 매칭하지 않아 사실상 죽은 값이고, 오직 클로저 변수 `execMismatch` 로만 판별한다 — 즉 에러 메시지가 불필요한 매직 스트링이면서 동시에 "왜 throw 인지"를 코드만 봐서는 바로 알기 어렵다(트랜잭션 콜백에서 `false`를 그냥 return 하면 안 되는 이유 — TypeORM 트랜잭션은 콜백 반환값과 무관하게 항상 commit 하므로 abort 하려면 반드시 throw 가 필요하다 — 를 아는 사람만 이해). 함수 자체도 하나의 메서드 안에서 "legacy sentinel 우회 → 트랜잭션 시작 → 2단계 조건부 UPDATE → 에러 기반 롤백 판별 → catch 흡수 → 부수효과(segmentStartMs) 기록" 까지 5~6개의 서로 다른 관심사를 순차 처리해 순환 복잡도가 이 파일의 다른 메서드 대비 높은 편이다.
  - 제안: throw 사유를 주석이 아니라 이름으로 드러내는 편이 좋다. 예컨대 로컬 커스텀 에러 클래스(`class ResumeClaimExecTerminalError extends Error {}`) 를 만들어 `catch (err) { if (err instanceof ResumeClaimExecTerminalError) return false; throw err; }` 로 바꾸면 매직 스트링 매칭 없이 타입으로 분기 의도가 드러난다. 또한 "node claim" 과 "exec 짝 전이" 두 단계를 `claimNodeExecution(manager, ...)` / `pairTransitionExecution(manager, ...)` 같은 사적 헬퍼로 쪼개면 트랜잭션 콜백 자체의 길이와 중첩이 줄어든다.

- **[INFO]** `savedExecution.status !== ExecutionStatus.RUNNING` 중복 가드가 두 곳에 반복
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1882-1888` (`driveResumeAwaited` 추정 위치)와 `:2061-2069` (`processAiResumeTurn` 추정 위치) — 동일한 `if (savedExecution.status !== ExecutionStatus.RUNNING) { await this.updateExecutionStatus(savedExecution, ExecutionStatus.RUNNING); }` 블록이 두 메서드에 거의 그대로 반복.
  - 상세: 두 위치 모두 "claim 이 이미 페어링 전이시켰으면 중복 전이 skip" 이라는 동일한 의도의 조건-분기·주석을 복제했다. 향후 claim 조건이 바뀌면(예: 세 번째 상태를 추가로 허용) 두 곳을 함께 고쳐야 하는 산탄 수정(shotgun surgery) 위험이 있다.
  - 제안: `private async ensureRunningForResume(savedExecution): Promise<void>` 같은 작은 헬퍼로 추출해 두 호출부가 공유하게 하면 향후 조건 변경 시 단일 지점 수정으로 충분해진다. 다만 이번 diff 범위(06 C-2) 만 보면 즉각 교정이 필요할 정도는 아니며, 기존 코드베이스도 이 파일 안에서 유사한 국소 복제를 종종 허용해온 스타일(예: PR2a 세그먼트 관련 보정 주석)과 일관되므로 등급은 INFO 로 제한한다.

- **[INFO]** `recoverStuckExecutions` 함수가 이번 변경으로 책임이 하나 더 늘어남(Execution 회수 → 자식 NodeExecution cascade 마감)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2602-2653` 부근 (`recoverStuckExecutions`)
  - 상세: 기존에도 "stale Execution 회수 + lock 해제" 를 담당하던 메서드에, 이번 변경이 "`raw` 에서 회수된 id 추출 → 자식 NodeExecution 을 RUNNING→FAILED 로 cascade" 로직을 인라인으로 추가했다. 로직 자체는 명확하고 주석도 충실하나, 메서드가 갈수록 여러 책임(락 획득/해제, 원본 회수, cascade 정리)을 계층적으로 흡수하는 추세라 향후 세 번째 cascade 요구가 붙으면 길이가 더 늘어날 소지가 있다.
  - 제안: 당장 분리를 요구할 정도는 아니지만, cascade 블록(`recoveredIds` 계산 + child UPDATE)을 `private async failOrphanedRunningNodeExecutions(executionIds: string[], finishedAt: Date): Promise<void>` 로 추출해두면 메서드 하나의 인지 부담이 줄고 단위 테스트도 더 국소적으로 작성할 수 있다.

- **[INFO]** 리네이밍(`isNodeExecutionWaiting` → `claimResumeEntry`)이 시그니처·의미 변화를 정확히 반영해 네이밍 품질이 개선됨
  - 위치: `continuation-execution.processor.ts:74-83`, `execution-engine.service.ts:862`, 관련 spec 파일 전반
  - 상세: 기존 `isNodeExecutionWaiting(nodeExecutionId)` 은 단순 조회(boolean predicate)였으나, 새 `claimResumeEntry(executionId, nodeExecutionId)` 는 부수효과(DB UPDATE + segmentStartMs 기록)를 가진 명령형 동작으로 바뀌었다. 이름을 `is*` 술어에서 `claim*` 동사로 바꾼 것은 부수효과가 생긴 실제 동작과 정확히 일치해 가독성·정직성(honest naming) 면에서 긍정적이다. 테스트 파일들의 describe/it 문구도 옛 이름 잔존 없이 전부 갱신되어 일관성이 유지된다.
  - 제안: 없음(현행 유지 권장).

- **[INFO]** 원자 claim 도입 배경을 설명하는 JSDoc/인라인 주석이 매우 상세해 가독성에 실질적으로 기여
  - 위치: `execution-engine.service.ts:619-642`(claimResumeEntry JSDoc), `:756-771`(ai-turn-orchestrator.service.ts 유사), `continuation-execution.processor.ts:20-45`
  - 상세: §7.5/§1.1/06 C-2 참조와 "왜 이렇게 짜야 하는가"(크래시 시나리오, race 시나리오)를 코드 옆에 명시해, 이 저장소의 기존 관례(spec 참조 주석)를 그대로 따른다. 다만 주석 밀도가 매우 높아 일부 블록(예: `claimResumeEntry` JSDoc 20줄)은 실질적으로 spec 문서의 요약본에 가까워, 코드와 spec 두 곳을 유지보수해야 하는 이중 관리 부담이 존재한다. 이는 이 프로젝트가 SDD 방법론을 채택해 spec 참조 주석을 표준 관례로 삼고 있는 데서 기인하므로 이번 변경만의 문제는 아니다.
  - 제안: 없음(프로젝트 컨벤션에 따른 의도적 선택으로 판단, 등급 INFO에 그침).

- **[INFO]** 두 위치에서 `NodeExecutionStatus.WAITING_FOR_INPUT`/`RUNNING` 배열 리터럴이 반복
  - 위치: `execution-engine.service.ts` 재개 가능 상태 판정부(약 :963, :1015 부근의 `status !== WAITING_FOR_INPUT && status !== RUNNING`)와 `markNodeExecutionFailed` 의 `statuses: [WAITING_FOR_INPUT, RUNNING]` (약 :2500 부근), `recoverStuckExecutions` cascade 의 `running:` 단일값 비교.
  - 상세: "재개 가능 상태 집합" 이라는 동일 개념이 코드 여러 곳에서 `!==` 체인 또는 배열 리터럴로 각각 표현된다. 현재는 딱 2개 상태라 부담이 작지만, 향후 상태가 추가되면 여러 지점을 함께 고쳐야 한다.
  - 제안: `const RESUMABLE_NODE_STATUSES = [WAITING_FOR_INPUT, RUNNING] as const` 같은 모듈 상수로 통합하면 산탄 수정 위험을 낮출 수 있다. 다만 이번 diff 규모에서 필수 교정 사항은 아니다.

### 요약

이번 변경(06 C-2 — 재개 진입 DB 원자 claim)은 네이밍이 부수효과를 정직하게 반영하도록 개선되었고(`isNodeExecutionWaiting` → `claimResumeEntry`), spec 참조 주석이 "왜"를 충실히 설명해 이 코드베이스의 기존 관례와 일관된 가독성을 유지한다. 테스트도 claim 성공/실패/레이스/짝 불일치 등 핵심 시나리오를 촘촘히 커버해 리팩터링 안전망 역할을 한다. 다만 `claimResumeEntry` 내부의 throw-매직스트링 기반 트랜잭션 롤백 판별은 의도를 코드만으로 파악하기 어려운 지점이고, "claim 후 중복 RUNNING 전이 skip" 가드와 "재개 가능 상태 집합" 판정이 여러 지점에 국소 복제되어 향후 상태 추가 시 산탄 수정 위험이 있다. 모두 즉각적 차단 사유는 아니며 소규모 리팩터링으로 개선 가능한 수준이다.

### 위험도
LOW
