import {
  useExecutionStore,
  selectPendingFormToolCallId,
} from "@/lib/stores/execution-store";

/**
 * `ResultDetail` 의 store 파생 입력(waiting selector·resume 콜백·타입별 대기 플래그)을
 * 한 곳에서 제공한다 — 에디터 Run Results 드로어(`run-results-drawer.tsx`)와 실행 상세
 * 페이지(`executions/[executionId]/page.tsx`)가 각자 중복 유도하던 selector 블록을
 * 단일화(ai-review maintainability WARNING, V-05 후속).
 *
 * **Rules of Hooks**: 반환된 selector 는 store 구독이므로, 소비처는 이 hook 을
 * (드로어의 `status === "idle"` 같은) early return **이전**에 호출해야 한다. 반면
 * 타입별 대기 플래그는 소비처마다 다른 `isSelectedWaiting` 에 의존하므로(드로어:
 * iteration-aware `nodeExecutionId` dual match; 실행 상세: `selectedNodeId ===
 * waitingNodeId`) hook 안에서 계산하지 않고 순수 함수 `deriveFlags(isSelectedWaiting)`
 * 로 노출한다 — 이 함수 호출은 hook 이 아니라 early return 이후에 써도 안전하다.
 *
 * `waitingNodeId`·conversation item 선택(store action vs 로컬 state)은 소비처마다
 * 소스가 달라 본 hook 범위 밖 — 소비처가 직접 유지·전달한다.
 */
export function useResultDetailWaiting() {
  const waitingInteractionType = useExecutionStore(
    (s) => s.waitingInteractionType,
  );
  const waitingFormConfig = useExecutionStore((s) => s.waitingFormConfig);
  const waitingButtonConfig = useExecutionStore((s) => s.waitingButtonConfig);
  const waitingConversationConfig = useExecutionStore(
    (s) => s.waitingConversationConfig,
  );
  const conversationMessages = useExecutionStore((s) => s.conversationMessages);
  const isWaitingAiResponse = useExecutionStore((s) => s.isWaitingAiResponse);
  const pendingFormToolCallId = useExecutionStore(selectPendingFormToolCallId);
  const resumeFromForm = useExecutionStore((s) => s.resumeFromForm);
  const resumeFromAiRenderForm = useExecutionStore(
    (s) => s.resumeFromAiRenderForm,
  );
  const resumeFromButtons = useExecutionStore((s) => s.resumeFromButtons);
  const resumeFromConversation = useExecutionStore(
    (s) => s.resumeFromConversation,
  );

  /**
   * 타입별 대기 플래그를 도출. spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii + spec §12.5
   * — `ai_form_render` 의 활성 form 은 ConversationInspector timeline 인라인이므로
   * `isWaitingForm` 은 그래프 Form 노드(`interactionType: 'form'`)로 한정하고,
   * `ai_form_render` 는 `isWaitingConversation` 으로만 흡수한다(별도 DynamicFormUI
   * stack 미생성). 이 뉘앙스를 두 소비처가 공유하도록 여기서 단일 정의한다.
   */
  const deriveFlags = (isSelectedWaiting: boolean) => ({
    isWaitingForm: isSelectedWaiting && waitingInteractionType === "form",
    isWaitingButtons: isSelectedWaiting && waitingInteractionType === "buttons",
    isWaitingConversation:
      isSelectedWaiting &&
      (waitingInteractionType === "ai_conversation" ||
        waitingInteractionType === "ai_form_render"),
  });

  return {
    waitingInteractionType,
    waitingFormConfig,
    waitingButtonConfig,
    waitingConversationConfig,
    conversationMessages,
    isWaitingAiResponse,
    pendingFormToolCallId,
    resumeFromForm,
    resumeFromAiRenderForm,
    resumeFromButtons,
    resumeFromConversation,
    deriveFlags,
  };
}
