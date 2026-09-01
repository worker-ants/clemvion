# 요구사항(Requirement) 리뷰

## 범위 요약

C-4 처분 라운드 — `ie-resume-turn-boundary-cancel.md`(8R) 잔여 2건 + `retry-turn-terminal-guard.md`
잔여 6건을 코드/테스트로 닫는 변경.

1. `ai-turn-orchestrator.service.ts` — `assertLinkedTransitionApplied` 의 `markNodeCancelled` 호출을
   `try/catch` 로 감싸, 마킹 실패(reject)가 취소 분류(`ExecutionCancelledError`)를 삼키지 않게 한다.
2. `execution-engine.service.ts` — `executeSync` timeout catch 가 `updateExecutionStatus` 의 반환값
   (`persisted`)을 소비해, 동시 cancel 선점 시 형제 경로(`failFirstSegmentSetup`)와 동일하게 warn 로그를 남긴다.
3. `retry-turn.service.ts` — (a) `markSpawnedRowFailed` 헬퍼로 중복 4단계(로그·status·error·finishedAt+save)
   추출, (b) `prepareSuccessTermination` 헬퍼로 성공 종결 시 `execution.error` 를 명시적으로 비움(이전
   실패 시도의 `error` 잔류 방지), (c) `finalizeGuarded` JSDoc 에 in-place mutation 계약 문서화.
4. `execution.entity.ts` — `error: Record<string, unknown>` → `Record<string, unknown> | null` (DB
   `nullable: true` 와 타입 정합).
5. 테스트 6건 신규(`ai-turn-orchestrator.service.spec.ts` 1건, `retry-turn.service.spec.ts` 5건) +
   query-builder mock 계측(`consumeSetArgs`/`consumeAndWhereSql`) 추가.
6. `plan/in-progress/*.md` 2건 — worktree 필드 갱신 + 체크리스트 반영(C-4 처분 근거).

## 검증 방법

- `npx jest retry-turn.service.spec.ts ai-turn-orchestrator.service.spec.ts` → **139/139 PASS**.
- `npx tsc --noEmit`(backend 전체) → 199 에러, 전부 `*.spec.ts`(carousel/chart/table 등, 이 diff 와
  무관) — 변경된 4개 소스 파일(`retry-turn.service.ts`/`ai-turn-orchestrator.service.ts`/
  `execution-engine.service.ts`/`execution.entity.ts`) 관련 에러 0건.
- **뮤테이션 검증 2건 실측** (저장소 파일을 scratch 사본으로 원복하며 진행, 완료 후 `git status --short`
  로 repo 가 review 산출물 외 clean 함을 확인):
  1. `assertLinkedTransitionApplied` 의 `catch (err) { throw err; }` 로 마킹 실패를 그대로 재-throw 하도록
     되돌리면 → 신규 테스트(`ai-turn-orchestrator.service.spec.ts` "markNodeCancelled 가 실패해도…")가
     **RED**: `Expected constructor: ExecutionCancelledError / Received constructor: Error`. 처방이
     load-bearing 함을 확인.
  2. `retryLastTurn` 의 `jsonb_exists(...)` 가드를 `1=1` 로 무력화하면 → 신규 테스트("원자 consume 이
     jsonb_exists 가드와…")가 **RED**: `Expected: "jsonb_exists(output_data, '_retryState')" / Received: "1=1"`.
     레이스 가드가 실제로 검증 대상임을 확인.

## 발견사항

- **[WARNING]** `completeRetryExecution` 의 JSDoc 이 새 헬퍼 위로 밀려 orphan 됐다 — 문서와 대상이 어긋난다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:711-782` (프롬프트 게이트
    729-781 구간에 해당하는 unified diff hunk `@@ -727,13 +729,56 @@`).
  - 상세: 이 diff 는 `completeRetryExecution` 직전에 새 헬퍼 `markSpawnedRowFailed`/`prepareSuccessTermination`
    두 개를 끼워 넣었다. 그런데 원래 `completeRetryExecution` 를 설명하던 JSDoc 블록(711~731줄, "retry
    성공 종결 시 Execution 을 직접 COMPLETED 로 마감하는 fallback…", `@internal 이 메서드는
    resumeGraphAfterRetry 의 defensive fallback 에서만 호출된다") 은 **그대로 원래 자리(새로 삽입된
    `markSpawnedRowFailed` 바로 위)에 남았다** — 즉 지금은 `markSpawnedRowFailed`(FAILED 마킹 헬퍼)를
    설명하는 것처럼 보이는 자리에 "COMPLETED 마감 fallback" 문서가 붙어 있다. 반대로 실제
    `completeRetryExecution` 선언(777줄)은 그 사이에 삽입된 `markSpawnedRowFailed`(732-755)/
    `prepareSuccessTermination`(757-769) 두 블록에 가로막혀 **자신의 JSDoc 을 완전히 잃었다** —
    "이 메서드는 defensive fallback 에서만 호출돼야 한다"는 호출 제약·호출 조건 서술이 이제 코드상
    어디에도 `completeRetryExecution` 와 연결되지 않는다. `git blame` 확인 결과 이 orphan 은 이번
    커밋(`59dd12869`)이 도입했다(원래 JSDoc 은 0c275dd7f0/771801e3ef 가 작성해 `completeRetryExecution`
    바로 위에 있었음).
  - 영향: 컴파일/런타임 동작에는 영향 없음(순수 문서). 그러나 다음 유지보수자가 `markSpawnedRowFailed`
    를 읽을 때 "resumeGraphAfterRetry 의 defensive fallback 에서만 호출" 이라는 잘못된 호출 제약을
    읽거나(`markSpawnedRowFailed` 는 실제로 `applyRetryLastTurn` 두 not-found 분기에서 호출됨),
    `completeRetryExecution` 자체의 호출 조건 문서를 놓칠 수 있다.
  - 제안: 711-731 JSDoc 블록을 `completeRetryExecution` 선언(현재 777줄) 바로 위로 이동.

