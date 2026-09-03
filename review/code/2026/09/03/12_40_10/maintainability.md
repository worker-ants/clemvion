# 유지보수성(Maintainability) Review

## 리뷰 대상 요약

핵심 코드 변경은 `websocket.gateway.ts`(만료 타이머 쌍 관리를 `clearExpiryTimers` 헬퍼로 추출 +
non-optional 타입화 + 선제 해제 + `.unref()`), `websocket-events.types.ts`(`MSG_AUTH_TOKEN_EXPIRING`
상수 승격), `websocket.gateway.spec.ts`(신규 테스트 5종) 세 파일이다. 나머지(plan 트래커,
`review/code/2026/09/03/11_57_58/**`)는 이전 리뷰 라운드의 산출물/추적 문서로, 이번 라운드가
포괄하는 diff(origin/main → HEAD, 3커밋: `69aad5d5d`→`b75e6a76b`→`80ac92668`)에 실려 있을 뿐 자체가
유지보수 대상 코드는 아니다.

이전 두 라운드(`11_57_58`)에서 이미 지적된 **JSDoc 오귀속(architecture/documentation W1·W2)**,
**조기 `return` 순서 결함(requirement W3)**, **`unref` 런북 추적 누락(2R W1)**은 각각
`b75e6a76b`, `80ac92668` 커밋으로 정정되어 있음을 실제 소스(`Read`)로 직접 확인했다 — 현재
`websocket.gateway.ts:161-175`에 `armExpiryTimers`의 설계 근거 JSDoc이 그 함수 바로 위에,
`websocket.gateway.ts:230-234`에 `clearExpiryTimers`의 자체 JSDoc이 그 메서드 바로 위에 각각
정상 인접해 있고, `websocket-events.types.ts:287-305`의 `AuthTokenExpiredPayload` JSDoc과
`:307-313`의 `MSG_AUTH_TOKEN_EXPIRING` JSDoc도 각 대상 선언에 정상 인접해 있다. 아래는 이 최종
상태를 기준으로 한 신규 관찰이다.

### 발견사항

- **[INFO]** `Math.max(0, …)` 클램프 설명 주석이 두 지점에 걸쳐 거의 동일한 문장으로 중복된다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `armExpiryTimers` 내
    `untilNotice` 계산부(194~197줄 대역, diff 게이트 `194`~`197`)와 `cutoff` 타이머 생성부
    (211~213줄 대역, diff 게이트 `211`~`213`)
  - 상세: 두 곳 모두 "Node 가 음수 지연을 1ms 로 강제하므로 clamp 자체는 동작을 안 바꾸지만,
    그 강제는 런타임 구현 세부이지 이 코드가 표현하려는 계약이 아니다"라는 동일한 논지를 각각
    별도 문단으로 서술한다. 두 번째 주석은 "위 `untilNotice` 와 같은 이유"라고 명시적으로
    교차 참조하고 있어 완전한 중복은 아니지만, 근거 문단 자체는 그대로 복제돼 있다. 이후 이
    근거가 바뀌면(예: clamp 를 걷어내기로 정책이 바뀌면) 두 곳을 함께 고쳐야 하는데, 교차
    참조만 있고 단일 SoT 는 없어 한쪽만 고쳐질 위험이 있다.
  - 제안: 근거 문단을 `notice`쪽(먼저 나오는 지점) 한 곳에만 온전히 두고, `cutoff` 쪽은 "위와
    같은 이유(중복 방어, 계약 표현 목적)"로 한 줄만 남기거나, 클래스 필드/메서드 JSDoc에
    "두 타이머 모두 `Math.max(0, …)` 클램프를 쓰는 이유"를 한 번만 적어 두 지점이 그것을
    참조하게 한다.

