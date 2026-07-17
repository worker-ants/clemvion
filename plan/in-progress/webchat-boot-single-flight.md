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
- [x] **A-6. `RESTORED`/`BOOTED` 가드 확대 트리거 재점검** (plan-coherence W2) — 이 이월은 **어느 plan 에도 없어 유실 위험**이다(review chain 이 `15_26_11` 에서 종결 선언하며 최종 이월 목록에서 뺐다). 트리거는 "실패 사례 확인 시" 인데, **A 가 겹침 자체를 없애 그 판단 기준이 달라질 수 있다**. A 구현 후 재점검하고 **채택하든 안 하든 결론을 이 plan 에 기록**해 산문에만 남지 않게 한다.
- [x] **B-1. (A 완료 후 재평가)** 동기 구간 비-async 추출 — **재평가 결과 값어치 있음**(A 도입 후에도 await 삽입 시 379건 전부 통과 = 여전히 무방비). 추출 후 `error TS1308` 로 **컴파일 차단** 확인.
- [x] **spec `code:` frontmatter 확인** — `2-sdk.md` 가 이 동작의 구현 파일을 가리키는지. 갱신 필요 시 포함.

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
- 곁들여 `applyConfig` 는 `gen`(world 단독)을 스코프에 두지 않아 거기서 `isStale(gen)` 은 컴파일되지 않는다. **단 이건 좁은 보호다** — 리뷰어가 `tsc --strict` 로 실측했듯 `isStale(attempt.world)`·`isStale(worldGenRef.current)` 는 통과한다(후자는 자기 자신과 비교해 **항상 false 인 무력 가드**). "A 도 B 급 구조적 강제" 라는 내 초기 프레이밍은 과했다 — **A 의 진짜 방어선은 §A-5 의 비대칭 mutation 테스트**이고, 스코프 차단은 가장 흔한 실수(관용구 복사)만 막는 보조다. (`17_36_57` maintainability)
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


## 진행 기록 — A-6 완료: **트리거 충족, 가드 확대** (2026-07-17)

`RESTORED`/`BOOTED` 로의 `ended` 가드 확대는 `08_29_33` W4 에서 **"실패 사례가 없다"** 는 이유로 보류됐다(그리고 이후 라운드마다 그 판단이 재확인됐다). plan 은 *"A 가 겹침을 없애 그 판단 기준이 달라질 수 있으니 구현 후 재점검"* 하라고 적었다 — **재점검했더니 실패 사례가 나왔다.**

**실패 사례 (재현 확인)**:

```
[1] ERROR 후 phase=ended storage잔존=true
[2] 재부팅 후 phase=streaming        ← 부활
```

- `ERROR` 는 `phase: "ended"` 로 보내면서 **세션을 정리하지 않는다** — `teardownSession` 을 거치지 않는 **유일한 종료 경로**다(다른 종료는 전부 `finalizeEnded` → `teardownSession` → `clearSession`).
- 그래서 저장 세션이 남고, host 가 `wc:boot` 을 재전송하면(§106 — 외형 갱신 등, 관리자 미리보기가 실제로 그렇게 한다) `applyConfig` 복원 분기가 그 세션을 `RESTORED` 로 되살려 **ended → streaming** 으로 부활시킨다.
- 사용자에겐 **실패해 끝난 대화가 이유 없이 되살아나 보인다**. `08_29_33` W4 가 `WAITING` 에 가드를 단 것과 정확히 같은 클래스(종료된 대화의 부활)이며, 다만 진입 경로가 다르다.

**조치**: `RESTORED`·`BOOTED` 에 `if (state.phase === "ended") return state;` 확대. `BOOTED` 는 `START`(→`booting`) 직후에만 오므로 오늘 도달 불가지만 **대칭으로 막았다** — 이 리듀서에 "무조건 전이" 를 남겨두는 것이 이 파일의 반복된 실패 유형이었다.

**검증**: 단위(리듀서 `it.each` 2케이스) + 통합(재현 시나리오 그대로) 회귀 테스트. mutation — `RESTORED` 가드 제거 → 2건(단위+통합) 실패 / `BOOTED` 가드 제거 → 1건 실패.

## 진행 기록 — spec `code:` 증거 (2026-07-17)

