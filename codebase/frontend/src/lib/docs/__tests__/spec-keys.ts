import fs from "node:fs";
import path from "node:path";

// 사용자 가이드 프론트매터 `spec:` 의 NERV 스펙 키 검사 도우미.
//
// `spec:` 은 NERV 스펙 키 목록이다(CLE-UI-GUIDE 「프론트매터」, NERV 정본 전환 단계 4b).
// 키는 저장소 미러 파일 이름(`spec/<영역 키>/<KEY>.md`, 영역 밖 문서는 `spec/<KEY>.md`)으로
// 확인한다. 옛 트리 파일(`spec/<번호>-<영역>/…`)은 키 모양이 아니어서 섞이지 않는다.

export const SPEC_KEY_RE = /^CLE-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;

// 미러에 넣지 않는 영역(`.claude/tools/nerv-mirror/pull.py` 의 `EXCLUDED_AREAS`).
// 카탈로그는 저장소 `codebase/api-catalogs/` 가 정본이라 미러하지 않는다.
export const UNMIRRORED_AREAS: readonly string[] = ["CLE-C24", "CLE-MKS"];

// 가이드가 가리키는 키 가운데 미러에 없는 영역의 키. 미러 파일로 확인할 수 없어서
// 이름을 적어 둔다. 새 키를 더할 때는 NERV 에 그 문서가 있는지 확인하고 더한다.
export const UNMIRRORED_GUIDE_KEYS: ReadonlySet<string> = new Set([
  "CLE-C24-META",
  "CLE-MKS-META",
]);

/** `specRoot` 아래 미러 파일(`CLE-*.md`)의 키 집합. */
export function collectMirrorKeys(specRoot: string): Set<string> {
  const keys = new Set<string>();
  if (!fs.existsSync(specRoot)) return keys;
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const key = entry.name.slice(0, -".md".length);
        if (SPEC_KEY_RE.test(key)) keys.add(key);
      }
    }
  };
  walk(specRoot);
  return keys;
}

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
  return "미러에 없는 키다";
}
