# 테스트(Testing) Review — review/code/2026/07/26/16_20_52 (7R)

대상: HEAD `3428129b1` — "fix(engine): 6R W26·W27 — JSDoc 고아 해소 + error 키 부재 불변식 결속"

프롬프트(`_prompts/testing.md`)의 "리뷰 대상 파일" 목록은 직전 라운드들(`13_47_42`, `14_45_30`,
`15_30_00`, `15_56_53`)의 review 산출물(`_routing_decision.json`, `concurrency.md`,
`maintainability.md`, `performance.md`, `side_effect.md`, `SUMMARY.md`, `RESOLUTION.md` 등) diff만
포함돼 있었고, 이번 라운드의 실제 소스 변경(`execution-engine.service.ts`,
`execution-engine.service.spec.ts`)은 프롬프트에 없었다 — 이미 6라운드째 반복 관측된 harness
diff-list 갭이라 그 자체는 재론하지 않는다. 지시대로 `git show HEAD --stat` / `git show HEAD --
<path>` 로 실제 코드·테스트 diff를 직접 열어 검증했다.

## 검증 대상 요약

`git show --stat` 기준 이번 커밋의 실질 코드 변경은 정확히 2개 파일:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `+40 -40`(정확히는
  삭제 20줄·추가 20줄, diff 헤더 포함 grep 카운트로 재확인: `-` 21줄/`+` 21줄, 각 1줄은 `---`/`+++`
  헤더). 삭제된 20줄과 추가된 20줄은 `finalizeCancelledExecution` JSDoc 블록 전체가 글자 단위로
  동일하게 재배치된 것 — `markNodeCancelled` JSDoc **앞**에서 `finalizeCancelledExecution` 선언
  **바로 앞**으로 이동. 실행 가능한 코드(함수 시그니처·본문·호출부)는 diff에 전혀 등장하지 않는다
  (W26, 이미 requirement/maintainability/documentation 3개 관점에서 해소 판정 — 재론하지 않음).
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `+7`. 기존
  W15 회귀 테스트("Sub-Workflow(workflow) 노드에서 `ExecutionCancelledError` 가 발생하면 FAILED 로
  오분류하거나 NODE_FAILED 를 emit 하지 않는다")에 설명 주석 5줄 + 단언 2줄
  (`expect(ne?.error).toBeUndefined()`, `expect(cancelCall?.[3]).not.toHaveProperty('error')`) 추가.

이번 라운드 테스트 리뷰의 핵심 임무는 **W27**("`markNodeCancelled` 가 `errorEnvelope` 없이 호출될
때 `error` 키/필드 자체가 생기지 않는다"는 불변식이 구조적으로 미검증이었고, leak 을 강제 주입해도
기존 4개 회귀 테스트가 전부 GREEN 이었다는 지적)이 이번 diff 로 실제로 해소됐는지를 **직접
mutation 으로 재실측**하는 것이었다. 이하 결과.

## W27 mutation 재실측 (직접 수행)

### 방법

`git show HEAD -- .../execution-engine.service.ts` 로 확인한 `markNodeCancelled`
(4566~4595줄, `execution-engine.service.ts`)의 두 지점을 `cp` 백업 후 Python 스크립트로 line-level
치환해 mutation:

```
# 4574줄: 조건부 대입 → 무조건 대입(leak)
- if (errorEnvelope) nodeExecution.error = errorEnvelope;
+ nodeExecution.error = errorEnvelope ?? { code: 'X', message: 'leak' };

# 4587줄: 조건부 spread → 무조건 포함(leak)
- ...(errorEnvelope ? { error: errorEnvelope } : {}),
+ error: errorEnvelope ?? { code: 'X', message: 'leak' },
```

`git checkout` 은 사용하지 않았다 — 매 라운드 `cp` 백업본으로 원복하고 `git diff` 로 원복 완전성을
확인했다(최종 `git diff -- execution-engine.service.ts` 출력 없음, HEAD 와 바이트 단위 동일 확인).

### 결과 — 3가지 조합 전부 RED, 원복 후 전부 GREEN

| mutation 조합 | 대상 | 결과 |
|---|---|---|
| DB 필드 + WS payload 동시 leak | 4574·4587줄 둘 다 | RED — `expect(ne?.error).toBeUndefined()` 에서 `Received: {"code":"X","message":"leak"}` |
| WS payload만 leak (DB 필드는 정상) | 4587줄만 | RED — `expect(cancelCall?.[3]).not.toHaveProperty('error')` 에서 검출 (1번째 단언은 통과, 2번째가 단독으로 검출) |
| DB 필드만 leak (WS payload는 정상) | 4574줄만 | RED — `expect(ne?.error).toBeUndefined()` 에서 검출 (1번째 단언이 단독으로 검출) |
| 원복 (`cp` 백업 복원) | — | GREEN — 해당 스펙 파일 전체 420 tests 통과 (`jest execution-engine.service.spec.ts`) |

세 조합 모두 `npx jest execution-engine.service.spec.ts -t "W15"` 로 실행해 확인했으며, 원복 뒤
`git diff -- execution-engine.service.ts` 가 빈 출력임을 확인해 소스가 HEAD 상태로 완전히
복원됐음도 검증했다.

**결론**: 두 신규 단언은 **서로 독립적으로** leak 을 검출한다 — DB 필드(`nodeExecution.error`)와
WS emit payload(`error` 키)는 별도 코드 경로(4574줄/4587줄)이므로 한쪽만 회귀해도 다른 쪽 단언이
단독으로 잡아낸다(중복이 아니라 두 표면을 각각 방어하는 의도된 이중 방어선). 커밋 메시지가 주장한
"leak 주입 시 RED, 복원 시 GREEN"은 내가 직접 재현한 결과와 일치한다. **W27 해소 확인.**

### 부가 확인 — vacuous-test 위험 배제

`cancelCall`(= `mockWebsocketService.emitNodeEvent.mock.calls.find(...)` 결과)이 혹시 `undefined`
로 남아 `cancelCall?.[3]` 가 항상 `undefined` 가 되고 `not.toHaveProperty('error')` 가 공허하게
통과하는 것은 아닌지 우려했으나, mutation 실행 시 Jest 실패 메시지가 `Received value:
{"code":"X","message":"leak"}` 로 **실제 객체**를 보여줬으므로 `cancelCall` 이 정상적으로 대상
호출을 찾아냈고 단언이 실제로 유효 관측을 하고 있음을 확인했다. `ne` 도 동일하게 실측으로 확인.

## 회귀 테스트 유효성

- `npx jest src/modules/execution-engine/execution-engine.service.spec.ts` 전체 실행: **420 passed,
  0 failed** (mutation 원복 후). 이번 diff 가 기존 회귀 스위트를 깨지 않았다.
- 신규 단언이 삽입된 위치는 기존 W15 테스트 내부이며, 새 `it()` 블록을 추가하지 않고 기존 테스트에
  단언을 보강하는 방식 — 테스트 격리에 영향 없음(같은 `beforeEach` 로 매 테스트 서비스 인스턴스가
  재생성되는 기존 패턴을 그대로 따름, 245줄 `beforeEach` + 663줄 주석 "mutation 누수 없음" 확인).
- `ne`/`cancelCall` 은 같은 테스트 안에서 이미 `status`/`finishedAt`/WS emit 여부 등 여러 단언에
  재사용되던 기존 변수라, 신규 단언이 새로운 mock 배선이나 추가 fixture 없이 기존 관측 지점만
  재사용한다 — 최소 변경으로 목표를 달성한 좋은 설계.

## Mock 적절성 / 테스트 가독성

- Mock 사용에 변화 없음(`mockNodeExecutionRepo`, `mockWebsocketService` 등 기존 mock 그대로 재사용).
- 신규 주석(5799~5803줄)이 "왜 이 단언이 필요한가"(기존 문자열 포함-미포함 단언만으로는
  구조적으로 불충분했던 이유)를 명확히 서술해 가독성이 좋다. 6R 커밋 메시지의 mutation 근거와도
  일치해 추적 가능성(traceability)이 확보돼 있다.

## 발견사항

없음. 지시된 검증 대상(W27 mutation 재실측)을 직접 수행한 결과 실제로 해소됨을 확인했고, 그 외
diff 범위(순수 JSDoc 블록 이동)에는 테스트가 필요한 실행 경로 변경이 없다. 7라운드 연속으로 테스트
관점 신규 결함 없음 — C1~C5, W1~W26 은 재론하지 않는다.

## 요약

이번 diff 는 (a) `execution-engine.service.ts` 의 순수 JSDoc 블록 이동(실행 코드 변경 없음, W26
해소)과 (b) `execution-engine.service.spec.ts` 에 W27 을 겨냥한 단언 2줄 추가뿐이다. 직전 라운드에서
낸 W27("errorEnvelope 부재 시 error 키가 생기지 않는다"는 불변식이 구조적으로 미검증)을 `cp`
백업 기반 직접 mutation(DB 필드만/WS payload만/둘 다 leak 3가지 조합)으로 재실측한 결과, 신규
단언 2줄이 세 조합 모두에서 독립적으로 RED 를 내고 원복 후 전체 스위트(420 tests)가 GREEN 임을
확인했다 — W27 은 실측 기준으로 완전히 해소됐다. 새로운 테스트 커버리지 갭이나 mock/격리/가독성
문제는 발견되지 않았다.

## 위험도

NONE
