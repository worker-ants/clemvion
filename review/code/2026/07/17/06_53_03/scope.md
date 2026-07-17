# 변경 범위(Scope) Review

## 검토 방법

`git show --stat HEAD`(`4dad5993c`)로 실제 커밋 경계를 대조해 payload 의 14개 파일이 정확히 단일
커밋에 대응함을 확인했다. 실행 코드는 파일 1~2(`use-widget-eager-start.test.ts`,
`use-widget.ts`) 뿐이고, 파일 3~14 는 직전 라운드(`review/code/2026/07/17/02_31_18/`) 리뷰
산출물의 신규 커밋이다. `RESOLUTION.md` 의 처분표(W1~W7, I1~I3)를 SoT 로 두고 코드 diff 를
항목별로 1:1 대조했다.

## 발견사항

- **[INFO]** 프로덕션/테스트 코드 수정(W1~W7 fix)과 직전 리뷰 라운드 산출물 12개 파일(약
  850줄) 커밋이 하나의 커밋(`4dad5993c`)에 함께 묶여 있다.
  - 위치: 커밋 `4dad5993c` 전체 (`use-widget.ts`, `use-widget-eager-start.test.ts` vs
    `review/code/2026/07/17/02_31_18/**` 12개 파일)
  - 상세: `review/code/**` 저장은 CLAUDE.md 가 지정한 정식 위치이고 이번에 커밋된 산출물은
    바로 이 코드 fix 를 유발한 리뷰 라운드의 기록이므로 "무관한 파일"은 아니다. 다만 `codebase/**`
    변경이 포함된 커밋이라 review-guard 가 재무장되어 이번처럼 추가 리뷰 라운드(`06_53_03`)가
    다시 필요해지는 구조다. 사용자 메모리("Review gate loop avoidance")가 권장하는 "fix 커밋들
    뒤에 review/**-only 종결 커밋"과는 결이 다르지만, 이번 커밋 자체가 최종 종결 커밋이라고
    주장하지 않으므로 위반은 아니며 차단 사유가 아니다.
  - 제안: 조치 불필요. 이번 라운드(`06_53_03`)의 WARNING/INFO 를 처리한 뒤 최종적으로
    `review/**` 전용 커밋으로 마무리하는 관례를 유지 권고.

## 항목별 대조 (RESOLUTION.md 처분표 vs 실제 diff)

| # | RESOLUTION 주장 | diff 확인 |
|---|---|---|
| W1 | `sendCommand` 410 catch → `finalizeEnded("gone")` 경유 | `use-widget.ts` 410 catch 블록이 `dispatch(ENDED)+sendEvent` 인라인을 제거하고 `finalizeEnded("gone")` 으로 대체됨. 일치 |
| W2 | `Promise<boolean>` → 3-state `SeedOutcome`("ended"/"stale"/"continue") 승격, 3개 호출부 모두 `!== "continue"` 게이팅 | `SeedOutcome` 타입 신설, `seedWaitingFromStatus` 반환문 3곳(`"stale"`/`"ended"`/`"continue"`) 전환, `start()`/`applyConfig`/폴백 호출부 반환 처리 갱신. 일치. `replay_unavailable` 폴백 호출부(fire-and-forget)는 반환값을 애초에 안 보므로 게이팅 대상에서 정확히 제외됨 |
| W3 | `replay_unavailable` 인라인 주석 spec §3.1 동형 정정 | 주석이 "기본적으로 유지"+"단 스냅샷이 이미 terminal 이면 `seedWaitingFromStatus` 가 `finalizeEnded` 로 종료 확정"으로 갱신됨. 일치 |
| W4 | `endConversation` → `resetSessionRefs(); finalizeEnded(reason);` 통합 | 직접 `dispatch`+`sendEvent` 인라인이 제거되고 `finalizeEnded(reason)` 호출로 대체, `useCallback` deps 에 `finalizeEnded` 추가. 일치 |
| W5 | `start()` 게이팅 회귀 테스트 신규 추가 + "중복이나 명시 계약 위해 유지" 주석 | 신규 `it("start() 직후 스냅샷이 terminal → openStream 미호출 + 즉시 ended")` 테스트 추가, `start()` 내 해당 게이팅 줄 위에 근거 주석 추가. 일치 |
| W6 | decorative `refreshCalls` 단언을 fake timer 로 실효화 | 만료 시각을 `30분+6초`로 변경, `vi.useFakeTimers({shouldAdvanceTime:true})` + `advanceTimersByTimeAsync(10_000)` 추가. 일치 |
| W7(a) | stale 세션 교체 회귀 테스트 추가 | 신규 `it("stale 응답(세션 교체 후 도착)은 폐기된다...")` 테스트, `newChat()` 으로 세션 교체 후 지연 terminal 응답이 폐기됨을 단언. 일치 |
| W7(b) | in-flight 410 dedup 회귀 테스트 추가 | 신규 `it("in-flight 명령의 410 이 SSE terminal 뒤 도착해도 conversationEnded 는 1회만")` 테스트, `postMessage` spy 로 1회만 발사됨을 단언. 일치 |
| I1 | `seedWaitingFromStatus` JSDoc 요약 줄 확장 | 요약 줄이 "표면을 시드하거나, 스냅샷이 이미 terminal 이면 세션을 정리하고 ENDED 로 전이한다"로 확장. 일치 |
| I2 | 신규 인용만 날짜 포함 포맷, 기존 인용은 그대로 둠(범위 외 선언) | 신규 인용 4곳(`2026-07-17 02_31_18 W2/W4/W5/W6`) 모두 날짜 포함. 기존 `` `02_04_13` `` 인용은 diff 에 등장하지 않음(미변경). 선언과 일치 |
| I3 | `useWidget` 분리는 이월, 조치 없음 | diff 에 구조 분리 없음. 일치 |

각 항목에서 코드 변경 범위가 해당 처분 근거를 초과하거나 벗어나는 지점은 발견되지 않았다.
불필요한 리팩토링, 요청 외 기능 추가, 무관한 파일·영역 수정, 의미 없는 포맷팅/공백 변경,
불필요한 주석 추가·삭제, 미사용 임포트, 의도치 않은 설정 변경 — 모두 해당 없음.

## 요약

코드 diff(파일 1~2)는 직전 라운드(`02_31_18`) `RESOLUTION.md` 가 명시한 WARNING 7건·INFO
2건과 정확히 1:1 대응하며, 그 이상의 수정(리팩토링·기능확장·무관한 파일·포맷팅·주석·임포트·설정)은
없다. 나머지 12개 파일은 CLAUDE.md 가 지정한 `review/code/**` 저장 위치에 바로 그 리뷰 라운드
산출물을 커밋한 것으로, 이번 코드 fix 의 직접적 근거 문서라 범위 이탈이 아니다. 코드 fix 와
리뷰 산출물 커밋이 한 커밋에 묶여 review-guard 가 재무장되는 구조적 특성만 INFO 로 남긴다.

## 위험도

NONE
