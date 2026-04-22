import { beforeEach, describe, expect, it } from "vitest";
import {
  handleSseEvent,
  summarizePlanState,
  useAssistantStore,
  type AssistantDisplayMessage,
  type AssistantPlanCard,
} from "../assistant-store";
import type { AssistantSseEvent } from "@/lib/api/assistant";
import { useLocaleStore } from "@/lib/stores/locale-store";

/**
 * `handleSseEvent` 의 done 분기는 "이번 턴이 어떤 형태로 끝났는가" 를 보고
 * 사용자에게 보여줄 systemHint 를 결정한다. 시나리오별 우선순위:
 *   error > stalled > planApprove > completed.
 *
 * 본 spec 은 새로 추가된 plan-only systemHint 분기를 중심으로 검증한다 —
 * propose_plan 직후 LLM 이 prose 를 생략하는 새 규약을 클라이언트가 받아
 * "계획대로 진행해 주세요." 안내를 자동 주입해야 한다.
 */

const ASSISTANT_ID = "asst-1";

function makePlan(overrides: Partial<AssistantPlanCard> = {}): AssistantPlanCard {
  return {
    messageId: ASSISTANT_ID,
    planId: "plan-1",
    title: "주문 취소 플로우",
    summary: "",
    steps: [
      {
        id: "s1",
        action: "add_node",
        description: "HTTP 노드 추가",
        status: "pending",
      },
      {
        id: "s2",
        action: "add_edge",
        description: "trigger → HTTP 연결",
        status: "pending",
      },
    ],
    openQuestions: undefined,
    approved: false,
    ...overrides,
  };
}

