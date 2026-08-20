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
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

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
  useParams: () => ({}),
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
    // slug 는 store 파생 — 케이스 간 누수 방지(기본 slug null → bare path).
    useWorkspaceStore.getState().reset();
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
    // spec §10.2 — node type 별 breakdown ("<label> × <n>") 도 함께 노출.
    expect(
      await screen.findByText(/http-request × 1, send-email × 1/),
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

  it("re-run 성공 후 활성 워크스페이스가 있으면 slug 경로로 라우팅한다", async () => {
    useWorkspaceStore.setState({
      workspaces: [
        { id: "ws", name: "W", type: "personal", slug: "team-x", role: "owner" },
      ],
      currentWorkspaceId: "ws",
      loaded: true,
    });
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    apiPostMock.mockResolvedValue({ data: { data: { id: "exec-new" } } });
    seedDefinitions([]);
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Re-run" }));
    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith(
        "/w/team-x/workflows/wf-1/executions/exec-new",
      );
    });
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

  it("원본 실행 ID 를 새 탭 링크로 렌더한다 (spec §10.2)", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    seedDefinitions([]);
    renderModal();
    const link = screen.getByText("exec-1").closest("a") as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe(
      "/workflows/wf-1/executions/exec-1",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("manual_trigger config.parameters 스키마 기반 typed 폼을 렌더한다 (number→number, boolean→checkbox)", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        data: [
          {
            id: "mt",
            type: "manual_trigger",
            category: "trigger",
            config: {
              parameters: [
                { name: "count", type: "number" },
                { name: "flag", type: "boolean" },
              ],
            },
          },
        ],
      },
    });
    seedDefinitions([def("manual_trigger", "trigger", false)]);
    renderModal({
      original: {
        id: "exec-1",
        workflowId: "wf-1",
        status: "completed",
        startedAt: "2026-05-22T14:32:00.000Z",
        inputData: { parameters: { count: 3, flag: true } },
      },
    });
    // 스키마 로딩(async) 후 typed 위젯으로 전환될 때까지 대기.
    await waitFor(() => {
      const count = screen.getByLabelText("count") as HTMLInputElement;
      expect(count.type).toBe("number");
    });
    expect((screen.getByLabelText("count") as HTMLInputElement).value).toBe("3");
    const flag = screen.getByLabelText("flag") as HTMLInputElement;
    expect(flag.type).toBe("checkbox");
    expect(flag.checked).toBe(true);
  });

  it("boolean 필드 토글 후 inputOverride 로 native boolean 을 전송한다", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        data: [
          {
            id: "mt",
            type: "manual_trigger",
            category: "trigger",
            config: { parameters: [{ name: "flag", type: "boolean" }] },
          },
        ],
      },
    });
    apiPostMock.mockResolvedValue({ data: { data: { id: "exec-new" } } });
    seedDefinitions([def("manual_trigger", "trigger", false)]);
    renderModal({
      original: {
        id: "exec-1",
        workflowId: "wf-1",
        status: "completed",
        startedAt: "2026-05-22T14:32:00.000Z",
        inputData: { parameters: { flag: false } },
      },
    });
    let flag!: HTMLInputElement;
    await waitFor(() => {
      flag = screen.getByLabelText("flag") as HTMLInputElement;
      expect(flag.type).toBe("checkbox");
    });
    fireEvent.click(flag); // false → true
    fireEvent.click(screen.getByRole("button", { name: "Re-run" }));
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        "/executions/exec-1/re-run",
        expect.objectContaining({ inputOverride: { flag: true } }),
      );
    });
  });

  it("object 필드는 JSON 으로 표시하고 편집 시 파싱해 native 값으로 전송한다", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        data: [
          {
            id: "mt",
            type: "manual_trigger",
            category: "trigger",
            config: { parameters: [{ name: "meta", type: "object" }] },
          },
        ],
      },
    });
    apiPostMock.mockResolvedValue({ data: { data: { id: "exec-new" } } });
    seedDefinitions([def("manual_trigger", "trigger", false)]);
    renderModal({
      original: {
        id: "exec-1",
        workflowId: "wf-1",
        status: "completed",
        startedAt: "2026-05-22T14:32:00.000Z",
        inputData: { parameters: { meta: { a: 1 } } },
      },
    });
    let input!: HTMLInputElement;
    await waitFor(() => {
      input = screen.getByLabelText("meta") as HTMLInputElement;
      expect(input.value).toBe('{"a":1}'); // object → JSON 문자열 표시
    });
    fireEvent.change(input, { target: { value: '{"a":2}' } });
    fireEvent.click(screen.getByRole("button", { name: "Re-run" }));
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        "/executions/exec-1/re-run",
        expect.objectContaining({ inputOverride: { meta: { a: 2 } } }),
      );
    });
  });

  it("Use original input ON 시 typed 위젯(checkbox)도 disabled 된다", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        data: [
          {
            id: "mt",
            type: "manual_trigger",
            category: "trigger",
            config: { parameters: [{ name: "flag", type: "boolean" }] },
          },
        ],
      },
    });
    seedDefinitions([def("manual_trigger", "trigger", false)]);
    renderModal({
      original: {
        id: "exec-1",
        workflowId: "wf-1",
        status: "completed",
        startedAt: "2026-05-22T14:32:00.000Z",
        inputData: { parameters: { flag: true } },
      },
    });
    let flag!: HTMLInputElement;
    await waitFor(() => {
      flag = screen.getByLabelText("flag") as HTMLInputElement;
      expect(flag.type).toBe("checkbox");
    });
    expect(flag).not.toBeDisabled();
    fireEvent.click(
      screen
        .getByText("Use original input")
        .closest("label")!
        .querySelector("input")!,
    );
    expect(screen.getByLabelText("flag") as HTMLInputElement).toBeDisabled();
  });

  it("fallback 구간에 편집한 문자열이 스키마 도착 후 native 타입으로 재조정된다 (side_effect 회귀)", async () => {
    // 스키마(getNodes)를 지연 resolve 해 fallback(all-string) 구간을 재현.
    let resolveNodes!: (v: unknown) => void;
    apiGetMock.mockReturnValue(
      new Promise((r) => {
        resolveNodes = r as (v: unknown) => void;
      }),
    );
    apiPostMock.mockResolvedValue({ data: { data: { id: "exec-new" } } });
    seedDefinitions([def("manual_trigger", "trigger", false)]);
    renderModal({
      original: {
        id: "exec-1",
        workflowId: "wf-1",
        status: "completed",
        startedAt: "2026-05-22T14:32:00.000Z",
        inputData: { parameters: { flag: false } },
      },
    });
    // 스키마 로드 전: flag 는 text fallback. raw 문자열로 편집.
    const textFlag = screen.getByLabelText("flag") as HTMLInputElement;
    expect(textFlag.type).toBe("text");
    fireEvent.change(textFlag, { target: { value: "true" } });

    // 스키마 도착 → boolean checkbox 로 전환 + paramValues 재조정.
    resolveNodes({
      data: {
        data: [
          {
            id: "mt",
            type: "manual_trigger",
            category: "trigger",
            config: { parameters: [{ name: "flag", type: "boolean" }] },
          },
        ],
      },
    });
    let checkbox!: HTMLInputElement;
    await waitFor(() => {
      checkbox = screen.getByLabelText("flag") as HTMLInputElement;
      expect(checkbox.type).toBe("checkbox");
    });
    // "true" 문자열이 native boolean true 로 재조정 → checkbox checked + 제출.
    expect(checkbox.checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Re-run" }));
    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        "/executions/exec-1/re-run",
        expect.objectContaining({ inputOverride: { flag: true } }),
      );
    });
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

