# 부작용(Side Effect) 코드 리뷰 — WS `auth.token_expired` 이월 INFO 5건 정리

## 리뷰 범위

실질 코드 변경은 4개 파일뿐이다(나머지 40여 개는 과거 리뷰 라운드의 산출물 markdown/json 이며,
`review/code/**`·`review/consistency/**` 지정 위치에 새로 쓰인 것이라 그 자체로는 부작용이 아니다):

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `MSG_AUTH_TOKEN_EXPIRING` 상수 신설
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `clearExpiryTimers` 헬퍼 추출, `expiryTimers` 타입 non-optional화, `armExpiryTimers` 진입부 선제 해제, `setTimeout(...).unref()`
- `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — 회귀 테스트 3종
- `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` — 문서(코드 아님)

실제 소스는 `Read`/`grep` 으로 현재 저장소 상태를 직접 열어 diff 와 대조 확인했다 (뮤테이션 없음, `git status --short` 는 원래도 clean — 본 리뷰는 저장소를 건드리지 않았다).

## 발견사항

- **[INFO]** `setTimeout(...).unref()` 추가 — 프로세스 전역 이벤트 루프 유지 상태(shared process state)를 변경하는 의도된 부작용
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:222-227` (`notice.unref(); cutoff.unref();`)
  - 상세: 종전에는 이 두 `setTimeout` 핸들이 기본적으로 event loop 를 ref 상태로 유지해, 콜백이 발화하거나 `clearTimeout` 될 때까지 프로세스 종료(예: SIGTERM 후 graceful shutdown)를 막을 수 있었다. `.unref()` 는 그 핸들 각각의 ref 카운트만 낮추므로 다른 타이머에는 전이되지 않지만, "프로세스가 지금 안전하게 종료 가능한가"라는 **프로세스 전체가 공유하는 판단(활성 핸들 존재 여부)**에 개입한다는 점에서 전형적인 공유 상태 부작용이다. 실제 영향: 그레이스풀 드레인 창에서 아직 발화하지 않은 `notice`(사전 통지)·`cutoff`(강제 종료) 콜백이 프로세스 종료로 인해 **실행되지 못한 채 사라질 수 있다** — 클라이언트가 사전 통지를 못 받는 창이 생긴다. 이 리스크는 코드 주석과 `plan/in-progress/ws-token-expired-socket-lifetime-impl.md`(이 diff 가 추가한 "셧다운 중 만료 콜백 미실행" 항목, 미해결 체크박스)에 이미 명시적으로 기록·추적되고 있고, "정상 종료 시 소켓 자체가 소멸하므로 실질 영향은 낮다"는 근거도 함께 남아 있어 **의도치 않은** 부작용은 아니다.
  - 제안: 조치 불요 — 이미 plan 에 열린 추적 항목으로 등재되어 있음(중복 지적 방지 목적으로 side-effect 관점에서 재확인만 기록). 다만 이 항목이 다음에 이 파일을 만질 때 재차 눈에 띄도록, 배포 런북이 실체화되면(plan 자체가 "런북 참조가 이미 4건 쌓였다"고 자평) 그 시점에 반드시 이관할 것.

- **[INFO]** `armExpiryTimers` 진입부에서 조기 `return` 보다 먼저 `clearExpiryTimers(client.id)` 를 호출하도록 순서 변경 — 동일 `client.id` 재사용 시 기존에 걸려 있던 타이머(부작용 발생원)를 선제적으로 무효화
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:180-185`
  - 상세: 이 변경 자체가 "의도치 않은 상태 변경을 막기 위한" 조치다 — 종전 결함(같은 id 재무장 시 옛 타이머 쌍이 살아남아 이미 교체된/끊긴 소켓에 대해 `emit`/`disconnect` 가 걸리는 좀비 콜백)을 정확히 겨냥한다. `client.id` 는 Socket.IO 서버가 생성하므로 공격자가 임의로 재사용을 유발할 수 없고, 현재 프로덕션 경로에서는 도달 불가(코드·테스트 양쪽 주석에 명시)이나 `connectionStateRecovery` 활성화 시 도달 가능해진다는 전제가 정확히 기록돼 있다. 새 동작이 호출자(`handleConnection`)의 시그니처나 외부에서 관측 가능한 인터페이스를 바꾸지 않는다 — 순수 내부 순서 조정.
  - 제안: 조치 불요.

- **[INFO]** `expiryTimers` 맵 값 타입 `{ notice?; cutoff? }` → `{ notice; cutoff }` non-optional화 — private 필드라 외부 시그니처·인터페이스 영향 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:156-159`
  - 상세: `private readonly expiryTimers` 이고 클래스 밖으로 노출되지 않으므로, 이 타입 변경으로 인해 깨지는 호출자가 없다. `handleDisconnect`(:315-317)의 소비 코드도 같은 커밋에서 `clearExpiryTimers` 위임으로 함께 바뀌어 타입과 실제 사용이 일치한다. 새로 도입된 전역 변수는 없다(기존에 있던 인스턴스 필드의 타입만 좁혀짐).
  - 제안: 조치 불요.

