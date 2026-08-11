# Testing Review — `sseErrorDetail` 회귀 3건 재현·전수 판정 + 후속 갭

재현은 repo 밖 scratch 사본(`/private/tmp/.../scratchpad/cwc-mutate`, `codebase/channel-web-chat/src`
+ `package.json`/`vitest.config.ts`/`vitest.setup.ts`/`tsconfig.json` 복사 + `node_modules` symlink)
에서만 수행했다. 워킹트리는 어떤 git 명령으로도 건드리지 않았다(전부 `cp`/`Write`/`vitest run`).

## (a) 신규 3건 — vacuous 여부

**결론: 셋 다 non-vacuous.** 각각을 개별적으로 죽이는 서로 다른 뮤턴트로 확인했다(같은 파일 안에서
서로를 가리는 관계가 아니다):

| 테스트 (`use-widget.test.ts`) | 죽이는 뮤턴트 | 결과 |
|---|---|---|
| `readyState` 를 담는다 | 함수 전체를 `return "error"` 로 뭉갬(오케스트레이터가 지목한 그 뮤턴트) | RED (1/11 실패) — 나머지 2건은 이 뮤턴트에 대해 통과하는 것이 정상(다른 축을 본다) |
| URL·토큰은 담지 않는다 | 출력에 `target.url` 을 이어붙임(`error (readyState=…, url=…)`) | RED — `iext_secret` 노출 검출 |
| `readyState` 가 없으면 담지 않는다 | `readyState === null` 널가드를 제거(항상 `readyState=` 를 붙임) | RED — `{type:"error"}` 케이스가 `"error (readyState=null)"` 를 받고 실패 |

세 케이스가 서로 다른 결함 축(값 추출/redaction/부재-가드)을 겨냥하므로 통합해 하나로 줄일 수 없다.

## (b) `sseErrorDetail` 의 남은 축

**미포착 축 발견 — `readyState` 키가 존재하되 값이 `undefined`인 경우.**

현재 구현(`use-widget.ts:204-211`):
```ts
const readyState =
  target && typeof target === "object" && "readyState" in target
    ? (target as { readyState: unknown }).readyState
    : null;
return readyState === null ? "error" : `error (readyState=${String(readyState)})`;
```
`"readyState" in target` (존재 여부 검사) 를 `target.readyState ?? null` (nullish-coalesce) 로 바꾸는
뮤턴트는 **`{ target: { readyState: undefined } }` 입력에서만** 관측 가능하게 달라진다(원본은
`"error (readyState=undefined)"`, 뮤턴트는 `"error"`). 이 뮤턴트를 scratch 사본에 실제로 적용해
현재 3개 테스트 스위트(11건)를 돌렸더니 **전부 GREEN** — 즉 지금 테스트는 이 축을 구분하지 못한다.
직접 대조:
- 원본: `sseErrorDetail({ target: { readyState: undefined } })` → `"error (readyState=undefined)"`
- 뮤턴트(`?? null`): 같은 입력 → `"error"`

실사용 경로(`EventSource.readyState`)는 스펙상 항상 `0|1|2` 라 이 값이 실제로 `undefined` 로 오는
경로는 없어 보이지만, `onError` 핸들러가 받는 `e` 자체가 `unknown`(테스트 더블·미래 리팩터로 형태가
바뀔 수 있음)이라는 이 함수의 방어적 설계 취지에 비추면 이 축을 놓치는 것은 사소하지 않다.

반면 `readyState` 가 **문자열**이거나 **음수**인 경우는 실측상 특별히 구분되는 분기가 없다
(`String(readyState)` 로 그대로 찍힐 뿐이라 이 축을 가르는 의미 있는 뮤턴트를 만들 수 없었다) —
오케스트레이터가 예시로 든 세 후보 중 이 둘은 실제로는 "다음 자리"가 아니라고 판단한다.

**제안**: `use-widget.test.ts` 에 `{ target: { readyState: undefined } }` → `toBe("error (readyState=undefined)")`
케이스 1건 추가(또는 `"readyState" in target` 대신 명시적으로 `undefined`/`null` 을 걸러내도록 구현을
정정). 지금 상태로는 위 `?? null` 류의 "동치처럼 보이는" 리팩터가 조용히 통과한다.

## (c) 같은 형태의 다음 자리 — `shouldAbortAfterSeed` (WARNING)

이 PR 이 새로 만든 최상위 함수 전수(`git diff origin/main...HEAD` 로 확인):

