import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  collectMdxFiles,
  isValidKind,
  parseImplAnchors,
  repoRoot,
} from "./impl-anchor-parse";

// Guard: every <ImplAnchor> in user-guide MDX must reference a real file
// AND its `symbol` must grep-match inside that file. SoT:
// spec/conventions/user-guide-evidence.md §2.
//
// For `kind="api-endpoint"` anchors we additionally assert that the
// resolved controller file declares a NestJS HTTP route decorator
// (@Post/@Get/@Put/@Patch/@Delete) AND that the route path promised by the
// anchor appears in the file. The `describes` prop of an api-endpoint
// anchor holds the human-readable route — `POST /api/triggers/:id/...`
// (see spec §3.3). Because NestJS assembles the full path from a global
// `/api` prefix + `@Controller(base)` + the method decorator arg, the
// verbatim full path never appears in the controller file; we therefore
// match on the most specific (trailing) static path segment, which always
// lives inside the decorator argument.
//
// Failure here means a guide promised a UI / API / e2e anchor that no
// longer exists — exactly the class of drift this convention catches.

const HTTP_DECORATOR_RE = /@(?:Post|Get|Put|Patch|Delete)\s*\(/;

// Extract the route path from an api-endpoint anchor's `describes`, e.g.
// "POST /api/triggers/:id/chat-channel/rotate-bot-token" -> the path.
function extractRoutePath(describes: string): string | null {
  const m = /\b(?:POST|GET|PUT|PATCH|DELETE)\s+(\/\S+)/i.exec(describes);
  return m ? m[1] : null;
}

// The trailing static (non-`:param`) path segment — the part that lives
// inside the method decorator argument and is therefore grep-able in the
// controller file, independent of the global prefix / controller base.
function trailingStaticSegment(routePath: string): string | null {
  const segments = routePath.split("/").filter((s) => s.length > 0);
  for (let i = segments.length - 1; i >= 0; i--) {
    if (!segments[i].startsWith(":")) return segments[i];
  }
  return null;
}

describe("ImplAnchor existence guard", () => {
  const root = repoRoot();
  const guideDocsRoot = "codebase/frontend/src/content/docs";
  const allMdx = collectMdxFiles(root, guideDocsRoot);

  it("collects MDX files (precondition — sanity)", () => {
    expect(allMdx.length).toBeGreaterThan(0);
  });

  for (const mdxPath of allMdx) {
    const mdxRel = path.relative(root, mdxPath);
    describe(mdxRel, () => {
      const text = fs.readFileSync(mdxPath, "utf8");
      const anchors = parseImplAnchors(text);

      if (anchors.length === 0) {
        it("no <ImplAnchor> — skip", () => {
          expect(anchors.length).toBe(0);
        });
        return;
      }

      for (const a of anchors) {
        const label = `anchor file=${a.file} symbol=${a.symbol}`;
        it(`${label} — kind enum is valid`, () => {
          expect(isValidKind(a.kind)).toBe(true);
        });
        it(`${label} — file exists in repo`, () => {
          const abs = path.join(root, a.file);
          expect(fs.existsSync(abs)).toBe(true);
        });
        it(`${label} — symbol grep-matches in file`, () => {
          const abs = path.join(root, a.file);
          const fileText = fs.readFileSync(abs, "utf8");
          expect(fileText.includes(a.symbol)).toBe(true);
        });

        if (a.kind === "api-endpoint") {
          it(`${label} — declares a NestJS HTTP route decorator + path`, () => {
            const abs = path.join(root, a.file);
            const fileText = fs.readFileSync(abs, "utf8");
            // (1) the controller file must declare an HTTP route decorator.
            expect(HTTP_DECORATOR_RE.test(fileText)).toBe(true);
            // (2) the route path promised by `describes` must be reflected in
            // the file. NestJS splits the full path across global prefix /
            // controller base / method decorator, so we match the trailing
            // static segment, which lives in the method decorator argument.
            const routePath = extractRoutePath(a.describes);
            expect(routePath).not.toBeNull();
            const segment = trailingStaticSegment(routePath!);
            expect(segment).not.toBeNull();
            expect(fileText.includes(segment!)).toBe(true);
          });
        }
      }
    });
  }
});

// Focused coverage for the api-endpoint branch. 이 주석은 종전 *"아직 어떤 유저 가이드
// MDX 도 `api-endpoint` 앵커를 쓰지 않는다"* 로 시작했는데, `models{,.en}.mdx` 가
// `POST /api/model-configs/:id/test` 앵커를 실으면서 **그 전제가 깨졌다** — 위 루프가 이제
// 실 콘텐츠로도 이 분기를 태운다. 그래도 아래 블록을 남기는 이유는 실 콘텐츠 커버리지가
// **우연**이라는 것이다: 그 앵커 하나가 지워지면 분기는 다시 무검증이 되고 스위트는 초록이다.
// 헬퍼 동작과 분기 논리를 정본 예시(spec §3.3)로 직접 고정해 그 우연에 의존하지 않는다.
describe("ImplAnchor api-endpoint path/decorator match", () => {
  const root = repoRoot();

  it("extractRoutePath pulls the path out of `describes`", () => {
    expect(
      extractRoutePath("POST /api/triggers/:id/chat-channel/rotate-bot-token"),
    ).toBe("/api/triggers/:id/chat-channel/rotate-bot-token");
    expect(extractRoutePath("GET /api/health")).toBe("/api/health");
    expect(extractRoutePath("not a route description")).toBeNull();
  });

  it("trailingStaticSegment skips :params and returns the most specific segment", () => {
    expect(
      trailingStaticSegment("/api/triggers/:id/chat-channel/rotate-bot-token"),
    ).toBe("rotate-bot-token");
    expect(trailingStaticSegment("/api/triggers/:id")).toBe("triggers");
    expect(trailingStaticSegment("/:id")).toBeNull();
  });

  it("HTTP_DECORATOR_RE matches NestJS route decorators", () => {
    expect(HTTP_DECORATOR_RE.test("@Post(':id/foo')")).toBe(true);
    expect(HTTP_DECORATOR_RE.test("@Get()")).toBe(true);
    expect(HTTP_DECORATOR_RE.test("@Put('x')")).toBe(true);
    expect(HTTP_DECORATOR_RE.test("@Patch('x')")).toBe(true);
    expect(HTTP_DECORATOR_RE.test("@Delete('x')")).toBe(true);
    expect(HTTP_DECORATOR_RE.test("@ApiOperation({})")).toBe(false);
  });

  it("validates the canonical chat-channel rotate-bot-token anchor end-to-end", () => {
    const anchor = {
      kind: "api-endpoint" as const,
      // C-2: rotateBotToken 엔드포인트가 chat-channel→triggers forwardRef 순환
      // 해소를 위해 TriggersController 로 이전됨 (route 무변).
      file: "codebase/backend/src/modules/triggers/triggers.controller.ts",
      symbol: "rotateBotToken",
      describes: "POST /api/triggers/:id/chat-channel/rotate-bot-token",
    };
    const abs = path.join(root, anchor.file);
    expect(fs.existsSync(abs)).toBe(true);
    const fileText = fs.readFileSync(abs, "utf8");
    expect(fileText.includes(anchor.symbol)).toBe(true);
    expect(HTTP_DECORATOR_RE.test(fileText)).toBe(true);
    const routePath = extractRoutePath(anchor.describes);
    expect(routePath).not.toBeNull();
    const segment = trailingStaticSegment(routePath!);
    expect(segment).toBe("rotate-bot-token");
    expect(fileText.includes(segment!)).toBe(true);
  });
});