- **[INFO]** `MSG_AUTH_TOKEN_EXPIRING` 신규 export — 모듈 공개 표면에 대한 additive 변경, 기존 소비자 영향 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:314-315`
  - 상세: 새 export 심볼 추가는 기존 import 를 깨지 않는다. 값 자체는 종전 `armExpiryTimers` 내부 리터럴 `'Access token expires soon — refresh and reconnect.'`(`websocket.gateway.ts:205` 사용처, 구 코드 대비 grep 확인)과 문자 그대로 동일해 **wire 로 나가는 실제 값은 바뀌지 않았다** — 클라이언트에 대한 외부 관측 가능한 부작용 없음. `codebase/backend/src/modules/websocket/websocket.service.ts` 가 이 모듈의 다른 심볼들을 재-export 하고 있으나(grep 확인), `MSG_AUTH_TOKEN_EXPIRING` 은 그 재-export 목록에 포함돼 있지 않다 — 의도된 범위(gateway + 테스트만 소비) 밖으로 우연히 새어나가는 표면은 없다.
  - 제안: 조치 불요.

- **[INFO]** 테스트의 `jest.spyOn(global, 'setTimeout')` — 전역 함수를 직접 스파이하는 부작용이 있으나 `try/finally` 로 격리·복원됨(교차-테스트 오염 없음)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:884-897` (`만료 타이머는 unref 된다` 테스트)
  - 상세: `jest.spyOn(global, 'setTimeout')` 은 그 자체로 전역 상태를 변경하는 행위이지만, 같은 테스트 내에서 `try { … } finally { spy.mockRestore(); }` 로 감싸 예외 발생 시에도 복원이 보장된다(RESOLUTION.md #6 조치 확인). 또한 이 테스트가 속한 `describe('토큰 만료 — 사전 통지 후 disconnect (§1.2)', …)` 블록은 `beforeEach(() => jest.useFakeTimers())` / `afterEach(() => jest.useRealTimers())` 로 fake timer 상태도 블록 단위로 격리한다(`websocket.gateway.spec.ts:723-728` 직접 확인) — 다른 describe 블록·다른 스펙 파일로 전역 타이머 mock 이 새어나갈 경로는 없다.
  - 제안: 조치 불요 — 격리가 올바르게 이뤄져 있음을 확인 기록.

- **[INFO]** JSDoc 오귀속(2건, `armExpiryTimers`/`AuthTokenExpiredPayload`) — side-effect 관점에서는 런타임 영향 없음, 이미 architecture/documentation/maintainability/scope 리뷰어가 각각 WARNING 으로 상세 보고
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:161-241`, `codebase/backend/src/modules/websocket/websocket-events.types.ts:287-315`
  - 상세: 이 결함은 "함수의 동작"이 아니라 "문서가 어느 심볼에 귀속되는가"의 정적 배치 문제이며, 프로세스 상태·전역 변수·파일시스템·네트워크·이벤트 발화 어느 것도 바꾸지 않는다. 본 관점(side effect)에서는 해당 없음으로 판단해 중복 기재하지 않고, 이미 다른 리뷰어가 담당한 것으로 넘긴다.
  - 제안: 없음(해당 리뷰 관점 밖).

## 저장소 뮤테이션

본 리뷰는 저장소 파일을 뮤테이션하지 않았다. 소스는 `Read`/`grep` 으로만 열람했다. `git status --short` 를 실행할 필요가 있는 쓰기 작업 자체가 없었다.

## 요약

이번 diff 는 WS 소켓 만료 타이머 관리를 순수 내부 리팩터/하드닝으로 정리한 것으로, 부작용 관점에서 우려할 만한 항목은 대체로 **의도되고 문서화된** 것들이다. 유일하게 실질적인 프로세스 수준 부작용은 `setTimeout(...).unref()` — event loop 유지 여부라는 프로세스 전역 판단에 개입해 그레이스풀 셧다운 중 만료 콜백이 미실행될 수 있는 창을 여는 것인데, 이는 코드 주석과 plan 문서 양쪽에 이미 트레이드오프로 명시·추적되고 있어 "의도치 않은" 부작용으로 분류하지 않는다. `armExpiryTimers` 진입부의 선제 해제는 오히려 좀비 타이머(의도치 않은 부작용의 원천)를 제거하는 방향이다. 타입 변경(`expiryTimers` non-optional화)과 신규 상수(`MSG_AUTH_TOKEN_EXPIRING`) export 는 모두 private/additive 라 외부 시그니처·인터페이스·wire 값에 영향이 없다. 테스트의 `jest.spyOn(global, 'setTimeout')` 은 전역을 건드리지만 `try/finally` + 블록 단위 fake-timer 격리로 오염 없이 복원된다. 환경 변수 읽기/쓰기, 예상치 못한 파일시스템 접근, 신규 네트워크 호출, 공개 함수 시그니처 파괴적 변경은 발견되지 않았다.

## 위험도

LOW
