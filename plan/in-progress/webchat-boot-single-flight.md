---
worktree: webchat-boot-single-flight-8c92b4
started: 2026-07-17
owner: developer
---

# 웹챗 위젯 — `applyConfig` single-flight(마지막 wc:boot 적용) + 동기 구간 불변식

> 출처: PR #964(`⑨-4` replay_unavailable 소비 배선) 의 이월 2건. 근거는 `review/code/2026/07/17/{13_03_59,14_30_15,14_56_27}/RESOLUTION.md`.
> 관련 spec: [`spec/7-channel-web-chat/2-sdk.md §106`](../../spec/7-channel-web-chat/2-sdk.md) · [`1-widget-app.md §3.1`](../../spec/7-channel-web-chat/1-widget-app.md)

## Overview

`useWidget.applyConfig` 는 host 의 `wc:boot` 마다 **직렬화 없이** 새로 기동된다(`host-bridge` 가 in-flight 여부를 보지 않는다). 그래서 겹친 부팅에서 **어느 config 가 최종 적용되는지를 `embed-config` 왕복의 resolve 순서가 정한다** — spec 이 명문으로 정한 "마지막 `wc:boot` 의 config 를 적용"과 어긋난다.

**두 항목 모두 spec 변경이 아니라 spec-impl 갭이다** — §106 이 이미 동작을 확정해 뒀으므로 `project-planner` 위임 불요(developer 트랙).

## 실측 근거 (계획 수립 시 재현)

두 갭 모두 **코드 정독이 아니라 실행으로 확인**했다.

### A. spec §106 위반 — 먼저 보낸 config 가 이긴다

