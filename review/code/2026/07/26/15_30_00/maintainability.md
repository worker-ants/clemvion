# 유지보수성(Maintainability) Review — linear-cancel-mechanism (5R)

## 스코프 노트 (선행 확인)

본 라운드 프롬프트에 첨부된 "리뷰 대상 파일" 24건은 전부 `review/code/2026/07/26/{13_47_42,14_45_30}/*`
(직전 두 라운드의 리뷰 산출물 md/json)이며, 실제 소스 diff(`execution-engine.service.ts`,
`execution-engine.service.spec.ts`, `CHANGELOG.md`)는 프롬프트 payload 에 포함돼 있지 않다.
`git log`/`git show 0f4047426`으로 대조한 결과, 커밋 `0f4047426`("fix(engine): 4R W19·W20")이
4R(`14_45_30`) 리뷰 문서와 실제 코드 수정을 **한 커밋에 함께** 담았는데, 이번 라운드(5R) 프롬프트
빌더가 그 diff 를 review 문서 쪽만 반영하고 코드 hunk 는 라우팅에서 누락한 것으로 보인다(4R
maintainability.md 가 스스로 기록한 것과 같은 "harness diff-base 스코프 갭"의 반복). 오케스트레이터가
직접 지시한 점검 대상(`executeNode` 의 취소 분기 중복)이 정확히 이 누락된 코드 변경분이므로,
`Read`/`Grep`으로 현재 워크트리의 실제 소스(`git show HEAD` 스냅샷과 동일함을 `git status --short`
로 확인)를 직접 열어 검증했다.

## 지시 대응 — `executeNode` 취소 분기 중복이 헬퍼 추출 임계에 도달했는가

**결론: 도달했다.** WARNING 으로 기록한다.

### 근거

