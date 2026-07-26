# 보안(Security) Review — linear-cancel-mechanism (5R, W19 `NODE_CANCELLED` 신규 emit 전용 검증)

## 스코프 메모

이번 라운드(`15_30_00`)의 프롬프트 diff 는 `review/code/2026/07/26/{13_47_42,14_45_30}/*`
(직전 두 라운드의 리뷰 산출물이 커밋된 파일)뿐이며, 실제 소스 diff 는 포함돼 있지 않다
(`git log --oneline -- execution-engine.service.ts` 확인 결과 최신 커밋은 `0f4047426`
"4R W19·W20" 로, 이번 라운드 diff 시점 이전에 이미 적용됨). 따라서 오케스트레이터 지시에 따라
프롬프트 diff 대신 `Read`/`Bash grep` 으로 현재 워크트리의 실제 소스를 직접 열어 W19 수정
(`executeNode` 의 `ExecutionCancelledError` 분기가 신규로 `NODE_CANCELLED` 를 WS 발행)만
집중 검증했다. C1~C5·W1~W18(및 4R 에서 이미 "안전" 판정된 W9/W15/W16 소비 지점 10곳)은
재론하지 않는다.

## 검증 대상

`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `executeNode`
catch 블록의 `ExecutionCancelledError` 분기(W19, 실제 파일 기준 5822-5845행) — park
분기(`ParkReleaseSignal`)와 대칭으로 `NodeExecution.status = CANCELLED` 마킹 후
`NodeEventType.NODE_CANCELLED` 를 신규로 WS emit 하도록 이번 diff 가 바꿨다.

## 발견사항

없음. 아래는 확인 절차와 근거다(신규 CRITICAL/WARNING 없음).

- **내부 message(executionId 포함) 미노출 — 확인됨**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5829`-`:5843`
    (`ExecutionCancelledError` 분기의 `emitNode(..., NodeEventType.NODE_CANCELLED, { ... })` 호출)
  - 상세: payload 필드는 `nodeExecutionId, parentNodeExecutionId, status, nodeType, nodeLabel,
    input, startedAt, finishedAt` 뿐이다 — `error` 필드 자체가 없다. 바로 위 `isAbortError`
    분기(`:5779`-`:5794`)는 `error: errorEnvelope`(`{ code, message: err.message }`)를 포함하는
    것과 대비된다. `nodeExecution.error` 필드도 이 분기에서 아예 대입되지 않는다(`nodeExecution.status`,
    `finishedAt`, `durationMs` 만 설정 후 `save()`). 즉 `ExecutionCancelledError` 의 생성자
    message(예: `Execution ${executionId} cancelled externally`, `execution-engine.service.ts:7984`
    부근 유일한 throw 지점)가 이 payload 어디에도 실리지 않는다.
  - 회귀 테스트로도 뒷받침됨: `execution-engine.service.spec.ts:5789`-`:5798`
    (`'Sub-Workflow(workflow) 노드에서 ExecutionCancelledError 가 발생하면 FAILED 로
    오분류하거나 NODE_FAILED 를 emit 하지 않는다 (W15)'` 테스트 내) —
    `JSON.stringify(cancelCall?.[3] ?? {}).not.toContain('cancelled externally')` 로 실제
    emit 된 payload 문자열 전체에 메시지 문구가 없음을 직접 단언한다. mutation 관점에서도
    이 단언은 payload 에 `error` 필드가 다시 추가되면 즉시 RED 로 잡힌다.
  - `executeWithRetry`(W20, `:6187`-`:6188`)의 재시도 제외 재throw 도 `err`(원본
    `ExecutionCancelledError` 인스턴스)를 그대로 다시 던질 뿐 새 `Error` 로 감싸거나 메시지를
    합성하지 않아, `executeNode` catch 에서 `instanceof ExecutionCancelledError` 판정과
    위 안전한 분기가 그대로 적용된다.

- **`input` 필드(그 외 payload 필드) — 신규 노출 아님, 기존 관용구 재사용**
  - 위치: `execution-engine.service.ts:5839`(`input: nodeExecution.inputData`, W19 신규 분기)
    vs `:5790`(같은 필드, `isAbortError` 분기 — `git blame` 확인 결과 커밋 `9842edebf`
    "NodeExecution cancelled status" (#442) 부터 존재하던 필드)
  - 상세: `input`/`nodeType`/`nodeLabel`/`startedAt`/`finishedAt` 필드 세트는 W19 가
    새로 만든 게 아니라 인접한 기존 `isAbortError` 분기의 payload 구조를 그대로 복제한
    것이다(단, `error` 필드만 의도적으로 제외). 이 필드들은 `NODE_COMPLETED`(`:5719`-`:5730`)
    등 다른 노드 종결 이벤트에서도 동일하게 브로드캐스트되는 기존 아키텍처 패턴이라, 이번
    diff 가 새로 만든 노출 표면이 아니다. 워크플로 입력 데이터 자체를 WS 로 내보내는 것이
    타당한지(사용자 시크릿이 노드 config/input 에 섞여 들어갈 수 있는지)는 이 PR 의
    스코프를 벗어난 기존 설계 결정이며, 이번 취소 경로가 그 노출 범위를 넓히지 않는다.

- **`executeBackgroundSubgraph`/`executeWithRetry` 등 다른 소비 지점 — 변경 없음, 재확인만**
  - 위치: `execution-engine.service.ts:6964`-`:6974`(`executeBackgroundSubgraph` else-if)
  - 상세: `logger.debug` 로 `execution=${job.executionId}` 만 서버 로그에 남기고(`err.message`
    미포함), WS/DB 어디에도 노출하지 않는다 — 4R 보안 리뷰가 이미 "안전"으로 확인한 상태
    그대로이며 이번 diff 로 바뀌지 않았다.

## 요약

이번 라운드가 지목한 핵심 우려 — `executeNode` 의 `ExecutionCancelledError` 분기가 W19 로
신규 도입한 `NODE_CANCELLED` WS emit 이 내부 전용 `ExecutionCancelledError` message(executionId
포함)를 payload 에 실어 노출할 가능성 — 는 실제 소스 확인 결과 **발생하지 않는다**. 해당 분기는
`error` 필드 자체를 payload 구성에서 제외했고(park/isAbortError 분기와 달리), 이는
`JSON.stringify(...).not.toContain('cancelled externally')` 로 문자열 수준까지 직접 단언하는
회귀 테스트로 고정돼 있다. payload 의 나머지 필드(`input` 등)도 이번 diff 가 새로 만든 것이
아니라 커밋 `9842edebf`(#442) 이래 존재하던 `isAbortError` 분기의 필드 구성을 그대로 재사용한
것이라 노출 범위 확장이 없다. `executeWithRetry`(W20)의 재시도 제외 재throw 도 원본 에러
인스턴스를 그대로 전달해 downstream `instanceof` 판정과 안전한 분기가 유지된다. C1~C5·
W1~W18 은 재론하지 않았고(이미 해소 확인됨), 이번 라운드에서 신규로 검증한 W19 관련 항목에서도
CRITICAL/WARNING 이 없다.

## 위험도

NONE
