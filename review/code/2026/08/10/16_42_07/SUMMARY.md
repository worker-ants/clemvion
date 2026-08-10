# Code Review 통합 보고서 — 재로드 REST 오류 분기 (3라운드)

- 대상: `claude/webchat-reload-rest-branches` · diff-base `origin/main` · `--route=all`
- forced **7명 전원** (`_retry_state.json` 확인 후 디스패치).

## BLOCK: NO

**Critical 1 · WARNING 5** — 전부 반영 (`RESOLUTION.md`).

## 전체 위험도

**LOW** (반영 후).

## Critical

| # | reviewer | 발견사항 | 조치 |
|---|---|---|---|
| 1 | **side_effect** | **non-terminal refresh 실패가 `"continue"` 를 돌려줘 호출부가 죽은 토큰으로 새 SSE 를 연다** — 이 PR 이 고치려던 "streaming 고착" 의 재현. **내가 security INFO 로 받아 plan 에 등재만 하고 넘긴 항목**이었다 | **반영** — `"stale"` 반환(세션 보존 + 호출부 정지). 뮤테이션 RED 2건 |

## 경고

| # | reviewer | 발견사항 | 조치 |
|---|---|---|---|
| 2 | testing | **상태-필터 축(`401`/`410` 인가)을 아무 테스트도 안 겨냥** — `terminal = instanceof EiaError` 뮤턴트가 초록 | **반영** — `500` 케이스 추가. **그것도 처음엔 vacuous 했다**(아래) |
| 3 | maintainability | **내 추출이 JSDoc 을 선언에서 71줄 떼어 놨다** — 그 사이 다른 함수가 끼어 `@param` 이 오독된다 | **반영** — 선언 바로 위로 복원 |
| 4 | requirement | `410` 분기가 뮤테이션 사각지대(백엔드까지 추적해 도달 가능 확인) | **반영** — 회귀 추가, 뮤테이션 RED |
| 5 | requirement | **SPEC-DRIFT** — `3-auth-session.md` §3.1-2("재차 `401`")가 §R4("`401`/`410`")보다 좁다. 코드가 옳고 spec 이 낡음 | **반영** — §R4 에 맞춰 넓힘 |
| 6 | documentation · security | 종료 조건 서술이 **문서 7자리**에서 `401` 만 말함 | **반영** — 패턴 검색으로 전수, 종료-조건 5자리와 최초-401 7자리를 갈라 처리 |

## 0/0 을 낸 reviewer

| reviewer | 비고 |
|---|---|
| security | NONE — `EiaError` throw 경로 대조, 토큰 로그 노출 없음 확인, 신규 회귀를 **직접 실행** |
| scope | NONE — 실 코드 7파일이 전부 이번 기능/이전 지적에 1:1 대응 |

## 이 라운드가 드러낸 것 — 내 판정이 두 번 틀렸다

**① INFO 로 받은 것이 CRITICAL 이었다.** security 가 "비-terminal 실패 뒤 만료 토큰 재연결"
을 INFO 로 냈고 나는 "이번 변경이 만든 것은 아니다" 로 판단해 plan 등재만 했다. side_effect
가 CRITICAL 로 재판정했고 맞다 — **반환값이 틀렸지 분기 조건이 틀린 게 아니었다.**

**② 내 새 테스트가 vacuous 했다.** 상태-필터 축을 덮으려 `500` 케이스를 추가했는데 그것도
뮤턴트를 놓쳤다. `waitFor(storage != null)` 이 **boot 전에 이미 참**이라 t=0 에 통과했다 —
"기다린다" 고 쓴 것이 아무것도 안 기다렸다. `refresh 가 불렸는가` 로 바꾸자 잡혔다.

## 검증

- 위젯 23파일 **417 passed** · `tsc --noEmit` **0 errors** · 문서 가드 **2876 passed**
- 뮤테이션 누적 **12종** — 이번 라운드: `"stale"`→`"continue"`(RED 2) · 상태 필터 제거(RED) ·
  `|| 410` 제거(RED)
