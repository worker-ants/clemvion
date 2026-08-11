# 부작용(Side Effect) Review — `side_effect`

대상: 웹채팅 위젯 재로드 REST 오류 분기(§3.1-2·§R4) + 토큰 로그 redaction 후속 PR.
prompt 가 크기 제한으로 파일 5~8(`use-token-refresh.{ts,test.ts}`·`use-widget-eager-start.test.ts`·
`use-widget.ts`)의 diff 를 생략해, 해당 4개 파일은 `git diff origin/main -- <path>` 로 직접 원본을
열어 확인했다(위치 표기는 그 실제 파일의 1-기준 줄 번호). `review/code/2026/08/10/*/**` 하위 21개
라운드분 문서·`plan/**` 링크 정정·`CHANGELOG.md` 는 전부 문서 산출물이라 부작용 관점에서는 해당 없음
(정적 텍스트, 코드 실행 경로 없음) — 아래 발견사항에서 제외했다.

## 발견사항

- **[WARNING]** `runApplyConfig` 의 `.catch()` 가 실패를 로그로만 남기고, `start()` 의 동일 실패
  경로가 하는 **위젯 상태 전이(`ERROR` dispatch)를 하지 않는다** — 이 PR 자신이 반복해 지목한
  "한쪽만 고친다" 패턴의 재발.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1243-1247`(`runApplyConfig` 정의) ·
    `:1181-1227`(`applyConfig` 세션 복원 분기, `openStream` 동기 throw 지점은 `:1223`) ·
    `:1187`(`dispatch({ type: "RESTORED", ... })`, `phase → "streaming"`) · 대조군 `:801-873`
    (`start()` — 같은 클래스의 실패를 `:865-871` `catch (e) { ...; dispatch({ type: "ERROR", ... }) }`
    로 처리).
  - 상세: `applyConfig` 의 세션 복원 분기는 `dispatch({ type: "RESTORED", ... })`(`:1187`, phase
    를 `"streaming"` 으로 — CHANGELOG 서술상 "AI 응답 중" 스피너)를 **먼저** 실행한 뒤에야
    `openStream(live, "0")`(`:1223`)을 호출한다. `openStream` 이 동기 throw 하면(`new EventSource`
    실패 — 이 PR 이 직접 `throwOnce` 로 시뮬레이션하는 시나리오) 그 예외는 `applyConfig` 함수 밖으로
    빠져나가 `runApplyConfig` 의 `.catch()` 로 떨어지는데, 거기서 하는 일은
    `console.warn("[widget] boot config 적용 실패:", redactToken(...))` 뿐이다 — **어떤 상태
    전이도, 어떤 재시도 예약도 없다.** 그 시점 `scheduleRefresh()`(`:1226`)는 이미 지나쳐 도달하지
    못했으므로 이 세션에 대한 주기 갱신 예약조차 걸리지 않는다. 결과: 위젯은 "streaming" phase(스피너)
    에 SSE 연결도 없고 복구 수단도 없이 **무기한 고착**된다 — 이 PR 전체가 없애려던 바로 그 "streaming
    고착" 버그 클래스의 새 진입점이다.
    이 상태 자체(에러 시 UI 상태 미전이)는 `.catch()` 추가 이전에도 동일했다(예전엔 unhandled
    rejection 이었을 뿐, 그때도 `applyConfig` 안에 이 throw 를 잡아 상태를 되돌리는 코드는 없었다) —
    그래서 이 diff 가 **상태 고착 자체를 새로 만든 것은 아니다.** 그러나 이 diff 는 그 실패의
    **가시성을 낮췄다**: 이전엔 브라우저 기본 "Uncaught (in promise)" 로 무조건 눈에 띄었고(다른
    `console.warn` 들과 섞이지 않는 별도 채널), 지금은 이 파일에 이미 여럿 있는 평범한
    `console.warn` 진단 로그 중 하나로 묻힌다. 마지막으로 catch 이 조용히 실패를 삼키면서도, 이
    특정 실패에 대한 회귀 테스트는 존재하지 않는다 — `use-widget-eager-start.test.ts` 의
    `throwOnce` 테스트 2건은 각각 `start()` 경로(`§보안: start() 경로의 스트림 오픈 실패...`)와
    `resumeDeferredStreamRef` 경로(`§R4: 미뤄 둔 스트림 오픈이 던져도...`)만 겨냥하고,
    `applyConfig` 세션 복원 분기의 `openStream` throw 는 어느 테스트도 재현하지 않는다(확인:
    `grep -n "applyConfig" use-widget-eager-start.test.ts` 결과에 이 throw 시나리오 없음).
  - 제안: `applyConfig` 의 이 지점도 `start()` 와 대칭으로 만들 것 — 최소한 (a) `openStream` 호출을
    `applyConfig` 내부 try/catch 로 감싸 `finalizeEnded`/`dispatch({ type: "ERROR", ... })` 등 UI 에
    보이는 상태로 귀결시키거나, (b) `resumeDeferredStreamRef` 처럼 재시도 가능한 경로로 전환(플래그
    세우고 다음 주기 갱신에 재시도)할 것. 그리고 `throwOnce` 를 `applyConfig`(bridge boot 또는
    query-fallback boot) 경로에도 걸어 이 지점을 명시적으로 겨냥하는 회귀를 추가할 것.

- **[WARNING]** SSE `onError` 로그가 실제로는 **거의 항상 상수 문자열**이 되어 진단 가치를 잃었다 —
  redaction 자체는 정당하지만 구현이 필요 이상으로 정보를 지웠다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:477-481`.
    ```
    onError: (e) =>
      console.warn(
        "[widget] SSE stream error — /api/external/* CORS(WEB_CHAT_WIDGET_ORIGINS)·네트워크 확인:",
        e && typeof e === "object" && "type" in e ? String((e as { type: unknown }).type) : "error",
      ),
    ```
  - 상세: `EventSource` 의 네이티브 `error` 이벤트는 스펙상 `type` 프로퍼티가 **항상 리터럴
    `"error"`** 다(분기가 없다 — CORS 거부든 네트워크 순단이든 동일). 즉 이 콜백을 거치는 실사용
    경로에서 두 번째 인자는 사실상 항상 고정 문자열 `"error"` 로 찍히고, 앞의 안내 문자열이 이미
    "SSE stream error" 라고 말하고 있으므로 **추가 정보량이 0 에 수렴**한다. 원본 코멘트가 밝힌
    redaction 사유(“`e.target.url` 에 토큰이 실린 스트림 URL 이 들어 있다”)는 타당하지만, `target.url`
    만 위험할 뿐 `target.readyState`(0/1/2, 토큰 비포함 숫자)는 안전하면서도 "지금 재연결
    시도 중인가(`CONNECTING`=0) vs 완전히 닫혔는가(`CLOSED`=2)" 를 구분해 준다 — 바로 위 주석이
    말하는 "EventSource 는 자동 재연결하므로 흐름은 유지" 문구와 직결되는, CORS/네트워크 장애
    진단에 실질적으로 쓰이는 축이다. 지금 구현은 그 안전한 정보까지 함께 버렸다.
    테스트(`§보안: SSE onError 는 원본 이벤트를 찍지 않는다`, `use-widget-eager-start.test.ts`)도
    "토큰이 안 남는다" 만 단언하고 "그래도 유용한 정보가 남는가" 는 검증하지 않아, 이 정보 손실이
    회귀 스위트로 가려지지 않는다.
  - 제안: `e.target instanceof EventSource`(또는 duck-typing) 로 `readyState` 를 안전하게 꺼내
    같이 로깅. 최소한 `e.type` 대신 `e.target?.readyState` 를 쓰는 것만으로도 토큰 노출 없이 진단
    가치를 크게 회복한다.

