import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { UserAvatar, getInitials } from "../user-avatar";

const ids = { imageTestId: "avatar-image", initialsTestId: "avatar-initials" };

describe("getInitials", () => {
  it.each([
    ["Alice Kim", "a@b.c", "AK"],
    ["alice", "a@b.c", "A"],
    ["  Alice   Bob  Carol ", "a@b.c", "AB"],
    ["", "zoe@b.c", "Z"],
    ["   ", "zoe@b.c", "Z"],
    [null, null, "?"],
    [undefined, "", "?"],
  ])("이름 %j · 이메일 %j → %s", (name, email, expected) => {
    expect(getInitials(name, email)).toBe(expected);
  });
});

describe("UserAvatar", () => {
  it("주소가 있으면 이미지를 보인다", () => {
    render(<UserAvatar src="https://cdn.example.com/a.png" name="Alice" alt="Alice" {...ids} />);

    const img = screen.getByTestId("avatar-image");
    expect(img).toHaveAttribute("src", "https://cdn.example.com/a.png");
    expect(img).toHaveAttribute("alt", "Alice");
    expect(screen.queryByTestId("avatar-initials")).toBeNull();
  });

  it.each([null, undefined, ""])("주소가 %j 이면 이니셜을 보인다", (src) => {
    render(<UserAvatar src={src} name="Alice Kim" alt="" {...ids} />);

    expect(screen.queryByTestId("avatar-image")).toBeNull();
    expect(screen.getByTestId("avatar-initials")).toHaveTextContent("AK");
  });

  it("이미지를 불러오지 못하면 이니셜로 바꾼다", () => {
    render(<UserAvatar src="https://cdn.example.com/broken.png" name="Alice" alt="" {...ids} />);

    fireEvent.error(screen.getByTestId("avatar-image"));

    expect(screen.queryByTestId("avatar-image")).toBeNull();
    expect(screen.getByTestId("avatar-initials")).toHaveTextContent("A");
  });

  it("주소가 바뀌면 이미지를 다시 시도한다", () => {
    const { rerender } = render(
      <UserAvatar src="https://cdn.example.com/broken.png" name="Alice" alt="" {...ids} />,
    );
    fireEvent.error(screen.getByTestId("avatar-image"));
    expect(screen.queryByTestId("avatar-image")).toBeNull();

    rerender(<UserAvatar src="https://cdn.example.com/new.png" name="Alice" alt="" {...ids} />);

    expect(screen.getByTestId("avatar-image")).toHaveAttribute(
      "src",
      "https://cdn.example.com/new.png",
    );
  });

  it("className 으로 크기를 정한다", () => {
    render(<UserAvatar name="Alice" alt="" className="h-8 w-8 text-xs" {...ids} />);

    const circle = screen.getByTestId("avatar-initials").parentElement;
    expect(circle).toHaveClass("h-8", "w-8", "text-xs", "rounded-full");
  });
});
