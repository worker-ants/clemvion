---
worktree: resumable-handler-generic-typing-3918dd
started: 2026-07-23
owner: developer
spec_impact: none
---

# `isConversationOutput` 이월 항목 처분 (#983 후속)

> 작성일: 2026-07-23
> 트리거: PR [#983](https://github.com/worker-ants/clemvion/pull/983) 최종 게이트 리뷰
> (`review/code/2026/07/18/15_37_24/SUMMARY.md`) 의 INFO 1·4·5·6 — "다음에 이 파일을
> 편집할 때 함께" 로 defer 된 4건.
> 선행: [#959](https://github.com/worker-ants/clemvion/pull/959) (Inv-8) ·
> [#968](https://github.com/worker-ants/clemvion/pull/968) (백로그 E, 패키지 SoT) ·
> [#983](https://github.com/worker-ants/clemvion/pull/983) (mutation 고립 테스트)

## 배경

`isConversationOutput` ([output-shape.ts](../../codebase/frontend/src/components/editor/run-results/output-shape.ts))
은 **대화 UI 전체의 게이트**다 — false 를 반환하면 실행 결과 미리보기 탭이 통째로 사라진다.
같은 계열 회귀가 3차례 났고(#959: endReason 화이트리스트에서 `error`/`condition` 누락),
#983 이 이 함수의 판정 분기 전체(OR-체인 6분기 + AND-guard 4곳)를 **서로 겹치지 않는
mutation 고립 테스트**로 고정했다. 그 고립 테스트가 본 작업의 안전망이며 훼손 금지다.

## 항목별 처분

### 1. OR-체인 → discriminated union 재설계 — **NO-GO** (2026-07-23 판정)

**결론: 진행하지 않는다.** 별건 백로그로도 열지 않는다 (재제기 시 본 절이 근거).

선행 확인 결과 이 항목은 어떤 in-progress plan 에서도 추적되고 있지 않았다 — #961 architecture
리뷰어의 지적("반복적 heuristic OR-체인 확장")은 백로그 E([is-conversation-output-restructure.md](../complete/is-conversation-output-restructure.md))
가 **화이트리스트 drift 축만** 해소했고, OR-체인 구조 축은 미착지 상태로 남아 있었다.

기각 근거 (실측):

| # | 사실 | 출처 |
|---|---|---|
| 1 | 입력은 `Record<string, unknown> \| null` — 모든 값이 `unknown` 인 열린 map | [executions.ts:27](../../codebase/frontend/src/lib/api/executions.ts) |
| 2 | frontend API 레이어에 **런타임 검증이 전혀 없다** — `lib/api/` 전체에 zod import 0건 | `grep -rn "from \"zod\"" codebase/frontend/src/lib/api/` → 0 |
| 3 | sound 한 판별자가 없다 — 레거시 행에는 마커 자체가 없고, `interactionType` 은 이 저장소에서 이미 unsound 로 판정된 판별자 | [swagger.md §1-4](../../spec/conventions/swagger.md) (PR #904). 관련 규약: [api-convention §5.4](../../spec/5-system/2-api-convention.md) (부재 표현 — 직접 논거 아님) |

핵심은 **경계 파서가 total 이어야 한다**는 점이다 — 파싱 실패로 행을 거부하면 그게 곧 #959
실패 모드(미리보기 소실)다. 6차례 마이그레이션을 거친 열린 영속 JSON 에 대한 total 파서는
**지금의 heuristic OR-체인 그 자체**이며, 이름과 위치만 바뀐다. 게다가 `isConversationOutput`
은 이미 단일 chokepoint 다 (호출부 3곳, 전부 boolean 소비 — [result-detail.tsx:1006·1052](../../codebase/frontend/src/components/editor/run-results/result-detail.tsx),
[result-timeline.tsx:73](../../codebase/frontend/src/components/editor/run-results/result-timeline.tsx)).
즉 "판정을 한 곳에 모은다" 는 이득은 **이미 실현돼 있다**.

→ 구조적 이득 0, 대신 #983 이 방금 세운 mutation 안전망을 폐기하고 동등 실패 모드를 전수
재실측해야 한다. **비용만 남는다.**

> 재고 조건: frontend API 레이어 전반에 런타임 검증(zod 등)이 도입되는 별개 결정이 선행되면
> 그때 재판정 대상이 된다. 이 함수 단독으로는 재고하지 않는다.

### 2. `endReason` 키 부재 단독 음성 테스트 — **완료**

`output.result.messages` 는 있으나 `endReason` 키가 **어디에도 없는** fixture 로 false 고정.

실측으로 리뷰 INFO 1 의 전제를 정밀화했다 — 이 테스트가 지키는 건 `typeof endReason ===
"string"` conjunct 의 *존재* 가 아니다:

| 변형 | tsc | vitest |
|---|---|---|
| conjunct 단순 제거 | **TS2345** (`output-shape.ts:202`, `string \| undefined` → `string`) | 39/39 green (동작 동일) |

`CONVERSATION_END_REASONS` 가 `ReadonlySet<string>` 이라 `has(undefined)` 는 언제나 false 이고,
비-string 이 멤버가 될 수 없으므로 **어떤 fixture 로도 단순 제거는 관측되지 않는다**. 실제
위험은 리뷰어가 지목한 **리팩터 클래스** — 타입 에러를 `endReason ?? "completed"` 로 무마하거나
`typeof endReason !== "string" || has(...)` 로 뒤집는 경우로, 기존 `bogus_value` 테스트는
그때도 green 이다. 신규 fixture 가 그 클래스를 red 로 만든다. (이 구분을 테스트 주석에 명시.)

### 3. 이월 주석 정리 3건 — **완료**

- **언어 혼용** — `isConversationOutput` JSDoc 을 한국어로 통일(영어 산문 + 한국어 단락 혼재
  해소). 프로젝트 기본 언어 규약에 맞춘다.
- **JSDoc ↔ 테스트 이중 SoT** — **JSDoc 이 근거의 SoT** 로 확정. "왜 이 분기가 존재하는가 /
  왜 생산자가 없는데도 방어적으로 남는가" 는 JSDoc 에만 두고, 테스트 주석은 "이 fixture 가
  어떤 분기를 고립시키는가"(필드 존재/부재)만 서술 + JSDoc 위임. 위임 규약 자체를 JSDoc
  말미에 명문화해 다음 편집자가 다시 갈라놓지 않게 했다. 테스트 쪽 #959 서사는 포인터로 축약.
- **변수명 결합 주석** — OR-체인 3개 테스트 주석을 필드 존재/부재 서술로 전환하고 내부
  변수명(`hasLegacyMessages`/`outputInteraction`/`hasConvConfig`/`metaInteraction`)은
  "(내부적으로 …)" 괄호 각주로 강등 — #983 이 AND-guard 4개에 적용한 스타일과 동형.
  같은 describe 안의 `post-Stage-5 terminal` 테스트도 동일 위반이라 함께 교정(4곳).

### 4. `it.each` 테이블 구동 전환 — **NO-GO** (측정 근거)

`isConversationOutput` describe 를 실측 분해한 결과 **테이블이 줄일 수 있는 건 전체의 4%
미만**이다 — 부피는 `it()` 보일러플레이트가 아니라 fixture 와 고립 근거 주석이다.

| 구분 | 라인 | 비고 |
|---|---:|---|
| fixture / 기타 | 148 | 케이스마다 키 조합이 전부 달라 테이블로 옮겨도 그대로 |
| 고립 근거 주석 | 95 | 그대로 이동. object literal 안에서는 오히려 가독성 하락 |
| `it(` opener + `expect` + closer | 55 | **테이블로 제거 가능한 유일한 부분** |
| blank | 19 | |
| **describe 합계** | **317** | 파일 전체 790 |

테이블은 행마다 `name`·`expected` 필드(≈36줄)와 runner(≈6줄)를 되돌려 요구하므로 **순감
약 13줄(describe 의 4%, 파일 전체의 1.6%)**. 그 대가로 케이스별 고립 근거가 object literal
주석으로 들어가 "이 케이스가 어떤 guard 를 고립시키는가" 의 1:1 가독성이 떨어진다.

> mutation 신호 자체는 `it.each` 도 행 단위로 보존한다(행 하나가 곧 `it` 하나) — 기각 사유는
> 신호 훼손이 아니라 **이득이 측정상 없다**는 점이다. 다른 describe(`extractAiMetadata`
> 262줄/11건 등)도 fixture 가 이질적이라 동일 결론.

## 체크리스트

- [x] 선행 확인 — `git log origin/main` + 두 파일 실독으로 항목별 유효성 재판정 (4건 전부 유효, 중복 0)
- [x] 1) union 재설계 go/no-go — **NO-GO** 판정 + 근거 기록
- [x] 2) `endReason` 키 부재 음성 테스트 1건 추가 (39 → 40)
- [x] (1차 리뷰 INFO 3 반영) `output.endReason` fallback 단 고립 fixture 1건 추가 (40 → 41)
- [x] (2차 리뷰 WARNING 1 반영) JSDoc "Stage 5 이후 종결" bullet 에 2단 조회 서술 추가
- [x] (2차 리뷰 INFO 1 반영) `endReason` 우선순위 고정 fixture 1건 추가 (41 → 42)
- [x] 3) 주석 정리 3건 (언어 통일 / SoT 위임 / 변수명 강등 4곳)
- [x] 4) 테이블 구동 전환 검토 — **NO-GO** + 측정치 기록
- [x] mutation 실측 — 신규 테스트가 잡는 리팩터 클래스 + #983 고립 테스트 7건 회귀 없음
- [ ] `/ai-review` + Critical/Warning 반영

## mutation 실측 (2026-07-23)

원복은 백업 `cp` + 절대경로 (cwd-상대 `git checkout` 금지 — 과거 미커밋 작업 소실 전례).
하네스는 뮤턴트마다 **앵커 1회 등장 assert → 치환 → tsc 파스/타입 검사 → vitest** 순으로
돌려 "치환 실패한 뮤턴트가 낸 RED" 를 배제했고, 매 라운드 베이스라인 green 을 선확인했다.

> **표 읽는 법**: 아래 §측정 1 / 1b / 1c 는 **각 라운드 시점의 수치**를 그대로 남긴다(그 시점
> 총 테스트 수가 39 → 40 → 41 로 달랐다). 각 fixture 가 "추가 전엔 mutation 이 생존했고
> 추가 후엔 red 가 됐다" 는 대비가 그 라운드에서만 관측되므로 소급 갱신하지 않는다.
> **최종 상태(42건)에서 12개 뮤턴트를 전수 재실행한 결과는 §측정 2 아래 각주**에 있다.

> **하네스 함정 (이번에 실제로 겪음)**: 백업 base 는 **소스를 편집할 때마다 다시 떠야 한다**.
> 2차 리뷰 WARNING 1 의 JSDoc 수정을 한 뒤 옛 base 로 `restore` 하는 바람에 그 수정이
> 통째로 되돌려졌다(재적용 후 base 재캡처로 복구). 원복 방식(cp+절대경로)이 옳아도 **base 가
> stale 하면 미커밋 작업이 사라진다** — 커밋 먼저가 더 안전한 이유.

**뮤턴트 유효성**: 12건 전부 parse error 0. R3 을 제외한 11건은 `output-shape.ts` 타입 에러도
0 — 즉 **전부 실제로 머지될 수 있는 변형**이라 mutation 신호가 "어차피 컴파일러가 잡는다" 로
희석되지 않는다.

### 측정 1 — 신규 테스트(항목 2)가 잡는 리팩터 클래스

| # | mutation | tsc | 기존 `bogus_value` 테스트 | 신규 테스트 | 총계 |
|---|---|---|---|---|---|
| R1 | `has(endReason ?? "completed")` | clean | **green (미검출)** | **red** | 1 failed / 39 passed |
| R2 | `typeof endReason !== "string" \|\| has(...)` | clean | **green (미검출)** | **red** | 1 failed / 39 passed |
| R3 | conjunct 단순 제거 | **TS2345** (`:202`) | green | green | 40 passed |

R1·R2 에서 red 가 된 유일한 테스트는 신규
`rejects result.messages when the endReason key is absent entirely` 였다 — 기존 화이트리스트
음성 테스트는 두 경우 모두 green 이므로, **신규 테스트가 실제로 새 실패 모드를 닫는다**.

R3 은 vitest 40/40 green 이지만 tsc 가 막는다 — §항목 2 의 "단순 삭제는 관측 불가하되 애초에
머지 불가" 를 재확인. 이 행은 테스트가 아니라 **타입 시스템이 담당하는 몫**이다.

### 측정 1b — `output.endReason` fallback 단 (리뷰 INFO 3, 2차 라운드 추가)

`endReason` 은 `result?.endReason ?? output.endReason` 2단 조회인데 **fallback 단이 어떤
fixture 로도 고립되지 않았다** — 리뷰 testing 리뷰어 발견, 실측 재현 결과 통째로 지워도
tsc clean + 40/40 green 이었다. 대화 UI 게이트에서 살아남는 mutation 은 곧 미리보기 소실
경로이므로 fixture 1건을 추가해 닫았다 (`detects a terminal whose endReason sits at
output.endReason, not result.endReason`, 40 → 41).

| # | mutation | tsc | 추가 전 | 추가 후 |
|---|---|---|---|---|
| H | `?? (output.endReason …)` fallback 제거 | clean | **40/40 green (생존)** | **1 failed / 40 passed** |

> 이번 diff 가 만든 갭이 아니라 **사전 존재** 갭이다(#983 이전부터). 리뷰어는 비차단 INFO 로
> 분류했으나, 본 작업의 목적이 이 게이트의 mutation 완전성이므로 이월하지 않고 닫았다.

### 측정 1c — `endReason` 2단 조회의 **우선순위** (리뷰 INFO 1, 3차 라운드 추가)

1b 가 fallback 단의 *존재* 를 닫자, 2차 리뷰 testing 리뷰어가 같은 계열의 잔여 갭을 짚었다 —
`result.endReason` 과 `output.endReason` 이 **서로 다른 값으로 동시 존재**하는 fixture 가 없어
`??` 좌우를 뒤바꾸는 mutation 이 관측되지 않는다. 실측 재현 결과 사실이었다.

| # | mutation | tsc | 추가 전 | 추가 후 |
|---|---|---|---|---|
| I | `??` 좌우 교환 (`output` 우선으로 역전) | clean | **41/41 green (생존)** | **1 failed / 41 passed** |

`result.endReason` 에 화이트리스트 밖 값, `output.endReason` 에 화이트리스트 값을 동시에
실어 방향을 관측 가능하게 만든다 — 현재 순서면 무효값이 이겨 `false`, 역전되면 유효값이
이겨 `true`. (`prefers result.endReason over output.endReason when both are present`, 41 → 42)

### 측정 2 — #983 고립 테스트 7건 회귀 없음

주석·JSDoc 만 바꿨고 소스 로직은 무변경이지만, 고립 테스트가 안전망인 이상 전수 재실측했다.
**7건 전부 정확히 대응 테스트 1건만 red** — 고립성 유지 확인.

| # | 제거 대상 | red 가 된 테스트 | 총계 |
|---|---|---|---|
| A | 최상위 게이트 `conversationConfig` disjunct | `detects … bare top-level conversationConfig` | 1 failed / 41 passed |
| B | 첫 OR-항 `hasLegacyMessages` guard | `rejects output.interactionType when output.messages is absent` | 1 failed / 41 passed |
| C | `looksLikeConversationEnd` 의 `hasResultMessages` | `rejects a whitelisted endReason without result.messages` | 1 failed / 41 passed |
| D | `isCanonicalWaiting` 의 `hasLegacyMessages` | `rejects waiting_for_input status alone without output.messages` | 1 failed / 41 passed |
| E | `outputInteraction` 분기 | `detects … via output.interactionType alone` | 1 failed / 41 passed |
| F | `hasConvConfig` 분기 | `detects … via nested output.conversationConfig alone` | 1 failed / 41 passed |
| G | `metaInteraction` 분기 | `detects … via output.messages + meta.interactionType without status` | 1 failed / 41 passed |

> 총계는 fixture 2건 추가 후(42건) 재실측치다. **12건 전수 재실행**해 신규 fixture 들이 기존
> 어떤 guard 와도 겹치지 않음을 확인했다 — 각 mutation 이 여전히 정확히 1건만, 그리고 의도한
> 그 1건만 red 로 만든다 (R3 만 타입 차단이라 0건).

> C 는 신규 테스트와 같은 `output.result.*` 경로를 건드리지만 **신규 테스트는 green 을 유지**
> 한다 — 그 fixture 는 `endReason` 키가 없어 `typeof endReason === "string"` 에서 이미 false
> 이므로 `hasResultMessages` 유무와 무관하게 판정이 바뀌지 않는다. 두 테스트는 같은 분기의
> 서로 다른 실패 방향을 겹치지 않게 지킨다.

원복 후 `git diff` 잔여 **0줄** (매 뮤턴트 직후 + 전체 종료 후 확인).
