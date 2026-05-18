/**
 * Translation table for UI strings shipped in backend Zod schemas
 * (`z.meta({ ui: { label, hint, placeholder, itemLabel, group, options } })`).
 *
 * The backend authors these in English. When the current locale is Korean we
 * look up a Korean rendering here; otherwise the original English is returned
 * so new backend labels degrade gracefully without blocking the UI.
 *
 * Keep entries grouped by category — labels / hints / placeholders / itemLabels
 * / groups / option labels — to mirror the auto-form rendering code that calls
 * `translateBackendLabel`.
 */

import type { Locale } from "./types";

const LABEL_KO: Record<string, string> = {
  Aggregation: "집계",
  "Array Field": "배열 필드",
  Authentication: "인증",
  Body: "본문",
  "Body Type": "본문 형식",
  "Branch Count": "분기 수",
  "Break Condition": "중단 조건",
  Buttons: "버튼",
  Cases: "케이스",
  Categories: "카테고리",
  "Chart Type": "차트 유형",
  Code: "코드",
  "Combine Mode": "결합 방식",
  Color: "색상",
  Columns: "열",
  Condition: "조건",
  Conditions: "조건",
  "Content / URL": "내용 / URL",
  "Conversation Context": "대화 컨텍스트",
  Count: "개수",
  "Data Field": "데이터 필드",
  "Data Source": "데이터 소스",
  "Default Sort Column": "기본 정렬 열",
  "Default Value": "기본값",
  Description: "설명",
  "Description Field": "설명 필드",
  "Enable Built-in Helpers": "기본 헬퍼 사용",
  "Enable Pagination": "페이지네이션 사용",
  "Enabled Tools": "활성 도구",
  "Enum Values": "열거형 값",
  "Error Policy": "오류 정책",
  Examples: "예시",
  "Exclude This Node from Thread": "이 노드를 스레드에서 제외",
  "Expose Prompts": "프롬프트 노출",
  "Expose Resources": "리소스 노출",
  Field: "필드",
  "Field Path": "필드 경로",
  Fields: "필드",
  Filename: "파일 이름",
  "Follow Redirects": "리다이렉트 따라가기",
  "Group By": "그룹 기준",
  "Has Default": "기본값 여부",
  Headers: "헤더",
  "History Count": "히스토리 개수",
  ID: "ID",
  "Image Field": "이미지 필드",
  "Image URL": "이미지 URL",
  "Include Confidence": "신뢰도 포함",
  "Include System Context": "시스템 컨텍스트 포함",
  "Include Tool Calls in Thread": "스레드에 도구 호출 포함",
  "Context Sections": "컨텍스트 섹션",
  "Injection Mode": "주입 방식",
  "Input Field": "입력 필드",
  "Input Mapping": "입력 매핑",
  Input: "입력",
  Instructions: "지침",
  Integration: "통합",
  Items: "항목",
  "JSON Schema": "JSON 스키마",
  Key: "키",
  "Knowledge Bases": "지식 베이스",
  Label: "라벨",
  Language: "언어",
  "Last N": "최근 N개",
  Layout: "레이아웃",
  "LLM Provider": "LLM 제공자",
  "Max Collection Retries": "최대 수집 재시도 횟수",
  "Max Concurrency": "최대 동시 실행 수",
  "Max Duration (ms)": "최대 지속 시간(ms)",
  "Max Items": "최대 항목 수",
  "Max Iterations": "최대 반복 횟수",
  "Max Tokens": "최대 토큰 수",
  "Max Tool Calls": "최대 도구 호출 수",
  "Max Turns": "최대 턴 수",
  "MCP Servers": "MCP 서버",
  Method: "메서드",
  Mode: "모드",
  Model: "모델",
  "Model Override": "모델 재정의",
  Modifications: "변경 사항",
  "Multi-label Classification": "다중 라벨 분류",
  Name: "이름",
  "Notify on failure": "실패 시 알림",
  Notes: "메모",
  Operation: "작업",
  Operations: "작업",
  Options: "옵션",
  "Output Format": "출력 형식",
  Output: "출력",
  "Page Size": "페이지 크기",
  Pagination: "페이지네이션",
  Parameters: "매개변수",
  "Partial on Timeout": "타임아웃 시 부분 병합",
  Prompt: "프롬프트",
  "Query Params": "쿼리 매개변수",
  "Query Type": "쿼리 유형",
  "RAG Threshold": "RAG 임계값",
  "RAG Threshold (default)": "RAG 임계값 (기본값)",
  "RAG Top-K": "RAG Top-K",
  "RAG Top-K (default)": "RAG Top-K (기본값)",
  Required: "필수",
  Resource: "리소스",
  "Response Format": "응답 형식",
  "Response Type": "응답 유형",
  Rows: "행",
  SQL: "SQL",
  "Sort Order": "정렬 순서",
  Source: "소스",
  "Strict Comparison": "엄격한 비교",
  Strategy: "전략",
  "Submit Label": "제출 버튼 라벨",
  "Switch Value": "스위치 값",
  "System Prompt": "시스템 프롬프트",
  Template: "템플릿",
  "Timeout (ms)": "타임아웃(ms)",
  "Timeout (seconds)": "타임아웃(초)",
  Title: "제목",
  "Title Field": "제목 필드",
  "Tool Description": "도구 설명",
  "Tool Name": "도구 이름",
  "Tool Node IDs": "도구 노드 ID",
  "Tool Overrides": "도구 재정의",
  Type: "유형",
  URL: "URL",
  "User Prompt": "사용자 프롬프트",
  Value: "값",
  Variables: "변수",
  "Verify SSL": "SSL 검증",
  "Wait for All Branches": "모든 분기 대기",
  Width: "너비",
};

