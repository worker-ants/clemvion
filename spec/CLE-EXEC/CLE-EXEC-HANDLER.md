---
id: "CLE-EXEC-HANDLER"
title: "노드 핸들러 계약"
type: "design"
version: 6
status: "approved"
requirements: ["REQ-HANDLER-001", "REQ-HANDLER-002", "REQ-HANDLER-003", "REQ-HANDLER-004"]
basis_superseded: false
parent: "CLE-EXEC"
ancestors: ["CLE-VISION", "CLE-EXEC"]
area: "CLE-EXEC"
content_hash: "a28cad4c1e3e9641caf3178f53d42756c1163ba7de6bc840056f04510b7f0283"
read_as: "approved_fallback"
task: "CLE-T-VQX844"
source_paths: ["spec/4-nodes/_product-overview.md", "spec/5-system/4-execution-engine.md"]
mirror_sha256: "cc896e3b3fe0de4b4691c6e2703c0d3761734586cf1d3727827cb770a1bf5985"
etag: "sha256-2d6d121a97b7ecf44120a26034ff7bfe40da164ab09fbff646f7435076d0b74a"
---
> 구현 상태: 부분 구현 · 원문: `spec/5-system/4-execution-engine.md` (§5.1~§5.7, Rationale "Engine Raw Config Exposure"), `spec/4-nodes/_product-overview.md` (§11 ENG-RC-01~04) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

노드 핸들러(node handler, `NodeHandler`)는 노드 유형마다 있는 실행 코드다. 이 문서는 엔진이 핸들러를 부르는 계약을 정한다. 핸들러 인터페이스, 엔진이 핸들러에 넘기는 원본 설정(`rawConfig`)과 평가된 설정(`resolvedConfig`), 핸들러 레지스트리와 노드 유형별 dispatch, 표현식 해석 단계, 노드 한 번의 실행 흐름이 여기에 들어간다.

범위 밖:

- 노드 출력(`NodeHandlerOutput`) 다섯 필드의 뜻과 배치 규칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이 정한다. 이 문서는 엔진이 그 필드를 어떻게 읽는지만 다룬다.
- 흐름 지시 상태(`status`)의 값과 입력 대기·재개 계약은 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) 에 있다.
- 핸들러에 넘기는 실행 컨텍스트의 필드는 [실행 컨텍스트](CLE-EXEC-CONTEXT.md) 가 정한다.
- 표현식 문법·내장 변수·함수는 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 가 정한다.
- 노드 에러 처리 정책과 노드 재시도는 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 이 정한다.
- 통합 노드 핸들러의 추가 계약은 [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md) 에 있다.
- 노드 폴더 구조와 부팅 등록 절차는 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 에 있다.

## 핸들러 인터페이스

모든 노드 유형은 같은 핸들러 인터페이스를 구현한다.

```ts
interface NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult;
  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput>;
}

interface NodeHandlerOutput {
  /** 평가 전 원본 설정의 에코. 표현식이 든 필드는 평가 전 모양 그대로 두고 평가 결과는 output 에 둔다. 자격 증명 본체는 넣지 않는다. */
  config: Record<string, unknown>;
  /** 실제로 만든 결과. 배열·객체·원시값 모두 된다. */
  output: unknown;
  /** 실행 부가 정보. durationMs, statusCode, tokensUsed 같은 관측 메타데이터. */
  meta?: Record<string, unknown>;
  /** 라우팅 지시. 값은 노드 정의의 출력 포트 ID. 여러 포트를 한 번에 열면 string[]. */
  port?: string | string[];
  /** 흐름 지시 상태. 'waiting_for_input' | 'requires_integration' | 'requires_playwright' 등. */
  status?: string;
}
```

| 메서드 | 설명 |
| --- | --- |
| `validate(config)` | 노드 설정의 유효성을 검사한다. 워크플로우 저장·실행 전에 부른다. 문제가 있으면 `{ valid: false, errors: [...] }` 를 돌려준다 |
| `execute(input, config, context)` | 노드를 실행한다. `config` 는 표현식을 평가한 뒤의 값이다. `context.rawConfig` 로 평가 전 원본도 함께 받는다. `NodeHandlerOutput` 을 돌려준다 |

### 설정과 출력의 역할