| 함수 | 위치 | 직접 단위 테스트 | 뮤테이션 결과 |
|---|---|---|---|
| `isTerminalAuthError` | `eia-client.ts:179` | 있음(`eia-client.test.ts`) | 기존 라운드에서 실측·문서화됨(duck-typing 가드 뮤턴트 429/429 GREEN → 테스트 추가로 해소) |
| `redactToken` | `eia-client.ts:199` | 있음(`eia-client.test.ts`) | — |
| `retryDelayMs` | `use-token-refresh.ts:23` | 있음(`use-token-refresh.test.ts`, 경계값·0·음수 포함) | — |
| `applyRefreshedToken` | `session-store.ts:125` | **없음**(`session-store.test.ts` 에 관련 `describe`/`it` 0건) | 병합 순서를 `{...refreshed, ...session}` 으로 뒤집는 뮤턴트(옛 토큰이 새 토큰을 덮어씀) 적용 → widget 스위트 21파일 실행해 6건 RED(`use-widget-eager-start.test.ts`). **통합 테스트가 실측으로 잡아낸다** — 진단 신뢰도는 낮지만(실패 지점이 이 함수가 아니라 훨씬 먼 SSE URL 단언) silent 결함은 아니다 |
| `sseErrorDetail` | `use-widget.ts:204` | 있음(이번 라운드 추가 3건) | 위 (a)(b) 참조 |
| `shouldAbortAfterSeed` | `use-widget.ts:137` | **없음 — export 조차 안 돼 있어 직접 테스트 자체가 불가능** | 아래 |

**`shouldAbortAfterSeed` 가 `sseErrorDetail` 과 같은 형태의 "다음 자리"다.**

```ts
function shouldAbortAfterSeed(outcome: SeedOutcome): boolean {
  return outcome !== "continue" && outcome !== "refresh_deferred";
}
```
4-way 유니온(`"ended"|"stale"|"continue"|"refresh_deferred"`)을 boolean 으로 접는 판정 함수이고,
JSDoc 자신이 "호출부 비대칭이 이 파일의 반복 CRITICAL 원인"이라 명시할 만큼 중요한 게이트인데
**module-private(비-export)이라 단위 테스트 자체가 물리적으로 불가능**하다(`sseErrorDetail` 처럼
`@internal — unit-test seam only` export 패턴을 안 썼다).

두 개의 구분되는 뮤턴트로 실측:

1. `return outcome !== "continue";` (→ `refresh_deferred` 도 abort 로 취급) — widget 스위트 21파일
   전체 실행 시 **4건 RED**(`use-widget-eager-start.test.ts`, §R4 refresh_deferred 관련 4 케이스).
   이 축은 통합 테스트가 실질적으로 방어한다.
2. `return outcome === "ended";` (→ `stale` 만 continue 로 취급, `refresh_deferred` 판정은 원본과
   동일하게 유지되도록 격리) — widget 스위트 21파일(418건) 전체 실행 **전부 GREEN**. **완전히
   조용한 생존.**

`start()` 호출부(`use-widget.ts:857` 부근)에서는 `shouldAbortAfterSeed` 직후 같은 `worldGenRef` 축의
`isStale(gen)` 재검사가 있어, 이 특정 뮤턴트가 구조적으로 가려지는 것을 코드 읽기로 확인했다(월드
세대는 단조 증가이고 `seedWaitingFromStatus` 내부의 "stale" 판정도 같은 `worldGenRef` 를 보므로,
"stale" 을 반환했다는 사실 자체가 호출부의 재검사도 함께 stale 로 만든다 — 수학적으로 동치). 그러나
`applyConfig` 복원 호출부(`use-widget.ts:1218` 부근)의 재검사는 **다른 축인 `isAttemptStale(attempt)`**
(boot-attempt 세대, JSDoc 이 스스로 "world 축과 다르다" 고 구분해 서술)이라 **같은 방식의 동치 증명이
성립하지 않는다** — 그런데도 전체 스위트가 GREEN 인 것은 (i) 실제로 동치이거나 (ii) 이 정확한 조합
(`applyConfig` 복원 경로에서 seed 가 `"stale"` 을 반환하는 시나리오)을 겨냥하는 테스트가 없어서다.
어느 쪽인지 직접 코드 정독만으로는 확정하지 못했다 — 이 자체가 "직접 회귀가 없다"는 증거다: 있었다면
이 애매함이 테스트 실행으로 즉시 해소됐을 것이다.

**제안**: `sseErrorDetail` 이 쓴 것과 같은 패턴 — `/** @internal — unit-test seam only */` 로
`shouldAbortAfterSeed` 를 export 하고, 4개 리터럴 전수(`"ended"→true`, `"stale"→true`,
`"continue"→false`, `"refresh_deferred"→false`)를 표로 단언하는 회귀 1건을 추가할 것. 그러면 위
"동치인가 우연인가" 논쟁 자체가 사라진다.

## 그 외 관측 (참고, 비차단)

