# 부작용(Side Effect) Review — 후속 검증 (순서 변경이 새 결함을 만들었는가)

직전 라운드(`17_55_57`)의 WARNING(낙관적 클리어 + `onRefreshed` 예외 미격리) 수정분을 실제 소스로
재검증했다. 지시받은 두 가지 — (1) `openStream` 이 `"already_owned"` 를 돌려줘도 플래그를 지우는 것,
(2) throw 후 의사가 남아 매 갱신마다 재시도하는 것이 무한 루프인가 — 를 각각 근거를 들어 판정한다.
결론: **둘 다 신규 결함이 아니다.** 다만 이 재검증 과정에서 별개의 미세한 비대칭(사각지대, INFO)을
하나 남긴다.

## 검증한 코드

- `codebase/channel-web-chat/src/widget/use-widget.ts:741-761` — `resumeDeferredStreamRef` 재개 클로저.
  현재 순서: `749` `if (!deferredStreamRef.current) return;` → `758` `openStream(session, "0");`
  (반환값 미검사) → `759` `deferredStreamRef.current = false;`(무조건, `openStream` 이 정상 반환한
  경우에만 도달).
- `codebase/channel-web-chat/src/widget/use-token-refresh.ts:163-190` — `.then()` 성공 분기.
  `167` `onRefreshedRef.current?.(updated)` 를 `165-174` try/catch 로 감쌌고, catch 는 `console.warn`
  만 하고 **재throw 하지 않는다**. catch 뒤 `174` `scheduleWithDelay()`(인자 없음 → `failuresRef` 리셋,
  다음 만료 기준 정상 재예약)가 무조건 실행된다.
- `codebase/channel-web-chat/src/lib/eia-client.ts:130` — `client.openStream` 내부 `new URL(...)` 이
  malformed `endpoints.stream`/`apiBase` 조합에 **동기적으로 throw** 할 수 있는 지점(순서 변경의 전제).
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:615-669` — 이 정확한 시나리오
  ("미뤄 둔 스트림 오픈이 던져도 다음 갱신이 다시 시도한다")를 겨냥한 회귀. 첫 `new EventSource` 만
  던지도록 fixture 를 분기시켜, 1단계(throw)에서 `getEs()` 가 `null` 로 남고 2단계(다음 정상 갱신
  주기)에서 열리는지를 단계를 끊어 확인한다.

## 발견사항

- **[INFO]** `already_owned`/`no_client` 반환에도 플래그를 무조건 지우는 것 — 의도된 동작, 회귀 아님
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:749-759`(`resumeDeferredStreamRef`)
  - 상세: `deferredStreamRef.current` 가 `true` 로 남는 유일한 트리거는 "아직 시도 안 함" 또는
    "시도했는데 `openStream` 이 던졌음" 둘뿐이다. `openStream` 호출이 **정상 반환**했다는 것은 곧
    (a) `"opened"` — 이번 호출이 실제로 스트림을 열었으니 의사를 지우는 게 맞고, (b) `"already_owned"`
    — `streamRef.current !== null` 이미 다른 경로(`start()`/`applyConfig()`)가 **실제 살아있는 스트림**을
    갖고 있다는 뜻이므로 이 의사는 더 이상 유효한 "열어야 할 스트림"이 없는 상태다(무언가는 이미
    열려 있다) — 지워도 안전하고, 지우지 않으면 그 다음 갱신마다 매번 `openStream` 을 호출해 매번
    `already_owned` 로 no-op 되는 낭비만 반복된다(정정 자체가 목적). (c) `"no_client"` 는 `clientRef.current`
    가 `establishConfig()`(`:1115`, `clientRef.current = new EiaClient(...)`)에서 한 번 설정된 뒤 코드
    전체에 재-null 대입 지점이 없어(grep 확인) 이 콜백이 불릴 수 있는 시점(세션이 이미 존재 → 최초
    `applyConfig` 완료 이후)에는 사실상 도달 불가능하다. 결정적으로 이 세 반환값에 대한 처리(무조건
    지움)는 **이번 순서 변경으로 달라진 것이 아니다** — 지난 라운드(`17_55_57`)에서도 반환값은 검사하지
    않고 무조건 지웠고(그때는 `openStream` 호출 *이전*에 지웠을 뿐), 이번엔 그 무조건 지움이 `openStream`
    *이후*로 옮겨졌을 뿐 대상 반환값 자체에 대한 조건 분기는 원래도 없었다. 즉 `already_owned` 관련
    동작은 순서 변경의 부작용이 아니라 애초부터 있던(그리고 올바른) 설계다.
  - 제안: 없음. 필요하다면 `already_owned` 케이스를 겨냥한 회귀(동시에 다른 경로가 스트림을 이미 연
    상태에서 `resumeDeferredStreamRef` 가 호출돼도 이중 오픈이 없음을 확인)를 추가하면 이 INFO 를
    회귀로 승격할 수 있으나, `openStream` 자신의 소유권 게이트(`:457` `if (streamRef.current !== null)
    return "already_owned"`)가 이미 이중 오픈을 원천 차단하므로 우선순위는 낮다.

