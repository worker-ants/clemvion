---
id: "CLE-WF-ASSIST-PROMPT"
title: "워크플로우 AI 어시스턴트 — 시스템 프롬프트와 보안"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-ASSIST"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-ASSIST"]
area: "CLE-WF"
content_hash: "1281ff63406374f61a9deb5174c79bae1f74e787a6d8b61b64d1a9f0a9115009"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "183406718d2022e38cb80dee30de6ad614cb8707b4d388eb9d802cc9dc5b2ec3"
etag: "sha256-c8129e70699d77d39a0951a99720d4d3cec50eac858e6db5559b84fe43fc55dc"
---
## 개요

이 문서는 [워크플로우 AI 어시스턴트](CLE-WF-ASSIST.md) 의 하위 문서로 시스템 프롬프트의 절 구성 · 5블록 구조와 보안 · 정합성 규칙을 정한다. 프롬프트가 안내하는 단계 판단과 종료 가드는 [대화 루프와 턴 가드](CLE-WF-ASSIST-LOOP.md)에, 도구 계약은 [AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md)에 있다.

## 시스템 프롬프트

백엔드 `buildSystemPrompt(nodeDefs, workflowSnapshot, activePlanContext?)` 가 만들어 매 LLM 호출마다 넣는다. 시스템 프롬프트는 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md)의 인터페이스를 그대로 따르며 따로 모델 정책을 두지 않는다.