`2-sdk.md §106` 이 재전송 계약의 SoT 인데 그 `code:` 는 SDK 패키지만 가리켰다 — **§106 의 위젯 측 구현에 증거 링크가 없었다**(`1-widget-app.md` 는 `channel-web-chat/**` 를 덮지만 재전송을 서술하지 않는다). 저장소 기존 패턴(주석 달린 `code:` 항목, 예: `2-navigation/10-auth-flow.md`)대로 `host-bridge.ts`·`use-widget.ts` 를 근거 주석과 함께 추가했다.

**검증**: lint PASS(103s) · unit PASS(98s) · build PASS(150s) · channel-web-chat **382 passed**(22 파일, 신규 6건).


## 진행 기록 — ai-review `17_36_57`/`17_48_20` CRITICAL 3건 반영 (2026-07-17)

**리뷰가 내 설계에서 CRITICAL 을 찾았다.** 8인 중 concurrency·side_effect·documentation 이 각각 냈고 전부 실측 재현됐다.

### C1 (concurrency, 실측 재현) — supersede 설계 결함. **수정**

대체된 시도가 복원 seed 에서 "이미 종료된 세션" 을 발견하면 `finalizeEnded` → `teardownSession` → **world 세대 증가**가 일어난다. 그 무효화는 **정당한데**(세션이 실제로 종료됐다), `isAttemptStale` 이 두 축을 OR 로 보므로 **아직 살아있는 마지막 부팅까지 함께 stale 화**해 §106 을 깨뜨린다 — 그 부팅은 아직 어떤 세션도 건드리지 않았는데 "내 world 가 사라졌다" 로 오독하고 물러난다.

- **재현**: `CRIT:: 최종 config.plan = A (spec §106 기대 = B)` — 내가 고치려던 바로 그 위반이 다른 경로로 재발했다.
- **fix**: `seedWaitingFromStatus` 를 **부팅 시도 인지형**으로 — 대체된 시도의 seed 는 종료를 **확정하지 않는다**(`"stale"` 반환). 종료가 유실되진 않는다: 저장 세션이 남아 **살아있는 시도가 자기 복원 분기에서 같은 스냅샷을 보고 확정**한다. **확정의 주체만 바뀐다.**
- **검증**: `CRIT2:: plan=B | phase=ended` — §106 충족 + 종료 유지. 회귀 테스트 신설, mutation(supersede 검사 제거) → 그 테스트만 실패.

### C2 (side_effect·security, 실측 재현) — 리듀서 가드는 화면만 막는다. **근본 수정**

A-6 의 `RESTORED` 가드는 **디스패치만** 막고, `applyConfig` 복원 분기의 `seedWaitingFromStatus`(GET) → `openStream`(SSE) → `scheduleRefresh`(토큰 갱신)는 그대로 실행된다. 화면은 `ended` 인데 **은밀히 재연결**된다.

- **재현**: `phase=ended | getStatus 추가호출=1 | EventSource 추가생성=1`.
- **근본 원인**: `ERROR` 가 **`teardownSession` 을 거치지 않는 유일한 종료 경로**라 세션이 storage 에 남는 것 — 그게 부활의 연료였다. A-6 은 증상(화면)만 막았다.
- **fix**: `sendCommand` 의 비-410 에러 경로에서 `teardownSession()` 호출(정리만 공유하고 전이는 `ERROR` 로 — `finalizeEnded` 는 `ENDED` 를 디스패치해 **에러 메시지를 잃는다**). 리듀서 가드는 최후 방어선으로 유지.
- **검증**: 두 방어선이 **각각 독립적으로** mutation 에 잡힌다(근본 fix 제거 → 1건 / 리듀서 가드 제거 → 1건 / 둘 다 → 1건). A-6 테스트를 **부작용까지 단언**하도록 강화(`statusCalls`·`getEs()` 재확인).

### C3 (documentation, TS API 실측) — `pendingResetRef` JSDoc 유실. **수정**

`bootGenRef` 선언을 `pendingResetRef` JSDoc 과 선언 **사이**에 끼워넣어 인접성이 끊겼다 — `ts.getJSDocCommentsAndTags()` 로 재현: `pendingResetRef` **JSDoc 0개**(다른 심볼은 전부 1개). 이번 라운드가 검증을 요청한 "성공하는 부팅에 supersede 포함" 계약 문단이 통째로 IDE hover 에서 사라졌다. → `bootGenRef` 블록을 앞으로 이동, 재실측 확인(둘 다 1개).

