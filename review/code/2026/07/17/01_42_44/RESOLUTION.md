# RESOLUTION — ai-review 2026-07-17 01_42_44

> 대상: `cb24181d0..HEAD` (⑨ codebase 3건 = `436ee334e`)
> 결과: **RISK LOW / Critical 0 / Warning 2**(SUMMARY 기준) → **전수 확보 후 실질 WARNING 3건**으로 늘어남. 전부 fix.
> router: 9명 실행 / 5명 제외.

## ⚠ SUMMARY 가 놓친 발견 — 전수 확보로 드러남

SUMMARY 는 9개 중 **4개(security/performance/maintainability/testing)** 산출물만 확보한 채 작성돼 `RISK LOW · WARNING 2` 로 보고했다. 나머지 5개(requirement/scope/side_effect/documentation/user_guide_sync)를 journal 에서 복구하자 **requirement 가 본 구현의 실질 결함을 잡아냈다** — SUMMARY 에는 전혀 반영되지 않은 항목이다. FS-write flakiness 가 단순 "산출물 유실" 이 아니라 **판정 자체를 왜곡**할 수 있음을 보여주는 사례.

## 처리 결과

| # | Checker | 발견 | 처분 | 근거 |
|---|---|---|---|---|
| **W-req** | requirement *(SUMMARY 미반영)* | **`replay_unavailable` 폴백이 terminal 상태를 처리하지 않음** — 5분 버퍼 gap 안에 execution 이 종료됐다면 그 terminal SSE 이벤트도 **버퍼와 함께 유실**돼 다시 오지 않는다(서버는 신호 후 연결만 유지·재전송 안 함, EIA `R-replay-unavailable`). `seedWaitingFromStatus` 는 `waiting_for_input` 만 처리하고 나머지는 silent no-op → 위젯이 `streaming`("AI 응답 중" 스피너)에 **무기한 정지**. `awaiting_user_message` 면 사용자 발화 시 410 으로 사후 복구되지만 `streaming` 은 **복구 경로 자체가 없다** | **fix** | 정확한 지적이고 **내 구현의 실질 버그**였다. 폴백을 붙이면서 "현재 표면 시드" 만 생각하고 "gap 중 종료" 를 놓쳤다. `seedWaitingFromStatus` 안에 terminal 분기 추가 — `TERMINAL_EVENTS` 재사용해 SSE terminal 경로와 **동일 처리**(teardown + `ENDED` + host `conversationEnded` 통지). 세 호출부(start·restore·replay 폴백) 모두가 이 보호를 받는다 |
| W1 | maintainability | `seedWaitingFromStatusRef.current = ...` render-body 대입이 같은 파일이 명문화한 "ref 갱신은 render 중이 아니라 effect 에서"(`apiRef` 컨벤션) 와 어긋남. 현재는 deps `[]` 라 무해하나 deps 가 늘면 조용히 stale | **fix** | 타당. `apiRef` 와 동일하게 `useEffect(() => { ... })` 로 통일. **때마침 W-req fix 로 deps 가 `[]` → `[teardownSession]` 이 됐다** — reviewer 가 예견한 "deps 가 나중에 늘어나면" 이 같은 PR 안에서 현실이 됐으므로 effect 전환이 결과적으로 필수였다. JSDoc 의 "의존성 배열 `[]`" 서술도 함께 정정 |
| W2 | testing | `webauthn-response.dto.ts` JSDoc 이 `{ data: { items: [] } }` 를 "load-bearing 계약" 으로 **새로 명문화했는데 이를 pin 하는 테스트가 어느 계층에도 없음**. 동형인 `SessionsController.listSessions` 는 `sessions.controller.spec.ts` 가 고정 중이라 비대칭 | **fix** | 정확한 지적 — 계약이라 문서에 써놓고 보호는 안 한 상태였다. `webauthn.controller.spec.ts` 에 `describe('webauthnList')` 추가(정상 매핑 + **빈 배열도 envelope 유지** 2건), `sessions.controller.spec.ts` 와 동형. mock 에 `listCredentials` 추가. **envelope 을 bare array 로 낮춰 신규 2건만 실패함을 확인**(회귀 검출력 검증) |
| I2 | testing/maintainability | 신규 테스트의 GET 판정(`init?.method === undefined`)이 파일 기존 관용구(`(init?.method ?? "GET") === "GET"`)와 다름 — 향후 `getStatus` 가 method 명시 시 mock 브랜치가 조용히 매치 실패 | **fix** | 저비용이고 실제 함정이라 반영 — 기존 관용구로 통일(5곳). |
| I3 | testing | 폴백 실패 경로(`getStatus` 410/네트워크 오류) 미커버 — "데이터 유실 복구 수단 자체가 실패하는 케이스" 가 unasserted | **fix** | 타당. 폴백 getStatus 실패 시 **크래시 없이 기존 흐름 유지(soft-fail)** 를 단언하는 테스트 추가. 종료로 오판하지 않고 스트림도 살아있음을 확인 |