const HINT_KO: Record<string, string> = {
  "0 = deterministic, 2 = creative": "0 = 결정적, 2 = 창의적",
  "0 = no timeout (wait indefinitely)": "0 = 타임아웃 없음 (무한 대기)",
  "0 = unlimited": "0 = 무제한",
  "1-16 parallel branches": "1~16개의 병렬 분기",
  "Add a workspace-registered MCP server to let the LLM autonomously call its tools.":
    "워크스페이스에 등록된 MCP 서버를 추가하면 LLM 이 해당 서버의 도구를 능동적으로 호출합니다.",
  "Array data source (leave empty for previous node input)":
    "배열 데이터 소스 (비우면 이전 노드의 입력 사용)",
  "Compare without type coercion": "타입 변환 없이 비교",
  "Default chunk count returned per KB tool call (LLM can override via call arguments)":
    "KB tool 호출 시 반환할 청크 수의 기본값 (LLM 이 호출 인자로 override 가능)",
  "Default minimum similarity threshold (0-1) (LLM can override via call arguments)":
    "최소 유사도 임계값 (0-1) 의 기본값 (LLM 이 호출 인자로 override 가능)",
  "Describe the background task's purpose or caveats — handy for teammates collaborating later.":
    "백그라운드에서 수행할 작업의 목적·주의사항을 적어두면 협업할 때 편해요.",
  "Dot-path (e.g. \"name\", \"address.city\") or expression (\"{{ $item.name }}\"). Leave empty or use \"$item\" to compare against the item itself.":
    "도트 경로(예: \"name\", \"address.city\") 또는 표현식(\"{{ $item.name }}\"). 비워두거나 \"$item\" 으로 두면 item 자체와 비교합니다.",
  "Dot-path or inline expression returning an array":
    "배열을 반환하는 점 경로 또는 인라인 표현식",
  "Exit loop when condition is met": "조건이 충족되면 루프를 종료",
  "Expose list/get meta-tools when the server reports prompts capability":
    "서버가 prompts capability 를 보고할 때 list/get 메타도구를 노출",
  "Expose list/read meta-tools when the server reports resources capability":
    "서버가 resources capability 를 보고할 때 list/read 메타도구를 노출",
  "Expression that returns the array to display":
    "표시할 배열을 반환하는 표현식",
  "Expression to build the user message":
    "사용자 메시지를 구성하는 표현식",
  "Field path for slide title": "슬라이드 제목에 사용할 필드 경로",
  "Force-stop the body when it exceeds this duration. 0 = unlimited. Default 5 minutes (300000).":
    "본문이 이 시간을 넘기면 강제 종료해요. 0을 입력하면 무제한이에요. 기본 5분(300000).",
  "How many times to re-prompt the LLM when it reports completion but required fields are still missing. 0 = unlimited.":
    "LLM이 완료를 보고했지만 필수 필드가 누락된 경우 재프롬프트할 횟수입니다. 0 = 무제한.",
  "Integer literal or expression": "정수 리터럴 또는 표현식",
  "JSON array of values bound to $1, $2, ...":
    "$1, $2, ...에 바인딩되는 JSON 배열",
  "Leave empty for provider default":
    "비워두면 제공자 기본값을 사용합니다",
  "Leave empty to expose all of the server's regular tools to the LLM.":
    "비워두면 서버의 모든 일반 도구를 LLM 에 노출합니다.",
  "Max branches running concurrently (0 = same as branchCount, unlimited). When smaller than branchCount, the rest wait until a slot frees up.":
    "동시에 실행할 분기의 최대 개수 (0 = branchCount와 동일, 제한 없음). 값이 branchCount보다 작으면 나머지는 슬롯이 빌 때까지 대기합니다.",
  "Merge arrived inputs when timeout elapses":
    "타임아웃 발생 시 도착한 입력들을 병합",
  "Minimum similarity score (0-1)": "최소 유사도 점수 (0~1)",
  "No operations defined": "정의된 작업이 없습니다",
  "Number of chunks to retrieve": "가져올 청크 수",
  "Number of parallel branches (2-16). branch_0 ~ branch_{N-1} output ports are generated dynamically.":
    "병렬 실행할 분기 수 (2~16). branch_0 ~ branch_{N-1} 출력 포트가 동적으로 생성됩니다.",
  "Optional field to sort by": "정렬에 사용할 선택 필드",
  "Prepend current time + timezone to the system prompt so the LLM avoids KST/UTC drift.":
    "시스템 프롬프트 앞에 현재 시각·타임존을 자동 prepend 합니다. LLM 의 시각 추론이 KST/UTC 9시간 어긋나는 회귀를 차단합니다.",
  "Push KB / MCP / condition tool turns to the thread (default: only the final assistant response).":
    "KB / MCP / 조건 도구 호출도 스레드에 함께 푸시합니다 (기본: 최종 어시스턴트 응답만).",
  "Safety cap on loop iterations": "루프 반복 횟수 안전 상한",
  "Selected KBs are exposed to the LLM as search tools. The LLM calls them autonomously based on user intent.":
    "선택한 KB 가 LLM 에 검색 도구로 노출됩니다. LLM 이 사용자 의도를 보고 능동적으로 호출합니다.",
  "Send an in-app notification to workspace admins when the background body errors.":
    "백그라운드 본문에서 오류가 발생하면 워크스페이스 Admin에게 인앱 알림을 보내요.",
  "Skip pushing this node’s user / assistant turns to the workflow thread (opt-out).":
    "이 노드의 사용자 / 어시스턴트 턴을 워크플로우 스레드에 푸시하지 않습니다 (옵트아웃).",
  "Supports markdown and expressions":
    "마크다운과 표현식을 지원합니다",
  "Switch value not set": "스위치 값이 설정되지 않았습니다",
  "Transform operations applied in order":
    "변환 작업이 순서대로 적용됩니다",
  "URL not set": "URL이 설정되지 않았습니다",
  "Use {{ $item.* }} to reference the current array item":
    "현재 배열 항목을 참조하려면 {{ $item.* }}을(를) 사용하세요",
  "Use return to produce output. $input, $vars, $helpers are injected.":
    "return으로 출력값을 만드세요. $input, $vars, $helpers가 주입됩니다.",
  "true: continue to the next node only after all branches finish. Phase P1 hardcodes true; false is not supported yet.":
    "true: 모든 분기 완료 후 다음 노드로 진행. Phase P1에서는 항상 true로 동작하며 false는 미지원입니다.",
};

