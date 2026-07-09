import fs from "node:fs";
import path from "node:path";

/**
 * raw-href guard 테스트(`no-raw-execution-href`·`no-raw-editor-href`)의 공통 스캐닝 골격.
 *
 * 각 guard 는 자신의 regex + exemption 판정만 유지하고, 소스 트리 수집·스캔·offender 매핑은 이
 * 헬퍼를 공유한다. (테스트 지원 파일이라 `__tests__/` 에 두며, 스캐너는 `__tests__` 를 건너뛰므로
 * 이 파일 자신은 스캔 대상이 아니다.)
 */

// `__dirname` = `…/src/lib/workspace/__tests__` → 상위 3 = `…/src`.
export const SRC = path.join(__dirname, "..", "..", "..");

/** `src/**` 의 `.ts`/`.tsx`(테스트 제외) 파일 절대경로 목록. `__tests__`·`node_modules` 는 스킵. */
export function collectSourceFiles(dir: string = SRC, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      collectSourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * `re` 에 매칭되는 raw 리터럴을 가진 소스 파일(예외 제외)의 `src` 상대경로 목록.
 * offender 가 없으면 `[]`.
 */
export function findRawHrefOffenders(
  re: RegExp,
  isExempt: (file: string) => boolean,
): string[] {
  return collectSourceFiles()
    .filter((f) => !isExempt(f))
    .filter((f) => re.test(fs.readFileSync(f, "utf8")))
    .map((f) => path.relative(SRC, f));
}
