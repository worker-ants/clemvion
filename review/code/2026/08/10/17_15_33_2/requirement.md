# 요구사항(Requirement) Review — spec/7-channel-web-chat/3-auth-session.md

## 발견사항

- **[SPEC-DRIFT][WARNING]** `SeedOutcome` 의 4번째 갈래 `"refresh_deferred"`(네트워크·5xx 로 refresh 가 실패 — 스트림은 안 열되 `scheduleRefresh` 는 건다)가 §3.1-2·§R4 본문 어디에도 서술돼 있지 않다.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:89`(§3.1-2 step2 `401` 분기) · `spec/7-channel-web-chat/3-auth-session.md:104-108`(§R4)
  - 상세: 코드(`codebase/channel-web-chat/src/widget/use-widget.ts` `type SeedOutcome`, 대략 84-106줄 및 `recoverFromExpiredToken`, 대략 403-461줄)는 `401` 낙관적 refresh 의 결과를 **세 갈래**로 나눈다 — ① 성공(`"continue"`), ② `401`/`410` 재실패(복구 불가 확정, `"ended"`), ③ **그 외 이유(네트워크·5xx) 재실패**(`"refresh_deferred"` — 스트림은 열지 않지만 `scheduleRefresh` 는 예약). 그런데 diff 가 갱신한 89번째 줄과 §R4(104-108줄) 는 여전히 ①/② 두 갈래만 서술한다("성공 시 복원, 재차 `401`·`410` 이면 종료로 간주"). ③ 은 언급이 없다. 이 3번째 갈래는 우연이 아니라 두 차례의 실제 CRITICAL 회귀(`SeedOutcome` JSDoc 주석의 `16_42_07`·`16_56_39` 인용, `use-widget.ts:94-106`)를 겪은 뒤 의도적으로 도입된 상태이므로, 코드가 옳고 spec 이 뒤처진 전형적 SPEC-DRIFT 다.
  - 제안: 코드 유지 + spec 반영. §3.1-2 step2 `401` 항목에 "refresh 가 `401`/`410` 이 **아닌** 이유(네트워크·5xx)로 실패하면 종료로 확정하지 않는다 — SSE 는 열지 않되 주기 토큰 갱신(§3 step7)만 예약해 재시도한다" 문장 추가, §R4 Rationale 에도 이 3번째 결과(세션은 살아있음·스트림만 유예)를 명시. 단, 아래 CRITICAL 항목 때문에 "자동 복구된다"는 문구는 지금 넣으면 안 된다.

- **[CRITICAL]** `"refresh_deferred"` 이후 `scheduleRefresh` 의 주기 타이머가 실제로 스트림을 다시 여는 경로가 없다 — 성공해도 토큰만 갱신될 뿐 `openStream` 이 재호출되지 않고, 실패가 한 번 더 나면 그 뒤로는 재예약도 끊긴다. `SeedOutcome` 독스트링이 명시한 "세션은 살아 있고 갱신은 기대할 수 있다"(`use-widget.ts:104`)는 보장이 구조적으로 성립하지 않는다.
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts:79-104`(`scheduleRefresh` 의 `setTimeout` 콜백 — `.then()` 은 `sessionRef` 갱신 + 재귀 재예약만 하고 `openStream` 호출이 없다, `.catch()` 는 `console.warn` 만 하고 재예약을 하지 않는다) · `codebase/channel-web-chat/src/widget/use-widget.ts`(현재 116-121줄 `shouldAbortAfterSeed`, 713-733줄 `start()`, 1069-1090줄 `applyConfig()` — `openStream` 호출부가 이 두 곳뿐이고 둘 다 boot 시점 1회성이라, `scheduleRefresh` 콜백에서 나중에 토큰이 살아나도 이 두 지점으로 되돌아가지 않는다)
  - 상세: `refresh_deferred` 가 반환되면 호출부는 `openStream` 을 건너뛰고 `scheduleRefresh()` 만 1회 호출한다. 이때 `sessionRef.current.expiresAt` 은 **아직 예전(이미 만료/거부된) 토큰의 값**이라 `refreshDelayMs` 가 `TOKEN_REFRESH_MIN_DELAY_MS`(5초)로 clamp 돼 5초 뒤 재시도가 걸린다 — 여기까진 의도대로 동작한다. 그런데 그 재시도가 **성공**하면 `sessionRef` 가 새 토큰으로 갱신되고 다음 만료 기준으로 재귀 재예약될 뿐, **`openStream` 은 아무 데서도 다시 불리지 않는다** — 스트림은 영원히 닫힌 채다. 반대로 그 재시도가 **또 실패**하면(네트워크가 5초 안에 안 풀리는 흔한 경우), `.catch()` 는 로그만 남기고 재예약을 하지 않으므로 갱신 사이클 자체가 죽는다. 두 경우 모두 위젯은 `phase: "streaming"`(스피너)에 자동 복구 수단 없이 머문다 — `SeedOutcome` 자신의 의도("갱신은 기대할 수 있다")와 실제 구현이 어긋난다(점검관점 4). `phase="streaming"` 이 `isActiveConversationPhase` true 라 사용자가 "새 대화" 버튼으로 수동 재시작은 가능하나, `refresh_deferred` 가 노리는 **자동** 복구는 실질적으로 없다.
  - 참고: 관련 잔여 위험이 `plan/in-progress/webchat-auth-session-status-reconcile.md` §"비-terminal refresh 실패 뒤 만료 토큰 재연결"에 "refresh_deferred 뒤 주기 갱신이 실제로 복구까지 이어지는지(백오프·횟수) 미측정"으로 이미 추적돼 있으나, 그 서술은 "측정 안 됨"에 머물고 "openStream 이 재호출되지 않는다"는 **구조적으로 확정 가능한 사실**까지는 짚지 않았다. 기존 회귀 테스트(`use-widget-eager-start.test.ts:460-544` 두 케이스)는 "20초 뒤 refresh 호출이 **1회 늘었다**"만 확인하고 그 이후(재실패 시 재예약 소멸)까지 타이머를 밀지 않아 "갱신 사이클이 살아 있다"는 주석의 함의를 실제로는 부분만 검증한다.
  - 제안: `use-token-refresh.ts` 의 `.catch()` 에도 재예약(가능하면 backoff) 추가, 또는 `use-widget.ts` 에 "스트림이 아직 안 열렸는데 토큰이 갱신됨" 상태를 감지해 `seedWaitingFromStatus`+`openStream` 을 재시도하는 경로 추가. 코드가 고쳐지기 전에는 spec 에 "refresh_deferred 뒤 자동 복구"를 약속하는 문구를 넣지 않는다(현재 상태를 정확히 반영: 수동 "새 대화"만 확실한 경로).

