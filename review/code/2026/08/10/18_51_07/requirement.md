# 요구사항(Requirement) Review — `18_51_07`

## 검토 범위와 방법

오케스트레이터 지시대로 (a) `status: implemented` 판정의 정당성, (b) plan 에 새로 등재된 두 잔여
(`주기 갱신 terminal 시 storage 미정리` / `start()`·`applyConfig` 꼬리 블록 중복)가 spec 본문이
약속한 것을 미룬 것인지를 판정 대상으로 삼았다. 이번 delta 는 직전 라운드(`18_23_54`, Critical
2·Warning 5)의 처분 커밋(`38b49780e`, HEAD)이고 런타임 동작 변경은 `redactToken` 도입 하나다.

프롬프트 페이로드는 108개 파일(대부분 과거 10개 라운드의 review 산출물 누적)이라 diff-only 로는
판단이 부족해 아래를 직접 `Read`/`Bash` 로 열어 대조했다:

- `spec/7-channel-web-chat/3-auth-session.md` 전문(§3.1-2·§3.1-3·§R4·§R6)
- `spec/conventions/spec-impl-evidence.md` §3 (`implemented` 정의)
- `plan/in-progress/webchat-auth-session-status-reconcile.md` 전문(현재 등재된 잔여 5축)
- `codebase/channel-web-chat/src/lib/eia-client.ts`, `src/widget/use-token-refresh.ts`,
  `src/widget/use-widget.ts` 의 관련 함수 실물(`isTerminalAuthError`/`redactToken`/
  `seedWaitingFromStatus`/`shouldAbortAfterSeed`/`start()`/`applyConfig()` 꼬리 블록)
- `git show 38b49780e` — 이 라운드가 실제로 커밋한 diff (JSDoc 자기모순 정정 + redaction + 테스트
  타이밍 보강)
- 독립 실행: `vitest run eia-client.test.ts use-token-refresh.test.ts use-widget-eager-start.test.ts`
  → **123/123 pass**, `tsc --noEmit`(channel-web-chat) → **0 errors**, `vitest run
  spec-status-lifecycle/spec-pending-plan-existence/spec-code-paths/spec-frontmatter/
  plan-frontmatter/spec-link-integrity` → **1115/1115 pass** (RESOLUTION.md 의 집계 숫자를
  그대로 믿지 않고 재실행해 확인).

## 판정 (a) — `status: implemented` 는 여전히 정당하다

`spec-impl-evidence.md §3`: `implemented` = "**모든** 약속 구현 완료". `3-auth-session.md` 본문의
구속력 있는 약속은 §3.1-2(재로드 REST 3분기: `404`→종료, `401`→낙관적 refresh 1회→성공/재차실패/
그외실패, 그외 status→soft-fail)와 §3.1-3(storage 정리 5개 트리거)이다. 코드 대조 결과:

- `404` → `finalizeEnded("execution.not_found")` (`use-widget.ts:706-709`) — §3.1-2 3번째 불릿과 일치.
- `401` → `recoverFromExpiredToken` (`use-widget.ts:498-...`) — 성공 시 `"continue"`(ref 갱신 후
  호출부가 `sessionRef.current` 를 읽음, §R4 CRITICAL 이력의 재발 없음 확인) / 재차 `401`·`410` 시
  `"ended"` / 그 외 실패 시 `"refresh_deferred"`(스트림만 유예, `scheduleRefresh` 는 유지) — §R4 문언
  그대로.
- storage 정리 5트리거 → `finalizeEnded`→`teardownSession()`→`clearSession()` 한 경로로 수렴(SSE
  terminal·200+terminal·404·복구불가 401/410·명령 410) — §3.1-3 열거와 1:1.
- `seedWaitingFromStatus` JSDoc(union 4갈래)·`@returns`·CHANGELOG 세 자리가 이번 라운드에서 서로
  모순 없이 일치함을 확인(과거 C2 CRITICAL 의 재발 없음).