| 절 | 내용 |
|----|------|
| 역할 | AI 어시스턴트는 에디터의 Planner 이자 Builder 다. 모호하면 질문과 계획부터, 명확하면 바로 편집한다 |
| 판단 기준 | [단계 판단 기준](CLE-WF-ASSIST-LOOP.md#단계-판단-기준) 표를 자연어로 풀어 쓴다 |
| 활성 계획 컨텍스트 (있을 때만) | 활성 계획이 있으면 넣는다. 사용자의 원 요청, 계획 제목·요약, 승인 여부, 단계 체크박스(`[x]`·`[ ]`), 미답변 질문, 규칙(끝난 단계 다시 하지 않기, 화제가 바뀌면 `clear_plan` 먼저 부르기, 미완 상태에서 `finish` 금지)을 담는다. `cleared` 면 절을 빼고 `completed` 면 완료 요약 한 줄만 남긴다 |
| 노드 카탈로그 | `NodeComponentRegistry.listDefinitions()` 결과 요약(유형, 카테고리, 설명, 주요 설정 필드, 포트). 동적 포트 노드(`isDynamicPorts`)에는 `[dynamic-ports]` 표시를 붙여 설정에 따라 실제 포트가 바뀐다는 점만 알린다. 실제 포트 ID 는 `add_node`·`update_node` 결과의 `result.ports` 로 자동으로 내려오므로 `get_node_schema` 를 먼저 부를 일은 거의 없다 |
| 워크플로우 조립 규칙 | 새 노드는 데이터 경로가 `manual_trigger` 에서 시작하도록 반드시 `add_edge` 로 잇고 고립 노드를 만들지 않는다. `add_edge` 의 포트 값은 직전 성공 응답의 `result.ports.outputs[*].id` 를 그대로 쓴다. ID 자리에는 UUID 만 쓴다(라벨을 넣으면 `NODE_NOT_FOUND` 와 라벨 오인 힌트). `openQuestions` 가 있는 계획은 답을 받기 전에 `finish` 를 부르지 않는다. 동적 포트 노드의 하위 항목에는 안정되고 고유한 ID 를 준다. 세부 규칙과 버튼 ID 자동 부여는 [AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md#런타임-포트-목록)에 있다 |
| 노드 출력 규약 | [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md)의 Principle 0, 1.1, 2, 8 요약을 그대로 넣는다 |
| 현재 워크플로우 | `currentWorkflow` 요약 JSON. 앞에 "authoritative snapshot" 지침을 붙여 단순 조회는 프롬프트에서 바로 답하고 편집 뒤 재확인에만 `get_current_workflow` 를 부르게 한다 |
| 배치 지침 | 스냅샷에 노드별 측정값(`width`·`height`, px)이 있으면 그것을 기준으로 `x = predecessor.x + (predecessor.width ?? 250) + 32` 로 놓는다. 분기의 y 간격은 `max(predecessor.height ?? 80, 80) + 24` 다. 측정값이 없는 노드(처음 그리기 전이거나 같은 턴에 방금 추가한 노드)는 250×80 px 로 가정한다. 값을 지어내지 않는다 |
| 참조 표기 | `$node["label"].output.*` 를 쓴다. 라벨은 유일하고 `manual_trigger` 가 진입점이다. 표현식 문법은 [표현식 언어](CLE-WF-EXPR.md)를 따른다 |
| 실행 이슈 진단 패턴 | 사용자가 "실행이 실패했어", "왜 이 결과가 나오지" 같은 질문을 하면 먼저 `get_workflow_executions` 로 최근 실행 목록 요약을 받고 가장 가능성 높은 한 건만 `get_execution_details` 로 깊게 본다. 실패 노드, 에러 메시지, 직전 노드 출력을 읽어 원인을 가정하고 고쳐야 하면 `propose_plan` → 승인 → `update_node` 로 잇는다. 목록 전체를 한 번에 상세 조회하지 않는다(토큰 낭비) |
| 선택기 필드 정책 (통합, MCP 서버, 모델 설정, 지식 저장소, 워크플로우) | 선택기 위젯 필드의 ID 는 LLM 이 채우지 않는다. 추측도 발명도 금지다. 빈 값으로 `add_node`·`update_node` 를 부르면 서버가 후보를 `pendingUserConfig[*].candidates` 로 싣고 프론트엔드가 후보 선택기로 사용자 확인을 받는다([AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md#사용자-선택-필드-후보)). 마무리 메시지 규칙: 후보가 0개인 항목만 한국어 마무리 메시지에서 "해당 통합·LLM·지식 저장소·워크플로우를 설정 패널에서 직접 등록·선택해 주세요" 로 언급한다. 후보가 있으면 선택기가 흐름을 끝내므로 언급은 중복이다. 이 규칙은 품질 점검의 `PENDING_USER_CONFIG_UNMENTIONED` 에도 반영된다. 이 항목의 어휘(`LLM Config` 포함)는 `review-workflow.ts` 의 점검 detail 문자열과 맞춘 것이다 |
| 예시 3개 | ① "HTTP 헤더 추가" → 바로 `update_node`. ② "템플릿·스위치 노드 찾아봐" → 스냅샷만 참고하고 도구는 부르지 않는다. ③ "주문 취소" → 탐색, 질문, 계획, 편집 |

### 5블록 구조

`prompts/system-prompt.ts` 는 프롬프트를 다섯 블록으로 조립한다. 정적 내용을 앞에, 동적 상태를 뒤에 둔다.

1. **ROLE & TURN-OP PROTOCOL**: 역할 한 문장, 도구 호출 규약, 턴 결정표(`Turn type | Emit prose? | finish call? | Further tools | When it applies` 형태의 Markdown 표).
2. **CONTRACTS (MUST)**: 노드 출력 규약(Principle 0/1.1/2/8), Label vs identifier, 진입점 연결, 동적 포트(스키마 우선과 안정 ID), 계획 게이트(`openQuestions`, `planStepId`, 완결성).
3. **EDIT PLAYBOOK**: 턴 마무리(Closing the turn), `pendingUserConfig`, 기존 노드 설정 고치기, 배치 지침, 에러 처리, 흔한 실수, 예시 3개.
4. **REFERENCE**: 노드 카탈로그, 표현식 언어.
5. **DYNAMIC STATE**: 활성 계획 컨텍스트와 현재 워크플로우 스냅샷 JSON. 반드시 프롬프트 끝에 둔다.

블록 1~3 은 모듈 범위 상수(`STATIC_BLOCK_1_*`, `STATIC_BLOCK_2_*`, `STATIC_BLOCK_3_*`)로 빌드 때 한 번만 문자열로 만든다. 동적 값이 필요하면 이 상수에 넣지 않고 `buildSystemPrompt` 본체에서 조립한다. 표현식 참고 문자열도 모듈 범위 변수 `EXPRESSION_REFERENCE_CACHE` 에 한 번만 만든다.

턴 마무리 절은 과거형으로만 쓰게 한다. "진행 중", "차례대로", "다음 단계", "이어서 진행하겠습니다" 같은 미래형 서술을 금지한다. 도구를 부른 뒤에는 반드시 `finish` 를 명시적으로 부르게 한다. 서버의 라운드 이어가기는 대비책일 뿐 기대면 안 된다.

## 보안과 정합성

| 항목 | 내용 |
|------|------|
| 워크스페이스 경계 | 모든 탐색·편집 도구는 `session.workspace_id` 안에서만 동작한다 |
| 감사 로그 | 메시지와 도구 호출은 [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) 대상이 아니다. 어시스턴트 메시지 테이블에만 남긴다(MVP) |
| 토큰 사용량 | 각 LLM 호출은 `llm_usage_log` 에 기록되고 `workflow_id`·`workspace_id` 가 자동으로 채워진다([LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md)) |
| 편집 결과와 저장 | AI 어시스턴트의 편집은 에디터 스토어에만 반영된다. 영구 저장은 사용자의 `Ctrl+S`·Save 나 실행 직전 저장으로만 일어난다. 그래서 실수로 닫아도 세션 시작 시점의 워크플로우 상태로 돌아갈 수 있다 |
| API 키 | LLM API 키는 백엔드에서만 복호화해 쓴다([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) 규칙과 같다) |
| 프롬프트 인젝션 | 시스템 프롬프트는 서버에서만 만든다. 사용자 메시지는 `role: 'user'` 로만 넘긴다. 탐색 도구 결과(예: 다른 워크플로우의 사용자 작성 텍스트)는 `role: 'tool'` 결과로 격리한다. 활성 계획 컨텍스트의 원 요청은 XML 울타리(`<user-request>...</user-request>`)로 감싸 중화한다. 품질 점검 페이로드의 `originalRequest` 는 `truncateReviewOriginalRequest()` 로 `REVIEW_ORIGINAL_REQUEST_MAX_LEN=200` 자까지만 싣는다. 도구 힌트 안의 LLM 제공 문자열 처리는 [AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md#에러-보강-필드)에 있다 |

## 구현 위치

- `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts` (시스템 프롬프트)

## Rationale

### 시스템 프롬프트 5블록 구조

정적 내용을 앞에, 동적 상태를 뒤에 둬 프로바이더 prefix cache 적중률을 높이고 규칙 중복을 없애 LLM 이 매 턴 읽는 부담을 줄이려는 설계다.

- **규칙 단일 위치.** "Call `finish` immediately after `propose_plan`" 문구는 턴 결정표 한 곳에만 있다. 다른 절은 "the decision table above" 로만 가리킨다.
- **표현식 참고 캐시.** 전에는 매 턴 `getAllFunctionNames().sort().join()` 을 다시 돌렸다. 지금은 `EXPRESSION_REFERENCE_CACHE` 에 한 번만 만든다.
- **예시 3개로 줄였다.** Ex1 단순 편집, Ex2 동적 포트와 `pendingUserConfig`(라벨·ID 동시), Ex3 `openQuestions` 가 있는 복합 요청.

`system-prompt.spec.ts` 의 `5-block structural layout (cache-friendly ordering)` 묶음이 구조를 고정한다. 바꿀 때 다음이 깨지면 안 된다.

- `## Expression language` 뒤에 워크플로우 스냅샷 JSON(`"nodes":[`)이 있다.
- `## Expression language` 뒤에 `## Active plan context` 가 있다.
- `Label vs identifier`(CONTRACTS)가 `## Expression language`(REFERENCE)보다 앞에 있다.
- 턴 결정표 머리(`| Turn ... | ... prose ... | ... finish ...`)가 있고 `plan-only`·`execution` 두 턴 종류가 본문에 나온다.
- `Call finish immediately after propose_plan` 정규식 매치가 1회 이하다.

기존 테스트가 정규식으로 보장하는 문구도 깨면 안 된다.

- `[dynamic-ports]` 카탈로그 표시
- 필수 가드 문구: `manual_trigger` 진입점, `openQuestions` 상태에서 `finish` 금지, `get_node_schema` MANDATORY
- Label vs identifier 예: `btn_approve`, `승인`, `interaction.data.buttonId`, `interaction.data.email`, `data["승인"]` 금지 사례
- `## Closing the turn ... execution turn` 머리(두 문구가 같은 줄)
- `pendingUserConfig` 와 선택기 네 종: `integration-selector`, `llm-config-selector`, `kb-selector`, `workflow-selector`
- `TODO|placeholder` 금지 가드
- `## Expression language`, `validate()`, `INVALID_EXPRESSION`, `Optional chaining`, `` `??` ``, `Arrow`, `Template literal`
- `Editing an existing node's config`, `shallow-merged`, `[REDACTED]`, `minimum patch`, "keep .* id"
- 활성 계획 표시: `[x] s1 · add_node`, `[ ] s2 · add_edge`, `• [note] ...`, `awaiting approval`, XML 울타리 `<user-request>...</user-request>`

유지보수 때 지킬 것은 다음과 같다.

- 절을 더할 때 블록 경계를 넘지 않는다. 정적 내용은 블록 1~4, 동적 내용은 블록 5 다. 이 규율이 캐시 효과의 바탕이다.
- 새 규칙을 넣기 전에 기존 절에 흡수할 수 있는지 먼저 본다. 규칙을 여러 곳에 반복하면 이 구조의 의미가 사라진다.
- harmony 제어 토큰 경고(`<|channel|>` 등)는 OpenAI gpt-oss 계열을 위한 유산이다. 현재 프로바이더(OpenAI, Anthropic, Google) 모두에서 생기지 않는다고 확인되면 지울 수 있다.
