import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { EmptyState } from "../ui/empty-state";
import { Inbox } from "lucide-react";

/**
 * Lightweight a11y smoke tests using axe-core via vitest-axe.
 * These catch regressions in the UI primitive layer (labels, roles, landmark
 * usage). Page-level audits with focus-trap and aria-live behavior are still
 * the responsibility of manual VoiceOver passes / future Playwright e2e.
 */
describe("UI primitives a11y smoke", () => {
  it("Button has no axe violations", async () => {
    const { container } = render(<Button>Save</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("disabled Button has no axe violations", async () => {
    const { container } = render(<Button disabled>Save</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Input paired with Label has no axe violations", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="email-field">Email</Label>
        <Input id="email-field" type="email" />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Badge has no axe violations", async () => {
    const { container } = render(<Badge variant="outline">New</Badge>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Card with header content has no axe violations", async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Hello</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Body content</p>
        </CardContent>
      </Card>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("EmptyState renders without a11y violations", async () => {
    const { container } = render(
      <EmptyState
        icon={Inbox}
        title="No data yet"
        description="Add your first record to get started."
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
