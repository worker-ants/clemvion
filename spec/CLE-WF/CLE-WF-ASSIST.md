---
id: "CLE-WF-ASSIST"
title: "워크플로우 AI 어시스턴트"
type: "feature"
version: 11
status: "approved"
requirements: ["REQ-ASSIST-001", "REQ-ASSIST-002", "REQ-ASSIST-003", "REQ-ASSIST-004", "REQ-ASSIST-005", "REQ-ASSIST-006", "REQ-ASSIST-007", "REQ-ASSIST-008", "REQ-ASSIST-009", "REQ-ASSIST-010", "REQ-ASSIST-011", "REQ-ASSIST-012", "REQ-ASSIST-013", "REQ-ASSIST-014", "REQ-ASSIST-015", "REQ-ASSIST-016", "REQ-ASSIST-017", "REQ-ASSIST-018", "REQ-ASSIST-019", "REQ-ASSIST-020", "REQ-ASSIST-021", "REQ-ASSIST-022", "REQ-ASSIST-023", "REQ-ASSIST-024", "REQ-ASSIST-025", "REQ-ASSIST-026", "REQ-ASSIST-027", "REQ-ASSIST-028", "REQ-ASSIST-029", "REQ-ASSIST-030", "REQ-ASSIST-031", "REQ-ASSIST-032", "REQ-ASSIST-033", "REQ-ASSIST-034", "REQ-ASSIST-035", "REQ-ASSIST-036", "REQ-ASSIST-037", "REQ-ASSIST-038", "REQ-ASSIST-039", "REQ-ASSIST-040", "REQ-ASSIST-041", "REQ-ASSIST-042", "REQ-ASSIST-043", "REQ-ASSIST-044", "REQ-ASSIST-045", "REQ-ASSIST-046", "REQ-ASSIST-047", "REQ-ASSIST-048", "REQ-ASSIST-049", "REQ-ASSIST-050", "REQ-ASSIST-051", "REQ-ASSIST-052", "REQ-ASSIST-053", "REQ-ASSIST-054", "REQ-ASSIST-055", "REQ-ASSIST-056", "REQ-ASSIST-057", "REQ-ASSIST-058", "REQ-ASSIST-059", "REQ-ASSIST-060", "REQ-ASSIST-061", "REQ-ASSIST-062"]
basis_superseded: false
parent: "CLE-WF"
ancestors: ["CLE-VISION", "CLE-WF"]
area: "CLE-WF"
content_hash: "2c2a5b791511544edefbeafdfc29e7dd342effec93601b16dcc4646ae324c24c"
read_as: "approved_fallback"
task: "CLE-T-EK4DMX"
source_paths: ["spec/3-workflow-editor/4-ai-assistant.md", "spec/3-workflow-editor/_product-overview.md", "spec/4-nodes/3-ai/_product-overview.md"]
mirror_sha256: "3fc21885d6f8c986f4bdc51cc2bf3301faca129d26b0724e56a6c0be569e6e22"
etag: "sha256-c84af78a2d59465a7b483cc79ba25a3c756a8ca216cbb049d40cbecf46715844"
---
> 구현 상태: 구현됨 (요구사항에 미구현 · 부분 구현으로 표시한 항목 제외) · 원문: `spec/3-workflow-editor/4-ai-assistant.md` (§1~§3, §7~§13, §15, Rationale), `spec/3-workflow-editor/_product-overview.md` (§10), `spec/4-nodes/3-ai/_product-overview.md` (§3.6) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

AI 어시스턴트(Workflow AI Assistant, `workflow-assistant`)는 워크플로우 에디터 오른쪽 패널에 들어 있는 대화형 도우미다. 사용자가 자연어로 요구를 말하면 [모델 설정](../CLE-AI/CLE-AI-MODELS.md)에 등록된 모델로 노드와 연결선을 만들고 고친다. "HTTP 헤더 추가" 같은 단순 지시뿐 아니라 "주문 취소 프로세스 추가" 같은 모호하고 큰 요청도 대화로 구체화해 완성한다. AI 에이전트 노드와는 다른 기능이다.

