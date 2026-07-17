# 테스트(Testing) Review

## 검토 범위 확인

이번 diff 의 실제 실행 코드 변경은 3개 파일이다.

1. `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts` — `webauthnList` nullable 필드(`deviceName`/`lastUsedAt`) 매핑 테스트 1건 추가.
2. `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 세션 복원(`applyConfig`) 경로가 이미 terminal 인 execution 을 복원할 때의 회귀 테스트 1건 추가.
3. `codebase/channel-web-chat/src/widget/use-widget.ts` — `seedWaitingFromStatus` 의 반환 계약을 `Promise<boolean>` 으로 바꾸고 `finalizeEnded` 헬퍼로 종료 처리를 통합, 3개 호출부(`start`/`applyConfig`/`replay_unavailable` 폴백)를 그 반환값으로 게이팅.

나머지 파일(`plan/in-progress/...`, `review/code/2026/07/17/02_04_13/**`)은 이전 라운드(`02_04_13`)의 계획 갱신·리뷰 산출물 기록이며 테스트 가능한 코드가 아니다 — 테스트 관점 지적 사항 없음(NONE).

`git show HEAD` 로 프로덕션 코드(`use-widget.ts`)를 직접 대조해 `start()`(:371-372)·`applyConfig`(:615-618) 양쪽에 `ended` 게이팅이 실제로 커밋돼 있음을 확인했다 — 코드 자체는 RESOLUTION.md 의 주장대로 올바르다. 아래 발견사항은 "코드가 틀렸다"가 아니라 "테스트가 그 정확성을 충분히 증명하지 못한다" 는 커버리지 관점이다.

## 발견사항

- **[WARNING]** `start()` 호출부 자체의 `ended` 게이팅(신규 추가분)을 고정하는 회귀 테스트가 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:371-372`(`const ended = await seedWaitingFromStatus(client, session); if (ended) return;`) — 대응 테스트 부재, `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`
  - 상세: 이번 라운드는 `seedWaitingFromStatus` 가 teardown 부작용을 갖게 되면서 "3개 호출부(`start`/`applyConfig`/`replay_unavailable` 폴백) 모두 반환값으로 게이팅한다"(RESOLUTION.md)고 주장한다. 그런데 실제로 회귀 테스트로 고정된 것은 (a) `applyConfig` 세션 복원 경로(신규 213행 테스트, CRITICAL 재발 방지)와 (b) `replay_unavailable` 폴백이 부르는 `seedWaitingFromStatus` **함수 자체**의 terminal 판정(1242행 — 이 경로는 fire-and-forget 이라 반환값을 애초에 게이팅하지 않는다)뿐이다. `start()` 자신의 게이팅 라인(:371-372) — 즉 webhook POST 직후 최초 seed 호출이 이미 terminal 응답을 반환하는 시나리오(hook 처리와 최초 `getStatus` 조회 사이에 execution 이 이미 완료되는 극단 타이밍) — 를 exercise 하는 테스트는 스위트에 없다. `start()` 는 기존 `startGenRef` 재확인(:374)이 별도로 있어 "우연한 보호" 였다는 것이 이번 라운드의 핵심 교훈인데, 정작 신규로 추가된 `ended` 게이팅(:372) 자체를 증명하는 테스트는 빠져 있다 — 그 줄을 삭제해도 현재 30개 테스트가 전부 통과할 가능성이 높다.
  - 제안: webhook POST 응답 직후 첫 `GET .../executions/e1` 호출이 곧바로 `status: "completed"` 를 반환하는 fetchMock 을 구성해, `open()` 후 `openStream`(`getEs()`)이 호출되지 않고 `phase` 가 즉시 `"ended"` 로 전이하는지 단언하는 테스트 1건 추가.

- **[WARNING]** 신규 `applyConfig` 회귀 테스트의 `refreshCalls` 단언이 실제로는 게이팅 여부를 판별하지 못함(decorative assertion)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:247-248`(`expect(refreshCalls).toBe(0);`) — 관련 로직 `codebase/channel-web-chat/src/widget/use-token-refresh.ts:21-24`(`refreshDelayMs`)·`:62-88`(`scheduleRefresh`)
  - 상세: 테스트는 세션 `expiresAt` 을 `Date.now() + NINETY_MIN_MS`(90분)로 설정한다. `refreshDelayMs` 계산식(`expiry - now - TOKEN_REFRESH_LEAD_MS(30분)`)에 대입하면 실제 지연은 약 60분(3,600,000ms)의 real `setTimeout` 이다. 이 테스트는 (파일 내 다른 한 테스트만 쓰는) `vi.useFakeTimers()` 를 쓰지 않으므로, `if (ended) return;` 게이팅이 없어 `scheduleRefresh()` 가 실제로 호출되더라도 `refreshToken` fetch 는 60분 뒤에나 발생한다 — 테스트는 그 시점까지 기다리지 않으므로 `refreshCalls` 는 게이팅 성공/실패와 무관하게 항상 `0` 이다. 즉 이 단언은 "refresh 미호출"을 증명하지 못하는 눈속임(tautological) 단언이며, plan 문서·RESOLUTION.md 의 "SSE 미오픈 + storage 부활 없음 + refresh 미호출 **3중** 단언" 서술과 달리 실질 회귀 검출력은 `expect(getEs()).toBeNull()`(SSE 재오픈 여부) 하나에 사실상 의존한다. (RESOLUTION.md 의 mutation 검증도 "게이팅만 되돌리자 신규 복원 테스트 1건만 실패" 라고만 서술 — 어느 단언이 그 실패를 냈는지는 명시하지 않는다.)
  - 제안: `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(60*60*1000 + 여유)` 로 타이머 발화까지 진행시켜 `refreshCalls` 를 의미 있게 검증하거나, `scheduleRefresh`(또는 `client.refreshToken`)를 spy 로 감싸 "호출 자체가 없었음"을 직접 단언하는 방식으로 교체.

- **[WARNING]** W2(staleness 가드)·W3(`endedRef` 중복 방지)에 대한 전용 회귀 테스트가 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:277`(`if (sessionRef.current !== session) return false;` — W2 staleness 가드), `:180-190`(`finalizeEnded` 의 `endedRef` 1회 가드 — W3 중복 방지) — 대응 테스트 부재
  - 상세: RESOLUTION.md 는 이번 라운드에서 W2(fire-and-forget `getStatus` 응답이 지연되는 동안 세션이 교체되면 유령 WAITING 또는 살아있는 새 대화를 오탐 종료 통지)와 W3(SSE terminal 이벤트와 REST 폴백 terminal 이 같은 종료에 대해 각각 발화해 host `conversationEnded` 가 중복 발송)를 concurrency 결함으로 인정하고 코드로 고쳤다고 밝히지만, "각 fix 를 일부러 무력화해 해당 테스트만 실패함을 확인"이라는 mutation 검증 서술은 본문 표(C1 행)에만 구체적으로 등장하고 W2·W3 행에는 그 검증 절차가 명시돼 있지 않다. 실제로 스위트 전체(`grep`)를 훑어도 (a) `getStatus` 응답을 pending 상태로 잡아둔 채 세션을 교체하는 레이스 시나리오, (b) SSE terminal 과 REST 폴백 terminal 이 겹치는 타이밍을 구성해 `conversationEnded` 발송 횟수를 단언하는 테스트는 없다. 두 가드 모두 되돌려도 현재 30개 테스트가 실패하지 않을 가능성이 있다 — CRITICAL 이 테스트 갭 때문에 놓쳤던 것과 동일한 구조적 위험이 W2·W3 에도 남아 있다.
  - 제안: (a) W2 — `getStatus` 를 `new Promise` 로 pending 상태로 잡아둔 채 `newChat()`(또는 `endConversation()`)을 먼저 호출한 뒤 resolve 시켜, stale 응답이 교체된 세션에 `dispatch`/`teardownSession` 을 적용하지 않음을 단언. (b) W3 — SSE `TERMINAL_EVENTS` 이벤트와 `getStatus` terminal 응답이 근접 타이밍에 함께 도착하는 케이스를 구성해, `bridge.sendEvent`(또는 관측 가능한 `conversationEnded` 카운트)가 1회로 제한됨을 단언. 둘 다 CRITICAL 과 동일한 근본 메커니즘(반환값 게이팅 부재)이라 저비용·고회귀검출력.

- **[INFO]** (긍정 확인) webauthn nullable 필드 테스트 — 격리·가독성 양호
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts:103-130`
  - 상세: `beforeEach` 의 `jest.clearAllMocks()`(및 `TRUST_CF_CONNECTING_IP` env 정리)로 독립 실행이 보장된다. `deviceName`/`lastUsedAt` 를 `null` 로, `transports` 를 빈 배열로 동시에 설정해 `mapCredential`(`webauthn.controller.ts:377-391`)의 nullable 분기와 `lastUsedAt ? toISOString() : null` 삼항의 `null` 분기(가장 놓치기 쉬운 회귀 — `null.toISOString()` 크래시나 `undefined` 유출)를 저비용으로 고정한다. `toEqual` 로 응답 shape 전체를 pin 하는 방식도 같은 파일의 기존 케이스와 일관적이다. 별도 조치 불요.

- **[NONE]** applyConfig 종료 회귀 테스트의 핵심 단언(SSE 미오픈·storage 미부활)은 유효
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:213-249`
  - 상세: `expect(getEs()).toBeNull()`(SSE 재오픈 안 됨)과 `expect(window.sessionStorage.getItem(...)).toBeNull()`(storage 부활 없음) 두 단언은 `applyConfig` 의 `if (ended) return;` 게이팅을 제거하면 실제로 깨지는 유효한 회귀 고정이다(`openStream` 이 실행되면 `ControllableEventSource` 가 생성되고, `openStream`/`saveSession` 경로가 storage 를 재기록하기 때문). `refreshCalls` 부분의 한계는 위 WARNING 참고.

- **[NONE]** `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `review/code/2026/07/17/02_04_13/**`(RESOLUTION.md·SUMMARY.md·`_retry_state.json`·`meta.json`·각 reviewer `.md`)
  - 상세: 테스트 가능한 실행 코드가 아닌 계획/리뷰 산출물 기록. CLAUDE.md 컨벤션(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)에 부합하는 정상 보관이며 테스트 관점 지적 사항 없음.

## 요약

프로덕션 코드(`use-widget.ts`)는 `git show HEAD` 로 직접 대조한 결과 `start()`(:371-372)와 `applyConfig`(:615-618) 양쪽에 `seedWaitingFromStatus` 의 `Promise<boolean>` 반환값 게이팅이 실제로 존재해 RESOLUTION.md 의 CRITICAL fix 주장은 정확하다. 다만 테스트 커버리지는 이번 라운드가 실제로 검증한 것보다 좁다 — (1) `start()` 자신의 신규 게이팅 라인은 어떤 테스트도 exercise 하지 않고, (2) 신규 `applyConfig` 회귀 테스트의 3개 단언 중 `refreshCalls` 는 60분 real-timer 지연 때문에 게이팅 여부와 무관하게 항상 0이 되는 decorative 단언이며, (3) 같은 라운드에서 인정한 W2(staleness 가드)·W3(`endedRef` 중복 방지) 두 concurrency fix 는 전용 회귀 테스트 없이 코드만 존재한다. 세 가지 모두 "코드는 맞지만 테스트가 그 정확성을 강제하지 못하는" 동일한 패턴이며, 정확히 이 영역(`seedWaitingFromStatus` 호출부별 게이팅)에서 이미 한 차례 CRITICAL 이 테스트 갭 때문에 통과했던 전례(RESOLUTION I2)를 감안하면 재발 방지 차원에서 우선순위 있게 메워야 한다. webauthn 쪽 nullable 필드 테스트는 격리·가독성·회귀 검출력 모두 양호해 긍정적으로 확인했다.

## 위험도

MEDIUM
