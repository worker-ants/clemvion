import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * 밖으로 나가는 정적 파일에 저장소 내부 참조가 다시 들어가지 않게 막는다.
 *
 * - 배포되는 SVG(`codebase/frontend/public/**` 와 Next.js 메타데이터 아이콘 `src/app/*.svg`).
 *   주석까지 그대로 내려받힌다.
 * - 외부 통합용 SDK 의 README 와 `package.json`(`@workflow/sdk` · `@workflow/web-chat`). npm 에
 *   함께 실린다. 나머지 `codebase/packages/*` 는 백엔드 · 프론트엔드가 workspace 로만 쓰는 내부
 *   패키지라 README 가 개발자 문서다. 스펙 참조를 남겨도 된다.
 *
 * 외부 사람은 저장소 스펙 경로도 NERV 스펙 키도 열어 볼 수 없다. 옛 스펙 트리는 NERV 정본
 * 전환 마지막 단계에서 지워지므로 경로는 곧 죽은 문자열이 된다. 전환 단계 4c(NERV Task
 * `CLE-T-9AM31N`)에서 SVG 9개 · README 5곳 · `package.json` 1곳을 걷어 내고 이 검사를 세웠다. 공개 OpenAPI 문장은
 * 백엔드 가드 `openapi-internal-ref` 가 본다. 패턴은 그 가드와 같다.
 */
const INTERNAL_REF_PATTERNS: readonly RegExp[] = [
  /(?<![\w.-])spec\/[\w-]/,
  /\bCLE-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\b/,
  /\bREQ-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+\b/,
  /\bplan\/(?:in-progress|complete)\//,
  /\b\d+-[a-z][\w-]*\.md\b/,
];

// 이 파일은 `codebase/frontend/src/lib/__tests__/` 에 있다.
const REPO_ROOT = path.resolve(__dirname, "../../../../..");

/** 외부 통합용 SDK 패키지 디렉터리. 새 공개 SDK 를 만들면 여기에 더한다. */
const PUBLIC_SDK_PACKAGES = ["sdk", "web-chat-sdk"] as const;

function listFiles(dir: string, accept: (name: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules") out.push(...listFiles(full, accept));
    } else if (accept(e.name)) {
      out.push(full);
    }
  }
  return out;
}

function publicSurfaceFiles(): string[] {
  const svg = (name: string): boolean => name.endsWith(".svg");
  // 목록의 파일이 없으면 readFileSync 가 던져 테스트가 실패한다(조용히 빠지지 않는다).
  const sdkFiles = PUBLIC_SDK_PACKAGES.flatMap((name) =>
    ["README.md", "package.json"].map((f) =>
      path.join(REPO_ROOT, "codebase", "packages", name, f),
    ),
  );
  return [
    ...listFiles(path.join(REPO_ROOT, "codebase", "frontend", "public"), svg),
    ...fs
      .readdirSync(path.join(REPO_ROOT, "codebase", "frontend", "src", "app"))
      .filter(svg)
      .map((name) => path.join(REPO_ROOT, "codebase", "frontend", "src", "app", name)),
    ...sdkFiles,
  ];
}

export function findInternalRefs(text: string): string[] {
  const out: string[] = [];
  for (const re of INTERNAL_REF_PATTERNS) {
    const m = re.exec(text);
    if (m) out.push(m[0]);
  }
  return out;
}

describe("배포되는 정적 파일의 내부 참조", () => {
  it("[대조군] 경로 · 키 · 요구사항 ID · plan 경로를 잡고 낱말은 넘긴다", () => {
    expect(findInternalRefs("<!-- Spec spec/6-brand.md §8.4.1 -->")).toEqual(["spec/6", "6-brand.md"]);
    expect(findInternalRefs("상세: CLE-UI-BRAND")).toEqual(["CLE-UI-BRAND"]);
    expect(findInternalRefs("REQ-GUIDE-032 참고")).toEqual(["REQ-GUIDE-032"]);
    expect(findInternalRefs("옛 plan plan/in-progress/x.md")).toEqual(["plan/in-progress/"]);
    expect(findInternalRefs("(../5-system/14-external-interaction-api.md)")).toEqual([
      "14-external-interaction-api.md",
    ]);
    expect(findInternalRefs("respec/ 과 spec 이라는 낱말, OpenAPI spec, README.md")).toEqual([]);
  });

  it("SVG 와 npm README 에 내부 참조가 없다", () => {
    const files = publicSurfaceFiles();
    // 대상이 비면 아래 단언이 공허하다. SVG 14개 + SDK 파일 4개(2026-10-03).
    expect(files.length).toBeGreaterThan(8);
    const found = files.flatMap((f) =>
      findInternalRefs(fs.readFileSync(f, "utf8")).map(
        (m) => `${path.relative(REPO_ROOT, f)}: ${m}`,
      ),
    );
    expect(found).toEqual([]);
  });
});
