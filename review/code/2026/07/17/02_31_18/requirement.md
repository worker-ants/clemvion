# 요구사항(Requirement) Review

대상: `436ee334e..HEAD`(직전 라운드 `02_04_13`의 fix 커밋 `9dd47e6c9`)를 재확인. 실 코드 변경은 3개
파일(`webauthn.controller.spec.ts`, `use-widget-eager-start.test.ts`, `use-widget.ts`) + spec 문서 1개
(`spec/7-channel-web-chat/1-widget-app.md`) + plan/review 기록 문서들. `git status --short` 로 worktree
가 review 산출물(신규 미추적) 외 clean 임을 확인 — 1~3번 실 코드는 이미 커밋된 fix `9dd47e6c9` 를 재확인
하는 것.

## 검증 방법

코드 정독 + 독립 mutation 테스트 직접 재현: `applyConfig`(세션 복원) 경로의 신규 게이팅
(`const ended = await seedWaitingFromStatus(...); if (ended) return;`)만 되돌려(`await` 만 하고 반환값
무시) `use-widget-eager-start.test.ts` 를 재실행 → **정확히 신규 복원 테스트 1건만 실패**
(`30 passed`→`29 passed, 1 failed`, 실패 지점 `expect(getEs()).toBeNull()`)를 재현 확인. 이후 `git checkout`
으로 원복, 재실행해 `30 passed` 복귀 확인. `webauthn.controller.spec.ts` 도 별도로 `11 passed` 확인.
RESOLUTION.md 의 "회귀 검출력(mutation 검증)" 주장과 테스트 통과 수 주장 모두 정확함을 실측으로 재확인.

## 발견사항

- **[WARNING]** `handleEiaEvent` 의 `execution.replay_unavailable` 분기 인라인 주석이 이번 fix 이후에도 여전히 무조건 "스트림·세션은 유지" 로 서술 — RESOLUTION.md 의 "동형 갱신" 주장과 실제 코드가 불일치
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:204-207`(`handleEiaEvent` 의 `execution.replay_unavailable` 분기 인라인 주석) vs `review/code/2026/07/17/02_04_13/RESOLUTION.md` SD1 행("`handleEiaEvent` 인라인 주석·plan 서술도 동형 갱신")
  - 상세: `git show 9dd47e6c9 -- .../use-widget.ts` 로 직접 확인 — 이번 fix 커밋의 diff 는 `seedWaitingFromStatus` 정의부 JSDoc(`:261-262` 근방, terminal 예외 정확히 반영됨)와 `applyConfig`/`start()` 호출부 주석은 갱신했지만, `handleEiaEvent` 의 `execution.replay_unavailable` 분기 바로 위 인라인 주석(`:207`, `"**종료 신호가 아니므로 스트림·세션은 유지** — 이후 이벤트는 정상 처리된다."`)은 **손대지 않았다**(`grep "종료 신호가 아니므로"` 결과 이 1곳만 남음). 반면 RESOLUTION.md 의 SD1 처분 근거는 "§3.1 에 terminal 예외 명문화. `handleEiaEvent` 인라인 주석·plan 서술도 동형 갱신" 이라고 **완료를 주장**한다. 실제로는 spec(`spec/7-channel-web-chat/1-widget-app.md:104-107`) 과 plan(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:20`)만 갱신됐고, 코드 인라인 주석은 직전 라운드(`02_04_13`) documentation reviewer 가 WARNING 으로 지적했던 그 문구 그대로 남았다. 기능적 위험은 낮다 — SoT 인 spec 문서와 `seedWaitingFromStatus` 자신의 JSDoc(`**종료 상태 처리**` 불릿)은 이미 예외를 정확히 서술하므로, 향후 유지보수자가 이 특정 인라인 주석 한 곳만 보고 오판할 가능성은 직전 라운드보다 줄었다. 다만 "fix 완료" 로 기록된 RESOLUTION.md 자체의 정확성 문제이자, 실제로 stale 주석이 코드에 남아있다는 점은 재발 시(예: `replay_unavailable` 분기를 다시 만지는 유지보수자가 이 주석만 보고 판단) 여전히 유효한 위험이다.
  - 제안: `use-widget.ts:207` 주석을 "신호 자체는 종료가 아니므로 기본적으로 스트림·세션은 유지하나, `seedWaitingFromStatus` 재조회 결과가 이미 terminal 이면 정리+ENDED 로 전이한다(terminal 예외는 함수 정의부 JSDoc 참고)." 정도로 정정. RESOLUTION.md 재수정은 소급 불가이므로(과거 이력) 조치 대상 아님 — 코드 주석만 후속 커밋으로 정정 권장.

