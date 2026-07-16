# RESOLUTION — ai-review 2026-07-17 02_04_13

> 대상: `436ee334e..HEAD` (직전 리뷰 fix 커밋 `e99f46145`)
> 결과: **RISK CRITICAL / Critical 1 / Warning 3 / SPEC-DRIFT 1 / INFO 4** → **전부 fix**.
> router: 10명 실행 / 4명 제외. 이번엔 9/10 이 정상 기록됨(documentation 1건만 journal 복구).

## 왜 이 라운드가 필요했나

직전 라운드(`01_42_44`)의 fix 자체가 **새 회귀를 만들었다**. 리뷰 게이트가 재무장한 것을 "루프 비용" 으로 보고 우회했다면 이 CRITICAL 이 그대로 머지됐다 — **fix 에도 리뷰가 필요하다**는 것을 실증한 라운드.

## 처리 결과

| # | 카테고리 | 발견 | 처분 | 근거 |
|---|---|---|---|---|
| **C1** | side_effect / maintainability *(requirement 가 실측 재현)* | **`applyConfig`(세션 복원) 경로가 신규 terminal 단락에 무방비** — `seedWaitingFromStatus` 가 이제 teardown 을 수행하는데 호출부는 그 사실을 모른 채 곧바로 `openStream(saved,"0")`(**무효화된 토큰으로 SSE 재오픈**) + `scheduleRefresh()`(**refreshToken 성공 시 방금 `clearSession()` 한 storage 를 종료 세션으로 부활**). `start()` 는 `startGenRef` 재확인으로 **우연히** 보호됐고 이 경로는 대칭 가드가 없었다 | **fix** | **내 fix 가 만든 실질 회귀**다. terminal 분기를 함수 **안**에 넣으면 "세 호출부가 자동 보호" 될 거라 봤지만 정반대였다 — 함수가 side effect(teardown)를 갖게 됐는데 계약이 그것을 노출하지 않아 호출부가 알 수 없었다. → **`Promise<boolean>` 반환("이 호출이 대화를 종료시켰다")으로 계약 명시**, 세 호출부(`start`/`applyConfig`/`replay_unavailable` 폴백) 전부 그 값으로 `openStream`/`scheduleRefresh` 게이팅. reviewer 제안 그대로 |
| W1 | maintainability | terminal 처리 3줄이 `handleEiaEvent` 와 `seedWaitingFromStatus` 두 곳에 복제 — 공유 계약이 코드로 강제되지 않아 C1 같은 호출부별 불일치가 컴파일/테스트로 안 드러남 | **fix** | 근본 원인 지적이라 수용. `finalizeEnded(reason): boolean` 헬퍼로 추출해 양쪽이 호출. *(주의: 공개 액션 `endConversation()` 이 이미 존재해 이름이 가려지는 충돌이 발생 → `finalizeEnded` 로 개명. reviewer 제안 이름을 그대로 쓰면 기존 API 를 shadow 했다.)* |
| W2 | concurrency | `seedWaitingFromStatus` 에 staleness 가드 부재 — fire-and-forget 호출(폴백)이라 await 중 "새 대화"/"종료" 가 일어나면 지연 도착한 옛 응답이 **유령 WAITING** 을 그리거나 **살아있는 새 대화를 오탐 종료 통지** | **fix** | `await` 직후 `sessionRef.current !== session` 이면 폐기(ref 비교 — 클로저 stale 회피). C1 과 동일 메커니즘 공유 |
| W3 | concurrency | SSE 라이브 terminal 과 REST 폴백 terminal 이 상호배타적이지 않아 **host `conversationEnded` 중복 발사** 가능 | **fix** | `finalizeEnded` 에 `endedRef` 1회 가드 내장. 새 대화 시 `resetSessionRefs` 가 해제(다시 종료될 수 있으므로) |
| SD1 | requirement / documentation | **SPEC-DRIFT** — `1-widget-app.md §3.1` 이 "종료 신호가 아니므로 스트림·세션은 **유지**" 라고 **무조건** 서술하나, 이번 fix 가 "스냅샷이 이미 terminal 이면 종료 확정" 예외를 추가 | **fix** | reviewer 판정대로 **코드가 옳고 spec 이 못 따라온** 전형적 drift. §3.1 에 terminal 예외 명문화(gap 중 종료 시 terminal 이벤트도 유실된다는 근거 + 복원 경로에도 동일 적용 + SSE 재오픈·토큰갱신 skip 이유). `handleEiaEvent` 인라인 주석·plan 서술도 동형 갱신 |
| I1 | testing | `mapCredential` nullable 분기(`deviceName: null`, `lastUsedAt: null`) 미검증 | **fix** | 저비용·높은 검출력이라 수용. null 케이스 1건 추가(`lastUsedAt` 이 `toISOString()` 아닌 `null` 로 나오는지) |
| I2 | testing | terminal 회귀 테스트가 3개 호출부 중 `replay_unavailable` 1곳만 커버 — **C1 이 테스트로 안 드러난 직접 원인** | **fix** | 정확한 인과 분석. `applyConfig` 복원 경로 테스트 추가(SSE 미오픈 + storage 부활 없음 + refresh 미호출 3중 단언) |

## INFO (조치 불요 — 판단 기록)

| # | 카테고리 | 발견 | 판단 |
|---|---|---|---|
| I3 | scope | 커밋 메시지의 "GET 판정 관용구 통일(5곳)" 이 실제 diff 와 불일치 — 실제로 바뀐 기존 코드는 1곳(나머지는 신규 테스트가 처음부터 올바름) | **사실**. `grep -c` 결과(5)를 "변경 5곳" 으로 잘못 서술했다 — 코드는 정상이고 커밋 서술만 부정확. 소급 수정 불가라 여기 기록으로 남긴다 |
| I4 | scope | backend webauthn 이 web-chat fix 커밋에 계속 번들 | reviewer 도 "직전 라운드에서 사용자 의도로 확인된 패턴의 연장 — 위반 아님" |

## 검증

- **TEST WORKFLOW (fix 後 재수행)**: lint **PASS** / unit **PASS**(5스택) / build **PASS** / e2e **PASS (256)**. tsc clean.
- **회귀 검출력 (mutation 검증)** — **`applyConfig` 게이팅만 되돌리자 신규 복원 테스트 1건만 실패** 확인 → C1 이 회귀로 고정됐다.
- `use-widget-eager-start.test.ts` **30 passed**(29→30) / `webauthn.controller.spec.ts` **11 passed**(10→11) / widget 전체 **126 passed**.

## 교훈 — "함수 안에 넣으면 모든 호출부가 안전하다" 는 착각

C1 의 근본 원인은 **side effect 를 추가하면서 계약(반환 타입)을 그대로 둔 것**이다. `seedWaitingFromStatus` 는 이름대로 "시드" 만 하던 함수였는데 teardown 이라는 **되돌릴 수 없는 부작용**을 갖게 됐고, `Promise<void>` 라는 계약은 그것을 숨겼다. 호출부가 알아야 할 상태 변화가 생기면 **반환값으로 노출해 컴파일러가 강제**하게 해야 한다. `start()` 가 우연히 살아남은 것(`startGenRef` 가 다른 목적으로 있던 가드)이 오히려 위험 신호였다 — 우연한 보호는 대칭성이 없어 다른 호출부에서 반드시 깨진다.
