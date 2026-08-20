# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-prep)

## 방법

target 스코프(`spec/5-system/`, 특히 `6-websocket-protocol.md`·`13-replay-rerun.md`·`14-external-interaction-api.md` §R17·`1-data-model.md` §2.13/§2.14·`12-webhook.md` §5.3)가 최근 도입한 **`Execution.inputData` egress 값-마스킹 + 프런트 마커 가드(2026-08-16~20)** 정책을 축으로, 프롬프트 번들에 포함된 "관련 spec 본문"(데이터 모델·워크플로 에디터 실행 spec 등)과 대조했다. 번들이 예산 초과로 생략한 `spec/5-system/4-execution-engine.md` 등 12개 파일과, 인용된 코드 경로(`execution-engine.service.ts`, `use-execution-events.ts`, `execution-store.ts`)는 저장소에서 직접 `Read`/`grep`/`git blame` 으로 실측했다. 직전 두 차례 리뷰(`12_29_59`, `12_41_29`)가 이미 "7개 미러 파일"을 전수 검증했으므로, 그 스코프 **밖**에 있는 `Execution.inputData` 관련 서술을 추가로 훑었다.

## 발견사항

### [WARNING] `3-execution.md` "inputData 데이터 흐름" 절이 target 의 WS `input` 마스킹 전제와 정반대로 서술 — 최신 코드로도 반증됨

- **target 위치**: `spec/5-system/6-websocket-protocol.md:193`("`output`/`input`(node.completed)" 값-패턴 마스킹 예시), `:200`("`input` 마스킹은 REST 노드 레벨과 일치한다" — emit payload 의 `input` 과 REST `nodeExecutions[].inputData` 가 **같은 프런트 store 슬롯**(`nodeResults[].inputData`)에 들어간다는 전제), `spec/5-system/14-external-interaction-api.md:1631` 이하 "`input`/`inputData` 의 마스킹 여부는 '레벨'이 가른다" 표(`WS node 이벤트 input (emit) | 함`)
- **충돌 대상**: `spec/3-workflow-editor/3-execution.md:541-544` "inputData 데이터 흐름" —
  ```
  - WebSocket 이벤트에는 inputData가 포함되지 않음
  - REST 폴링(2초 간격)을 통해 inputData가 NodeResult에 반영됨
  - 늦게 도착하는 WS 이벤트가 이미 수신된 inputData를 덮어쓰지 않도록 머지 시 보존
  ```
  같은 파일 `:530`(§10.6.1 "Input" 탭 행)도 "폴링으로 데이터 수신 전에는 'Loading...' 표시"라고 같은 전제를 반복한다.