const PLACEHOLDER_KO: Record<string, string> = {
  "Slide description (optional)": "슬라이드 설명 (선택 사항)",
  "Slide title": "슬라이드 제목",
  "https://... (optional)": "https://... (선택 사항)",
  "Leave empty for provider default": "비워두면 제공자 기본값을 사용합니다",
  "Label (e.g. Refund Request)": "라벨 (예: 환불 요청)",
  Model: "모델",
  "Optional field to sort by": "정렬에 사용할 선택 필드",
  "Prompt (when to trigger this condition)":
    "프롬프트 (이 조건을 언제 트리거할지)",
  "Select a workflow or enter UUID":
    "워크플로우를 선택하거나 UUID를 입력하세요",
  "You are a helpful assistant...": "당신은 유용한 어시스턴트입니다...",
  description: "설명",
  "imageUrl (optional)": "imageUrl (선택 사항)",
  title: "제목",
  variableName: "변수 이름",
};

const ITEM_LABEL_KO: Record<string, string> = {
  Attachment: "첨부 파일",
  Button: "버튼",
  Case: "케이스",
  Category: "카테고리",
  Color: "색상",
  Column: "열",
  Condition: "조건",
  Example: "예시",
  Field: "필드",
  Item: "항목",
  "MCP Server": "MCP 서버",
  Modification: "변경 사항",
  Option: "옵션",
  Parameter: "매개변수",
  Recipient: "수신자",
  Row: "행",
  Tool: "도구",
  Variable: "변수",
};

