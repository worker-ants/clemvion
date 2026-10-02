import path from "node:path";
import { walkTree } from "./tree-walk";

// 사용자 가이드 프론트매터 `spec:` 의 NERV 스펙 키 검사 도우미.
//
// `spec:` 은 NERV 스펙 키 목록이다(CLE-UI-GUIDE 「프론트매터」, NERV 정본 전환 단계 4b).
// 키는 저장소 미러 파일 이름(`spec/<영역 키>/<KEY>.md`, 영역 밖 문서는 `spec/<KEY>.md`)으로
// 확인한다. 옛 트리 파일(`spec/<번호>-<영역>/…`)은 키 모양이 아니어서 섞이지 않는다.
// 스펙 문서 자체의 프론트매터를 보는 가드(`spec-frontmatter*`)와는 다른 것이다.

/**
 * 가이드가 가리킬 수 있는 미러 키의 모양. `no-internal-refs.test.ts` 의 본문 금지 패턴도
 * 같은 모양을 쓴다(둘을 함께 고친다).
 *
 * `.claude/tools/nerv-mirror/pull.py` 의 `KEY_RE` 보다 좁다 — 첫 토큰이 숫자로 시작하는 키와
 * 카탈로그 하위의 `--` 계층 키는 받지 않는다. 가이드는 미러에 있는 문서만 가리키고 카탈로그
 * 하위 문서는 미러하지 않기 때문이다. 그런 키가 필요해지면 `KEY_RE` 와 맞춘다.
 */
export const SPEC_KEY_RE = /^CLE-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;

// 미러에 넣지 않는 영역. `.claude/tools/nerv-mirror/pull.py` 의 `EXCLUDED_AREAS` 사본이라
// 그쪽을 바꾸면 여기도 고친다. 카탈로그는 저장소 `codebase/api-catalogs/` 가 정본이라
// 미러하지 않는다.
export const UNMIRRORED_AREAS: readonly string[] = ["CLE-C24", "CLE-MKS"];

// 가이드가 가리키는 키 가운데 미러에 없는 영역의 키. 미러 파일로 확인할 수 없어서
// 이름을 적어 둔다. 새 키를 더할 때는 NERV 에 그 문서가 있는지 확인하고 더한다.
export const UNMIRRORED_GUIDE_KEYS: ReadonlySet<string> = new Set([
  "CLE-C24-META",
  "CLE-MKS-META",
]);

/**
 * `specRoot` 아래 미러 파일(`CLE-*.md`)의 키 → 절대 경로. 폴더가 없으면 빈 맵이다.
 * 키 링크(`[글](CLE-KEY#앵커)`)의 앵커를 그 파일의 제목으로 확인할 때 쓴다(`spec-links.ts`).
 */
export function mirrorKeyPaths(specRoot: string): Map<string, string> {
  const files = walkTree(path.dirname(specRoot), [path.basename(specRoot)], {
    includeFile: (name) =>
      name.endsWith(".md") && SPEC_KEY_RE.test(name.slice(0, -".md".length)),
  });
  return new Map(files.map((f) => [path.basename(f.relPath, ".md"), f.absPath]));
}

/** `specRoot` 아래 미러 파일(`CLE-*.md`)의 키 집합. 폴더가 없으면 빈 집합이다. */
export function collectMirrorKeys(specRoot: string): Set<string> {
  return new Set(mirrorKeyPaths(specRoot).keys());
}

/** 키가 미러에 넣지 않는 영역(`UNMIRRORED_AREAS`)의 것인지. 영역 접두는 하이픈 경계로 맞춘다. */
export function isUnmirroredArea(key: string): boolean {
  return UNMIRRORED_AREAS.some((a) => key === a || key.startsWith(`${a}-`));
}

/** 키에 문제가 없으면 `null`, 있으면 그 이유. */
export function specKeyProblem(
  key: string,
  mirrorKeys: ReadonlySet<string>,
): string | null {
  if (key.startsWith("spec/")) {
    return "옛 스펙 경로다. NERV 키로 바꾼다(미러 frontmatter 의 source_paths 로 찾는다)";
  }
  if (!SPEC_KEY_RE.test(key)) return "NERV 스펙 키 모양이 아니다";
  if (mirrorKeys.has(key)) return null;
  if (isUnmirroredArea(key)) {
    return UNMIRRORED_GUIDE_KEYS.has(key)
      ? null
      : "미러에 넣지 않는 영역의 키다. NERV 에 있는지 확인하고 UNMIRRORED_GUIDE_KEYS 에 더한다";
  }
  return "미러에 없는 키다(미러 제외 영역이면 pull.py EXCLUDED_AREAS 와 UNMIRRORED_AREAS 를 함께 본다)";
}
