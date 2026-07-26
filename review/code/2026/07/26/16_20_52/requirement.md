# 요구사항(Requirement) Review — review/code/2026/07/26/16_20_52 (7R)

대상: HEAD `3428129b1` — "fix(engine): 6R W26·W27 — JSDoc 고아 해소 + error 키 부재 불변식 결속"
(부모 `410d913fe`, 즉 5R 결과물 기준)

프롬프트(`_prompts/requirement.md`)의 "리뷰 대상 파일" 목록은 직전 라운드(`13_47_42`) 및 그 이전
라운드들의 review 산출물(`_routing_decision.json`, `concurrency.md`, `maintainability.md`,
`performance.md`, `side_effect.md` 등) diff뿐이었고, 이번 diff의 실제 소스 변경은 프롬프트에
포함돼 있지 않았다 (기존에 반복 관측된 harness diff-list 갭, 이미 백로그로 분리된 항목이라
재론하지 않음). 지시대로 `git show HEAD --stat` / `git show HEAD -- <path>` 로 실제 코드·테스트
diff를 직접 열어 검증했다.

## 검증 대상 요약

`git show --stat` 기준 이번 커밋의 실질 코드 변경은 정확히 2개 파일:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (40 +--)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (+7)

나머지는 `review/code/2026/07/26/{15_29_59→15_56_53}/*` 산출물 정리(리뷰 하네스 정규 워크플로,
요구사항 충족 관점 밖).

## 검증 1: `.ts` 변경 — W26(JSDoc 고아) 해소 확인

`git diff 410d913fe..3428129b1 -- execution-engine.service.ts` 를 직접 대조했다.

- 삭제된 20줄(`finalizeCancelledExecution` JSDoc, `markNodeCancelled` JSDoc **앞**에 끼어 있던 위치)과
  추가된 20줄(같은 텍스트, `private async finalizeCancelledExecution(` 선언 **바로 앞**)이 글자 단위로
  완전히 동일 — 순수 텍스트 재배치이고 실행 가능한 코드(함수 시그니처·본문·호출부)는 diff에 전혀
  등장하지 않는다.
- 이동 후 실제 파일(`git show HEAD:...ts` 4544~4620줄 대조)을 직접 읽어, 두 JSDoc 블록이 각각 자기
  함수(`markNodeCancelled` / `finalizeCancelledExecution`)와 빈 줄 없이 바로 인접하고, 두 함수/JSDoc
  쌍 사이에는 정상적으로 빈 줄 하나가 존재함을 확인했다. 5R에서 지적된 "두 `/** */` 가 빈 줄 없이
  연속되고 `finalizeCancelledExecution` 이 자기 문서와 47줄 떨어짐" 문제는 재발하지 않는다.
- **W26 해소 확인.** 추가 조치 불필요.

## 검증 2: spec `node-cancellation.md` §5.1 계약 유지 여부

`spec/conventions/node-cancellation.md` §5.1(NodeExecution 상태 — `cancelled`)의 요구사항:

> `error.name === 'AbortError'` 인 throw 는 노드가 실패한 것이 아니라 중단된 것이므로 `NodeExecution.status`
> 를 `cancelled` 로 기록. 종료 시 `execution.node.cancelled` WS 이벤트 발행. `output.error` 는 표준
> 봉투(`code: 'AbortError'`)로 기록하되 `meta.success = false`.

- 이번 diff는 `markNodeCancelled`/`finalizeCancelledExecution` **본문을 전혀 건드리지 않았다** (검증 1).
  `nodeExecution.status = CANCELLED` 대입, `errorEnvelope` 조건부 대입(`if (errorEnvelope) nodeExecution.error = errorEnvelope`),
  `NODE_CANCELLED` emit, payload 의 `...(errorEnvelope ? { error: errorEnvelope } : {})` 스프레드는
  모두 5R 이전 그대로다. §5.1 계약(상태 분류·WS 이벤트·에러 봉투 조건부 기록)은 diff 전후 바이트 단위로
  동일하게 유지된다.
- `markNodeCancelled` JSDoc(이동되지 않은 블록)이 "`isAbortError` 경로는 §5.1 봉투를 싣고
  `ExecutionCancelledError` 경로는 싣지 않는다"고 서술하는 내용도 실제 호출부(`isAbortError` 분기가
  `errorEnvelope={code:'AbortError', message}` 전달, `ExecutionCancelledError` 분기가 미전달)와
  일치 — 이 부분은 이번 diff의 범위가 아니지만(변경 없음), 이동으로 인한 부작용이 없는지 재확인차
  대조했고 이상 없다.
- **결론**: §5.1 계약은 이번 커밋으로 변경되지 않았고, 유지되고 있음을 확인.

