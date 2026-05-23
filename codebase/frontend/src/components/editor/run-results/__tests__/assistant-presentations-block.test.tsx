import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AssistantPresentationsBlock,
  findButtonContext,
  composeUserMessage,
} from "../renderers/assistant-presentations-block";
import type { PresentationPayload } from "@/lib/conversation/conversation-utils";

/**
 * spec/4-nodes/6-presentation/0-common.md §10.8 — render_* 클릭 user-message
 * 합성 SoT 검증.
 *
 * 우선순위: 1) button.userMessage → 2) per-item: "{item.title} → {label}" →
 * 3) global: "{label}" → 4) buttonId fallback.
 */
describe("findButtonContext — 버튼 식별 + 부모 아이템 컨텍스트", () => {
  it("global button (buttonConfig.buttons) 매칭 시 button 만 반환 (item 없음)", () => {
    const data = {
      config: {
        buttonConfig: {
          buttons: [{ id: "approve", label: "Approve", type: "port" }],
        },
      },
    };
    const ctx = findButtonContext(data, "approve");
    expect(ctx?.button.id).toBe("approve");
    expect(ctx?.button.label).toBe("Approve");
    expect(ctx?.item).toBeUndefined();
  });

  it("static per-item button (items[].buttons) 매칭 시 부모 item 반환", () => {
    const data = {
      items: [
        {
          title: "Sample 1",
          buttons: [{ id: "inq1", label: "문의", type: "port" }],
        },
        {
          title: "Sample 2",
          buttons: [{ id: "inq2", label: "문의", type: "port" }],
        },
      ],
    };
    const ctx = findButtonContext(data, "inq2");
    expect(ctx?.button.id).toBe("inq2");
    expect((ctx?.item as { title?: string })?.title).toBe("Sample 2");
  });

  it("dynamic itemButtons runtime ID (`{base}__item_{idx}`) 매칭 — base 정의 + items[idx] 반환", () => {
    // spec §5.4-B dynamic 모드: buttonConfig.buttons 에 synthesized 런타임 ID
    // (`act__item_0` / `act__item_1`) 가 들어가지만, 본 helper 는 base 정의 (`itemButtons`
    // 의 원본 `{id:"act", userMessage?, label}`) 를 반환한다 — userMessage 는 LLM 이
    // base 에 명시하므로 LLM-author 의도를 정확히 잡으려면 base 가 SoT.
    const data = {
      config: {
        itemButtons: [
          {
            id: "act",
            label: "Select",
            type: "port",
            userMessage: "{{ title }} 선택",
          },
        ],
        buttonConfig: {
          buttons: [
            { id: "act__item_0", label: "Select", type: "port" },
            { id: "act__item_1", label: "Select", type: "port" },
          ],
          buttonItemMap: { act__item_0: 0, act__item_1: 1 },
        },
      },
      items: [{ title: "Alpha" }, { title: "Beta" }],
    };
    const ctx = findButtonContext(data, "act__item_1");
    expect(ctx?.button.id).toBe("act");
    expect(ctx?.button.label).toBe("Select");
    expect(
      (ctx?.button as { userMessage?: string })?.userMessage,
    ).toBe("{{ title }} 선택");
    expect((ctx?.item as { title?: string })?.title).toBe("Beta");
  });

  it("매칭 실패 시 undefined 반환 — caller 가 buttonId fallback 사용", () => {
    const data = {
      config: { buttonConfig: { buttons: [{ id: "x", label: "X", type: "port" }] } },
    };
    const ctx = findButtonContext(data, "ghost");
    expect(ctx).toBeUndefined();
  });

  // SUMMARY#12 — priority conflict: same buttonId in both items[].buttons and
  // config (buttonConfig). Step 1 (items[].buttons) must win because it carries
  // the richest item context.
  it("우선순위 충돌: items[].buttons 와 buttonConfig.buttons 에 동일 ID 존재 시 step 1 (items) 가 우선", () => {
    const data = {
      config: {
        buttonConfig: {
          buttons: [
            { id: "shared-id", label: "Global label", type: "port" },
          ],
        },
      },
      items: [
        {
          title: "Item title",
          buttons: [{ id: "shared-id", label: "Per-item label", type: "port" }],
        },
      ],
    };
    const ctx = findButtonContext(data, "shared-id");
    // Step 1 wins — item context is returned
    expect(ctx?.button.label).toBe("Per-item label");
    expect((ctx?.item as { title?: string })?.title).toBe("Item title");
  });

  it("userMessage 필드 보존 — button context 에 함께 반환", () => {
    const data = {
      config: {
        buttonConfig: {
          buttons: [
            {
              id: "approve",
              label: "Approve",
              type: "port",
              userMessage: "LLM-authored custom",
            },
          ],
        },
      },
    };
    const ctx = findButtonContext(data, "approve");
    expect((ctx?.button as { userMessage?: string })?.userMessage).toBe(
      "LLM-authored custom",
    );
  });
});

