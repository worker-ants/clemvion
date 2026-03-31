import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../card";

describe("Card", () => {
  it("renders Card with children", () => {
    render(<Card data-testid="card">Card content</Card>);
    const card = screen.getByTestId("card");
    expect(card).toBeInTheDocument();
    expect(card.textContent).toBe("Card content");
  });

  it("Card applies custom className", () => {
    render(<Card data-testid="card" className="custom">Content</Card>);
    expect(screen.getByTestId("card").className).toContain("custom");
  });

  it("renders CardHeader", () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);
    const header = screen.getByTestId("header");
    expect(header).toBeInTheDocument();
    expect(header.className).toContain("p-6");
  });

  it("renders CardTitle as h3", () => {
    render(<CardTitle>My Title</CardTitle>);
    const title = screen.getByText("My Title");
    expect(title.tagName).toBe("H3");
    expect(title.className).toContain("text-2xl");
  });

  it("renders CardDescription as p", () => {
    render(<CardDescription>Some description</CardDescription>);
    const desc = screen.getByText("Some description");
    expect(desc.tagName).toBe("P");
    expect(desc.className).toContain("text-sm");
  });

  it("renders CardContent", () => {
    render(<CardContent data-testid="content">Body content</CardContent>);
    const content = screen.getByTestId("content");
    expect(content).toBeInTheDocument();
    expect(content.className).toContain("p-6");
  });

  it("renders a complete card composition", () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>
    );

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("forwards refs on Card", () => {
    let ref: HTMLDivElement | null = null;
    render(<Card ref={(el) => { ref = el; }}>Content</Card>);
    expect(ref).toBeInstanceOf(HTMLDivElement);
  });
});
