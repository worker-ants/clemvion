# 부작용(Side Effect) Review — linear-cancel-mechanism (6R)

## 스코프 노트

프롬프트 diff-list 에는 이번 라운드가 실제로 반영한 소스 변경(`markNodeCancelled` 추출)이
포함돼 있지 않았다 — 첨부된 34개 파일은 전부 이전 라운드(`13_47_42`/`14_45_30`/`15_30_00`)의
리뷰 산출물(md/json)이었다. 오케스트레이터가 지시한 실제 점검 대상을 `git log`로 추적해
커밋 `410d913fe`("refactor(engine): 5R W25 — 노드 취소 종결 중복을 markNodeCancelled 로 추출")
를 특정했고, `git show 410d913fe -- codebase/backend/.../execution-engine.service.ts` 로 diff
전문을 직접 열어 대조했다(4R·5R 문서가 스스로 기록한 것과 동일한 "harness diff-base 스코프 갭"의
반복).

## 중점 대조 — WS payload shape·DB 저장 필드 필드 단위 동일성

대상: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- 신규 헬퍼 `markNodeCancelled` 정의: 4586~4634행
- 호출부 1(`isAbortError` 분기, errorEnvelope 전달): 5816~5825행
- 호출부 2(`ExecutionCancelledError` 분기, errorEnvelope 생략): 5858행

### (a) `isAbortError` 경로 — 추출 전후 완전 동일 확인

리팩터 전(커밋 `410d913fe`의 `-` 라인 기준):
```
nodeExecution.status = CANCELLED
nodeExecution.error = errorEnvelope        // 항상 대입
nodeExecution.finishedAt = new Date()
nodeExecution.durationMs = finishedAt - startedAt
save(nodeExecution)
emitNode(..., { nodeExecutionId, parentNodeExecutionId, status, error: errorEnvelope,
                nodeType, nodeLabel, input, startedAt, finishedAt })
```
리팩터 후 (`markNodeCancelled(nodeExecution, node, context, executionId, { code, message })`):
```
nodeExecution.status = CANCELLED
if (errorEnvelope) nodeExecution.error = errorEnvelope   // errorEnvelope 는 항상 truthy 객체이므로 무조건 대입과 동치
nodeExecution.finishedAt = new Date()
nodeExecution.durationMs = finishedAt - startedAt
save(nodeExecution)
emitNode(..., { nodeExecutionId, parentNodeExecutionId, status,
                ...(errorEnvelope ? { error: errorEnvelope } : {}),   // errorEnvelope truthy → error 키가 '동일 위치'에 삽입
                nodeType, nodeLabel, input, startedAt, finishedAt })
```
- 대입 순서·연산 순서(동기 필드 대입 4개 → `await save` → `await emitNode`)가 토큰 단위로 동일.
- 키 순서도 완전히 동일 — 스프레드가 `status` 다음, `nodeType` 이전이라는 원래 `error:` 리터럴의
  위치를 그대로 재현한다(단순 삽입이 아니라 원본과 동일한 슬롯).
- `nodeExecution.error`와 emit payload 의 `error` 는 **같은 객체 참조**(`{code:'AbortError', message: err.message}`)
  를 공유한다는 성질도 추출 전후 동일 — 참조 동일성까지 보존됨.

### (b) `ExecutionCancelledError` 경로 — 키 자체가 생기지 않음을 확인

리팩터 전: `nodeExecution.error` 를 아예 건드리지 않고, emit payload 에도 `error` 키가 없음
(원본 리터럴에 `error:` 줄 자체가 없었다).
리팩터 후: `markNodeCancelled(nodeExecution, node, context, executionId)` — 5번째 인자 생략 →
`errorEnvelope === undefined`.
- `if (errorEnvelope) nodeExecution.error = ...` → `undefined` 는 falsy → **엔티티 필드 대입 자체가
  스킵**돼 DB 에도 `.error` 미대입 상태 유지(리팩터 전과 동일하게 "손대지 않음").
- `...(errorEnvelope ? { error: errorEnvelope } : {})` → 빈 객체 스프레드 → **`error` 키가 결과
  객체에 아예 나타나지 않는다**(값이 `undefined`인 키가 남는 것도 아니고, 키 자체가 없음 —
  `Object.keys()`/`JSON.stringify` 양쪽에서 검증 가능한 차이). W15/W19 취지(내부 executionId 가
  포함된 sentinel message 를 client 로 노출하지 않음)와 정확히 일치.

**결론**: (a)(b) 두 경로 모두 WS payload 의 키 집합·키 순서·값(및 객체 참조 동일성)과 DB 에
영속되는 `NodeExecution.error` 필드가 추출 전후 완전히 동일하다. 새로 발견된 필드 단위 불일치는
없다.

## `throw` 를 호출부에 남긴 선택 — 이벤트 순서·in-flight 해제 영향 확인

- `executeNode`(5551행~)는 `try` 블록 최초 줄에서
  `this.shutdownState.registerInFlight(nodeExecution.id, executionId)` 를 등록하고(5598행),
  함수 최하단 `finally`(5964~5966행)에서 `this.shutdownState.unregisterInFlight(nodeExecution.id)`
  로 해제한다. 이 `try/finally` 구조 자체는 이번 diff 의 변경 범위 밖(hunk 없음)이며 그대로다.