`profile.plan` 만 다른 두 boot 을 보내고 resolve 순서를 역전(#2 먼저, #1 나중):

```
PROBE_A:: 최종 적용 config.profile.plan = A   (spec 기대 = B)
```

마지막 `wc:boot`(B)이 아니라 **먼저 보낸 A** 가 적용됐다. `applyConfig` 가 `await isEmbedAllowed` 뒤에 무조건 `configRef.current = cfg` 를 하기 때문 — 나중에 resolve 한 쪽이 앞선 쪽을 덮는다.

### B. 동기 구간 불변식 미고정

`configRef.current = cfg` ~ `pendingResetRef` 소비 사이에 `await Promise.resolve()` 를 1개 삽입해도 **44/44 전부 통과**한다. `13_03_59` concurrency 리뷰가 "await 이 하나도 없는 단일 동기 구간"을 리셋 이행의 **안전성 근거**로 삼았는데, 그 전제가 테스트로 전혀 고정돼 있지 않다.

## ⚠ 착수 전 필독 — 이 파일의 이력

`pendingResetRef`(부팅 중 리셋 이행)는 **같은 결함 클래스에 fix 를 네 번 냈고 네 번 다 반대편 구멍이 났다**(전부 실측 재현): 유령 리셋 → 진입-시 일괄 폐기로 막자 리셋 소실 → BLOCKED 한정 폐기로 막자 혼합 순서에서 소실 → **부팅 세대(`bootGenRef`) 소유권으로 막자 "먼저 진입했지만 살아있는 시도"에서 소실**. 매번 "작고 안전하다"는 판단이 틀렸다.

**같은 파일의 별개 실패 계열도 있다 — 비대칭 staleness 가드 누락(3회)**: `applyConfig`·`start`·`seedWaitingFromStatus`·`sendCommand` 중 **한 호출부만 가드하고 다른 쪽을 빠뜨려** CRITICAL 이 났다(`02_04_13` C1 · `08_29_33` W2 · `09_36_01` W5). 본 작업의 A 는 정확히 그 호출부들에 축을 하나 더 얹으므로 **이 계열의 재발 위험이 가장 큰 변경**이다(→ A-0).

결론은 **폐기 로직을 없애는 것**이었고, 현재 계약은 이렇다:

> **접수된 리셋은 다음 성공하는 부팅이 이행한다. 소비 외에는 아무도 지우지 않는다.**

`use-widget.ts` 의 `pendingResetRef` JSDoc 이 **"폐기 로직을 다시 넣지 말 것"** 과 그 이유(원리적 불가능)를 명시하고 있다. 본 작업은 그 금지를 건드리지 않는다 — **supersede 는 폐기가 아니라 "이 시도가 config 를 적용할 자격이 있는가" 게이팅**이다. 혼동하지 말 것.

## 핵심 발견 — A 는 기존 회귀 테스트 2건의 기대값을 바꾼다

supersede probe(앵커 3개 명시 검증 후 적용)를 넣고 스위트를 돌린 결과:

```
× 겹친 부팅의 결과가 갈릴 때, 차단된 쪽이 살아있는 쪽의 리셋을 지우지 않는다
× 겹친 부팅에서 나중 진입이 차단으로 먼저 끝나도 먼저 진입한 쪽이 리셋을 이행한다
  Tests  2 failed | 42 passed (44)
```

**이건 결함이 아니라 의미 정제다.** supersede 하에서 boot#1 은 boot#2 에 대체돼 bail 하므로 **"성공하는 부팅"이 아니다** → 리셋은 소비되지 않고 **다음 성공하는 부팅까지 대기**한다. 위 계약과 정합한다.

- 두 테스트는 겹친 부팅에서 리셋이 **그 라운드 안에** 이행되기를(`hookPosts === 1`) 기대한다. supersede 후엔 `hookPosts === 0` + 플래그 대기가 맞다.
- **그러나 이 두 테스트는 내가 이 클래스를 네 번 깨뜨린 끝에 세운 방어선이다.** "구현했더니 테스트가 깨졌으니 테스트를 고친다"는 접근은 **이 파일에서 정확히 사고를 냈던 패턴**이다. 기대값 변경은 반드시 **먼저 계약 문서(JSDoc)를 갱신하고, 그 변경이 계약의 논리적 귀결임을 근거로** 수행한다.
- `13_03_59` RESOLUTION 이 예고한 대로다 — *"이 갭이 닫히면 겹침 자체가 사라져 위 계약이 더 단순해진다."*

## 설계 방향 (착수 시 확정)

### A. supersede (`bootGenRef`)

`applyConfig` 호출 1건 = 1세대. 각 시도가 진입 시 `const bootGen = ++bootGenRef.current;` 하고 **모든 `await` 뒤** `if (bootGenRef.current !== bootGen) return;`. 나중 boot 이 앞선 boot 을 대체 → 마지막 boot 의 config 가 적용된다(§106 충족).

- **`worldGenRef` 와 축이 다르다** — 부팅 시도는 세계를 바꾸지 않는다(그래서 `teardownSession` 이 부팅 중엔 세대를 안 올린다). 합치지 말 것.
- **`!cfg.apiBase` 조기 return 은 세대를 올리지 않는다** — 시도로 치지 않는다. (`13_03_59`·`12_34_03` concurrency 가 "올리면 죽은 소유자가 생겨 더 나쁜 유령-리셋이 재도입된다"고 확인한 판단.)
- 재검증 지점: `isEmbedAllowed` 뒤 **그리고** 복원 분기의 `seedWaitingFromStatus` 뒤(그 뒤에 `openStream`/`scheduleRefresh` 가 있다).
- **대안 기각**: ①큐잉 직렬화 — "마지막이 이긴다"면 중간 것들은 어차피 버려야 해 복잡도만 는다. ②`AbortController` 로 in-flight fetch 취소 — 취소해도 "누가 적용할 자격이 있나" 판정은 여전히 필요하고, `isEmbedAllowed` 는 fail-open 설계라 abort 를 허용으로 오독할 여지가 있다.

#### ⚠ A-0 선결 — `guardedAwait` 보류 근거가 소멸한다 (plan-coherence W1)

`applyConfig` 는 **이미** 두 await 지점(`isEmbedAllowed` 뒤 · `seedWaitingFromStatus` 뒤)에서 `isStale(gen)` 을 수동 재확인한다. A 를 그대로 얹으면 **같은 두 지점이 각각 두 축(worldGen · bootGen)을 수동 검사**하게 된다.

- **이건 이 함수가 실제로 3번 회귀를 낸 계열이다** — "한 호출부는 가드, 다른 호출부는 누락"(비대칭). `02_04_13` C1(복원 분기가 `start()` 의 우연한 가드를 못 받아 무효 토큰 SSE 재오픈 + storage 부활) · `08_29_33` W2 · `09_36_01` W5.
- `guardedAwait(gen, promise)` 구조화는 그 해법으로 제안됐다가 **"소비자가 하나뿐이라 blast radius 대비 실익 없음"** 으로 보류됐다(`08_29_33`·`09_36_01` §이월). **A 가 두 번째 소비자를 만드는 순간 그 보류 근거는 소멸한다.**
- **내적 비일관성**: 아래 B 는 같은 파일의 교훈("가드는 규율이지 구조가 아니다")을 근거로 **컴파일러 강제**를 택하면서, A 만 수동 규율을 확장하는 것은 앞뒤가 안 맞는다.

**따라서 A-2 착수 전에 결정한다.** 유력 후보 — 축을 호출부에서 AND 하지 말고 **토큰 하나로 캡슐화**:

```ts
const token = captureBootToken();          // { world, boot } 동시 캡처
const allowed = await isEmbedAllowed(...);
if (isBootStale(token)) return;            // 두 축을 한 번에 — 호출부는 축 수를 모른다
```

이러면 await 지점당 가드 호출은 **여전히 1개**이고, 축이 늘어도 호출부가 아니라 predicate 한 곳만 바뀐다. `start()`/`sendCommand`/`seedWaitingFromStatus` 는 world 축만 필요하므로 기존 `isStale(gen)` 유지(불필요한 곳에 축을 넣지 않는다).

### B. 동기 구간 — 테스트가 아니라 **구조**로 고정

"이 구간에 await 이 없다"는 **외부에서 테스트할 수 없다**. 이 파일의 교훈("가드는 규율이지 구조가 아니다")대로 컴파일러가 강제하게 한다:

> `configRef` 확립 ~ `pendingResetRef` 소비 구간을 **`async` 가 아닌** 별도 함수로 추출한다. 비-async 함수 안에는 `await` 을 쓸 수 없으므로 **불변식이 타입 검사로 강제**된다.

- 이름 후보: `establishConfigAndConsumeReset(cfg): "reset" | "continue"`.
- 이러면 별도 회귀 테스트가 불필요하다 — 위반이 **빌드에서 막힌다**.
- **A 착수 후 재평가**: supersede 가 들어가면 겹친 시도가 await 뒤 bail 하므로 이 구간의 동시성 노출이 줄어든다. B 가 여전히 값어치 있는지 A 완료 후 판단한다(**필요 없는 곳에 가드를 넣지 않는다** — 이 세션의 교훈).

## 실행 계획

- [x] **A-0. (선결) `guardedAwait`/토큰 캡슐화 채택 여부 결정** — 보류 근거("소비자 하나뿐")가 A 로 소멸하므로 재평가하고 **판단 근거를 A-1 과 함께 기록**. 채택 안 해도 "왜 수동 다축이 이 경우엔 낫다고 봤는지" 를 남긴다.
- [x] **A-1. 계약 문서 선행 갱신** — `pendingResetRef` JSDoc 에 "superseded 된 부팅은 '성공하는 부팅'이 아니므로 리셋을 이행하지 않는다"를 명시. `bootGenRef` JSDoc 신설(축 구분·조기 return 비-카운트 근거). **코드보다 먼저** 한다.
- [x] **A-2. supersede 구현** — A-0 결정대로.
- [x] **A-3. 기존 회귀 테스트 2건 기대값 정제** — A-1 의 계약을 근거로 `hookPosts` 기대를 조정하고, **"리셋이 소실된 게 아니라 다음 성공 부팅으로 이월됐다"**를 단언에 추가(그냥 `0` 으로 낮추지 말 것 — 소실과 구분되지 않는다). 예: 이어서 성공 boot 을 한 번 더 보내 그때 `hookPosts === 1` 이 되는지.
- [x] **A-4. §106 회귀 테스트 신설** — probe A 를 정식 테스트로: 마지막 boot 의 config 가 적용되는지 + resolve 순서 역전에도 성립하는지.
- [x] **A-5. mutation 검증** — 아래를 **전부** 돌린다:
  - supersede 제거 → A-4 만 실패하는가.
  - **비대칭 누락**(두 재검증 지점 중 **한쪽만** 가드 제거) → 잡히는가. ← 이 파일이 실제로 3번 낸 실패 계열이라 **가장 중요**. `13_03_59` 가 "네 번째 잘못된 설계 재도입을 시험하지 않았다"고 지적받은 것과 같은 종류의 공백을 만들지 말 것.
  - 네 잘못된 **폐기** 설계 재도입 시 기존 탐지력(4/3/2/5) 유지되는가 — A 가 그 방어선을 약화시키지 않아야 한다.
  - **`state.phase` flicker 재현 여부**(아래 참조) — 저비용이므로 여기 끼워 확인.
- [ ] **A-6. `RESTORED`/`BOOTED` 가드 확대 트리거 재점검** (plan-coherence W2) — 이 이월은 **어느 plan 에도 없어 유실 위험**이다(review chain 이 `15_26_11` 에서 종결 선언하며 최종 이월 목록에서 뺐다). 트리거는 "실패 사례 확인 시" 인데, **A 가 겹침 자체를 없애 그 판단 기준이 달라질 수 있다**. A 구현 후 재점검하고 **채택하든 안 하든 결론을 이 plan 에 기록**해 산문에만 남지 않게 한다.
- [x] **B-1. (A 완료 후 재평가)** 동기 구간 비-async 추출 — **재평가 결과 값어치 있음**(A 도입 후에도 await 삽입 시 379건 전부 통과 = 여전히 무방비). 추출 후 `error TS1308` 로 **컴파일 차단** 확인.
- [ ] **spec `code:` frontmatter 확인** — `2-sdk.md` 가 이 동작의 구현 파일을 가리키는지. 갱신 필요 시 포함.

## 검증 게이트

- TEST WORKFLOW(lint · unit · build) + channel-web-chat 전체 스위트.
- `/ai-review` — **`agents_forced` 전원 실행 필수**. 선별 실행은 화이트리스트 위반이며 push 가드(`_forced_coverage_missing`)가 차단한다(#964 에서 실제로 겪음).
- `/consistency-check --impl-done spec/7-channel-web-chat/` — #964 에서 이 게이트가 **ai-review 6라운드가 놓친 spec drift** 를 잡았다.

## Rationale

- **왜 지금인가**: #964 가 `pendingResetRef` 결함 클래스를 종결하며 가드를 `worldGen` 하나로 정리했다. 겹친 부팅을 다루는 구조가 정리된 **지금이 supersede 를 넣기 가장 안전한 시점**이다(`13_03_59` 이 그렇게 예고했다).
- **왜 #964 에서 안 했나**: 두 reviewer 가 "이 fix 와 독립 축이고, '이 김에 구조를 고치는' 선택이 정확히 직전 회귀를 낳았다"며 이월을 권고했고 그 판단이 옳았다.
- **가드 축이 다시 2개가 된다 (후속 작업자 주의)**: ⑨-4 가 남긴 후속 후보 노트 — *"`useEiaSession` 분리는 가드가 하나로 정리된 지금 상태에서 하는 편이 안전"* — 는 **축이 `worldGenRef` 하나**라는 전제에 기댄다. A 는 의식적으로 `bootGenRef` 를 병합하지 않고 신설하므로 그 전제를 되돌린다(결정 충돌은 아니나 사실이 바뀐다). A-0 에서 토큰 캡슐화를 채택하면 **호출부가 보는 축은 다시 1개**가 되어 그 노트의 전제가 복원된다 — 이것도 A-0 채택의 근거 중 하나다.
- **`state.phase` flicker 와의 관계**: 이월된 flicker(혼합 순서에서 일시 `blocked` → 자가복구, ⑨-4 이전부터 존재)는 **겹친 부팅 resolve 역전 상황에서만** 관찰된다. A 가 정확히 그 경합을 없애므로 **부수적으로 해소되거나 성격이 바뀔 수 있다** → A-5 에서 확인해 닫거나 최신화한다.
- **도달 가능성**: 오늘 실사용 재전송 경로는 관리자 라이브 미리보기 하나뿐이고(공개 SDK·스니펫 로더는 `shutdown()` 후 새 iframe), 그마저 `endpointPath` 변경 시 리마운트한다. 즉 **A 는 사용자 영향이 낮은 spec 정합 작업**이다 — 긴급하지 않으나, spec 이 명문으로 약속한 동작이 구현되지 않은 상태를 방치하면 `spec-impl-evidence` R-5("빈 약속 영구 누락")에 해당한다.


## 진행 기록 — A 완료 (2026-07-17)

**A-0 결정: 토큰 캡슐화 채택** (`guardedAwait` 미채택).

- `beginBootAttempt()` → `{world, boot}` 토큰, `isAttemptStale(attempt)` 이 두 축을 함께 본다. await 지점당 가드 호출은 **여전히 1개**라 "수동 다축 검증" 이 생기지 않는다.
- **더 나아가 `applyConfig` 는 `gen`(world 단독)을 스코프에 두지 않는다** → 거기서 `isStale(gen)` 은 **컴파일되지 않는다**. 축을 빠뜨린 가드를 쓰는 것이 타입 검사로 막힌다 — B 가 쓰려던 "구조로 강제" 를 A 에도 적용한 셈(plan-coherence W1 의 내적 비일관 지적 해소).
- `guardedAwait(gen, promise)` 미채택 근거: 호출부에서 "재검증 실패 시 **return**" 을 표현하려면 sentinel 이나 throw 가 필요해 제어 흐름이 복잡해진다. 지금 형태(`await` → `if (...) return;`)는 10라운드 리뷰가 이미 검증했고, 지적의 실체("수동 다축")는 토큰으로 해소된다.
- `start()`/`sendCommand`/`seedWaitingFromStatus` 는 world 축만 필요하므로 `isStale(gen)` 유지 — 필요 없는 곳에 축을 넣지 않는다.

**§106 위반 해소 확인**: resolve 순서를 역전시켜도 마지막 `wc:boot` 의 config 가 적용된다(도입 전엔 먼저 보낸 쪽이 이겼다).

**A-3 — 두 테스트가 서로 다른 이유로 바뀌었다** (probe 예측을 실측이 정정):
- "겹친 부팅의 결과가 갈릴 때…" — 12ms 만에 실패했다. 최종 단언이 아니라 **전제**(`phase === "blocked"`)가 깨진 것. supersede 하에서 **대체된 시도는 BLOCKED 조차 디스패치하지 않는다**(살아있는 시도의 결과가 화면을 정한다). 전제를 `not.toBe("blocked")` 로 뒤집었고 리셋 이행(`hookPosts === 1`)은 그대로다.
- "겹친 부팅에서 나중 진입이 차단으로 먼저…" — 여기만 의미가 바뀐다. 대체된 1차는 리셋을 이행하지 않아 `hookPosts === 0`. **`0` 으로 낮추기만 하면 소실과 구분되지 않으므로**, 이어서 성공 부팅을 한 번 더 보내 그때 `hookPosts === 1` 이 되는지를 단언해 **이월임을 명시**했다.

**A-5 mutation 매트릭스** — 계획이 요구한 비대칭 케이스가 실제로 공백을 드러냈다:

| mutation | 실패 |
| --- | --- |
| boot 축 무력화(supersede 제거) | 4 |
| 첫 지점만 제거(비대칭) | 3 |
| **둘째 지점만 제거(비대칭)** | **1** ← 신규 테스트로 닫음. **직전엔 0(무방비)이었다** |
| **world 축 무력화** | **1** ← 신규 테스트로 닫음. **기존 갭**(A/B 확인) |
| 세대 미증가(대체 불가) | 4 |
| 베이스라인 | 0 |

- **둘째 지점(복원 분기)이 무방비였다** — 계획이 "이 파일이 3번 회귀를 낸 계열"이라 지목한 바로 그 비대칭. `02_04_13` C1 과 동형(대체된 시도가 옛 세션으로 SSE 재오픈)이라 회귀 테스트를 신설했다.
- **`applyConfig` 의 world 가드는 한 번도 고정된 적이 없었다** — `origin/main` 코드로 A/B 확인(변경 전에도 제거 시 44건 전부 통과). 내 변경이 만든 게 아니지만 mutation 매트릭스가 드러냈으므로 닫았다(언마운트 중 부팅 → 사라진 컴포넌트가 세션 복원·SSE 오픈).

**검증**: lint PASS(72s) · unit PASS(96s) · build PASS(154s) · channel-web-chat **379 passed**(22 파일, 신규 3건).


## 진행 기록 — B 완료 (2026-07-17)

**B 재평가 결과: 값어치 있음.** A(supersede)가 겹친 시도를 await 뒤 bail 시키므로 이 구간의 동시성 노출이 줄어들 것으로 봤으나, **실측하니 A 도입 후에도 동기 구간에 `await` 을 넣으면 379건이 전부 통과**했다 — 여전히 무방비다. (추정으로 건너뛰지 않고 확인하길 잘했다.)

**구현**: `establishConfig(cfg): "reset" | "continue"` 로 추출 — **의도적으로 `async` 가 아니다**.

- `13_03_59` concurrency 가 안전성 근거로 삼은 "이 구간에 await 이 하나도 없다" 는 **주석으로만** 존재했다. 비-async 함수 안에는 `await` 을 쓸 수 없으므로 **추출 자체가 강제**다.
- **강제 확인**: 그 안에 `await` 을 넣으면 `error TS1308: 'await' expressions are only allowed within async functions` 로 **빌드가 막힌다**. "이 구간에 await 이 없다" 는 외부에서 테스트할 수 없는 성질인데, 타입 검사가 대신 막는다 — 이 파일의 교훈("가드는 규율이 아니라 구조")대로다.
- JSDoc 에 **"`async` 를 붙이지 말 것"** 과 그 이유를 명시했다. 비동기가 필요해지면 이 함수가 아니라 호출부에서 **시도 토큰 재검증과 함께** 다뤄야 한다.
- 별도 회귀 테스트는 추가하지 않았다 — 위반이 테스트가 아니라 **빌드에서** 막히므로 불필요하다.

**검증**: lint PASS(71s) · unit PASS(121s) · build PASS(232s) · channel-web-chat **379 passed**(무변경 — 순수 추출).
