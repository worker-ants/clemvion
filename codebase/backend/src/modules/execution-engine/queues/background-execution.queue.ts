import type { ExecutionContext } from '../../../nodes/core/node-handler.interface';
import type { ConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

/**
 * Background 노드의 자식 흐름을 비동기로 실행하기 위한 BullMQ 큐 이름.
 * 메인 워크플로우 큐와 분리해 백그라운드 작업이 메인 흐름 처리량을 잠식하지 않도록 한다.
 */
export const BACKGROUND_EXECUTION_QUEUE = 'background-execution';

/**
 * 큐에 enqueue되는 작업 페이로드.
 *
 * 컨텍스트는 enqueue 시점에 메인 흐름에서 **스냅샷**(얕은 복사)으로 떠서 함께 전달한다.
 * 이렇게 해야 background body가 실행되는 사이 메인이 변수를 바꿔도 영향을 주지 않는다.
 */
export interface BackgroundExecutionJob {
  executionId: string;
  /** Background 노드 자체의 NodeExecution id. 자식 NodeExecution의 parent로 사용. */
  parentNodeExecutionId: string;
  /**
   * Background 핸들러가 발급한 UUID v4. 모니터링 API 의 조회 키이자
   * WebSocket `background:run:<id>` 채널의 식별자.
   *
   * `scheduleBackgroundBody()` 에서 parent NodeExecution 의
   * `outputData.meta.backgroundRunId` 를 읽어 채운다. 다음 두 경우 부재
   * (`undefined`) 가능:
   *   - 옛 NodeExecution 의 본문 실행 (handler 가 키 발급 전 row).
   *   - 인-플라이트 큐 메시지 — 배포 순간 Redis 에 적재된 구 버전 메시지
   *     (`backgroundRunId` 필드 없음) 를 새 processor 가 역직렬화.
   *
   * 부재 시 processor 는 WS 이벤트 emit 을 건너뛰고 notification 도
   * `resourceType='execution'` 으로 fallback 한다 — 기능 회귀 없음.
   */
  backgroundRunId?: string;
  workspaceId: string;
  workflowId: string;
  /** Background 컨테이너 안쪽 자식 노드의 진입점(들) */
  bodyEntryNodeIds: string[];
  /**
   * Background 노드가 컨테이너(Loop · ForEach · Map) 본문 안에 있으면 그 컨테이너 ID.
   * 워커는 이 컨테이너의 본문 노드로 그래프를 만들어 본문을 실행한다. 맨 바깥
   * Background 와 이 필드가 생기기 전에 큐에 들어간 작업에는 없고 그때는 맨 바깥
   * 그래프를 쓴다(CLE-T-MR6ZH3).
   */
  containerScopeId?: string;
  /**
   * Background 를 큐에 넣은 회차의 ForEach · Map 반복 변수(`$item` · `$itemIndex` ·
   * `$itemIsFirst` · `$itemIsLast`) 스냅샷. 컨테이너 본문 안이나 그 안 병렬 분기에서
   * 큐에 넣을 때만 있다. 워커가 본문 실행 컨텍스트에 되살려 본문 노드 식이 그 회차의
   * 값을 읽는다. 맨 바깥 Background 와 이 필드가 생기기 전에 큐에 들어간 작업에는 없고
   * 그때 본문의 반복 변수는 비어 있다(CLE-T-MR6ZH3, 질문 01a1cd70 답 A).
   */
  itemContext?: ExecutionContext['itemContext'];
  /** 같은 규칙의 Loop 반복 변수(`$loop`) 스냅샷. */
  loopContext?: ExecutionContext['loopContext'];
  /**
   * Background 노드가 받은 입력의 스냅샷. 본문 진입 노드가 이 값을 입력으로 받는다
   * (CLE-NODE-BACKGROUND 본문 진입 입력 표, CLE-T-TDAV1G).
   */
  input: unknown;
  /** Snapshot of context.variables at enqueue time. */
  variables: Record<string, unknown>;
  /** Snapshot of context.nodeOutputCache at enqueue time. */
  nodeOutputCache: Record<string, unknown>;
  /** Snapshot of context.expressionContext at enqueue time. */
  expressionContext: Record<string, unknown>;
  /**
   * Snapshot of context.conversationThread at enqueue time — turns 배열까지
   * 새 인스턴스로 복사된다. 백그라운드 본문이 새 turn 을 push 해도 메인 흐름의
   * thread 가 변형되지 않고, 그 반대도 마찬가지 (PRD 3 §4.11 ND-BG-05 격리
   * 원칙 / spec/conventions/conversation-thread.md §3.2).
   *
   * Optional only for backward-compat: jobs enqueued before this field was
   * introduced (legacy BullMQ payloads) won't carry it; the worker falls
   * back to an empty thread. New enqueue paths must always populate this.
   */
  conversationThread?: ConversationThread;
  /** Background 노드 본문의 구성: 알림·타임아웃 정책. */
  config: {
    notifyOnFailure: boolean;
    /** 0이면 무제한. */
    maxDurationMs: number;
  };
}
