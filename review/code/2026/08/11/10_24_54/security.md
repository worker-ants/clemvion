# 보안(Security) Code Review

대상: 웹채팅 위젯 재로드 REST 오류 분기 3종(§3.1-2·§R4) + 이전 라운드 WARNING 2건 반영분
(`eia-client.test.ts` 위협 모델 문장 정정, `applyConfig` 경로 stale-token 회귀 추가) + 그 외
plan/review 산출물·spec 상태 갱신.

## 확인 요청 3건에 대한 결론

### (a) `sseErrorDetail` — `readyState` 만 남기고 토큰·URL 유출 여지가 없는가

`codebase/channel-web-chat/src/widget/use-widget.ts:470-477`(함수 `sseErrorDetail`)을 직접
읽어 확인했다.

```ts
function sseErrorDetail(e: unknown): string {
  const target = e && typeof e === "object" ? (e as { target?: unknown }).target : null;
  const readyState =
    target && typeof target === "object" && "readyState" in target
      ? (target as { readyState: unknown }).readyState
      : null;
  return readyState === null ? "error" : `error (readyState=${String(readyState)})`;
}
```

- 접근하는 필드는 `e.target.readyState` **하나뿐**이다. `EventSource` 의 `error` 이벤트 객체가
  들고 있는 `target.url`(토큰이 쿼리로 실린 스트림 URL, `eia-client.ts` `openStream` 참조)에는
  전혀 접근하지 않는다 — 필드명을 오타·확장해도 `readyState` 외 다른 키를 읽는 코드 경로가 없다.
- 호출부(`openStream` 의 `onError`, `use-widget.ts:496-500`)도 `sseErrorDetail(e)` 의 **반환
  문자열만** `console.warn` 에 넘긴다 — 원본 이벤트 객체 `e` 자체를 로그에 함께 찍지 않는다(예:
  `console.warn(msg, e)` 형태가 아님). 원본 이벤트를 함께 찍으면 devtools 콘솔이 그 객체를
  펼쳐 `target.url` 을 노출할 수 있는데, 그 경로가 없다.
- `readyState` 값 자체는 `0|1|2` 정수이거나(EventSource 스펙) 임의 객체에 `readyState` 키가
  있으면 `String()` 으로 강제 문자열화되지만, 토큰·URL 이 그 필드에 들어올 길이 없다(EventSource
  구현이 이 필드를 그렇게 채우지 않음).

결론: 이 함수·호출 경로로 토큰·URL 이 샐 여지는 없다. **안전 확인.**

### (b) `dispatch({type:"ERROR", message: errMessage(e)})` — UI 에 원문이 노출되는 경로가 생겼는가

`errMessage` 정의(`use-widget.ts:1345-1358`)를 확인했다.

```ts
const GENERIC_ERROR_MESSAGE = WIDGET_STRINGS.ko["error.generic"];

function errMessage(e: unknown): string {
  console.warn("[widget] conversation error:", redactToken(e instanceof Error ? e.message : String(e)));
  return GENERIC_ERROR_MESSAGE;
}
```

- `errMessage` 는 **인자 `e` 의 내용과 무관하게 항상 상수 `GENERIC_ERROR_MESSAGE` 를 반환**한다.
  원문(redact 된 것)은 `console.warn` 으로만 나가고, 반환값(=`dispatch` 에 실리는 값)에는 전혀
  섞이지 않는다 — `e` 의 어떤 필드도 리턴 경로에 없다.
- `dispatch({ type: "ERROR", message: errMessage(e) })` 호출부는 3곳뿐이다(`grep` 로 전수 확인):
  `use-widget.ts:890`(`start()`), `:934`(`sendCommand`), `:1272`(`runApplyConfig`/`applyConfig`
  실패). **세 곳 모두 `errMessage()` 를 경유**하고, `errMessage()` 를 우회해 `e.message` 등을 직접
  `message` 필드에 넣는 다른 `dispatch({type:"ERROR", ...})` 호출은 저장소 전체에 없다
  (`grep -rn '"ERROR"'` 전수 확인, 테스트 제외 3건뿐).