대화는 탐색·계획·편집 단계(Clarify, Plan, Execute)를 오간다. 워크플로우 실행(`Run`)은 사용자가 한다. AI 어시스턴트는 실행 결과(노드별 입출력·에러·타임라인)를 읽기 전용 도구로 조회해 실패 원인을 진단하고 노드 수정을 제안한다.

| 목표 | 설명 |
|------|------|
| 사용자 가치 | 비개발자도 자연어 한 줄로 워크플로우 초안을 얻고 실행 뒤 실패·오동작을 대화로 진단하고 고친다 |
| 제품 차별화 | 질문과 계획 제안을 먼저 하는 planner-first 방식으로 LLM 의 섣부른 편집을 막는다 |
| 기존 자산 재사용 | [모델 설정](../CLE-AI/CLE-AI-MODELS.md), [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md)의 스트리밍, 에디터 스토어의 되돌리기 스택, [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md) API 를 그대로 쓴다 |

| 설계 목표 | 설명 |
|-----------|------|
| 점진적 구체화 | 모호한 요청("주문 취소 프로세스 추가")도 질문으로 요구를 채워 완성한다 |
| 단일 대화 루프 | 모드를 바꾸지 않고 한 채팅 창에서 대화·계획·편집이 돈다 |
| 되돌릴 수 있는 변경 | 에디터의 되돌리기 스택과 저장 흐름(수동 `Ctrl+S`, 실행 직전 저장)을 재사용한다. 사용자 승인 없이 DB 에 영구 기록하지 않는다 |
| 어시스턴트 세션 복원 | 채팅 기록을 서버에 저장해 새로 고침이나 재접속 뒤에도 이어 간다 |


이 문서는 AI 어시스턴트의 범위 · 요구사항 · 다른 기능과의 관계를 정하고, 세부는 아래 「하위 문서」 네 편이 맡는다. 다음 내용은 다른 문서가 정한다.

- 도구 정의와 Shadow 검증: [AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md)
- SSE 이벤트, 세션 REST API, 세션·메시지 엔티티: [AI 어시스턴트 스트리밍과 세션 API](CLE-WF-ASSIST-PROTO.md)
- 캔버스 저장 규칙, 컨테이너 규칙, 전체 단축키 목록: [워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md)
- 스트리밍 인터페이스와 프로바이더 구현: [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md)

이 문서에서 «세션» 은 어시스턴트 세션을 말한다. 대화 하나와 그 메시지 기록이 세션 하나다.

## 요구사항

