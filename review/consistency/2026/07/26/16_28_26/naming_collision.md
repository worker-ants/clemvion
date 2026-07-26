# 신규 식별자 충돌 검토 — linear-cancel-mechanism

## 조사 방법 메모

`_prompts/naming_collision.md` 는 `spec/conventions/` 전량 덤프이나 컨텍스트 예산 초과로
**`spec/conventions/node-cancellation.md` 포함 256개 파일이 프롬프트에서 생략**돼 있었다
(payload 상 "⚠️ 컨텍스트 예산 초과로 생략된 파일 256개" 목록에 명시). 또한 diff-base
`origin/main` 대비 실제 코드 변경(diff)이 payload 에 포함돼 있지 않아, 프롬프트 지시대로
**워킹트리를 절대경로로 직접 조사**했다 — `git -C
/Volumes/project/private/clemvion/.claude/worktrees/linear-cancel-mechanism-28dea4 diff
origin/main..HEAD`, 및 `spec/conventions/node-cancellation.md`·관련 plan 문서를 절대경로로
Read. 실제 diff는 `spec/` 을 전혀 건드리지 않았고(코드 diff는 `codebase/backend/src/modules/
execution-engine/*`, `codebase/backend/src/nodes/flow/workflow/*` 및 `plan/in-progress/*`
2개 문서), "중점" 6개 식별자는 전부 코드 신규 식별자다.

## 발견사항

- **[WARNING]** `markNodeCancelled` (신규) 가 기존 `markExecutionCancelled` 와 이름·클래스·도메인이 겹쳐 혼동 유발
  - target 신규 식별자: `markNodeCancelled` (`codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4566`, 신규 private 메서드 — 노드 단위 취소 종결 공통 헬퍼)
  - 기존 사용처: 같은 파일·같은 클래스(`ExecutionEngineService`) 안에 **이미** `markExecutionCancelled(executionId, code)` 가 존재 (`execution-engine.service.ts:2676`, origin/main 부터 존재, 본 diff 에서 시그니처·바디 무변경 — diff 는 이 메서드를 컨텍스트로만 보여준다). 두 메서드는 `execution-engine.service.spec.ts` 안에서도 인접해 등장한다(예: 5061행 근처 "선형 경로 외부 cancel 전파" describe 와 13974행 "markExecutionCancelled: affected=0…" 이 같은 파일에서 다수 참조됨).
  - 상세: 이름이 `mark<X>Cancelled` 패턴을 공유해 같은 개념의 variant 처럼 보이지만 실제 의미·레벨이 다르다.
    - `markExecutionCancelled(executionId, code: 'RESUME_CHECKPOINT_MISSING' | 'RESUME_FAILED' | 'RESUME_INCOMPATIBLE_STATE')` — **Execution 레벨**, rehydration/재개 실패로 인한 **system 발(發)** 취소. `createQueryBuilder().update(Execution)` 로 직접 guarded UPDATE, `cancelledBy: 'system'` 로 emit.
    - `markNodeCancelled(nodeExecution, node, context, executionId, errorEnvelope?)` (신규) — **NodeExecution 레벨**, 호출 원인 불문(§2.3 dispatch 가드가 관측한 사용자 Stop 이든, `isAbortError` 든) 공통 종결. `nodeExecutionRepository.save` + `emitNode(NODE_CANCELLED)`.
    - 파라미터 시그니처·리턴 대상·트리거 원인이 완전히 다름에도 접두 동사+목적어 패턴("mark" + "…Cancelled")이 같아, 향후 유지보수자가 grep/자동완성으로 둘을 혼동하거나 "이미 있는 걸 왜 또 만들었나"로 오독할 위험이 있다.
    - 부가로, 신규 `markNodeCancelled` 의 JSDoc 자신도 "Execution 레벨의 같은 중복을 `finalizeCancelledExecution` 으로 추출한 선례(W12)와 동일한 처리" 라고 명시한다 — 즉 설계 의도상 `markNodeCancelled` 는 **`markExecutionCancelled` 의 variant 가 아니라 `finalizeCancelledExecution` 의 node-레벨 대응물**이다. 그런데 동사를 `finalize` 가 아닌 `mark` 로 골라, 정작 이름으로는 의도와 다른(기존 `markExecutionCancelled` 와의) 근접성을 만들었다.
  - 제안: 다음 중 하나로 명확화 권장 (강한 차단 사유는 아니므로 WARNING) — (a) `finalizeCancelledNode` 로 개명해 `finalizeCancelledExecution` 과 동사를 맞추고 `mark*` 네임스페이스를 `markExecutionCancelled`/`markNodeExecutionFailed` (기존, 특정 에러코드 기반 직접 UPDATE 계열) 전용으로 남긴다. (b) 개명이 부담스러우면 최소한 JSDoc 첫 줄에 "`markExecutionCancelled` 와 무관 — Execution 이 아닌 NodeExecution 대상" 한 문장을 명시해 grep 시 혼동을 줄인다.

