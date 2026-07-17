# 보안(Security) 리뷰 — webchat-boot-single-flight (03_04_45)

## 범위·방법

`prompt_file` 페이로드가 대용량(2617줄, 25000토큰 cap 로 1페이지만 확인 가능)이라, 호출자가 명시 지정한
"이번 라운드 핵심"인 커밋 `94b66b212`를 `git show`로 직접 확인해 SoT 로 삼았다(직전 라운드들에서도
payload truncation 이 반복 관측된 패턴과 동일하므로 payload 나열 대신 실제 diff 를 우선했다).

- `git show 94b66b212 --stat` / `--name-status`: 변경 파일 **정확히 2개**.
  - `codebase/channel-web-chat/src/widget/use-widget.ts` — **1줄** 변경(2 +-, net 0 lines).
  - `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 48줄 변경(테스트 전용).
- 각 파일 diff 전문을 `git show 94b66b212 -- <path>` 로 개별 대조.
- `sessionEstablished` 심볼 전체를 `grep -n`으로 재확인해 정의(useCallback, 빈 deps)와 `start()` 내부
  참조 위치(:673 `if (sessionEstablished()) return;`)를 확인.
- diff 전체에 대해 인젝션 패턴(`dangerouslySetInnerHTML|innerHTML|eval\(|new Function\(|child_process|
  exec\(|document\.write`)과 하드코딩 시크릿 패턴(`password|secret|api[_-]?key|authorization|bearer|
  token\s*=\s*["']|BEGIN (RSA|PRIVATE)`) grep — 둘 다 **0건**.
- `package.json`/lockfile 은 이번 커밋 파일 목록에 없음(의존성 변경 없음).

---

## 발견사항

- **[INFO] `use-widget.ts` 변경은 `start()` useCallback 의 deps 배열에 `sessionEstablished` 1개 심볼을
  추가한 것뿐 — 런타임 로직·네트워크·인증 표면 무변경**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:685`
    (`}, [openStream, persist, seedWaitingFromStatus, scheduleRefresh, isStale, sessionEstablished]);`)
  - 상세: diff hunk(`@@ -682,7 +682,7 @@`)가 정확히 이 한 줄만 담고 있다. `sessionEstablished`는
    이미 `start()` 함수 본문 내부(:673, `if (sessionEstablished()) return;`)에서 참조되고 있었고, 이번
    변경은 ESLint `exhaustive-deps` 규칙이 요구하는 선언 누락을 보완한 것이다(커밋 메시지도 "신규
    ESLint exhaustive-deps 경고… deps 에 추가"로 명시). `sessionEstablished` 자신은
    `useCallback(() => streamRef.current !== null, [])`(:325)로 **빈 deps 배열**을 가져 렌더마다
    참조 동일성이 절대 바뀌지 않는 안정 콜백이다 — 따라서 이를 `start()`의 deps 에 추가해도 `start`
    콜백이 추가로 재생성되는 일이 없고(React 관점에서 순수 no-op), 어떤 조건 분기·네트워크 호출·토큰
    취급 로직도 이 diff hunk 범위 밖이다. `sendCommand`(A-6 되돌림이 위치한 명령 실패 처리 경로),
    `applyConfig`/`seedWaitingFromStatus`(config 적용 경합·세션 복원 로직), `establishConfig`(apiBase
    로 client 재구성) 등 이전 라운드가 검증한 보안 관련 함수 본문은 이번 커밋의 diff 범위(단일 hunk,
    1줄)에 전혀 포함되지 않는다.
  - 제안: 없음(확인 목적).

- **[INFO] 테스트 파일 변경은 기존 단일 테스트를 파라미터화된 헬퍼 + 2개 대칭 테스트로 리팩터링한
  것뿐 — 신규 프로덕션 경로·신규 시크릿·신규 mock 자격증명 없음**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3396-3427`(헬퍼
    `raceStartVsResendSingleStream(resendResolvesFirst: boolean)` 추출), `:3429-3437`(두 개의
    `it(...)` 케이스).
  - 상세: 커밋 메시지가 밝히듯 직전 double-stream 회귀 테스트가 C(start)→D(재전송) 순서로만 resolve
    해 `applyConfig` 게이트만 고정하고 `start()` 게이트는 비대칭으로 미검증이던 커버리지 갭을, resolve
    순서를 인자로 받는 공용 헬퍼로 양방향(C 먼저/D 먼저) 대칭 고정한 것이다. 기존에 있던 `EventSource`/
    `fetch` 스텁(`vi.stubGlobal`) 구조·`webhookResolvers`/`statusResolvers` 배열·`waitingAt("n1")` 등
    헬퍼는 그대로 재사용되고, diff 상 새로 추가된 문자열 리터럴은 테스트 설명 문구와 boolean 플래그뿐이다
    (하드코딩 시크릿·토큰 패턴 grep 0건). 이 파일은 실제 `fetch`/`EventSource`를 모두 스텁으로 대체하므로
    실네트워크·실토큰이 개입할 여지 자체가 없고, 프로덕션 코드 경로를 신규로 만들지 않고 기존
    `sessionEstablished()` 게이트(:559, :673, :1018 — 이번 diff 밖)를 다른 타이밍 순서로 exercise 할
    뿐이다.
  - 제안: 없음(확인 목적).

- **[INFO] 직전 라운드(01_44_21) 보안 결론 — "A-6 되돌림 stale 토큰 4겹 경계"·"`apiBase` 축 이월" —
  이번 커밋으로 재확인, 무변화**
  - 위치: `sendCommand`(비-410 catch 분기, A-6 되돌림 위치) — 이번 커밋 파일 목록(`use-widget.ts`,
    `use-widget-eager-start.test.ts`)에 이름은 있으나 diff 범위(단일 hunk, deps 배열 1줄)는 `sendCommand`
    함수 본문을 전혀 건드리지 않음. `widget-state.ts`(`RESTORED`/`BOOTED` 무가드 구조), `session-store.ts`,
    `use-token-refresh.ts`, `eia-client.ts`, `host-bridge.ts`는 이번 커밋의 `--name-status` 목록에
    **파일명 자체가 없음**(전혀 미변경).
  - 상세: 01_44_21 라운드가 확립한 4겹 경계(① per_execution 토큰 scope, ② `loadSession`의 `expiresAt`
    자동 TTL 폐기, ③ sessionStorage 탭종료 자동소거, ④ 서버측 idle 회수)와 `apiBase` 축 이월(선행
    구조적 갭, 재전송 시 옛 토큰이 새 `apiBase` 로 전송될 수 있는 문제)의 근거 파일은 전부 이번 커밋의
    변경 범위 밖이다. 이번 커밋은 순수 테스트 커버리지 보완 + lint 준수용 deps 1줄이므로 두 결론 모두
    **그대로 유효**하다 — 악화도 개선도 없는 무변화.
  - 제안: 없음(재확인만, `apiBase` 이월 항목은 기존 트랙에서 별도 처리 예정).

- **[INFO] 표준 체크리스트(인젝션·하드코딩 시크릿·암호화·에러 노출·의존성) — 이번 커밋 diff 전체에서
  이상 없음**
  - 위치: `git show 94b66b212`(전체 diff, 2파일).
  - 상세: (1) 인젝션 — `dangerouslySetInnerHTML`/`innerHTML`/`eval(`/`new Function(`/`child_process`/
    `exec(`/`document.write` 패턴 grep 0건. (2) 하드코딩 시크릿 — `password|secret|api[_-]?key|
    authorization|bearer|token=|BEGIN (RSA|PRIVATE)` 패턴 grep 0건(테스트 diff 포함 전체). (3) 암호화 —
    해시/암호화 로직 변경 없음(관련 코드 diff 범위 밖). (4) 에러 처리 — `errMessage()`/`console.warn`
    관련 로직 이번 diff 미변경. (5) 의존성 — `package.json`/lockfile 변경 없음(diff 파일 목록에 부재).
  - 제안: 없음.

---

## 요약

이번 라운드(`94b66b212`)는 직전 ai-review(02_25_54)의 WARNING 2건(비대칭 테스트 커버리지 갭, `start()`
의 `sessionEstablished` deps 누락)을 처리한 것으로, `git show --name-status` 로 확인한 변경 파일은
정확히 2개다 — `use-widget.ts`는 이미 함수 본문에서 참조 중이던 `sessionEstablished`(빈 deps 배열을
가진 안정 콜백)를 `start()`의 deps 배열에 추가한 **1줄**뿐이고, `use-widget-eager-start.test.ts`는
기존 단일 테스트를 resolve-순서 파라미터화 헬퍼로 리팩터링해 대칭 2케이스로 확장한 순수 테스트 변경이다.
두 변경 모두 프로덕션 네트워크 호출·인증/토큰 취급·세션 관리 로직을 전혀 건드리지 않으며(diff hunk
경계로 직접 확인), `sendCommand`/`widget-state.ts`/`session-store.ts`/`use-token-refresh.ts`/
`eia-client.ts`/`host-bridge.ts` 등 이전 라운드가 검증한 보안 관련 파일은 이번 커밋의 변경 목록에
없다. 따라서 직전 라운드(01_44_21)가 확립한 "A-6 되돌림 stale 토큰 4겹 경계 안전"과 "`apiBase` 축
이월(선행 결함, 별도 트랙)" 결론은 이번 변경으로 악화되거나 개선되지 않고 그대로 유효하다. 표준
OWASP 체크리스트(인젝션·하드코딩 시크릿·암호화·에러 노출·의존성) 재실행 결과도 이상 없음. 신규
CRITICAL·WARNING 없음.

## 위험도

NONE
