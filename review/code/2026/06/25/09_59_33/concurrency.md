# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] 신규 helper는 동시성 중립 — 기존 패턴 유지
- 위치: `getCommandAuthContext()` (동기), `verifyExecutionOwnership()` (async)
- 상세: 이번 변경에서 추출된 두 helper는 각각 소켓 속성 읽기(동기)와 DB 조회(async/await)만 수행한다. 두 helper 모두 공유 가변 상태를 읽거나 쓰지 않으며, 호출 핸들러별로 독립적인 스택 프레임에서 실행된다. 경쟁 조건·데드락 위험 없음.
- 제안: 해당 없음.

### [INFO] void fire-and-forget 패턴은 변경 전과 동일하게 유지됨
- 위치: `void this.emitExecutionSnapshot(...)` (subscribe 핸들러), `void this.executionEngineService.markSpawnedRowFailedOnPublishError(...)` (retryLastTurn 핸들러)
- 상세: 이번 diff에서 해당 패턴이 신규로 도입된 것이 아니라 기존 코드 그대로다. `emitExecutionSnapshot`은 실패 시 catch로 삼켜 로그만 남기도록 설계되어 있고, `markSpawnedRowFailedOnPublishError`도 W3 정책에 따라 zombie row 방지용 best-effort다. 이벤트 루프 블로킹 없음(await 없이 void 처리).
- 제안: 기존 설계이므로 이번 리뷰 범위 밖. 별도 개선 시 unhandled rejection 추적을 위해 `.catch(err => this.logger.error(...))` 명시 고려 가능(INFO 수준).

### [INFO] `subscriptions` Map의 tentative-add 원자성 — 변경 없음, 기존 설계 유지
- 위치: `handleSubscribe()` 내 `clientSubs.add(channel)` + 사후 size 검사 (변경 없는 기존 코드)
- 상세: 코드 주석이 "JS event-loop 가 single-thread 라 이 두 동작 사이에 다른 subscribe 핸들러가 끼어들 수 없다"고 명시한다. Node.js 싱글 스레드 특성상 await 없는 동기 블록은 원자적으로 실행되며, 실제 `authorize()` await 이후의 add/size 검사 구간은 동기이므로 경쟁 없음. 이번 diff는 이 구간을 변경하지 않았다.
- 제안: 해당 없음.

### [INFO] `getCommandAuthContext`는 소켓 속성을 읽기만 함 — 변경 시점 이후 race 없음
- 위치: `getCommandAuthContext()` 전체
- 상세: `enriched.userId` / `enriched.workspaceId`는 `handleConnection()`에서 JWT 검증 성공 시 한 번 기록되고 이후 변경되지 않는(단조 write) 속성이다. 읽기 전용 접근이므로 복수 핸들러가 동시에 호출되어도 경쟁 조건이 없다. Socket.IO는 연결당 독립 소켓 인스턴스를 사용하므로 cross-connection 공유도 없음.
- 제안: 해당 없음.

---

## 요약

이번 변경(C-4)은 behavior-preserving 추출 리팩토링으로, 동시성 측면에서 신규 위험을 도입하지 않는다. 추출된 `getCommandAuthContext`(동기)와 `verifyExecutionOwnership`(async/await 정상 사용)은 공유 가변 상태에 접근하지 않으며, 기존의 subscriptions Map 원자 블록, void fire-and-forget 패턴, 소켓 속성 단조 write 설계 모두 변경 전과 동일하게 유지된다. Node.js 단일 스레드 이벤트 루프 환경에서 경쟁 조건·데드락·await 누락·이벤트 루프 블로킹은 발견되지 않았다.

## 위험도

NONE