const GROUP_KO: Record<string, string> = {
  Advanced: "고급",
  Buttons: "버튼",
  Columns: "열",
  Conditions: "조건",
  "Conversation Context": "대화 컨텍스트",
  Items: "항목",
  "Knowledge Base (RAG)": "지식 베이스 (RAG)",
  "MCP Servers": "MCP 서버",
  "Multi Turn Settings": "멀티턴 설정",
  "Retry Settings": "재시도 설정",
  Rows: "행",
  "System Context": "시스템 컨텍스트",
};

const OPTION_LABEL_KO: Record<string, string> = {
  Ascending: "오름차순",
  Card: "카드",
  Continue: "계속",
  Danger: "위험",
  Descending: "내림차순",
  "Dynamic (from data)": "동적 (데이터 기반)",
  "Dynamic (from input)": "동적 (입력 기반)",
  "Full History": "전체 히스토리",
  Image: "이미지",
  "Last N — inject most recent N turns":
    "최근 N — 가장 최근 N개 턴 주입",
  "Last N Messages": "최근 N개 메시지",
  "Messages — prepend to LLM messages":
    "메시지 — LLM 메시지 앞쪽에 주입",
  Minimal: "최소",
  "Multi Turn (Conversation)": "멀티턴 (대화)",
  None: "없음",
  "None — system + user prompt only":
    "없음 — 시스템 + 사용자 프롬프트만 사용",
  Outline: "외곽선",
  Primary: "기본",
  Secondary: "보조",
  "Single Turn": "싱글턴",
  "Static (manual)": "정적 (수동)",
  "Static Items": "정적 항목",
  "System Text — append to system prompt":
    "시스템 텍스트 — 시스템 프롬프트에 덧붙임",
  "Thread — inject full thread": "스레드 — 전체 스레드 주입",
  "Current time (ISO 8601 with offset)":
    "현재 시각 (ISO 8601, 오프셋 포함)",
  "Timezone (IANA + UTC offset)": "타임존 (IANA + UTC 오프셋)",
  "Workspace id / name": "워크스페이스 ID / 이름",
  "Node id / label / type": "노드 ID / 라벨 / 유형",
};

/**
 * Backend `warningRules` / `validateConfig` 가 반환하는 검증 메시지의 ko 매핑.
 * 캔버스 노드 배지(`getConfigSummary`)와 어시스턴트 review 출력에서 영문 SoT
 * 를 ko 로 표시할 때 사용한다. 신규 검증 메시지를 추가할 때마다 영문 원문 →
 * 한국어 매핑을 함께 등록한다.
 */
