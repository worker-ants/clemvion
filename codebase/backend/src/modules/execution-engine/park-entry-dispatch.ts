import type { Node } from '../nodes/entities/node.entity';
import type { Execution } from '../executions/entities/execution.entity';
import type { ExecutionContext } from '../../nodes/core/node-handler.interface';
import type { ProcessTurnResult } from '../../shared/execution-resume/process-turn-result';
import type { GraphEdge } from './graph/graph-builder';

/**
 * **최초 park 진입(park-entry)** 의 blocking 인터랙션 dispatch 추상화 (extension
 * seam). resume 측 {@link import('./resume-turn-dispatch').ResumeTurnDispatch}
 * (PR #507) 와 **대칭**이다.
 *
 * 노드가 `waiting_for_input` 으로 진입하면 엔진은 노드 타입에 맞는 `waitForX`
 * (form/buttons/ai) 를 골라 호출해 park 한다. 이 선택 분기가 과거엔 세 곳
 * (`runExecution` 메인 루프 · `executeInline` 중첩 sub-workflow · `runNodeDispatchLoop`
 * retry/resume 드라이브)에 **동일하게 하드코딩**돼 있었다 (`interaction-type-registry.md`
 * §4 가 차단하려는 shotgun surgery — exhaustive switch 는 "신규 type 누락" 만 잡고
 * "세 블록 간 동작 불일치" 는 못 잡는다). 이를 ordered registry 의
 * {@link ParkEntryDispatch} 항목으로 추출해 (a) 선택 로직 삼중복을 제거하고
 * (b) 미래 blocking 노드 타입 추가 시 registry 항목 1줄 등록으로 plug-in 되게 한다.
 *
 * **동작 보존**: 선택 우선순위(form → buttons → ai)·`waitForX` 인자·`PARK_RELEASED`
 * 조기반환 의미는 추출 전과 동일. 단 **park 후 control-flow 반응은 사이트마다 다르다**
 * (메인 루프 = bare `return`, 중첩 = `ParkReleaseSignal` throw, 드라이브 =
 * `{ parked: true }` 반환). 따라서 dispatch 는 `ProcessTurnResult` 를 **그대로 반환**만
 * 하고, `PARK_RELEASED` escape 는 **각 호출 사이트가 보유**한다 (registry 는 선택 +
 * `waitForX` 호출만 소유).
 *
 * `ai_form_render` 는 별도 항목이 아니라 `ai_conversation` AI turn 경로
 * (`waitForAiConversation`)를 공유한다 (resume 측 `isAiConversation` 과 동일 정책).
 *
 * spec: 5-system/4-execution-engine.md §7.5 · conventions/interaction-type-registry.md §1.2.
 */
export interface ParkEntryDispatch {
  /** registry 내 식별·로깅용 안정 키 (예: 'form' / 'buttons' / 'ai_conversation'). */
  readonly kind: string;
  /**
   * 이 dispatch 가 주어진 대기 노드를 처리해야 하는지 판정한다. registry 는 등록
   * 순서대로 첫 매칭을 채택(first-match-wins)하므로, 우선순위(form → buttons → ai)는
   * 배열 순서로 표현한다.
   */
  selects(sel: ParkEntrySelector): boolean;
  /**
   * 대기 노드를 park 한다 (`waitForFormSubmission` / `waitForButtonInteraction` /
   * `waitForAiConversation` 위임).
   * @returns `PARK_RELEASED` = fresh top-level park 으로 세그먼트 종료 (호출측이
   *          사이트별 escape 로 코루틴 unwind) · `void` = 진행 계속.
   */
  handle(ctx: ParkEntryContext): Promise<ProcessTurnResult>;
}

/** dispatch 선택에 쓰는 대기-노드 식별 신호 (호출측이 미리 계산해 전달). */
export interface ParkEntrySelector {
  readonly node: Node;
  /**
   * blocking 핸들러 metadata 의 `interaction` (handler kind 가 'blocking' 일 때만,
   * 아니면 `undefined`). `form` 선택에 쓴다 (정적 metadata 기반).
   */
  readonly blockingInteraction: string | undefined;
  /**
   * 런타임 cached `meta.interactionType` (`getInteractionType` — structured 우선,
   * flat fallback). `buttons` / `ai_conversation` / `ai_form_render` 선택에 쓴다.
   */
  readonly interactionType: string | undefined;
}

/** dispatch handler 가 park 진입에 쓰는 실행 컨텍스트. */
export interface ParkEntryContext {
  /**
   * park 대상 Execution. top-level 사이트는 `savedExecution`, 중첩
   * (`executeInline`) 사이트는 narrowed `execution` 을 넣는다 (동일 row).
   */
  readonly savedExecution: Execution;
  readonly executionId: string;
  readonly node: Node;
  readonly context: ExecutionContext;
  /** buttons 핸들러 전용 (`waitForButtonInteraction` 5번째 인자). form/ai 는 무시. */
  readonly graphEdges: GraphEdge[];
}

/**
 * registry 항목의 `handle` 이 위임할 park 처리기 묶음. 서비스가 `this`-bound
 * `waitForX` 를 주입한다. (factory 로 분리해 registry 순서·selector 술어를 서비스
 * 인스턴스 없이 단위 테스트할 수 있게 한다 — resume 측은 인라인이라 e2e 만 커버.)
 */
export interface ParkEntryDispatchDeps {
  handleForm(ctx: ParkEntryContext): Promise<ProcessTurnResult>;
  handleButtons(ctx: ParkEntryContext): Promise<ProcessTurnResult>;
  handleAiConversation(ctx: ParkEntryContext): Promise<ProcessTurnResult>;
}

/**
 * ordered park-entry registry 를 구성한다. **배열 순서 = 우선순위**
 * (form → buttons → ai_conversation, first-match-wins). `ai_form_render` 는
 * `ai_conversation` 항목이 함께 매칭한다.
 */
export function buildParkEntryRegistry(
  deps: ParkEntryDispatchDeps,
): readonly ParkEntryDispatch[] {
  return [
    {
      kind: 'form',
      selects: (sel) => sel.blockingInteraction === 'form',
      handle: deps.handleForm,
    },
    {
      kind: 'buttons',
      selects: (sel) => sel.interactionType === 'buttons',
      handle: deps.handleButtons,
    },
    {
      kind: 'ai_conversation',
      selects: (sel) =>
        sel.interactionType === 'ai_conversation' ||
        sel.interactionType === 'ai_form_render',
      handle: deps.handleAiConversation,
    },
  ];
}