- `applyRefreshedToken` 은 export 돼 있어 export 상태로는 직접 테스트가 물리적으로 가능한데도
  `session-store.test.ts` 에 관련 케이스가 0건이다. 통합 테스트가 우연히 강하게 방어하고 있지만
  (병합 순서 뒤집기 뮤턴트 RED 6건), 실패 시 진단 경로가 이 함수가 아니라 2단계 떨어진 SSE URL
  단언이라 디버깅 비용이 크다. `applyRefreshedToken({token:"a",expiresAt:"t1"}, {token:"b",expiresAt:"t2"}, "ep")`
  → `{token:"b", expiresAt:"t2", ...}` + `saveSession` 호출 여부를 직접 단언하는 3~4줄짜리 테스트를
  `session-store.test.ts` 에 추가하는 편이 훨씬 싸다. INFO 로 남긴다(회귀 자체는 이미 방어되므로).
- `eia-client.test.ts` 의 `isTerminalAuthError`/`redactToken` 신규 테스트는 이미 이전 라운드에서
  실측(전 스위트 429/429 GREEN → 가드 추가로 해소)이 코드 주석에 남아 있어 재검증하지 않았다 — 그
  주석 자체가 증거 사슬이다.

## 발견사항

- **[WARNING]** `shouldAbortAfterSeed` — module-private 라 직접 단위 테스트 불가 + `"stale"` 분기를
  `"continue"` 로 오판하는 뮤턴트가 widget 스위트 418건 전체를 GREEN 으로 통과(scratch 사본에서
  실측). `start()` 호출부는 후행 `isStale(gen)` 재검사로 구조적으로 방어되는 것을 코드로 확인했으나
  `applyConfig` 복원 호출부의 재검사(`isAttemptStale`)는 다른 축이라 같은 방식의 동치 증명이
  서지 않는다 — `sseErrorDetail` 이 겪은 것과 같은 형태(통합 테스트만으로는 특정 오판정을 구분 못함)의
  다음 자리.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:137`(정의), `:857`·`:1218`(호출부)
  - 제안: `sseErrorDetail` 과 같은 `@internal — unit-test seam only` export 패턴으로 노출하고 4-way
    진리표를 직접 단언하는 회귀 1건 추가.
- **[INFO]** `sseErrorDetail` — `readyState` 키가 존재하되 값이 `undefined` 인 축이 미검증. `"readyState" in target`
  존재-검사를 `target.readyState ?? null` 로 바꾸는(겉보기엔 동치로 보이는) 리팩터가 scratch 사본에서
  현재 3개 테스트 11건 전체를 통과했다(실측).
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:204-211`(구현), `use-widget.test.ts:59-79`(테스트)
  - 제안: `{ target: { readyState: undefined } }` → `toBe("error (readyState=undefined)")` 케이스 1건 추가.
- **[INFO]** `applyRefreshedToken` — export 돼 있어 직접 테스트가 가능한데도 `session-store.test.ts` 에
  전용 케이스가 0건. 통합 테스트(병합 순서 뒤집기 뮤턴트 RED 6건, scratch 실측)로 방어는 되지만
  진단 신뢰도가 낮다(실패 지점이 함수 자신이 아니라 원거리 SSE URL 단언).
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:125-133`(구현), `session-store.test.ts`(테스트 부재)
  - 제안: 새 토큰이 옛 토큰을 덮는지 + `saveSession` 호출 여부를 직접 단언하는 3~4줄 회귀 추가.
- **[INFO]** 오케스트레이터가 제시한 `readyState` 의 문자열/음수값 축은 실측 결과 의미 있는 분기가
  없어(구현이 단순 `String()` 스트링화만 함) 별도 테스트가 필요한 "다음 자리"는 아니라고 판단.

## 요약

오케스트레이터가 추가한 `sseErrorDetail` 회귀 3건은 scratch 사본 재현으로 개별 비-vacuous 임을
확인했다(각기 다른 뮤턴트로 개별 RED). 다만 `readyState` 키 존재+값 `undefined` 축은 여전히
미검증이며, 관련 없어 보이는 nullish-coalesce 형태 리팩터가 조용히 통과한다. 더 중요하게는, 이
PR 이 만든 다른 신규 순수 함수 전수(`git diff` 기준 7개)를 점검한 결과 `shouldAbortAfterSeed` 가
정확히 같은 결함 형태(직접 회귀 부재 + 특정 오판정이 통합 스위트를 조용히 통과)의 다음 발생지였다 —
심지어 export 조차 안 돼 있어 직접 테스트가 구조적으로 불가능한 상태다. `applyRefreshedToken` 은
통합 테스트가 사실상 방어하지만 직접 테스트가 없어 진단 비용이 크다는 더 약한 형태의 같은 문제를
갖는다.

## 위험도

WARNING
