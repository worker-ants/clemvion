import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const routerPushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastErrorMock(...args) },
}));

import { ReRunModal } from "../rerun-modal";
import type { ReRunModalProps } from "../rerun-modal";

// definition stub helper — supportsDryRun / category 만 의미가 있다.
function def(
  type: string,
  category: string,
  supportsDryRun?: boolean,
): Record<string, unknown> {
  return {
    type,
    category,
    label: type,
    description: "",
    icon: "",
    color: "",
    inputs: [],
    outputs: [],
    supportsDryRun,
    defaultConfig: {},
    configSchema: {},
  };
}

function seedDefinitions(defs: Record<string, unknown>[]) {
  const definitions: Record<string, unknown> = {};
  const order: string[] = [];
  for (const d of defs) {
    definitions[d.type as string] = d;
    order.push(d.type as string);
  }
  useNodeDefinitionsStore.setState({
    status: "ready",
    error: null,
    definitions: definitions as never,
    order,
    categories: [],
    // load 는 ready 면 즉시 resolve.
    load: () => Promise.resolve(),
  });
}

function renderModal(override?: Partial<ReRunModalProps>) {
  const props: ReRunModalProps = {
    original: {
      id: "exec-1",
      workflowId: "wf-1",
      status: "completed",
      startedAt: "2026-05-22T14:32:00.000Z",
      inputData: { parameters: { name: "Alice", count: 3 } },
    },
    open: true,
    onClose: vi.fn(),
    ...override,
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ReRunModal {...props} />
    </QueryClientProvider>,
  );
  return props;
}

describe("ReRunModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
    routerPushMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("원본 실행 정보(id/status)와 타이틀을 렌더한다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    seedDefinitions([]);
    renderModal();
    expect(
      screen.getByText(/Re-run Execution/),
    ).toBeInTheDocument();
    expect(screen.getByText("exec-1")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  it("external-call 노드 수를 supportsDryRun=true 노드로 카운트한다", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        data: [
          { id: "n1", type: "http-request", category: "integration" },
          { id: "n2", type: "send-email", category: "integration" },
          { id: "n3", type: "set", category: "logic" },
        ],
      },
    });
    seedDefinitions([
      def("http-request", "integration", true),
      def("send-email", "integration", true),
      def("set", "logic", false),
    ]);
    renderModal();
    expect(
      await screen.findByText(/includes 2 external-call node/),
    ).toBeInTheDocument();
  });

  it("dry-run 미지원 integration 노드가 있으면 dry-run toggle 이 disabled 된다", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        data: [{ id: "n1", type: "weird-integration", category: "integration" }],
      },
    });
    seedDefinitions([def("weird-integration", "integration", undefined)]);
    renderModal();
    await waitFor(() => {
      const toggle = screen
        .getByText(/Dry-run mode/)
        .closest("label")
        ?.querySelector("input[type=checkbox]") as HTMLInputElement;
      expect(toggle).toBeDisabled();
    });
  });

  it("모든 노드가 dry-run 지원이면 dry-run toggle 이 활성화된다", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        data: [{ id: "n1", type: "http-request", category: "integration" }],
      },
    });
    seedDefinitions([def("http-request", "integration", true)]);
    renderModal();
    await waitFor(() => {
      const toggle = screen
        .getByText(/Dry-run mode/)
        .closest("label")
        ?.querySelector("input[type=checkbox]") as HTMLInputElement;
      expect(toggle).not.toBeDisabled();
    });
  });

  it("Use original input 토글 ON 시 입력 폼이 read-only(disabled) 된다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    seedDefinitions([]);
    renderModal();
    const nameInput = screen.getByLabelText("name") as HTMLInputElement;
    expect(nameInput).not.toBeDisabled();
    const toggle = screen.getByText("Use original input").closest("label")!
      .querySelector("input")!;
    fireEvent.click(toggle);
    expect((screen.getByLabelText("name") as HTMLInputElement)).toBeDisabled();
  });

  it("Re-run 버튼 → reRun API 호출 후 새 실행 상세로 라우팅", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    apiPostMock.mockResolvedValue({ data: { data: { id: "exec-new" } } });
    seedDefinitions([]);
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "Re-run" }));
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        "/executions/exec-1/re-run",
        expect.objectContaining({ dryRun: false }),
      );
    });
    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith(
        "/workflows/wf-1/executions/exec-new",
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("기본(default) 입력 편집 모드에서 inputOverride 를 함께 전송한다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    apiPostMock.mockResolvedValue({ data: { data: { id: "exec-new" } } });
    seedDefinitions([]);
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Re-run" }));
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        "/executions/exec-1/re-run",
        expect.objectContaining({
          useOriginalInput: false,
          inputOverride: { name: "Alice", count: 3 },
        }),
      );
    });
  });

  it("RERUN_PERMISSION_DENIED 에러를 i18n 메시지 toast 로 노출한다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    apiPostMock.mockRejectedValue({
      response: { data: { code: "RERUN_PERMISSION_DENIED" } },
    });
    seedDefinitions([]);
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Re-run" }));
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringContaining("RR-PL-06"),
      );
    });
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("RERUN_CHAIN_DEPTH_EXCEEDED 에러를 limit toast 로 노출한다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    apiPostMock.mockRejectedValue({
      response: { data: { code: "RERUN_CHAIN_DEPTH_EXCEEDED" } },
    });
    seedDefinitions([]);
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Re-run" }));
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringContaining("32"),
      );
    });
  });

  it("Cancel 버튼 → onClose 호출, API 미호출", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    seedDefinitions([]);
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("onSuccess 콜백이 있으면 router 대신 콜백을 호출한다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    apiPostMock.mockResolvedValue({ data: { data: { id: "exec-cb" } } });
    seedDefinitions([]);
    const onSuccess = vi.fn();
    renderModal({ onSuccess });
    fireEvent.click(screen.getByRole("button", { name: "Re-run" }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("exec-cb");
    });
    expect(routerPushMock).not.toHaveBeenCalled();
  });
});