const WARNING_KO: Record<string, string> = {
  "At least one case must be added.": "최소 1개 이상의 case 를 추가해야 합니다.",
  "At least one category must be added.": "하나 이상의 카테고리를 추가해야 합니다.",
  "At least one column must be defined.": "컬럼을 1개 이상 정의해야 합니다.",
  "At least one condition must be added.": "최소 1개 이상의 조건을 추가해야 합니다.",
  "At least one extraction field must be defined.": "하나 이상의 추출 필드를 정의해야 합니다.",
  "At least one field must be defined.": "최소 1개 이상의 필드를 정의해야 합니다.",
  "At least one modification must be added.": "최소 1개 이상의 변경을 추가해야 합니다.",
  "At least one transform operation must be added.": "하나 이상의 변환 작업을 추가해야 합니다.",
  "At least one variable must be defined.": "최소 1개 이상의 변수를 정의해야 합니다.",
  "Array field must be entered.": "배열 필드를 입력해야 합니다.",
  "Body must be entered.": "본문을 입력해야 합니다.",
  "Body of the code to run must be entered.": "실행할 코드를 입력해야 합니다.",
  "Chart type must be selected.": "차트 타입을 선택해야 합니다.",
  "Conditions are limited to 20 entries.": "Conditions 는 최대 20개까지 추가할 수 있습니다.",
  "Count must be entered.": "Count 를 입력해야 합니다.",
  "Database integration must be selected.": "Database integration 을 선택해야 합니다.",
  "Email integration must be selected.": "Email integration 을 선택해야 합니다.",
  "Either System Prompt or User Prompt must be entered.": "System Prompt 또는 User Prompt 중 하나는 입력해야 합니다.",
  "Fan-out input to N branches. Each branch runs concurrently when PARALLEL_ENGINE=v1, otherwise sequentially in topological order.":
    "N 개의 분기로 입력을 fan-out 합니다. PARALLEL_ENGINE=v1 일 때 각 분기가 동시 실행되며, 그렇지 않으면 토폴로지 순서로 순차 진행됩니다.",
  "Field path must be entered.": "Field path 를 입력해야 합니다.",
  "First condition's field must be entered.": "첫 번째 조건의 필드를 입력해야 합니다.",
  "First modification's target variable must be selected.": "첫 번째 변경의 대상 변수를 선택해야 합니다.",
  "First variable's name must be entered.": "첫 번째 변수의 이름을 입력해야 합니다.",
  "In Dynamic mode, a Title field must be entered.": "Dynamic 모드에서는 Title 필드를 입력해야 합니다.",
  "In Single Turn mode, Input Field must be entered.": "Single Turn 모드에서는 Input Field 를 입력해야 합니다.",
  "In Static mode, at least one slide must be added.": "Static 모드에서는 최소 1개 이상의 슬라이드를 추가해야 합니다.",
  "In Value mode, Switch Value must be entered.": "Value 모드에서는 Switch Value 를 입력해야 합니다.",
  "Input field must be entered.": "Input 필드를 입력해야 합니다.",
  "Input Field must be entered.": "Input Field 를 입력해야 합니다.",
  "Integration must be selected.": "Integration 을 선택해야 합니다.",
  "Integration must be selected when using Integration auth.": "Integration 인증을 사용하려면 integration 을 선택해야 합니다.",
  "LLM provider or model must be selected (auto-handled by the canvas when a workspace default provider is configured).":
    "LLM provider 또는 model 을 선택해야 합니다 (workspace 기본 provider 가 설정된 경우 캔버스에서 자동 처리).",
  "Merge strategy must be selected.": "Merge strategy 를 선택해야 합니다.",
  "Mode must be either static or dynamic.": "Mode 는 static 또는 dynamic 이어야 합니다.",
  "Multi Turn mode requires System Prompt.": "Multi Turn 모드에서는 System Prompt 가 필요합니다.",
  "Operation must be selected.": "Operation 을 선택해야 합니다.",
  "Recipient (To) must include at least one address.": "수신자 (To) 를 한 명 이상 입력해야 합니다.",
  "Resource must be selected.": "Resource 를 선택해야 합니다.",
  "Resource / operation not selected": "Resource / operation 미선택",
  "SQL query must be entered.": "SQL query 를 입력해야 합니다.",
  "Subject must be entered.": "제목을 입력해야 합니다.",
  "Target workflow must be selected.": "실행할 워크플로우를 선택해야 합니다.",
  "Template body must be entered.": "Template 본문을 입력해야 합니다.",
  "URL must be entered.": "URL 을 입력해야 합니다.",
  "X-axis field must be entered.": "X축 필드를 입력해야 합니다.",
  "Y-axis field must be entered.": "Y축 필드를 입력해야 합니다.",
  "branchCount must be 2 to 16.": "branchCount 는 2 이상 16 이하여야 합니다.",
  "branchCount must be a value between 2 and 16.": "branchCount는 2 이상 16 이하의 값이어야 합니다.",
  "branchCount must be an integer.": "branchCount는 정수여야 합니다.",
  "maxConcurrency must be a number.": "maxConcurrency는 숫자여야 합니다.",
  "maxConcurrency must be a value between 0 and 16 (0 = unlimited).":
    "maxConcurrency는 0 이상 16 이하의 값이어야 합니다 (0 = 제한 없음).",
  "maxConcurrency must be an integer.": "maxConcurrency는 정수여야 합니다.",
  "waitAll must be a boolean.": "waitAll는 boolean이어야 합니다.",
};

