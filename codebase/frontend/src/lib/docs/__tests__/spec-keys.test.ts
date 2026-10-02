import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SPEC_KEY_RE,
  UNMIRRORED_GUIDE_KEYS,
  collectMirrorKeys,
  isUnmirroredArea,
  specKeyProblem,
} from "./spec-keys";

describe("collectMirrorKeys", () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "spec-keys-"));
    const write = (rel: string): void => {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, "x");
    };
    write("README.md");
    write("CLE-VISION.md");
    write("CLE-WF/CLE-WF.md");
    write("CLE-WF/CLE-WF-EDITOR.md");
    write("2-navigation/13-user-guide.md");
    write("conventions/i18n-userguide.md");
    // 확장자가 다르거나 `.md` 로 끝나는 디렉터리는 키가 아니다.
    write("CLE-WF/CLE-WF-LIST.txt");
    write("CLE-DIRLIKE.md/notes.txt");
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("미러 파일 이름만 키로 모으고 옛 트리 · README 는 건너뛰어요", () => {
    expect([...collectMirrorKeys(root)].sort()).toEqual([
      "CLE-VISION",
      "CLE-WF",
      "CLE-WF-EDITOR",
    ]);
  });

  it("폴더가 없으면 빈 집합이에요", () => {
    expect(collectMirrorKeys(path.join(root, "nope")).size).toBe(0);
  });
});

describe("specKeyProblem", () => {
  const mirror = new Set(["CLE-WF-EDITOR", "CLE-VISION"]);

  it("미러에 있는 키는 통과해요", () => {
    expect(specKeyProblem("CLE-WF-EDITOR", mirror)).toBeNull();
    expect(specKeyProblem("CLE-VISION", mirror)).toBeNull();
  });

  it("옛 스펙 경로는 따로 알려요", () => {
    expect(specKeyProblem("spec/3-workflow-editor/0-canvas.md", mirror)).toMatch(
      /옛 스펙 경로/,
    );
  });

  it("키 모양이 아니면 막아요", () => {
    expect(specKeyProblem("cle-wf-editor", mirror)).toMatch(/모양/);
    expect(specKeyProblem("CLE-", mirror)).toMatch(/모양/);
    expect(specKeyProblem("CLE-WF-EDITOR ", mirror)).toMatch(/모양/);
  });

  it("미러에 없는 키는 막아요", () => {
    expect(specKeyProblem("CLE-WF-EDITR", mirror)).toMatch(/미러에 없는 키/);
  });

  it("미러 제외 영역의 키는 목록에 있을 때만 통과해요", () => {
    expect(specKeyProblem("CLE-C24-META", mirror)).toBeNull();
    expect(specKeyProblem("CLE-MKS-META", mirror)).toBeNull();
    expect(specKeyProblem("CLE-C24-METAX", mirror)).toMatch(/UNMIRRORED_GUIDE_KEYS/);
    expect(specKeyProblem("CLE-MKS-CATALOG", mirror)).toMatch(/UNMIRRORED_GUIDE_KEYS/);
  });
});

describe("UNMIRRORED_GUIDE_KEYS", () => {
  it("모두 미러 제외 영역의 키 모양이에요", () => {
    for (const key of UNMIRRORED_GUIDE_KEYS) {
      expect(SPEC_KEY_RE.test(key), key).toBe(true);
      expect(isUnmirroredArea(key), key).toBe(true);
    }
  });

  it("영역 접두는 하이픈 경계로만 맞춰요", () => {
    expect(isUnmirroredArea("CLE-C24")).toBe(true);
    expect(isUnmirroredArea("CLE-C24X-META")).toBe(false);
  });
});
