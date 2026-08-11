# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `seedWaitingFromStatus` 의 401 복구 로직이 신규 catch 내부 try/catch 를 추가하며 함수 전체의 중첩 깊이·분기 수가 늘었다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:499-522` (함수 전체는 431-532)
  - 상세: 기존에도 `seedWaitingFromStatus` 는 `try { ... } catch (err) { ... }` 안에 `isStale`/terminal/`waiting_for_input` 분기를 갖고 있었는데, 이번 diff 로 catch 블록 안에 `if (err.status === 401) { try { ... } catch { ... } }` 가 추가되면서 중첩이 3단계(함수→catch→if→try/catch)로 깊어졌다. 이 함수 하나가 처리하는 결과 갈래도 `stale`(3곳에서 개별 검사) · `ended`(404) · `continue`(401 성공) · `stale`/`ended`(401 재실패) · `continue`(그 외 soft-fail) 로 늘어 순환복잡도가 눈에 띄게 상승했다(분기점 약 9~10개). 다만 각 분기에 근거를 남긴 JSDoc/인라인 주석이 매우 상세해 실제 "읽고 무엇을 하는 함수인지 파악하기 어려움" 정도는 완화돼 있다.
  - 제안: `err.status === 401` 처리(499-522)를 별도의 module-level 비동기 헬퍼(예: `recoverFromExpiredToken(client, session, gen, { isStale, configRef, sessionRef, finalizeEnded }): Promise<SeedOutcome>`)로 추출해 `seedWaitingFromStatus` 의 catch 블록에서는 `if (err.status === 401) return recoverFromExpiredToken(...)` 한 줄만 남기는 것을 고려. React 훅이 아니어도 되므로(순수 refs/콜백만 전달) 컴포넌트 바깥 함수로 뺄 수 있고, 각 함수가 "getStatus 실패 분류" 와 "401 복구 시퀀스"라는 단일 책임만 갖게 된다.

- **[WARNING]** (요청 판정) `use-token-refresh.ts` 와 `use-widget.ts` 의 "새 토큰을 세션에 반영 + 영속화" 최소 단위가 글자 그대로 중복됐다 — 상위 오케스트레이션은 합치면 안 되지만 이 4줄은 추출 대상
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:510-512` (`const updated = { ...session, token, expiresAt }; sessionRef.current = updated; saveSession(cfg.triggerEndpointPath, updated);`) vs `codebase/channel-web-chat/src/widget/use-token-refresh.ts:93-95` (`const updated = { ...currentSession, token, expiresAt }; sessionRef.current = updated; saveSession(currentCfg.triggerEndpointPath, updated);`)
  - 상세: 두 파일을 대조한 결과, **트리거 축과 오케스트레이션 구조는 실제로 다르다** — `use-token-refresh.ts` 는 `setTimeout` 기반으로 사전에 스케줄링되고 성공 시 `scheduleRefresh()` 재귀 재예약까지 수행하는 fire-and-forget 콜백이고, `use-widget.ts` 의 401 분기는 `getStatus` 실패의 `catch` 안에서 `await` 로 순차 진행되며 실패 시 `finalizeEnded`(세션 종료 확정)라는 별개의 상태 전이로 이어진다. 이 두 오케스트레이션(재귀 타이머 스케줄링 vs 1회성 복구-후-확정)을 억지로 하나의 함수로 합치면 실패 시 동작(로그만 vs 세션 종료)을 옵션 파라미터로 분기해야 해 오히려 결합도만 늘어난다 — 이 부분은 분리를 유지하는 것이 맞다.
    다만 "새 토큰을 세션 객체에 반영하고 storage 에 저장한다"는 **순수 로직 4줄**은 두 곳에서 완전히 같은 shape(`{...session, token, expiresAt}` 스프레드 → `sessionRef.current` 대입 → `saveSession(triggerEndpointPath, updated)`)로 존재한다. `PersistedSession` 필드가 늘거나 `saveSession` 시그니처가 바뀌면 두 곳을 각각 손대야 하는데, 실제로 한쪽만 갱신되고 다른 쪽이 stale 상태로 남을 위험이 있다(이 저장소가 "자매 함수 미적용" 류 결함을 반복 겪은 이력과 같은 형태 — CLAUDE.md/memory 의 "방어 정의를 한 칸 좁게 잡는다" 교훈과 동일 패턴).
  - 제안: 오케스트레이션은 지금처럼 분리 유지하되, "토큰 반영+영속화" 4줄만 작은 순수 함수(예: `use-token-refresh.ts` 에서 `export function applyRefreshedSession(session: PersistedSession, triggerEndpointPath: string, fresh: { token: string; expiresAt: string }): PersistedSession`)로 뽑아 두 호출부(`use-widget.ts` 501-512, `use-token-refresh.ts` 87-96)가 재사용하도록 하는 것을 권장. 강제성은 낮음(현재 중복 규모가 4~5줄로 작아 즉시 리스크는 제한적) — 다음 이 로직을 다시 손볼 때 반영해도 무방한 WARNING.

- **[WARNING]** 신규 테스트 4건(404 / 401-성공 / 401-재실패 / 500)의 `fetchMock` 클로저가 서로 거의 동일한 구조를 반복한다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:259-267`(404), `:286-302`(401 성공), `:323-335`(401 재실패), `:357-364`(500)
  - 상세: 네 케이스 모두 "`embed-config` 는 reject" + "`GET .../executions/e1` 상태 조회에 대해 특정 status 반환" + "그 외 URL 은 reject" 패턴을 반복한다. 특히 404 케이스(259-267)와 500 케이스(357-364)는 `status` 값 하나만 다르고 나머지는 완전히 동일하며, 401-성공(286-302)과 401-재실패(323-335)도 `refresh-token` 응답의 `ok/status/body` 만 다르고 나머지는 동일하다. 파일 전체에는 시나리오별로 서로 다른 fetch 동작을 인라인으로 정의하는 기존 컨벤션이 이미 있어(예: `installFetch`/`installControllableSse` 로 추출된 공통 케이스 외에는 각 테스트가 개별 `vi.fn` 을 씀) 이 자체가 스타일 위반은 아니지만, 이번 4건은 서로 인접·병렬 구조라 파라미터화 이득이 특히 크다.
  - 제안: `installReloadStatusFetch({ statusCode, refreshResponse? })` 형태의 작은 팩토리를 이 describe 블록 안(또는 파일 상단 helper 영역)에 추가해 4건의 본문을 각각 몇 줄로 줄이는 것을 고려. 필수는 아니며(테스트 각각이 자기완결적으로 읽히는 것도 장점), 향후 §3.1-2/§R4 분기가 하나 더 늘어날 때(예: 410) 다섯 번째 복제를 막는 효과가 있다.