- **[INFO]** 신규 "복원된 세션이 이미 terminal" 테스트의 `refreshCalls === 0` 단언이 `scheduleRefresh()` 미호출을 강하게 검증하지 못함
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:213-249`(신규 테스트), `use-token-refresh.ts:59-63`(`scheduleRefresh` — `refreshDelayMs` 로 `setTimeout` 지연 계산)
  - 상세: 테스트는 `expiresAt: now + 90분` 세션을 쓴다. `scheduleRefresh()` 가 실제로 호출됐더라도 `TOKEN_REFRESH_LEAD_MS`(30분) 를 뺀 지연은 약 60분이라, `vi.useFakeTimers()` 없이 실시간으로 도는 이 테스트에서는 `setTimeout` 콜백이 절대 발화하지 않는다. 즉 `refreshCalls === 0` 은 "`scheduleRefresh()` 가 호출되지 않았다" 를 증명하는 것이 아니라 "테스트 실행 시간 안에 타이머가 발화하지 않았다" 는, `scheduleRefresh()` 가 호출됐어도 참인 명제다. 주석("종료된 세션 기준 토큰 갱신을 예약/호출하지 않는다")이 "예약" 도 검증한다고 주장하지만 실제로는 "호출(즉시 발화)" 만 검증한다. `getEs()`(SSE 미오픈)·`sessionStorage`(부활 없음) 두 단언은 직접적이고 강하다.
  - 제안: `vi.useFakeTimers()` + `vi.advanceTimersByTime(...)` 로 타이머를 실제 발화 시점까지 진행시켜 `refreshCalls` 를 검증하거나, `scheduleRefresh` 호출 여부를 직접 스파이(예: `use-token-refresh` 모듈 mock)하는 방식으로 강화 권장. 저비용 개선이라 우선순위는 낮음.

- **[INFO]** `finalizeEnded` 의 중복 발사 방지(`endedRef`, W3) 자체를 직접 겨냥한 회귀 테스트 부재
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:166-176`(`finalizeEnded`), 회귀 테스트는 `use-widget-eager-start.test.ts` 에 SSE-terminal-and-REST-fallback 동시 발화 시나리오 없음
  - 상세: RESOLUTION.md 는 W3(host `conversationEnded` 중복 발사)를 `endedRef` 로 fix 했다고 밝히지만, 이번 diff 의 신규 테스트 4건(버퍼 만료 재동기화·이미 종료됐으면 ENDED·폴백 getStatus 실패 시 soft-fail·복원된 세션이 이미 terminal) 중 "SSE terminal 이벤트와 REST 폴백 terminal 이 같은 종료에 대해 동시/순차 발화해도 `sendEvent("conversationEnded")` 가 1회만 나가는지" 를 직접 단언하는 테스트는 없다. 로직 자체가 단순한 boolean 가드라 위험은 낮지만, 이 가드가 바로 이번 라운드가 고친 CRITICAL 의 자매 결함(W3)이었던 점을 고려하면 회귀 고정 공백이다.
  - 제안: `handleEiaEvent` 로 terminal SSE 이벤트를 주입한 뒤 이어서 (또는 동시에) `seedWaitingFromStatus` 경로가 같은 세션에 대해 terminal 을 재확인하는 시나리오를 만들어 `bridgeRef.sendEvent` mock 호출 횟수(또는 host 로 나가는 `conversationEnded` 카운트)가 1인지 단언하는 테스트 추가 — 저비용·직접적 회귀 검출력.