- **상세**: target 은 `execution.node.completed`(및 `node.started`) WS emit payload 가 `input` 필드를 실어 REST `nodeExecutions[].inputData` 와 **동일한 프런트 store 슬롯**(`nodeResults[].inputData`)으로 들어간다고 명시하고, 바로 그 사실 때문에 "REST 만 가리고 WS 는 원문이면 2초 폴링이 마스킹 값을 덮는 flip-flop" 이라는 §R17 "잔여 ②" 처방의 핵심 근거를 세운다(EIA §R17 `Execution.inputData` 카브아웃 종결 문단, `websocket-protocol.md §4.1`). 그런데 `3-execution.md`(다른 영역·워크플로 에디터)는 정확히 그 반대 — "WS 이벤트에는 inputData 가 아예 없고 REST 만 채운다" — 를 단정한다. 실측 결과 이 두 문서는 **같은 런타임을 놓고 모순**된다:
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6112-6124` 의 `NODE_COMPLETED` emit 이 `input: nodeExecution.inputData` 를 payload 에 명시적으로 담는다(`git log -S "input: nodeExecution.inputData"` → 도입 커밋 `9842edeb`, 2026-06-03 이전부터 존재).
  - 프런트 `codebase/frontend/src/lib/websocket/use-execution-events.ts:744`(`handleNodeStarted`)·`:794`(`handleNodeCompleted`) 가 `payload.input` 을 읽어 `addNodeResult({ inputData: payload.input, ... })` 로 store 에 반영한다.
  - `codebase/frontend/src/lib/stores/execution-store.ts:644` 의 REST 병합 로직(`inputData: result.inputData ?? prev.inputData`)은 WS 가 먼저 채운 값을 REST 응답이 있으면 **덮어쓴다** — 이는 target 이 우려하는 flip-flop 시나리오를 문자 그대로 재현하는 코드다.
  - `spec/3-workflow-editor/3-execution.md:541` 의 서술은 `git blame` 상 2026-04-09 작성이며, WS `input` 필드 도입(2026-06-03 이전)보다 시점상 앞서거나 최소한 그 이후 한 번도 갱신되지 않은 채 남아 있다.
  - 이 파일은 target 이 이미 §10.2/§R17 SoT 로 인용하는 문서(`[에디터 실행 §2.2]`, 데이터 모델 §2.13)와 **동일 파일**이지만, "inputData 데이터 흐름" 절은 target 의 미러 목록(§2.13/§2.14·webhook §5.3·ws-protocol §4.1·replay-rerun §10.2·EIA §R17·background §8.2·**execution.md §2.2** 7곳)에 포함되지 않은 **별개 절**(§10.6 "상세 뷰" 하위, 노드별 Input/Output 탭 설명)이라 직전 두 리뷰의 "7개 미러 전수 확인" 범위 밖에 있었다.
- **왜 문제인가**: 이 문서를 그대로 두면 향후 독자·구현자가 "WS 는 애초에 inputData 를 안 실어 나르니 node-level WS `input` 마스킹은 불필요하다"고 오판할 수 있다 — 그러나 실제로는 이미 마스킹이 걸려 있고(§R17 결정 2026-08-16/17), 그 마스킹의 존재 이유 자체가 "WS 가 값을 실어 나르기 때문"이다. 즉 이 문서 하나가 방금 세운 보안 결정의 배경 서사와 정반대의 사실을 주장하는 채로 남는다.
- **제안**: `spec/3-workflow-editor/3-execution.md` "inputData 데이터 흐름" 절(및 §10.6.1 Input 탭 행의 "폴링" 서술)을 현재 구현에 맞춰 정정 — "`execution.node.started`/`execution.node.completed` WS emit 이 `input` 필드로 inputData 를 실어 나르고(값-패턴 마스킹 적용, [WS §4.1](../5-system/6-websocket-protocol.md#41-실행-이벤트-server--client)), REST 폴링(2초)이 같은 `nodeResults[].inputData` 슬롯을 후행 갱신한다"는 취지로 갱신하고 §R17/WS §4.1 을 SoT 로 상호 링크할 것. 이 작업(`eia-inputdata-marker-guard`)의 스코프에 포함해 함께 갱신하는 편이 "부분 미러" 재발을 막는다(이 저장소가 이미 `23_49_05`·`01_17_49`에서 같은 패턴의 실패를 두 번 겪었다는 이력이 target 자신의 Rationale 에 기록돼 있다).

### [INFO] "폼 프리필(`DynamicFormUI`) 마커 가드" 가 EIA §R17 카탈로그에만 등재되고 폼 UI 오너 spec 에는 미러가 없음

- **target 위치**: `spec/5-system/14-external-interaction-api.md:1569` (`§R17` "닫는 조건" 표, "폼 프리필(`DynamicFormUI`) | 마커면 프리필 스킵 + 재입력 안내 | 2026-08-17" 행)
- **충돌 대상**: `spec/4-nodes/6-presentation/4-form.md`, `spec/4-nodes/6-presentation/0-common.md` (DynamicFormUI 렌더링 규약의 실제 오너 spec)
- **상세**: 같은 표의 나머지 두 행("Re-run 모달"·"에디터 히스토리 로드")은 각각 `13-replay-rerun.md §10.2`, `3-execution.md §2.2` 에 미러 서술이 있어(이번 draft 가 그 두 곳을 직접 갱신했다) 표와 실제 UI 오너 spec 이 상호 링크된다. 그러나 "폼 프리필" 행은 대응하는 서술이 form 노드/Presentation 공통 spec 쪽에 없다 — grep 결과 `DynamicFormUI` 는 여러 곳에서 언급되지만 "마커 감지 시 프리필 스킵" 동작을 서술하는 곳은 없다. 데이터 모델·API 계약 충돌은 아니지만, "표에는 있는데 UI 오너 문서엔 없는" 비대칭이 이 문서군이 반복 겪은 "부분 미러" 패턴과 같은 모양이다.
- **제안**: `4-form.md` 또는 `0-common.md` 의 필드 렌더링/기본값 절에 "필드 defaultValue 가 마스킹 마커([EIA §R17])면 프리필하지 않고 재입력 안내" 한 줄을 추가하거나, 최소한 §R17 표에서 이 폼 프리필 가드의 SoT 위치가 "presentation 공통 spec 미기재, §R17 이 유일한 SoT"임을 명시할 것 (선택 사항 — CRITICAL/WARNING 은 아님).

### 그 외 관점 — 충돌 없음 확인

- **API 계약**: `POST /api/executions/:executionId/re-run` §8.1, EIA REST 5종 엔드포인트, WS `subscribe`/continuation 8종 핸들러 — 이번 draft 는 이들의 shape/method 를 바꾸지 않는다(값 마스킹 정책 전환만).
- **요구사항 ID**: `RR-PL-01~07`, `EIA-NF/NX/RL-*`, `R1~R19` 는 각 영역에서 유일하게 정의되며 재사용·충돌 없음.
- **상태 전이**: `Execution`/`NodeExecution` enum, `waiting_for_input` 파킹/재개 흐름은 target 이 손대지 않음.
- **RBAC**: `Execution.inputData` 마스킹은 role-gate 가 아니라 boundary masking parity(§R17 근거 재사용)이며, 기존 `execution:{id}` 구독 인가·`@Roles` 게이트와 상충하지 않음.
- **계층 책임**: ingestion-time(webhook §5.3 헤더 key-blacklist) vs egress-time(§R17 값-패턴) 마스킹의 공존은 target 자신의 Rationale("언제 가리는가 — ingestion-time 과 egress-time 이 공존한다")이 이미 명시적으로 근거를 대며 재확인했다.

## 요약

이번 draft(`Execution.inputData` egress 마스킹 + 프런트 마커 가드 도입)는 스스로 인용한 7개 미러 지점(데이터 모델·webhook·WS 프로토콜·Re-run·EIA §R17·background·에디터 §2.2)에서는 정합적이며, 이전 두 차례 리뷰가 이를 이미 전수 검증했다. 다만 그 미러 목록 밖에 있는 `spec/3-workflow-editor/3-execution.md` "inputData 데이터 흐름" 절이 "WS 는 inputData 를 안 나른다"고 단정해, target 이 WS `input` 필드 마스킹을 도입한 근거(같은 store 슬롯을 REST 가 덮어써 발생하는 flip-flop)와 정반대의 사실을 주장한다 — 실제 백엔드 emit·프런트 병합 코드 모두 WS 가 `input` 을 나른다는 target 쪽 서술이 맞고, `3-execution.md` 쪽이 2026-04 시점에 멈춘 채 갱신되지 않은 stale 서술이다. 구조적 파괴(엔드포인트·상태머신·RBAC 변경)는 없으므로 CRITICAL 은 아니지만, 이 문서군이 반복 노출한 "부분 미러" 실패 패턴과 겹치고 방금 세운 보안 결정의 근거 서사를 다른 spec 문서가 직접 반박하는 형태라 WARNING 으로 표기한다. 부수적으로 "폼 프리필 마커 가드"가 §R17 카탈로그에만 있고 폼 UI 오너 spec 에 미러가 없는 점을 INFO 로 남긴다.

## 위험도

MEDIUM
