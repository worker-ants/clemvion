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
  "Include Tool Calls in Thread": "스레드에 도구 호출 포함",
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
  "How many times to re-prompt the LLM when it reports completion but required fields are still missing. 0 = unlimited.":
    "LLM이 완료를 보고했지만 필수 필드가 누락된 경우 재프롬프트할 횟수입니다. 0 = 무제한.",
  "Integer literal or expression": "정수 리터럴 또는 표현식",
  "JSON array of values bound to $1, $2, ...":
    "$1, $2, ...에 바인딩되는 JSON 배열",
  "Leave empty for provider default":
    "비워두면 제공자 기본값을 사용합니다",
  "Leave empty to expose all of the server's regular tools to the LLM.":
    "비워두면 서버의 모든 일반 도구를 LLM 에 노출합니다.",
  "Merge arrived inputs when timeout elapses":
    "타임아웃 발생 시 도착한 입력들을 병합",
  "Minimum similarity score (0-1)": "최소 유사도 점수 (0~1)",
  "No operations defined": "정의된 작업이 없습니다",
  "Number of chunks to retrieve": "가져올 청크 수",
  "Optional field to sort by": "정렬에 사용할 선택 필드",
  "Push KB / MCP / condition tool turns to the thread (default: only the final assistant response).":
    "KB / MCP / 조건 도구 호출도 스레드에 함께 푸시합니다 (기본: 최종 어시스턴트 응답만).",
  "Safety cap on loop iterations": "루프 반복 횟수 안전 상한",
  "Selected KBs are exposed to the LLM as search tools. The LLM calls them autonomously based on user intent.":
    "선택한 KB 가 LLM 에 검색 도구로 노출됩니다. LLM 이 사용자 의도를 보고 능동적으로 호출합니다.",
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
