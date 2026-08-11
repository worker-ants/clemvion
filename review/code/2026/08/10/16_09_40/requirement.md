# 요구사항(Requirement) 리뷰 — `feat(webchat): 재로드 REST 오류 분기 3종 구현`

대상 커밋: `deb9b6978` — `codebase/channel-web-chat/src/widget/use-widget.ts`,
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`,
`spec/7-channel-web-chat/3-auth-session.md`(참조).

관련 spec: `spec/7-channel-web-chat/3-auth-session.md` §3.1-2("재로드 복원 시퀀스" 상태코드 분기표) ·
Rationale §R4("재로드 401 — 낙관적 refresh 1회 후 종료").

## 발견사항

- **[CRITICAL]** 401 낙관적 refresh **성공** 후 SSE 를 새 토큰이 아니라 **새로고침 전(stale, 이미 401 을
  유발한) 토큰**으로 재오픈한다 — "성공 시 SSE 재연결로 복원"(§3.1-2)이 실제로는 무효 토큰 재연결로
  귀결돼 복원이 아니라 조용한 고장이다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:510-515`(성공 분기) 와
    `codebase/channel-web-chat/src/widget/use-widget.ts:961`(`applyConfig` 호출부
    `openStream(saved, "0")`) / `codebase/channel-web-chat/src/widget/use-widget.ts:611`(`start()`
    호출부 `openStream(session, "0")`).
  - 상세: `seedWaitingFromStatus` 의 401 성공 분기는 `const updated = { ...session, token, expiresAt };
    sessionRef.current = updated; saveSession(...)` 로 **새 객체**를 만들어 `sessionRef.current` 와
    storage 만 갱신한다. 함수에 넘어온 `session` 매개변수(호출부의 로컬 변수 `saved`/`session`, 같은
    참조)는 그대로 두므로 **옛 토큰을 그대로 들고 있다**. 그런데 `applyConfig`/`start()` 는
    `seedWaitingFromStatus` 가 `"continue"` 를 반환하면 바로 그 **로컬 변수**(`saved`/`session`)를
    `openStream(saved, "0")` 에 넘긴다 — `sessionRef.current`(새 토큰)를 다시 읽지 않는다. 결과: EventSource
    연결 URL 의 `?token=` 이 **이미 401 로 거부된 옛 토큰**이 되어, SSE 스트림이 열리자마자(혹은 재시도
    루프에서 계속) 인증 실패한다. `EventSource` 는 URL 을 동적으로 갱신하지 않으므로 자동 재연결도
    영구히 같은 무효 토큰을 재사용한다 — 위젯은 `phase !== "ended"`(정상으로 보임)이지만 SSE 이벤트를
    영원히 못 받아 이 파일 자신의 다른 주석들이 경고하는 "무기한 멈춤"과 동일한 부류의 사고가 재로드
    401-refresh 성공 경로에서 새로 생긴다. 한편 `sendCommand`(624행 부근)는 `sessionRef.current` 를
    그때그때 다시 읽으므로 interact 호출 자체는 새 토큰으로 정상 나가는 비대칭도 있다 — 즉 명령은
    나가는데 응답(SSE) 은 영영 안 오는, 더 진단하기 어려운 반쪽 고장이다.
  - 재현 확인: `npx vitest run src/widget/use-widget-eager-start.test.ts -t "401"` 는 현재도 **통과**한다
    — 신규 회귀 테스트(`§R4: 재로드 getStatus 가 401 → 낙관적 refresh 1회 성공 시 복원`)는
    `getEs()).not.toBeNull()`(EventSource 인스턴스가 생성됐는가)만 보고 **그 URL 의 토큰 값은
    단언하지 않는다**(`ControllableEventSource` 스텁이 생성자 인자를 기록하지 않음) — 그래서 이 결함이
    회귀 스위트를 통과한다. (참고: 같은 파일의 "race fix: openStream 을 lastEventId=0 으로 열어..." 테스트는
    URL 을 캡처하는 별도 스텁을 쓴다 — 401 테스트도 같은 패턴을 썼다면 잡혔을 결함이다.)
  - 제안: `applyConfig`/`start()` 양쪽에서 `openStream` 호출 직전에 **로컬 스냅샷이 아니라
    `sessionRef.current` 를 다시 읽는다** — 예: `openStream(sessionRef.current ?? saved, "0")`,
    `openStream(sessionRef.current ?? session, "0")`. (이 파일 다른 곳의 관용구 — `use-token-refresh.ts`
    의 "타이머 발화 시점의 최신 ref 값을 다시 읽는다" — 와 정합한다.) 회귀 테스트는 `getEs()`/`esUrl` 캡처
    스텁으로 URL 의 `token=` 값을 `iext_fresh` 로 단언하도록 보강 필요.