- **[INFO]** `use-token-refresh.ts` 는 staleness 검사를 `isStale` 헬퍼 대신 원시 비교로 인라인한다 — 이번 diff 로 두 파일의 스타일 격차가 더 뚜렷해짐
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts:92` (`if (worldGenRef.current !== gen) return;`) vs 이번 diff 로 늘어난 `use-widget.ts` 의 `isStale(gen)` 호출 4곳(448, 484, 507, 517)
  - 상세: `use-session-generations.ts` 의 `isStale` JSDoc 은 "`isStale(gen)` 을 손으로 복제하는 대신 이름을 붙였다 — 이 관용구를 빠뜨리는 것이 반복 결함의 형태였다" 고 명시적으로 근거를 남기고 있는데, `use-token-refresh.ts` 는 정확히 그 원시 비교(`worldGenRef.current !== gen`)를 여전히 손으로 복제해 쓰고 있다. 이 diff 가 건드린 파일은 아니므로(사전에 존재하던 코드) 이번 리뷰의 필수 수정 대상은 아니지만, `use-widget.ts` 쪽이 `isStale` 재사용을 4회로 늘린 지금 두 형제 파일의 표기 불일치가 더 도드라진다.
  - 제안: 우선순위는 낮음. 다음에 `use-token-refresh.ts` 를 손볼 일이 있으면 `worldGenRef.current !== gen` → `isStale(gen)`(단, `isStale` 을 훅에 주입해야 함)로 맞추는 것을 함께 검토.

- **[INFO]** `err instanceof EiaError && err.status === N` 타입가드가 404/401 두 분기에서 동일한 접두 조건으로 반복된다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:489`, `:499`
  - 상세: 사소하지만 `if (err instanceof EiaError) { switch (err.status) { case 404: ...; case 401: ...; } }` 형태로 좁히면 `instanceof` 중복 검사를 한 번으로 줄이고 "이 catch 블록은 EiaError 의 status 로 분기한다"는 의도가 더 명시적으로 드러난다.
  - 제안: 강제 사항 아님 — 가독성에 미치는 영향이 작아 우선순위 낮음.

## 요약

이번 diff 는 `3-auth-session.md §3.1-2/§R4` 가 문서로만 정해두고 오래 미구현이던 재로드 404/401 REST 분기 3종을 구현하고, 각 분기(404 종료·401 낙관적 refresh 성공·401 재실패)를 개별 테스트로 분리해 회귀를 고정한 변경이다. 기존 코드베이스의 강한 문서화 관행(각 분기의 "왜"를 스펙·과거 사고 이력과 함께 남기는 것)을 그대로 따르고 있어 의도 파악은 어렵지 않으나, `seedWaitingFromStatus` 의 catch 블록에 중첩 try/catch 가 추가되며 이 함수 하나의 분기 수·중첩 깊이가 상당히 늘었고, 요청받은 판정대로 `use-token-refresh.ts` 와의 "토큰 반영+영속화" 로직이 4~5줄 규모로 리터럴 중복됐다(트리거 축이 달라 전체를 합치는 것은 부적절하지만 이 최소 단위만은 추출 여지가 있음). 테스트 파일도 신규 4건의 `fetchMock` 클로저가 서로 매우 유사해 파라미터화 여지가 있다. CRITICAL 급 결함은 없으며, 지적 사항은 모두 "지금 당장 막을 정도는 아니지만 다음에 이 영역을 손볼 때 반영하면 좋을" 수준의 구조적 제안이다.

## 위험도

LOW