세 회귀(`404`/`401`-성공/`401`-재차실패/그외soft-fail 4케이스, redaction 2케이스, terminal-guard
2케이스)가 전부 통과하고 `tsc`/doc guard 도 clean 이므로, 본문이 명시한 약속 중 미구현은 발견되지
않았다. `status: implemented` 판정 유지가 타당하다.

## 판정 (b) — 두 잔여는 spec 본문이 약속한 것을 미룬 것이 아니다 (회색지대, INFO)

### b-1. `start()`/`applyConfig` 꼬리 블록 중복 — 기능 요구사항이 아니다

`SeedOutcome` 4갈래 모두 두 호출부에서 정확히 같은 방식으로 처리되고(`shouldAbortAfterSeed` 로
중단축은 이미 헬퍼화), 남은 것은 그 뒤 `live` 확정→`deferredStreamRef` 세팅→조건부
`openStream`→`scheduleRefresh` 4단계의 **리터럴 코드 복제**뿐이다. `start()`(`use-widget.ts:839-852`)
와 `applyConfig()`(`:1184-1215`)를 직접 대조하면 두 블록이 문자 그대로 동일하지 않다는 plan 의
주장도 사실이다 — `applyConfig` 는 `clientRef.current` null 가드로 seed 자체를 감싸고
`isAttemptStale(attempt)` checkpoint 를 하나 더 두며 `live` 폴백이 `saved`(`start()` 는 `if (!live)
return` 으로 하드 게이트)로 다르다. spec 은 코드 구조(DRY)를 규정하지 않으므로 이 잔여는 애초에
"본문이 약속한 것"의 범주 밖이고, 조건부 defer("다섯 번째 갈래 추가 시")로 plan 등재된 것은
`implemented` 판정과 무관하다.

### b-2. 주기 갱신 terminal 시 storage 미정리 — spec §3.1-3 이 열거하지 않은 경로다

`spec/7-channel-web-chat/3-auth-session.md:90-91`:

> **storage 정리 책임**: 종료(`completed`/`failed`/`cancelled`) 수신 시, **위 복원**에서
> 200+terminal status·`404`·복구불가 `401`·`410` 확인 시, 그리고 명령 응답 `410 Gone` 수신 시
> 위젯이 즉시 storage 항목을 제거한다.

