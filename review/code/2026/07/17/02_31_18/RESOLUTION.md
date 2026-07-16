# RESOLUTION — ai-review 2026-07-17 02_31_18

> 대상: `e99f46145..HEAD` (CRITICAL fix 커밋 `9dd47e6c9`)
> 결과: **RISK MEDIUM / Critical 0 / Warning 7 / INFO 3** → **WARNING 7건 전부 처리**.
> **직전 라운드 CRITICAL 은 재발하지 않음** — scope reviewer 가 처분표 7건 1:1 대응 확인, requirement 가 mutation 으로 fix 정확성 재현.

## ⚠ 직전 RESOLUTION(`02_04_13`)의 부정확한 기록 2건 — 본 라운드가 적발

reviewer 가 내 처분 기록을 diff 와 대조해 **두 건의 과장**을 잡았다. 사실관계로 정정한다:

1. **"인라인 주석도 동형 갱신"(SD1 행) — 거짓.** spec §3.1 만 고쳤고 `use-widget.ts` 의 `replay_unavailable` 인라인 주석은 "종료 신호가 아니므로 스트림·세션은 유지" 로 **그대로 뒀다**. → 본 라운드에서 실제로 정정(W3).
2. **"3중 단언"(applyConfig 회귀 테스트) — 과장.** `expect(refreshCalls).toBe(0)` 은 **decorative** 였다 — 세션 만료가 90분 뒤라 refresh 발화는 60분 후이고 fake timer 미사용이라 **게이팅 성공/실패와 무관하게 항상 통과**했다. 실질 검출력은 `getEs()===null` 1개뿐이었다. → 본 라운드에서 fake timer 로 실효화(W6).

**교훈**: RESOLUTION 은 "고쳤다" 를 주장하는 문서이므로, 작성 전 **diff 로 실제 이행을 대조**해야 한다. 주장과 실제가 어긋나면 다음 사람이 그 기록을 믿고 재검증을 생략한다.

## 처리 결과

| # | 카테고리 | 발견 | 처분 | 근거 |
|---|---|---|---|---|
| W1 | side_effect | `endedRef` 1회 가드가 `sendCommand` 의 **410 Gone** 경로를 커버 못함 — SSE terminal 로 종료된 뒤 in-flight 명령이 410 을 받으면 `finalizeEnded` 를 거치지 않고 재차 `dispatch(ENDED)`+`sendEvent` → host 가 같은 종료를 **2회 통지** | **fix** | 410 catch 를 `finalizeEnded("gone")` 경유로 편입해 `endedRef` 가드를 공유. 회귀 테스트 추가(아래 W7b) |
| W2 | concurrency | `Promise<boolean>` 반환이 **"정상 시드"와 "stale 폐기"를 같은 `false`** 로 뭉갬 → `applyConfig` 가 구분 못해, 마운트 직후 getStatus 왕복 중 host 가 새 대화를 시작하면 지연 응답이 **새 대화의 SSE 스트림을 옛 토큰으로 탈취** | **fix** | reviewer 제안대로 **3-state `SeedOutcome`**(`"ended"`/`"stale"`/`"continue"`)으로 승격. 세 호출부 모두 `!== "continue"` 로 중단. mutation 확인 — staleness 가드 무력화 시 신규 테스트 1건 실패 |
| W3 | documentation / requirement / maintainability *(3 reviewer 공통)* | `replay_unavailable` **인라인 주석이 여전히 "스트림·세션 유지" 로 무조건 서술** — spec 은 terminal 예외를 명문화했는데 코드에 가장 가까운 주석만 stale. + 직전 RESOLUTION 의 "동형 갱신" 기록이 사실과 다름 | **fix** | 주석을 spec §3.1 과 동형으로 정정. 부정확 기록은 위 §에 사실관계로 명시 |
| W4 | maintainability | 공개 액션 `endConversation()` 이 `finalizeEnded`/`endedRef` 체계 **밖**에서 자체 종료 시퀀스 + 별도 가드(`state.phase`) 유지 → `resetSessionRefs()` 가 `endedRef=false` 로 되돌린 뒤 직접 dispatch 해 **`phase==="ended"` 인데 `endedRef===false`** 불일치 발생 | **fix** | `resetSessionRefs(); finalizeEnded(reason);` 로 통합 — 종료 시퀀스·1회 가드를 SSE terminal·REST 폴백·410 네 경로가 공유 |
| W5 | testing | `start()` 의 신규 `ended` 게이팅을 exercise 하는 테스트 없음 — "그 줄을 지워도 30개가 통과할 것" | **fix(테스트) + 사실 정정** | **reviewer 예측이 맞았다**(실측: 지워도 30/30 통과). 다만 원인은 커버리지 갭이 아니라 **그 줄이 중복**이기 때문 — `"ended"`/`"stale"` 둘 다 `teardownSession()` 이 `startGenRef` 를 올려 **바로 아래 gen 검사가 독립적으로 잡는다**. 가짜 테스트를 만드는 대신 **중복임을 코드 주석에 명시**하고 남겼다(삭제 아님): CRITICAL 이 바로 "startGenRef 로 **우연히** 보호되던 대칭 없는 구조" 에서 나왔으므로, 세 호출부가 같은 계약으로 명시 게이팅하는 편이 간접 결합보다 안전하다. 별도로 **"start() 직후 스냅샷이 terminal → openStream 미호출 + 즉시 ended"** 테스트는 추가(동작 자체는 고정) |
| W6 | testing | `expect(refreshCalls).toBe(0)` 이 **decorative** — 90분 만료 → 60분 뒤 발화, fake timer 미사용이라 항상 통과 | **fix** | 실측 확인(`TOKEN_REFRESH_LEAD_MS=30분`, `expiresAt=90분` → delay 60분). 세션 만료를 `30분+6초` 로 당겨 delay≈6초로 만들고 `vi.useFakeTimers({shouldAdvanceTime:true})` + `advanceTimersByTimeAsync(10s)` 로 **타이머를 실제 통과**시킨 뒤 단언 |
| W7 | testing *(requirement 도 동일 지적)* | W2(staleness)·W3(`endedRef` dedup) 전용 회귀 테스트 없음 — **"각각 무력화해도 실패 안 할 것"** | **fix** | **실측으로 확인**(둘 다 무력화해도 30/30 통과 — CRITICAL 을 놓친 것과 정확히 같은 구조). 두 테스트 추가: (a) getStatus 를 pending 으로 잡아둔 채 `newChat()` 으로 세션 교체 후 terminal 응답 resolve → stale 폐기 단언, (b) **in-flight** 명령이 SSE terminal 뒤 410 으로 resolve → `conversationEnded` 1회 단언. **(b) 는 첫 작성이 틀렸다** — 종료 *후* 새 명령은 `submitMessage` 가 phase 가드로 큐에 넣어 `sendCommand` 에 닿지 않는다. reviewer 가 말한 **in-flight** 시나리오로 재작성해서야 가드를 exercise 했다 |