- **[INFO]** throw 후 재시도는 무한 루프가 아니다 — 갱신 주기에 종속된 유계(bounded) 재시도이고, 의도적으로 설계·테스트됨. 다만 상한/에스컬레이션이 없는 유일한 실패 경로라는 비대칭은 남는다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:754-759`(순서·근거 주석), `codebase/channel-web-chat/src/widget/use-token-refresh.ts:163-174`(try/catch + 무조건 재예약), `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:626-669`(회귀)
  - 상세: "매 갱신마다 계속 재시도"는 사실이지만 **바쁜 루프(busy loop)가 아니다** — 재시도 간격은
    `refreshDelayMs`(다음 토큰 만료 기준, 통상 수십 분~시간 단위)에 종속되고, `openStream` 의 throw 는
    `use-token-refresh.ts:165-174` 의 try/catch 에서 **소비되고 재throw 되지 않으므로** 이 예외가
    refresh 자체의 실패로 오분류되지도, 예외가 상위로 전파돼 앱을 깨뜨리지도 않는다(이것이 바로
    이번 라운드가 고친 지점). `deferredStreamRef.current` 가 throw 시 `false` 로 내려가지 않고 유지되는
    것도 의도된 설계다 — 지워버리면(이전 버전의 결함) 이후 갱신이 아무리 성공해도 영구히 스트림을
    다시 열지 않는 "조용한 고착"이 되므로, 유지하는 편이 유일하게 회복 가능한 설계다. 이 정확한
    시나리오가 `use-widget-eager-start.test.ts:626-669` 에 회귀로 고정돼 있고("throw 뒤 다음 주기에
    열린다"), 뮤테이션 관점에서도 "throw 후 플래그를 지우면" 이 테스트가 잡아낸다.
  - 남는 비대칭(에스컬레이션 없음, 별도 항목이 아니라 참고용): 같은 파일 내 다른 두 실패 경로 —
    `use-token-refresh.ts` 의 네트워크/5xx 재시도는 지수 백오프(`retryDelayMs`, 상한
    `TOKEN_REFRESH_RETRY_MAX_DELAY_MS`=5분)로 **속도 제한**되고, `recoverFromExpiredToken`(`use-widget.ts:520-552`)
    의 `401`/`410` 은 재시도 없이 **`finalizeEnded`로 확정 종료**된다 — 은 이 `resumeDeferredStreamRef`
    의 throw 재시도만 **상한도 없고 종료 에스컬레이션도 없다**(정상 만료-갱신 주기마다 영원히 재시도).
    다만 트리거 조건(세션이 이미 정상 수립된 뒤 `client.openStream` 의 `new URL()` 이 던질 만큼
    `endpoints.stream`/`apiBase` 가 손상됨)이 현재 코드 경로상 사실상 도달 불가능에 가깝다 —
    `clientRef.current`(`apiBase` 보유)와 세션의 `endpoints` 는 둘 다 최초 수립 후 재변형되는 지점이
    없다(grep 확인). 따라서 CRITICAL/WARNING 이 아니라 참고용 INFO로만 남긴다.
  - 제안: 없음(현재 설계·테스트로 충분). 향후 다섯 번째 실패 갈래가 생기거나 `endpoints`/`apiBase`
    가 세션 수립 후 변경 가능해지는 리팩터가 들어오면, 이 경로에도 상한(예: N회 연속 throw 후
    `finalizeEnded`)을 고려할 근거가 생긴다는 점만 코드 근처(`use-widget.ts:754` 주석 인근)에
    메모해 두면 재조사 비용을 아낀다 — 강제 사항은 아니다.

## 요약

지시받은 두 우려 모두 실제 결함으로 이어지지 않았다. `already_owned`/`no_client` 시 플래그를 무조건
지우는 로직은 이번 순서 변경과 무관하게 원래부터 있던 설계이고, 세 반환값 모두에서 "지우는 것"이
의미상 올바르다(스트림이 이미 열려 있거나, 이번 호출로 열렸거나, 열 수단 자체가 없는 경우이므로).
throw 후 재시도는 무한/바쁜 루프가 아니라 정상 토큰 갱신 주기에 종속된 유계 재시도이며, `use-token-refresh.ts`
의 try/catch 가 예외를 refresh 실패로 오분류하는 것을 정확히 차단하고, 이 정확한 시나리오를 겨냥한
회귀 테스트(`use-widget-eager-start.test.ts`)가 존재한다. 남는 것은 이 특정 실패 경로에만 상한/종료
에스컬레이션이 없다는 비대칭인데, 트리거 조건이 현재 코드 경로상 사실상 도달 불가능해 심각도를
INFO 로 판단했다. 이번 두 수정(순서 변경 + try/catch 격리)은 직전 라운드 WARNING 을 정확히 해소했고
새 CRITICAL/WARNING 급 부작용을 만들지 않았다.

## 위험도

NONE
