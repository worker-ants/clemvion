import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePendingMessageQueue } from "./use-pending-message-queue";
import type { PendingInteraction, WidgetPhase } from "@/lib/widget-state";
import type { PersistedSession } from "@/lib/session-store";

interface Props {
  phase: WidgetPhase;
  pending: PendingInteraction | null;
}

function setup(initial: Props, hasSession = true) {
  const sendCommand = vi.fn().mockResolvedValue(undefined);
  const dispatch = vi.fn();
  const sessionRef = { current: (hasSession ? ({} as PersistedSession) : null) };
  const { result, rerender } = renderHook(
    (props: Props) => usePendingMessageQueue({ ...props, sessionRef, sendCommand, dispatch }),
    { initialProps: initial },
  );
  return { result, rerender, sendCommand, dispatch };
}

describe("usePendingMessageQueue (C1 §R6)", () => {
  it("enqueue 후 ai_conversation awaiting 진입 → flush(USER_MESSAGE + submit_message)", () => {
    const { result, rerender, sendCommand, dispatch } = setup({ phase: "booting", pending: null });
    act(() => result.current.enqueue("큐텍스트"));
    act(() => rerender({ phase: "awaiting_user_message", pending: { type: "ai_conversation", nodeId: "n1" } }));
    expect(dispatch).toHaveBeenCalledWith({ type: "USER_MESSAGE", text: "큐텍스트" });
    expect(sendCommand).toHaveBeenCalledWith({ command: "submit_message", nodeId: "n1", message: "큐텍스트" });
  });

  it("첫 표면 buttons → 큐 폐기(미전송)", () => {
    const { result, rerender, sendCommand, dispatch } = setup({ phase: "booting", pending: null });
    act(() => result.current.enqueue("폐기될 텍스트"));
    act(() => rerender({ phase: "awaiting_user_message", pending: { type: "buttons", nodeId: "n1" } }));
    expect(sendCommand).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("clearQueue 후엔 awaiting 진입해도 flush 안 됨", () => {
    const { result, rerender, sendCommand } = setup({ phase: "booting", pending: null });
    act(() => result.current.enqueue("x"));
    act(() => result.current.clearQueue());
    act(() => rerender({ phase: "awaiting_user_message", pending: { type: "ai_conversation", nodeId: "n1" } }));
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it("세션 없으면 flush 보류(전송 안 함)", () => {
    const { result, rerender, sendCommand } = setup({ phase: "booting", pending: null }, false);
    act(() => result.current.enqueue("대기"));
    act(() => rerender({ phase: "awaiting_user_message", pending: { type: "ai_conversation", nodeId: "n1" } }));
    expect(sendCommand).not.toHaveBeenCalled();
  });
});