- REQ-ASSIST-001 WHEN 사용자가 에디터 헤더의 AI 어시스턴트 버튼을 누르면 THE SYSTEM SHALL 오른쪽 AI 어시스턴트 패널을 열거나 닫는다. (원본: ED-AI-01)
- REQ-ASSIST-002 WHEN AI 어시스턴트 패널이 열리면 THE SYSTEM SHALL 같은 슬롯의 설정 패널을 닫는다. (원본: ED-AI-02)
- REQ-ASSIST-003 WHEN 노드 클릭 등으로 설정 패널이 필요해지면 THE SYSTEM SHALL AI 어시스턴트 패널을 닫는다. (원본: ED-AI-02)
- REQ-ASSIST-004 WHEN 사용자가 `Ctrl+/` 를 누르면 THE SYSTEM SHALL 다른 단축키와 충돌하지 않는 경우에 한해 AI 어시스턴트 패널을 토글한다. (원본: ED-AI-03)
- REQ-ASSIST-005 WHILE 패널을 보여 주는 동안 THE SYSTEM SHALL 패널 안 문자열을 ko/en i18n 키로 표시한다. (원본: ED-AI-04) (부분 구현)
- REQ-ASSIST-006 WHILE 메시지 목록을 보여 주는 동안 THE SYSTEM SHALL 스트림 조각이 아닌 완결된 메시지만 `aria-live="polite"` 로 스크린 리더에 알린다. (원본: ED-AI-05)
- REQ-ASSIST-007 WHEN 사용자가 패널 상단에서 모델 설정을 고르면 THE SYSTEM SHALL 그 모델 설정으로 어시스턴트 턴을 처리한다. (원본: ED-AI-06)
- REQ-ASSIST-008 IF 요청에 모델 설정이 없으면 THE SYSTEM SHALL 세션에 저장된 모델 설정을 쓰고 그것도 없으면 워크스페이스 기본 설정을 쓴다. (원본: ED-AI-07)
- REQ-ASSIST-009 IF 요청이나 세션이 지정한 모델 설정이 삭제됐거나 워크스페이스 밖이면 THE SYSTEM SHALL 워크스페이스 기본 설정으로 대신하고 토스트로 알린다.
- REQ-ASSIST-010 IF 모델 설정도 워크스페이스 기본 설정도 없으면 THE SYSTEM SHALL `ASSISTANT_NO_LLM_CONFIG` 안내와 설정 화면 딥링크를 보인다. (원본: ED-AI-08)
- REQ-ASSIST-011 WHEN 어시스턴트 턴을 처리하면 THE SYSTEM SHALL OpenAI·Anthropic·Google·Azure OpenAI·Local 프로바이더 모두 스트리밍으로 응답한다. (원본: ED-AI-09)
- REQ-ASSIST-012 IF 스트리밍을 지원하지 않는 프로바이더가 선택되면 THE SYSTEM SHALL LLM 클라이언트의 `LLM_STREAMING_UNSUPPORTED` 를 SSE `error` 이벤트로 그대로 보낸다. (원본: ED-AI-09)
- REQ-ASSIST-013 WHILE 한 대화 창을 쓰는 동안 THE SYSTEM SHALL 모드 전환 없이 탐색·계획·편집 단계를 오가게 한다. (원본: ED-AI-10)
- REQ-ASSIST-014 WHEN 요청이 모호하면 THE SYSTEM SHALL 먼저 질문하거나 계획 카드로 계획을 제시한다. (원본: ED-AI-11)
- REQ-ASSIST-015 WHEN 계획 카드를 제시하면 THE SYSTEM SHALL 단계별 체크리스트와 미답변 질문(`openQuestions`)을 함께 표시한다. (원본: ED-AI-12)
- REQ-ASSIST-016 WHEN 사용자가 "계획대로 진행" 버튼을 누르거나 자연어로 승인하면 THE SYSTEM SHALL 다음 턴에서 편집 단계로 들어간다. (원본: ED-AI-13)
- REQ-ASSIST-017 IF 같은 턴에 `propose_plan` 뒤 편집 도구가 호출되면 THE SYSTEM SHALL 그 호출을 `PLAN_AWAITING_APPROVAL` 로 거부한다. (원본: ED-AI-13)
- REQ-ASSIST-018 WHEN 편집 도구 호출이 성공하면 THE SYSTEM SHALL `planStepId`·`planStepIds` 에 맞는 계획 단계에 체크 표시한다. (원본: ED-AI-14)
- REQ-ASSIST-019 IF 성공한 편집 호출에 맞는 단계 ID 가 없으면 THE SYSTEM SHALL 순서상 다음 대기 단계에 체크 표시한다.
- REQ-ASSIST-020 WHEN 요청이 단일 필드·단일 노드 수정처럼 명확하면 THE SYSTEM SHALL 계획 카드 없이 바로 편집한다. (원본: ED-AI-15)
- REQ-ASSIST-021 WHILE 활성 계획이 있는 동안 THE SYSTEM SHALL 매 턴 활성 계획 컨텍스트를 시스템 프롬프트에 넣는다.
- REQ-ASSIST-022 IF 활성 계획에 `note` 가 아닌 대기 단계가 남았거나 미답변 질문이 있으면 THE SYSTEM SHALL `finish` 를 `PLAN_NOT_COMPLETE` 로 막는다.
- REQ-ASSIST-023 WHEN 편집 턴의 `finish` 가 계획 완결성 검사를 통과하면 THE SYSTEM SHALL 워크플로우 품질 점검을 거친 뒤에 턴을 끝낸다.
- REQ-ASSIST-024 IF 계획 단계가 남은 채 LLM 이 도구 호출 없이 텍스트만 내고 멈추면 THE SYSTEM SHALL 연속 2회까지 자동 이어서 진행한다.
- REQ-ASSIST-025 WHEN 편집 도구 호출이 성공하면 THE SYSTEM SHALL 에디터 메모리 스토어에 바로 반영하고 되돌리기 스택에 넣는다. (원본: ED-AI-16)
- REQ-ASSIST-026 WHILE 어시스턴트가 편집하는 동안 THE SYSTEM SHALL DB 에 직접 쓰지 않고 수동 저장과 실행 직전 저장으로만 영속한다. (원본: ED-AI-17)
- REQ-ASSIST-027 WHEN 사용자가 `Ctrl+Z`·`Ctrl+Y` 를 누르면 THE SYSTEM SHALL 어시스턴트 편집도 되돌리거나 다시 적용한다. (원본: ED-AI-18)
- REQ-ASSIST-028 IF 워크플로우가 실행 중일 때 편집 도구가 호출되면 THE SYSTEM SHALL `ASSISTANT_WORKFLOW_RUNNING` 으로 거부하고 사용자에게 안내한다. (원본: ED-AI-19) (미구현)
- REQ-ASSIST-029 WHEN 편집 도구가 호출되면 THE SYSTEM SHALL 컨테이너·수동 트리거 노드 제약을 Shadow 검증으로 적용한다. (원본: ED-AI-20)
- REQ-ASSIST-030 IF 선택기 위젯 필드(통합·MCP 서버·모델 설정·지식 저장소·다른 워크플로우)가 비어 있으면 THE SYSTEM SHALL LLM 대신 서버가 워크스페이스 후보를 찾아 `pendingUserConfig` 로 싣는다. (원본: ED-AI-39)
- REQ-ASSIST-031 WHEN 후보가 1개 이상이면 THE SYSTEM SHALL 편집 버블 안에 후보 선택기를 보여 주고 사용자가 확인할 때만 에디터 스토어에 반영한다. (원본: ED-AI-39)
- REQ-ASSIST-032 IF 후보가 하나뿐이면 THE SYSTEM SHALL 자동으로 넣지 않고 사용자 확인을 받는다. (원본: ED-AI-39)
- REQ-ASSIST-033 IF 후보가 0개면 THE SYSTEM SHALL 후보 선택기 대신 직접 등록 안내와 설정 화면 링크를 보인다. (원본: ED-AI-39)
- REQ-ASSIST-034 WHEN `add_node`·`update_node` 가 성공하면 THE SYSTEM SHALL 그 노드의 런타임 포트 목록을 결과에 싣는다. (원본: ED-AI-40)
- REQ-ASSIST-035 WHEN `PORT_NOT_FOUND`·`NODE_NOT_FOUND` 실패 배지 바로 뒤에 같은 source·target 의 성공 배지가 오면 THE SYSTEM SHALL 두 배지를 "재시도 후 성공" 배지 하나로 줄인다. (원본: ED-AI-40)
- REQ-ASSIST-036 WHEN 질문을 줄이거나 참고할 정보가 필요하면 THE SYSTEM SHALL 워크스페이스의 통합·지식 저장소·다른 워크플로우를 탐색 도구로 조회하게 한다. (원본: ED-AI-21)
- REQ-ASSIST-037 WHILE 탐색 도구가 조회하는 동안 THE SYSTEM SHALL 세션 워크스페이스 밖의 데이터를 돌려주지 않는다. (원본: ED-AI-22)
- REQ-ASSIST-038 WHEN 탐색 도구가 호출되면 THE SYSTEM SHALL 채팅에 탐색 배지로 표시한다. (원본: ED-AI-23)
- REQ-ASSIST-039 WHEN 어시스턴트가 응답하면 THE SYSTEM SHALL 텍스트와 도구 호출을 SSE 로 스트리밍한다. (원본: ED-AI-24)
- REQ-ASSIST-040 WHEN 사용자가 응답 중단 버튼을 누르면 THE SYSTEM SHALL 스트림을 끊고 이미 적용한 편집은 되돌릴 수 있는 상태로 남긴다. (원본: ED-AI-25)
- REQ-ASSIST-041 IF 네트워크 오류나 요청 한도 초과가 나면 THE SYSTEM SHALL 사용자에게 재시도 안내를 보인다. (원본: ED-AI-26)
- REQ-ASSIST-042 WHEN 페이지를 새로 고치거나 다시 접속하면 THE SYSTEM SHALL 서버에 저장된 대화를 이어서 보여 준다. (원본: ED-AI-27)
- REQ-ASSIST-043 WHEN 패널을 열면 THE SYSTEM SHALL 그 워크플로우의 가장 최근 활성 세션을 자동으로 고른다. (원본: ED-AI-28)
- REQ-ASSIST-044 WHEN 사용자가 새 대화 버튼을 누르면 THE SYSTEM SHALL 확인 다이얼로그 뒤 새 세션을 시작하고 이전 세션을 보존한다. (원본: ED-AI-29)
- REQ-ASSIST-045 WHEN 세션 삭제 API 가 호출되면 THE SYSTEM SHALL 세션과 그 메시지를 함께 지운다. (원본: ED-AI-30)
- REQ-ASSIST-046 WHEN 워크플로우가 삭제되면 THE SYSTEM SHALL 그 세션과 메시지를 cascade 로 지운다. (원본: ED-AI-30)
- REQ-ASSIST-047 WHEN 첫 사용자 메시지의 응답이 끝나면 THE SYSTEM SHALL 첫 메시지를 40자 이내로 잘라 세션 제목으로 저장하고 사용자가 고칠 수 있게 한다. (원본: ED-AI-31)
- REQ-ASSIST-048 IF 어시스턴트 턴의 LLM 스트림이 실패하면(모델 프로바이더 SDK 요청 타임아웃 포함) THE SYSTEM SHALL 턴을 끝내고 에러 버블에 에러 코드와 코드별 안내 문구를 보이며 모델 프로바이더 · 라이브러리 예외의 원문은 화면에 싣지 않고 서버 로그에만 남긴다. (원본: ED-AI-32)
- REQ-ASSIST-049 IF 한 턴의 도구 호출 수가 어시스턴트 도구 호출 한도를 넘거나 LLM 라운드가 50에 이르면 THE SYSTEM SHALL `ASSISTANT_TOO_MANY_TOOL_CALLS` 로 턴을 끝내고 이어서 진행 안내를 보인다. (원본: ED-AI-33)
- REQ-ASSIST-050 WHEN 어시스턴트가 LLM 을 부르면 THE SYSTEM SHALL `llm_usage_log` 에 `workflow_id`·`workspace_id` 와 함께 사용량을 적는다. (원본: ED-AI-34)
- REQ-ASSIST-051 WHILE 대화 기록을 LLM 에 넘기는 동안 THE SYSTEM SHALL 최근 30턴만 넘기고 그 이전 기록은 서버에만 둔다.
- REQ-ASSIST-052 WHEN 사용자가 실행 결과를 물으면 THE SYSTEM SHALL 실행 목록과 실행별 노드 타임라인을 읽기 전용 도구로 조회하게 한다. (원본: ED-AI-35)
- REQ-ASSIST-053 IF 조회 대상이 현재 세션 워크플로우의 실행도 그 직계 자식 실행도 아니면 THE SYSTEM SHALL `EXECUTION_NOT_IN_SCOPE` 로 거부한다. (원본: ED-AI-36)
- REQ-ASSIST-054 WHEN 실행 상세를 돌려주면 THE SYSTEM SHALL `inputData`·`outputData`·`error` 의 민감 값을 서버에서 가린다. (원본: ED-AI-37)
- REQ-ASSIST-055 WHILE 실행이 진행 중이거나 입력 대기인 동안 THE SYSTEM SHALL 부분 타임라인 조회를 허용한다. (원본: ED-AI-38)
- REQ-ASSIST-056 IF 사용자가 재실행을 요청하면 THE SYSTEM SHALL 재실행을 걸지 않고 실행 상세 페이지에서 직접 걸도록 안내한다.
- REQ-ASSIST-057 WHILE 어시스턴트가 동작하는 동안 THE SYSTEM SHALL 워크플로우 실행 API 를 부르지 않는다.
- REQ-ASSIST-058 WHEN 어시스턴트 메시지를 그리면 THE SYSTEM SHALL raw HTML 을 escape 하는 마크다운 렌더러를 쓴다.
- REQ-ASSIST-059 WHEN 어시스턴트 텍스트에 harmony 제어 토큰이 섞이면 THE SYSTEM SHALL 렌더 전에 걸러 내고 남는 내용이 없으면 버블을 숨긴다.
- REQ-ASSIST-060 IF 턴이 `ASSISTANT_TOO_MANY_TOOL_CALLS` 로 끝나면 THE SYSTEM SHALL 에러 버블에 "이어서 진행" 버튼을 보인다.
- REQ-ASSIST-061 IF 같은 워크플로우에 스트리밍이 진행 중일 때 새 메시지 요청이 오면 THE SYSTEM SHALL 409 로 거부한다. (미구현)
- REQ-ASSIST-062 IF 요청자가 편집 중인 워크플로우의 작성자가 아니면 THE SYSTEM SHALL 통합 목록 도구와 통합·MCP 서버 후보에서 요청자 자신의 개인 통합도 뺀다.


