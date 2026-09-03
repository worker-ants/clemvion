# 동시성(Concurrency) 코드 리뷰

## 대상 요약

이번 diff 의 실질 동시성 표면은 `codebase/backend/src/modules/websocket/websocket.gateway.ts` 의
소켓별 만료 타이머 쌍(`expiryTimers: Map<string, {notice, cutoff}>`) 관리 로직 하드닝이다
(`websocket-events.types.ts` 는 문자열 상수 추가뿐이고, `.spec.ts` 는 테스트 전용이라 그 자체로는
동시성 위험이 없음). `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 와
`review/code/2026/09/03/11_57_58/**` 는 문서/이전 리뷰 산출물이라 별도 코드 분석 대상 아님.

## 발견사항

- **[INFO]** `client.id` 키만으로 타이머 쌍을 관리 — `connectionStateRecovery` 활성화 시 재연결·구
  disconnect 처리 순서에 따라 새로 무장한 타이머가 지워질 수 있는 잠재적 순서 의존성
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:184` (`armExpiryTimers` 진입부
    `this.clearExpiryTimers(client.id)`), `codebase/backend/src/modules/websocket/websocket.gateway.ts:236-242`
    (`clearExpiryTimers`), `codebase/backend/src/modules/websocket/websocket.gateway.ts:318`
    (`handleDisconnect` 의 `this.clearExpiryTimers(client.id)`)
  - 상세: `expiryTimers` Map 은 `client.id` 문자열만으로 항목을 식별하고, 어느 "세대(generation)"의
    타이머인지 구분하는 토큰이 없다. 현재는 Socket.IO 가 연결마다 무작위 신규 `id` 를 부여하고
    `connectionStateRecovery` 옵션도 `@WebSocketGateway({...})` 설정에 없어(`grep` 확인,
    코드베이스 전체에 `connectionStateRecovery` 참조가 이 스펙 테스트 주석 1곳뿐) 동일 `id` 로
    `handleConnection` 이 두 번 불리는 경우는 **`armExpiryTimers` 내부의 동기적 재무장(같은 함수
    안에서 clear→set)** 뿐이다 — 이는 이번 diff 가 이미 테스트(`websocket.gateway.spec.ts:809-830`)
    와 mutation RED 로 정확히 닫았다. 다만 `connectionStateRecovery` 를 켜는 시나리오(팀이 스스로
    plan/RESOLUTION 에 "그날 도달한다" 로 명시)에서는, 재연결로 새 소켓이 `handleConnection`(→
    `armExpiryTimers` → 새 타이머 set)을 먼저 마치고, **지연된 구 소켓의 `handleDisconnect`** 가
    나중에 같은 `client.id` 로 `clearExpiryTimers` 를 호출하면 방금 무장된 **새 연결의 타이머**를
    지워버릴 수 있다. Node 이벤트 루프가 단일 스레드라 각 콜백(`handleConnection`,
    `handleDisconnect`) 내부의 Map 연산 자체는 원자적이지만, **두 콜백 사이의 호출 순서**(구
    disconnect 가 신규 connect 보다 늦게 도달)는 Socket.IO/네트워크 계층이 보장하지 않는다. 그
    결과 재연결된 소켓이 만료 타이머 없이 무기한 살아있게 되는 조용한 회귀가 될 수 있다(단, 지금은
    도달 불가 상태로 정확히 문서화·테스트됨).
  - 제안: 현재로선 조치 불요(설정이 꺼져 있어 도달 불가, 이미 팀이 판단 유지로 명시). `connectionStateRecovery`
    를 실제로 켜는 시점에는 `expiryTimers` 값에 소켓 참조 또는 단조 증가 세대 토큰을 함께 저장해,
    `clearExpiryTimers`/`handleDisconnect` 가 "이 Map 항목이 지금 이 소켓의 것인가"를 확인한 뒤에만
    지우도록 방어하는 편이 안전하다(`disconnecting` 소켓 객체 자체를 값으로 비교하는 방식도 가능).

## 긍정적으로 확인된 하드닝 (검증됨)

- `armExpiryTimers` 가 **조기 return 이전에** `clearExpiryTimers` 를 호출하도록 재배치되어
  (`websocket.gateway.ts:184`), `exp` 없는 토큰으로 동일 `id` 재무장 시 옛 타이머 쌍이 남는 누수를
  닫았다. 단일 함수 내 동기 실행이라 clear→(조건부)set 사이에 다른 콜백이 끼어들 수 없어 원자성이
  보장된다 — 테스트(`websocket.gateway.spec.ts:809-830, 832-856`)와 mutation RED 로 확인됨.
- `expiryTimers` 필드 타입을 `{notice?: ...; cutoff?: ...}` 에서 `{notice: ...; cutoff: ...}` (non-optional)
  로 좁혀, "타이머 쌍 중 한쪽만 존재"라는 도달 불가능한 상태를 타입 레벨에서 배제했다
  (`websocket.gateway.ts:156-159`). 해제 절차도 `clearExpiryTimers` 단일 메서드로 모아 무장·해제
  두 자리가 따로 갈리는 걸 막았다.
- `notice`/`cutoff` `setTimeout` 결과에 `.unref()` 를 추가해(`websocket.gateway.ts:225-226`) 이
  타이머들이 Node 이벤트 루프를 붙잡아 프로세스 셧다운을 최대 토큰 수명만큼 지연시키는 문제를
  제거했다 — 리소스(타이머) 관리 관점에서 올바른 수정이며, 전용 테스트(`hasRef() === false` 전수
  확인, `websocket.gateway.spec.ts:858-874`)로 검증됨.
- `handleConnection`/`handleDisconnect` 는 둘 다 동기 함수(내부에 `await` 없음)라, 같은 `client.id`
  에 대한 `expiryTimers` Map 읽기/쓰기가 단일 이벤트 루프 틱 안에서 run-to-completion 으로 처리된다
  — 이 diff 범위 안에서는 경쟁 조건이 없다.

## 요약

이번 diff 는 소켓별 만료 타이머 관리에 대한 **하드닝(원자성 개선·타입 정합·타이머 리소스 정리)**
이며, 새로운 경쟁 조건이나 데드락을 도입하지 않는다. `armExpiryTimers` 의 선제 해제 재배치와
`.unref()` 추가는 모두 이전에 실측된 결함(재무장 시 타이머 누수, 셧다운 지연)을 테스트+mutation
RED 로 검증하며 닫았다. 유일하게 짚을 점은 `expiryTimers` 가 `client.id` 문자열만으로 항목을
식별해 세대 구분이 없다는 것인데, 이는 `connectionStateRecovery` 가 실제로 켜지기 전까지는 도달
불가능하도록 현재 설정·테스트가 정확히 문서화하고 있어 지금 당장의 결함은 아니다(팀도 이미
같은 판단을 내림). 향후 그 옵션을 켜는 작업에서는 타이머 항목에 세대 토큰/소켓 참조 비교를
추가하는 것을 권한다.

## 위험도
LOW
