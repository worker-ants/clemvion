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
| 3 | sound 한 판별자가 없다 — 레거시 행에는 마커 자체가 없고, `interactionType` 은 이 저장소에서 이미 unsound 로 판정된 판별자 | [swagger.md §1-4 / api-convention §5.4](../../spec/conventions/) (PR #904) |

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
- [x] 3) 주석 정리 3건 (언어 통일 / SoT 위임 / 변수명 강등 4곳)
- [x] 4) 테이블 구동 전환 검토 — **NO-GO** + 측정치 기록
- [ ] mutation 실측 — 신규 테스트가 잡는 리팩터 클래스 + #983 고립 테스트 7건 회귀 없음
- [ ] `/ai-review` + Critical/Warning 반영

## mutation 실측

원복은 백업 `cp` + 절대경로 (cwd-상대 `git checkout` 금지 — 과거 미커밋 작업 소실 전례).
**커밋 후 실행** — 아래 표는 실행 후 실측치로 채운다 (미실행 상태에서 수치를 적지 않는다).

### 측정 대상 1 — 신규 테스트(항목 2)가 잡는 리팩터 클래스

| # | mutation | 기존 `bogus_value` 테스트 | 신규 테스트 |
|---|---|---|---|
| R1 | `has(endReason ?? "completed")` | (측정 예정) | (측정 예정) |
| R2 | `typeof endReason !== "string" \|\| has(endReason)` | (측정 예정) | (측정 예정) |
| R3 | conjunct 단순 제거 | 측정 완료 — green | green, **tsc 가 TS2345 로 차단** (§항목 2) |

### 측정 대상 2 — #983 고립 테스트 7건 회귀 없음

주석·JSDoc 만 바꿨고 소스 로직은 무변경이지만, 고립 테스트가 안전망인 이상 **전수 재실측**한다.

| # | 제거 대상 | 결과 |
|---|---|---|
| A | 최상위 게이트 `conversationConfig` disjunct | (측정 예정) |
| B | 첫 OR-항 `hasLegacyMessages` guard | (측정 예정) |
| C | `looksLikeConversationEnd` 의 `hasResultMessages` | (측정 예정) |
| D | `isCanonicalWaiting` 의 `hasLegacyMessages` | (측정 예정) |
| E | `outputInteraction` 분기 | (측정 예정) |
| F | `hasConvConfig` 분기 | (측정 예정) |
| G | `metaInteraction` 분기 | (측정 예정) |