"위 복원에서" 는 명시적으로 §3.1 재로드 복원 시퀀스(step 2)를 가리킨다. `§3 step7`("만료 30분
이내 → `POST .../refresh-token`")로 묘사되는 **주기 갱신** 자체의 terminal 실패는 이 열거에 없다.
`§R6` 의 "storage 정리 책임(§3.1-3)은 불변식" 문구도 범위를 넓히지 않고 §3.1-3 의 정의 그대로를
가리킨다. 즉 spec 본문은 "주기 갱신이 `401`/`410` 을 받으면 storage 를 지운다" 를 **약속한 적이
없다** — 이 갭은 spec 이 침묵하는 영역이지, 위반된 약속이 아니다.

코드로도 확인했다 — `use-token-refresh.ts` 의 `.catch((err) => { ... if (isTerminalAuthError(err))
return; ... })` 는 재시도만 멈추고 `finalizeEnded`/`clearSession` 을 부르지 않는다(plan 서술과
일치). plan 은 이를 "이 PR 에서 안 고치는 이유"와 함께 명시 등재했고("종전부터 그랬고 이 PR 이
바꾸지 않았다", "사용자가 다음 입력을 하면 `sendCommand` 가 `410` 을 받아 종료로 수렴하므로 가시
결함은 아니다"), `- [ ]` 체크리스트로 후속 설계 결정(주입 vs 별도 통지)을 남겨 뒀다. `implemented`
승격을 가로막는 조건이 아니다.

- **[INFO]** spec §3.1-3 의 "stale 토큰 잔존 금지" 라는 일반 동기 문구가, 열거된 5개 트리거를 넘어
  더 넓게(예: 주기 갱신 자체의 terminal 실패까지) 읽힐 여지가 있어 향후 리뷰 라운드가 같은 질문을
  반복할 수 있다.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:90-91`(§3.1-3), `plan/in-progress/webchat-auth-session-status-reconcile.md:264-277`(§주기 갱신이 terminal 을 만나도...)
  - 상세: 열거 자체는 "위 복원에서" 로 명확히 스코프돼 있어 현재 판정(약속 아님)에는 문제가 없지만,
    괄호 안 동기("stale 토큰 잔존 금지")만 읽으면 일반 불변식으로 오독하기 쉽다. 이번 라운드에서
    이미 한 번(오케스트레이터 질의) 이 경계를 재확인해야 했다는 것 자체가 신호다.
  - 제안: 코드 수정 불요. `project-planner` 턴에서 §3.1-3 끝에 "이 목록은 소진적이며 §3 step7 주기
    갱신 자체의 terminal 실패 시 storage 정리는 별도 축(추적:
    `plan/in-progress/webchat-auth-session-status-reconcile.md`)" 같은 한 줄을 추가하면 다음
    독자/에이전트가 같은 재해석을 반복하지 않는다.

## 그 외 확인 — 이번 delta 의 유일한 런타임 변경(redaction)이 정확히 스코프됐다

- **[INFO]** `redactToken` 이 실제 유일한 토큰 유출 지점에만 적용됨을 grep+코드로 확인
  - 위치: `codebase/channel-web-chat/src/lib/eia-client.ts:179-195`(`isTerminalAuthError`/`redactToken` 정의), `src/widget/use-token-refresh.ts:163-171`(`onRefreshedRef.current?.()` 의 `catch`)
  - 상세: `eia-client.ts` 의 4개 REST 메서드(`startConversation`/`interact`/`getStatus`/`refreshToken`)
    는 전부 `Authorization` 헤더로 토큰을 보내 에러 메시지에 URL 이 없다. `openStream` 만 `EventSource`
    가 헤더를 못 실어 토큰을 쿼리로 심는다(`eia-client.ts:126-133`). 그 동기 throw 가 도달 가능한
    유일한 경로는 `resumeDeferredStreamRef.current(session)` → `onRefreshed` 콜백 → `use-token-refresh.ts`
    의 `onRefreshedRef.current?.()` try/catch 뿐임을 `grep -n "resumeDeferredStreamRef\|onRefreshed"`
    로 확인(호출부 1곳). 그 자리에만 `redactToken` 을 적용한 것은 과소·과잉 없이 정확하다.
    회귀 테스트(`use-widget-eager-start.test.ts`)도 `console.warn` 을 스파이해 실제 로그 문자열에
    토큰이 없음을 직접 단언(vacuous 아님, mock 도 실제 URL 을 담도록 고쳐짐 — RESOLUTION 서술과 코드
    일치 확인).
  - 제안: 없음.

## 요약

이번 delta(`38b49780e`)는 직전 라운드 Critical 2(테스트 오라클 신뢰성·JSDoc 자기모순)·Warning
5(토큰 로그 노출·타입가드 장식·꼬리 블록 중복·문서 색인 2건)의 처분이며, 독립 재실행(vitest
123/123, tsc 0 errors, doc guard 1115/1115)과 spec 본문 대조로 `status: implemented` 판정이
여전히 유효함을 확인했다. plan 에 새로 등재된 두 잔여 중 "꼬리 블록 중복"은 순수 코드 구조
문제(spec 이 규정하지 않는 영역)이고, "주기 갱신 terminal 시 storage 미정리"는 spec §3.1-3 이
"위 복원에서" 로 명시적으로 스코프한 5개 트리거 목록 밖의 경로라 위반된 약속이 아니라 spec 이
침묵하는 회색지대다 — 둘 다 `implemented` 판정을 거짓으로 만들지 않는다. 유일한 런타임 변경인
`redactToken` 은 실제 유일한 토큰 유출 지점에 정확히 적용됐고 회귀로 고정됐다. CRITICAL/WARNING
없음 — spec §3.1-3 의 동기 문구가 향후 오독될 여지가 있다는 점만 INFO 로 남긴다(코드 fix 아님,
spec 명문화 제안).

## 위험도

LOW
