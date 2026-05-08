# Spec: Background

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md)

하위 노드 그룹을 백그라운드로 실행 (메인 흐름 비블로킹).

> **✅ 구현 상태 — 구현 완료**: `backend/src/nodes/logic/background/`에 컴포넌트 등록, `BackgroundHandler` 핸들러, `BACKGROUND_EXECUTION_QUEUE` BullMQ 큐 + `BackgroundExecutionProcessor` 워커, `ExecutionEngineService.scheduleBackgroundBody()` / `executeBackgroundSubgraph()` 통합이 모두 완료되었다.

---

## 1. 설계 결정 (구현 채택)

다른 컨테이너(Loop/ForEach/Map)와 다르게 **`containerId` 멤버십 패턴을 쓰지 않는다**. 대신 `background` 출력 포트의 엣지로 연결된 노드들을 본문 진입점으로 보고, 거기서 forward-reachable한 노드 집합을 본문 서브그래프로 간주한다. 본문은 **enqueue 시점의 컨텍스트 스냅샷**을 가지고 실행되며, 본문 결과는 메인으로 돌아오지 않는다(fire-and-forget).

## 2. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| notes | String | 본문 작업의 목적·주의사항 메모. 동작에는 영향 없음. |
| notifyOnFailure | Boolean | 본문 실패 시 워크스페이스 Admin에게 인앱 알림. 기본 `false`. |
| maxDurationMs | Integer | 본문 최대 실행 시간(밀리초). `0`이면 무제한. 기본 `300000` (5분). |

## 3. 포트
- 입력: `in` (1개)
- 출력: `main` (즉시 진행), `background` (백그라운드 본문)

## 4. 실행 로직
1. 핸들러는 입력을 `main` 포트로 즉시 통과시킨다(워크플로우 메인 흐름은 곧바로 다음 노드로 진행).
2. 핸들러 실행 직후 `ExecutionEngineService.scheduleBackgroundBody()`가 다음을 enqueue한다:
   - `background` 포트 엣지의 target 노드 ID 배열 (본문 진입점)
   - `context.variables`, `context.nodeOutputCache`, `context.expressionContext`의 **얕은 복사 스냅샷**
   - 메인 입력 (snapshot)
   - `notifyOnFailure`, `maxDurationMs`
3. `BackgroundExecutionProcessor` 워커가 BullMQ에서 job을 pop하면 `executeBackgroundSubgraph(job)`이 다음을 수행한다:
   - 새 ExecutionContext를 생성하고 스냅샷으로 채운다
   - `executeInline(workflowId, input, { entryNodeIds, ... })`을 호출해 진입점에서부터 forward-reachable한 노드만 실행
   - `maxDurationMs > 0`이면 `Promise.race`로 타임아웃 적용
4. 본문에서 노드 단위 NodeExecution 레코드는 정상적으로 생성되며 `parentNodeExecutionId`가 Background 노드 자체의 NodeExecution ID로 stamp된다 → 타임라인에서 Background 그룹 아래에 표시.
5. 본문 실패는 메인 Execution status에 영향을 주지 않는다. `notifyOnFailure: true`이면 워크스페이스 Admin들에게 `type: background_failure` 인앱 알림 발송.
6. 서버 재시작 시 큐에 남아있던 작업은 BullMQ 기본 정책으로 retry된다. 컨텍스트가 사라진 상황에서는 본문이 실패할 수 있으므로 본문 측 멱등성을 권장.

## 5. 격리

- **Variables/cache 분리**: enqueue 후 메인이 `context.variables`를 바꿔도 본문에는 반영되지 않는다(스냅샷 참조). 본문 안에서의 변수 변화도 메인으로 돌아오지 않는다.
- **에러 격리**: 본문 실패 → 메인은 영향 없음.
- **결과 비반환**: 본문 마지막 노드의 출력은 메인 흐름으로 흐르지 않는다.

## 6. 컨테이너 렌더링

Background 노드는 다른 컨테이너 노드와 달리 멤버십 모델(`containerId`)을 쓰지 않으므로, 캔버스에서는 **일반 다중 출력 포트 노드**로 렌더링되며 `background` 포트에서 본문 진입점으로 명시적인 엣지를 끌어 연결한다.