- **[INFO]** `finalizeCancelledExecution` 은 기존 명명 관례(`finalize<Status>Execution`)에 정확히 부합 — 충돌 없음
  - target 신규 식별자: `finalizeCancelledExecution(savedExecution, logContext)` (`execution-engine.service.ts:4617`)
  - 기존 사용처: 같은 클래스에 이미 `finalizeFailedExecution`(`:4642`, 본 diff 로 미변경·pre-existing), `finalizeResumedExecutionOutcome`(`:2640`, pre-existing), `finalizeRehydrationCleanup`(`:2670`, pre-existing) 이 있어 "`finalize<Status/Concern>Execution` = 여러 호출부가 공유하는 종결 헬퍼" 라는 관례가 이미 확립돼 있다.
  - 상세: 이름 충돌이 아니라 **관례 부합 확인** — 신규 식별자가 기존 패턴을 정확히 따르는 좋은 사례라 별도 조치 불요. `markNodeCancelled` 항목과의 대비를 위해 참고로 기록.

- **[INFO]** `assertExecutionNotCancelled` 는 기존 `assert*` 가드 관례와 일치 — 충돌 없음
  - target 신규 식별자: `assertExecutionNotCancelled(executionId, opts?)` (`execution-engine.service.ts:7974`)
  - 기존 사용처: 같은 클래스에 이미 `assertActiveTimeWithinLimit`(`:7917`, pre-existing, §8 active-running 누적 타임아웃 가드), `assertSameWorkspace`(`:666`), `assertFormSubmissionValid`(`:4848`), `assertCommandMatchesWaitingSurface`(`:5487`), `assertNoContainerCycle`(`:6680`) 등 `assert<조건>` 명명이 이미 확립돼 있고, dispatch loop 에서 `assertActiveTimeWithinLimit` 바로 다음 줄에 나란히 호출된다(`:1662-1666` 등 3곳). 의미·이름 모두 자연스럽게 구분되며 겹치는 기존 식별자 없음.

- **[INFO]** `containerCancelCheckedAtMs` / `CONTAINER_CANCEL_CHECK_THROTTLE_MS` — 기존 Map/상수 명명 패턴과 일치, 충돌 없음
  - target 신규 식별자: `private readonly containerCancelCheckedAtMs = new Map<string, number>()`(`:553` 부근) / `private static readonly CONTAINER_CANCEL_CHECK_THROTTLE_MS = 250`(`:553`)
  - 기존 사용처: 같은 클래스의 `segmentStartMs`(Map<string, number>, pre-existing, 바로 위에 선언)와 동일한 "`<domain>Map` = executionId 키 in-memory 상태" 패턴, `STUCK_RECOVERY_STALE_MS`/`RECOVERY_LOCK_TTL_SECONDS`/`MAX_MESSAGE_LENGTH` 등과 동일한 `private static readonly SCREAMING_SNAKE_CASE` 상수 패턴. 환경변수(`process.env.*`)로 노출되지 않는 순수 in-class 상수라 ENV/설정키 충돌 대상도 아님(레포 전체에서 `.env`류 파일에 동일 키 없음 확인).