## INFO (조치 불요 — 판단 기록)

| # | Checker | 발견 | 판단 |
|---|---|---|---|
| I1 | performance | `replay_unavailable` 수신마다 in-flight 확인 없이 `getStatus` 재조회 | reviewer 도 "정상 범위 문제없음 — 서버가 gap 당 1회만 신호" 로 판정. 즉시 조치 불필요 |
| I-req2 | requirement | 다중 수신 시 `getStatus` 동시 호출의 순서/de-dup 가드 없음(stale 응답이 최신을 덮을 이론적 race) | reviewer 판정대로 "서버가 gap 당 1회 신호 → 실무 발생 가능성 낮음". `startGenRef` 유사 가드는 과설계라 보류 |
| I4 | maintainability | TDZ 근거 주석이 ref 선언부·대입부 두 곳 중복 | effect 전환하며 대입부 주석을 간결화해 자연 완화 |
| I5 | maintainability | `useWidget` 이 대형(500행+) — SSE 처리 축 분리 후보(`useEiaStream` 가칭) | reviewer 도 "즉시 조치 불필요". 이 영역에 SSE 로직이 더 붙는 다음 변경의 과제 |
| I-scope | scope | backend auth webauthn 이 channel-web-chat PR 에 번들 | **의도된 것** — 사용자가 ⑨를 "바로 처리 가능한 항목" 묶음으로 지시했고 셋 다 그 성격이다. 커밋 메시지가 ⑨-2/⑨-3/⑨-4 로 분리 표기 |

## 검증

- **TEST WORKFLOW (리뷰 fix 後 재수행)**: lint **PASS** / unit **PASS**(5스택) / build **PASS** / e2e **PASS (256)**.
- **회귀 검출력 (mutation 검증)** — 세 건 모두 "구현을 무력화하면 해당 테스트만 실패" 확인:
  - `replay_unavailable` 소비 배선 무력화 → 신규 1건만 실패.
  - **terminal 분기 무력화 → 신규 terminal 테스트만 실패** (W-req fix 검증).
  - webauthn envelope → bare array → 신규 2건만 실패 (W2 fix 검증).
- `use-widget-eager-start.test.ts` **29 passed**(27→29, terminal·폴백실패 2건 추가) / `webauthn.controller.spec.ts` **10 passed**(8→10).

## 교훈 — FS-write flakiness 가 판정을 왜곡한다

지금까지 5세션 연속 재현(누적 결손: consistency 2/5·3/5·1/5, ai-review 3/7·3/6·**5/9**)했고, 이번엔 **결손 reviewer 가 유일한 실질 버그를 들고 있었다**. summary agent 는 확보분만으로 `RISK LOW · WARNING 2` 를 냈고 그대로 믿었다면 위젯이 무기한 멈추는 버그가 머지됐을 것이다. **`status=success` 를 신뢰하지 말고 반드시 `ls` 로 대조 → 누락 시 journal 복구 → 그 다음에 판정** 순서를 지킬 것.
