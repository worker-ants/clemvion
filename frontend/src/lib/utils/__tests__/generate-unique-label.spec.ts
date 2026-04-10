import { generateUniqueLabel } from "../generate-unique-label";

describe("generateUniqueLabel", () => {
  it("should return the base label when no conflicts exist", () => {
    expect(generateUniqueLabel("HTTP Request", [])).toBe("HTTP Request");
  });

  it("should append 2 when base label already exists", () => {
    expect(generateUniqueLabel("HTTP Request", ["HTTP Request"])).toBe(
      "HTTP Request 2",
    );
  });

  it("should find the next available number", () => {
    expect(
      generateUniqueLabel("HTTP Request", [
        "HTTP Request",
        "HTTP Request 2",
        "HTTP Request 3",
      ]),
    ).toBe("HTTP Request 4");
  });

  it("should handle gaps in numbering", () => {
    expect(
      generateUniqueLabel("HTTP Request", [
        "HTTP Request",
        "HTTP Request 3",
      ]),
    ).toBe("HTTP Request 2");
  });

  it("should work with Korean labels", () => {
    expect(generateUniqueLabel("오류 표시", ["오류 표시"])).toBe("오류 표시 2");
  });

  it("should handle empty existing labels", () => {
    expect(generateUniqueLabel("Code", [])).toBe("Code");
  });

  it("should not be confused by similar prefixes", () => {
    expect(
      generateUniqueLabel("HTTP Request", ["HTTP Request Body"]),
    ).toBe("HTTP Request");
  });
});
