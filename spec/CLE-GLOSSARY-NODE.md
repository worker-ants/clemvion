---
id: "CLE-GLOSSARY-NODE"
title: "용어 사전 — 노드"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-GLOSSARY"
ancestors: ["CLE-VISION", "CLE-GLOSSARY"]
area: null
content_hash: "407eda026caec4736f6192a1a371f2813f4d16c0cdd06ba66949473f3439a2b9"
read_as: "approved_fallback"
task: "CLE-T-SJAYNM"
source_paths: []
mirror_sha256: "beaad84bd3643eab57321fbfe41e81bc66e6855c3740ce16aa431c978eb5b6e7"
etag: "sha256-653e5fc4d2d6e46da9b9e715f68a88a604b02aa174cd74bf1e65c511a6862f26"
---
## 개요

[용어 사전](CLE-GLOSSARY.md) 의 「노드」 영역 용어다. 표기 원칙 · 약어 · 상태값 표기는 [용어 사전](CLE-GLOSSARY.md) 에 있고, 여러 영역에 걸친 같은 말은 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 이 가른다.

표는 `표준 용어 · 영문과 코드 식별자 · 정의 · 쓰지 않는 표기 · 기준 문서` 순서다. "쓰지 않는 표기" 에 괄호로 붙은 조건은 그 뜻일 때만 쓰지 않는다는 뜻이다.