- **[NONE]** CRITICAL 재발 방지 게이팅 로직 — 실측 mutation 테스트로 정확성 확인
  - 위치: `use-widget.ts:615-618`(`applyConfig` 세션 복원 경로), `:371-372`(`start()`), `:288-290`(`seedWaitingFromStatus` 내부 terminal 분기)
  - 상세: 세 호출부 모두 `seedWaitingFromStatus` 의 `Promise<boolean>` 반환값으로 후속 `openStream`/`scheduleRefresh` 를 게이팅한다. `applyConfig` 게이팅만 되돌려(반환값 무시) 재실행한 결과, 신규 복원 테스트 1건만 정확히 실패(SSE 미오픈 단언 위반)함을 직접 재현 확인 — RESOLUTION.md 의 "회귀로 고정됐다" 주장이 정확하다. staleness 가드(`sessionRef.current !== session`)·`endedRef` 1회 가드도 코드상 정확히 구현돼 있고, `resetSessionRefs`(newChat/endConversation)가 `endedRef.current = false` 로 해제해 다음 대화의 종료 처리가 다시 가능함을 확인.
  - 판정: 조치 불필요.

- **[NONE]** `mapCredential` nullable 필드(`deviceName`/`lastUsedAt`) 테스트가 실제 구현과 정확히 일치
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts:36-63`(신규 테스트) vs `webauthn.controller.ts:377-391`(`mapCredential`, `lastUsedAt: c.lastUsedAt ? c.lastUsedAt.toISOString() : null`)
  - 판정: 테스트가 `lastUsedAt: null` 이 `toISOString()` 이 아니라 `null` 그대로 나옴을 정확히 pin. 조치 불필요.

- **[NONE]** SPEC-DRIFT(이전 라운드 SD1) 해소 확인 — `spec/7-channel-web-chat/1-widget-app.md` §3.1 이 이번 diff(파일 19)에서 terminal 예외를 명문화
  - 위치: `spec/7-channel-web-chat/1-widget-app.md:104-114`
  - 상세: "신호 자체는 종료를 뜻하지 않으므로 기본적으로 스트림·세션은 유지" + "단, 스냅샷이 이미 terminal 이면 종료로 확정한다"(gap 중 종료 시 terminal 이벤트 유실 근거 [EIA §Rationale `R-replay-unavailable`] 인용 포함) + "같은 판정은 세션 복원 시점에도 적용" 문구가 정확히 구현(`seedWaitingFromStatus` + `applyConfig` 게이팅)과 line-level 로 대응한다. `R-replay-unavailable` 앵커도 `14-external-interaction-api.md:1247` 에 실존 확인. 이전 라운드가 지적한 SPEC-DRIFT 가 정상적으로 spec 반영을 통해 해소됐다(코드 되돌리기가 아니라 spec 갱신 — 올바른 처분 방향).
  - 판정: 조치 불필요.

## 요약

이번 diff 의 핵심(`applyConfig` 세션 복원 경로에 `seedWaitingFromStatus` 반환값 게이팅 추가, `finalizeEnded` 헬퍼 추출, staleness/dedup 가드)은 직전 라운드가 지적한 CRITICAL(무효 토큰 SSE 재오픈 + 종료 세션 storage 부활)을 정확히 고쳤음을 코드 정독과 독립 mutation 테스트로 직접 확인했다. `Promise<boolean>` 반환 계약으로 세 호출부(`start`/`applyConfig`/`replay_unavailable` 폴백)를 통일 게이팅한 설계는 근본 원인(부작용 추가 시 계약 미노출)에 대한 타당한 구조적 해법이다. spec(`1-widget-app.md §3.1`)도 이번 diff 에서 terminal 예외를 명문화해 직전 라운드의 SPEC-DRIFT 를 올바른 방향(spec 갱신)으로 해소했다. 잔여 이슈는 낮은 위험도: (1) RESOLUTION.md 가 "동형 갱신" 됐다고 주장한 `handleEiaEvent` 의 `execution.replay_unavailable` 인라인 주석이 실제로는 갱신되지 않고 여전히 무조건 "스트림·세션 유지" 로 서술하는 documentation 정확성 문제(WARNING, 기능 위험은 SoT 인 spec/JSDoc 이 정확해 낮음), (2) 신규 테스트 일부의 검증력이 이름/의도만큼 강하지 않은 지점(refresh 미호출 단언이 실시간 지연 특성상 약함, dedup 자체를 직접 겨냥한 테스트 부재) 2건(INFO). TODO/FIXME 미완성 표지 없음, 모든 코드 경로에서 반환값 계약 준수 확인, 엣지케이스(null 필드, 이미 terminal 상태, staleness 경합) 커버리지 양호.

## 위험도
LOW