- **[INFO]** `ExecutionCancelledError` 생성자의 선택 `message` 인자 — 클래스 자체는 기존, 시그니처만 확장. 충돌 없음
  - target 신규 식별자: `constructor(message = 'Execution cancelled while waiting for input')` (`workflow-errors.ts`)
  - 기존 사용처: `ExecutionCancelledError` 클래스 자체는 origin/main 에 이미 존재(park 대기 취소 sentinel, `retry-turn.service.ts`/`containers/*.ts`/`workflow.handler.ts`/`plan/complete/c1-engine-split.md` 등 다수가 이미 `instanceof ExecutionCancelledError` 로 분류). 이번 diff 는 무인자 생성자를 "선택적 `message` + 디폴트값"으로 넓힌 것뿐이라, 기존 `new ExecutionCancelledError()` 호출부는 전부 그대로 컴파일·동작한다(기존 시그니처가 인자를 받지 않았으므로 이전 호출부가 다른 의미의 인자를 넘기고 있었을 가능성 자체가 없다). `assertExecutionNotCancelled` 가 새로 넘기는 `` `Execution ${executionId} cancelled externally` `` 문구도 기존 park 문구("Execution cancelled while waiting for input")와 텍스트가 달라 로그/에러 메시지 레벨에서도 충돌 없음. 유일한 주의점(이미 diff 주석에 자기 설명돼 있음): 이 메시지에 `executionId` 가 포함되므로 client 노출 금지 — `markNodeCancelled` 호출부가 `errorEnvelope` 없이 호출해 이를 지키고 있음을 diff 상 확인(별도 위험 아님, naming 충돌도 아님 — 참고 기록).

- **[INFO — 참고, naming 충돌은 아님]** 코드 주석이 인용하는 `spec/conventions/node-cancellation.md §2.3` 이 현재 spec 서술과 다른 메커니즘을 가리킴 (이미 개발자 자신이 인지·위임 완료)
  - target 신규 식별자: 해당 없음(식별자 충돌 아님) — 다만 "요구사항/섹션 참조" 정합성 관점에서 기록.
  - 기존 사용처: `spec/conventions/node-cancellation.md` §2.3 (`abortSignal` 생산자 목록: ParallelExecutor·워크플로 시간 한도·사용자 cancel 버튼·graceful shutdown) — 이 PR 의 코드 주석들은 "§2.3" 을 "노드 경계 Execution-cancel 재확인 가드" 라는, 문서에 아직 없는 새 메커니즘을 가리키는 라벨로도 재사용한다.
  - 상세: 실제로는 naming collision 이 아니라 spec-doc 미반영(drift) 이며, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 의 "추가 위임 (2026-07-26 #6)" 절에 developer 가 이미 project-planner 위임안(§2.3 신규 bullet 추가·§5.1 단락 추가·§6 신규 행 추가)을 남겨뒀다. 제안된 신규 bullet 텍스트는 기존 §2.3 의 4개 항목과 이름이 겹치지 않아 반영돼도 식별자 충돌은 생기지 않는다.
  - 제안: 조치 불요(이미 추적 중). 참고로만 남김 — 본 리뷰의 "요구사항 ID 충돌" 관점과 인접해 언급했으나 실질은 spec-doc 커버리지 문제이며 다른 검토 관점(consistency-checker 의 spec-alignment/coverage 축)의 소관이다.

## 요약

이번 구현이 도입한 6개 신규 식별자(`assertExecutionNotCancelled`, `markNodeCancelled`,
`finalizeCancelledExecution`, `containerCancelCheckedAtMs`,
`CONTAINER_CANCEL_CHECK_THROTTLE_MS`, `ExecutionCancelledError` 생성자의 선택 `message`
인자) 중 5개는 기존 사용처와 진짜 충돌이 없고 오히려 `assert*`/`finalize*`/`<domain>Map`/
`SCREAMING_SNAKE_CASE` 상수 등 이 클래스의 기존 명명 관례를 그대로 따른다. 유일한 주목할
지점은 `markNodeCancelled` 가 같은 클래스·같은 도메인(취소 종결)에 이미 존재하는
`markExecutionCancelled` 와 이름 패턴이 겹쳐 실질적으로는 서로 다른 레벨(Node vs Execution)·
다른 트리거(임의 원인 vs 특정 재개-실패 코드)를 가리키는데도 표면상 variant 로 오독될
소지가 있다는 것이다 — 더구나 신규 코드 자신의 JSDoc 은 이를 `finalizeCancelledExecution` 의
node-레벨 대응물이라 설명해, 실제 설계 의도상 더 가까운 이웃은 `markExecutionCancelled` 가
아니라 `finalizeCancelledExecution` 임을 시사한다. 이는 개명 없이도 안전하게 병존 가능한
수준(빌드/런타임 영향 없음)이라 CRITICAL 이 아닌 WARNING 으로 분류했다. `spec/` 파일은 이번
diff 에서 전혀 변경되지 않았고, 관련 spec-doc drift(§2.3 서술 갱신 필요)는 developer 가 이미
project-planner 에게 명시적으로 위임해둔 상태라 별도 신규 발견으로 보고하지 않았다.

## 위험도

LOW