## 검증 3: `.spec.ts` 신규 단언 2줄 — W27 결속 확인, 데이터 유효성 관점

추가된 코드(`execution-engine.service.spec.ts`):

```
expect(ne?.error).toBeUndefined();
expect(cancelCall?.[3]).not.toHaveProperty('error');
```

- 삽입 위치는 "Sub-Workflow(workflow) 노드에서 `ExecutionCancelledError` 가 발생하면 FAILED 로
  오분류하거나 NODE_FAILED 를 emit 하지 않는다 (W15)" 테스트 — 정확히 `errorEnvelope` **미전달** 분기
  (`ExecutionCancelledError`, 내부 sentinel message 에 executionId 포함 → 클라이언트 유출 금지, W15/W19)를
  검증하는 케이스다. `markNodeCancelled` 소스(`if (errorEnvelope) nodeExecution.error = errorEnvelope`
  / `...(errorEnvelope ? {error} : {})`)를 대조하면, 이 분기에서는 `nodeExecution.error` 가 대입되지
  않고 payload 에도 `error` 키가 생성되지 않아야 정상이므로, 두 단언 모두 실제 구현이 보장하는 불변식과
  **정확히 일치**한다 — 커밋 메시지가 주장하는 "leak 주입 시 RED, 복원 시 GREEN" mutation 결과와 부합.
- `error` 필드는 spec `1-data-model.md` §2.14(NodeExecution)에서 `JSONB?`(nullable) 로 정의돼 있어
  부재/undefined 가 유효한 상태다 — 단언이 스키마 상 optional 필드에 대해 "없을 수 있다"가 아니라
  "이 분기에서는 반드시 없어야 한다"를 못박는 것이므로 §5.1의 "errorEnvelope 부재 시 미기록" 암묵
  전제를 테스트 레벨로 승격한 것과 같다. 회귀 방지 목적에 부합.
- `ne`(`lastNodeExecSave('n-subwf')` 반환값)와 `cancelCall`(`emitNodeEvent` 호출 인자 중
  `execution.node.cancelled` + 노드 id 일치 건)은 같은 테스트 안에서 이미 여러 단언(`status`,
  `finishedAt`, WS payload 문자열 미포함 등)에 재사용되던 기존 변수이므로 신규 단언이 잘못된 대상을
  가리킬 위험도 없다.
- **W27 관련 재검증**: 5R SUMMARY 가 "구조적으로 고정"이라 표현한 목표(에러 미유출 불변식을 단언
  레벨로 결속)가 실제 diff와 정확히 일치함을 확인. 새로 검토했지만 이미 6R에서 해소로 판정된 항목이라
  중복 지적하지 않는다.

## 기능 완전성 / 에러 시나리오 / 반환값 관점

- 이번 커밋은 신규 기능이 아니라 (a) 순수 주석 재배치, (b) 기존 불변식을 검증하는 단언 2줄 추가뿐이다.
  함수 시그니처·반환 경로·에러 처리 로직에 변경이 없으므로 "모든 경로에서 적절한 값을 반환하는지",
  "에러 시나리오 처리" 항목은 이번 diff 범위에서 재론할 대상이 없다(6R 이전 라운드에서 이미 검증됨).
- TODO/FIXME/HACK/XXX 신규 주석 없음 (diff 전체가 JSDoc 재배치 + 단언 2줄 + 그 근거를 설명하는 주석
  5줄뿐).

## 발견사항

없음. 7라운드 연속으로 requirement 관점 신규 결함 없음. 지시된 두 확인 대상(W26 해소, §5.1 계약 유지)
모두 코드를 직접 열어 line-level 로 확인했고 둘 다 정상이다.

## 요약

HEAD 커밋(`3428129b1`)은 커밋 메시지가 주장하는 범위(W26 JSDoc 재배치 + W27 불변식 단언 추가)를
정확히 그대로 구현했다. `.ts` 변경은 삭제 20줄·추가 20줄이 글자 단위로 동일한 순수 블록 이동으로,
`markNodeCancelled`/`finalizeCancelledExecution` 의 런타임 로직·§5.1 계약(NodeExecution `cancelled`
상태 분류, WS `execution.node.cancelled` emit, `errorEnvelope` 조건부 기록)에 아무 영향이 없음을
확인했다. `.spec.ts` 신규 단언 2줄은 `ExecutionCancelledError` 분기(`errorEnvelope` 미전달)에서
`error` 필드/키가 실제로 생성되지 않는다는, 헬퍼의 존재 이유였던 불변식을 정확히 겨냥하고 있고
실제 구현 동작과 일치한다. 새로 발견된 결함은 없다.

## 위험도

NONE
