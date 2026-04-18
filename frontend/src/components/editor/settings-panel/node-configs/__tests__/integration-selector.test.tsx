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