`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `executeNode` catch
블록(`:5761`~) 안에 인접한 두 분기:

- `isAbortError(err)` 분기 — `:5768`~`:5796` (29줄)
- `err instanceof ExecutionCancelledError` 분기 — `:5822`~`:5845` (24줄, 커밋 `0f4047426`, W19 로 신설)

두 블록은 로직이 사실상 동일하다:

| 단계 | isAbortError (`:5771`~`:5795`) | ExecutionCancelledError (`:5823`~`:5844`) |
| --- | --- | --- |
| status 대입 | `nodeExecution.status = CANCELLED` (`:5772`) | 동일 (`:5823`) |
| error 필드 | `nodeExecution.error = errorEnvelope`(`:5773`, `{code:'AbortError', message: err.message}`) | **없음** (W15 취지 유지 — 내부 message 비노출) |
| finishedAt/durationMs | `:5774`~`:5777` | `:5824`~`:5827` — 4줄 모두 토큰 단위로 동일 |
| save | `await this.nodeExecutionRepository.save(nodeExecution)` (`:5778`) | 동일 (`:5828`) |
| emit | `emitNode(executionId, node.id, NODE_CANCELLED, {...})` (`:5779`~`:5794`, 9 필드) | 동일 호출 형태(`:5829`~`:5843`, 8 필드 — `error` 필드만 빠짐) |
| throw | `throw err;` (`:5795`) | 동일 (`:5844`) |

차이는 **`error` 봉투 유무 하나**(값 1개)이고, 나머지 필드 대입·save·emit 배선(약 20줄)은 문자
그대로 복제돼 있다. 이는 4R `maintainability.md`(`review/code/2026/07/26/14_45_30/maintainability.md`
§1)가 "헬퍼 추출 불필요"로 판정했던 6곳의 `if (err instanceof X) { throw err; }` 2줄 idiom 과는
질적으로 다른 사안이다 — 그 판단은 "2줄짜리 최소 가드는 정보가 주석에 있어 추출해도 순 이득이
없다"는 논거였는데, 여기서 새로 생긴 20여 줄 블록은 최소 가드가 아니라 필드 대입 4개 + 비동기
save 1개 + 비동기 emit(8~9 필드) 1개로 구성된 실질 로직이다. 오히려 같은 파일에서 이미 **동일한
모양의 중복**(Execution-레벨 취소 종결 8줄이 `runExecution`/`finalizeResumedExecutionOutcome` 양쪽에
복제됐던 문제)을 `finalizeCancelledExecution` 헬퍼(`:4571`~`:4584`)로 추출해 해소한 전례(W12,
JSDoc `:4568`~`:4569`가 "이 한 값 차이 때문에 8줄 블록이 손으로 복제됐다"고 명시)가 있다 — 지금의
`executeNode` 두 분기는 그 W12 패턴이 NodeExecution 레벨에서 그대로 재발한 형태로 읽힌다.

### 제안

`finalizeCancelledExecution`과 동일한 관용구로 사설(private) 헬퍼를 추출한다. 예:

```ts
private async markNodeCancelled(
  nodeExecution: NodeExecution,
  context: { parentNodeExecutionId?: string },
  node: WorkflowNode,
  executionId: string,
  errorEnvelope?: { code: string; message: string },
): Promise<void> {
  nodeExecution.status = NodeExecutionStatus.CANCELLED;
  if (errorEnvelope) nodeExecution.error = errorEnvelope;
  nodeExecution.finishedAt = new Date();
  nodeExecution.durationMs =
    nodeExecution.finishedAt.getTime() - nodeExecution.startedAt.getTime();
  await this.nodeExecutionRepository.save(nodeExecution);
  await this.eventEmitter.emitNode(executionId, node.id, NodeEventType.NODE_CANCELLED, {
    nodeExecutionId: nodeExecution.id,
    parentNodeExecutionId: context.parentNodeExecutionId,
    status: NodeExecutionStatus.CANCELLED,
    ...(errorEnvelope ? { error: errorEnvelope } : {}),
    nodeType: node.type,
    nodeLabel: node.label ?? node.type,
    input: nodeExecution.inputData,
    startedAt: nodeExecution.startedAt?.toISOString?.(),
    finishedAt: nodeExecution.finishedAt?.toISOString?.(),
  });
}
```

호출부는 `await this.markNodeCancelled(nodeExecution, context, node, executionId, errorEnvelope); throw err;`
(isAbortError, `errorEnvelope` 전달) / `await this.markNodeCancelled(nodeExecution, context, node, executionId); throw err;`
(ExecutionCancelledError, 인자 생략)로 좁힐 수 있다 — `finalizeCancelledExecution`이 호출자에게 `throw`
자체는 맡기는 것과 동일한 분업이라 코드베이스 관용구와도 일관된다. 필수 차단 사유는 아니다(현재도
두 분기 모두 독립적으로 mutation 회귀 테스트가 있어 "조용한 drift" 위험은 낮음, 4R testing.md 확인) —
다만 세 번째 유사 분기가 또 생기기 전에 지금 추출해 두는 편이 W12 가 이미 증명한 저비용·고효율
정리다.

## 재확인 — 4R `maintainability.md` 가 낸 WARNING 은 같은 커밋에서 해소됨 (재론 아님, 확인만)

4R `maintainability.md`(§2)가 지적한 `containerCancelCheckedAtMs` 필드 JSDoc(`:536`~) 이 실제
정리 지점 2곳만 나열해 stale 하다는 WARNING은, 같은 커밋 `0f4047426`이 JSDoc 을 "3곳(`finalizeRehydrationCleanup`,
`runExecution` catch/finally, `executeBackgroundSubgraph` finally)"으로 갱신해 해소했음을 `git show
0f4047426 -- .../execution-engine.service.ts`로 확인했다(§5→§2.2 인용 정정도 동일 커밋에서 함께
반영됨). 새로 지적할 사항 없음 — 지시대로 재론하지 않는다.

## 발견사항

- **[WARNING]** `executeNode`의 `isAbortError`/`ExecutionCancelledError` 두 취소 분기가 ~20줄 규모로
  거의 동일한 로직(상태 대입·finishedAt/durationMs 계산·save·emit)을 복제하고 있다 — 헬퍼 추출 임계
  도달
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5768`-`:5796`
    (`isAbortError` 분기), `:5822`-`:5845` (`ExecutionCancelledError` 분기, 커밋 `0f4047426`/W19 로 신설)
  - 상세: 위 "근거" 절 참조. 차이는 `error` 봉투 유무 하나뿐이고 나머지 필드 대입·save·emit 배선은
    문자 그대로 복제됐다. 같은 파일이 동일 모양의 중복(Execution 레벨, W12)을
    `finalizeCancelledExecution` 헬퍼로 추출해 해소한 전례가 있어, 이 신규 중복도 같은 패턴을
    따르는 것이 일관성 있다.
  - 제안: 위 "제안" 절의 `markNodeCancelled(nodeExecution, context, node, executionId,
    errorEnvelope?)` 형태로 공용 헬퍼를 추출. `finalizeCancelledExecution`처럼 `throw`는 호출자에게
    남겨 두는 분업을 유지.

## 요약

이번 라운드 프롬프트 payload 에는 실제 코드 diff 가 라우팅되지 않았으나(harness diff-base 스코프
갭, 4R 에서도 동일 현상 발생), 오케스트레이터가 직접 지시한 점검 대상인 `executeNode`의 취소 분기
중복은 현재 워크트리 소스를 직접 열어 확인했다. `isAbortError` 분기와 신규 `ExecutionCancelledError`
분기(W19, 커밋 `0f4047426`)는 `error` 봉투 유무 한 값만 다르고 나머지 ~20줄(상태 마킹·finishedAt/
durationMs·save·emit)이 문자 그대로 복제돼 있어, 4R 이 "추출 불필요"로 판정했던 6곳의 2줄
재throw idiom과는 질적으로 다른 규모의 중복이다. 같은 파일이 이미 동일한 모양의 중복을
`finalizeCancelledExecution`(W12) 헬퍼로 해소한 전례가 있으므로, 이번에도 같은 패턴의 헬퍼 추출을
WARNING 으로 권장한다. 4R 이 낸 JSDoc stale WARNING(`containerCancelCheckedAtMs` 정리 지점 서술)은
같은 커밋에서 이미 해소됐음을 확인했다(재론 아님). 그 외 C1~C5·W1~W18 은 지시에 따라 재검토하지
않았다.

## 위험도

MEDIUM