- **[WARNING]** 401 refresh **시도 자체가 실패**(네트워크 오류 등 `401`/`410` 이 아닌 예외 포함)해도
  구분 없이 전부 "복구 불가로 확정"(`finalizeEnded`)한다 — spec 문언·Rationale 은 "재차 `401`"/"재차
  실패(`401`/`410`)" 로 한정한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:516-521`
    (`} catch { if (isStale(gen)) return "stale"; finalizeEnded("execution.token_revoked"); return "ended"; }`).
  - 상세: `client.refreshToken(...)` 이 던지는 예외는 `EiaError`(HTTP 4xx/5xx, `status` 보유)일 수도,
    `fetch` 자체의 네트워크 reject(순수 `Error`, `status` 없음)일 수도 있다. 현재 `catch` 는 원인을
    구분하지 않고 전부 "종료 확정" 으로 귀결한다. 그런데 §3.1-2 본문은 "재차 `401` 이면 종료로 간주",
    R4 Rationale 은 "재차 실패(`401`/`410`)면 종료로 확정" 이라고 **명시적으로 상태코드를 한정**한다 —
    일시적 네트워크 장애로 refresh POST 자체가 실패한 경우까지 "종료" 로 미는 것은 spec 문언보다 넓다.
    같은 파일이 바로 옆 일반 오류 분기에서 지키는 원칙("그 외 오류는 여전히 soft-fail — 일시적 장애가
    대화를 끝내지 않도록")과도 어긋나는 비대칭이다 — 정당한 만료 세션이 refresh POST 왕복 중의 순간적인
    네트워크 hiccup 만으로 영구 종료될 수 있다.
  - 제안: `catch (refreshErr)` 로 받아 `refreshErr instanceof EiaError && (refreshErr.status === 401 ||
    refreshErr.status === 410)` 인 경우에만 `finalizeEnded`, 그 외(네트워크 오류 등)는 기존 일반
    soft-fail(`"continue"`, 옛 토큰 유지) 로 폴백하는 방향을 검토. spec 문언을 넓히는 쪽(네트워크 실패도
    종료로 간주)이 의도라면 그건 판단이 갈릴 수 있는 지점이므로 WARNING 으로 남긴다(SPEC-DRIFT 로
    단정하지 않음 — 의도적 확장인지 실수인지 불명확).

## 점검 관점별 요약

- **기능 완전성**: §3.1-2 의 3개 신규 분기(404 / 401-성공 / 401-재차실패) 자체는 모두 구현됐고 회귀
  테스트 4종(404, 401-성공, 401-재차실패, 500-soft-fail 경계 고정)이 각각을 개별 단언한다. 다만 위
  CRITICAL 처럼 "성공" 분기가 실제로 SSE 를 복원시키지 못해 **기능이 완전하지 않다**.
- **엣지 케이스**: `isStale(gen)` 재검사가 refresh 왕복 전/후 모두 있고, `configRef.current` 부재(부팅
  전 회귀) 가드도 있다 — 세대·부팅 축 엣지케이스는 잘 처리됨.
- **TODO/FIXME**: 없음.
- **의도-구현 괴리**: `seedWaitingFromStatus` 의 JSDoc(513-514행) "복구 성공 — 호출부가 SSE 를 열어 정상
  흐름을 잇는다" 라는 **명시적 주석**이 실제로는 호출부가 옛 세션으로 여는 CRITICAL 버그와 정면으로
  어긋난다 — 이 파일에서 가장 두드러진 의도-구현 괴리.
- **에러 시나리오**: 404/401-성공/401-실패/기타 4갈래 모두 분기는 있으나, 401-성공의 후속 처리(SSE
  재오픈)가 실제로 실패한다.
- **데이터 유효성**: 별도 입력 검증 대상 없음(REST 응답 status 코드 분기가 전부).
- **비즈니스 로직**: §R4("낙관적 refresh 1회") 는 정확히 1회로 구현됨(테스트 `refreshCalls===1` 로
  성공/실패 양쪽 확인) — 무한 재시도로 번지지 않는다는 요구는 충족.
- **반환값**: `SeedOutcome`(`"ended"`/`"stale"`/`"continue"`) 모든 분기에서 값 반환, 누락 경로 없음.
- **spec fidelity**: (a) 404 → `finalizeEnded("execution.not_found")` + storage 정리 + SSE 미오픈 —
  §3.1-2/§3.1-3 과 일치. (b) 401 낙관적 refresh 는 정확히 1회 — §R4 와 일치. (c) 재차 실패 시
  `finalizeEnded("execution.token_revoked")` 로 종료 확정 — §3.1-2/R4 와 일치(단 "재차 실패" 의 범위가
  spec 문언보다 넓다 — 위 WARNING). (d) 그 외 오류는 여전히 `console.warn` 후 `"continue"`(soft-fail) —
  §3.1-2 본문 "그 외 status·오류는 여전히 catch soft-fail 후 SSE 로 진행" 과 일치, 신규 500 테스트로
  경계 고정됨. 다만 (b)/(c) 의 "성공 시 복원" 부분이 위 CRITICAL 로 실제로는 spec 을 충족하지 못한다.
  spec 문서(`3-auth-session.md`) 본문의 "구현됐다(2026-08-10)" 서술은 이 CRITICAL 이 고쳐지기 전까지는
  부정확하다.

## 요약

§3.1-2/§R4 가 정한 404·401(성공/실패)·기타 4갈래 분기 골격은 정확히 구현됐고 낙관적 refresh 가 정확히
1회로 제한되는 등 핵심 비즈니스 규칙은 충실히 반영됐다. 그러나 401 refresh **성공** 시 SSE 를 새로
저장된 토큰이 아니라 새로고침 전 stale 토큰으로 재오픈하는 CRITICAL 결함이 있어, "성공 시 SSE
재연결로 복원"이라는 §3.1-2·§R4 의 핵심 약속이 실제로는 지켜지지 않는다 — 위젯은 겉보기엔 복원된 것
처럼 보이지만(phase≠ended) SSE 스트림은 영구히 무효 토큰으로 고착된다. 이 결함은 현재 회귀 테스트가
EventSource 생성 여부만 확인하고 URL 의 토큰 값을 검증하지 않아 통과 상태로 숨어 있다. 부수적으로
refresh 시도 자체의 실패(네트워크 오류 등)를 401/410 재실패와 구분 없이 종료로 확정하는 부분도
spec 문언보다 넓어 재검토가 필요하다.

## 위험도

HIGH
