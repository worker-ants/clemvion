# 부작용(Side Effect) 리뷰

## 범위 및 방법

이 diff 는 `origin/main` 대비 3개 커밋(`69aad5d5d`→`b75e6a76b`→`80ac92668`)의 누적분이며, 같은
주제로 이미 side-effect 관점 리뷰가 2라운드(`review/code/2026/09/03/11_57_58/side_effect.md`,
`review/code/2026/09/03/12_16_24/side_effect.md`) 진행되어 발견사항이 각각 RESOLUTION 커밋으로
반영돼 있다. 본 라운드는 (1) 이전 라운드가 잡은 WARNING 이 실제로 해소됐는지 소스를 직접 `Read`
로 재검증하고, (2) 이전 라운드가 놓친 새 부작용이 있는지 독립적으로 재분석했다. 저장소 파일은
뮤테이션하지 않았다(정적 분석 + 소스 직접 대조만 수행) — `git status --short` 는 확인 불필요.

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 검증·참고용 INFO.

- **[INFO]** (검증 완료) 2R WARNING "`unref()`·그레이스풀 셧다운 상호작용이 배포 런북에 이미
  추적 중이라는 주장이 근거 없다" — 실제로 정정됐다.
  - 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:169-180` (신규 체크리스트
    항목), 근거 코드: `codebase/backend/src/modules/websocket/websocket.gateway.ts:224-225`
    (`notice.unref(); cutoff.unref();`)
  - 상세: 2R reviewer 가 "추적한다고 적으면서 추적처를 만들지 않았다" 고 지적한 뒤,
    `80ac92668` 커밋이 plan 문서에 `[ ] **셧다운 중 만료 콜백 미실행** (리뷰 2R W1)` 항목을
    실제로 신설했다(`:169`). 파일을 직접 열어 대조한 결과, 이 항목은 (a) `unref()` 의 실질
    영향("정상 종료 시 소켓 자체가 소멸하므로 실질 영향은 없다고 보지만, 그레이스풀 드레인 중
    사전 통지를 못 받는 창이 생긴다")을 정확히 서술하고, (b) 재개 조건("관측되면 `unref` 를
    걷고 셧다운 훅에서 명시적으로 해제")까지 명시하며, (c) 이 항목이 만들어진 배경(1R 의 허위
    주장을 2R 이 반증)을 인용문으로 남겨 재발을 방지한다. `WebsocketGateway` 자체는
    `onModuleDestroy`/`onApplicationShutdown` 을 구현하지 않아(grep 확인) 셧다운 훅이 이
    타이머들을 명시적으로 배수하지 않는다는 사실도 실측과 일치한다 — 문서상 보장이 이제 실제
    코드/추적 상태와 정확히 일치한다.
  - 제안: 조치 불요. 이 항목이 unchecked 로 남아 있는 한 배포 런북에 실제 문구가 아직
    반영되지 않았다는 뜻이므로, 다음에 이 파일을 만질 때(또는 배포 전) 실제 런북 문서에도
    반영할 것.

- **[INFO]** `setTimeout(...).unref()` 도입 — 이벤트 루프 keep-alive 의미를 바꾸는 유일한 실질
  런타임 부작용(위 항목과 동일 코드, 별도 각도)
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:224-225`
    (`armExpiryTimers` 내부)
  - 상세: 이전에는 이 타이머들이 ref 상태라 살아있는 동안 Node 프로세스가 종료되지 않았다
    (최악 900초). `unref()` 이후에는 이 타이머만 남아도 이벤트 루프가 비었다고 판단해
    프로세스가 먼저 종료될 수 있다 — `notice`(사전 통지 emit)·`cutoff`(강제 disconnect)
    콜백이 발화 전에 프로세스가 죽을 수 있다는 뜻이다. 이 트레이드오프 자체는 의도된 것이고
    (셧다운 hang 방지가 목적), 전용 테스트(`websocket.gateway.spec.ts:876-892`,
    `hasRef()===false` 단언, `try/finally` 로 spy 정리 보장)로 뮤테이션 검증도 됐다.
  - 제안: 조치 불요 — 위 항목이 이미 재개 조건을 명시했으므로 중복 조치 없음.

- **[INFO]** `armExpiryTimers` 진입부의 선제 `clearExpiryTimers(client.id)` — 매 `handleConnection`
  마다 실행되는 새 부수 호출이지만 현재는 no-op
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:183`
    (`this.clearExpiryTimers(client.id);`, 조기 `return`(`:185`) **이전**에 위치)
  - 상세: `armExpiryTimers` 호출부는 `handleConnection`(`:274`) 한 곳뿐이다(grep 확인). Socket.IO
    가 연결마다 새 `client.id` 를 발급하는 현재 설정에서는 `clearExpiryTimers` 가 매번
    `Map.get` 실패로 조기 return 하는 순수 no-op 이라 다른 소켓의 타이머 상태를 건드릴
    경로가 없다. 조기 `return`(`exp` 없는 토큰) **이전**에 배치돼 있어, `exp` 없는 토큰으로
    재무장하는 조합에서도 옛 타이머 쌍이 누락 없이 해제된다 — 이 배치가 1R 에서 한 차례
    회귀(조기 return 뒤에 배치)했다가 정정된 이력이 있음을 `websocket.gateway.ts:180-182`
    인라인 주석과 `RESOLUTION.md`(1R, `## W3`)로 교차 확인했다.
  - 제안: 조치 불요. `connectionStateRecovery` 활성화 시 이 경로가 load-bearing 해지므로
    그 시점에 재검증할 것(이미 plan/이전 라운드에 기록됨).

