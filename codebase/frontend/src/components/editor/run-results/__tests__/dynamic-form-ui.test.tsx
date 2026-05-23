import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DynamicFormUI } from "../dynamic-form-ui";

/**
 * spec/4-nodes/6-presentation/0-common.md §10.5 step 4 (form option backfill SoT
 * lives in backend) and §10.6 (DynamicFormUI 합성 우선순위) — frontend 측 행동
 * 검증.
 *
 * 사용자 보고 (2026-05-23): "select 항목을 선택할 수 없고, 선택 후에도 초기값으로
 * 적용돼." root cause 는 backend optionSchema.value 가 빈 문자열로 collision
 * 되는 문제. backend backfill 이 적용되면 frontend 는 각 옵션이 unique value 를
 * 갖는다고 가정하고 동작한다. 본 테스트는 backfilled payload 가 들어왔을 때
 * select 가 정상 동작함을 보장한다.
 */
describe("DynamicFormUI — select with backfilled option values", () => {
  it("정상 select: 클릭하면 onChange 가 unique value 와 함께 발화", () => {
    const onSubmit = vi.fn();
    render(
      <DynamicFormUI
        formConfig={{
          title: "상품 문의 작성",
          fields: [
            {
              name: "inquiryType",
              type: "select",
              label: "문의 유형",
              required: true,
              options: [
                { label: "주문 문의", value: "opt-0-0" },
                { label: "교환/환불", value: "opt-0-1" },
                { label: "기타", value: "opt-0-2" },
              ],
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "opt-0-1" } });
    expect(select.value).toBe("opt-0-1");

    const submit = screen.getByRole("button", { name: "Submit" });
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith({ inquiryType: "opt-0-1" });
  });

  it("backfilled value 가 placeholder 와 구분되어 보임 (회귀 가드)", () => {
    // placeholder `<option value="">Select…</option>` 와 LLM 옵션이 모두 빈
    // value 였던 PR 이전 회귀가 다시 발생하지 않음을 보장 — backfill 이 적용된
    // 페이로드를 frontend 가 받으면 모든 옵션이 unique value 를 가져야 한다.
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            {
              name: "pick",
              type: "select",
              label: "Pick",
              options: [
                { label: "A", value: "opt-0-0" },
                { label: "B", value: "opt-0-1" },
              ],
            },
          ],
        }}
        onSubmit={vi.fn()}
      />,
    );
    const options = screen.getAllByRole("option");
    const values = options.map((o) => (o as HTMLOptionElement).value);
    // placeholder + 2 options 가 모두 unique
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain(""); // placeholder
    expect(values).toContain("opt-0-0");
    expect(values).toContain("opt-0-1");
  });
});

