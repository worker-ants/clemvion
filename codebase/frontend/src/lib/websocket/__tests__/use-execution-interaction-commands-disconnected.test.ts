import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";

/**
 * 실시간 연결이 끊겼을 때의 입력 대기 명령(CLE-T-5P1ADY). 폼은 REST
 * `POST /executions/:id/continue` 로 보내고, 버튼 · 대화 · 재시도는 보내지 않고 안내한다.
 * 연결돼 있으면 지금처럼 WS 명령을 보낸다.
 */

const {
  emitMock,
  onceMock,
  isConnectedMock,
  toastErrorMock,
  continueExecutionMock,
} = vi.hoisted(() => ({
  emitMock: vi.fn(),
  onceMock: vi.fn(),
  isConnectedMock: vi.fn(() => false),
  toastErrorMock: vi.fn(),
  continueExecutionMock: vi.fn(),
}));

vi.mock("../ws-client", () => ({
  getWsClient: () => ({
    emit: emitMock,
    once: onceMock,
    isConnected: isConnectedMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock("@/lib/i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("../../api/executions", () => ({
  executionsApi: {
    continueExecution: continueExecutionMock,
  },
}));

import { useExecutionInteractionCommands } from "../use-execution-interaction-commands";
import { useExecutionStore } from "../../stores/execution-store";

const EXECUTION_ID = "exec-1";

function restError(
  status: number,
  body: unknown,
): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = {
    status,
    statusText: "",
    headers: {},
    config,
    data: body,
  } as AxiosResponse;
  return new AxiosError(
    `Request failed with status code ${status}`,
    "ERR_BAD_REQUEST",
    config,
    {},
    response,
  );
}

/** REST 호출의 then/catch 가 끝날 때까지 기다린다. */
async function flushRest(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderCommands(executionId: string | null = EXECUTION_ID) {
  return renderHook(() => useExecutionInteractionCommands(executionId)).result;
}

beforeEach(() => {
  emitMock.mockReset();
  onceMock.mockReset();
  toastErrorMock.mockReset();
  continueExecutionMock.mockReset();
  continueExecutionMock.mockResolvedValue(undefined);
  isConnectedMock.mockReset();
  isConnectedMock.mockReturnValue(false);
  useExecutionStore.getState().reset();
  useExecutionStore.setState({ executionId: EXECUTION_ID });
});

describe("연결이 끊겼을 때 폼 제출은 REST 로 보낸다", () => {
  it("POST /continue 로 보내고 WS 명령은 보내지 않는다", () => {
    const result = renderCommands();
    let sent: boolean | undefined;
    act(() => {
      sent = result.current.submitForm({ name: "John" });
    });

    expect(sent).toBe(true);
    expect(continueExecutionMock).toHaveBeenCalledWith(EXECUTION_ID, {
      name: "John",
    });
    expect(emitMock).not.toHaveBeenCalled();
    expect(onceMock).not.toHaveBeenCalled();
  });

  it("WS 경로처럼 제출 항목을 바로 넣고 응답 대기 표시를 켠다", () => {
    const result = renderCommands();
    act(() => {
      result.current.submitForm({ name: "John" });
    });

    const state = useExecutionStore.getState();
    expect(state.conversationMessages).toHaveLength(1);
    expect(state.conversationMessages[0]).toMatchObject({
      type: "presentation",
      presentation: {
        interactionType: "form_submitted",
        data: { name: "John" },
      },
    });
    expect(state.isWaitingAiResponse).toBe(true);
  });

  it("접수되면 토스트 없이 응답 대기 표시를 둔다(이어 진행은 폴링이 반영한다)", async () => {
    const result = renderCommands();
    act(() => {
      result.current.submitForm({ name: "John" });
    });
    await flushRest();

    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(useExecutionStore.getState().isWaitingAiResponse).toBe(true);
  });

  it("422 INVALID_STATE 면 입력 대기가 아니라는 문구를 띄우고 응답 대기를 끈다", async () => {
    continueExecutionMock.mockRejectedValue(
      restError(422, {
        error: { code: "INVALID_STATE", message: "not waiting for input" },
      }),
    );
    const result = renderCommands();
    act(() => {
      result.current.submitForm({ name: "John" });
    });
    await flushRest();

    expect(toastErrorMock).toHaveBeenCalledWith(
      "executions.interactionError.invalidState",
    );
    expect(useExecutionStore.getState().isWaitingAiResponse).toBe(false);
  });

  it("400 VALIDATION_ERROR 면 서버가 준 필드 검증 문구를 띄운다", async () => {
    continueExecutionMock.mockRejectedValue(
      restError(400, {
        error: {
          code: "VALIDATION_ERROR",
          message: "이메일 형식이 아니에요.",
          details: [{ field: "email", message: "이메일 형식이 아니에요.", code: "INVALID_FIELD" }],
        },
      }),
    );
    const result = renderCommands();
    act(() => {
      result.current.submitForm({ email: "x" });
    });
    await flushRest();

    expect(toastErrorMock).toHaveBeenCalledWith("이메일 형식이 아니에요.");
    expect(useExecutionStore.getState().isWaitingAiResponse).toBe(false);
  });

  it.each([
    ["빈 문자열", { code: "VALIDATION_ERROR", message: "" }],
    ["공백만", { code: "VALIDATION_ERROR", message: "   " }],
    ["message 없음", { code: "VALIDATION_ERROR" }],
    ["문자열이 아닌 message", { code: "VALIDATION_ERROR", message: 42 }],
  ])(
    "400 VALIDATION_ERROR 의 검증 문구가 비었으면(%s) 일반 실패 문구를 띄운다",
    async (_name, error) => {
      continueExecutionMock.mockRejectedValue(restError(400, { error }));
      const result = renderCommands();
      act(() => {
        result.current.submitForm({ email: "x" });
      });
      await flushRest();

      expect(toastErrorMock).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).toHaveBeenCalledWith(
        "executions.interactionError.internalError",
      );
      expect(useExecutionStore.getState().isWaitingAiResponse).toBe(false);
    },
  );

  it("그 밖의 실패(네트워크 · 5xx)는 일반 실패 문구를 띄운다", async () => {
    continueExecutionMock.mockRejectedValue(
      new AxiosError("Network Error", "ERR_NETWORK"),
    );
    const result = renderCommands();
    act(() => {
      result.current.submitForm({ name: "John" });
    });
    await flushRest();

    expect(toastErrorMock).toHaveBeenCalledWith(
      "executions.interactionError.internalError",
    );
    expect(useExecutionStore.getState().isWaitingAiResponse).toBe(false);
  });

  it("실패 응답 전에 store 가 다른 실행으로 바뀌었으면 그 실행의 응답 대기 표시는 건드리지 않는다", async () => {
    let rejectRest: (err: unknown) => void = () => {};
    continueExecutionMock.mockReturnValue(
      new Promise((_, reject) => {
        rejectRest = reject;
      }),
    );
    const result = renderCommands();
    act(() => {
      result.current.submitForm({ name: "John" });
    });
    act(() => {
      useExecutionStore.setState({
        executionId: "exec-2",
        isWaitingAiResponse: true,
      });
    });
    rejectRest(restError(422, { error: { code: "INVALID_STATE" } }));
    await flushRest();

    expect(useExecutionStore.getState().isWaitingAiResponse).toBe(true);
  });

  describe("응답 대기 표시는 제출한 입력 대기가 그대로일 때만 끈다", () => {
    /** 실패 응답을 테스트가 정한 시점에 돌려주게 한다. */
    function deferRestFailure(): (err: unknown) => void {
      let rejectRest: (err: unknown) => void = () => {};
      continueExecutionMock.mockReturnValue(
        new Promise((_, reject) => {
          rejectRest = reject;
        }),
      );
      return (err) => rejectRest(err);
    }

    beforeEach(() => {
      useExecutionStore.setState({ waitingNodeId: "node-form-1" });
    });

    it("실패 시점에도 같은 노드를 기다리고 있으면 응답 대기 표시를 끈다", async () => {
      const rejectRest = deferRestFailure();
      const result = renderCommands();
      act(() => {
        result.current.submitForm({ name: "John" });
      });
      expect(useExecutionStore.getState().isWaitingAiResponse).toBe(true);

      rejectRest(restError(422, { error: { code: "INVALID_STATE" } }));
      await flushRest();

      expect(useExecutionStore.getState().isWaitingAiResponse).toBe(false);
      expect(toastErrorMock).toHaveBeenCalledWith(
        "executions.interactionError.invalidState",
      );
    });

    it("그사이 같은 실행이 다음 입력 대기로 넘어가 표시가 다시 켜졌으면 그대로 둔다", async () => {
      const rejectRest = deferRestFailure();
      const result = renderCommands();
      act(() => {
        result.current.submitForm({ name: "John" });
      });
      // 폴링 응답이 다음 입력 대기(다른 노드)를 넣고 응답 대기 표시가 다시 켜진 상태.
      act(() => {
        useExecutionStore.setState({
          waitingNodeId: "node-form-2",
          isWaitingAiResponse: true,
        });
      });

      rejectRest(restError(422, { error: { code: "INVALID_STATE" } }));
      await flushRest();

      expect(useExecutionStore.getState().executionId).toBe(EXECUTION_ID);
      expect(useExecutionStore.getState().isWaitingAiResponse).toBe(true);
      // 실패 자체는 알린다.
      expect(toastErrorMock).toHaveBeenCalledWith(
        "executions.interactionError.invalidState",
      );
    });
  });
});

describe("연결이 끊겼을 때 버튼 · 대화 · 재시도는 보내지 않고 안내한다", () => {
  it("clickButton", () => {
    const result = renderCommands();
    let sent: boolean | undefined;
    act(() => {
      sent = result.current.clickButton("btn-1");
    });

    expect(sent).toBe(false);
    expect(emitMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith(
      "executions.realtimeRequiredForInput",
    );
  });

  it("clickContinue", () => {
    const result = renderCommands();
    let sent: boolean | undefined;
    act(() => {
      sent = result.current.clickContinue();
    });

    expect(sent).toBe(false);
    expect(emitMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith(
      "executions.realtimeRequiredForInput",
    );
  });

  it("sendMessage 는 보낸 메시지 항목도 응답 대기 표시도 남기지 않는다", () => {
    const result = renderCommands();
    let sent: boolean | undefined;
    act(() => {
      sent = result.current.sendMessage("node-ai", "안녕하세요");
    });

    expect(sent).toBe(false);
    expect(emitMock).not.toHaveBeenCalled();
    const state = useExecutionStore.getState();
    expect(state.conversationMessages).toHaveLength(0);
    expect(state.isWaitingAiResponse).toBe(false);
    expect(toastErrorMock).toHaveBeenCalledWith(
      "executions.realtimeRequiredForInput",
    );
  });

  it("endConversation", () => {
    const result = renderCommands();
    let sent: boolean | undefined;
    act(() => {
      sent = result.current.endConversation("node-ai");
    });

    expect(sent).toBe(false);
    expect(emitMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith(
      "executions.realtimeRequiredForInput",
    );
  });

  it("retryLastTurn 은 응답 대기 표시를 켜지 않는다", () => {
    const result = renderCommands();
    let sent: boolean | undefined;
    act(() => {
      sent = result.current.retryLastTurn("ne-1");
    });

    expect(sent).toBe(false);
    expect(emitMock).not.toHaveBeenCalled();
    expect(useExecutionStore.getState().isWaitingAiResponse).toBe(false);
    expect(toastErrorMock).toHaveBeenCalledWith(
      "executions.realtimeRequiredForInput",
    );
  });
});

describe("연결돼 있으면 지금처럼 WS 명령을 보낸다", () => {
  beforeEach(() => {
    isConnectedMock.mockReturnValue(true);
  });

  it("submitForm 은 REST 를 부르지 않고 execution.submit_form 을 보낸다", () => {
    const result = renderCommands();
    let sent: boolean | undefined;
    act(() => {
      sent = result.current.submitForm({ name: "John" });
    });

    expect(sent).toBe(true);
    expect(continueExecutionMock).not.toHaveBeenCalled();
    expect(emitMock).toHaveBeenCalledWith("execution.submit_form", {
      executionId: EXECUTION_ID,
      formData: { name: "John" },
    });
  });

  it("버튼 · 대화 · 재시도 명령은 보냈으면 true 를 돌려준다", () => {
    const result = renderCommands();
    const sent: boolean[] = [];
    act(() => {
      sent.push(result.current.clickButton("btn-1"));
      sent.push(result.current.clickContinue());
      sent.push(result.current.sendMessage("node-ai", "안녕하세요"));
      sent.push(result.current.endConversation("node-ai"));
      sent.push(result.current.retryLastTurn("ne-1"));
    });

    expect(sent).toEqual([true, true, true, true, true]);
    expect(emitMock).toHaveBeenCalledTimes(5);
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});

describe("실행 ID 가 없으면", () => {
  it.each([
    ["연결돼 있어도", true],
    ["연결이 끊겨 있어도", false],
  ])("%s 어떤 명령도 보내지 않고 조용히 false 를 돌려준다", (_name, connected) => {
    isConnectedMock.mockReturnValue(connected);
    const result = renderCommands(null);
    const sent: boolean[] = [];
    act(() => {
      sent.push(result.current.submitForm({}));
      sent.push(result.current.clickButton("btn-1"));
      sent.push(result.current.clickContinue());
      sent.push(result.current.sendMessage("node-ai", "hi"));
      sent.push(result.current.endConversation("node-ai"));
      sent.push(result.current.retryLastTurn("ne-1"));
    });

    expect(sent).toEqual([false, false, false, false, false, false]);
    expect(emitMock).not.toHaveBeenCalled();
    expect(continueExecutionMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
