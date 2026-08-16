# 성능(Performance) 코드 리뷰

## 발견사항

- **[WARNING]** `findById` 의 `NodeExecution.error` 마스킹이 **uncapped 배열에 무조건 spread** 를 추가해, 같은 함수가 이미 지키던 copy-on-change 관례를 깬다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:603-611` (`findById` 내부, `reconciledNodeExecutions` 산출부)
  - 상세: `nodeExecutions` 는 `manager.find(NodeExecution, { where: { executionId: id }, relations: ['node'], order: { startedAt: 'ASC' } })` (같은 파일 579-583줄)로 조회되는데, 바로 아래 `ExecutionNodeLog` 조회(590-595줄)에는 `take: MAX_EXECUTION_PATH_ROWS`(=10,000)가 걸려 있는 반면 이 조회에는 **어떤 `take` 상한도 없다** — 587-589줄 주석 자체가 "대규모 ForEach 실행에서 로그 행이 수만 건에 달할 수 있다"고 명시한다(같은 테이블 계열이 대규모 fanout에서 그 정도 규모가 됨을 이 코드베이스가 이미 알고 있다는 뜻).
    이번 diff 는 그 uncapped 배열 위에 `reconcilePreParkWaitingStatus(nodeExecutions).map((ne) => ({ ...ne, error: redactStoredErrorForResponse(ne.error) }) as NodeExecution)` 를 새로 얹었다. `reconcilePreParkWaitingStatus` 자신(같은 파일 126-140줄)은 상태 정정이 필요한 행만 `{ ...ne, status: ... }` 로 복제하고 나머지는 원본 참조 `ne` 를 그대로 돌려주는 **copy-on-change** 설계인데, 새로 추가된 `.map` 은 `ne.error` 가 `null`(전체 행의 절대다수 — 실패하지 않은 정상 행)이어도 **모든 행을 무조건 새 객체로 복제**한다. 결과적으로 같은 배열을 두 번 순회(reconcile 1회 + redact 1회)하고, 두 번째 순회는 대부분 불필요한 shallow-copy 를 강제한다.
    이 경로는 `writeSnapshotCache` (181-205줄)가 `COMPLETED`/`FAILED`/`CANCELLED` 상태만 캐시하므로(185-192줄), **RUNNING/PENDING/WAITING 실행은 폴링·WS 재연결마다 이 전체 계산을 매번 재실행**한다 — 즉 대규모 ForEach 가 아직 진행 중인, 가장 부하가 큰 시점에 이 uncapped 이중 순회가 반복된다.
  - 제안: `reconcilePreParkWaitingStatus` 와 동일한 copy-on-change 규율을 적용 — `ne.error == null ? ne : { ...ne, error: redactStoredErrorForResponse(ne.error) }` 로 바꿔 `error` 가 실제로 있는 행만 복제한다. 근본적으로는 `manager.find(NodeExecution, ...)` 에도 `ExecutionNodeLog` 와 대칭으로 `take` 상한을 두는 편이 낫지만, 그 조회 자체는 이번 diff 의 변경 범위 밖(선존 상태)이므로 별건으로 분리 권장.

- **[INFO]** `toResponseExecution` 이 같은 엔티티를 두 번 shallow-copy 한다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:922-928`
  - 상세: `const { trigger: _t, executor: _e, ...rest } = execution;` 로 이미 새 객체 `rest` 를 만든 뒤, `return { ...rest, error: redactStoredErrorForResponse(rest.error) } as Execution;` 로 또 한 번 spread 한다. 단건 엔티티당 비용은 무시할 만큼 작지만, 이 함수는 `findById`(1회) 뿐 아니라 `getChain` 의 `rows.map((e) => this.toResponseExecution(e))`(534-537줄, 이 쿼리도 `take` 없이 `getMany()`)에서 행마다 호출되므로 체인이 커지면 불필요한 복제가 선형으로 누적된다.
  - 제안: `rest.error = redactStoredErrorForResponse(rest.error); return rest as Execution;` 로 바꾸면 두 번째 spread 를 제거할 수 있다.

- **[INFO]** `deepRedactSecrets` 의 depth-0 `WeakMap` 캐시는 이번 4개 신규 호출부(정확히는 findById/getChain/stop/toExecutionDto/background-runs 5곳)에서 사실상 항상 미스한다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:107, 136-142` (참고, 이번 diff 로 수정되진 않음) / 호출부는 `codebase/backend/src/shared/utils/redact-stored-error.ts:63`
  - 상세: 이 캐시는 "같은 객체 참조가 여러 번 재-emit 되는" 상황(ForEach fanout 등)을 겨냥한 설계인데, 여기서 넘기는 `err` 는 TypeORM 이 매 쿼리마다 새로 만든 JSONB 파싱 결과 객체라 요청마다 identity 가 다르다 — 즉 캐시가 이 호출 경로에는 원천적으로 도움이 안 된다. 다만 `redactStoredErrorForResponse` 는 `err == null` 을 즉시 `null` 로 반환하므로(실패하지 않은 절대다수 행에서) 정규식 스캔 자체는 스킵된다. 실질적 비용은 위 WARNING 항목(무조건 spread)이 더 크다 — 이 항목은 참고용 INFO 로만 남긴다.

## 요약

이번 변경의 핵심은 4개 내부 REST 읽기 표면(`findById`/`getChain`/`stop`/`toExecutionDto`)과 `background-runs` 조회 경로에 `Execution.error`/`NodeExecution.error` egress 마스킹을 추가하는 보안 후속(#1177 잔여 갭 해소)이다. `redactStoredErrorForResponse` 자체는 `null` 조기 반환 덕에 실패하지 않은 행에서는 저비용이고, 페이지네이션이 걸린 경로(`toExecutionDto` 목록, `background-runs` 200건 상한)는 안전하다. 다만 `findById` 의 `NodeExecution.error` 마스킹 삽입 지점은 (a) 그 조회 자체가 이미 `take` 상한 없이 조회되고, (b) 그 위에 추가된 `.map` 이 같은 함수 안 자매 함수(`reconcilePreParkWaitingStatus`)가 지키는 copy-on-change 규율을 어기며 모든 행을 무조건 복제하고, (c) 이 경로가 RUNNING 상태에서는 캐시되지 않아 폴링마다 반복된다는 세 요인이 겹쳐, 대규모 ForEach 실행이 진행 중인 동안 불필요한 배열 이중 순회·객체 복제 비용을 새로 추가한다. 즉각적인 장애 유발 수준은 아니지만(입력 규모가 통상적인 실행에서는 체감 못 할 수준), 이 저장소 스스로 "수만 건" 규모를 이미 인지하고 있는 sibling 조회와 대칭이 깨진 채로 남으므로 조치를 권장한다.

## 위험도

MEDIUM