- `widget-state.ts` 의 리듀서(`case "ERROR"`)도 받은 `message` 를 그대로 `state.error` 에 저장할
  뿐 추가 가공은 없지만, 애초에 그 값이 상수이므로 무해하다.
- UI 렌더 측(`components/panel.tsx:174`)도 실제로는 `state.error`(=`message` 값) **문자열 자체를
  렌더하지 않는다** — `{error && <div className="wc-error" role="alert">{t("error.generic")}</div>}`
  로, `error` 는 단지 표시 여부의 boolean-like 트리거일 뿐이고 실제 텍스트는 i18n 카탈로그
  `error.generic` 을 별도로 다시 조회해 렌더한다. 즉 **경로가 이중으로 일반화**돼 있다 —
  `errMessage()` 가 이미 상수를 반환하고, 그걸 소비하는 UI 도 그 값을 안 쓰고 카탈로그를 다시 읽는다.

결론: `errMessage()` 의 "원문은 console 로만, UI 는 일반화 문구" 계약은 코드로 지켜지고 있고,
이번 diff 가 이 계약을 우회하는 새 경로를 만들지 않았다. **안전 확인.**

### (c) 틀린 위협 모델 문장("호스트 페이지의 다른 스크립트가 그 콘솔을 읽을 수 있다")이 저장소에 더 남아 있는가

전수 grep(`호스트 페이지의 다른 스크립트가 그 콘솔을 읽\|호스트 페이지의 다른 스크립트도 그
콘솔을 읽\|공개 사이트에 임베드되므로 호스트 페이지의 다른 스크립트`)으로 `codebase/`·`spec/`·
`plan/` 를 확인했다.

- `codebase/channel-web-chat/src/lib/eia-client.test.ts`: **매치 없음** — 이전 라운드(WARNING)가
  지적한 잘못된 문장은 정정/삭제됐다. 현재 이 파일의 `redactToken` 관련 서술은 전부
  `describe("redactToken — 로그에 단명 토큰을 남기지 않는다", ...)` 블록의 동작 단언(정규식 치환
  결과)뿐이고, 위협 모델 서술 자체가 없다.