### 그 외 반영

- `widget-state.ts` `WAITING` 주석이 **이 diff 자신이 만든 코드로 반증**됨("가드 범위는 WAITING 뿐" ← A-6 이 RESTORED/BOOTED 에 가드 추가). 정정.
- **CHANGELOG 추가** — 사용자 가시 fix(종료된 대화 부활)를 포함하는데 누락했다. 이 저장소가 반복 지적한 패턴이다.
- **내 JSDoc/plan 의 과대 주장 정정** — "타입 검사가 축 누락을 막는다" 는 좁은 보호였다(리뷰어가 `tsc --strict` 로 `isStale(attempt.world)` 통과를 실측). A 의 진짜 방어선은 §A-5 mutation 테스트다.

### 리뷰 페이로드 오염 (두 라운드 연속)

`--range origin/main..HEAD`(2-dot)를 준 탓에 **main 이 전진할 때마다 무관 파일이 diff 에 섞였다**(`17_36_57` 은 1파일, 재생성한 `17_48_20` 은 37파일 — 세션 생성 1분 전 #966 이 머지됨). scope 리뷰어가 두 번 다 잡았다. **고정 merge-base 3-dot 을 써야 한다** — 다음 라운드는 `--range $(git merge-base origin/main HEAD)..HEAD`.

**검증**: lint PASS(60s) · unit PASS(87s) · build PASS(140s) · channel-web-chat **383 passed**(22 파일).

## 진행 기록 — flicker fix (사용자 결정: "지금 고칩니다") + 설계 재편 (2026-07-17)

**재현**: 입력 대기 중 `wc:boot` 재전송 → `awaiting_user_message` → `streaming` → (seed 응답) → `awaiting_user_message`. **입력창이 사라졌다 돌아온다.** 관리자 미리보기는 외형 폼 변경마다 **디바운스 없이** 재전송하므로 키 입력마다 발생한다. 영구 정지는 아니고 flicker + 매 재전송마다 `getStatus`·SSE·토큰갱신 재실행.

### 충돌 해소 — checkpoint 1 을 boot 축 전용으로

착수 계획은 "자연스러운 fix(재부팅 시 복원 스킵)가 C1 픽스와 충돌한다"고 봤다. C1 픽스가 *"살아있는 시도가 자기 복원 분기에서 종료를 확정한다"* 에 의존하는데, 복원을 스킵하면 확정 주체가 사라지기 때문이다.

**해소**: `applyConfig` **checkpoint 1 을 boot 축 전용**(`cannotApplyConfig`)으로 바꿨다. 그러면 C1 이 **hack 없이** 해소된다 — 대체된 형제의 `finalizeEnded`(정당한 world 무효화)가 더는 살아있는 부팅을 죽이지 않는다. 그래서 `seedWaitingFromStatus` 의 "대체된 시도는 종료를 확정하지 않는다" 특례를 **되돌렸다**(불필요해졌다).

- **근거**: 아직 어떤 세션도 건드리지 않은 시도에게 "세계가 바뀌었다"는 무의미하다. world 축은 **세션을 건드리는 복원 분기**에서만 본다(`isAttemptStale`).
- 언마운트는 world 와 달리 **되돌아오지 않는 종점**이라 `unmountedRef` 로 분리해 두 predicate 모두가 본다.

### 내가 만든 6번째 거울상 — `startedRef` 스킵

flicker fix 의 스킵 판정을 `startedRef`(시작했나)로 처음 썼다가 **재현**했다:

```
STUCK:: phase=streaming | ES생성=0 (기대 1) | seed호출=1
```

`startedRef` 는 복원 **시작** 시점에 서므로, 대체된 시도가 seed 도중 물러나면(스트림을 못 연 채) 그 플래그만 남아 **살아있는 시도까지 복원을 건너뛰게** 만든다 → `streaming` 인데 연결 0개로 고착. side_effect 리뷰어가 예견한 "streaming 인데 실제 연결 없음" 과도상태를 내 fix 가 **영구화**한 것이다.

**교정**: 판정을 **`streamRef`(연결이 살아있나)** 로. "시작했나" 가 아니라 "확립됐나" 가 옳은 질문이었다.

- **양방향 고정**: `startedRef` 로 회귀 → stuck 테스트가 실패 / 스킵 제거 → flicker 테스트가 실패. 두 테스트가 그 경계를 양쪽에서 지킨다.

**검증**: lint PASS(66s) · unit PASS(128s) · build PASS(174s) · channel-web-chat **385 passed**(22 파일).

## 진행 기록 — 7번째 거울상: StrictMode dev 파괴 (2026-07-17)

**내가 낸 회귀. security 리뷰어가 잡았다.**

`unmountedRef` 를 신설하며 **마운트 시 래치 해제를 빠뜨렸다**. 이 앱은 `next.config.ts` 에서 `reactStrictMode: true` 를 켜므로 dev 는 effect 를 **mount → unmount → mount** 로 이중 호출한다 → 두 번째 마운트가 영구히 stale 로 판정돼 **위젯이 어떤 `wc:boot` 도 적용하지 못한다**.

```
STRICT:: config=null (부팅 실패!)
```

**dev 에서 위젯이 아예 뜨지 않는다.** 제거했던 `cancelledRef` 도 정확히 같은 이유로 마운트에서 `false` 로 되돌렸는데(그 코드를 내가 지웠다), 새 래치에 그 대응을 옮기지 않았다.

- **교정**: 마운트 effect 최상단 `unmountedRef.current = false;`. `unmountedRef` 는 **"이 마운트가 끝났나" 이지 "한 번이라도 끝났나" 가 아니다.**
- **회귀 테스트**: `renderHook(..., { wrapper: StrictMode })` — mutation(래치 해제 제거) → 이 테스트만 실패.
- 곁들여 scope 리뷰어 지적대로 cleanup 의 `eslint-disable-next-line` 주석을 내가 지우고 공백만 남긴 것도 복원.

**교훈**: 기존 메커니즘(`cancelledRef`)을 새것으로 **대체**할 때, 그것이 하던 일 중 **눈에 안 띄는 절반**(마운트 리셋)을 함께 옮겼는지 확인해야 한다. 제거 diff 만 보면 `= true` 만 눈에 들어오고 `= false` 는 놓친다.

**검증**: lint PASS(66s) · unit PASS(92s) · build PASS(166s) · channel-web-chat **386 passed**(22 파일).

## 이월 추가 (2026-07-17 18_39_11)

- **재전송으로 `apiBase` 가 바뀌면 옛 세션 토큰이 새 `apiBase` 로 전송될 수 있다** (security WARNING) — `session-store` 가 **발급 apiBase 를 기록하지 않아** 세션과 엔드포인트가 축 분리돼 있다. **이번 diff 가 만든 게 아니다**(재전송 시 복원하던 종전에도 `clientRef` 만 새 apiBase 로 바뀌었다). 별도 트랙 — 세션에 발급 origin 을 기록하고 불일치 시 폐기하는 설계가 필요하다.
- **`AI_MESSAGE` 의 `ended` 가드 부재** (security INFO) — `ERROR` 근본 fix 로 지배적 경로가 닫혀 잔여 위험 낮음. 실패 사례 확인 시 확대.


## 이월 추가 (18_39_11 side_effect·maintainability)

- **겹친 부팅이 스트림 확립 전 구간에서 `getStatus` 를 중복 발사** (side_effect WARNING, 실측 재현) — `sessionEstablished()` 는 "이미 연결됨" 만 감지하고 "형제가 복원 진행 중" 은 모른다. **최종 상태는 올바르게 수렴한다**(대체된 시도가 checkpoint 2 에서 bail → EventSource 1개, §106 유지). 멱등 GET 중복이고 실사용 경로(미리보기 재전송)는 대개 스트림 확립 **후**라 심각도 낮음 → 이월. 신규 테스트가 이미 `if (statusResolvers.length > 1)` 로 이 가능성을 방어적으로 다룬다.
- **`useEiaSession` 분리를 앞당길 근거** (maintainability) — `useWidget()` 이 872줄·`useCallback` 26개. plan 은 "축이 1개로 정리된 지금이 적기" 라 봤으나 A 가 축을 2개로 되돌렸다. 다만 리뷰어 지적대로 **사고 이력 자체**(이 클래스에서 거울상 7회)가 분리의 근거다.
