import type { ConversationTurn } from '../../../shared/conversation-thread/conversation-thread.types';

/**
 * AI Agent `memoryStrategy: 'persistent'` 의 **턴 경계 비동기 추출** 전용 BullMQ
 * 큐 이름 (spec/5-system/17-agent-memory.md §3 추출 파이프라인, AGM-04).
 *
 * hot path (응답 latency) 비차단 invariant 의 구현체 — 핸들러는 턴 경계마다
 * 직전 turn(들) 의 **shallow-copy 스냅샷** 을 payload 로 담아 enqueue 만 하고
 * (await 는 enqueue 까지), 실제 추출 LLM 콜은 이 큐의 worker 에서 일어난다.
 *
 * spec §3 의 "전용 큐 분리 가능 — 워크스페이스별 동시성 제한" 재량을 행사해
 * `document-embedding` 와 분리된 별도 큐로 둔다 (추출 부하가 임베딩/회수 경로의
 * 동시성에 간섭하지 않도록).
 */
export const AGENT_MEMORY_EXTRACTION_QUEUE = 'agent-memory-extraction';

/**
 * 추출 job 이 보는 turn 스냅샷. ConversationTurn 의 부분집합 — 추출 프롬프트
 * 빌드에 필요한 필드 (source/text/nodeLabel) 만 직렬화한다. ConversationTurn
 * 은 push 이후 `Object.freeze` 로 불변(conversation-thread §3.2)이므로 array
 * shallow-copy 만으로 메인 루프의 후속 turn mutation 으로부터 격리된다
 * (`cloneThread` 와 동형의 격리 invariant — spec §3).
 */
export interface ExtractionTurnSnapshot {
  source: ConversationTurn['source'];
  text: string;
  nodeLabel: string;
}

/**
 * `AGENT_MEMORY_EXTRACTION_QUEUE` job payload (spec §3).
 *
 * - `workspaceId` / `scopeKey`: 저장 네임스페이스 `(workspace_id, scope_key)`
 *   (격리 의무 §5 — workspaceId 는 execution context 권위 값에서만 온다).
 * - `llmConfigId` / `model`: 추출 LLM 콜이 재사용할 노드 config (scope-freeze §3,
 *   별도 추출 모델 필드 신설 없음).
 * - `turns`: 추출 대상 직전 turn 들의 shallow-copy 스냅샷 (격리 invariant).
 */
export interface AgentMemoryExtractionJob {
  workspaceId: string;
  scopeKey: string;
  llmConfigId?: string | null;
  model?: string | null;
  turns: ExtractionTurnSnapshot[];
}

/**
 * 추출 프롬프트의 system 지시문. LLM 에게 직전 대화에서 **사용자에 관한 영속할
 * 사실·선호** 만 간결한 문장 목록(JSON 배열)으로 뽑게 한다. 추출할 게 없으면
 * 빈 배열을 반환하도록 명시해 환각·과추출을 억제한다 (spec §3 저장 shape:
 * content 단위 사실).
 */
export const EXTRACTION_SYSTEM_PROMPT =
  '당신은 대화에서 사용자에 관한 "영속할 사실과 선호" 만 추출하는 메모리 추출기입니다. ' +
  '다음 대화에서 향후 세션에서도 유효한 사용자 사실(예: 이름·소속·계정 등급·보유 정보) 과 ' +
  '선호(예: 말투·답변 형식·관심사) 를 간결한 한국어 평서문 목록으로 추출하세요. ' +
  '한 항목에는 하나의 사실/선호만 담습니다. ' +
  '일시적 잡담·인사·질문 그 자체·어시스턴트의 답변 내용은 추출하지 마세요. ' +
  '추출할 사실/선호가 없으면 빈 목록을 반환하세요. ' +
  '출력은 반드시 JSON 배열 (문자열들의 배열) 한 개만, 다른 텍스트 없이 반환하세요. 예: ["사용자는 간결한 답변을 선호한다", "계정 등급은 gold 다"]';

/**
 * turn 스냅샷을 추출 LLM 콜의 user 메시지(대화 transcript) 로 렌더한다. 순수
 * 함수 — 테스트가 격리 검증 가능. system turn 은 제외하고 user/assistant 만
 * `역할: 텍스트` 라인으로 직렬화한다 (tool turn 의 원시 JSON 은 추출에 잡음이
 * 되므로 제외).
 */
export function buildExtractionTranscript(
  turns: ExtractionTurnSnapshot[],
): string {
  const lines: string[] = [];
  for (const t of turns) {
    const text = t.text?.trim();
    if (!text) continue;
    let role: string | null;
    switch (t.source) {
      case 'ai_user':
      case 'presentation_user':
        role = '사용자';
        break;
      case 'ai_assistant':
        role = '어시스턴트';
        break;
      default:
        // system / ai_tool 등은 추출 입력에서 제외.
        role = null;
    }
    if (!role) continue;
    lines.push(`${role}: ${text}`);
  }
  return lines.join('\n');
}

/**
 * 추출 LLM 응답을 사실 문자열 배열로 파싱한다 (spec §3 — content 단위 사실).
 *
 * 우선 전체를 JSON 배열로 파싱하고, 실패하면 응답 안의 첫 `[ ... ]` 블록을
 * 시도한다 (모델이 설명을 앞뒤에 붙인 경우 graceful 회수). 그래도 실패하면
 * 빈 배열 (no-op) — 추출 실패가 저장 경로를 깨지 않게 한다.
 *
 * 결과는 trim + 빈 문자열 제거 + (정확 일치) dedup 후 반환한다.
 */
export function parseExtractionResponse(
  raw: string | null | undefined,
): string[] {
  if (!raw || !raw.trim()) return [];
  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };

  let parsed = tryParse(raw.trim());
  // 전체 파싱이 **실패(undefined)** 한 경우에만 배열 리터럴 추출로 fallback —
  // 모델이 설명을 앞뒤에 붙인 케이스 회수. 전체가 유효 JSON 이지만 배열이
  // 아닌 경우(예: 객체)는 그 안을 파헤치지 않고 빈 배열로 본다 (과추출 회피).
  if (parsed === undefined) {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start >= 0 && end > start) {
      parsed = tryParse(raw.slice(start, end + 1));
    }
  }
  if (!Array.isArray(parsed)) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    if (typeof item !== 'string') continue;
    const v = item.trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