function seedAssistant(overrides: Partial<AssistantDisplayMessage> = {}) {
  const baseMessage: AssistantDisplayMessage = {
    id: ASSISTANT_ID,
    role: "assistant",
    content: "",
    toolCalls: [],
    plan: null,
    streaming: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  useAssistantStore.setState({ messages: [baseMessage] });
}

const doneEvent: AssistantSseEvent = {
  event: "done",
  data: { finishReason: "stop" },
};

describe("assistant-store", () => {
  beforeEach(() => {
    useAssistantStore.setState({
      messages: [],
      isStreaming: false,
      streamingMessageId: null,
      error: null,
      abortController: null,
    });
    useLocaleStore.setState({ locale: "ko" });
  });

  describe("done event → systemHint injection", () => {
    it("does NOT inject any hint on a plan-only turn (plan card's '계획대로 진행' button covers the UX)", () => {
      // 2026-04-23 UX 피드백: plan card 가 렌더되면 이미 "계획대로 진행" 버튼이
      // 표시되므로 같은 메시지를 다시 info hint 로 띄우는 것은 중복.
      seedAssistant({ plan: makePlan() });

      handleSseEvent(
        useAssistantStore.setState,
        useAssistantStore.getState,
        ASSISTANT_ID,
        doneEvent,
      );

      const msg = useAssistantStore.getState().messages[0];
      expect(msg.systemHint).toBeUndefined();
      expect(msg.streaming).toBe(false);
    });

    it("does NOT inject any hint when the plan is already approved (plan-only hint was removed in 2026-04-23)", () => {
      // approved=true + 모든 step pending → stalled hint 가 우선 발동.
      seedAssistant({ plan: makePlan({ approved: true }) });

      handleSseEvent(
        useAssistantStore.setState,
        useAssistantStore.getState,
        ASSISTANT_ID,
        doneEvent,
      );

      const msg = useAssistantStore.getState().messages[0];
      expect(msg.systemHint?.kind).toBe("info");
      expect(msg.systemHint?.text).toContain("이어서 진행해줘");
    });

    it("emits the success hint when all actionable steps are done and openQuestions is empty", () => {
      seedAssistant({
        plan: makePlan({
          approved: true,
          steps: [
            {
              id: "s1",
              action: "add_node",
              description: "HTTP 노드 추가",
              status: "done",
            },
            {
              id: "s2",
              action: "add_edge",
              description: "trigger → HTTP 연결",
              status: "done",
            },
          ],
        }),
      });

      handleSseEvent(
        useAssistantStore.setState,
        useAssistantStore.getState,
        ASSISTANT_ID,
        doneEvent,
      );

      const msg = useAssistantStore.getState().messages[0];
      expect(msg.systemHint?.kind).toBe("success");
      expect(msg.systemHint?.text).toContain("작업을 완료했어요");
    });

    it("does NOT inject any hint when the plan still has openQuestions (plan card shows answer-input guidance instead)", () => {
      // openQuestions 가 있으면 plan card 안에 "답변을 입력창에 적어 보내
      // 주세요." 가 이미 노출되므로 systemHint 까지 띄우면 두 메시지가 충돌.
      seedAssistant({
        plan: makePlan({
          openQuestions: ["환불 여부를 어떻게 결정할까요?"],
        }),
      });

      handleSseEvent(
        useAssistantStore.setState,
        useAssistantStore.getState,
        ASSISTANT_ID,
        doneEvent,
      );

      const msg = useAssistantStore.getState().messages[0];
      expect(msg.systemHint).toBeUndefined();
    });

    it("does NOT inject any hint when the message already carries an error (error bubble takes precedence)", () => {
      seedAssistant({
        plan: makePlan(),
        error: { code: "ASSISTANT_TOO_MANY_TOOL_CALLS", message: "budget" },
      });

      handleSseEvent(
        useAssistantStore.setState,
        useAssistantStore.getState,
        ASSISTANT_ID,
        doneEvent,
      );

      const msg = useAssistantStore.getState().messages[0];
      expect(msg.systemHint).toBeUndefined();
    });
  });

  describe("summarizePlanState", () => {
    it("returns 'none' for a freshly proposed unapproved plan with no progress", () => {
      const msg: AssistantDisplayMessage = {
        id: ASSISTANT_ID,
        role: "assistant",
        content: "",
        toolCalls: [],
        plan: makePlan(),
        streaming: false,
        createdAt: new Date().toISOString(),
      };
      const summary = summarizePlanState(msg, [msg]);
      expect(summary.status).toBe("none");
    });

    it("returns 'pending' when approved and at least one actionable step remains", () => {
      const msg: AssistantDisplayMessage = {
        id: ASSISTANT_ID,
        role: "assistant",
        content: "",
        toolCalls: [],
        plan: makePlan({
          approved: true,
          steps: [
            {
              id: "s1",
              action: "add_node",
              description: "first",
              status: "done",
            },
            {
              id: "s2",
              action: "add_node",
              description: "second",
              status: "pending",
            },
          ],
        }),
        streaming: false,
        createdAt: new Date().toISOString(),
      };
      const summary = summarizePlanState(msg, [msg]);
      expect(summary).toEqual({ status: "pending", completedActionable: 1 });
    });

    it("returns 'completed' when all actionable steps are done and no openQuestions", () => {
      const msg: AssistantDisplayMessage = {
        id: ASSISTANT_ID,
        role: "assistant",
        content: "",
        toolCalls: [],
        plan: makePlan({
          approved: true,
          steps: [
            {
              id: "s1",
              action: "add_node",
              description: "x",
              status: "done",
            },
          ],
        }),
        streaming: false,
        createdAt: new Date().toISOString(),
      };
      const summary = summarizePlanState(msg, [msg]);
      expect(summary).toEqual({ status: "completed", completedActionable: 1 });
    });

    it("returns 'pending' when all actionable steps are done but openQuestions remain unanswered", () => {
      // 회귀 가드: 모든 actionable step 이 done 이어도 openQuestions 가
      // 있으면 사용자 답을 기다려야 하므로 'completed' 가 아닌 'pending'.
      const msg: AssistantDisplayMessage = {
        id: ASSISTANT_ID,
        role: "assistant",
        content: "",
        toolCalls: [],
        plan: makePlan({
          approved: true,
          steps: [
            {
              id: "s1",
              action: "add_node",
              description: "x",
              status: "done",
            },
          ],
          openQuestions: ["환불 여부를 어떻게 결정할까요?"],
        }),
        streaming: false,
        createdAt: new Date().toISOString(),
      };
      const summary = summarizePlanState(msg, [msg]);
      expect(summary).toEqual({ status: "pending", completedActionable: 1 });
    });

    it("ignores 'note'-action steps when counting actionable progress", () => {
      const msg: AssistantDisplayMessage = {
        id: ASSISTANT_ID,
        role: "assistant",
        content: "",
        toolCalls: [],
        plan: makePlan({
          approved: true,
          steps: [
            {
              id: "n1",
              action: "note",
              description: "reminder",
              status: "pending",
            },
            {
              id: "s1",
              action: "add_node",
              description: "real",
              status: "done",
            },
          ],
        }),
        streaming: false,
        createdAt: new Date().toISOString(),
      };
      const summary = summarizePlanState(msg, [msg]);
      // note 는 actionable 이 아니므로 이미 모두 done.
      expect(summary).toEqual({ status: "completed", completedActionable: 1 });
    });
  });

  describe("continueAfterBudget action", () => {
    it("sends '이어서 진행해줘' as a user message using the current locale", async () => {
      // parent 가 workflow snapshot 을 넘기면 store 는 i18n 된 메시지를 그대로
      // sendMessage 에 위임한다. RESUMABLE 에러의 "이어서 진행" 버튼이 이 action
      // 을 호출하므로, 잘못된 메시지 문자열이 전송되면 서버 active-plan-context
      // 가 resume 지시어를 인식하지 못한다.
      let sent: { content: string; locale: string } | null = null;
      useAssistantStore.setState({
        // sendMessage 를 mock 해 실제 API 호출 없이 호출 인자만 캡처.
        sendMessage: async (content) => {
          sent = { content, locale: useLocaleStore.getState().locale };
        },
      });
      const snapshot = { nodes: [], edges: [] };
      await useAssistantStore.getState().continueAfterBudget(snapshot);
      expect(sent).toEqual({ content: "이어서 진행해줘.", locale: "ko" });
    });

    it("uses English translation when locale is 'en'", async () => {
      let sent: string | null = null;
      useAssistantStore.setState({
        sendMessage: async (content) => {
          sent = content;
        },
      });
      useLocaleStore.setState({ locale: "en" });
      await useAssistantStore.getState().continueAfterBudget({
        nodes: [],
        edges: [],
      });
      expect(sent).toBe("Continue.");
    });
  });
});