- `NodeHandlerOutput.config` 는 노드가 **어떻게 설정됐는가**다. 워크플로우 작성자가 입력한 원본(평가 전) 모양이다. 뒤 노드는 `$node["X"].config.<field>` 로 읽는다.
- `output` 은 노드가 **무엇을 만들거나 썼는가**다. 표현식 평가 결과와 실행 결과다. 뒤 노드는 `$node["X"].output.<field>` 로 읽는다.
- 그래서 표현식이 든 필드는 두 곳의 값이 다르다. 예: `config.subject = "Hello {{ name }}"`, `output.subject = "Hello Alice"`.
- `meta` 는 실행 부산물(시간, 외부 상태 코드, 토큰 사용량)이다. 비즈니스 로직이 아닌 관측 정보다.
- `port` 와 `status` 는 엔진이 읽어 흐름을 정하는 지시다. 일반적인 뒤 노드 참조에는 권하지 않는다.

### 민감 정보

- `config` 에는 통합 ID(`integrationId` UUID), 액션 이름, 파라미터만 에코한다.
- 자격 증명 객체(access_token, password, api_key, private_key 등)는 핸들러 안에서만 쓰고 반환값에 넣지 않는다.
- AES-256-GCM 으로 저장된 자격 증명을 복호화해 외부 서비스에 넘긴 뒤 반환값을 만들 때는 자격 증명을 뺀다.
- `config` 에는 저장 시점 마스킹이 없다. 엔진 → 핸들러 → `NodeExecution.outputData` 저장까지 원문이 유지되고 마스킹은 나가는 응답(REST·WebSocket)에서만 한다. 표현식(`$node["X"].config.<field>`)도 원문을 읽는다. 응답 마스킹은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.

## 원본 설정 노출 요구

엔진은 표현식(`{{ ... }}`)의 평가 전과 평가 후 두 값을 핸들러가 모두 쓸 수 있게 넘긴다. 설정 에코는 원본(평가 전), `output.*` 는 평가 결과라는 직교성을 지키기 위한 요구다.

- REQ-HANDLER-001 WHEN 엔진이 노드 핸들러를 부르면 THE SYSTEM SHALL 표현식을 평가하기 전 원본 설정을 따로 보존해 `ExecutionContext.rawConfig` 로 노출한다. (원본: ENG-RC-01)
- REQ-HANDLER-002 WHEN 핸들러가 노드 출력을 만들면 THE SYSTEM SHALL `NodeHandlerOutput.config` 에 원본 설정(`rawConfig`)을 에코하고 표현식 평가 결과는 `output.*` 에 둔다. (원본: ENG-RC-02)
- REQ-HANDLER-003 WHEN 엔진이 핸들러의 `execute` 를 부르면 THE SYSTEM SHALL 평가 후 설정을 `config` 인자로, 평가 전 원본을 `context.rawConfig` 로 함께 넘겨 핸들러가 에코할 값과 동작에 쓸 값을 나눌 수 있게 한다. (원본: ENG-RC-03)
- REQ-HANDLER-004 WHEN 원본 설정 에코 방식을 도입하면 THE SYSTEM SHALL 모든 핸들러에 한 번에 같은 방식을 적용한다. (원본: ENG-RC-04)