// Accepts both the display label (Trigger / Logic / ...) emitted by
// `NODE_CATEGORIES` and the lowercase id (trigger / logic / ...) stored on
// `NodeDefinition.category` so either rendering shape works.
const NODE_CATEGORY_KO: Record<string, string> = {
  AI: "AI",
  Data: "데이터",
  Flow: "플로우",
  Integration: "통합",
  Logic: "로직",
  Presentation: "표시",
  Trigger: "트리거",
  ai: "AI",
  data: "데이터",
  flow: "플로우",
  integration: "통합",
  logic: "로직",
  presentation: "표시",
  trigger: "트리거",
};

const NODE_PORT_LABEL_KO: Record<string, string> = {
  Background: "백그라운드",
  Body: "본문",
  Default: "기본",
  Done: "완료",
  Emit: "방출",
  Error: "오류",
  False: "False",
  Input: "입력",
  Main: "메인",
  Match: "일치",
  Output: "출력",
  Success: "성공",
  True: "True",
  Unmatched: "미일치",
};

const NODE_LABEL_KO: Record<string, string> = {
  "AI Agent": "AI 에이전트",
  Background: "백그라운드",
  Cafe24: "Cafe24",
  Carousel: "캐러셀",
  Chart: "차트",
  Code: "코드",
  Database: "데이터베이스",
  Filter: "필터",
  ForEach: "ForEach",
  Form: "폼",
  "HTTP Request": "HTTP 요청",
  "If/Else": "If/Else",
  "Information Extractor": "정보 추출기",
  Loop: "반복",
  "Manual Trigger": "수동 트리거",
  Map: "Map",
  Merge: "병합",
  Parallel: "병렬",
  "Send Email": "이메일 발송",
  Split: "분할",
  "Sub-Workflow": "서브 워크플로우",
  Switch: "분기",
  Table: "테이블",
  Template: "템플릿",
  "Text Classifier": "텍스트 분류기",
  Transform: "변환",
  Variable: "변수",
  "Set Variable": "변수 설정",
};

