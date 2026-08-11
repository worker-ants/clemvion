# 요구사항(Requirement) Review — `10_02_22`

## 검토 범위와 방법

프롬프트 페이로드(119개 파일, 대부분 과거 10라운드 review 산출물 누적)는 diff-only 로 판단이
불가능해, 오케스트레이터가 지정한 실제 delta(`log redaction 3곳 + applyConfig 의 unhandled
rejection 닫기 + 테스트/문서`)를 `git log`/`git show`/`Read` 로 직접 추적했다. 그 delta 는
커밋 `bd4e5b35f`(HEAD, "redaction 을 진입점 셋 중 하나에만 걸었다 + 테스트 드리프트 결합
제거")로 확인됨 — 이전 라운드(`review/code/2026/08/10/18_51_07`)의 Critical 2·Warning 5 처분
커밋이다. 아래를 직접 열어 대조했다:

- `codebase/channel-web-chat/src/widget/use-widget.ts`(`applyConfig`/`runApplyConfig`/`start()`/
  `openStream`/`errMessage`/`GENERIC_ERROR_MESSAGE` 전문)
- `codebase/channel-web-chat/src/lib/eia-client.ts`(`redactToken`/`isTerminalAuthError`/`openStream`)
- `codebase/channel-web-chat/src/widget/use-token-refresh.ts`(자매 catch 지점 대조)
- `codebase/channel-web-chat/src/lib/widget-state.ts`(`ERROR` 리듀서)
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(신규 회귀 2건)
- `spec/7-channel-web-chat/4-security.md` §1(보안 정책 요약 표), `spec/7-channel-web-chat/
  1-widget-app.md` §2·§3.1(상태 전이 표), `spec/7-channel-web-chat/3-auth-session.md` §3.1·§R4

## 판정 (a) — `applyConfig` 실패의 무음 삼킴은 spec 을 위반한다 (CRITICAL)

`spec/7-channel-web-chat/4-security.md:38`(§1 보안 정책 요약 표, "에러 메시지 노출" 행)은
명시적으로 정한다:

> 에러 → [ended] + "새 대화 시작" 동작([1-widget-app §3.1])은 유지하고 표시 문구만
> 일반화한다. … **코드 SoT: `use-widget.ts errMessage`**

즉 spec 은 "무엇을 보여줘야 하는가"(1) 표시 문구는 `GENERIC_ERROR_MESSAGE` 로 일반화, (2)
상태는 `[ended]` 로 전이("새 대화 시작" CTA 노출)까지 **구체적으로** 정하고, 그 이행 지점을
`errMessage` 함수로 못박는다. `1-widget-app.md` 상태 전이 표(§2 "대화 종료"·§3.1 "토큰 만료"
행)도 모든 종료 경로의 귀결을 `[ended]`로 통일한다.

코드 대조 결과 이 약속이 `applyConfig` 경로에서 깨진다:

- `start()` 의 catch(`use-widget.ts:865-871`)는 spec 이 지정한 그대로
  `dispatch({ type: "ERROR", message: errMessage(e) })` 를 호출한다 — `errMessage` 를 거쳐
  일반화 문구를 반환하고 `ERROR` 리듀서(`widget-state.ts:190-191`)가 `phase: "ended"` 로
  전이시킨다.
- 반면 이번 delta 가 새로 추가한 `runApplyConfig`(`use-widget.ts:1243-1247`)의 catch 는
  ```ts
  void applyConfig(cfg).catch((e: unknown) => {
    console.warn("[widget] boot config 적용 실패:", redactToken(e instanceof Error ? e.message : String(e)));
  });
  ```
  `errMessage()`(spec 이 지정한 SoT)를 호출하지 않고, `dispatch(...)` 를 전혀 하지 않는다.
  redaction 은 정확하지만 **spec 이 요구하는 상태 전이·표시 문구 두 가지 모두 이행되지 않는다.**

이게 "회색지대 침묵"이 아니라 **실질적 회귀**인 이유 — 재현 가능한 구체적 경로:

1. 저장 세션 복원 분기(`applyConfig` 안, `use-widget.ts:1184-1187`)는 `openStream` 을 부르기
   **전**에 이미 `dispatch({ type: "RESTORED", ... })` 로 `phase: "streaming"`(스피너)을 그린다.
2. 곧이어 `use-widget.ts:1223` 의 `const claim = openStream(live, "0");` 는 어떤 `try`/`catch`
   로도 감싸여 있지 않다 — `openStream`(`:466`)의 `EventSource` 생성(`esFactory`)이 동기
   throw 하면(손상된 `endpoints.stream`/`apiBase` 조합에 `new URL` 이 던지는 경우 — 이 파일
   자신이 여러 곳에서 이 가능성을 전제로 코드를 짠다, 예: `:768` 주석) 그 예외는 `applyConfig`
   의 promise rejection 이 되어 `runApplyConfig` 의 catch 로 떨어진다.
3. 그 catch 는 `console.warn` 만 하고 끝난다 — `phase` 는 1번에서 이미 세팅된 `"streaming"`
   에 **영구히 고정**된다. `dispatch(ERROR)` 가 없으니 `[ended]` 로도 전이하지 않고, "새 대화
   시작" CTA 도 노출되지 않는다.
4. 더 나쁜 점: 같은 이유로 `scheduleRefresh()`(`:1226`, `openStream` 바로 다음 줄)도 실행되지
   않는다. 이 파일은 스스로 "`scheduleRefresh` 는 세션의 **유일한** 갱신 예약 지점"이라고
   여러 곳(예: `:837-838`)에서 명시한다 — 즉 이 경로엔 **복구 사이클 자체가 존재하지 않는다.**
   자매 지점(`use-token-refresh.ts:157-177`)은 같은 종류의 소비자 예외를 의도적으로 삼키면서도
   `scheduleWithDelay()`(:177)를 **catch 밖에서 무조건** 호출해 다음 사이클이 재시도하도록
   설계돼 있다(`deferredStreamRef.current` 도 throw 시 `false` 로 안 지워져 다음 사이클이 다시
   시도한다) — `applyConfig` 의 이 지점만 그 안전장치가 없다.

결과적으로 이 코드 경로는 CHANGELOG(`166-174`행)·이 브랜치의 10라운드 리뷰가 반복해 사냥한
바로 그 증상 클래스 — **"streaming 에 무기한 고착"** — 를 정확히 재현한다. `3-auth-session.md`
§R4 의 Rationale 문구("유예가 성립하려면 갱신 사이클이 실제로 복구까지 이어져야 한다 …
아니면 이 갈래는 '종료 안 함'이라는 이름의 영구 고착일 뿐이다")가 스스로 경고하는 바로 그
형태다.

**"이제 삼킨다"는 표현이 정확하다** — 이 delta 이전엔 unhandled rejection 이었고(토큰이 그대로
콘솔에 남는 보안 결함), 이 delta 는 그 로그 노출만 닫았을 뿐 스펙이 요구하는 사용자 가시성
(표시 문구·`[ended]` 전이)은 여전히 열려 있다. 커밋 메시지·JSDoc(`:1233-1241`)은 "실패를
반드시 받는다"/"catch 추가"라고 적어 마치 결함이 완전히 닫힌 것처럼 서술하지만, 실제로 닫힌
것은 **로그 위생**뿐이고 **사용자 가시성**은 그대로 비어 있다 — 의도(주석의 "받는다")와 구현
간 괴리다.

도달 확률은 낮다(네이티브 `EventSource` 동기 throw 는 드묾 — 직전 라운드 security/side_effect
리뷰도 같은 평가를 냈다). 그러나 이 delta 자신이 정확히 이 코드 지점을 손댔고, spec 문구가
구체적이며, 회귀 테스트가 전무하고, 발생 시 복구 불가라는 점에서 CRITICAL 로 판정한다.

## 판정 (b) — SSE `onError` 로그 축소는 spec 위반은 아니지만 진단 정보가 사실상 없다 (WARNING)

`spec/7-channel-web-chat/4-security.md`·`1-widget-app.md` 어디에도 SSE 연결 오류 로그의 구체적
필드/granularity 를 규정하는 문구는 없다 — 이 delta 의 `onError` 축소(`use-widget.ts:477-481`,
`e.target.url` 노출 원본 Event → `e.type` 문자열만) 자체는 **spec 위반이 아니다**(회색지대,
정보 노출 방지가 우선한다는 일반 정책과도 정합).

다만 구현이 자기 주석과 어긋난다 — 주석(`:472-476`)은 "진단에 필요한 것은 '어떤 종류의
실패인가' 뿐이라 타입만 남긴다"고 적지만, `EiaClient#openStream`(`eia-client.ts:149-151`)은
`es.addEventListener("error", (e) => handlers.onError!(e))` 로 **`"error"` 이벤트 하나만**
구독한다. 네이티브 `EventSource` 의 error 이벤트는 이 리스너에 도달하는 한 `type` 이 항상
`"error"` 상수다(이 delta 자신의 새 테스트 fixture, `use-widget-eager-start.test.ts:778`
`{ type: "error", target: {...} }` 도 이를 그대로 반영). 즉 "어떤 종류의 실패인가"를 가르는
필드가 아니라 **항상 같은 값을 찍는 죽은 필드**다 — CORS 차단·네트워크 단절·서버 다운을
로그만으로 구분할 수 없다는 점은 이 fix 전후로 달라지지 않았다(축소가 실질적으로 잃는
진단 가치는 없지만, 얻는 진단 가치도 없다 — "가시화" 라는 원래 목적(주석 `:472` "조용히
삼키지 않도록")에 비춰 사실상 정보가 비어 있다).

## 판정 (c) — `status: implemented` 는 좁게는 정당, 넓게는 미해결 갭이 있다

- `3-auth-session.md`(§3.1 REST 3분기: `404`/`401`/그 외 soft-fail)는 직전 라운드
  (`review/code/2026/08/10/18_51_07/requirement.md`)가 spec 본문과 line-level 대조로 이미
  검증했고, 이번 delta 는 그 분기 로직을 건드리지 않았다(순수 로그/redaction 변경) — 그 문서의
  `status: implemented` 판정은 이번 delta 로 흔들리지 않는다.
- 그러나 `4-security.md`(§1 "에러 메시지 노출" 행, 역시 `status: implemented`)가 명시하는
  일반 에러 정책은 위 (a)에서 확인한 대로 `applyConfig` 경로에서 실제로 충족되지 않는다 —
  그 문서의 `code:` frontmatter 목록에는 애초에 `use-widget.ts` 가 없어(§3-①·CORS 관련 코드만
  등재) 이 gap 이 `spec-code-paths` 류 자동 가드로도 포착되지 않는다. `implemented` 를 즉시
  `partial` 로 낮추라는 뜻은 아니다 — 근본 수정(코드에서 `runApplyConfig` catch 안에
  `dispatch({ type: "ERROR", message: errMessage(e) })` 한 줄 추가, `start()` 와 대칭)이 spec
  다운그레이드보다 훨씬 싸고, 이게 이 review 의 1차 권고다.

## 그 외 확인

- **[WARNING]** 커밋 메시지는 redaction 3곳(`start()`·`applyConfig`·SSE `onError`)을 고쳤다고
  적지만, 신규 회귀 테스트는 2곳(`start()`, `onError`)에만 있다 — `applyConfig`(`runApplyConfig`
  catch)의 redaction·실패 처리에 대한 테스트는 없다(`use-widget-eager-start.test.ts` 안
  `it("§보안: ...")` 블록이 `:716`·`:752` 둘뿐이고 `throwOnce` 사용처도 `:681`(resumeDeferredStream)·
  `:734`(start())뿐, `applyConfig` 복원 분기에서 `openStream` 이 던지는 시나리오는 어디에도
  없음). 위 (a)의 CRITICAL 이 회귀 없이 넘어간 직접적 원인이다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`
  - 제안: `applyConfig` 복원 분기에서 `openStream` 이 동기 throw 하는 케이스(`throwOnce` +
    저장 세션 존재)를 추가하고, `dispatch(ERROR)` 발생(또는 (a) fix 후 `phase === "ended"`)을
    단언할 것.

- **[INFO]** `use-widget.ts:1321` 주석이 "에러 메시지 노출" 정책의 출처를 `4-security §5` 로
  인용하지만, 실제 그 정책은 `4-security.md` §1(보안 정책 요약 표, 38행)에 있다 — §5 는
  프라이버시/데이터 처리(동의 고지·보존기간)로 무관한 절이다. spec 코드 fix 대상 아님, 인용
  절 번호만 정정 권장.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1321`
  - 제안: 주석의 "(4-security §5)" → "(4-security §1)" 로 정정.

## 요약

이번 delta(`bd4e5b35f`)의 로그 redaction 3곳(`start()`→`errMessage`, `applyConfig`→
`runApplyConfig`, SSE `onError`→타입만)은 **토큰 노출**이라는 원래 목표는 정확히 달성했다.
그러나 오케스트레이터가 지정한 핵심 질문 (a)에서, `applyConfig` 의 unhandled rejection을
"닫는다"는 서술은 로그 위생에 대해서만 참이다 — `4-security.md §1`("에러 메시지 노출" 행,
코드 SoT 로 `use-widget.ts errMessage` 를 명시)과 `1-widget-app.md §3.1`(상태 전이 표)이
정하는 "에러 → `[ended]` + 새 대화 시작" 약속은 이 경로에서 이행되지 않는다.
`runApplyConfig` 의 catch 는 `errMessage()`(spec 이 지정한 SoT)를 우회하고 `dispatch` 를
전혀 하지 않아, 저장 세션 복원 중 `openStream` 이 동기 throw 하면 위젯이 `"streaming"`
스피너에 **영구 고착**되고(관련 `scheduleRefresh()` 도 건너뛰어 복구 사이클 자체가 없다) —
이 브랜치 10라운드가 반복해 사냥한 바로 그 증상 클래스의 재발이다. 도달 확률은 낮지만, spec
문구가 구체적이고 회귀 테스트가 전무하며 발생 시 복구 불가능하다는 점에서 CRITICAL 로
판정한다. (b) SSE `onError` 축소는 spec 위반은 아니나 "타입만 남긴다"는 주석의 진단 가치
주장이 실제로는 죽은 필드(`EventSource` error 이벤트는 항상 `type: "error"`)라 과장돼
있다(WARNING). (c) `3-auth-session.md` 의 `status: implemented` 는 §3.1 REST 분기 범위에서는
이번 delta 로 흔들리지 않지만, `4-security.md` 의 일반 에러 정책 약속에는 이번 delta 가
정확히 건드린 자리에 미해결 갭이 남아 있다 — spec 다운그레이드보다 `runApplyConfig` catch 에
`dispatch(ERROR)` 한 줄을 더하는 코드 fix 를 권고한다.

## 위험도

**HIGH** — spec 이 구체적으로 정한 상태 전이·표시 문구 약속이 이 delta 가 직접 건드린 코드
지점에서 위반되고, 도달 시 사용자 가시적 영구 고착(이 프로젝트가 여러 차례 사고를 낸 바로 그
증상)을 재현하며, 회귀 테스트가 전무하다. 도달 확률이 낮다는 점만이 CRITICAL 단일 항목으로도
즉시 배포 차단까지는 아닐 수 있다는 감경 요인이다.

STATUS: OK