엔진은 표현식이 있는지와 관계없이 모든 호출에 `node.config` 의 얕은 복사본을 얼려 `rawConfig` 로 넣는다. 표현식이 없는 필드(예: `mode`, `chartType`)는 원본과 평가 결과가 같아 영향이 없다. 표현식을 쓰는 필드(템플릿·표현식 위젯)만 뜻이 바뀐다. 옛 레이블 `ENG-RC-01`~`04` 와 새 번호의 대응은 [Rationale](#원본-설정-노출-요구를-요구사항-줄로-옮겼다-2026-11-13) 에 있다.

영향 범위:

- 기존 워크플로우의 `$node["X"].config.<표현식 필드>` 가 평가된 값을 읽고 있었다면 이행 뒤에는 원본 템플릿이 나온다. 호환이 깨지는 변경이므로 릴리스 노트가 필요하다.
- 이 변경 전에 저장된 `NodeExecution.outputData` 기록은 그대로 두고 소급 변환하지 않는다. 실행 내역 화면에는 "기록 당시의 설정 모양" 이라는 안내가 필요할 수 있다. 옛 기록의 처리는 [실행 컨텍스트](CLE-EXEC-CONTEXT.md) 의 재실행·조회 정책에 있다.
- 응답 DTO 의 `config` 를 평가된 값으로 가정한 API 클라이언트(외부 통합)는 영향을 받는다.

## `$node` 표현식 네임스페이스

표현식 resolver 는 각 노드의 노드 출력을 그대로 `$node[nodeKey]` 에 노출한다. 옛 `$node[key] = { output: ... }` 래퍼는 없앴다.

| 표현식 | 반환 |
| --- | --- |
| `$node["SendEmail"].output.messageId` | 메일 발송 결과 messageId |
| `$node["SendEmail"].config.subject` | 설정의 **원본** 제목(예: `"Hello {{ name }}"`, 평가 전) |
| `$node["SendEmail"].output.subject` | 실제로 보낸 제목(예: `"Hello Alice"`, 평가 결과) |
| `$node["HTTP"].meta.statusCode` | HTTP 응답 상태 코드 |
| `$node["HTTP"].output.response` | 응답 본문 |
| `$node["IfElse"].port` | 실행 때 고른 포트(`'true'` 또는 `'false'`) |
| `$node["Form"].status` | `'waiting_for_input'` 같은 흐름 지시 상태 |

표현식이 든 필드는 `.config.*` 에서 원본을, `.output.*` 에서 평가 결과를 얻는다. 표현식이 없는 필드(예: `mode`, `chartType`)는 두 값이 같으므로 `.config.*` 만 써도 된다.

`nodeKey` 는 노드 라벨(겹치면 `#N` 접미사)과 노드 UUID 를 모두 받는다. `.output`·`.config`·`.meta`·`.port`·`.status` 밖의 필드는 정의하지 않는다. 라벨 규칙은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 에 있다.

현재 구현은 실행 컨텍스트의 `structuredOutputCache` 에 있는 노드 출력 다섯 필드 객체를 노출하고 그 캐시가 없을 때만 `{ output: <평평한 출력> }` 으로 대신한다.

## 포트 선택

조건 분기 노드(`if_else`, `switch`, `text_classifier`, `http_request`, `ai_agent` 조건 라우팅)는 반환값에 `port` 를 함께 넣는다.

```ts
return {
  config: { condition: "..." },
  output: forwardedData, // 뒤 노드로 넘길 입력
  port: "true" | "false", // 엔진이 이 포트의 연결선만 연다
};
```

엔진의 `applyPortSelection(output)` 은 `output.port` 를 읽어 `_selectedPort` 에 기록하고 뒤 노드의 입력은 `output.output` 이 된다. `_selectedPort` 로 연결선을 여는 규칙은 [실행 엔진 개요와 그래프 순회](CLE-EXEC-ENGINE.md) 에 있다.

출력 값이 배열이나 원시값이면 엔진은 `port` · `status` 를 함께 들고 다니려고 엔진 안에서만 `{ data: <출력 값>, _selectedPort, … }` 객체를 만든다. 이 객체는 포트 라우팅과 대기 판정에만 쓴다. 다음 노드의 `$input`(`gatherNodeInput`), `$node["X"].output`, 컨테이너 본문이 `emit` 으로 넘기는 값, Parallel 분기 결과에는 이 객체 대신 핸들러가 `output` 에 둔 값이 간다. 사용자 코드가 돌려준 `{ data: ... }` 객체와 모양이 같으므로 엔진은 자기가 만든 객체에 표지를 붙여 둘을 가른다. 표지는 메모리에만 있어 DB 에서 되살린 값에는 없다. `meta` 만 있을 때는 이 객체를 만들지 않는다. 출력 값이 `null` 이거나 없으면 핸들러가 포트 하나(문자열)를 고르고 `status` 와 재개 상태(`_resumeState`)를 싣지 않았을 때만 이 객체를 만든다. 그 밖의 경우는 설정 에코와 제어 필드를 펼친 모양 그대로 들고 다닌다. 입력 대기 선언, `status: 'ended'` 같은 다른 `status`, 재개 상태, Parallel 의 분기 선언(포트 배열)이 그렇다. 출력 쪽 규칙은 [노드 출력 규약 Principle 0](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-0-노드-출력의-다섯-필드) 7번이고, 이 객체가 아직 새는 경로는 그 문서의 [미결 사항](../CLE-NODE/CLE-NODE-OUTPUT.md#미결-사항)에 있다.

옛 `{ port, data }` 반환 방식은 없앴다. 핸들러 반환값에 `config` 와 `output` 이 없으면 엔진 경계(`adaptHandlerReturn`)가 에러를 낸다. 엔진은 사용자 출력 값 안의 `data` 키를 보정하지도 풀지도 않는다.

## 핸들러 레지스트리

```ts
interface NodeHandlerRegistry {
  register(nodeType: string, handler: NodeHandler, metadata?: NodeTypeMetadata): void;
  get(nodeType: string): NodeHandler;
  getMetadata(nodeType: string): NodeTypeMetadata; // 등록되지 않은 metadata 는 { kind: 'standard' } 를 돌려준다
  assertConsistency(): void;                       // 부팅 때 등록 일관성 검증
}
```

- 시스템이 시작할 때 모든 기본 노드 핸들러를 레지스트리에 등록한다.
- 마켓플레이스로 설치한 사용자 정의 플러그인 노드를 같은 레지스트리에 등록하는 것은 **Planned** 다. [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 의 마켓플레이스 로드맵과 같은 단계다.
- 등록되지 않은 `nodeType` 을 찾으면 `get` 이 메시지가 `UNKNOWN_NODE_TYPE: ` 로 시작하는 일반 에러를 던진다(`No handler registered for node type "<유형>"`). `INVALID_NODE_CONFIG: ` 와 같은 메시지 접두이고 구조화된 `error.code` 는 없다. 노드 실행 중에 나면 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 을 따른다([노드 실행 흐름](#노드-실행-흐름) 2단계). AI 어시스턴트 도구가 도구 결과에 싣는 `error: 'UNKNOWN_NODE_TYPE'` 은 이름만 같은 다른 값이다.

### 노드 유형 메타데이터 기반 dispatch

`register` 의 세 번째 인자 `metadata`(`node-type-metadata.ts`)는 엔진 dispatch 가 노드 유형별 특수 실행 경로를 고르는 데 쓰는 판별 유니온이다. 예전의 하드코딩된 노드 유형 분기를 대신한다(PR-G). `NodeTypeMetadata.kind` 는 핸들러 런타임 출력의 `executionMetadata.kind`(예: ForEach 의 `'container'`)와 같은 어휘를 쓰지만 **다른 객체이고 쓰는 곳도 다르다**. 앞의 것은 등록 때 정적 dispatch 선택에, 뒤의 것은 실행 결과 메타에 쓴다.

| `kind` | 뜻 | 지금 등록된 유형 |
| --- | --- | --- |
| `standard` | 일반 노드. 특수 dispatch 없음 | 대부분(미등록 시 기본값) |
| `container` | 컨테이너. `containerId` 로 자식을 묶고 회차마다 본문을 다시 실행([컨테이너 실행](CLE-EXEC-CONTAINER.md)) | `foreach`, `loop`, `map` |
| `background` | `background` 포트 서브그래프를 비동기 큐로 실행([컨테이너 실행](CLE-EXEC-CONTAINER.md)) | `background` |
| `parallel` | N 개 분기를 동시에 실행(`p-limit` 세마포어) | `parallel` |
| `blocking` | 늘 입력 대기(`interaction: 'form'`). 버튼과 멀티턴 AI 는 이 메타데이터가 아니라 런타임 `meta.interactionType` 으로 가른다 | `form` |
| `trigger` | 워크플로우 진입점 | `manual_trigger` |

- `getMetadata(type)` 는 메타데이터가 없는 유형에 `{ kind: 'standard' }` 를 돌려준다. 그래서 dispatch 분기가 명시 분기 없이도 안전하게 동작한다.
- **부팅 검증 `assertConsistency()`**: `onApplicationBootstrap` 에서 등록 일관성(등록된 모든 유형의 메타데이터 보유, 전용 executor 주입 등)을 검사한다. production 에서는 어기면 예외를 던지고 그 밖의 환경에서는 경고 로그만 남긴다.

## 표현식 해석 단계

노드를 실행하기 전에 설정 객체의 문자열 필드에 든 `{{ }}` 표현식을 푼다. 엔진은 원본(`rawConfig`)과 평가 결과(`resolvedConfig`)를 모두 핸들러에 넘겨 핸들러가 에코와 실행을 나눌 수 있게 한다.

1. `handler.validate(rawConfig)` 로 원본 설정의 구조를 검사한다.
2. `resolvedConfig = ExpressionResolver.resolveConfig(rawConfig, exprContext, nodeType)` 로 평가한다.
   - 설정 객체를 재귀로 돌며 문자열 값의 `{{ }}` 를 평가한다.
   - 값 전체가 `{{ expr }}` 하나면 평가 결과의 원래 타입(숫자, 객체 등)을 유지한다.
   - 글자와 표현식이 섞이면 결과는 늘 문자열이다.
   - 숫자·불리언·null 은 그대로 둔다.
   - 한 번만 평가하고 결과를 다시 평가하지 않는다.
3. `handler.execute(input, resolvedConfig, { ...context, rawConfig })` 로 실행한다. 이 실행 컨텍스트 복사본을 만드는 단위는 [핸들러용 실행 컨텍스트는 노드 실행마다 하나다](#핸들러용-실행-컨텍스트는-노드-실행마다-하나다) 에 있다.

`context.rawConfig` 는 평가 전 원본 설정의 참조다. 핸들러가 `NodeHandlerOutput.config` 에코에 쓴다. 핸들러는 평가된 값으로 동작하고 에코는 원본을 지켜 뒤 노드의 `$node["X"].config.*` 와 `$node["X"].output.*` 가 서로 겹치지 않게 한다.

### 표현식 컨텍스트 구성

| 변수 | 채우는 곳 |
| --- | --- |
| `$input` | 이전 노드 출력(`gatherNodeInput` 결과). 트리거 노드에서는 `{ parameters, ...(트리거별 메타) }` |
| `$params` | `$input.parameters` 의 줄임. 수동 트리거 노드가 만든 구조화 입력 파라미터 |
| `$node` | nodeMap 과 출력 캐시로 만든 노드 라벨 키 맵. `$node["Label"].output` 처럼 쓴다 |
| `$var` | `context.variables`(변수 선언 노드·변수 수정 노드가 관리) |
| `$execution` | `{ id, workflowId, startedAt, mode }`. `mode` 의 값 집합은 정의가 갈린다. [표현식 언어 §미결 사항](../CLE-WF/CLE-WF-EXPR.md#미결-사항) 참조 |
| `$now` | 표현식 컨텍스트를 만들 때의 현재 시각(ISO 8601, UTC). 현재 구현은 컨텍스트를 만들 때마다 새 시각을 잡는다. 같은 실행 안에서 고정할지는 정의가 갈린다. [표현식 언어 §미결 사항](../CLE-WF/CLE-WF-EXPR.md#미결-사항) 참조 |
| `$loop` | `loopContext`(Loop 본문 안) |
| `$item`, `$itemIndex`, `$itemIsFirst`, `$itemIsLast` | `itemContext`(ForEach 본문 안) |
| `$thread` | `context.conversationThread` 의 읽기 전용 뷰. `turns`·`length`·`text` 만 노출한다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)) |

엔진은 이 밖에도 `$trigger`·`$env` 와 Table 노드 한정 변수(`$sourceItem` 등)를 넣는다. 내장 변수의 목록과 모양은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 가 정하고 이 표는 엔진이 어디서 값을 채우는지만 보인다.

**Template 노드 예외(입력 최상위 펼치기)**: `template` 노드에 한해 입력이 배열이 아닌 객체면 엔진이 `buildExpressionContext` 직후 그 최상위 키들을 컨텍스트 최상위 변수로 펼친다. `{{ name }}` 이 `{{ $input.name }}` 과 같아진다. 다만 `$` 내장 변수 등 기존 키와 이름이 같으면 기존 키를 남긴다(`Object.hasOwn` 가드). 입력이 배열이나 원시값이면 펼치지 않는다. 기준 코드는 `execution-engine.service.ts` 의 `NODE_TYPES.TEMPLATE` 분기이고 노드 동작은 [Template 노드](../CLE-NODE-PRES/CLE-NODE-TEMPLATE.md) 에 있다.

**엔진이 미리 평가하지 않는 키**: `code.code`(원시 JavaScript, 자체 런타임 사용), `table.columns`(항목마다 평가), `filter.conditions`(항목 기준 필드 경로), `loop.breakCondition`(회차마다 다시 평가) 는 미리 평가하지 않는다. `loop.breakCondition` 을 dispatch 시점에 미리 평가하면 `i=0` 으로 고정되고 첫 회차 전에는 `$loop` 가 없어 예외가 난다. 기준은 코드 상수 `EXPRESSION_EXCLUSIONS`(`expression-exclusions.ts`)이고 목록과 이유는 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 가 정한다. `template` 노드는 자체 `{{ }}` 파서를 쓰지만 이는 핸들러 내부 동작이고 제외 목록에는 없다.

## 노드 실행 흐름

이 흐름은 세그먼트 안에서 dispatch 루프가 노드마다 같은 프로세스에서 직접 돈다(in-process dispatch). 노드마다 큐 작업을 만들지 않는다([큐 워커와 동시 실행 제한](CLE-EXEC-WORKER.md)). 노드 단위 큐를 기각한 근거는 [큐 워커와 동시 실행 제한 §노드 단위 큐 대신 실행 단위 시작 큐](CLE-EXEC-WORKER.md#노드-단위-큐-대신-실행-단위-시작-큐-2026-06-04-결정-pr1) 에 있다.

1. dispatch 루프가 포인터를 옮겨 다음 노드를 고른다.
2. `registry.get(nodeType)` 으로 핸들러를 찾는다. 등록되지 않은 유형이면 메시지가 `UNKNOWN_NODE_TYPE: ` 로 시작하는 에러를 던진다.
3. `handler.validate(rawConfig)` 가 실패하면 메시지가 `INVALID_NODE_CONFIG: ` 로 시작하고 검증 메시지를 이어 붙인 에러를 던진다. 이 이름은 메시지 접두이고 구조화된 `error.code` 는 없다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) §6.5).
4. `ExpressionResolver.resolveConfig(rawConfig)` 로 `resolvedConfig` 를 만든다.
5. `handler.execute(input, resolvedConfig, { ...context, rawConfig })` 로 출력을 받는다. 노드 재시도 정책이면 `ExecutionEngineService.executeWithRetry` 가 이 단계를 되풀이한다.
6. 출력이 JSON 으로 직렬화되는지 확인한다.
7. 노드 실행 행에 입력·출력·상태를 기록한다.
8. 그래프 순회에 따라 포인터를 옮긴다.

2단계와 3단계의 에러는 노드 실행 행을 실행 중으로 만든 뒤에 나고 `executeNode` 의 catch 로 간다. 그래서 다른 실행 실패와 같이 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 을 따른다. 5단계의 노드 재시도는 이 두 에러를 되풀이하지 않는다.

```mermaid
flowchart TD
  A["다음 노드 선택"] --> B{"레지스트리에 핸들러가 있나?"}
  B -- "아니오" --> Y["UNKNOWN_NODE_TYPE: 접두 에러"]
  B -- "예" --> C{"validate(rawConfig) 통과?"}
  C -- "아니오" --> X["INVALID_NODE_CONFIG: 접두 에러"]
  C -- "예" --> D["resolveConfig 로 평가된 설정 만들기"]
  D --> E["execute(input, resolvedConfig, context)"]
  E --> F["출력 직렬화 확인"]
  F --> G["노드 실행 행 기록"]
  G --> H["포인터 이동"]
  X --> P["노드 에러 처리 정책"]
  Y --> P
```

### 핸들러용 실행 컨텍스트는 노드 실행마다 하나다

`executeNode` 는 핸들러에 넘길 실행 컨텍스트 복사본을 노드 실행마다 한 번 만든다. 이 절 제목의 «핸들러용 실행 컨텍스트» 는 이 복사본을 말한다. 복사본은 `{ ...context, rawConfig }` 에 `nodeId` · `nodeExecutionId` 같은 노드 실행 값을 더한 객체다. 노드 재시도 정책이면 `ExecutionEngineService.executeWithRetry` 가 모든 시도에서 이 복사본으로 핸들러를 다시 부른다. 시도마다 새 복사본을 만들지 않는다. 그래서 핸들러가 이 복사본을 키로 둔 값은 같은 노드 실행의 재시도 사이에 남고 다른 노드 실행이나 병렬 분기의 값과는 섞이지 않는다. 이 단위로 만드는 이유는 [Rationale](#실행-컨텍스트-복사본은-노드-실행-단위로-만든다-2026-10-25) 에 있다.

## 노드 재시도 기본값

사용자는 노드 설정 패널의 에러 처리 정책에서 Retry 를 골라 재시도를 켤 수 있다. 기본 정책은 워크플로우 중단이고 재시도는 사용자가 Retry 를 고를 때만 적용한다. 재시도 설정의 기본값(`maxRetries` 3 등)은 노드 카테고리와 상관없이 같다. 값과 규칙은 [노드 에러 처리 정책 §3. 노드 재시도 설정](../CLE-NODE/CLE-NODE-ERROR.md#3-노드-재시도-설정) 과 [노드 포트와 설정 패널](../CLE-WF/CLE-WF-NODEPANEL.md) 이 정한다. 엔진 원문의 카테고리별 기본 재시도 표를 옮기지 않은 이유는 [Rationale](#rationale) 에 있다.

## 구현 위치

- `codebase/backend/src/nodes/core/node-handler.interface.ts` (`NodeHandler`, `NodeHandlerOutput`)
- `codebase/backend/src/nodes/core/node-handler.registry.ts`
- `codebase/backend/src/nodes/core/node-type-metadata.ts`
- `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts`
- `codebase/backend/src/modules/execution-engine/expression/expression-exclusions.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`executeNode`, `executeWithRetry`, `applyPortSelection`, `stripControlFields`, Template 입력 펼치기)
- `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` (`toEngineFlatShape`, `isWrappedValueEnvelope`)

## Rationale

### 핸들러에 원본 설정을 노출한다 (Engine Raw Config Exposure)

- 엔진은 평가 전 원본 설정을 `ExecutionContext.rawConfig`(멀티턴 재개 턴은 `state.rawConfig`)로 핸들러에 넘긴다.
- 핸들러는 `NodeHandlerOutput.config` 에 원본을 에코하고 표현식 평가 결과는 `output.*` 에 둔다.
- 재실행 정책은 조회(저장된 평가 결과 표시)와 재실행(원본을 다시 평가해 새 실행)으로 나눈다. 멀티턴 재개는 재실행이 아니다([실행 컨텍스트](CLE-EXEC-CONTEXT.md)).
- 설정과 출력 양쪽에 같은 평가 결과를 두는 안은 설정·출력 직교성을 어겨 기각했다.
- 2026-08-24 에 `config` 에는 저장 시점 마스킹이 없고 마스킹은 나가는 응답에서만 한다는 점을 명문화했다.

남은 후속 과제:

- AI 에이전트 `buildMultiTurnFinalOutput`·`buildConditionOutput` 의 원본 설정 전달(멀티턴 캐시 수명주기 영향 분석 필요)
- 정보 추출기 `multiTurnConfigEcho` 의 원본 설정 전달
- Carousel·Table 에 256KB 상한을 적용하는 정책

### 노드 유형 분기를 메타데이터로 바꾼다 (PR-G)

엔진 dispatch 에 노드 유형 이름을 하드코딩하면 새 특수 노드를 넣을 때마다 엔진 분기를 고쳐야 한다. 등록 때 `kind` 를 함께 받으면 엔진은 `kind` 만 보고 경로를 고른다. 메타데이터가 없는 유형은 `standard` 로 처리해 명시 분기 없이도 안전하다.

부팅 검증을 production 에서만 예외로 막는 것은 테스트가 메타데이터 없이 핸들러를 등록할 수 있게 하려는 것이다. 그런 등록은 기본값으로 안전하게 동작한다.

### 노드 카테고리별 기본 재시도 표를 옮기지 않는다

엔진 원문 §5.7 에는 카테고리별 기본 재시도 표가 있었다. Integration 은 최대 3회, AI 는 최대 2회, Flow 는 최대 1회를 지수 백오프로 재시도하고 Logic·Data·Presentation 은 재시도하지 않으며 설정도 막는다는 내용이다. 노드 에러 처리 정책을 소유한 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 과 [노드 포트와 설정 패널](../CLE-WF/CLE-WF-NODEPANEL.md) 은 모든 노드의 기본 정책을 워크플로우 중단으로 두고 재시도는 사용자가 고를 때만 적용한다. 현재 구현(`error-policy.handler.ts`)에도 카테고리별 기본값은 없고 Retry 를 고를 때의 `maxRetries` 기본값 3 만 있다. 그래서 이 문서는 소유 문서를 따르고 카테고리 표는 옮기지 않았다.

### 실행 컨텍스트 복사본은 노드 실행 단위로 만든다 (2026-10-25)

노드 실행마다 만드는 실행 컨텍스트 복사본을 시도 단위나 실행 전체 단위로 만들지 않는 이유다.

- 시도마다 새 복사본을 만들면 복사본을 키로 둔 값이 시도 사이에 이어지지 않는다. 결정 당시에는 [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md) 의 `rejectedLookups` 가 그런 값이었다. 이 임시 장치는 2026-11-05 NERV Task `CLE-T-PTC4SF` 에서 지웠다.
- 노드 실행을 넘어 복사본을 공유하면 병렬 분기의 노드 실행이 같은 복사본을 쓰게 되어 값이 섞인다.

### 배열 · 원시값 출력의 엔진 내부 객체를 표지로 가른다 (2026-11-05)

[포트 선택](#포트-선택)의 엔진 내부 `{ data }` 객체를 다음 노드에 넘기지 않으려고 고른 방식이다(NERV Task `CLE-T-T30D5S`).

- 엔진은 라우팅(`_selectedPort`)과 대기 판정(`status`)을 값의 최상위 키로 읽는다. 배열 · 원시값에는 키를 달 수 없어 엔진 안에서는 `{ data }` 객체가 필요하다.
- 모양(`data` 키와 제어 필드)으로 이 객체를 알아보는 안은 기각했다. 사용자가 `{ data: [...] }` 객체를 돌려주고 `port` 가 붙으면 같은 모양이 되어 사용자 객체를 잘못 풀게 된다.
- 엔진 캐시에 제어 필드를 따로 두어 `{ data }` 객체를 없애는 안은 미뤘다. 라우팅 · 대기 판정 · 재개 · 서브워크플로 경로를 모두 바꿔야 하고, 객체 출력과 분기 노드의 포트 라우팅을 바꾸지 않는다는 작업 경계를 넘는다.
- 컨테이너 입력에 한해 `meta` 만 있을 때 감싸지 않게 한 앞선 수정(NERV Task `CLE-T-3HJ8MM`)은 일반 노드에 같은 결함을 남겼다. 라우팅은 `meta` 를 읽지 않으므로 모든 노드에서 `meta` 만으로는 감싸지 않게 바꿨다.
- 표지는 `WeakSet` 이라 값의 모양과 JSON 직렬화를 바꾸지 않는다. 대신 객체를 새로 만들면 표지가 따라가지 않으므로 객체를 새로 만드는 `applyPortSelection` 이 표지를 옮긴다.

### `null` 출력도 같은 객체에 싣는다 (2026-11-05)

Code 노드가 `null` 을 돌려주거나 아무것도 돌려주지 않을 때 `success` 포트만 열리게 하려고 고른 방식이다(NERV Task `CLE-T-X3AH4F`).

- 전에는 `null` 출력에 설정 에코와 제어 필드를 펼쳤다. 그 값에는 `data` 가 없어서 엔진이 고른 포트(`_selectedPort`)를 두지 않았고 출력 포트가 모두 열렸다. 다음 노드도 설정 에코를 입력으로 받았다.
- 배열 · 원시값과 같은 표지 객체에 싣는 쪽을 골랐다. 다음 노드의 `$input` 과 `$node["X"].output` 은 핸들러가 둔 값(`null` · `undefined`)을 받는다.
- 모든 `null` 출력을 감싸는 안은 기각했다. 입력 대기 노드는 `output` 을 `null` 로 두고 대기 선언을 설정 쪽에 싣는다. 엔진이 이 선언을 최상위에서 읽으므로 펼친 모양을 유지한다. 다른 `status` 값과 재개 상태(`_resumeState`)를 실은 출력도 엔진이 최상위 키로 읽어서 그대로 둔다.
- Parallel 의 분기 선언(포트 배열)은 포트 하나를 고르는 출력이 아니어서 이 규칙에서 뺐다.
- 핸들러마다 `null` 출력을 고치는 안도 기각했다. `output: input` 으로 입력을 넘기는 분기 노드(If/Else · Switch · Background)도 앞 노드가 `null` 을 내면 같은 결함이 있다. 엔진 한 곳에서 고쳐야 빠지는 노드가 없다.

### 원본 설정 노출 요구를 요구사항 줄로 옮겼다 (2026-11-13)

NERV Task `CLE-T-VQX844` 에서 [원본 설정 노출 요구](#원본-설정-노출-요구) 의 표를 요구사항 줄 형식으로 옮겼다. 표의 옛 레이블은 `ENG-RC-01` → REQ-HANDLER-001, `ENG-RC-02` → REQ-HANDLER-002, `ENG-RC-03` → REQ-HANDLER-003, `ENG-RC-04` → REQ-HANDLER-004 로 대응한다. 다른 문서와 코드 주석이 옛 레이블을 인용하므로 각 줄 끝에 원본 레이블을 남겼다.

- `ENG-RC-01` 은 «`node.config` 에 표현식이 들어 있으면» 원본을 보존한다고 적었다. 엔진은 표현식이 있는지 보지 않고 모든 호출에 원본의 얕은 복사본을 얼려 넣는다. 2026-11-13 에 그 조건을 빼고 구현에 맞췄다.
- 표의 우선순위 칸(모두 필수)과 상태 칸(모두 구현)은 옮기지 않았다. 요구사항 줄에 미구현 표시가 없으면 구현된 요구다.

### 엔진 에러 이름을 메시지 접두로 적는다 (2026-11-13)

이전 판은 [노드 실행 흐름](#노드-실행-흐름) 에서 `INVALID_NODE_CONFIG` 를 실패 코드처럼 적었고, 레지스트리 절은 `UNKNOWN_NODE_TYPE` 을 에러 이름으로만 적었다. 두 이름 모두 엔진이 일반 `Error` 메시지 앞에 붙이는 접두이고 `error.code` 로 실리지 않는다. [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) §6.5 도 `INVALID_NODE_CONFIG` 를 행이 없는 메시지 접두로 둔다. 2026-11-13 에 두 이름을 메시지 접두로 고쳐 적었다.

- 구조화 코드로 등록하는 안은 이 문서에서 다루지 않았다. 동작을 바꾸는 일이고 카탈로그 소유 문서가 정한다.
- AI 어시스턴트 도구 결과의 `error: 'UNKNOWN_NODE_TYPE'` 은 도구 응답 값이라 이 접두와 따로 둔다. 카탈로그가 `CONTAINER_INVALID_CHILD` 에 대해 같은 구분을 적는다.