## 하위 문서

| 문서 | 다루는 것 | 맡는 요구사항 |
|------|-----------|---------------|
| [대화 루프와 턴 가드](CLE-WF-ASSIST-LOOP.md) | 탐색 · 계획 · 편집 단계, 계획 카드 진행, 활성 계획 컨텍스트, 승인, 계획 전용 턴, 호출 타임아웃, 도구 호출 한도, 라운드 이어가기, 자동 이어서 진행, 종료 가드, 그 밖의 한도, 스트리밍 프로바이더 | REQ-ASSIST-011, 013 ~ 024, 049, 051, 061 |
| [패널 화면](CLE-WF-ASSIST-UI.md) | 패널 위치 · 구성, 요소별 동작(배지 · 안내 상자 · 후보 선택기 · 에러 버블 배치), 접근성, 빈 상태, 키보드 단축키, i18n 키 | REQ-ASSIST-001 ~ 006, 027, 031 ~ 033, 035, 038, 040, 044, 058, 059 |
| [에러 처리와 모델 설정](CLE-WF-ASSIST-ERROR.md) | 에러 코드와 안내 문구, SSE `error` 의 `message` 규칙, 이어서 진행 버튼, 모델 설정 선택과 기본 설정 대체 | REQ-ASSIST-007 ~ 010, 012, 041, 048, 050, 060 |
| [시스템 프롬프트와 보안](CLE-WF-ASSIST-PROMPT.md) | 시스템 프롬프트 절 구성과 5블록 구조, 워크스페이스 경계, 프롬프트 인젝션 방어, 편집 결과와 저장 | REQ-ASSIST-026, 037, 030 · 052 의 프롬프트 측 정책 |

