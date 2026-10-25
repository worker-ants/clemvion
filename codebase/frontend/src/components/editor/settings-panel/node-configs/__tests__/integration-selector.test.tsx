import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const listMock = vi.fn();

vi.mock("@/lib/api/integrations", () => ({
  integrationsApi: {
    list: (...args: unknown[]) => listMock(...args),
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { IntegrationSelector } from "../integration-selector";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useEditorStore } from "@/lib/stores/editor-store";

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

async function waitForOptions(count: number) {
  await waitFor(() =>
    expect(screen.getAllByRole("option").length).toBeGreaterThanOrEqual(count),
  );
}

async function waitForText(matcher: RegExp) {
  await waitFor(() => expect(screen.getByText(matcher)).toBeDefined());
}

describe("IntegrationSelector", () => {
  beforeEach(() => {
    listMock.mockReset();
    useLocaleStore.setState({ locale: "en" });
  });

  it("lists integrations matching the serviceTypes filter", async () => {
    listMock.mockResolvedValue({
      data: [
        {
          id: "int-1",
          name: "Company Gmail",
          authType: "smtp",
          status: "connected",
        },
        {
          id: "int-2",
          name: "Marketing Email",
          authType: "smtp",
          status: "expired",
        },
      ],
      pagination: { page: 1, limit: 100, totalItems: 2, totalPages: 1 },
    });

    render(
      wrap(
        <IntegrationSelector
          value=""
          onChange={() => {}}
          serviceTypes={["email"]}
          serviceDisplayName="Email"
        />,
      ),
    );
    await waitForOptions(3); // placeholder + 2 integrations

    expect(listMock).toHaveBeenCalledWith({
      serviceType: ["email"],
      limit: 100,
    });

    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    const labels = options.map((o) => o.textContent);
    expect(labels).toContain("Company Gmail (smtp)");
    // Expired integrations get a "needs attention" hint
    expect(labels).toContain("Marketing Email (smtp) — needs attention");
  });

  it("renders a Create CTA when there are zero integrations", async () => {
    listMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 100, totalItems: 0, totalPages: 0 },
    });

    render(
      wrap(
        <IntegrationSelector
          value=""
          onChange={() => {}}
          serviceTypes={["http"]}
          serviceDisplayName="HTTP"
        />,
      ),
    );
    await waitForText(/\+ Create HTTP integration/);

    const cta = screen.getByText("+ Create HTTP integration");
    expect(cta).toBeDefined();
    expect(cta.getAttribute("href")).toBe(
      "/integrations/new?service=http&step=auth",
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it("preserves a stale saved value with a (missing) fallback option", async () => {
    listMock.mockResolvedValue({
      data: [
        {
          id: "int-1",
          name: "New One",
          authType: "smtp",
          status: "connected",
        },
      ],
      pagination: { page: 1, limit: 100, totalItems: 1, totalPages: 1 },
    });

    render(
      wrap(
        <IntegrationSelector
          value="deleted-uuid-xxxx"
          onChange={() => {}}
          serviceTypes={["email"]}
        />,
      ),
    );
    await waitForText(/\(missing\)\s*$/);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("deleted-uuid-xxxx");
  });

  it("emits the selected id via onChange", async () => {
    listMock.mockResolvedValue({
      data: [
        {
          id: "int-1",
          name: "Primary",
          authType: "smtp",
          status: "connected",
        },
      ],
      pagination: { page: 1, limit: 100, totalItems: 1, totalPages: 1 },
    });
    const onChange = vi.fn();

    render(
      wrap(
        <IntegrationSelector
          value=""
          onChange={onChange}
          serviceTypes={["email"]}
        />,
      ),
    );
    await waitForOptions(2);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "int-1" },
    });
    expect(onChange).toHaveBeenCalledWith("int-1");
  });
});

describe("IntegrationSelector — workflow author rule (REQ-INTMGMT-056)", () => {
  const LIST = {
    data: [
      { id: "org-1", name: "Team SMTP", authType: "smtp", status: "connected", scope: "organization", createdBy: "bob" },
      { id: "mine-1", name: "My SMTP", authType: "smtp", status: "connected", scope: "personal", createdBy: "alice" },
    ],
    pagination: { page: 1, limit: 100, totalItems: 2, totalPages: 1 },
  };
  const HINT = /you didn't create this workflow/i;

  beforeEach(() => {
    listMock.mockReset();
    listMock.mockResolvedValue(LIST);
    useLocaleStore.setState({ locale: "en" });
    useAuthStore.setState({ user: { id: "alice" } as never });
  });

  async function renderOptions() {
    render(
      wrap(
        <IntegrationSelector
          value=""
          onChange={() => {}}
          serviceTypes={["email"]}
        />,
      ),
    );
    await waitForOptions(3);
    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    return (id: string) => options.find((o) => o.value === id)!;
  }

  it("disables the user's own personal integrations with the reason when they are not the workflow author", async () => {
    useEditorStore.setState({ workflowCreatedBy: "bob" });
    const option = await renderOptions();

    expect(option("mine-1").disabled).toBe(true);
    expect(option("mine-1").textContent).toBe(
      "My SMTP (smtp) — can't be used in this workflow",
    );
    expect(option("org-1").disabled).toBe(false);
    expect(screen.getByText(HINT)).toBeDefined();
  });

  it("keeps personal integrations selectable for the workflow author", async () => {
    useEditorStore.setState({ workflowCreatedBy: "alice" });
    const option = await renderOptions();

    expect(option("mine-1").disabled).toBe(false);
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it("does not filter while the workflow author is unknown", async () => {
    useEditorStore.setState({ workflowCreatedBy: null });
    const option = await renderOptions();

    expect(option("mine-1").disabled).toBe(false);
  });
});
