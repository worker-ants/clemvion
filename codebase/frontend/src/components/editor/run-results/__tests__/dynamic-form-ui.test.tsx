import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DynamicFormUI } from "../dynamic-form-ui";
import { MASKED_MARKERS } from "@/lib/utils/masked-markers";
import { useLocaleStore } from "@/lib/stores/locale-store";

// file 검증 에러 등 user-facing 문자열을 한국어로 단언하므로 locale 을 ko 로 고정한다
// (DEFAULT_LOCALE='ko' 이지만 모듈 store 의 테스트 간 잔류를 방어 — W5).
beforeEach(() => {
  useLocaleStore.setState({ locale: "ko" });
});

/**
 * DynamicFormUI 컴포넌트 통합 테스트.
 *
 * 검증 범위:
 *  - select / radio / number / file / checkbox / textarea / date / text 전체 필드 타입
 *  - spec §10.5 step 4 (form option backfill): backend SoT 적용 후 frontend 정상 동작
 *  - spec §1.5 (file 필드 metadata-only): FileList → FilePickMetadata[] 직렬화
 *  - number 필드 empty-input 보존 (NaN/0 강제 회귀 차단)
 *  - radio numeric option value String coerce 비교
 *  - defaultValue 초기화 매트릭스 (8개 필드 타입 전체)
 *  - rerender 시 key prop 에 의한 state 보존/리셋 동작
 *  - 다중 파일(maxFiles > 1) submit metadata 배열 수집
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

  it("file 필드 maxFiles > 1 일 때 multiple 속성 적용 + 다중 파일 submit metadata 배열 (W#6)", () => {
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

    // W#6: 2개 파일 선택 → submit → length=2 검증
    const file1 = new File(["a"], "report1.pdf", {
      type: "application/pdf",
      lastModified: 1700000001000,
    });
    const file2 = new File(["bb"], "report2.pdf", {
      type: "application/pdf",
      lastModified: 1700000002000,
    });
    Object.defineProperty(fileInput, "files", { value: [file1, file2] });
    fireEvent.change(fileInput);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const submitted = onSubmit.mock.calls[0][0] as {
      docs: Array<{ name: string; size: number }>;
    };
    expect(submitted.docs).toHaveLength(2);
    expect(submitted.docs[0].name).toBe("report1.pdf");
    expect(submitted.docs[1].name).toBe("report2.pdf");
    expect(submitted.docs[0].size).toBe(1); // 'a' = 1 byte
    expect(submitted.docs[1].size).toBe(2); // 'bb' = 2 bytes
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

describe("DynamicFormUI — file 클라이언트 검증 (spec §1.5 reject)", () => {
  const MB = 1024 * 1024;

  function selectFiles(input: HTMLInputElement, files: File[]) {
    Object.defineProperty(input, "files", { value: files, configurable: true });
    fireEvent.change(input);
  }

  it("MIME 미허용(기본 목록) → reject + 에러 표시 + selection 미반영", () => {
    const onSubmit = vi.fn();
    render(
      <DynamicFormUI
        formConfig={{
          // allowedMimeTypes 미설정 → 클라이언트가 §1 기본 14종 적용.
          fields: [{ name: "doc", type: "file", label: "Doc" }],
        }}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByLabelText("Doc") as HTMLInputElement;
    const evil = new File(["x"], "evil.exe", {
      type: "application/x-msdownload",
    });
    selectFiles(input, [evil]);

    expect(screen.getByText("허용되지 않은 파일 형식입니다.")).toBeTruthy();
    // selection 미반영 → submit 시 빈 배열.
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit.mock.calls[0][0]).toEqual({ doc: [] });
  });

  it("per-file 크기 초과(기본 10MB) → reject + 에러 표시", () => {
    const onSubmit = vi.fn();
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            {
              name: "doc",
              type: "file",
              label: "Doc",
              allowedMimeTypes: ["image/png"],
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByLabelText("Doc") as HTMLInputElement;
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 11 * MB });
    selectFiles(input, [big]);

    expect(screen.getByText("파일 크기는 10MB 이하여야 합니다.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit.mock.calls[0][0]).toEqual({ doc: [] });
  });

  it("합계 크기 초과(maxTotalSize) → reject + 에러 표시", () => {
    const onSubmit = vi.fn();
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            {
              name: "doc",
              type: "file",
              label: "Doc",
              allowedMimeTypes: ["image/png"],
              maxFileSize: 10,
              maxTotalSize: 10,
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByLabelText("Doc") as HTMLInputElement;
    const mk = (n: string, bytes: number) => {
      const f = new File(["x"], n, { type: "image/png" });
      Object.defineProperty(f, "size", { value: bytes });
      return f;
    };
    // 개별 6MB(≤10) 이나 합계 12MB(>10) → total 초과.
    selectFiles(input, [mk("a.png", 6 * MB), mk("b.png", 6 * MB)]);

    expect(
      screen.getByText("전체 파일 크기는 10MB 이하여야 합니다."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit.mock.calls[0][0]).toEqual({ doc: [] });
  });

  it("확장자 없는 파일(File.type === '') → MIME 체크 skip → 통과(반영)", () => {
    const onSubmit = vi.fn();
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            {
              name: "doc",
              type: "file",
              label: "Doc",
              allowedMimeTypes: ["image/png"],
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByLabelText("Doc") as HTMLInputElement;
    // type "" — 브라우저가 MIME 미상. MIME 거부 없이 통과.
    selectFiles(input, [new File(["x"], "noext", { type: "" })]);
    expect(
      screen.queryByText("허용되지 않은 파일 형식입니다."),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const submitted = onSubmit.mock.calls[0][0] as { doc: Array<{ name: string }> };
    expect(submitted.doc).toHaveLength(1);
    expect(submitted.doc[0].name).toBe("noext");
  });

  it("개수 초과(maxFiles 2) → reject + 에러 표시", () => {
    const onSubmit = vi.fn();
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            {
              name: "doc",
              type: "file",
              label: "Doc",
              maxFiles: 2,
              allowedMimeTypes: ["image/png"],
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByLabelText("Doc") as HTMLInputElement;
    const mk = (n: string) => new File(["x"], n, { type: "image/png" });
    selectFiles(input, [mk("a.png"), mk("b.png"), mk("c.png")]);

    expect(screen.getByText("최대 2개까지 업로드할 수 있습니다.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit.mock.calls[0][0]).toEqual({ doc: [] });
  });

  it("유효 선택 후 재선택이 유효하면 에러 해제 + metadata 반영", () => {
    const onSubmit = vi.fn();
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            {
              name: "doc",
              type: "file",
              label: "Doc",
              allowedMimeTypes: ["image/png"],
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByLabelText("Doc") as HTMLInputElement;
    // 1차: 미허용 → 에러.
    selectFiles(input, [new File(["x"], "x.gif", { type: "image/gif" })]);
    expect(screen.getByText("허용되지 않은 파일 형식입니다.")).toBeTruthy();
    // 2차: 허용 → 에러 해제 + 반영.
    selectFiles(input, [new File(["ok"], "ok.png", { type: "image/png" })]);
    expect(screen.queryByText("허용되지 않은 파일 형식입니다.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const submitted = onSubmit.mock.calls[0][0] as {
      doc: Array<{ name: string }>;
    };
    expect(submitted.doc).toHaveLength(1);
    expect(submitted.doc[0].name).toBe("ok.png");
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

describe("DynamicFormUI — key prop state 보존/리셋 (W#5)", () => {
  it("같은 key 로 rerender 시 사용자 입력 보존 (mount 유지)", () => {
    // 본 변경의 핵심 가드 — `key={waitingNodeId}` 가 같으면 컴포넌트가
    // unmount/remount 되지 않아 useState 값이 유지된다.
    const formConfig = {
      fields: [{ name: "name", type: "text", label: "Name" }],
    };
    const onSubmit = vi.fn();

    const { rerender } = render(
      <DynamicFormUI key="node-1" formConfig={formConfig} onSubmit={onSubmit} />,
    );

    // 사용자 입력
    const input = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Alice" } });
    expect(input.value).toBe("Alice");

    // 같은 key 로 rerender (resolvedFormConfig 참조 변경 시뮬레이션)
    rerender(
      <DynamicFormUI key="node-1" formConfig={{ ...formConfig }} onSubmit={onSubmit} />,
    );

    // 입력 보존 — mount 유지이므로 state 유지
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Alice");
  });

  it("다른 key 로 rerender 시 state 리셋 (의도된 remount)", () => {
    // key 가 바뀌면 React 가 컴포넌트를 unmount → remount → state 초기화.
    // 다른 노드가 waiting 상태로 전환될 때 이전 입력이 남지 않아야 한다.
    const formConfig = {
      fields: [{ name: "comment", type: "text", label: "Comment" }],
    };
    const onSubmit = vi.fn();

    const { rerender } = render(
      <DynamicFormUI key="node-1" formConfig={formConfig} onSubmit={onSubmit} />,
    );

    fireEvent.change(screen.getByLabelText("Comment"), {
      target: { value: "Old input" },
    });

    // 다른 key (다른 노드 전환 시뮬레이션)
    rerender(
      <DynamicFormUI key="node-2" formConfig={formConfig} onSubmit={onSubmit} />,
    );

    // 리셋 — 새 mount 이므로 initialValueFor 결과 (빈 문자열)
    expect((screen.getByLabelText("Comment") as HTMLInputElement).value).toBe("");
  });
});

/**
 * **마스킹된 기본값은 프리필하지 않는다** — 왕복 오염 차단.
 *
 * `formConfig` 는 `execution.waiting_for_input` payload 를 타고 오고, 그 payload 는 emit
 * 시점에 자격증명 값-패턴이 마스킹된다(EIA §R17). 마스킹은 이 payload 가 SSE·notification
 * webhook 으로도 나가기 때문에 **끌 수 없다**. 그런데 이 폼이 `defaultValue` 로 프리필되고
 * 사용자가 손대지 않으면 리터럴 `'***'` 가 **실제 폼 값으로 제출**된다 — Re-run 모달에서
 * CRITICAL 로 잡힌 것과 같은 클래스(*읽혀서 되쓰이는 값에 마스킹을 걸면 데이터 무결성
 * 문제가 된다*)다.
 *
 * **양방향을 고정한다**: 마커는 프리필하지 않고(+ 안내 노출), 마커가 아닌 값은 그대로 둔다.
 * 한쪽만 단언하면 "전부 프리필 안 함" 구현으로도 초록이 된다.
 */
