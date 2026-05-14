/**
 * Conversation Thread — workflow-execution 동안 발생하는 사용자 인터랙션과
 * AI 대화 turn 의 시간순 누적. AI Agent 노드가 노드 설정 (`contextScope`) 으로
 * 자동 주입받는다.
 *
 * SoT: spec/conventions/conversation-thread.md
 */

/**
 * v1 thread ID. 단일 thread 만 지원하므로 고정값.
 *
 * NOTE: 값 문자열 `'default'` 는 노드 출력 포트 예약어 `'default'`
 * (CONVENTIONS Principle 6) 와 동일하지만 namespace 가 완전히 분리되어 있어
 * 런타임 충돌 없음. 코드에서는 항상 본 상수를 통해 참조하고 magic string
 * 직접 사용을 금한다.
 */
export const DEFAULT_THREAD_ID = 'default' as const;

export type ConversationTurnSource =
  | 'presentation_user'
  | 'ai_user'
  | 'ai_assistant'
  | 'ai_tool'
  | 'system';

export interface ConversationTurnToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ConversationTurn {
  /** thread 내 단조 증가 sequence — append 순서 == 시간 순서. */
  seq: number;
  /** turn 을 발생시킨 그래프 노드의 UUID. */
  nodeId: string;
  /**
   * append 시점의 노드 라벨 snapshot. 라벨이 추후 변경되어도 thread 의 표시
   * 일관성이 유지된다.
   */
  nodeLabel: string;
  /** 노드 타입 (예: 'form', 'carousel', 'ai_agent'). */
  nodeType: string;
  /** 서버 시각 (ISO 8601). */
  timestamp: string;
  source: ConversationTurnSource;
  /**
   * system_text injection 모드의 1차 텍스트 + UI 표시. 빈 문자열 가능
   * (구조화 데이터만 있는 경우 — text 변환 규칙은 spec §1.4).
   */
  text: string;
  /**
   * 구조화 원본 — `output.interaction.data` snapshot 또는 핸들러가 보존한
   * payload. `messages` 모드에서는 사용되지 않고 디버깅·UI 용.
   */
  data?: Record<string, unknown>;
  /**
   * `source: 'ai_assistant'` 한정. provider 호환성을 위해 messages 모드에서
   * drop 가능 (spec §5.1).
   */
  toolCalls?: ConversationTurnToolCall[];
  /** `source: 'ai_tool'` 한정 — 짝이 되는 toolCall id. */
  toolCallId?: string;
}

export interface ConversationThread {
  /** v1 고정값 `DEFAULT_THREAD_ID`. multi-thread 는 v2 로드맵. */
  id: string;
  /** 다음 append 에 부여될 seq (== `turns.length`). */
  nextSeq: number;
  turns: ConversationTurn[];
  /**
   * 누적 char 길이 캐시 (cap 빠른 경로 — `applyCap` 에서 사용). append 시
   * 갱신.
   */
  totalChars: number;
}

/**
 * 빈 thread 팩토리 — `ExecutionContextService.createContext` 가 사용.
 */
export function createEmptyConversationThread(): ConversationThread {
  return {
    id: DEFAULT_THREAD_ID,
    nextSeq: 0,
    turns: [],
    totalChars: 0,
  };
}
