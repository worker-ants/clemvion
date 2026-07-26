# 보안(Security) 리뷰 — linear-cancel-mechanism (6R, markNodeCancelled 헬퍼 추출)

## 대상 및 방법

프롬프트(`_prompts/security.md`)의 diff-list 에는 직전 라운드들의 review 산출물(`.md`/`.json`)만
포함돼 있고 이번 라운드가 실제로 바꾼 소스 파일(`execution-engine.service.ts`)의 diff 는 누락돼
있었다(사전 경고된 브랜치 반복 현상). `git show HEAD` 로 커밋 `410d913fe`
(`refactor(engine): 5R W25 — 노드 취소 종결 중복을 markNodeCancelled 로 추출`)를 직접 열어
실제 변경분을 확인했다. 변경 파일은
`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 단일 파일이며,
private 헬퍼 `markNodeCancelled` 추출 + 두 호출부(`isAbortError` 분기, `ExecutionCancelledError`
분기) 치환뿐이다.

## 중점 검증: `ExecutionCancelledError` message(executionId 포함) 의 client 노출 차단이 추출 과정에서
## 깨지지 않았는가 (W9·W15·W16·W19 재발 여부)

**결론: 깨지지 않았다. 실제 코드로 확인.**

- 헬퍼 정의(`execution-engine.service.ts:4586`-`4611` 부근, `markNodeCancelled`):
  ```ts
  private async markNodeCancelled(
    nodeExecution: NodeExecution,
    node: Node,
    context: ExecutionContext,
    executionId: string,
    errorEnvelope?: { code: string; message: string },
  ): Promise<void> {
    nodeExecution.status = NodeExecutionStatus.CANCELLED;
    if (errorEnvelope) nodeExecution.error = errorEnvelope;        // :4594
    ...
    await this.eventEmitter.emitNode(executionId, node.id, NodeEventType.NODE_CANCELLED, {
      ...
      ...(errorEnvelope ? { error: errorEnvelope } : {}),          // :4607
      ...
    });
  }
  ```
  `errorEnvelope` 가 `undefined` 이면 (a) `nodeExecution.error` 대입 자체가 실행되지 않고(기존 값도
  건드리지 않음 — 아래 참고), (b) emit payload 조건부 spread 가 `error` 키를 아예 만들지 않는다.

- 호출부 1(`isAbortError`, `:5814`-`5827`): `errorEnvelope = { code: 'AbortError', message: err.message }`
  를 명시적으로 전달 — §5.1 계약(client 에 `output.error` 봉투를 보이는 것이 의도된 동작)과
  일치하며 기존 동작 그대로 보존.
- 호출부 2(`ExecutionCancelledError`, `:5854`-`5858`): `await this.markNodeCancelled(nodeExecution,
  node, context, executionId);` — **5번째 인자(`errorEnvelope`)를 넘기지 않는다.** 주석
  (`:5855`-`5857`)도 "이 sentinel 의 message 에는 executionId 가 들어 있어 client 로 나가면 안
  된다(W15/W19)"를 명시.
- `markNodeCancelled(` 호출부는 코드베이스 전체에서 정확히 이 2곳뿐임을 확인(`grep -n
  "markNodeCancelled("` → `:4586`(정의), `:5817`, `:5858`). 제3의 호출부나 누락된 인자 전달은 없다.
- **원본(추출 전) 동작과의 동치성**: `git show HEAD` 의 `-`(삭제) 블록을 대조한 결과, 추출 전
  `ExecutionCancelledError` 분기도 `nodeExecution.error` 를 전혀 대입하지 않았고 emit payload 에도
  `error` 키가 없었다 — 헬퍼가 재현하는 동작과 문자 그대로 동일하다(behavior-preserving refactor).
- **stale `.error` 잔존 가능성**: `nodeExecution` 은 같은 `executeNode` 함수 최상단
  (`:5563`, `createNodeExecution`)에서 매 노드 실행마다 새로 생성되는 row 이고, 이 catch 에 도달하기
  전 다른 지점에서 `nodeExecution.error` 를 먼저 설정하는 코드 경로는 없음을 확인(`grep -n
  "nodeExecution\.error"` 로 전체 대입 지점 확인 — 5873/5924/5938/6014 는 모두 이 catch 이후의 다른
  분기이거나 무관한 실행 경로). 따라서 헬퍼가 `errorEnvelope` 미대입 시에도 "지우지 않아서 새는" 이전
  값이 존재하지 않는다.
- **테스트로 재확인**: 기존 회귀 테스트 `execution-engine.service.spec.ts:5745`("Sub-Workflow(workflow)
  노드에서 ExecutionCancelledError 가 발생하면 FAILED 로 오분류하거나 NODE_FAILED 를 emit 하지 않는다
  (W15)")가 `JSON.stringify(cancelCall?.[3] ?? {})).not.toContain('cancelled externally')` 로 emit
  payload 전체에 sentinel message 문자열이 섞여 나오지 않음을 직접 단언한다. 이 테스트를 이 워크트리에서
  실행해 헬퍼 추출 후에도 통과함을 실측 확인했다:
  ```
  npx jest execution-engine.service.spec.ts -t "W15"
  Tests: 419 skipped, 1 passed, 420 total
  ```

즉 코드 읽기(구조적 확인) + 대상 회귀 테스트 실행(동적 확인) 두 층 모두에서 차단이 유지됨을 확인했다.

## 그 외 점검 관점 (인젝션/시크릿/인증/입력검증/암호화/에러노출/의존성)

- 이번 diff 는 순수 내부 리팩터(같은 클래스의 private 메서드 추출 + 호출부 치환)이며, 신규 외부 입력
  처리·신규 쿼리·신규 인증/인가 분기·신규 시크릿·신규 암호화 로직·신규 의존성을 도입하지 않는다.
  변경된 유일한 파일(`execution-engine.service.ts`)에서 SQL/커맨드/경로 인젉션, 하드코딩된 자격증명,
  평문 전송, 취약 해시 알고리즘에 해당하는 코드는 없다.
- 헬퍼가 받는 `errorEnvelope?: { code: string; message: string }` 는 명시적 optional 인자이자 두
  호출부 모두 컴파일 타임에 고정된 인자 개수로 호출되므로("boolean trap"이 아니라 선택적 위치 인자),
  호출부 실수로 의도치 않게 5번째 인자가 누락/추가될 위험은 타입 시스템이 이미 좁혀 준다(TS 컴파일
  성공 = 인자 형태 일치).
- `isAbortError` 분기가 `err.message` 를 그대로 client 노출 봉투에 싣는 것은 이 diff 가 만든 동작이
  아니라 §5.1 계약상 원래도 의도된 기존 동작(추출 전에도 동일)이므로 이번 라운드의 재검토 대상이
  아니다.

## 재론하지 않은 항목

이전 라운드에서 이미 해소 확인된 C1~C5·W1~W20(스로틀 누수, Parallel/`ForEach` 취소 우회 재throw,
background 경로 등)은 이번 diff 범위 밖이며 재검토하지 않았다. 이번 라운드가 유일하게 건드린 보안
관련 표면은 위에서 검증한 `markNodeCancelled` 추출 하나뿐이다.

## 요약

이번 커밋은 `execution-engine.service.ts` 안에서 두 취소 종결 분기(`isAbortError` /
`ExecutionCancelledError`)에 복제돼 있던 20여 줄을 `markNodeCancelled` private 헬퍼로 추출한
순수 리팩터다. 보안 관점에서 유일한 관심사는 W9·W15·W16·W19 가 4회에 걸쳐 고정한 "내부 sentinel
message(executionId 포함)를 client 로 내보내지 않는다" 불변식이 추출 과정에서 깨지지 않았는지였다.
`errorEnvelope` 를 선택 인자로 두고 `ExecutionCancelledError` 호출부만 이를 생략하는 구조,
조건부 필드 대입·조건부 스프레드로 `error` 키 자체를 만들지 않는 구현, 그리고 이를 직접 단언하는
기존 회귀 테스트(W15)가 실측으로 통과함을 확인해, 차단이 그대로 유지됐음을 코드와 테스트 양쪽에서
확인했다. 그 외 인젝션·시크릿·인증/인가·입력검증·암호화·에러노출·의존성 관점에서 이번 diff 가 새로
도입한 위험은 없다. 신규 결함 없음.

## 위험도

NONE
