import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useResultDetailWaiting } from "../use-result-detail-waiting";
import { useExecutionStore } from "@/lib/stores/execution-store";

describe("useResultDetailWaiting", () => {
  beforeEach(() => {
    useExecutionStore.getState().reset();
  });

  it("store waiting selector·resume 콜백·deriveFlags 를 반환한다", () => {
    const { result } = renderHook(() => useResultDetailWaiting());
    expect(typeof result.current.resumeFromForm).toBe("function");
    expect(typeof result.current.resumeFromAiRenderForm).toBe("function");
    expect(typeof result.current.resumeFromButtons).toBe("function");
    expect(typeof result.current.resumeFromConversation).toBe("function");
    expect(typeof result.current.deriveFlags).toBe("function");
    // 초기 store — form/button/conversation config 미설정.
    expect(result.current.waitingFormConfig).toBeNull();
  });

  it("deriveFlags: interactionType=form → isWaitingForm (isSelectedWaiting 게이팅)", () => {
    useExecutionStore.setState({ waitingInteractionType: "form" });
    const { result } = renderHook(() => useResultDetailWaiting());
    expect(result.current.deriveFlags(true)).toEqual({
      isWaitingForm: true,
      isWaitingButtons: false,
      isWaitingConversation: false,
    });
    // isSelectedWaiting=false 면 전부 false.
    expect(result.current.deriveFlags(false)).toEqual({
      isWaitingForm: false,
      isWaitingButtons: false,
      isWaitingConversation: false,
    });
  });

  it("deriveFlags: buttons → isWaitingButtons", () => {
    useExecutionStore.setState({ waitingInteractionType: "buttons" });
    const { result } = renderHook(() => useResultDetailWaiting());
    expect(result.current.deriveFlags(true).isWaitingButtons).toBe(true);
    expect(result.current.deriveFlags(true).isWaitingForm).toBe(false);
  });

  it("deriveFlags: ai_form_render 는 isWaitingConversation(자체 DynamicFormUI stack 아님)이고 isWaitingForm 은 아니다", () => {
    useExecutionStore.setState({ waitingInteractionType: "ai_form_render" });
    const { result } = renderHook(() => useResultDetailWaiting());
    const flags = result.current.deriveFlags(true);
    expect(flags.isWaitingConversation).toBe(true);
    expect(flags.isWaitingForm).toBe(false);
  });

  it("deriveFlags: ai_conversation → isWaitingConversation", () => {
    useExecutionStore.setState({ waitingInteractionType: "ai_conversation" });
    const { result } = renderHook(() => useResultDetailWaiting());
    expect(result.current.deriveFlags(true).isWaitingConversation).toBe(true);
  });
});
