import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { loadDocsIndex } from "../registry";

/**
 * Node MDX coverage guard.
 *
 * 모든 backend 노드(`codebase/backend/src/nodes/<cat>/<name>/`) 의 schema 파일이
 * `02-nodes/<cat>.mdx` 의 frontmatter `code:` 목록 중 **어디엔가** 등장해야
 * 한다. 즉, 새 노드를 추가하면 어떤 카테고리 MDX 든 한 곳에서는 카탈로그·예시·
 * 필드표가 작성돼야 한다.
 *
 * 본 가드는 backend 변경이 user-guide 페이지를 stale 시키는 가장 흔한 회귀
 * (PR 가운데 `docs(user-guide): sync MDX with current implementation` 패턴) 를
 * 결정적으로 차단한다. spec/conventions/i18n-userguide.md Principle 4 의 가드.
 *
 * 보완 관계:
 * - `registry.test.ts` 의 "real docs frontmatter spec/code paths" 는 MDX 가
 *   가리키는 경로가 실재하는지 (정방향) 검증한다. 본 테스트는 backend 노드가
 *   어떤 MDX 든 한 곳에서 참조되는지 (역방향) 검증한다.
 */

const repoRoot = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
);
const backendNodesRoot = path.resolve(
  repoRoot,
  "codebase",
  "backend",
  "src",
  "nodes",
);
const docsRoot = path.resolve(__dirname, "..", "..", "..", "content", "docs");
const nodesDocsRoot = path.resolve(docsRoot, "02-nodes");

const hasBackend = fs.existsSync(backendNodesRoot);
const hasDocs = fs.existsSync(nodesDocsRoot);

/**
 * `nodes/<cat>/<name>/*.schema.ts` 형태의 노드 schema 파일만 수집.
 * - 카테고리 / 노드 디렉토리 이름이 `_` prefix 면 shared / private 으로 간주, 제외.
 * - `nodes/core/` 는 노드가 아닌 공통 인프라(component.interface, registry) 이므로 제외.
 */
function collectNodeSchemaFiles(root: string): {
  category: string;
  nodeName: string;
  schemaPath: string;
}[] {
  const out: { category: string; nodeName: string; schemaPath: string }[] = [];
  for (const cat of fs.readdirSync(root, { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    if (cat.name.startsWith("_") || cat.name === "core") continue;
    const catDir = path.join(root, cat.name);
    for (const node of fs.readdirSync(catDir, { withFileTypes: true })) {
      if (!node.isDirectory()) continue;
      if (node.name.startsWith("_")) continue;
      const nodeDir = path.join(catDir, node.name);
      const schemas = fs
        .readdirSync(nodeDir)
        .filter((f) => f.endsWith(".schema.ts"));
      for (const s of schemas) {
        out.push({
          category: cat.name,
          nodeName: node.name,
          schemaPath: path.join(nodeDir, s),
        });
      }
    }
  }
  return out;
}

describe.runIf(hasBackend && hasDocs)(
  "node MDX coverage (backend → 02-nodes/<cat>.mdx)",
  () => {
    const schemas = collectNodeSchemaFiles(backendNodesRoot);
    const docs = loadDocsIndex(docsRoot, { includeDrafts: true });
    const nodesSection = docs.sections.find((s) => s.key === "02-nodes");

    // 모든 02-nodes/*.mdx 의 frontmatter `code:` 를 합집합으로 모은다 (정규화: 절대경로).
    const referencedAbsPaths = new Set<string>();
    for (const page of nodesSection?.pages ?? []) {
      for (const ref of page.frontmatter.code ?? []) {
        referencedAbsPaths.add(path.resolve(repoRoot, ref));
      }
    }

    it("backend 의 모든 노드 schema 파일이 어떤 02-nodes/*.mdx 의 code: 에 등장해요", () => {
      const missing = schemas
        .filter((s) => !referencedAbsPaths.has(s.schemaPath))
        .map((s) =>
          path.relative(repoRoot, s.schemaPath).replace(/\\/g, "/"),
        )
        .sort();

      expect(
        missing,
        `backend 에 존재하지만 02-nodes/<cat>.mdx 의 code: 어디에서도 참조하지 않는 노드 schema ${missing.length} 건:\n` +
          missing.map((s) => `  - ${s}`).join("\n") +
          "\n→ 해당 카테고리의 codebase/frontend/src/content/docs/02-nodes/<cat>.mdx 본문에 노드 항목을 추가하고 frontmatter 의 code: 배열에도 경로를 등록해주세요. " +
          "(spec/conventions/i18n-userguide.md Principle 4)",
      ).toEqual([]);
    });

    it("sanity: 일정 수 이상의 노드 schema 가 발견돼요 (>= 10)", () => {
      expect(schemas.length).toBeGreaterThanOrEqual(10);
    });

    it("sanity: 02-nodes 섹션이 비어있지 않아요", () => {
      expect(nodesSection?.pages.length ?? 0).toBeGreaterThan(0);
    });
  },
);