describe("DynamicFormUI — 마스킹된 defaultValue 왕복 차단", () => {
  // 구현 상수에서 파생시킨다 — 마커가 늘어나면 아래 `it.each` 가 자동으로 그 마커까지 돈다.
  // 리터럴을 손으로 복제하면 새 마커가 조용히 미검증으로 남는다.
  const MARKERS = [...MASKED_MARKERS];

  // 다만 파생만 하면 **값 자체가 바뀌어도** 초록이다(집합이 통째로 이동해도 자기 자신과는
  // 늘 일치하므로). backend SoT 와의 계약은 리터럴로 따로 못박는다 — 이 세 문자열은
  // `sanitize-error-message.ts` 가 실제로 내보내는 값이고, 어긋나면 가드가 조용히 뚫린다.
  it("마커 집합이 backend SoT 의 리터럴과 일치한다", () => {
    expect(MARKERS).toEqual(["***", "[REDACTED]", "[REDACTED_DEPTH]"]);
  });

  it.each(MARKERS)("마커 %s 는 프리필하지 않는다", (marker) => {
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            { name: "tok", type: "text", label: "Token", defaultValue: marker },
          ],
        }}
        onSubmit={vi.fn()}
      />,
    );
    expect((screen.getByLabelText("Token") as HTMLInputElement).value).toBe("");
  });

  it("마커가 아닌 기본값은 그대로 프리필한다 (가드가 과하지 않음)", () => {
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            { name: "n", type: "text", label: "Note", defaultValue: "평범한 값" },
            // 마커를 *포함*할 뿐인 문자열은 마스킹 산물이 아니다 — 정확 일치만 건다.
            { name: "p", type: "text", label: "Partial", defaultValue: "a***b" },
          ],
        }}
        onSubmit={vi.fn()}
      />,
    );
    expect((screen.getByLabelText("Note") as HTMLInputElement).value).toBe(
      "평범한 값",
    );
    expect((screen.getByLabelText("Partial") as HTMLInputElement).value).toBe(
      "a***b",
    );
  });

  /**
   * **보장의 경계 — 부분 치환은 잡지 않는다 (의도)** (`12_06_12` security W3).
   *
   * backend 의 URI-userinfo 패턴은 `scheme://user:pass@host` 를 `scheme://***@host` 로
   * **부분** 치환한다. 그 결과는 전체가 마커가 아니라 여기서 감지되지 않고 프리필된다 —
   * **자격증명은 이미 지워졌으니 노출은 아니고**, 부분 포함으로 넓히면 위 `a***b` 같은
   * 정상 값까지 비워 정상 워크플로를 망가뜨린다(오탐 비용 > 미탐 비용).
   *
   * 캐너리로 둔다: 누군가 `has()` 를 `includes()` 로 넓히면 여기가 RED 로 바뀌어
   * 그 트레이드오프를 그 자리에서 마주하게 된다.
   */
  it("[캐너리] 부분 치환된 값(`scheme://***@host`)은 프리필된다 — 의도된 경계", () => {
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            {
              name: "dsn",
              type: "text",
              label: "Dsn",
              defaultValue: "postgres://***@db.internal/prod",
            },
          ],
        }}
        onSubmit={vi.fn()}
      />,
    );
    expect((screen.getByLabelText("Dsn") as HTMLInputElement).value).toBe(
      "postgres://***@db.internal/prod",
    );
  });

  it("마커 필드에는 이유를 알리는 안내를 띄우고, 아닌 필드에는 띄우지 않는다", () => {
    // **음의 단언이 핵심이다** — 노출 조건을 `true &&` 로 뮤테이션해도 양의 단언만으로는
    // GREEN 이 유지된다(`12_06_12` testing W2 가 실측으로 잡았다). 두 필드를 한 화면에
    // 놓고 "하나만 뜬다" 를 물어야 그 뮤턴트가 RED 가 된다.
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            { name: "tok", type: "text", label: "Token", defaultValue: "***" },
            { name: "plain", type: "text", label: "Plain", defaultValue: "ok" },
          ],
        }}
        onSubmit={vi.fn()}
      />,
    );
    const hints = screen.getAllByText(/자격증명으로 판별되어 가려졌어요/);
    expect(hints).toHaveLength(1);
  });

  it("마스킹되지 않은 필드만 있으면 안내가 아예 없다", () => {
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            { name: "plain", type: "text", label: "Plain", defaultValue: "ok" },
          ],
        }}
        onSubmit={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(/자격증명으로 판별되어 가려졌어요/),
    ).not.toBeInTheDocument();
  });

  it("제출 payload 에 마커가 실리지 않는다 (오염 차단의 최종 단언)", () => {
    const onSubmit = vi.fn();
    render(
      <DynamicFormUI
        formConfig={{
          fields: [
            { name: "tok", type: "text", label: "Token", defaultValue: "***" },
            { name: "keep", type: "text", label: "Keep", defaultValue: "ok" },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    // **`click` 을 쓴다** — `fireEvent.submit(button)` 은 form 을 직접 제출해 버튼의
    // `type="submit"` 배선을 건너뛴다(그 배선이 깨져도 GREEN, `12_06_12` testing W1).
    // 같은 파일의 다른 제출 테스트 13건도 전부 `click` 이다.
    fireEvent.click(screen.getByRole("button", { name: /submit|제출/i }));
    const payload = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.tok).toBe("");
    expect(payload.keep).toBe("ok");
    expect(JSON.stringify(payload)).not.toContain("***");
  });
});
