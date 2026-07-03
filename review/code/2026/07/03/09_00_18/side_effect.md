# 부작용(Side Effect) Review

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (프로덕션 로직 변경)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (unit 테스트 추가)
- `codebase/backend/test/execution-park-resume.e2e-spec.ts` (e2e 테스트 추가)
- `plan/in-progress/refactor-06-c2-followups.md` (plan 문서, 부작용 무관)

commit `762a56078` — C-2(#791)의 ai-review 비차단 후속 4건(W2/W3/W5/W6). 매직스트링/클로저 플래그를 커스텀 에러클래스+instanceof 로 교체, segmentStartMs 기록 로직을 공유 헬퍼로 추출, 테스트 2건 추가.

### 발견사항

- **[INFO]** private 헬퍼 `recordRunningSegmentStart` 신설은 시그니처/인터페이스 영향 없음
  - 위치: `execution-engine.service.ts` L6886-6893 (신설), L899(claimResumeEntry 호출부), L6919(updateExecutionStatus 호출부)
  - 상세: `this.segmentStartMs.set(executionId, Date.now())` 를 직접 호출하던 두 지점(`claimResumeEntry`, `updateExecutionStatus`)을 `private recordRunningSegmentStart(executionId: string): void` 로 추출. 순수 리팩터링 — 동작 동일(`Map.set` 호출 시점·인자 불변), private 이므로 외부 호출자 영향 없음. 클래스 내부 상태(`segmentStartMs` 인스턴스 필드)에 대한 "의도한" 쓰기이며 새로운 부작용은 아니다.
  - 제안: 없음.

- **[INFO]** `ResumeClaimExecTerminalError` 신설 클래스 — 예외 기반 제어흐름의 catch 판별 방식 변경
  - 위치: `execution-engine.service.ts` L279-289(클래스 정의), L881-923(`claimResumeEntry` 내부)
  - 상세: 기존은 클로저 변수 `execMismatch: boolean` 을 트랜잭션 콜백 내부에서 세팅하고 `.catch()` 블록에서 그 변수를 참조해 discard(false) vs 전파(throw)를 판별했다. 신규는 `throw new ResumeClaimExecTerminalError()` → `catch((err) => err instanceof ResumeClaimExecTerminalError ? false : throw err)` 로 판별 로직을 에러 타입 자체로 옮겼다. 동작 동등성: 두 방식 모두 "Execution 짝 전이 affected=0" 케이스에서만 discard(false) 반환하고 그 외 DB 에러는 그대로 전파(rethrow)한다. 클로저 변수 방식은 만약 트랜잭션 콜백이 다른 이유로 에러를 던져도 `execMismatch` 가 여전히 `false` 로 남아있으면 정상적으로 rethrow 되므로 기존 로직도 안전했다 — 신규 방식이 더 명시적일 뿐 side effect 관점의 위험 변화는 없음.
  - 제안: 없음. (가독성 개선 확인)

- **[INFO]** 신규 unit 테스트(W2) 의 내부 메서드 monkey-patch/복원 패턴
  - 위치: `execution-engine.service.spec.ts` L40-124 (`claim 후 Execution=RUNNING → 재개 sentinel 전이 skip`)
  - 상세: 테스트가 `svcAny.loadAndBuildGraph`, `svcAny.buildRetryReentryState`, `orchAny.processAiResumeTurn`, `svcAny.runNodeDispatchLoop`, `svcAny.updateExecutionStatus` 를 직접 재할당(jest.fn 오버라이드)하고 `finally` 블록에서 `orig.*` 로 복원한다. `finally` 가 `await flushPromises()` 이후에 원복을 수행하므로 정상 경로에서는 다음 테스트로 상태가 새어나가지 않는다. 다만 `Promise.race([...], guard)` 에서 `guard`(타임아웃)가 먼저 resolve 되는 경우에도 `finally` 는 여전히 실행되므로 복원 자체는 보장된다 — 단, race 로 인해 `rehydrateAndResume` 내부의 미완료 비동기 작업이 `finally` 이후에도 지연 실행되며 이미 복원된 원본 메서드가 아닌 이전 상태를 참조할 가능성은 이론상 존재하나, 이는 이 테스트 파일 전반에 이미 존재하는 기존 패턴(`makeCompletionGuard` 관용구)과 동일하므로 이번 diff 특유의 신규 위험은 아니다.
  - 제안: 특별한 조치 불필요. 참고 사항으로만 기록.

- **[INFO]** e2e 테스트(W3) 의 실 네트워크/DB 호출 — 의도된 통합 검증
  - 위치: `execution-park-resume.e2e-spec.ts` L2455-2537
  - 상세: `Promise.all([mkContinue('a'), mkContinue('b')])` 로 동일 execution 에 대해 실제 HTTP POST 2건을 병렬 발행하고, 이후 실제 Postgres row 를 직접 쿼리(`db.query`)해 이중 실행 여부를 검증한다. 이는 e2e 테스트의 정상적인 책임 범위(BASE_URL 대상 실 서버·실 DB) 이며 이번 리뷰 대상 코드(claimResumeEntry) 의 동시성 보장을 검증하는 목적에 부합한다. 신규 외부 서비스 호출이나 프로덕션 코드 경로 밖의 부작용은 없음.
  - 제안: 없음.

- **[INFO]** 공개 API/함수 시그니처 변경 없음
  - 위치: 전체 diff
  - 상세: `claimResumeEntry`, `updateExecutionStatus`, `driveResumeAwaited` 등 기존 public/protected 메서드의 시그니처는 변경되지 않았다. 새로 추가된 `recordRunningSegmentStart` 와 `ResumeClaimExecTerminalError` 는 모두 파일 내부 private/비공개 스코프이므로 다른 모듈·호출자에 영향이 없다.
  - 제안: 없음.

- **[INFO]** 환경 변수 / 네트워크 호출 / 이벤트 발행 변경 없음
  - 위치: 전체 diff
  - 상세: 이번 diff 는 기존 `segmentStartMs.set()` 호출(순수 in-memory Map 갱신, §8 PR2a 기존 설계)과 기존 DB 트랜잭션(claimResumeEntry 의 `manager.createQueryBuilder().update(Execution)...execute()`)의 판별 로직만 재구성했을 뿐, 새로운 env var 읽기/쓰기, 외부 API 호출, WebSocket/이벤트 emit 을 도입하지 않았다.
  - 제안: 없음.

### 요약

이번 변경은 C-2(#791) 본체가 defer 한 순수 리팩터링/커버리지 보강 4건으로, 프로덕션 코드에서는 (1) 클로저 플래그 기반 예외 판별을 커스텀 에러클래스+`instanceof` 판별로 교체하고 (2) `segmentStartMs.set` 호출을 `recordRunningSegmentStart` 사설 헬퍼로 추출해 두 호출부(`claimResumeEntry`/`updateExecutionStatus`)가 공유하도록 했다. 두 변경 모두 동작 동등성이 유지되며 기존 인스턴스 필드(`segmentStartMs`) 갱신 시점·값에 변화가 없고, 새로운 전역 상태·환경 변수·네트워크 호출·이벤트 발행이 도입되지 않았다. 신설 클래스·헬퍼는 모두 파일 내부 스코프(비공개)로 기존 공개 API·함수 시그니처에 영향이 없다. 추가된 unit/e2e 테스트는 각각 기존 관용구(monkey-patch+finally 복원, 실 DB 검증)를 따르며 테스트 격리를 해치지 않는다.

### 위험도

NONE