- **[INFO]** `use-token-refresh.test.ts` 의 `shouldAdvanceTime` 제거는 검증 결과 안전하다 —
  프로덕션 부작용 없음.
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.test.ts:68-74`
    (`vi.useFakeTimers({ shouldAdvanceTime: true })` → `vi.useFakeTimers()`).
  - 상세: 이 옵션은 가상 시계를 실경과시간에 얹어, `waitFor`(RTL 폴링, 실시간 기반)와 결합될 때만
    필요하다. `grep -n "waitFor"` 결과 이 테스트 파일은 `waitFor` 를 전혀 import/사용하지 않고
    전부 `advanceTimersByTimeAsync` 로 시계를 직접 몬다 — 코멘트가 주장하는 전제("이 파일은
    `shouldAdvanceTime` 이 애초에 불필요")가 실측과 일치한다. 자매 파일
    `use-widget-eager-start.test.ts` 는 `waitFor` 를 쓰는 테스트가 있어 여전히
    `shouldAdvanceTime: true` 를 유지(`:490,550,598,655,817,1366`) — **선택적 축소**이지 전체
    파일 규약을 흔든 것이 아니다. `vitest run use-token-refresh.test.ts` 재실행 결과 21/21 통과.
    코드 상태 변경·전역 변수·파일시스템·네트워크 부작용 없음 — 순수 테스트 설정.

## 그 외 점검 (해당 diff 범위 — CRITICAL 없음)

- `eia-client.ts` 의 신규 export `isTerminalAuthError`(순수 판별 함수)·`redactToken`(선형 정규식
  `/([?&]token=)[^&\s"']+/gi` — 중첩 정량자 없어 ReDoS 위험 없음, 부수효과 없는 순수 문자열 치환).
  기존 시그니처 변경 없이 named export 추가뿐이라 기존 호출자 영향 없음.
- `session-store.ts` 의 신규 export `applyRefreshedToken` — `saveSession` 호출(storage 쓰기)은
  함수 목적 자체이자 JSDoc 이 명시한 의도된 부작용이고, 두 호출부(`use-widget.ts`
  `recoverFromExpiredToken`·`use-token-refresh.ts` 갱신 성공 분기)가 각자 복제하던 로직을 대체할
  뿐 새 저장 대상·새 storage key 를 추가하지 않는다.
  - `use-token-refresh.ts` 의 `useTokenRefresh({..., onRefreshed})` — `onRefreshed` 는 optional
    필드로 추가돼 기존 호출자(있었다면)와 호환. 실제 호출자는 `use-widget.ts` 단 하나이고 그 자리에서
    바로 새 인자를 채워 넘긴다.
  - `onRefreshedRef.current?.(updated)` 호출을 `try/catch` 로 감싸 소비자 예외가 refresh 성공
    판정(`then`/`catch` 체인)을 오염시키지 않게 막은 것(`use-token-refresh.ts:163-176` 부근)은
    올바른 방향의 방어 — 다만 catch 안의 `console.warn` 도 `redactToken` 을 거쳐 토큰 노출 없음을
    확인.
  - `onRefreshedRef.current = onRefreshed;` 를 `useEffect` 가 아니라 렌더 본문에서 직접 대입하는
    패턴(`use-token-refresh.ts:112`)은 idempotent 대입이라(같은 렌더에서 여러 번 실행돼도 최종값이
    같다) React 동시성 모드에서도 안전한 통용 "latest ref" 관용구이며, 이 파일이 이미 동일 클래스
    패턴(`seedWaitingFromStatusRef.current = ...`)을 다른 자리에서 쓰고 있어 새로운 위험은 아니다 —
    참고로만 남기고 발견사항으로 올리지 않았다.
  - `plan/**`·`CHANGELOG.md`·`review/code/2026/08/10/**` 의 변경은 전부 마크다운 텍스트(링크 경로
    정정, 회고 로그 신설)로 실행 경로가 없어 부작용 점검 대상에서 제외.

## 요약

이번 delta 의 핵심 프로덕션 부작용은 두 곳이다. 첫째, `runApplyConfig` 의 `.catch()` 는 토큰 노출은
막았지만(redaction 적용은 정확) 실패 시 `start()` 와 달리 아무 위젯 상태 전이도 하지 않아, 세션
복원 분기의 `openStream` 동기 throw 가 발생하면 "streaming" 스피너에 무기한 고착되는 이 PR 자신이
고치려던 버그 클래스를 새 진입점으로 재현할 수 있고, 그 경로는 회귀 테스트도 없다. 둘째, SSE
`onError` 로그는 redaction 의도는 옳으나 `e.type` 이 실질적으로 상수라 진단 가치가 거의 0 으로
떨어졌다 — `readyState` 같은 비민감 필드로 쉽게 보강 가능했다. 나머지(`shouldAdvanceTime` 제거,
`isTerminalAuthError`/`redactToken`/`applyRefreshedToken` 신규 export, `onRefreshed` optional
파라미터)는 검증 결과 부작용이 없거나 의도된 것으로 확인됐다.

## 위험도

MEDIUM