도구 계약(REQ-ASSIST-025, 028 ~ 030, 034, 036, 052 ~ 055, 062)은 [AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md), 스트리밍과 세션(REQ-ASSIST-039, 042, 043, 045 ~ 047)은 [AI 어시스턴트 스트리밍과 세션 API](CLE-WF-ASSIST-PROTO.md)와 함께 읽는다. REQ-ASSIST-056 · 057 은 아래 「실행과 디버깅」이 정한다.

## 대화 루프

→ [대화 루프와 턴 가드](CLE-WF-ASSIST-LOOP.md#대화-루프)

### 어시스턴트 도구 호출 한도

→ [대화 루프와 턴 가드](CLE-WF-ASSIST-LOOP.md#어시스턴트-도구-호출-한도)

### 자동 이어서 진행

→ [대화 루프와 턴 가드](CLE-WF-ASSIST-LOOP.md#자동-이어서-진행)

### 종료 가드

→ [대화 루프와 턴 가드](CLE-WF-ASSIST-LOOP.md#종료-가드)

## 패널 화면

→ [패널 화면](CLE-WF-ASSIST-UI.md#패널-화면)

### 요소별 동작

→ [패널 화면](CLE-WF-ASSIST-UI.md#요소별-동작)

## 에러 처리

→ [에러 처리와 모델 설정](CLE-WF-ASSIST-ERROR.md#에러-처리)

## 시스템 프롬프트

→ [시스템 프롬프트와 보안](CLE-WF-ASSIST-PROMPT.md#시스템-프롬프트)

## 다른 기능과의 관계

### 캔버스

- AI 어시스턴트의 편집은 캔버스의 저장 흐름(수동 `Ctrl+S`, 실행 직전 저장)에 그대로 들어간다. 사용자는 AI 어시스턴트가 작업하는 중에도 언제든 수동 저장이나 실행을 할 수 있다. 저장 규칙은 [워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md)가 정한다.
- 컨테이너(Loop, ForEach, Map) 편집은 캔버스의 자동 `containerId` 동기화 규칙을 그대로 따른다([워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md)). AI 어시스턴트는 이 규칙을 시스템 프롬프트로 안다.

### 실행과 디버깅

- AI 어시스턴트는 워크플로우 실행 API 를 부르지 않는다. 실행은 사용자 몫이다.
- 실행 중(실행 결과 드로어가 열린 상태) 편집 도구를 Shadow 단계에서 `ASSISTANT_WORKFLOW_RUNNING` 으로 거부하는 가드는 계획이며 미구현이다. 지금 코드에는 이 에러 코드와 차단 로직이 없어 실행 중에도 편집 도구가 호출될 수 있다.
- 실행 조회 도구(`get_workflow_executions`, `get_execution_details`)는 읽기 전용이라 실행 중에도 부를 수 있고 진행 중인 실행은 지금까지의 부분 타임라인을 돌려준다([AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md#실행-조회-도구)).
- 실행 이슈를 진단할 때는 목록으로 후보를 좁힌 뒤 한 건만 상세 조회하는 2단계 패턴을 따른다. 한 턴에 여러 건을 동시에 상세 조회하면 어시스턴트 도구 호출 한도와 페이로드 크기 양쪽에서 낭비가 생긴다.

### 모델 설정

→ [에러 처리와 모델 설정](CLE-WF-ASSIST-ERROR.md#모델-설정)

## i18n 키

→ [패널 화면](CLE-WF-ASSIST-UI.md#i18n-키)

## 범위 밖과 후속 과제

### v1 에서 뺀 것

| 항목 | 이유 |
|------|------|
| 여러 워크플로우를 한꺼번에 편집 | 세션이 워크플로우 하나에 종속된다 |
| AI 어시스턴트가 워크플로우를 직접 실행 | 실행은 사용자가 `Run` 버튼으로 한다 |
| 세션을 다른 멤버와 공유 | 팀 워크스페이스 RBAC 가 먼저 필요하다 |

### 후속 로드맵

- 여러 워크플로우를 한 대화에서 편집
- 세션 공유와 팀 협업(팀 워크스페이스 RBAC 선행)
- 버전 롤백 제안("이 AI 어시스턴트 편집을 한 묶음으로 버전 스냅샷에 넣을까요?")
- 자동 테스트 케이스 생성 제안

### 아직 정하지 않은 UX

- 세션 보관 기간과 자동 보관 정책. 지금은 직접 지울 때까지 남긴다. 나중에 워크스페이스별 용량 제한과 묶을 수 있다.
- 세션 공유·내보내기. v1 범위 밖이며 팀 워크스페이스 RBAC 가 먼저 필요하다.
- 사용자가 계획 카드 단계를 직접 고치거나 체크할 수 있는지. 지금은 조작할 수 없고 진행도 표시 전용이다. 필요하면 별도 RFC 로 다룬다.
- 계획 카드 안에 후보 선택기를 넣는 화면(지금은 편집 버블 전용), 선택기 안에서 통합을 바로 등록하는 폼(지금은 Settings 딥링크).

## 미결 사항

- **`LLM_RATE_LIMIT` 재시도 버튼**: 에러 처리 표는 `LLM_RATE_LIMIT` 에 재시도 버튼을 약속한다. REQ-ASSIST-041 은 재시도 안내만 요구한다. 현재 구현은 에러 버블 버튼(`RESUMABLE_ERROR_CODES`)을 `ASSISTANT_TOO_MANY_TOOL_CALLS` 하나에만 붙인다. OpenAI 계열은 스트림을 열 때의 429 를 `ASSISTANT_STREAM_FAILED` 로 보내므로 버튼을 `LLM_RATE_LIMIT` 에만 붙이면 그 프로바이더에서는 보이지 않는다. 이 프로바이더 분기를 통일할지는 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#미결-사항) 의 미결이다(NERV Task `CLE-T-0R5SYN`). 버튼을 둘지 결정 필요.

## 구현 위치

모듈별 파일은 각 하위 문서의 「구현 위치」에 있다. 백엔드는 `codebase/backend/src/modules/workflow-assistant/`, 프론트엔드는 `codebase/frontend/src/components/editor/assistant-panel/` 와 `codebase/frontend/src/lib/stores/assistant-*.ts` 다.

## Rationale

세부 설계의 근거는 각 하위 문서의 Rationale 에 있다. 대화 루프 · 종료 가드 · 프로바이더 이상동작은 [대화 루프와 턴 가드](CLE-WF-ASSIST-LOOP.md#rationale), 에러 문구 · 모델 설정은 [에러 처리와 모델 설정](CLE-WF-ASSIST-ERROR.md#rationale), 패널 화면은 [패널 화면](CLE-WF-ASSIST-UI.md#rationale), 프롬프트 · 보안은 [시스템 프롬프트와 보안](CLE-WF-ASSIST-PROMPT.md#rationale)에서 찾는다. 아래 절 가운데 링크만 있는 셋은 다른 문서가 거는 앵커를 지키려고 남겼다.

### 기획 결정 메모

AI 어시스턴트 스펙을 쓸 때 사용자와 합의한 결정이다.

| 항목 | 결정 | 근거 |
|------|------|------|
| 제품 명칭 | Workflow AI Assistant / 워크플로우 AI 어시스턴트 | 스펙·가이드·i18n 전 영역에서 같은 이름을 쓴다 |
| 변경 적용 방식 | 즉시 반영과 되돌리기(에디터 스토어 재사용) | 기존 저장 흐름(`Ctrl+S`, 실행 직전 저장)과 맞춘다. DB 영구 기록은 사용자의 저장으로만 한다 |
| v1 스트리밍 프로바이더 | OpenAI, Anthropic, Google, Azure OpenAI, Local 다섯 모두 | 미지원 프로바이더에는 LLM 클라이언트의 `LLM_STREAMING_UNSUPPORTED` 를 그대로 보낸다(REQ-ASSIST-012). 처음 설계한 어시스턴트 전용 `ASSISTANT_STREAMING_UNSUPPORTED` 는 같은 뜻의 코드를 하나 더 만드는 것이라 두지 않는다(2026-11-13). 다섯 프로바이더가 모두 스트리밍을 지원해 운영 환경의 발동 경로는 없다 |
| 설정 패널과 동시에 열기 | 서로 배타적 | MVP 단순화. 사용자 피드백에 따라 나중에 나란히 둘 수 있다 |
| 편집 권한 | 편집자(`editor`) 이상 | 기존 RBAC 규약을 재사용한다 |

채팅 기록을 서버에 두고 SSE 로 스트리밍하기로 한 결정은 [AI 어시스턴트 스트리밍과 세션 API](CLE-WF-ASSIST-PROTO.md)의 Rationale 에 있다.

### 에러 버블에 프로바이더 원문을 싣지 않는다 (2026-10-23)

→ [에러 처리와 모델 설정](CLE-WF-ASSIST-ERROR.md#에러-버블에-프로바이더-원문을-싣지-않는다-2026-10-23)

### 에러 버블 문구는 `assistant.*` 사전 키로 고른다 (2026-10-24)

→ [에러 처리와 모델 설정](CLE-WF-ASSIST-ERROR.md#에러-버블-문구는-assistant-사전-키로-고른다-2026-10-24)

### 모델 설정을 찾지 못하면 기본 설정으로 대신한다 (2026-11-13)

→ [에러 처리와 모델 설정](CLE-WF-ASSIST-ERROR.md#모델-설정을-찾지-못하면-기본-설정으로-대신한다-2026-11-13)