- 두 취소 분기 모두 `await this.markNodeCancelled(...)` 완료 후 `throw err;` 를 여전히 **호출부**
  (catch 블록)에서 직접 실행한다 — 헬퍼 내부에서 throw 하지 않는다. 즉 `await` 지점 수·control
  flow 상 `throw` 가 도달하는 시점이 추출 전(인라인 코드가 끝난 직후 `throw err;`)과 추출 후
  (`await markNodeCancelled(...)` 완료 직후 `throw err;`)에 **완전히 동일** — 둘 다 "필드 대입 →
  await save → await emit → throw" 순서를 그대로 유지한다.
- 따라서 `finally` 의 `unregisterInFlight` 가 실행되는 시점·순서(모든 필드 대입과 `NODE_CANCELLED`
  emit 이 완료된 뒤 예외가 상위로 전파되고, 그 예외 전파 과정에서 `finally` 가 실행됨)는 리팩터
  전후 불변이다. in-flight 등록 해제가 조기에 실행되거나 누락될 경로가 새로 생기지 않았다.
- 헬퍼가 예외를 던지지 않고 순수하게 상태 마킹·저장·emit 만 수행하도록 설계한 것(주석에 명시된
  의도)도 이 순서 불변성을 뒷받침한다 — 만약 헬퍼가 내부에서 throw 했다면 두 분기가 서로 다른
  원본 에러(`err` 그대로 vs 다른 값)를 던져야 하는 요구를 만족하지 못했을 것이나, 실제로는 그
  분기 결정을 그대로 호출부에 남겨 원본 에러 객체(`err`)가 정확히 그대로 재던져진다 — 스택
  트레이스·에러 identity 도 보존.

## 그 외 부작용 관점 점검

1. **의도치 않은 상태 변경** — `markNodeCancelled` 는 인자로 받은 `nodeExecution` 객체(참조)만
   변이하며, 이는 추출 전 인라인 코드가 하던 것과 동일한 객체·동일한 필드다. 새로운 전역/공유
   상태 변경 없음.
2. **전역 변수** — 신규 전역 변수 없음. `this.nodeExecutionRepository`, `this.eventEmitter` 는
   기존 인스턴스 필드 재사용.
3. **파일시스템** — 해당 없음.
4. **시그니처 변경** — `markNodeCancelled` 는 신규 `private` 메서드로, 기존에 호출자가 없었으므로
   "기존 시그니처 변경"에 해당하지 않는다. 정의 1곳 + 호출 2곳의 인자 순서(`nodeExecution, node,
   context, executionId, errorEnvelope?`)가 일관되게 사용됨을 확인(grep 3-hit 전수 확인).
5. **인터페이스 변경** — `private` 메서드이며 공개 API(HTTP/WS 계약)는 변경되지 않았다. WS
   `NODE_CANCELLED` 이벤트의 payload shape 은 위 (a)(b) 대조로 완전 보존 확인.
6. **환경 변수** — 관련 변경 없음.
7. **네트워크 호출** — 기존과 동일하게 DB `save`(TypeORM)와 내부 이벤트 emitter 호출만 있으며,
   외부 서비스 신규 호출 없음.
8. **이벤트/콜백** — `NODE_CANCELLED` emit 호출 횟수(분기당 정확히 1회)·인자·순서 모두 추출 전과
   동일. 위 "throw 위치" 절에서 in-flight 해제 콜백(`unregisterInFlight`) 실행 시점도 불변임을
   확인.

## 신규 결함 없음

6라운드째 누적 검증 결과, 이번 커밋(`410d913fe`)이 도입한 `markNodeCancelled` 추출에서 새로
발견된 부작용 결함은 없다. WS payload·DB 필드·이벤트 순서·in-flight 해제 시점 모두 추출 전후
동일함을 필드 단위로 확인했다.

## 요약

`markNodeCancelled` 헬퍼 추출은 순수한 코드 이동이다 — 두 취소 분기(`isAbortError`/
`ExecutionCancelledError`)가 헬퍼를 호출하는 방식으로 바뀌었을 뿐, 필드 대입 순서·`await` 지점·
DB 저장 필드·WS `NODE_CANCELLED` payload 의 키 집합과 키 순서·객체 참조 동일성이 추출 전후 완전히
동일하다. `errorEnvelope?` 조건부 인자와 `...(errorEnvelope ? {...} : {})` 조건부 spread 는 (a)
`isAbortError` 경로에서 원본과 동일한 키 순서·값을 재현하고, (b) `ExecutionCancelledError` 경로에서
`error` 키 자체를 만들지 않아 W15/W19 취지(내부 message 비노출)를 그대로 유지한다. `throw` 를
헬퍼가 아닌 호출부에 남긴 설계는 `executeNode` 의 `finally`(`unregisterInFlight`)가 실행되는
시점·순서에 아무런 영향을 주지 않는다 — await 완료 후 throw 하는 제어 흐름이 추출 전과 토큰
단위로 동일하기 때문이다. 새 전역 상태·파일시스템·환경 변수·네트워크 호출·공개 인터페이스
변경도 없다. 6라운드 누적 검증에서 이번 추출과 관련해 새로 지적할 부작용 결함은 없다.

## 위험도

NONE
