# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 방법 메모

`_prompts/cross_spec.md` 페이로드는 컨텍스트 예산 초과로 정작 이번 변경의 핵심 파일인
`spec/5-system/4-execution-engine.md` 본문을 포함하지 않았다(§⚠️ 생략 파일 18개 목록에
명시). 페이로드 대신 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/retry-atomic-claim-4d9e77`)를
절대경로로 직접 읽고 `git diff origin/main..HEAD`로 실제 변경분을 확인했다.

**이번 PR 의 spec 변경 범위**: `spec/5-system/4-execution-engine.md`(+78/-6),
`spec/4-nodes/3-ai/1-ai-agent.md`(+6), `spec/5-system/6-websocket-protocol.md`(+1/-1) 3개
파일뿐이다. 핵심 내용은 (1) Execution 상태 전이표에 신규 opt-in 전이
`failed → waiting_for_input`(`reparkAiResumeTurn`, multi-turn 재진입 turn 이 대화를
끝내지 않고 계속되는 경우 re-park) 추가, (2) `retry_last_turn` spawn row 에 대한 2차
원자 claim(`claimSpawnedRetryRow`, `inputData._retryState` 조건부 UPDATE) Rationale 신설.
코드(`state-machine.ts`, `retry-turn.service.ts`, `ai-turn-orchestrator.service.ts`)를
대조한 결과 이 서술은 실제 구현과 정확히 일치한다(이번 세션의 다회 ai-review 라운드에서
이미 CRITICAL 로 발견·수정된 사안). 아래 발견사항은 이 변경이 **다른 spec 영역**에
완전히 전파되지 않은 지점들이다 — target 자체나 코드의 결함이 아니라 target 과 함께
갱신됐어야 할 타 영역 문서의 드리프트다.

## 발견사항

### [WARNING] `data-flow/3-execution.md` 의 Execution 상태 다이어그램이 신규 `failed → waiting_for_input` 전이를 누락

- **target 위치**: `spec/5-system/4-execution-engine.md` §1.1 전이표 신규 행
  (`| failed | waiting_for_input | ... reparkAiResumeTurn ... |`) + §7.5 인접 신설
  Rationale "retry 재진입의 원자 claim — spawn 단계 원자성만으로는 불충분하다"
- **충돌 대상**: `spec/data-flow/3-execution.md` §3.1 `execution.status` Mermaid
  `stateDiagram-v2` (라인 241–258) 및 그 아래 설명 문단(라인 269)
- **상세**: target 은 이번 라운드에 `failed --(opt-in `allowRetryReentry`)--> waiting_for_input`
  전이를 신설했고, 본문에서 이를 "multi-turn 재진입에서 **가장 흔한 경로**"라고 명시한다
  (수정 전에는 이 전이가 없어 매 호출 `assertTransition` 이 동기 throw 하던 CRITICAL 결함이었다).
  반면 `data-flow/3-execution.md` §3.1 은 스스로 "상세 가드는
  `spec/5-system/4-execution-engine.md §1` 및 `state-machine.ts`(`ALLOWED_TRANSITIONS`)"를
  따른다고 명시하면서 `failed --> running: execution.retry_last_turn 재진입 (opt-in
  allowRetryReentry — 표 밖 전이)` 단 하나의 edge 만 그린다. `state-machine.ts` 를 직접
  확인하면(`ALLOWED_TRANSITIONS[FAILED] = []`, `canTransition` 의 `allowRetryReentry`
  분기가 `RUNNING`/`WAITING_FOR_INPUT` 둘 다 허용) 코드 자체는 이미 두 목적지를 모두
  갖고 있다 — 즉 이 다이어그램은 코드·target 스펙 대비 **불완전**하다. 이 다이어그램만
  참조하는 독자는 `failed` 이후 유일한 비-종결 경로가 `running` 뿐이라고 오인해, 실제로는
  더 흔한 re-park 분기(그리고 그 갈래가 코드에서 얼마나 최근에 고쳐진 CRITICAL 이었는지)를
  놓친다. (같은 파일 §3.3 의 `recoverStuckExecutions` 서술은 `status='running'` 범위로만
  한정돼 있어 target 의 새 Rationale — "discard 된 spawn row 는 부모 Execution 이 이미
  `failed`(terminal)라 이 백스톱 대상이 아니다" — 과 모순은 없다. 문제는 §3.1 다이어그램
  단독.)
- **제안**: `data-flow/3-execution.md` §3.1 다이어그램에
  `failed --> waiting_for_input: reparkAiResumeTurn 재진입 turn 계속 (opt-in allowRetryReentry)`
  edge 를 추가하고, 라인 269 설명 문단에 "`failed → waiting_for_input` 도 동일하게 일반
  표에 없고 `allowRetryReentry` opt-in 전용" 문구를 병기.

### [WARNING] AI Agent 노드 스펙 §7.9 "재진입 종결 후 graph 진행" 서술이 같은 문서 §12.8·target 대비 stale

- **target 위치**: 이번 커밋에서 `spec/4-nodes/3-ai/1-ai-agent.md` §12.8 상단에 신설된
  콜아웃 — "재진입 turn 이 계속되는 경우: 아래 서술은 재진입 turn 이 **종결**되는
  경우다. turn 이 대화를 끝내지 않으면(multi-turn 에서 가장 흔함) downstream graph
  진행이 아니라 `waiting_for_input` 으로 **re-park**..." (실행 엔진 §1.1 링크)
- **충돌 대상**: 같은 파일 `spec/4-nodes/3-ai/1-ai-agent.md` §7.9 "재진입 종결 후 graph
  진행" 단락(라인 989) — 이번 PR 에서 갱신되지 않음
- **상세**: §7.9 의 해당 단락은 "재진입한 turn 이 성공 종결되면... downstream 노드로
  그래프 진행" / "재진입 turn 이 다시 실패하면... FAILED" 두 갈래만 서술하고 "즉 retry 는
  '마지막 LLM 호출 재진입'까지가 단위이고, 그 결과의 downstream 처리·종결 정책은 일반
  노드의 그것과 같다"로 마무리해 이분법적 완결성을 암시한다. 그러나 target 이 이번에
  §12.8 서두에 명시한 바로는 실제로는 세 번째 갈래(재-park, "가장 흔한" 경로)가 있고
  그 경우 §7.9/§12.8 이 서술하는 종결(성공/실패) 시나리오 자체가 적용되지 않는다. §12.8
  에는 이 예외 콜아웃이 붙었지만 거의 동일한 주제를 다루는 §7.9 에는 붙지 않아, 같은
  문서 안에서 두 절이 서로 다른 완결성을 주장한다. §7.9 는 `spec/2-navigation/14-execution-history.md`,
  `spec/3-workflow-editor/3-execution.md`, `spec/conventions/node-output.md`,
  `spec/conventions/conversation-thread.md` 등 6개 타 spec 파일이 직접 앵커 링크로
  인용하는 절이다 — 다만 그 인용들은 대부분 "실패 시에도 outputData 가 영속된다"는
  JSON-shape/영속성 서술을 참조하는 것이라 이번 gap 의 직접 파급은 제한적이다. 그러나
  §7.9 자체를 처음부터 읽는 독자에게는 여전히 오도 소지가 있다.
- **제안**: §7.9 "재진입 종결 후 graph 진행" 단락 앞에 §12.8 과 동일한 "재진입 turn 이
  계속되는 경우" 콜아웃(또는 최소한 §12.8/실행 엔진 §1.1 로의 명시적 포인터)을 추가해
  두 절을 동기화.

### [INFO] `_retryState` 키 리터럴이 `NodeExecution.outputData`(원본 row) 와 `inputData`(spawn row) 양쪽에서 재사용되지만 필드 레지스트리 문서는 후자를 모른다

- **target 위치**: `spec/5-system/4-execution-engine.md` 신설 §Rationale "retry 재진입의
  원자 claim" — `UPDATE node_execution SET input_data = input_data - '_retryState' WHERE
  id = :id AND status = 'running' AND jsonb_exists(input_data, '_retryState')`
- **충돌 대상**: `spec/conventions/node-output.md` §4.2.1 "보존 예외" 표 — `_retryState` →
  `NodeExecution.outputData._retryState` (DB JSONB) 로만 규정
- **상세**: node-output.md 는 `_retryState` 가 사는 유일한 DB 위치를 `NodeExecution.outputData`
  라고 못박아 두었다(핸들러가 반환하는 `NodeHandlerOutput` 의 internal 필드 보존 계약).
  target 은 이번에 **spawn 된 새 row 의 `inputData`** 컬럼에도 동일한 문자열 키
  (`_retryState`)를 2차 delivery-claim 마커 용도로 재사용하는 메커니즘을 신설했다 —
  개념적으로는 별개 계층(엔진 내부 claim 트래킹 vs 핸들러 출력 보존 계약)이고, 코드
  (`retry-turn.service.ts` 의 `RETRY_STATE_KEY` 단일 상수 + 상세 JSDoc, 최근 ai-review
  라운드에서 이미 리터럴 drift 위험을 지적받고 고정됨)도 이를 의식적으로 관리하므로
  실질적 혼선 위험은 낮다. 다만 필드 레지스트리 문서 관점에서는 "`_retryState` 는
  `outputData` 에만 존재"라는 종전 단언이 더 이상 완전하지 않다.
- **제안** (낮은 우선순위): node-output.md §4.2.1 표에 각주 한 줄로 "spawn 된 재진입
  row 의 `inputData._retryState` 는 별개 용도(2차 delivery claim) — [실행 엔진
  §Rationale](../5-system/4-execution-engine.md#rationale)" 를 병기해 동기화하거나,
  won't-do 로 명시적으로 defer.

## 그 외 확인했으나 충돌 없음으로 판정한 항목

- `spec/5-system/14-external-interaction-api.md` (EIA-IN-02: `retry_last_turn` 은
  외부 미노출) — 이번 변경은 `retry_last_turn` 내부 재진입의 세부 동작만 바꿨을 뿐
  외부 노출 여부·명령 목록에는 영향 없음. 충돌 없음.
- `spec/5-system/13-replay-rerun.md` §14.3 / §Rationale "`execution.retry_last_turn`
  과의 경계" — "성공 시 downstream 진행" 서술이되 이를 유일한 결과로 단언하지 않아
  이번 재-park 갈래 신설과 모순되지 않음.
- `spec/3-workflow-editor/3-execution.md` §10.8 "Multi Turn 재시도 클릭" 행 — "새
  `ai_assistant` turn 수신 시... 입력 영역 일반 textarea 로 복귀" 서술이 이미 재-park
  결과(다음 입력 대기 상태)를 포괄하는 표현이라 별도 갱신 불필요.
- `spec/conventions/node-cancellation.md` "park↔resume 짝 전이 terminal 가드" /
  "retry 재진입 종결 경로 terminal 가드" — 신규 `failed → waiting_for_input` 전이도
  동일한 공용 `updateExecutionStatus`/`assertLinkedTransitionApplied` 경로(코드 확인:
  `ai-turn-orchestrator.service.ts` `reparkAiResumeTurn`)를 타므로 이 문서의 일반화된
  서술이 이미 커버한다. 갱신 불필요.
- `spec/1-data-model.md` §2.13 Execution `status` enum — 값 목록 자체(열거값)는
  변경 없음(신규 값이 아니라 기존 값 사이 새 edge). 충돌 없음.
- 데이터 모델·API 계약·요구사항 ID·RBAC·계층 책임(criteria 1·2·3·5·6) 관점에서는
  이번 변경이 새 엔티티/필드/엔드포인트/요구사항 ID/권한 구조/모듈 경계를 도입하지
  않으므로 별도 발견사항 없음. `RetryTurnService` 로의 책임 분리는
  `spec/data-flow/3-execution.md` 라인 176 의 기존 "C-1 god-class strangler-fig 분할"
  서술과 이미 일치한다(이번 PR 이전에 반영됨).

## 요약

이번 PR 의 spec 변경(실행 엔진 §1.1 신규 전이 `failed → waiting_for_input` + retry
2차 원자 claim Rationale)은 함께 수정된 3개 파일(`4-execution-engine.md`,
`1-ai-agent.md` §12.8, `6-websocket-protocol.md` §4.2) 사이에서는 상호 일치하고,
코드(`state-machine.ts`/`retry-turn.service.ts`)와도 정확히 대응한다 — 이 축에서는
CRITICAL 급 불일치가 없다. 다만 같은 도메인 상태 머신을 기술하는 **다른 두 위치**가
이번 PR 범위 밖에 남아 stale 해졌다: (1) `data-flow/3-execution.md` 의
`ALLOWED_TRANSITIONS` 기반 Mermaid 다이어그램이 신규 edge 를 누락했고, (2) 같은
AI Agent 문서 안에서도 §7.9 가 §12.8 의 새 예외 콜아웃을 반영하지 못했다. 둘 다
서술형/파생 요약 문서이며 런타임 동작에 관여하지 않으므로 즉시 작동 불가를 유발하지는
않지만, "상태 전이가 영역마다 다르게 기술" 되는 criterion 4 에 정확히 해당하는 실질
드리프트이므로 병합 전 동기화를 권고한다. 부가적으로 `_retryState` 키 리터럴이 두
컬럼(outputData/inputData)에서 재사용되는 점은 코드 차원에서는 이미 관리되고 있어
INFO 수준으로만 남긴다.

## 위험도

LOW