const NODE_DESCRIPTION_KO: Record<string, string> = {
  "Chat with LLM using KB search and MCP server tools":
    "KB 검색과 MCP 서버 도구를 활용해 LLM과 대화",
  "Run downstream branch in background without blocking the main flow":
    "메인 플로우를 막지 않고 하위 분기를 백그라운드로 실행",
  "Call any Cafe24 Admin API endpoint via resource/operation":
    "Cafe24 Admin API 엔드포인트를 resource/operation 으로 호출",
  "Display as slides": "슬라이드로 표시",
  "Visualize as chart": "차트로 시각화",
  "Run JavaScript code": "JavaScript 코드 실행",
  "Execute SQL queries": "SQL 쿼리 실행",
  "Filter array by conditions": "조건으로 배열 필터링",
  "Iterate over array": "배열을 순회",
  "User input form": "사용자 입력 폼",
  "Make HTTP requests": "HTTP 요청 보내기",
  "Conditional branching": "조건 분기",
  "Extract structured data from text": "텍스트에서 구조화된 데이터 추출",
  "Repeat N times": "N번 반복",
  "Start point for manual workflow execution": "수동 워크플로우 실행 시작점",
  "Transform array items via body subgraph":
    "본문 서브그래프로 배열 항목 변환",
  "Combine inputs": "입력 병합",
  "Fan-out input to N branches. Each branch runs concurrently when PARALLEL_ENGINE=v1, otherwise sequentially in topological order.":
    "입력을 N 개 분기로 fan-out. PARALLEL_ENGINE=v1 일 때 각 분기가 동시 실행되며, 그렇지 않으면 토폴로지 순서로 순차 진행됩니다.",
  "Send emails via SMTP": "SMTP 로 이메일 발송",
  "Split array items": "배열 항목 분할",
  "Multi-path branching": "다중 경로 분기",
  "Display as table": "테이블로 표시",
  "Render templates": "템플릿 렌더링",
  "Classify text into categories": "텍스트를 카테고리로 분류",
  "Transform data": "데이터 변환",
  "Declare variables": "변수 선언",
  "Modify variables": "변수 변경",
  "Call another workflow": "다른 워크플로우 호출",
};

function pickKo(
  table: Record<string, string>,
  value: string | undefined,
): string | undefined {
  if (value == null) return value;
  return table[value] ?? value;
}

export function translateBackendLabel(
  value: string | undefined,
  locale: Locale,
): string | undefined {
  if (locale !== "ko") return value;
  return pickKo(LABEL_KO, value);
}

export function translateBackendHint(
  value: string | undefined,
  locale: Locale,
): string | undefined {
  if (locale !== "ko") return value;
  return pickKo(HINT_KO, value);
}

export function translateBackendPlaceholder(
  value: string | undefined,
  locale: Locale,
): string | undefined {
  if (locale !== "ko") return value;
  return pickKo(PLACEHOLDER_KO, value);
}

export function translateBackendItemLabel(
  value: string | undefined,
  locale: Locale,
): string | undefined {
  if (locale !== "ko") return value;
  return pickKo(ITEM_LABEL_KO, value);
}

export function translateBackendGroup(
  value: string | undefined,
  locale: Locale,
): string | undefined {
  if (locale !== "ko") return value;
  return pickKo(GROUP_KO, value);
}

export function translateBackendOptionLabel(
  value: string | undefined,
  locale: Locale,
): string | undefined {
  if (locale !== "ko") return value;
  return pickKo(OPTION_LABEL_KO, value);
}

export function translateBackendWarning(
  value: string | undefined,
  locale: Locale,
): string | undefined {
  if (locale !== "ko") return value;
  return pickKo(WARNING_KO, value);
}

export function translateNodeCategory(
  value: string | undefined,
  locale: Locale,
): string | undefined {
  if (locale !== "ko") return value;
  return pickKo(NODE_CATEGORY_KO, value);
}

export function translateNodeLabel(
  value: string | undefined,
  locale: Locale,
): string | undefined {
  if (locale !== "ko") return value;
  return pickKo(NODE_LABEL_KO, value);
}

export function translateNodeDescription(
  value: string | undefined,
  locale: Locale,
): string | undefined {
  if (locale !== "ko") return value;
  return pickKo(NODE_DESCRIPTION_KO, value);
}

export function translateNodePortLabel(
  value: string | undefined,
  locale: Locale,
): string | undefined {
  if (locale !== "ko") return value;
  return pickKo(NODE_PORT_LABEL_KO, value);
}