- `codebase/channel-web-chat/src/lib/eia-client.ts:190-195`: 이 문장이 유일하게 남아 있는
  자리이지만, **틀렸다고 주장하는 게 아니라 "정정 이력"으로 인용**하는 문맥이다("**근거 정정**:
  처음 이 주석은 '...' 고 적었는데 **그건 틀렸다** — 위젯은 cross-origin iframe 이라..."). 즉
  현재 유효한 주장이 아니라 반증된 과거 주장을 메타적으로 언급하는 것이라 오도하지 않는다.
- `spec/`·`plan/` 전체: 매치 없음.
- `CHANGELOG.md`(신규 Unreleased 항목)도 같은 정정을 반영해 "위협 모델은 좁다 — 위젯은
  cross-origin iframe 이라 **호스트 페이지 스크립트는 이 콘솔을 못 읽는다**(초기 서술이 그렇게
  적혀 있었고 틀렸다)" 로 정확히 서술한다.
- 남은 매치는 전부 `review/code/2026/08/**/security.md` 등 **과거 리뷰 라운드 산출물**(예:
  `review/code/2026/08/10/18_51_07/side_effect.md:82`, `review/code/2026/08/11/10_02_22/security.md`
  등)인데, 이들은 CLAUDE.md 상 `review/**` 가 SoT 가 아닌 시점 기록(point-in-time report)이고,
  내용도 "그 시점에 이 문장이 틀렸다고 지적했다/그 정정을 검증했다"는 **정정 이력 자체**를
  기록한 것이라 살아있는 잘못된 주장으로 기능하지 않는다.

결론: 활성 소스(`codebase/`, `spec/`, `plan/`, `CHANGELOG.md`)에는 틀린 위협 모델을 **현재 유효한
주장으로** 서술하는 곳이 없다. **정정 완료 확인.**

## 그 외 관찰 (참고용, 신규 CRITICAL/WARNING 없음)

- **[INFO]** `start()` 경로에는 `applyConfig` 경로와 동형의 stale-token 회귀 테스트가 없다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (`it("§R4: 재로드
    getStatus 가 401 → 낙관적 refresh 1회 성공 시 복원(SSE 오픈)"` 블록의 주석, 371-376행)
  - 상세: 프로덕션 코드는 `start()`·`applyConfig()` 양쪽 모두 seed 이후 `sessionRef.current` 를
    읽도록 이미 대칭적으로 고쳐져 있다(`use-widget.ts:869`, `:1236` 둘 다 ref 를 읽음 — 캡처된
    지역 변수 아님). 다만 `start()` 경로는 "신규 대화 직후 `getStatus` 가 `401` 을 주는 경로가
    실제로 도달 가능한가"가 아직 미확인이라, 회귀 테스트는 `applyConfig`(복원) 경로에만 있다.
    이 비대칭은 `RESOLUTION.md`/`SUMMARY.md`(16_09_40 라운드)와
    `plan/in-progress/webchat-auth-session-status-reconcile.md` 에 갭으로 이미 등재돼 있고, 통과할
    때까지 테스트를 구부리지 않은 결과라는 근거도 남아 있다. 코드 자체는 대칭이므로 이번 라운드
    기준으로 새 취약점은 아니다.
  - 제안: 없음(이미 추적 중). `start()` 도달 가능성이 확인되면 동형 회귀 추가 권장.
- **[INFO]** `EiaClient` 의 `interact`/`getStatus`/`refreshToken` 은 토큰을 `Authorization: Bearer`
  헤더로만 보낸다(`codebase/channel-web-chat/src/lib/eia-client.ts:78-118`) — 쿼리 파라미터로
  토큰이 실리는 경로는 SSE `openStream` 뿐이다(EventSource 헤더 미지원 제약, EIA §8.3). 이
  세 메서드가 던지는 `EiaError` 메시지(`webhook 시작 실패(...)`, `명령 실패(...)`, `상태 조회
  실패(...)`, `토큰 갱신 실패(...)`)에도 URL·토큰이 섞이지 않는다. 그래서 `use-token-refresh.ts:183`,
  `use-widget.ts:559,749,1044,1094` 의 `console.warn` 들이 `redactToken` 을 거치지 않는 것도
  실제로는 무해하다(redact 대상 자체가 그 메시지에 없음). `redactToken` 이 적용된 3곳(`errMessage`,
  `onRefreshed` consumer throw, `runApplyConfig` catch)은 정확히 "예외 메시지에 SSE URL(토큰
  포함)이 실릴 수 있는" 경로와 일치한다 — 적용 범위가 과다도 과소도 아니다.
  - 제안: 없음(현 상태 적절).
- **[INFO]** `session-store.ts` `loadSession` 의 `apiBase` 바인딩 검사(발급 origin ≠ 현재 origin
  또는 미기록이면 폐기, `session-store.ts:87-93`)와 `applyRefreshedToken`(`session-store.ts:125-133`)
  의 spread(`{ ...session, ...refreshed }`)는 `apiBase`/`endpoints`/`executionId` 를 보존하고
  `token`/`expiresAt` 만 교체한다 — 갱신 경로가 이 바인딩을 깨지 않는다. 이번 diff 로 새로
  도입된 리스크 없음.

## 요약

이번 라운드는 직전 WARNING 2건(테스트 파일의 잘못된 위협 모델 문장, `applyConfig` 경로 stale-token
회귀 누락)이 요청한 대로 정확히 반영됐다. `sseErrorDetail`은 `readyState` 외 필드에 접근하지 않고
원본 이벤트 객체를 로그에 함께 찍지도 않아 토큰·URL 유출 경로가 없다. `errMessage()` 는 인자
내용과 무관하게 상수만 반환하고 UI(`panel.tsx`) 도 그 값을 직접 렌더하지 않고 i18n 카탈로그를
다시 조회하므로 원문 노출 경로가 없다. 잘못된 위협 모델 문장은 활성 소스에서 전수 정정됐고, 유일한
잔존 인용은 "이건 틀렸었다"는 정정 이력으로서만 남아 있다. 발견된 새 CRITICAL/WARNING 은 없다.

## 위험도

NONE