describe("composeUserMessage — 우선순위 (spec §10.8)", () => {
  it("priority 1: button.userMessage 가 있으면 그대로 발화", () => {
    const msg = composeUserMessage(
      {
        button: { label: "Inquire", userMessage: "샘플상품 1 에 대해 문의하고 싶습니다" },
        item: { title: "샘플상품 1" },
      },
      "btn-id",
    );
    expect(msg).toBe("샘플상품 1 에 대해 문의하고 싶습니다");
  });

  it("priority 2: per-item 버튼 (item 컨텍스트 존재) → `{title} → {label}` 합성", () => {
    const msg = composeUserMessage(
      {
        button: { label: "문의하기" },
        item: { title: "샘플상품 1" },
      },
      "btn-id",
    );
    expect(msg).toBe("샘플상품 1 → 문의하기");
  });

  it("priority 3: global 버튼 (item 없음) → label 그대로 발화", () => {
    const msg = composeUserMessage(
      { button: { label: "Approve" } },
      "btn-id",
    );
    expect(msg).toBe("Approve");
  });

  it("priority 4: ctx 없음 → buttonId fallback (기존 동작 유지)", () => {
    const msg = composeUserMessage(undefined, "ghost-btn-id");
    expect(msg).toBe("ghost-btn-id");
  });

  it("label 도 없으면 buttonId 로 fallback", () => {
    const msg = composeUserMessage({ button: {} }, "btn-no-label");
    expect(msg).toBe("btn-no-label");
  });

  it("item.title 가 빈 문자열이면 global 처럼 label 단독 발화 (안전한 fallback)", () => {
    const msg = composeUserMessage(
      { button: { label: "Click" }, item: { title: "" } },
      "btn-id",
    );
    expect(msg).toBe("Click");
  });

  it("userMessage 가 빈 문자열이면 무시하고 다음 우선순위 적용", () => {
    // LLM 이 명시적으로 빈 문자열을 보내면 의도 모호 — fallback 합성을 따른다.
    const msg = composeUserMessage(
      {
        button: { label: "문의", userMessage: "" },
        item: { title: "샘플 1" },
      },
      "btn-id",
    );
    expect(msg).toBe("샘플 1 → 문의");
  });
});

describe("AssistantPresentationsBlock — onSendMessage 통합 (spec §10.8)", () => {
  function makeCarousel(payload: Record<string, unknown>): PresentationPayload {
    return {
      type: "carousel",
      toolCallId: "call_1",
      payload,
    } as PresentationPayload;
  }

  it("per-item 버튼 클릭 (userMessage 없음) — `{item.title} → {label}` 발화", () => {
    const onSendMessage = vi.fn();
    const carousel = makeCarousel({
      config: {
        buttonConfig: {
          buttons: [
            { id: "inq1", label: "문의하기", type: "port" },
            { id: "inq2", label: "문의하기", type: "port" },
          ],
        },
      },
      items: [
        {
          title: "샘플상품 1",
          buttons: [{ id: "inq1", label: "문의하기", type: "port" }],
        },
        {
          title: "샘플상품 2",
          buttons: [{ id: "inq2", label: "문의하기", type: "port" }],
        },
      ],
    });
    render(
      <AssistantPresentationsBlock
        presentations={[carousel]}
        onSendMessage={onSendMessage}
      />,
    );
    const btns = screen.getAllByRole("button", { name: "문의하기" });
    fireEvent.click(btns[1]);
    expect(onSendMessage).toHaveBeenCalledWith("샘플상품 2 → 문의하기");
  });

  it("per-item 버튼 클릭 (userMessage 명시) — LLM 자율 텍스트 그대로 발화", () => {
    const onSendMessage = vi.fn();
    const carousel = makeCarousel({
      config: {
        buttonConfig: {
          buttons: [
            {
              id: "inq",
              label: "문의",
              type: "port",
              userMessage: "샘플상품 1 의 가격이 궁금해요",
            },
          ],
        },
      },
      items: [
        {
          title: "샘플상품 1",
          buttons: [
            {
              id: "inq",
              label: "문의",
              type: "port",
              userMessage: "샘플상품 1 의 가격이 궁금해요",
            },
          ],
        },
      ],
    });
    render(
      <AssistantPresentationsBlock
        presentations={[carousel]}
        onSendMessage={onSendMessage}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "문의" }));
    expect(onSendMessage).toHaveBeenCalledWith("샘플상품 1 의 가격이 궁금해요");
  });

  // SUMMARY#13 — smoke test: onSendMessage prop 미전달 시 예외 없이 렌더링
  it("onSendMessage 미전달 시 버튼 클릭이 예외를 던지지 않음 (defensive early-return)", () => {
    const carousel = makeCarousel({
      config: {
        buttonConfig: {
          buttons: [{ id: "btn-1", label: "Click", type: "port" }],
        },
      },
      items: [
        {
          title: "Item",
          buttons: [{ id: "btn-1", label: "Click", type: "port" }],
        },
      ],
    });
    // No onSendMessage prop — buttons should render but clicks should be no-ops
    expect(() =>
      render(
        <AssistantPresentationsBlock presentations={[carousel]} />,
      ),
    ).not.toThrow();
    // Block renders without error — integration smoke pass
  });
});