## 용어

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 노드 | Node, `node` | 입력을 받아 처리하고 출력을 내는 워크플로우 구성 요소. | Node(본문), 노드 인스턴스 | [노드 시스템 구조와 카탈로그](CLE-NODE/CLE-NODE-ARCH.md) |
| 노드 유형 | node type, `Node.type` | 노드 핸들러를 고르는 문자열(`if_else`, `ai_agent`, `http_request` 등). | 노드 타입 | [노드 시스템 구조와 카탈로그](CLE-NODE/CLE-NODE-ARCH.md) |
| 노드 카테고리 | node category, `Node.category` | 노드 팔레트 구획과 색을 정하는 일곱 가지 분류. 트리거·Logic·Flow·AI·통합·Data·Presentation 이다. | category(본문) | [노드 시스템 구조와 카탈로그](CLE-NODE/CLE-NODE-ARCH.md) |
| 노드 핸들러 | node handler, `NodeHandler` | 노드 유형마다 있는 실행 코드. 엔진이 정해진 계약으로 부른다. | 없음 | [노드 핸들러 계약](CLE-EXEC/CLE-EXEC-HANDLER.md) |
| 노드 정의 | node definition | 노드 유형의 설정 스키마·포트·메타데이터 묶음. | 없음 | [노드 시스템 구조와 카탈로그](CLE-NODE/CLE-NODE-ARCH.md) |
| 노드 출력 | node output, `NodeHandlerOutput` | 핸들러가 돌려주는 다섯 필드 객체(`config`, `output`, `meta`, `port`, `status`). DB 에는 `NodeExecution.outputData` 로, 실시간 이벤트에는 `output` 으로 통째로 실린다. | 봉투(이 뜻으로), envelope(이 뜻으로), 래퍼, 5필드 invariant, 노드 출력 envelope | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) |
| 출력 값 | output value, `output` 필드 | 노드 출력 안의 주 데이터. 다음 노드는 `$node["X"].output` 으로 읽는다. 실시간 이벤트에서는 한 겹 아래 `output.output` 에 있다. | output(본문 단독) | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) |
| 설정 에코 | config echo, `config` 필드 | 표현식을 평가하기 전 원래 설정을 노드 출력 `config` 에 다시 싣는 규칙. 자격 증명은 싣지 않는다. | raw echo, config echo(본문) | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) |
| 원본 설정 | raw config, `rawConfig` | 표현식을 평가하기 전 노드 설정. 평가한 뒤의 설정은 "평가된 설정(`resolvedConfig`)" 이다. | pre-evaluation config | [실행 컨텍스트](CLE-EXEC/CLE-EXEC-CONTEXT.md) |
| 실행 메트릭 | `meta` 필드 | 소요 시간·토큰·상태 코드처럼 관측용 값. | 실행 메타데이터 | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) |
| 출력 포트 선택 | `port` 필드 | 노드가 이번에 값을 내보낼 출력 포트 ID. | 없음 | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) |
| 흐름 지시 상태 | `status` 필드 | 엔진 흐름을 바꾸는 핸들러 반환 값(`waiting_for_input`, `resumed`, `ended`, `requires_integration`). 실행·노드 실행 기록의 상태와 층이 다르다. | status(단독), 흐름 제어 상태 | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) |
| 패스스루 | pass-through | 입력을 바꾸지 않고 출력으로 넘기는 노드 규약. If/Else·Switch·변수 선언·변수 수정·Background 가 따른다. | 패스 스루, Pass-through(본문) | [Logic 노드 공통](CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) |
| 사전 검증 에러 | pre-flight error, `handler.validate` | 설정이나 그래프 문제로 핸들러가 시작하기 전에 던지는 에러. 에러 포트로 가지 않고 실행을 실패로 끝낸다. | Pre-flight(본문), pre-flight throw | [노드 에러 처리 정책](CLE-NODE/CLE-NODE-ERROR.md) |
| 런타임 에러 | runtime error, `output.error` | 외부 호출 실패처럼 실행 중에 난 에러. 에러 포트와 `output.error` 로 내보낸다. | 없음 | [노드 에러 처리 정책](CLE-NODE/CLE-NODE-ERROR.md) |
| 에러 처리 정책 | Error Handling, `config.errorHandling.policy` | 노드가 실패했을 때의 동작. 워크플로우 중단·노드 건너뛰기·기본 출력 사용·재시도·에러 포트로 라우팅 다섯 가지다. 화면 라벨은 "오류 처리" 다. | 에러 정책, 실패 정책, errorPolicy(이 뜻으로) | [노드 에러 처리 정책](CLE-NODE/CLE-NODE-ERROR.md) |
| 항목 에러 정책 | item error policy, `config.errorPolicy` | ForEach·Map·Parallel 이 항목이나 분기 하나가 실패할 때 쓰는 정책(`stop`, `skip`, `continue`, `cancel-others-on-fail`). 에러 처리 정책과 다른 설정이다. | errorPolicy(본문 단독) | [Logic 노드 공통](CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) |
| 기본 출력 | default output, `defaultOutput` | 에러 처리 정책이 "기본 출력 사용" 일 때 실패 대신 내보내는 JSON. | 기본 출력값 | [노드 에러 처리 정책](CLE-NODE/CLE-NODE-ERROR.md) |
| 노드 재시도 | node retry, `retryConfig` | 에러 처리 정책의 재시도. 최대 횟수와 간격을 정해 같은 노드를 다시 부른다. | 리트라이 정책 | [노드 에러 처리 정책](CLE-NODE/CLE-NODE-ERROR.md) |
| 엔진 덮어쓰기 | engine override | 컨테이너와 Parallel 이 끝나면 엔진이 출력 값을 `{ <컬렉션 키>, count }` 로 바꾸는 계약. | 엔진 오버라이트, 오버라이트 컨트랙트 | [컨테이너 실행](CLE-EXEC/CLE-EXEC-CONTAINER.md) |
| 컬렉션 키 | collection key | 엔진 덮어쓰기 결과의 배열 키. Loop 는 `iterations`, ForEach 는 `items`, Map 은 `mapped`, Parallel 은 `branches` 다. | 컬렉션(배열 뜻으로 단독) | [컨테이너 실행](CLE-EXEC/CLE-EXEC-CONTAINER.md) |
| 블로킹 노드 | blocking node | 사용자 입력을 기다리며 실행을 멈추는 노드. Form 노드, 버튼이 있는 Presentation 노드, 멀티턴 AI 노드다. | 인터랙션 노드(이 뜻으로), 대기 노드(이 뜻으로) | [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md) |
| 노드 샌드박스 | sandbox, `isolated-vm` | Code 노드를 별도 V8 격리 환경에서 메모리·시간 제한을 걸고 실행하는 정책. 지금은 Code 노드에만 쓴다. | 샌드박싱(다른 노드에도 쓰는 것처럼) | [Code 노드](CLE-NODE-DATA/CLE-NODE-CODE.md) |
| 수동 트리거 노드 | Manual Trigger, `manual_trigger` | 워크플로우마다 정확히 하나 있는 진입 노드. 이름과 달리 수동·웹훅·스케줄 실행이 모두 이 노드에서 시작한다. | 시작 노드, 트리거 노드(이 뜻으로 단독), Manual Trigger(본문) | [수동 트리거 노드](CLE-NODE-TRIG/CLE-NODE-MANUAL.md) |
| 트리거 파라미터 | trigger parameters, `config.parameters` | 수동 트리거 노드가 받는 입력 스키마. 검증과 기본값 적용을 거친 값은 `output.parameters` 로 나온다. | 트리거 진입 파라미터 | [트리거 노드 공통](CLE-NODE-TRIG/CLE-NODE-TRIG-COMMON.md) |
| 진입 어댑터 | trigger adapter | 실행 버튼·웹훅 HTTP 요청·스케줄 입력을 트리거 파라미터로 바꾸는 계층. 채널 어댑터와 다르다. | 실행 어댑터, 트리거 어댑터, 어댑터(단독) | [트리거 노드 공통](CLE-NODE-TRIG/CLE-NODE-TRIG-COMMON.md) |
| 진입 경로 표시 | `meta.source` | 수동 트리거 노드가 어느 경로(`manual`, `webhook`, `schedule`)로 실행됐는지 남기는 값. | 없음 | [트리거 노드 공통](CLE-NODE-TRIG/CLE-NODE-TRIG-COMMON.md) |
| If/Else 노드 | If/Else, `if_else` | 조건 결과에 따라 참·거짓 포트 가운데 하나로 보내는 노드. | IF 노드 | [If/Else 노드](CLE-NODE-LOGIC/CLE-NODE-IFELSE.md) |
| Switch 노드 | Switch, `switch` | 값이나 조건에 맞는 케이스 포트로 보내는 노드. | 없음 | [Switch 노드](CLE-NODE-LOGIC/CLE-NODE-SWITCH.md) |
| 케이스 | case, `CaseDef` | Switch 의 분기 정의. 케이스 ID 가 곧 동적 포트 ID 다. 맞는 케이스가 없으면 기본 경로(`default`)로 간다. | case(본문) | [Switch 노드](CLE-NODE-LOGIC/CLE-NODE-SWITCH.md) |
| 조건 | Condition | 필드·연산자·값으로 된 비교식. 여러 조건은 `combineMode`(and, or)로 묶는다. 조건을 겹겹이 묶는 구조는 없다. | 조건 그룹, ConditionGroup | [Logic 노드 공통](CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) |
| 비교 연산자 | operators, `eq`, `neq`, `contains` 등 | 조건 노드가 함께 쓰는 연산자 집합. 본문에는 snake_case 값을 그대로 쓴다. | ==, != 같은 기호 표기 | [Logic 노드 공통](CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) |
| 엄격 비교 | `strictComparison` | 타입 변환 없이 비교하는 조건 옵션. 기본은 꺼져 있다. | Strict 모드 | [Logic 노드 공통](CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) |
| Loop 노드 | Loop, `loop` | 정한 횟수만큼 본문을 반복하는 컨테이너. | 없음 | [Loop 노드](CLE-NODE-LOGIC/CLE-NODE-LOOP.md) |
| 최대 반복 횟수·Break 조건 | `maxIterations`, `breakCondition` | Loop 반복 상한과 조기 종료 조건. 끝난 이유는 `meta.exitReason` 에 남는다. | 없음 | [Loop 노드](CLE-NODE-LOGIC/CLE-NODE-LOOP.md) |
| 반복 회차 | iteration | 컨테이너 본문이 한 번 도는 것. 노드 실행 기록 한 행에 대응한다. | 이터레이션, iter | [컨테이너 실행](CLE-EXEC/CLE-EXEC-CONTAINER.md) |
| ForEach 노드 | ForEach, `foreach` | 배열 항목마다 본문을 차례로 실행하는 컨테이너. | 없음 | [ForEach 노드](CLE-NODE-LOGIC/CLE-NODE-FOREACH.md) |
| Map 노드 | Map, `map` | 배열 항목마다 본문을 실행해 변환 결과 배열을 만드는 컨테이너. | 없음 | [Map 노드](CLE-NODE-LOGIC/CLE-NODE-MAP.md) |
| Filter 노드 | Filter, `filter` | 조건에 맞는 배열 항목만 남기는 노드. | 없음 | [Filter 노드](CLE-NODE-LOGIC/CLE-NODE-FILTER.md) |
| Split 노드 | Split, `split` | 배열을 항목 단위로 나누는 노드. 컨테이너가 아니다. | 없음 | [Split 노드](CLE-NODE-LOGIC/CLE-NODE-SPLIT.md) |
| 변수 선언 노드 | Variable Declaration, `variable_declaration` | 워크플로우 변수를 새로 등록하는 노드. 같은 이름이 있으면 덮어쓰지 않는다. 캔버스 표시 이름은 "Variable" 이다. | Variable Declaration(본문), var_decl | [변수 선언 노드](CLE-NODE-LOGIC/CLE-NODE-VARDECL.md) |
| 변수 수정 노드 | Variable Modification, `variable_modification` | 워크플로우 변수 값을 set·increment·append 같은 연산으로 바꾸는 노드. 캔버스 표시 이름은 "Set Variable" 이다. | Set Variable(본문), var_mod | [변수 수정 노드](CLE-NODE-LOGIC/CLE-NODE-VARSET.md) |
| 시스템 예약 변수 | reserved variables, `__` 접두 | 엔진이 워크플로우 변수에 넣는 `__workspaceId`, `__dryRun` 같은 값. 사용자 변수 이름으로 쓸 수 없다. | 예약 네임스페이스 | [실행 컨텍스트](CLE-EXEC/CLE-EXEC-CONTEXT.md) |
| Parallel 노드 | Parallel, `parallel` | 같은 입력으로 여러 분기를 동시에 실행하는 노드. 컨테이너는 아니지만 엔진 덮어쓰기를 받는다. | 병렬 컨테이너 | [Parallel 노드](CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md) |
| 병렬 분기 | branch, `branch_<i>` | Parallel 의 분기 포트에서 시작해 동시에 실행하는 노드 묶음. 조건 노드의 경로 선택과 구분한다. | 분기(단독) | [Parallel 노드](CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md) |
| 동시 실행 수 | `maxConcurrency` | Parallel 분기를 한 번에 몇 개 돌릴지 정하는 값. 워크스페이스 동시 실행 제한과 다르다. | 없음 | [Parallel 노드](CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md) |
| Merge 노드 | Merge, `merge` | 여러 선행 노드 결과를 하나로 합치는 노드. | 없음 | [Merge 노드](CLE-NODE-LOGIC/CLE-NODE-MERGE.md) |
| 병합 전략 | `strategy` | Merge 가 결과를 모으는 방식(`wait_all`, `first`, `append`). | 없음 | [Merge 노드](CLE-NODE-LOGIC/CLE-NODE-MERGE.md) |
| Background 노드 | Background, `background` | 본문을 별도 큐에서 비동기로 돌리고 메인 흐름은 바로 다음으로 넘기는 노드. 컨테이너로 부르지 않는다. | 특수 컨테이너, 백그라운드 노드 | [Background 노드](CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) |
| Background 본문 실행 | background run, `backgroundRunId` | Background 노드 본문이 한 번 도는 단위. 메인 실행과 실행 ID 를 함께 쓴다. | background run(본문), 본문 run, 백그라운드 실행 | [Background 노드](CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) |
| fire-and-forget | fire-and-forget | 부모가 결과를 기다리지 않는 실행. Background 본문과 워크플로우 호출 노드 비동기 모드가 해당한다. | 없음 | [Background 노드](CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) |
| 본문 실패 알림 | `notifyOnFailure` | Background 본문이 실패하면 워크스페이스 관리자에게 인앱 알림을 보내는 옵션. 이메일은 보내지 않는다. | 없음 | [Background 노드](CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) |
| 워크플로우 호출 노드 | Workflow node, `workflow` | 다른 워크플로우를 동기 또는 비동기로 부르는 Flow 노드. | Workflow 노드, 워크플로우 노드 | [워크플로우 호출 노드](CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| 서브 워크플로우 | sub-workflow | 워크플로우 호출 노드가 부른 워크플로우와 그 실행. | 하위 워크플로우, 하위 워크플로, sub-workflow(본문), Sub-Workflow | [워크플로우 호출 노드](CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| 동기 호출·비동기 호출 | sync mode, async mode | 동기 호출은 부모 실행 안에서 바로 돌려 결과를 받는다(`executeInline`). 비동기 호출은 자식 실행을 따로 만들고 추적 ID 만 받는다(`executeAsync`). | 없음 | [워크플로우 호출 노드](CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| 입력 매핑 | `inputMapping` | 서브 워크플로우에 넘길 파라미터를 표현식으로 정하는 설정. | 입력 파라미터 매핑 | [워크플로우 호출 노드](CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| 재귀 깊이 | `recursionDepth` | 서브 워크플로우가 중첩된 깊이. 10 이상이면 실패한다. | 없음 | [워크플로우 호출 노드](CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| AI 노드 | AI nodes | AI 에이전트·텍스트 분류기·정보 추출기 세 노드. | LLM 3 노드, LLM 계열 노드, AI 카테고리 3 노드 | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| AI 에이전트 노드 | AI Agent, `ai_agent` | LLM 으로 응답을 만들고 지식 저장소·MCP·조건·표시 도구를 부르는 노드. | AI Agent(본문) | [AI 에이전트 노드](CLE-NODE-AI/CLE-NODE-AGENT.md) |
| 텍스트 분류기 노드 | Text Classifier, `text_classifier` | 입력 텍스트를 정의한 카테고리로 나누고 카테고리마다 포트로 보내는 노드. | 분류 노드, 텍스트 분류 | [텍스트 분류기 노드](CLE-NODE-AI/CLE-NODE-CLASSIFIER.md) |
| 정보 추출기 노드 | Information Extractor, `information_extractor` | 비정형 텍스트에서 출력 스키마 필드를 뽑는 노드. 캔버스 표시 이름은 "Info Extractor" 다. | Info Extractor(본문), IE(본문), 추출 노드, 추출기 | [정보 추출기 노드](CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) |
| AI 실행 모드 | `mode` | AI 노드가 LLM 을 한 번 부르고 끝나는지(단일 턴), 사용자와 여러 번 대화하는지(멀티턴) 정하는 설정. | 없음 | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 멀티턴 | multi-turn, `multi_turn` | AI 노드가 사용자 메시지를 기다리며 여러 턴 대화하는 모드. AI 에이전트와 정보 추출기만 쓸 수 있다. | Multi Turn, multi-turn(본문), Multi-turn, AI Multi Turn | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 단일 턴 | single-turn, `single_turn` | LLM 을 한 번 부르고 끝나는 모드. | Single Turn, single-turn(본문) | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 대화 턴 | turn | 사용자 메시지 한 번과 그에 대한 LLM 응답(도구 호출 포함) 한 주기. 대화 스레드의 기록 한 건은 "대화 기록 항목" 이다. | turn(본문 단독) | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 최대 턴 수·턴 수 | `maxTurns`, `turnCount` | 멀티턴 대화가 이어질 수 있는 최대 턴과 지금까지 진행한 턴. | 없음 | [AI 에이전트 노드](CLE-NODE-AI/CLE-NODE-AGENT.md) |
| 조건 도구 | condition tool, `cond_*` | AI 에이전트의 판단 분기를 LLM 도구로 노출한 것. LLM 이 부르면 그 조건 포트로 끝난다. | 조건 포트(도구 뜻으로) | [AI 에이전트 노드](CLE-NODE-AI/CLE-NODE-AGENT.md) |
| 지식 저장소 도구 | KB tool, `kb_*` | 지식 저장소 하나를 LLM 검색 도구로 노출한 것. LLM 이 스스로 부를 때만 검색한다. | KB 도구, KB tool(본문), KB 검색 도구 | [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| MCP 도구 | MCP tool, `mcp_<sid>__<name>` | MCP 지원 통합의 도구를 LLM 도구로 노출한 것. | 없음 | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| 표시 도구 | presentation tools, `render_*` | AI 에이전트가 표·차트·캐러셀·템플릿·폼을 대화 안에 그리는 LLM 도구. `render_form` 만 사용자 입력을 기다린다. | 표현 도구, 가상 도구, Presentation Tool Family | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 표시물 페이로드 | `PresentationPayload` | 표시 도구가 만든 결과. 대화 기록 항목의 `presentations[]` 에 담긴다. | 없음 | [AI 에이전트 노드 출력과 디버그](CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md) |
| 도구 호출 한도 | `maxToolCalls` | AI 노드 한 번 실행에서 허용하는 도구 호출 횟수(기본 10). 조건 도구는 세지 않는다. | 없음 | [AI 에이전트 노드](CLE-NODE-AI/CLE-NODE-AGENT.md) |
| 도구 정의 크기 예산 | tool-definition payload budget | LLM 요청에 싣는 도구 정의 전체의 직렬화 크기 상한. 넘으면 LLM 을 부르기 전에 에러 포트로 보낸다. | 없음 | [AI 에이전트 노드](CLE-NODE-AI/CLE-NODE-AGENT.md) |
| 메모리 전략 | `memoryStrategy` | 대화 맥락을 다루는 방식. `manual` 은 대화 맥락 설정대로, `summary_buffer` 는 실행 안 롤링 요약, `persistent` 는 요약에 에이전트 메모리를 더한다. | 관리 축, 자동 컨텍스트 메모리 전략 | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 대화 맥락 설정 | Conversation Context, `contextScope` | 대화 스레드를 LLM 입력에 얼마나, 어떤 형식으로 넣을지 정하는 AI 노드 공통 설정. | 범위 축, contextScope 계열 5필드 | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 롤링 요약 | running summary, `runningSummary` | 한 실행 안에서 오래된 대화 턴을 줄여 둔 요약. | working-memory 압축, 요약 블록 | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 시스템 컨텍스트 접두 | `includeSystemContext` | AI 노드 시스템 프롬프트 앞에 현재 시각과 시간대를 자동으로 붙이는 옵션. | System Context Prefix(본문) | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 종료 사유 | `endReason` | AI 노드 대화가 끝난 이유. AI 에이전트는 4가지, 정보 추출기는 6가지다. | 없음 | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| 재시도 가능 여부 | `details.retryable` | LLM 계열 에러가 일시적인지 알리는 필수 필드. true 면 화면에 다시 시도 버튼이 보인다. | 없음 | [AI 노드 공통](CLE-NODE-AI/CLE-NODE-AI-COMMON.md) |
| LLM 호출 기록 | `meta.turnDebug`, `meta.llmCalls` | 턴마다 남기는 LLM 요청·응답 원문. 결과 상세의 응답·요청 탭이 쓴다. | 없음 | [AI 에이전트 노드 출력과 디버그](CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md) |
| 출력 스키마 | `outputSchema` | 정보 추출기가 뽑을 필드 목록. 설정 에코에서는 `schema` 키로 나온다. | 없음 | [정보 추출기 노드](CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) |
| 수집 재시도 | `maxCollectionRetries` | 정보 추출기 멀티턴에서 필수 필드가 비었을 때 다시 묻는 횟수. | 없음 | [정보 추출기 노드](CLE-NODE-AI/CLE-NODE-EXTRACTOR.md) |
| 분류 카테고리 | `CategoryDef` | 텍스트 분류기의 분류 항목. 맞는 항목이 없으면 `fallback` 포트로 간다. | 없음 | [텍스트 분류기 노드](CLE-NODE-AI/CLE-NODE-CLASSIFIER.md) |
| 통합 노드 | integration nodes | 통합을 참조해 외부 서비스를 부르는 다섯 노드(HTTP Request, Database Query, Send Email, Cafe24, MakeShop). | Integration 노드, integration 노드 | [통합 노드 공통](CLE-NODE-INT/CLE-NODE-INT-COMMON.md) |
| HTTP Request 노드 | HTTP Request, `http_request` | 외부 HTTP API 를 부르는 노드. | HTTP 노드 | [HTTP Request 노드](CLE-NODE-INT/CLE-NODE-HTTP.md) |
| Database Query 노드 | Database Query, `database_query` | 외부 데이터베이스에 SQL 을 실행하는 노드. | DB 노드 | [Database Query 노드](CLE-NODE-INT/CLE-NODE-DBQUERY.md) |
| Send Email 노드 | Send Email, `send_email` | SMTP 로 이메일을 보내는 노드. | 이메일 노드 | [Send Email 노드](CLE-NODE-INT/CLE-NODE-EMAIL.md) |
| Cafe24 노드 | Cafe24, `cafe24` | Cafe24 Admin API operation 을 부르는 노드. | 카페24 노드 | [Cafe24 노드](CLE-NODE-INT/CLE-NODE-CAFE24.md) |
| MakeShop 노드 | MakeShop, `makeshop` | MakeShop Shop API operation 을 부르는 노드. | 메이크샵 노드, Makeshop 노드 | [MakeShop 노드](CLE-NODE-INT/CLE-NODE-MAKESHOP.md) |
| 통합 참조 | `config.integrationId` | 노드가 쓸 통합의 ID. 설정 에코에는 자격 증명 대신 이 값만 남는다. | 없음 | [통합 노드 공통](CLE-NODE-INT/CLE-NODE-INT-COMMON.md) |
| 성공 포트 | success port, `success`, `out` | 정상 결과를 내보내는 출력 포트. 노드마다 이름이 다르다. | 없음 | [통합 노드 공통](CLE-NODE-INT/CLE-NODE-INT-COMMON.md) |
| 사설망 차단 | SSRF guard | 사설·loopback·메타데이터 주소로 나가는 연결을 막는 검사. 셀프 호스팅은 `ALLOW_PRIVATE_HOST_TARGETS` 로 끌 수 있다. | egress 방화벽 | [통합 노드 공통](CLE-NODE-INT/CLE-NODE-INT-COMMON.md) |
| Transform 노드 | Transform, `transform` | 변환 연산을 차례로 적용하는 노드. | 없음 | [Transform 노드](CLE-NODE-DATA/CLE-NODE-TRANSFORM.md) |
| 변환 연산 | `operations[]` | Transform 의 필드 이름 변경·타입 변환·배열 정렬 같은 단계. 대상이 없으면 에러 없이 건너뛴다. | 없음 | [Transform 노드](CLE-NODE-DATA/CLE-NODE-TRANSFORM.md) |
| Code 노드 | Code, `code` | 격리 환경에서 JavaScript 를 실행하는 노드. 워크플로우 변수는 `$vars` 로 읽는다. | 코드 노드 | [Code 노드](CLE-NODE-DATA/CLE-NODE-CODE.md) |
| Presentation 노드 | presentation nodes | 결과를 보여 주거나 사용자 입력을 받는 다섯 노드(Carousel, Table, Chart, Form, Template). | 인터랙션 노드(이 뜻으로), 시각형 노드(다섯 노드 전체 뜻으로) | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| Carousel 노드 | Carousel, `carousel` | 카드 여러 장을 넘겨 보는 형태로 결과를 보여 주는 노드. | 캐러셀 노드 | [Carousel 노드](CLE-NODE-PRES/CLE-NODE-CAROUSEL.md) |
| Table 노드 | Table, `table` | 결과를 표로 보여 주는 노드. | 테이블 노드 | [Table 노드](CLE-NODE-PRES/CLE-NODE-TABLE.md) |
| Chart 노드 | Chart, `chart` | 결과를 차트로 보여 주는 노드. | 차트 노드 | [Chart 노드](CLE-NODE-PRES/CLE-NODE-CHART.md) |
| Form 노드 | Form, `form` | 사용자에게 입력 폼을 보여 주고 제출을 기다리는 노드. 항상 블로킹 노드다. | Human-in-the-loop 노드 | [Form 노드](CLE-NODE-PRES/CLE-NODE-FORM.md) |
| Template 노드 | Template, `template` | 템플릿으로 텍스트·HTML 을 만들어 보여 주는 노드. | 템플릿 노드 | [Template 노드](CLE-NODE-PRES/CLE-NODE-TEMPLATE.md) |
| 시각형 노드 | visual nodes | Carousel·Table·Chart 세 노드. 채팅 채널 매핑에서 쓴다. | 없음 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 버튼 정의 | `ButtonDef` | Presentation 노드의 버튼. 포트로 보내는 포트 버튼(`port`)과 URL 을 여는 링크 버튼(`link`)이 있다. | 없음 | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 전역 버튼·항목 버튼 | global button, item button | 노드 전체에 붙는 버튼과 Carousel 항목마다 붙는 버튼. | 글로벌 버튼, per-item 버튼, 아이템 버튼 | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 계속 포트 | `continue` | 링크 버튼만 있을 때 자동으로 생기는 진행 포트. | Continue 포트 | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 블로킹 모드 | Blocking Mode | 버튼이나 폼 때문에 Presentation 노드가 입력 대기로 멈추는 동작. | Blocking 모드, Blocking Mode(본문) | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 표시 전용 | display-only | 버튼이 없어 기다리지 않고 바로 다음 노드로 넘어가는 Presentation 동작. 사용자 입력을 기다리지 않는 표시 도구 4종도 이렇게 부른다. | 비-블로킹, 표시-전용, Non-blocking | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 데이터 소스 방식 | `mode`: static, dynamic | 항목을 설정에 직접 적는 정적 모드와 표현식 배열에서 만드는 동적 모드. | Static Items, Dynamic (from input) | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 출력 크기 한도 | output size cap | Presentation 출력 배열이 1MB 를 넘으면 뒤에서부터 잘라 내는 한도. 잘렸는지는 `*Truncated`, `*TotalCount` 로 알린다. | tail-truncate | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 폼 필드 | `FormField` | Form 노드 입력 항목 정의. 이름·아홉 가지 유형·검증 규칙·파일 제약을 담는다. | 없음 | [Form 노드](CLE-NODE-PRES/CLE-NODE-FORM.md) |
| 재개 출력 | resumed output, `status: resumed` | 대기 노드가 입력을 받은 뒤 원래 출력에 사용자 입력 기록을 더해 다시 내는 출력. | 없음 | [Presentation 노드 공통](CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) |
| 사용자 입력 기록 | `output.interaction` | 재개 출력에 붙는 사용자 행동 내용(`button_click`, `button_continue`, `form_submitted`, `message_received`). | interaction payload | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) |

## Rationale

2026-10-02 까지 이 표는 [용어 사전](CLE-GLOSSARY.md) 한 문서의 「노드」 절이었다. 그 문서가 약 195KB 가 되어 NERV 초안 저장 한 번에 담기지 않아 영역별 문서로 나눴다. 정의는 옮기기만 했다. 표준을 고른 기준과 검토한 다른 선택은 [용어 사전](CLE-GLOSSARY.md) 의 Rationale 에 있다.