## INFO

| # | 발견 | 처분 |
|---|---|---|
| I1 | `seedWaitingFromStatus` JSDoc 요약 줄이 확장된 책임(terminal 정리) 미반영 | **fix** — 요약 줄에 terminal 전이 추가 |
| I2 | `ai-review` 인용 주석이 날짜 없이 세션 시각만 사용 | **부분 반영** — 이번에 새로 추가한 인용은 `2026-07-17 02_31_18` 형식으로 작성. 기존 `02_04_13` 인용의 일괄 정정은 본 PR 범위 밖(별건 정리) |
| I3 | `useWidget` 비대화 지속 — `useEiaStream` 분리 후보 | **이월** — reviewer 도 "즉시 조치 불필요". 이 영역에 SSE 로직이 더 붙는 다음 변경의 과제 |

## 검증

- **TEST WORKFLOW**: lint **PASS** / unit **PASS**(5스택) / build **PASS** / e2e **PASS (256)**. tsc clean.
- **mutation 검증 (fix 前/後 대조)** — 이번 라운드의 핵심:

  | 가드 | fix 前 | fix 後 |
  |---|---|---|
  | W2 staleness | 무력화해도 **30/30 통과** ❌ | 무력화 시 **1 fail** ✅ |
  | W3 `endedRef` dedup | 무력화해도 **30/30 통과** ❌ | 무력화 시 **1 fail** ✅ |
  | CRITICAL `applyConfig` 게이팅 | — | 무력화 시 **1 fail** ✅ (유지) |
  | W5 `start()` 게이팅 | 무력화해도 통과 | **여전히 통과 — 중복 코드라 정상**(위 W5 근거) |

- `use-widget-eager-start.test.ts` **33 passed**(30→33) / widget 전체 **127 passed**.

## 남은 판단 — 사용자 보고 대상

⑨-4 는 "**사용자 결정 없이 바로 처리 가능**" 으로 분류했으나, 실제로는 **3라운드 리뷰에 걸쳐 CRITICAL 1건 + WARNING 10건**을 낳은 위젯 세션 라이프사이클 변경이었다. 분류가 낙관적이었다 — spec 이 동작을 확정해 뒀다는 점(= 제품 결정 불요)은 맞았지만, **구현 리스크**는 "바로 처리" 수준이 아니었다. 별도 PR 로 분리했어야 한다는 scope reviewer 의 반복 지적이 타당하다.