- **[INFO]** spec fidelity — 이번 diff 는 관측성/방어 로직 보강(마킹 실패 시 취소 분류 유지,
  `persisted` 반환값 로깅, 성공 종결 시 `error` 클리어)이며 외부 계약(에러 코드·필드·상태 전이 규칙)을
  바꾸지 않는다. `spec/5-system/4-execution-engine.md`, `spec/conventions/node-cancellation.md` 에서
  `markNodeCancelled`/`assertLinkedTransitionApplied`/`prepareSuccessTermination` 관련 행위 명세를
  검색했으나 이 세부 구현(마킹 실패 시 catch 처리, guarded UPDATE 반환값 로깅)을 규정하는 본문은 없다
  (회색지대, spec 이 침묵). `plan_impact` 로 `spec/` 을 건드리지 않은 것과 일치 — SPEC-DRIFT 아님.

- **[INFO]** `execution.entity.ts` 의 `error` 필드 타입을 `Record<string, unknown> | null` 로 넓힌 것은
  DB 컬럼 정의(`@Column({ type: 'jsonb', nullable: true })`, entity.ts:80-81)와의 기존 불일치를 바로잡는
  정정이다. `prepareSuccessTermination` 이 `execution.error = null` 을 대입하는 신규 코드 경로가 이
  수정 없이는 타입에러였을 것 — 타당한 동반 수정. `toTerminalErrorPayload(err: unknown)` 등 소비처는
  이미 `null`/`undefined` 를 명시적으로 처리하므로 하위 호환 문제 없음(실측: tsc 관련 소스 파일 에러 0).

## 요약

`markNodeCancelled` 실패 시 취소 분류 유지, `updateExecutionStatus` 반환값 로깅, 성공 종결 시 옛
`error` 클리어, `error` 필드 nullable 타입 정정, 중복 FAILED-마킹 로직 헬퍼 추출까지 5개 처방 모두
의도대로 구현되어 있고, 신규 테스트 6건은 실제 뮤테이션(마킹-실패 catch 제거, `jsonb_exists` 가드
무력화)에 대해 RED 로 반응함을 직접 실측 확인했다(vacuous 아님). `npx tsc --noEmit` 기준 변경된 4개
소스 파일에 신규 컴파일 에러 없음, 관련 스펙 문서에 이 구현 세부를 규정하는 본문이 없어 spec fidelity
상 불일치도 없다. 유일한 흠은 `retry-turn.service.ts` 에서 헬퍼 2개를 끼워 넣으며 기존
`completeRetryExecution` JSDoc 을 제자리에 남겨 `markSpawnedRowFailed` 위로 orphan 시킨 문서 배치
실수로, 기능에는 영향 없으나 다음 리더를 오도할 수 있어 정정을 권고한다.

## 위험도

LOW
