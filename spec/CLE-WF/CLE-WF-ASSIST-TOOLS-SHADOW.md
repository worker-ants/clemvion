---
id: "CLE-WF-ASSIST-TOOLS-SHADOW"
title: "AI 어시스턴트 도구 — Shadow 검증과 에러 보강"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-ASSIST-TOOLS"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-ASSIST-TOOLS"]
area: "CLE-WF"
content_hash: "25323092db9c10037c9eb7da3af864ccbf267dbc196f767de917e87cb16f0046"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "4cbdc433c54d9c7572333697cbfd9a7225bda1d999c1272377ddda355b8b16ec"
etag: "sha256-9fbacc56efb5881450096b81ced454563ebc6808c639450cbdb4bb0475269d0c"
---
## 개요

이 문서는 [AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md) 의 하위 문서로 편집 도구가 먼저 거치는 Shadow 검증(`ShadowWorkflow`)의 규칙, 실패 응답에 붙는 에러 보강 필드, `NODE_NOT_FOUND` 힌트 규칙을 정한다. 편집 도구의 인자와 반환은 부모 문서의 [편집 도구](CLE-WF-ASSIST-TOOLS.md#편집-도구)에 있다.

## Shadow 검증 규칙

| 규칙 | 실패 시 반환 |
|------|--------------|
| `type` 은 등록된 노드 유형이어야 한다 | `{ok: false, error: 'UNKNOWN_NODE_TYPE', knownTypes?, suggestedType?, hint?}` ([에러 보강 필드](#에러-보강-필드)) |
| `label` 은 워크플로우 안에서 유일해야 한다 | `{ok: false, error: 'LABEL_CONFLICT', suggested?: string, repeatCount?, hint?}` |
| `add_edge` 의 source·target 과 `update_node`·`remove_node` 의 `id` 가 있어야 한다 | `{ok: false, error: 'NODE_NOT_FOUND', hint?: string}` ([힌트 규칙](#node_not_found-힌트-규칙)) |
| `add_edge` 의 source·target 포트가 있어야 한다 | `{ok: false, error: 'PORT_NOT_FOUND', portInfo: {knownPorts}}`. `ShadowWorkflow.addEdge` 가 `portResolver`(stream 서비스가 `resolveEffectiveOutputPorts` 로 주입)로 포트를 확인한다. 설정 수정이 실패해 생기지 못한 동적 포트에 연결선을 붙이려는 실수를 첫 시도에서 잡는다. 컨테이너 되돌아오기 `emit` 포트는 허용한다 |
| 트리거 노드는 컨테이너 자식이 될 수 없다 | `{ok: false, error: 'CONTAINER_INVALID_CHILD'}` |
| 수동 트리거 노드는 지울 수 없다 | `{ok: false, error: 'MANUAL_TRIGGER_PROTECTED'}` |
| 순환을 만들면 안 된다 | `{ok: false, error: 'CYCLE_DETECTED'}`. 다만 source 노드의 조상 `containerId` 체인 가운데 하나가 target 과 같고 target 포트가 `emit` 이면 허용한다. 자식이 자기나 조상 컨테이너로 돌아가는 반복 되돌아오기 연결선이기 때문이다. 실행 엔진이 `containerId` 로 컨테이너 내부 그래프를 떼어 처리하는 것과 뜻이 맞는다. `emit` 이 아닌 포트(예: `target_port: 'in'`)로 돌아오는 연결선은 반복 의도가 아닌 실수로 보고 순환으로 판정한다 |
| `add_node`·`update_node` 의 최종 `config` 는 노드별 `handler.validate` 도메인 규칙(버튼 수 상한, 정적·동적 필수 필드, 중복 ID 등)을 지키는 것이 권장된다. 저장 자체는 막지 않는다 | 성공 응답(`ok: true`)에 `configWarnings?: string[]` 로 `handler.validate` 의 에러를 5개까지 싣는다. LLM 은 경고만 받고 다음 턴에 `update_node` 로 고치거나 그대로 둘 수 있다. 실행 시점에 실행 엔진이 같은 규칙을 다시 검사해 최종 차단한다 |
| 같은 턴에 `propose_plan` 을 부른 뒤 편집 도구를 부르면 안 된다(계획 전용 턴) | `{ok: false, error: 'PLAN_AWAITING_APPROVAL', message}`. LLM 은 한국어 메시지로 턴을 끝내고 사용자 승인을 기다린다 |

실패하면 LLM 은 tool_result 를 받아 다시 시도하거나 사용자에게 상황을 알린다. 컨테이너·수동 트리거 노드 제약의 원래 규칙은 [워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md)와 [연결선](CLE-WF-EDGE.md)이 정한다.

### 성공이지만 경고가 붙는 경우

| 규칙 | 반환 |
|------|------|
| 활성 계획이 있는데 편집 호출에 `planStepId`·`planStepIds` 가 없다 | `{ok: true, ..., warning: 'MISSING_PLAN_STEP_ID', warningMessage}`. 편집은 성공했지만 계획 카드의 체크가 되지 않는다. LLM 은 다음 편집부터 반드시 단계 ID 를 붙인다 |

### 에러 보강 필드

Shadow 결과(`ShadowResult`)에는 복구를 돕는 선택 필드가 붙는다.

| 필드 | 붙는 경우 |
|------|-----------|
| `knownTypes: string[]` | `UNKNOWN_NODE_TYPE`. 정렬된 등록 유형 목록, 최대 `KNOWN_TYPES_MAX=40` |
| `suggestedType: string` | `UNKNOWN_NODE_TYPE`. 별칭 맵(`NODE_TYPE_ALIASES`)에 걸리면 그 값을 먼저 쓰고 없으면 Levenshtein 거리 3 이하인 유형 |
| `repeatCount: number` | `LABEL_CONFLICT` 가 같은 라벨로 `LABEL_CONFLICT_REPEAT_THRESHOLD`(=2)번 이상 반복될 때 |
| `hint: string` | 복구 지침 한 문장. `UNKNOWN_NODE_TYPE`(별칭·Levenshtein·후보 없음마다 문구가 다르다), `LABEL_CONFLICT`(`repeatCount` 2 이상), `NODE_NOT_FOUND` 에서 붙는다 |

별칭 맵은 LLM 이 목록에 없는 유형 이름을 지어낼 때 실제 유형으로 이끈다. 별칭 대상이 레지스트리에 실제로 있을 때만(`this.knownNodeTypes.has(aliasHit)`) `suggestedType` 으로 싣는다. 레지스트리가 바뀌어도 없는 유형을 권하지 않기 위해서다.

| 지어낸 이름 | 실제 유형 |
|-------------|-----------|
| `error_message`, `error`, `alert`, `notification`, `message`, `text` | `template` |
| `display`, `show`, `render`, `result`, `output` | `template` |
| `user_input`, `input`, `question`, `prompt`, `survey`, `text_input` | `form` |
| `choice`, `choices`, `options`, `selection`, `selector`, `button_group`, `category`, `buttons` | `carousel` |
| `router`, `route`, `branch`, `conditional` | `switch` (참·거짓 분기는 `if_else`) |
| `email`, `send_mail`, `mail` | `send_email` |

`LABEL_CONFLICT` 는 실패한 노드 생성으로 세지 않는다. `addNode()` 의 `LABEL_CONFLICT` 분기에서는 `recordFailedAddNode` 를 부르지 않는다.

LLM 이 자유 텍스트로 채운 값(라벨, `attemptedType`)을 힌트나 에러 메시지에 넣을 때는 반드시 `sanitizeLlmProvidedString(value, maxLen)` 을 거친다. 제어 문자·개행을 없애고 백틱·꺾쇠를 중화하고 길이를 자른다. 길이 상수는 `ATTEMPTED_TYPE_MAX_LEN = 64`(노드 유형 후보), `LABEL_HINT_MAX_LEN = 80`(`NODE_NOT_FOUND` 힌트의 라벨 목록)이다.

### `NODE_NOT_FOUND` 힌트 규칙

`update_node`·`remove_node`·`add_edge` 가 `NODE_NOT_FOUND` 로 실패할 때, 복구 가능성이 높은 두 패턴이면 서버가 `hint` 필드로 복구 지침을 붙인다. 힌트 문자열 안의 LLM 제공 자유 텍스트(라벨 등)는 `sanitizeLlmProvidedString` 으로 개행·제어 문자·`<>` 를 중화한다. C0·C1 제어 문자, Bidi, zero-width 문자까지 중화한다. 라벨 오인 힌트는 추가로 `[hint] … [/hint]` 고정 마커로 감싸 LLM 이 힌트 범위를 지시문으로 오해하지 않게 한다.

| 힌트 | 붙는 조건 | 대표 문구 |
|------|-----------|-----------|
| 앞선 `add_node` 실패 연쇄 | `add_edge` 전용. 같은 턴에 `add_node` 가 한 번이라도 실패했다 | `A prior add_node failed in this turn (labels: […]). The UUID you are referencing does not exist because that node was never created. Fix the upstream add_node failures first, then wire the edges.` |
| 라벨 오인 | `update_node`·`remove_node` 는 항상, `add_edge` 는 연쇄 대상이 없을 때. 받은 ID 값이 Shadow 안 어떤 노드의 `label` 과 정확히 같으면 그 노드의 UUID 를 알려 준다 | `[hint] Value "SendEmail" matches the label of an existing node (id: 11111111-…). Tool arguments use UUIDs, not labels — use the id value from a prior add_node result or from currentWorkflow.nodes[*].id. [/hint]` |

`add_edge` 의 우선순위는 이렇다.

1. 실패한 `add_node` 기록(FIFO)이 비어 있지 않으면 연쇄 힌트를 쓴다.
2. 비어 있을 때만 라벨 오인 힌트로 넘어간다. source 쪽을 먼저 보고 source 가 실제로 없고 라벨이 맞으면 그 힌트를 쓴다. 아니면 target 쪽을 본다.
3. 한 응답에는 힌트를 하나만 싣는다. source·target 이 모두 라벨 실수여도 source 힌트만 보내 LLM 이 source 를 먼저 고친 뒤 target 을 다시 시도하게 한다.

길이와 보안 정책은 다음과 같다.

- `value.length > LABEL_HINT_MAX_LEN * 4` 인 값은 라벨 후보에서 뺀다. 터무니없이 긴 값을 비교하지 않기 위해서다.
- 라벨과 값 문자열은 sanitize 뒤 `JSON.stringify` 로 escape 한다. UUID 는 `[0-9a-f-]` 만 담으므로 그대로 넣는다.
- 공백만 있는 ID 에는 힌트를 붙이지 않는다.
- `hint` 는 원래부터 선택 필드이므로 기존 `NODE_NOT_FOUND` 소비자는 힌트 없이도 똑같이 동작한다.
- `[hint] … [/hint]` 마커는 라벨 오인 힌트에만 쓴다. 연쇄 힌트 등 다른 힌트는 원래 형식을 유지한다.

## 구현 위치

- `codebase/backend/src/modules/workflow-assistant/tools/shadow-workflow.ts` (Shadow 검증, 힌트, 포트 반환)

## Rationale

### 에러 보강으로 연쇄 실패 줄이기

설문조사처럼 복합 워크플로우를 만들 때 도구 호출이 연쇄로 실패했다. 실패 응답에 복구 지침을 실어 다음 라운드에서 바로 고치게 하려고 `ShadowResult` 에 `knownTypes`·`suggestedType`·`repeatCount`·`hint` 를 더했다.

- **별칭 기준.** LLM 은 "UI 메시지 전용 노드" 가 따로 있다고 가정하고 유형 이름을 지어내곤 한다. 이런 이름을 `template` 으로 보낸다.
- **Gemini-3-flash 의 유형 발명.** Gemini-3-flash 가 `음식 종류 선택` 같은 라벨로 목록에 없는 유형을 만들어 `add_node` 를 시도했다. 첫 `UNKNOWN_NODE_TYPE` 응답의 `suggestedType`·`knownTypes` 도 무시하고 반복했다. 그래서 입력·선택·분기·이메일·표시 계열 별칭을 넓혀 대부분의 발명 패턴을 한 번에 바로잡게 했다. 프롬프트의 흔한 실수 절에도 "노드 유형은 고정 목록이며 작업 문구로 새 유형을 지어내지 않는다" 는 문장과 계열별 "흔한 발명 → 실제 유형" 표를 넣었다.
- **`LABEL_CONFLICT` 를 실패한 생성으로 세지 않는 이유.** 이름만 겹쳤을 뿐 유형과 설정은 타당한 상태다. 이것이 연쇄 힌트에 섞이면 뒤이은 `add_edge` 의 `NODE_NOT_FOUND` 에 "앞서 노드 생성이 실패했다" 는 틀린 진단이 붙는다. 테스트 `shadow-workflow.spec.ts` "LABEL_CONFLICT does NOT poison the cascading NODE_NOT_FOUND hint" 가 고정한다.
- **LLM 제공 문자열을 반드시 sanitize 하는 이유.** LLM 출력이 `\n## HACK` 같은 마크다운 헤더나 인젝션을 품은 채 힌트로 다시 들어가면 다음 라운드 프롬프트에서 지시문으로 오해될 수 있다.

### 라벨 오인 힌트

LLM 이 `update_node`·`remove_node`·`add_edge` 의 `id`·`source_id`·`target_id` 자리에 사용자에게 보이는 라벨(예: `"SendEmail"`)을 넣어 `NODE_NOT_FOUND` 가 연쇄로 났다. 설정 patch 도 전혀 반영되지 않는 2차 증상까지 번졌다. 두 층으로 막았다.

1. 시스템 프롬프트의 "Label vs identifier" 절에 "도구 인자는 노드를 UUID 로만 가리키고 라벨로 가리키지 않는다" 는 문단을 더했다. UUID 의 출처 두 가지와 위반 예(`update_node({id: "SendEmail"})`)를 적었다. "라벨은 전역 유일" 문장에는 "유일성은 `add_node` 충돌 감지용이며 UUID 를 대신할 근거가 아니다" 를 덧붙였다.
2. 서버가 라벨 오인 힌트를 붙인다. `buildLabelAsIdHint(value)` 가 `findByLabel` 에 위임해 순회 중복을 없앤다. `add_edge` 는 연쇄 힌트를 먼저 보고 비어 있을 때만 라벨 오인 힌트로 넘어가 두 힌트가 섞이지 않게 했다.

회귀 테스트는 `shadow-workflow.spec.ts` 의 `NODE_NOT_FOUND label-lookalike hint` 묶음(도구·source·target 별 힌트, 양쪽 라벨이면 source 힌트 하나, 공백 ID 는 힌트 없음, FIFO 가 비었을 때의 대체, FIFO 가 있을 때의 우선순위, 개행·`<script>` sanitize)과 `system-prompt.spec.ts` "teaches that tool-argument id slots need UUIDs, never node labels" 다.

### 설정 도메인 검증을 막지 않는 이유

`handler.validate` 위반을 저장 차단으로 두면 LLM 이 같은 실패를 끝없이 재시도하는 루프가 생긴다. 그래서 경고(`configWarnings`)로만 알리고 실행 시점에 실행 엔진이 같은 규칙으로 최종 차단해 의미상 방어선을 유지한다.

### 유지보수 점검

- `ShadowResult` 필드를 더하거나 빼면 JSDoc, 테스트 fixture, 뒤따르는 `detectPendingUserConfig`·`toChatMessages` 메시지 복원 경로를 확인한다.
- `NODE_TYPE_ALIASES` 에 별칭을 더하면 `shadow-workflow.spec.ts` 의 `it.each` 경우에도 더한다. 별칭 대상이 레지스트리에 없을 때 Levenshtein 으로 넘어가는지 회귀를 확인한다("falls through to Levenshtein when alias exists but not in knownTypes").
