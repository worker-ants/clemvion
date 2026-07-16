# RESOLUTION — ai-review 2026-07-17 06_53_03 (4라운드)

> 대상: `9dd47e6c9..HEAD` (3라운드 fix 커밋 `4dad5993c`)
> 결과: **RISK CRITICAL / Critical 1 / Warning 7 / INFO 9** → **CRITICAL + WARNING 6건 fix**, W6 1건 이월.

## CRITICAL — 또 내 fix 가 만든 회귀 (3연속)

`sendCommand` 의 410 catch 를 `finalizeEnded` 로 편입(3라운드 W1)하면서 **staleness 재검증을 빠뜨렸다**. 그 결과 세션 교체 후 도착한 **옛 세션의 410 이 살아있는 새 세션을 오종료**시킨다 — host 는 잘못된 `conversationEnded` 를 받고, 새 세션의 storage·SSE·refresh timer 가 정리된다.

**아이러니**: 같은 3라운드에서 `seedWaitingFromStatus` 에는 정확히 이 가드(`sessionRef.current !== session`)를 넣었다. **대칭 경로를 놓친 것** — CRITICAL#1(2라운드, `applyConfig` 비대칭)과 **정확히 같은 실패 유형**이다. requirement reviewer 가 재현 테스트로 실측 확인.

→ **fix**: 410 catch 진입부에 `if (sessionRef.current !== session) return;`. 회귀 테스트 추가 후 **가드 무력화 시 그 테스트만 실패함을 확인**.

## 처리 결과

| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| **C1** | requirement / concurrency | cross-session stale 410 오종료(위) | **fix** — staleness 가드 + 회귀 테스트(mutation 검증) |
| W1 | documentation / requirement | `finalizeEnded` JSDoc 이 "두 진입점" 이라 서술하나 실제 **네 곳**(SSE terminal / REST 폴백 / 410 / 사용자 종료) | **fix** — 네 진입점으로 갱신 |
| W2 | side_effect | `endConversation()` 의 `resetSessionRefs(); finalizeEnded();` 순서가 `endedRef` 가드를 **리셋 직후 재무장**시켜 사실상 무력화 — W1(3R)이 고친 것과 같은 클래스의 중복 통지가 좁은 race 로 재발 가능 | **fix** — 최상단에 `if (endedRef.current \|\| state.phase === "ended") return;`. **`endedRef` 를 먼저 본다** — `state.phase` 는 React 배치로 커밋이 지연될 수 있어 ref 가 더 즉각적 |
| W3 | side_effect / concurrency | `sendCommand` useCallback deps 에 `finalizeEnded` 누락(eslint 경고 실측) — 같은 diff 가 `endConversation` 에는 정확히 추가해 비일관 | **fix** — `[finalizeEnded]` 추가. C1 fix 와 동시 처리 |
| W4 | side_effect / testing | 신규 테스트 2건이 `try/finally` 없이 cleanup 을 마지막 줄에만 배치 → assert 실패 시 fake timer·spy 가 다음 테스트로 누수 | **fix** — 개별 `try/finally` 대신 **전역 `afterEach` 에 안전망**(`vi.useRealTimers()` + `vi.restoreAllMocks()`). 향후 테스트까지 자동 보호되므로 더 견고 |
| W5 | testing | `applyConfig` 고유 `"stale"` 게이팅 미커버 — **stale 분기만 빼도 33개 통과**(실측). 원래 고치려던 concurrency 결함의 위치라 유의미 | **fix** — 전용 테스트 추가(복원 seed in-flight 중 새 대화 → stale 응답이 새 스트림을 덮지 않음). **stale 분기만 무력화 시 그 테스트만 실패 확인** |
| W6 | concurrency | `applyConfig`/`start()` 가 마지막 await 후 unmount 재검사 없어 SSE leak 가능 | **이월** — reviewer 도 "**이번 diff 범위 밖의 잔존 gap, 신규 회귀 아님**" 으로 명시. `useEiaStream` 분리(INFO#3) 시 함께 다룰 사안 |
| W7 | documentation | 위젯 수정 체인 4커밋에 CHANGELOG 항목 없음 — **실사용자 관측 가능 동작 변경**(무기한 멈춤 방지·종료 중복 통지 방지)인데 미기록 | **fix** — Unreleased 에 항목 추가(기존 문서 관례 준수: 배경 → 번호 목록 → SoT) |
| maintainability W | maintainability | 테스트가 `TOKEN_REFRESH_LEAD_MS`(export 된 명명 상수)를 재사용하지 않고 `30 * 60 * 1000` 로 재하드코딩 | **fix** — 상수 import 재사용 |
| INFO#3 | requirement | 3R RESOLUTION 의 "widget 전체 127 passed" 가 실측 130 과 불일치 | **정정** — 카운트 오차. 본 라운드 실측은 아래 §검증 |
| INFO#4 | documentation | `seedWaitingFromStatus` JSDoc "호출 시점"(두 경로)이 `handleEiaEvent` 폴백 누락 | **fix** — 세 번째 경로(fire-and-forget) 추가 |
| INFO#1·5·6·8·9 | 보안·동시성·부작용·문서 | console.warn 서버 원문(기존 패턴) / `sessionRef` null화 미통합 / `teardownSession` 2회 중복(멱등) / 인용 포맷 혼재 / `SeedOutcome` 긍정 확인 | **이월·조치 불요** — reviewer 판정대로 기존 패턴이거나 무해. INFO#5·6 은 `finalizeEnded` 가 `sessionRef` 를 null 화하도록 통합하면 함께 해소되나, **종료 후 명령이 캐시 없이 즉시 return 되면 phase 전이 순서가 바뀌어** 회귀 표면이 커진다 — 별건 |
| INFO#7 | requirement | W6 fake-timer 테스트 1회 flaky 관찰(8회 재실행 미재현, 리소스 경합 추정) | **관찰** — 본 라운드 전체 e2e 포함 재현 없음 |

## 검증

- **TEST WORKFLOW**: lint **PASS** / unit **PASS**(5스택) / build **PASS** / e2e **PASS (256)**. tsc clean, eslint `exhaustive-deps` 경고 해소 확인.
- **mutation 검증** — 이번 라운드 신규 2건 모두 검출력 확인:

  | 가드 | 무력화 시 |
  |---|---|
  | **C1** `sendCommand` staleness | **1 fail** ✅ |
  | **W5** `applyConfig` stale 분기 | **1 fail** ✅ |

- `use-widget-eager-start.test.ts` **35 passed**(33→35).

## 누적 관찰 — 같은 실패 유형이 3번 반복됐다

| 라운드 | 내 fix | 그 fix 가 만든 CRITICAL |
|---|---|---|
| 1R | terminal 분기를 `seedWaitingFromStatus` 안에 추가 | `applyConfig` 가 teardown 을 모른 채 openStream (**비대칭 호출부**) |
| 2R | 3-state 계약 + 410 을 `finalizeEnded` 로 편입 | stale 410 이 새 세션 오종료 (**비대칭 가드**) |
| 3R | staleness 가드를 `sendCommand` 에도 | — (본 라운드에서 확인 필요) |

**공통 원인**: 이 훅은 `sessionRef`/`startGenRef`/`endedRef` 3개 ref 와 4개 비동기 진입점이 얽혀 있는데, 각 fix 가 **한 경로만 보고** 대칭 경로를 놓쳤다. 매번 reviewer 가 나머지를 찾아줬다. `useEiaStream` 분리(INFO#3)로 종료·staleness 판정을 **단일 진입점에 강제**하지 않으면 이 패턴은 반복될 가능성이 높다 — 별건 plan 으로 다뤄야 할 구조 문제다.

**⑨-4 분류 오류**: "사용자 결정 없이 바로 처리 가능" 으로 분류했으나 4라운드에 걸쳐 **CRITICAL 2건 + WARNING 17건**이 나왔다. spec 이 동작을 확정해 뒀다(= 제품 결정 불요)는 판단은 맞았지만 **구현 리스크**를 완전히 잘못 읽었다.