- **[INFO]** `expiryTimers` 필드 타입 optional → non-optional 화, `clearExpiryTimers` 추출 —
  둘 다 `private` 표면 안이라 호출자 영향 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:156-159`(필드),
    `:235-241`(`clearExpiryTimers` 신규 private 메서드)
  - 상세: 두 심볼 모두 `private` 이고 클래스 내부(`armExpiryTimers`/`handleDisconnect`)에서만
    참조된다(grep 확인 — 클래스 밖 참조 없음). 시그니처·공개 인터페이스 변경에 해당하는
    항목(점검 관점 4·5)에 해당하지 않는다. `handleDisconnect`(`:317`)의 기존 인라인 해제
    로직(`if (timers) { if (timers.notice) … if (timers.cutoff) … }`)이 `clearExpiryTimers`
    호출로 대체됐고, 동작은 동일함(둘 다 항상 함께 set 되므로 옛 `if (timers.notice)` 가드는
    원래도 도달 불가능한 죽은 코드였다).
  - 제안: 조치 불요.

- **[INFO]** 신규 export `MSG_AUTH_TOKEN_EXPIRING` — 순수 additive, wire 값 불변
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:314-315`
  - 상세: 새 `export const`. 소비처는 `websocket.gateway.ts`(`:26`, import)와
    `websocket.gateway.spec.ts`(`:8`, import) 두 곳뿐(grep 확인)이며 이름 충돌 없음. 상수값
    자체는 이전 리터럴(`'Access token expires soon — refresh and reconnect.'`)과 문자 그대로
    동일해, 실제로 wire 로 나가는 `auth.token_expired` 페이로드의 `message` 필드 값은 이번
    diff 전후로 변하지 않는다 — 리터럴을 단일 SoT 상수로 옮긴 것뿐이다. `websocket.service.ts`
    의 curated re-export 목록(`:38-43`)에는 포함되지 않지만, 소비처가 모두 원본 모듈을 직접
    import 하므로 기존 import 경로에 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** JSDoc 오귀속(1R WARNING 3건) — 소스 재확인 결과 완전히 정정됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:147-241`,
    `codebase/backend/src/modules/websocket/websocket-events.types.ts:287-315`
  - 상세: 1R architecture/documentation/maintainability 리뷰가 지적한 "새 심볼이 기존 JSDoc
    과 그 대상 선언 사이에 끼어들어 문서가 엉뚱한 심볼에 붙었다"는 문제를, 소스를 직접 읽어
    재확인했다. 현재는 `armExpiryTimers` 의 §1.2 JSDoc(`:161-175`)이 `armExpiryTimers` 선언
    (`:176`) 바로 위로 복원됐고, `clearExpiryTimers` 는 자신의 새 JSDoc(`:230-234`)만 갖는다.
    `MSG_AUTH_TOKEN_EXPIRING` 도 `AuthTokenExpiredPayload` 인터페이스(`:302-305`) **뒤**로
    옮겨져(`:307-315`) 원래 JSDoc(`:287-301`)이 그 인터페이스에 다시 인접한다. 런타임 부작용은
    처음부터 없었던 항목(문서 도구 표면)이지만, 이 항목이 실제로 닫혔음을 side-effect 관점에서
    도 확인해 둔다.
  - 제안: 조치 불요.

## 재확인하지 않은 항목 (기존 리뷰가 이미 다룸, 중복 생략)

- INFO#3(1R testing) unref 테스트의 타이머 선별이 느슨했던 문제 — 이미 `toHaveLength(2)` +
  전수 순회로 정밀화됨, 소스로 확인.
- INFO(1R side_effect) rearm 테스트가 합계로만 단언 — 이미 개별(oldEmits/newEmits) 단언으로
  교체됨, 소스로 확인.
- `jest.spyOn(global, 'setTimeout')` 이 `try/finally` 없이 `mockRestore()` 에만 의존하던 문제 —
  이미 `try { … } finally { spy.mockRestore(); }` 로 감싸짐, 소스로 확인.

## 요약

이번 diff(누적 3커밋)에서 부작용 관점의 실질적 런타임 변화는 `setTimeout(...).unref()` 도입
(이벤트 루프 keep-alive 의미 변경 — 그레이스풀 셧다운 중 사전 통지/강제 종료 콜백이 발화 전에
프로세스가 죽을 수 있음)과 `armExpiryTimers` 진입부의 선제 `clearExpiryTimers` 호출(현재는
no-op, `connectionStateRecovery` 도입 시 load-bearing) 두 가지뿐이며, 둘 다 의도적으로 설계·
테스트·문서화됐다. 나머지 변경(타입 non-optional 화, `clearExpiryTimers` 추출, 상수 승격)은
모두 `private` 표면 또는 순수 additive export 안에 갇혀 있어 호출자·공개 API 영향이 없다. 특히
직전 라운드(2R)가 지적한 "unref·셧다운 트레이드오프가 배포 런북에 이미 추적 중"이라는 허위
주장은, 소스를 직접 대조한 결과 정정 커밋(`80ac92668`)이 plan 문서에 실제 추적 항목을 신설해
해소했음을 확인했다. 새로 발견된 CRITICAL/WARNING 급 부작용은 없다.

## 위험도

NONE