- **[WARNING]** §3.1 상단 배너(v1 구현 현황)의 요약 문구가 §3.1-2 본문보다 부정확하게 넓다 — "재차 실패 시 종료 확정"이라고만 적어 `401`/`410` 한정을 빠뜨렸다.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:66`
  - 상세: 같은 diff 로 갱신된 89번째 줄은 "재차 `401`·`410` 이면 종료로 간주"로 정밀하게 한정했는데, 66번째 줄 배너는 "`401` 은 낙관적 refresh 1회 후 성공 시 복원·**재차 실패 시** 종료 확정(§R4)"라고 적어 마치 refresh 가 어떤 이유로든 다시 실패하면 종료가 확정되는 것처럼 읽힌다. 실제로는(위 CRITICAL 항목 참조) `401`/`410` 이 아닌 재실패는 종료를 확정하지 않고 `"refresh_deferred"` 로 간다. 같은 파일 안에서 상세 절과 요약 배너가 서로 다른 조건을 말하는 셈이라, 요약만 읽는 사람은 잘못된 정신모델(모든 재실패=종료)을 가질 수 있다 — 이 저장소가 과거 두 번 겪은 정확히 그 오판(CRITICAL `16_42_07`)의 문서판이다.
  - 제안: 66번째 줄의 "재차 실패 시 종료 확정"을 "재차 `401`·`410` 이면 종료 확정, 그 외 실패는 스트림만 유예"로 89번째 줄과 맞춘다.

- **[WARNING]** §3.1-2 step3 "storage 정리 책임" 열거가 이번 diff 로 넓어진 401 분기(`401`·`410`)와 비대칭이다 — 여전히 "복구불가 `401`"만 적혀 있다.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:90-91`
  - 상세: 89번째 줄은 이번 diff 로 "재차 `401`·`410`"으로 확장됐는데, 90-91번째 줄(같은 파일, 이번 diff 미변경 컨텍스트)은 여전히 "복구불가 `401` 확인 시"만 storage 정리 트리거로 열거한다. 코드(`finalizeEnded("execution.token_revoked")`, `use-widget.ts:456` 부근)는 `401`·`410` 양쪽에 균일하게 호출되므로 **기능상 결함은 아니다** — 다만 spec 문구만 보면 "refresh 가 `410` 으로 실패했을 때도 storage 를 정리하는가?"가 불명확해진다.
  - 제안: 90-91번째 줄의 "복구불가 `401`"을 "복구불가 `401`·`410`"으로 갱신해 89번째 줄과 대칭 맞춘다.