describe("DynamicFormUI — radio value coerce", () => {
  it("radio: numeric option value 도 정상 비교 (String coerce)", () => {
    const onSubmit = vi.fn();
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            {
              name: "rating",
              type: "radio",
              label: "Rating",
              options: [
                { label: "1점", value: 1 },
                { label: "2점", value: 2 },
              ],
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    fireEvent.click(radios[1]);
    expect(radios[1].checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    // value coerce: state 는 string `"2"` (input.value 출처) 이거나 원래 number 2.
    // 어느 쪽이든 후속 LLM turn 에서 의미 매핑이 가능하면 OK — String coerce
    // 비교가 안 깨지는 것이 본 테스트의 핵심.
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0] as { rating: unknown };
    expect(String(submitted.rating)).toBe("2");
  });
});

describe("DynamicFormUI — number empty-input 보존", () => {
  it("number 필드를 비우면 NaN/0 으로 강제되지 않고 빈 string 보존", () => {
    const onSubmit = vi.fn();
    render(
      <DynamicFormUI
        formConfig={{
          fields: [{ name: "qty", type: "number", label: "Quantity" }],
        }}
        onSubmit={onSubmit}
      />,
    );

    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const submitted = onSubmit.mock.calls[0][0] as { qty: unknown };
    // 빈 문자열 보존 — `Number("") === 0` 자동 강제 회귀 차단.
    expect(submitted.qty).toBe("");
  });

  it("number 필드에 값 입력 시 Number 로 변환되어 저장", () => {
    const onSubmit = vi.fn();
    render(
      <DynamicFormUI
        formConfig={{
          fields: [{ name: "qty", type: "number" }],
        }}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "42" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit.mock.calls[0][0]).toEqual({ qty: 42 });
  });
});

describe("DynamicFormUI — file 케이스 (spec 4-form §1.5 metadata-only)", () => {
  it("file 필드 렌더 + 단일 파일 선택 시 metadata 객체 배열로 저장", () => {
    const onSubmit = vi.fn();
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            {
              name: "attachment",
              type: "file",
              label: "첨부",
              allowedMimeTypes: ["image/png", "image/jpeg"],
              maxFiles: 1,
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );

    const fileInput = screen.getByLabelText("첨부") as HTMLInputElement;
    expect(fileInput.type).toBe("file");
    expect(fileInput.accept).toBe("image/png,image/jpeg");
    expect(fileInput.multiple).toBe(false);

    const file = new File(["hello"], "hello.png", {
      type: "image/png",
      lastModified: 1700000000000,
    });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const submitted = onSubmit.mock.calls[0][0] as {
      attachment: Array<{
        name: string;
        size: number;
        type: string;
        lastModified: number;
      }>;
    };
    expect(submitted.attachment).toHaveLength(1);
    expect(submitted.attachment[0]).toEqual({
      name: "hello.png",
      size: 5, // 'hello' = 5 bytes
      type: "image/png",
      lastModified: 1700000000000,
    });
  });

  it("file 필드 maxFiles > 1 일 때 multiple 속성 적용 + 다중 파일 metadata 배열", () => {
    const onSubmit = vi.fn();
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            {
              name: "docs",
              type: "file",
              label: "문서",
              maxFiles: 3,
              allowedMimeTypes: ["application/pdf"],
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    const fileInput = screen.getByLabelText("문서") as HTMLInputElement;
    expect(fileInput.multiple).toBe(true);
    expect(fileInput.accept).toBe("application/pdf");
  });

  it("file 필드 미선택 시 빈 배열로 제출 (단일 진실: 항상 배열)", () => {
    const onSubmit = vi.fn();
    render(
      <DynamicFormUI
        formConfig={{
          fields: [{ name: "doc", type: "file", label: "Doc" }],
        }}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit.mock.calls[0][0]).toEqual({ doc: [] });
  });
});

describe("DynamicFormUI — defaultValue / 전체 필드 매트릭스", () => {
  it("defaultValue 가 있는 모든 필드를 초기값으로 렌더", () => {
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            { name: "t", type: "text", label: "T", defaultValue: "hi" },
            { name: "n", type: "number", label: "N", defaultValue: 42 },
            { name: "e", type: "email", label: "E", defaultValue: "a@b" },
            { name: "ta", type: "textarea", label: "TA", defaultValue: "long" },
            { name: "d", type: "date", label: "D", defaultValue: "2026-05-23" },
            {
              name: "s",
              type: "select",
              label: "S",
              defaultValue: "opt-5-1",
              options: [
                { label: "A", value: "opt-5-0" },
                { label: "B", value: "opt-5-1" },
              ],
            },
            {
              name: "r",
              type: "radio",
              label: "R",
              defaultValue: "x",
              options: [{ label: "X", value: "x" }],
            },
            { name: "c", type: "checkbox", label: "C", defaultValue: true },
          ],
        }}
        onSubmit={vi.fn()}
      />,
    );

    expect((screen.getByDisplayValue("hi") as HTMLInputElement).value).toBe(
      "hi",
    );
    expect((screen.getByDisplayValue("42") as HTMLInputElement).value).toBe(
      "42",
    );
    expect((screen.getByDisplayValue("a@b") as HTMLInputElement).value).toBe(
      "a@b",
    );
    expect(
      (screen.getByDisplayValue("long") as HTMLTextAreaElement).value,
    ).toBe("long");
    expect(
      (screen.getByDisplayValue("2026-05-23") as HTMLInputElement).value,
    ).toBe("2026-05-23");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
      "opt-5-1",
    );
    expect(
      (
        screen.getByRole("radio", { name: "X" }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    // checkbox 는 label 안에 들어가 있어 getByRole 로 접근
    expect(
      (screen.getByRole("checkbox") as HTMLInputElement).checked,
    ).toBe(true);
  });
});
