# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] seedWaitingFromStatus 와 SSE 이벤트 간 WAITING dispatch 중복/경합

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/channel-web-chat/src/widget/use-widget.ts` — `seedWaitingFromStatus` 콜백 + start/restore 경로
- **상세**: `seedWaitingFromStatus` 가 `await`으로 완료된 후 `openStream(session, "0")` 이 열린다. 그런데 `openStream` 이 내부적으로 SSE 연결을 비동기로 설정하고, SSE replay 로 수신된 `execution.waiting_for_input` 이벤트도 `dispatch({ type: "WAITING", ... })` 를 발행할 수 있다. 두 경로가 모두 WAITING dispatch 를 발행하면 widgetReducer 가 연속 두 번 WAITING 상태를 적용하게 된다. React single-threaded reducer 이므로 데이터 corruption 은 없지만, getStatus 시드 결과(seq=0)보다 replay 이벤트 결과(실제 seq)가 늦게 도착하면 최종 상태가 올바른 값으로 덮어써지므로 기능상 무해하다. 그러나 `seedWaitingFromStatus` 가 SSE replay 수신보다 늦게 resolve 되는 시나리오(느린 네트워크 + 빠른 SSE)에서는 반대로 오래된 getStatus 결과가 최신 SSE replay 결과를 덮어쓸 수 있다. 현재 구현은 `seq` 비교 없이 무조건 dispatch 하므로 역방향 덮어쓰기(out-of-order overwrite) 가능성이 잠재한다.
- **제안**: dispatch 전 현재 state 의 seq 또는 phase 를 확인하여 이미 SSE replay 로 WAITING 상태가 설정된 경우 시드 dispatch 를 건너뛰도록 한다. 예: reducer 내에서 `action.seq <= state.seq` 이면 WAITING 을 무시하는 guard, 또는 `seedWaitingFromStatus` 내에서 `status.seq` 와 state 의 seq 를 비교.

---

### [INFO] getStatus 시드와 SSE replay 의 순서 보장 없음 (soft failure 허용)

- **위치**: `use-widget.ts` — `seedWaitingFromStatus` catch 블록, start 경로 `await seedWaitingFromStatus(client, session); openStream(session, "0");`
- **상세**: `seedWaitingFromStatus` 는 실패 시 console.warn 후 계속 진행(soft)한다. 이 설계는 의도적이며 올바르다 — SSE replay 가 1차 복구 메커니즘이고 시드는 보강이다. async/await 누락이나 이벤트 루프 블로킹은 없다.
- **제안**: 현재 패턴 유지. 단, `seedWaitingFromStatus` 의 `useCallback` 의존성 배열이 `[]` (빈 배열)이므로 `client`/`session` 이 클로저 외부 파라미터로 전달되는 점이 올바르게 설계되어 있음을 확인. 변경 불필요.

---

### [INFO] interaction.service.ts getStatus — Execution 상태 조회 후 NodeExecution 조회 사이 TOCTOU

- **위치**: `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `getStatus` 메서드, 라인 1162–1207
- **상세**: `execution.status === WAITING_FOR_INPUT` 를 확인한 직후 `nodeExecutionRepository.findOne(...)` 를 호출하는 사이에 해당 execution 이 다른 요청에 의해 RUNNING/COMPLETED 로 전이될 수 있다. 이 경우 `nodeExec` 가 null 이거나 status 가 WAITING_FOR_INPUT 이 아닌 NodeExecution 이 반환될 수 있다. 그러나 쿼리 자체가 `status: NodeExecutionStatus.WAITING_FOR_INPUT` 조건을 포함하고 있어 불일치한 레코드를 자연스럽게 걸러낸다. `nodeExec` null 케이스는 `currentNode/context = null` 로 graceful 하게 처리된다. 따라서 이 TOCTOU 는 기능적으로 무해하고 설계상 허용된 범위다.
- **제안**: 현재 처리 방식 유지. 추가 동기화 불필요.

---

## 요약

이번 변경의 핵심은 SSE `lastEventId="0"` replay 와 `getStatus` 시드를 통한 race condition 해소다. React 위젯은 단일 스레드 이벤트 루프에서 동작하므로 전통적 동시성 위험(데드락·뮤텍스 등)은 해당되지 않는다. 주요 동시성 관련 관찰 사항은 `seedWaitingFromStatus` dispatch 와 SSE replay dispatch 의 순서 역전 가능성이며, 현재 구현에 seq 비교 guard 가 없어 느린 네트워크에서 getStatus 결과가 SSE replay 결과를 덮어쓸 잠재 위험이 존재한다(WARNING 1건). 백엔드 `getStatus` 의 Execution→NodeExecution 이중 조회 사이 TOCTOU 는 쿼리 조건으로 자연 방어되어 무해하다. async/await 누락, 이벤트 루프 블로킹, Promise 체인 오류는 없다.

## 위험도

LOW