- **[INFO]** `410`(`EXECUTION_TERMINATED`)이 `/refresh-token` 에서도 실제로 발생한다는 이번 diff(89번째 줄)의 주장은 **정확**하다 — 그런데 그 사실의 근거 문서인 EIA §5.5(`spec/5-system/14-external-interaction-api.md:505-518`)는 여전히 `401 Unauthorized` 만 응답 예시로 적어 `410` 을 빠뜨리고 있다.
  - 위치: `spec/5-system/14-external-interaction-api.md:505-518`(§5.5 토큰 갱신) — 대조: `codebase/backend/src/modules/external-interaction/interaction.controller.ts:149`(`@ApiGoneResponse({ description: 'EXECUTION_TERMINATED' })`), `codebase/backend/src/modules/external-interaction/interaction.service.ts:253,431`(`GoneException({ code: 'EXECUTION_TERMINATED' })`)
  - 상세: 이 리뷰의 대상 파일(3-auth-session.md)이 아니라 그 파일이 근거로 인용하는 EIA 문서 쪽의 gap 이라 이 diff 의 결함은 아니다. 다만 이번 diff 가 "`410` 도 서버가 실제로 내는 분기"라고 새로 명시하면서 EIA §5.5 의 누락이 더 눈에 띄게 됐다 — project-planner 가 EIA §5.5 에도 `410 Gone (EXECUTION_TERMINATED)` 응답 예시를 추가하면 두 문서가 정합해진다.
  - 제안: 본 리뷰어는 spec 을 직접 수정하지 않음. project-planner 턴에서 EIA §5.5 갱신 권장.

- **[INFO]** frontmatter 재판정 대기 안내(67-70번째 줄)는 병행 PR 과의 충돌을 스스로 인지·문서화하고 있어 별도 조치가 필요하지 않다. 절차 문서(`plan/in-progress/webchat-auth-session-status-reconcile.md`)도 두 PR 의 처리 조건을 명확히 구분해 두었다.
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:67-70`

## 요약

이번 diff 는 `404`/복구불가 `401`/낙관적 refresh 1회 구현 완료를 spec 에 반영하고 `410` 을 401 분기에 추가한 점은 실제 백엔드·프런트 구현과 대체로 정합한다. 그러나 parent 가 지목한 `SeedOutcome` 4번째 갈래 `"refresh_deferred"`(네트워크·5xx 로 인한 refresh 실패 시 스트림 유예 + 갱신 재시도)는 §3.1-2·§R4 어디에도 서술돼 있지 않으며(SPEC-DRIFT), 더 중요하게는 코드 추적 결과 그 갈래가 약속하는 "세션은 살아있고 갱신은 기대할 수 있다"는 보장이 구조적으로 성립하지 않는다 — `scheduleRefresh` 의 주기 타이머가 성공해도 `openStream` 을 재호출하지 않고, 재실패하면 재예약 자체가 끊긴다. 그 결과 이 경로에 들어간 위젯은 자동 복구 없이 스피너에 머물 수 있다(수동 "새 대화"만 확실한 탈출구). spec 을 지금 "refresh_deferred → 자동 복구"로 서술하면 실제보다 강한 보장을 약속하게 되므로, 이 CRITICAL 을 먼저 해소(또는 최소한 spec 에 한계를 정확히 반영)한 뒤 §3.1-2/§R4 갱신을 진행하는 순서를 권한다. 그 외 배너 문구의 "재차 실패 시 종료 확정"이 401/410 한정을 빠뜨려 §3.1-2 본문과 어긋나는 점, step3 storage 정리 열거가 이번 401→401·410 확장과 비대칭인 점도 함께 정리하면 좋다.

## 위험도

MEDIUM