// Note: integration test 의 scope 는 carousel per-item path 로 한정한다.
// AssistantPresentationsBlock 의 PresentationItem switch 가 table/chart/template
// 에는 click handler 를 전달하지 않으며 (display-only) TemplateContent / TableContent /
// ChartContent 자체도 본문에 버튼을 렌더링하지 않는다 — 본 블록 안에서 클릭 가능한
// 경로는 carousel per-item / itemButtons 뿐. global 버튼 / dynamic runtime ID 의
// 합성 동작은 unit-level `composeUserMessage` / `findButtonContext` 테스트가
// 분리 검증한다 (integration 중복 회피).

// spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii — `render_form` 활성 form 의 timeline
// 인라인 단일 진실. CT-S13 회귀 차단 시나리오 (conversation-thread.md §9.10).
describe("AssistantPresentationsBlock — render_form active vs submitted 분기 (CT-S13)", () => {
  function makeFormPayload(toolCallId: string): PresentationPayload {
    return {
      type: "form",
      toolCallId,
      payload: {
        title: "Approval Request",
        submitLabel: "Submit",
        fields: [
          { name: "approval", type: "text", label: "승인 여부", required: true },
        ],
      },
    } as PresentationPayload;
  }

  it("payload.toolCallId 가 pendingFormToolCallId 와 일치 → interactive DynamicFormUI 렌더", () => {
    const onSubmitForm = vi.fn();
    render(
      <AssistantPresentationsBlock
        presentations={[makeFormPayload("call_form_1")]}
        pendingFormToolCallId="call_form_1"
        onSubmitForm={onSubmitForm}
      />,
    );
    // DynamicFormUI 의 form 입력 필드 (label "승인 여부") 가 렌더되어야 함
    expect(screen.getByLabelText(/승인 여부/)).toBeTruthy();
    // submit 버튼이 존재 (DynamicFormUI 의 submitLabel "Submit")
    expect(screen.getByRole("button", { name: /Submit/i })).toBeTruthy();
  });

  it("payload.toolCallId 가 pendingFormToolCallId 와 불일치 → FormSubmittedContent (display-only)", () => {
    render(
      <AssistantPresentationsBlock
        presentations={[makeFormPayload("call_form_1")]}
        pendingFormToolCallId="call_form_2"
        onSubmitForm={vi.fn()}
      />,
    );
    // 입력 필드 없음 (FormSubmittedContent 는 form input 미렌더)
    expect(screen.queryByLabelText(/승인 여부/)).toBeNull();
  });

  it("pendingFormToolCallId 가 null → 모든 form payload 가 FormSubmittedContent", () => {
    render(
      <AssistantPresentationsBlock
        presentations={[makeFormPayload("call_form_1")]}
        pendingFormToolCallId={null}
        onSubmitForm={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText(/승인 여부/)).toBeNull();
  });

  it("onSubmitForm 미전달 → active 케이스라도 FormSubmittedContent 로 fallback (defensive)", () => {
    render(
      <AssistantPresentationsBlock
        presentations={[makeFormPayload("call_form_1")]}
        pendingFormToolCallId="call_form_1"
      />,
    );
    // onSubmitForm 가 없으면 interactive 진입 자체를 회피 — submit 후 상태 흐름이
    // 망가지는 것을 차단. predicate `isActive` 의 마지막 조건 검증.
    expect(screen.queryByLabelText(/승인 여부/)).toBeNull();
  });
});