/**
 * `Execution.inputData` 는 egress 마스킹된다(EIA §R17, 2026-08-20 카브아웃 폐지). 이 모달은
 * 그 값을 **프리필해 `inputOverride` 로 되보내므로**, 마커가 그대로 실리면 리터럴 `'***'` 가
 * 새 실행의 실제 입력이 된다.
 *
 * **양방향을 고정한다**: 마커는 프리필하지 않고 제출을 막되, 마커가 아닌 값은 손대지 않는다.
 * 한쪽만 단언하면 "전부 비우고 전부 막는" 구현으로도 초록이 된다.
 */
describe("ReRunModal — 마스킹 마커 왕복 차단", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    useLocaleStore.setState({ locale: "en" });
    useWorkspaceStore.getState().reset();
    routerPushMock.mockReset();
    toastErrorMock.mockReset();
  });

  const maskedProps = {
    original: {
      id: "exec-m",
      workflowId: "wf-1",
      status: "completed",
      startedAt: "2026-05-22T14:32:00.000Z",
      inputData: { parameters: { apiKey: "***", name: "Alice" } },
    },
  } as Partial<ReRunModalProps>;

  it("마커 필드는 프리필하지 않고, 마커가 아닌 값은 그대로 둔다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    seedDefinitions([]);
    renderModal(maskedProps);

    const apiKey = screen.getByLabelText(/apiKey/i) as HTMLInputElement;
    const name = screen.getByLabelText(/name/i) as HTMLInputElement;
    expect(apiKey.value).toBe("");
    expect(name.value).toBe("Alice");
  });

  it("손대지 않은 마스킹 키가 남아 있으면 제출을 막는다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    seedDefinitions([]);
    renderModal(maskedProps);

    const submit = screen.getByRole("button", { name: "Re-run" });
    expect(submit).toBeDisabled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("그 필드를 채우면 제출이 풀린다 — 안내가 아니라 강제임을 고정", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    seedDefinitions([]);
    renderModal(maskedProps);

    fireEvent.change(screen.getByLabelText(/apiKey/i), {
      target: { value: "real-key" },
    });
    expect(screen.getByRole("button", { name: "Re-run" })).toBeEnabled();
  });

  /**
   * `useOriginalInput` 은 서버가 원본 엔티티를 **직접** 읽는 경로라 마스킹과 무관하게
   * 원문으로 재실행된다 — 오히려 이 경로가 정답이므로 막으면 안 된다. 이 캐너리가 없으면
   * 누가 차단 조건을 토글과 무관하게 넓혔을 때 정상 경로가 조용히 막힌다.
   */
  it("[캐너리] `원본 입력 그대로 사용` 을 켜면 차단이 풀린다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    seedDefinitions([]);
    renderModal(maskedProps);

    expect(screen.getByRole("button", { name: "Re-run" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Use original input/i));
    expect(screen.getByRole("button", { name: "Re-run" })).toBeEnabled();
  });

  /**
   * **object/array 파라미터 안쪽의 마커** — `isMaskedMarker`(정확 일치)만 쓰면 이 경로가
   * 통째로 뚫린다. 실제로 첫 구현이 그랬고 리뷰가 CRITICAL 로 잡았다(`14_08_45` C1):
   * `hasMaskedMarkerLeaf` 를 만들어 두고 툴바에만 썼다.
   *
   * 값은 **비우지 않는다** — JSON 텍스트로 렌더되므로 통째로 지우면 어느 키가 가려졌는지가
   * 사라진다. 보여 주고 제출만 막는다(히스토리 로드와 같은 처방).
   */
  it("object 파라미터 **안쪽** 마커도 제출을 막고, 값은 지우지 않는다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    seedDefinitions([]);
    renderModal({
      original: {
        id: "exec-n",
        workflowId: "wf-1",
        status: "completed",
        startedAt: "2026-05-22T14:32:00.000Z",
        inputData: { parameters: { headers: { apiKey: "***" } } },
      },
    } as Partial<ReRunModalProps>);

    expect(screen.getByRole("button", { name: "Re-run" })).toBeDisabled();
    // 값을 **비우지 않는다** — 스키마 없이 렌더되면 fallback 이 `String(value)` 로 찍어
    // `[object Object]` 가 되는데(기존 동작), 중요한 건 빈 문자열이 아니라는 점이다.
    const field = screen.getByLabelText(/headers/i) as HTMLInputElement;
    expect(field.value).not.toBe("");
  });

  /**
   * **건드린 뒤 값이 다시 마커여도 막는다** (`14_44_08` W2). 터치 기반 판정만 쓰면 한 번
   * 건드린 키가 영구 해제돼, 최종 값이 마커여도 그대로 전송된다 — 이 PR 이 막으려던 그
   * 오염이다. 판정은 "건드렸다 **그리고** 현재 값에 마커가 없다" 여야 한다.
   */
  it("[캐너리] 건드린 뒤 값이 다시 마커면 계속 막는다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    seedDefinitions([]);
    renderModal(maskedProps);

    const apiKey = screen.getByLabelText(/apiKey/i);
    fireEvent.change(apiKey, { target: { value: "real-key" } });
    expect(screen.getByRole("button", { name: "Re-run" })).toBeEnabled();

    // 다시 마커로 되돌리면 — 터치 기록은 남아 있지만 값이 위험하다.
    fireEvent.change(apiKey, { target: { value: "***" } });
    expect(screen.getByRole("button", { name: "Re-run" })).toBeDisabled();
  });

  it("object 필드도 마커를 지우면 풀린다 (언블록 경로)", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    seedDefinitions([]);
    renderModal({
      original: {
        id: "exec-n2",
        workflowId: "wf-1",
        status: "completed",
        startedAt: "2026-05-22T14:32:00.000Z",
        inputData: { parameters: { headers: { apiKey: "***" } } },
      },
    } as Partial<ReRunModalProps>);

    expect(screen.getByRole("button", { name: "Re-run" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/headers/i), {
      target: { value: '{"apiKey":"real"}' },
    });
    expect(screen.getByRole("button", { name: "Re-run" })).toBeEnabled();
  });

  /**
   * 마스킹 키가 **둘 이상**인 경우. 하나만 채워도 나머지가 남으면 계속 막혀야 한다 —
   * `some` 을 `every` 로 바꾸는 뮤테이션을 이 케이스만 잡는다 (`14_44_08` INFO-9).
   */
  it("[캐너리] 마스킹 키가 둘이면 하나만 채워도 계속 막힌다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    seedDefinitions([]);
    renderModal({
      original: {
        id: "exec-2m",
        workflowId: "wf-1",
        status: "completed",
        startedAt: "2026-05-22T14:32:00.000Z",
        inputData: { parameters: { apiKey: "***", token: "[REDACTED]" } },
      },
    } as Partial<ReRunModalProps>);

    fireEvent.change(screen.getByLabelText(/apiKey/i), {
      target: { value: "real" },
    });
    expect(screen.getByRole("button", { name: "Re-run" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/token/i), {
      target: { value: "real2" },
    });
    expect(screen.getByRole("button", { name: "Re-run" })).toBeEnabled();
  });

  /**
   * **무효 JSON 으로 만들어도 풀리지 않는다** (`15_32_34` W1, 리뷰어가 재현).
   *
   * `coerceInput` 은 `JSON.parse` 실패 시 **raw 문자열로 폴백**하고, 그 문자열은
   * `hasMaskedMarkerLeaf` 의 정확 일치에 걸리지 않는다 — 마커를 남긴 채 JSON 만 깨뜨리면
   * 차단이 조용히 풀렸다. backend 가 `coerce_failed` 로 거부해 실제 오염까지 가지는
   * 않지만, 사용자는 "마커를 채우라" 대신 일반 오류 토스트를 본다.
   */
  it("[캐너리] object 필드를 무효 JSON 으로 만들어도 계속 막는다", async () => {
    // **스키마를 태워야 재현된다** — object 타입으로 선언돼야 `coerceInput` 이 파싱을 시도하고,
    // 실패 시 raw 문자열로 폴백한다. 스키마가 없으면 그냥 string 필드라 이 경로가 없다.
    apiGetMock.mockResolvedValue({
      data: {
        data: [
          {
            id: "mt",
            type: "manual_trigger",
            category: "trigger",
            config: { parameters: [{ name: "headers", type: "object" }] },
          },
        ],
      },
    });
    seedDefinitions([def("manual_trigger", "trigger", false)]);
    renderModal({
      original: {
        id: "exec-bad",
        workflowId: "wf-1",
        status: "completed",
        startedAt: "2026-05-22T14:32:00.000Z",
        inputData: { parameters: { headers: { apiKey: "***" } } },
      },
    } as Partial<ReRunModalProps>);

    // 스키마가 비동기로 도착해야 `headers` 가 object 타입이 된다 — 그전엔 string 필드라
    // 이 경로 자체가 없다.
    const field = await screen.findByLabelText(/headers/i);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Re-run" })).toBeDisabled(),
    );

    // 유효 JSON 으로 고쳐 한 번 풀고 —
    fireEvent.change(field, { target: { value: '{"apiKey":"real"}' } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Re-run" })).toBeEnabled(),
    );

    // 마커를 되살린 채 JSON 을 깨뜨린다 → coerce 실패로 raw 문자열이 된다.
    fireEvent.change(field, { target: { value: '{"apiKey":"***"' } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Re-run" })).toBeDisabled(),
    );
  });

  /**
   * **원 버그 형태 그대로의 캐너리** (`16_25_35` testing INFO-6).
   *
   * 최초 판정은 *"값이 비었는가"* 단독이었다. 스키마가 **늦게** 도착하면 재조정이
   * `coerceInput("boolean", "")` -> `false` 를 만들고, `false` 는 "빈 값" 이 아니므로
   * 차단이 조용히 풀렸다(`14_08_45` W2). 지금은 터치 조건이 붙어 막히지만, 그걸
   * **행사하는 테스트가 없어** 누가 판정을 값-단독으로 되돌려도 GREEN 이었다.
   *
   * **관측점**: boolean 은 스키마가 도착해야 checkbox 로 렌더된다. 그 전환을 기다리는
   * 것이 곧 *"재조정이 실제로 돌았다"* 의 증거다 - 안 기다리면 "스키마가 아직 안 와서"
   * 막힌 상태를 검증하는 vacuous 테스트가 된다.
   */
  it("[캐너리] 마스킹된 boolean 은 지연 스키마 도착 후에도 계속 막힌다", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        data: [
          {
            id: "mt",
            type: "manual_trigger",
            category: "trigger",
            config: { parameters: [{ name: "flag", type: "boolean" }] },
          },
        ],
      },
    });
    seedDefinitions([def("manual_trigger", "trigger", false)]);
    renderModal({
      original: {
        id: "exec-bool",
        workflowId: "wf-1",
        status: "completed",
        startedAt: "2026-05-22T14:32:00.000Z",
        inputData: { parameters: { flag: "***" } },
      },
    } as Partial<ReRunModalProps>);

    // 스키마 도착 = boolean 으로 렌더 **전환** = `coerceInput("boolean","")` 재조정이 돌았다.
    // 라벨은 스키마 전에도 있으므로(그땐 string 필드) `findByLabelText` 만으로는 이르다 —
    // 전환 자체를 기다려야 재조정 이후 상태를 본다.
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/flag/i) as HTMLInputElement).type,
      ).toBe("checkbox"),
    );
    const box = screen.getByLabelText(/flag/i) as HTMLInputElement;
    expect(box.checked).toBe(false); // 재조정 결과가 `false` - "빈 값" 이 아니다

    // 그럼에도 막혀 있어야 한다. 판정을 값-단독으로 되돌리면 여기가 RED.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Re-run" })).toBeDisabled(),
    );

    // 사용자가 실제로 건드리면 풀린다 - 과잉 차단이 아님을 같은 테스트에서 고정.
    fireEvent.click(box);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Re-run" })).toBeEnabled(),
    );
  });

  /**
   * **모달을 닫았다 다시 열면 터치가 리셋된다** (`17_13_19` testing INFO-7).
   *
   * 차단 판정의 첫 조건이 *"사용자가 그 키를 건드렸는가"* 라, 그 기록이 재오픈 때 안
   * 지워지면 **한 번 채운 적이 있다는 이유로 다음 실행에서도 영구 해제**된다 — 원본은
   * 여전히 마커인데. 리셋은 `open` 을 보는 `useEffect` 한 줄이라 리팩터로 조용히
   * 떨어져 나가기 쉽다.
   *
   * `renderModal` 은 `rerender` 를 돌려주지 않으므로 여기서만 직접 렌더한다.
   */
  it("[캐너리] 닫았다 다시 열면 터치 기록이 리셋돼 다시 막힌다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    seedDefinitions([]);

    const props: ReRunModalProps = {
      original: {
        id: "exec-reopen",
        workflowId: "wf-1",
        status: "completed",
        startedAt: "2026-05-22T14:32:00.000Z",
        inputData: { parameters: { apiKey: "***", name: "Alice" } },
      },
      open: true,
      onClose: vi.fn(),
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const ui = (p: ReRunModalProps) => (
      <QueryClientProvider client={client}>
        <ReRunModal {...p} />
      </QueryClientProvider>
    );
    const { rerender } = render(ui(props));

    // 채우면 풀린다.
    fireEvent.change(screen.getByLabelText(/apiKey/i), {
      target: { value: "real-key" },
    });
    expect(screen.getByRole("button", { name: "Re-run" })).toBeEnabled();

    // 닫았다 다시 연다 — 원본은 그대로 마커다.
    rerender(ui({ ...props, open: false }));
    rerender(ui({ ...props, open: true }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Re-run" })).toBeDisabled(),
    );
    expect((screen.getByLabelText(/apiKey/i) as HTMLInputElement).value).toBe(
      "",
    );
  });

  /**
   * **스키마 드리프트 교착** (`17_38_33` requirement W3).
   *
   * 스키마는 실행 이후에 바뀐다. 마스킹된 키가 현재 스키마에서 사라지면 그 키는 렌더되지
   * 않고 → `touchedKeys` 에 영영 못 들어가고 → 차단이 **영구**가 된다. 무수정 프로브로
   * 실증했다(교착 재현 GREEN). 유일한 탈출구가 "원본 그대로 사용" 토글인데, 그건 다른
   * 필드의 정상 편집까지 버리는 선택이라 §R17 의 "재입력해 언블록" 이 성립하지 않는다.
   *
   * 불변식으로 닫았다 — **차단의 근거가 되는 키는 반드시 렌더된다**.
   *
   * > **관측 시점이 가설의 일부였다.** 첫 프로브는 `findByLabelText(/name/i)` 로 기다렸는데
   * > 그 라벨은 **fallback 구간에도** 있어서 스키마 도착 전 상태를 쟀고, 그때는 `apiKey` 도
   * > 보이므로 "교착 없음" 으로 읽혔다. 스키마에만 있는 필드(`schemaOnly`)의 등장을
   * > 기다려야 스키마 착지 이후를 본다.
   */
  it("[회귀] 스키마에서 사라진 마스킹 키도 렌더돼 재입력으로 풀린다", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        data: [
          {
            id: "mt",
            type: "manual_trigger",
            category: "trigger",
            config: {
              parameters: [
                { name: "name", type: "string" },
                // 스키마에만 있는 필드 — 이게 보이면 스키마가 착지한 것이다.
                { name: "schemaOnly", type: "string" },
              ],
            },
          },
        ],
      },
    });
    seedDefinitions([def("manual_trigger", "trigger", false)]);
    renderModal({
      original: {
        id: "exec-drift",
        workflowId: "wf-1",
        status: "completed",
        startedAt: "2026-05-22T14:32:00.000Z",
        inputData: { parameters: { apiKey: "***", name: "Alice" } },
      },
    } as Partial<ReRunModalProps>);
    // 스키마 착지를 기다린다 — fallback 구간에는 apiKey 가 있으므로 그전에 재면 안 된다.
    await screen.findByLabelText(/schemaOnly/i);

    // 스키마에 없어도 **렌더된다** — 차단 근거가 되는 키이기 때문이다.
    const orphan = screen.getByLabelText(/apiKey/i) as HTMLInputElement;
    expect(orphan.value).toBe(""); // 마커는 프리필하지 않는다

    // 아직 안 건드렸으니 막혀 있다.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Re-run" })).toBeDisabled(),
    );

    // 채우면 풀린다 — 교착이 아니다.
    fireEvent.change(orphan, { target: { value: "real-key" } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Re-run" })).toBeEnabled(),
    );
  });

  it("[캐너리] 마커가 없으면 아무것도 막지 않는다", async () => {
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    seedDefinitions([]);
    renderModal();

    expect(screen.getByRole("button", { name: "Re-run" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
