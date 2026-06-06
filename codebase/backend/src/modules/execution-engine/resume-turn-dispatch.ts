import type { Node } from '../nodes/entities/node.entity';
import type { Execution } from '../executions/entities/execution.entity';
import type { NodeExecution } from '../node-executions/entities/node-execution.entity';
import type { ExecutionContext } from '../../nodes/core/node-handler.interface';
import type { ProcessTurnResult } from '../../shared/execution-resume/process-turn-result';

/**
 * §7.5 rehydration 의 **대기-노드 turn dispatch** 추상화 (extension seam).
 *
 * full B3(exec-park D6) 이후 park 가능한 노드는 form · buttons · ai_agent /
 * information_extractor(multi-turn) 뿐이고, 각 재개 로직은 완전히 달라 공통
 * 처리기로 합칠 수 없다(form/button = 도착 payload 직접 처리, AI =
 * `_resumeCheckpoint` 로 turn-state 재구성). 과거엔 이 3분기가
 * `driveResumeAwaited`(top-level)·`driveResumeFrame`(중첩) **두 곳에 동일하게
 * 하드코딩**돼 있었다. 이를 ordered registry 의 `ResumeTurnDispatch` 항목으로
 * 추출해 (a) 중복을 제거하고 (b) 미래에 새 blocking 노드 타입이 추가될 때
 * registry 에 항목 1개 등록으로 plug-in 되도록 계약을 명시한다.
 *
 * **동작 보존**: 선택 우선순위(form → buttons → ai)·에러 코드·`PARK_RELEASED`
 * 조기반환 의미는 추출 전과 동일하다. AI 가 checkpoint 없이 진입하는 경우는
 * dispatch 도달 *전* `resumeFromCheckpoint` 가드(RESUME_INCOMPATIBLE_STATE)에서
 * 걸러지므로, AI selector 의 `hasResumeCheckpoint` 요구는 동작에 영향이 없다.
 *
 * spec: 5-system/4-execution-engine.md §7.5(rehydration) · §6.2(중첩 재개).
 */
export interface ResumeTurnDispatch {
  /** registry 내 식별·로깅용 안정 키 (예: 'form' / 'buttons' / 'ai_conversation'). */
  readonly kind: string;
  /**
   * 이 dispatch 가 주어진 대기 노드를 처리해야 하는지 판정한다. registry 는
   * 등록 순서대로 첫 매칭을 채택(first-match-wins)하므로, 우선순위는 배열 순서로
   * 표현한다.
   */
  selects(sel: ResumeTurnSelector): boolean;
  /**
   * 도착 continuation payload 를 이 노드의 resume 으로 구동한다.
   * @returns `PARK_RELEASED` = (AI) turn 처리 후 re-park 로 세그먼트 종료 →
   *          호출측이 그래프 순회를 멈춘다 · `void` = 노드 완료 → 순회 계속.
   */
  handle(ctx: ResumeTurnContext): Promise<ProcessTurnResult>;
}

/** dispatch 선택에 쓰는 대기-노드 식별 신호 묶음 (호출측이 미리 계산해 전달). */
export interface ResumeTurnSelector {
  readonly node: Node;
  /**
   * blocking 핸들러 metadata 의 `interaction` (handler kind 가 'blocking' 일 때만,
   * 아니면 `undefined`). form 선택에 쓴다.
   */
  readonly blockingInteraction: string | undefined;
  /**
   * park 시 `NodeExecution.outputData.meta.interactionType` 로 영속된 값
   * (예: 'buttons' / 'ai_conversation' / 'ai_form_render'). buttons 선택에 쓴다.
   */
  readonly persistedInteractionType: string | undefined;
  /** `ai_conversation` / `ai_form_render` 여부. */
  readonly isAiConversation: boolean;
  /** `_resumeCheckpoint`(§7.5) 존재 여부. */
  readonly hasResumeCheckpoint: boolean;
}

/** dispatch handler 가 도착 turn 을 처리하는 데 필요한 실행 컨텍스트. */
export interface ResumeTurnContext {
  readonly savedExecution: Execution;
  readonly executionId: string;
  readonly node: Node;
  readonly context: ExecutionContext;
  /** 대기 NodeExecution row (중첩 frame 진입 시 미상이면 null). */
  readonly nodeExec: NodeExecution | null;
  /** park 시 영속된 interactionType (selector 빌드 + AI 분기 재사용). */
  readonly persistedInteractionType: string | undefined;
  /** ai_conversation / ai_form_render 여부. */
  readonly isAiConversation: boolean;
  /** AI 재개 시 turn-state 재구성에 쓰는 `_resumeCheckpoint`. */
  readonly resumeCheckpoint: Record<string, unknown> | undefined;
  /** 대기 노드의 캐시된 output (AI `_resumeState` seed 시 병합). */
  readonly cachedOutput: Record<string, unknown> | undefined;
  /** 도착한 continuation payload (turn 입력). */
  readonly payload: unknown;
}