- **[INFO]** 신규 테스트 1건이 `connectWithExp` 헬퍼가 지원하지 않는 조합(‘`exp` 없는 토큰’)을
  검증하려고 헬퍼 내부 로직을 그대로 복제했다
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` —
    `'exp 없는 토큰으로 재무장해도 옛 타이머는 해제된다…'` 테스트(diff 게이트 `833`~`857`)
  - 상세: `connectWithExp(id, secondsFromNow)`(`731`~`743`)는 항상 `exp` 클레임을 채워 넣는
    시그니처라, `exp` 가 **없는** 토큰이 필요한 이 테스트는 `module.get(JwtService).verify`
    mock 설정과 `createMockSocket` + `gateway.handleConnection` 호출을 헬퍼 밖에서 손으로
    다시 조립했다(`838`~`847`). 현재는 1회성이라 문제로 보기 어렵지만, 헬퍼가 표현할 수 없는
    변형이 하나 더 생기면(예: `sub`/`activeWorkspaceId` 를 바꾼 재연결 케이스) 같은 복제가
    반복될 소지가 있다.
  - 제안: `connectWithExp` 의 두 번째 인자를 `secondsFromNow?: number`로 바꾸고 `undefined`
    이면 `exp` 클레임 자체를 생략하도록 확장하면, 이 테스트도 헬퍼를 그대로 재사용할 수 있다.
    지금 당장 강제할 정도는 아니라 INFO로 남긴다(rule-of-three 미달).

- **[INFO]** 상수 시제 불일치(`MSG_AUTH_TOKEN_EXPIRING` 진행형 vs `AUTH_TOKEN_EXPIRED`/
  `AuthTokenExpiredPayload` 완료형) — 이미 검토·기각된 항목이라 재차 등재만
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:283-314`
  - 상세: 라운드 1 SUMMARY(INFO#7)에서 동일 지적이 나왔고 RESOLUTION.md 에 "이벤트명은 wire
    계약이라 바꿀 수 없고, 상수명만 맞추면 오히려 '통지 시점은 아직 만료 전' 이라는 사실이
    흐려진다"는 근거로 **현행 유지**가 확정돼 있다. 새 근거는 없다 — 이미 다뤄진 트레이드오프임을
    명시하기 위해 재등재만 하고 조치는 요구하지 않는다.
  - 제안: 없음(현행 유지가 합리적).

가독성·네이밍·중첩 깊이·함수 길이·순환 복잡도 관점에서는 문제를 찾지 못했다: `armExpiryTimers`
는 주석을 빼면 실제 로직이 25줄 안팎이고 조기 `return` 하나뿐인 낮은 분기 구조이며,
`clearExpiryTimers` 추출로 `armExpiryTimers`/`handleDisconnect` 두 소비처의 절차가 하나로
합쳐져 오히려 순환 복잡도가 줄었다(`handleDisconnect` 의 중첩 `if(timers.notice)`/
`if(timers.cutoff)` 방어 분기가 제거됨). `{ notice?: …; cutoff?: … }` → `{ notice: …; cutoff: … }`
non-optional 화도 "표현 불가능한 상태를 타입으로 배제"하는 원칙에 부합하며, 이로 인해 죽은
방어 코드가 함께 사라졌다. 신규 테스트 5종의 명명(관측 가능한 동작을 한국어 문장으로 서술)은
같은 파일의 기존 관례와 일치한다.

## 요약

이 diff 는 이전 두 라운드의 유지보수성 지적(JSDoc 오귀속·조기 return 순서·런북 추적 누락)이
모두 후속 커밋으로 정정된 최종 상태이며, 직접 소스를 열어 그 정정을 실측으로 확인했다.
`clearExpiryTimers` 추출·타입 non-optional 화는 중복 제거와 illegal-state 배제라는 두 축에서
견고한 리팩터이고, 새로 발견된 것은 클램프 설명 주석의 경미한 중복과 테스트 헬퍼 재사용
여지 정도로, 모두 지금 당장 병합을 막을 사유가 아닌 INFO 수준이다.

## 위험도
NONE
