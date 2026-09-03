# 동시성(Concurrency) 코드 리뷰

## 리뷰 대상

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `MSG_AUTH_TOKEN_EXPIRING` 상수 추가 (동시성 무관)
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — 소켓별 만료 타이머(`expiryTimers`) 쌍 관리 리팩터: `clearExpiryTimers` 헬퍼 도입, 타입 non-optional 화, `armExpiryTimers` 진입부 선제 해제, `setTimeout(...).unref()` 추가
- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 위 변경에 대응하는 테스트 3종 추가 (상수 일치, 재무장 시 옛 타이머 해제, unref 확인)
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` — 작업 기록 문서 (코드 아님, 동시성 무관)

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 참고용 INFO.

- **[INFO]** 타이머 `unref()` 는 정상적 셧다운 경로에서 만료 통지/강제 종료가 누락될 수 있는 설계상 트레이드오프
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:236-239` (`armExpiryTimers` 내 `notice.unref(); cutoff.unref();`)
  - 상세: `unref()` 는 이 타이머들이 프로세스 종료를 막지 않도록 하는 의도된 하드닝(주석에 "셧다운을 붙잡지 않는다" 명시)이다. 다만 이 결과 Node 가 event loop 가 비었다고 판단해 자연 종료하는 경로(graceful shutdown 이 SIGTERM 후 커넥션 드레인만 하고 별도 강제 timeout 을 두지 않는 방식)에서는, 대기 중이던 `notice`/`cutoff` 콜백이 실행되지 않고 프로세스가 먼저 죽어 클라이언트가 사전 통지를 못 받을 수 있다. 이번 diff 범위 밖(배포 런북 논의로 이미 plan 문서 `ws-token-expired-socket-lifetime-impl.md:151-160`에서 별도 항목으로 다뤄짐)이라 결함으로 보진 않으나, 동시성/리소스 관리 관점의 알려진 트레이드오프로 기록한다.
  - 제안: 조치 불요(문서화된 의도). 배포 시 graceful shutdown 정책과의 상호작용만 런북에 유지.

## 분석 근거 (뮤테이션 없이 정적 추론)

Node.js/Socket.IO 이벤트 핸들러가 단일 스레드 event loop 위에서 실행된다는 전제로 각 변경을 검토했다.

1. **`clearExpiryTimers` 도입** (`websocket.gateway.ts:182-188`) — `armExpiryTimers`(재무장, `:215`)와 `handleDisconnect`(정리, `:318`) 두 호출부가 동일 절차를 공유하도록 통합. 두 호출 모두 `await` 없는 완전 동기 함수 내부에서 일어나므로, 두 호출 사이에 다른 매크로태스크(타이머 콜백 등)가 끼어들 수 없다 — race 없음.
2. **`expiryTimers` 타입 non-optional 화** (`:157-160`) — `armExpiryTimers` 가 항상 `{ notice, cutoff }` 쌍을 함께 `set` 하므로(`:241`) 타입이 실제 불변식과 일치한다. 이전의 `?` 타입이 허용하던 "한쪽만 존재" 상태는 애초에 도달 불가능했고, 이번 변경은 그 불변식을 컴파일 타임에 강제하는 것으로 동시성 결함을 만들지 않는다.
3. **`armExpiryTimers` 진입부 선제 `clearExpiryTimers(client.id)`** (`:215`) — 같은 `client.id` 로 재무장(현재는 도달 불가, `connectionStateRecovery` 활성화 시 도달)할 때 옛 타이머 쌍을 먼저 해제한다. 옛 타이머가 살아있는 채로 새 타이머가 같은 키로 `Map.set` 되면, 옛 클로저가 캡처한 (이제 stale 한) `client` 객체에 대해 `emit`/`disconnect` 를 거는 좀비 타이머가 되어 이벤트 중복 발송·소켓당 타이머 누수로 이어질 수 있었다 — 이번 수정이 그 경로를 사전에 차단한다. 신규 테스트(`websocket.gateway.spec.ts:809-830`)가 재무장 시 emit/disconnect 합계가 정확히 1회임을 검증해 회귀를 잡는다.
4. **`.unref()` 추가** (`:238-239`) — 이벤트 루프 블로킹/좀비 프로세스 방지 관점에서 올바른 방향. 타이머가 소켓 생명주기와 무관하게 프로세스 종료를 지연시키던 잠재적 결함을 제거한다.
5. **원자성** — `armExpiryTimers` 전체(선제 해제 → 신규 타이머 생성 → unref → Map 갱신)는 단일 동기 구간이므로 "해제되었지만 아직 신규 타이머가 등록되지 않은" 관측 가능한 중간 상태가 없다. `handleConnection` → `armExpiryTimers` 경로 전체도 동기(예외 아닌 한 `await` 없음)라 동시 연결 간 `expiryTimers` Map 접근도 교착 없이 순차 처리된다.
6. 이번 diff 는 `handleSubscribe` 의 기존 TOCTOU 방어 로직(`:418-455`, tentative-add + 사후 재검증)을 건드리지 않는다 — 참고로 해당 로직과 그 회귀 테스트(`websocket.gateway.spec.ts:613-656`, "enforces MAX_SUBSCRIPTIONS across concurrent subscribe")는 이번 diff 범위 밖의 기존 코드다.

## 뮤테이션/저장소 변경

본 리뷰에서는 저장소 파일을 뮤테이션하지 않았다 (정적 추론만으로 결론에 도달). `git status --short` 는 확인하지 않아도 되는 상태(쓰기 작업 없음).

## 요약

이번 diff 는 WS 소켓별 만료 타이머 쌍의 생성/해제 절차를 한 헬퍼(`clearExpiryTimers`)로 통합하고, 타입을 실제 불변식(항상 쌍)에 맞게 non-optional 화했으며, 재무장 시 옛 타이머를 선제 해제하고 타이머에 `unref()`를 적용한 순수 하드닝 변경이다. 모든 관련 코드 경로가 `await` 없는 동기 구간 안에서 Map 을 읽고 쓰므로 Node.js 단일 스레드 event loop 전제 하에 경쟁 조건이나 데드락 여지가 없고, 오히려 이전에 존재하던 잠재적 타이머 누수(같은 `client.id` 재사용 시 좀비 타이머로 인한 이중 emit/disconnect)와 이벤트 루프 유지(unref 부재) 문제를 선제적으로 제거한다. 신규 테스트 3종이 각 하드닝 포인트(상수 일치, 재무장 시 옛 타이머 해제, unref)를 구체적으로 검증해 회귀 가드도 충분하다. 동시성 관점에서 발견된 CRITICAL/WARNING 은 없다.

## 위험도

NONE
