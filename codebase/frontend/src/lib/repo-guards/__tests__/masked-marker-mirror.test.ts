import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  findMirrorRedeclarations,
  findRedeclaredSymbols,
  listSourceFiles,
  ROOT,
  SCAN_DIRS,
  SOT_SYMBOLS,
} from "./masked-marker-mirror-guard";

/**
 * **마커 SoT 의 미러가 되살아나지 않는다.**
 *
 * 마커 집합(`'***'`·`'[REDACTED]'`·`'[REDACTED_DEPTH]'`)과 깊이 상한은 backend 가 만들고
 * frontend 가 판정하는 값이라 **양쪽이 같은 것을 봐야** 보장이 성립한다. 예전엔 두 스택에
 * 손으로 복제돼 있었고, 한쪽만 늘면 다른 쪽이 그 신규 마커에 대해 **조용히 fail-open**
 * 했다 — 마스킹된 값이 다시 프리필돼 실제 입력이 되는, 이 시리즈가 두 번 겪은 형태다.
 *
 * 미러를 기계가 대조하게 만들려다 **CI 경로 게이팅**에 막혔다: `frontend-checks` 는
 * `codebase/backend/**` 변경 때 검사를 생략하고 `backend-checks` 는 반대쪽을 생략한다.
 * 한쪽에 둔 계약 가드는 **반대쪽이 마커를 바꾸는 방향에 무력**하다. 그래서 값 자체를
 * `@workflow/masked-markers` 로 옮겼고 — 두 워크플로 모두 `codebase/packages/**` 는
 * relevant 로 잡는다 — 이 가드는 그 이관이 **되돌려지지 않는지**만 지킨다.
 *
 * > 이 가드가 `frontend/` 에 사는 것은 형제 가드(`internal-package-registration`,
 * > `typescript-toolchain`)와 같은 이유다. 그 배치의 경로 갭은 여기서 문제가 되지 않는다 —
 * > 지키는 대상이 "값이 일치하는가" 가 아니라 "재선언이 생겼는가" 이고, 재선언은 그 파일을
 * > 바꾼 PR 에서만 생기기 때문이다. **값 일치는 이제 가드가 아니라 타입 시스템이 보장한다.**
 */
describe("마커 SoT 미러 재발 가드", () => {
  it("SoT 패키지 밖에서 마커 심볼을 재선언하지 않는다", () => {
    // 어느 파일이 어느 심볼을 재선언했는지 단언 메시지에 드러나야 진단이 된다.
    expect(findMirrorRedeclarations(ROOT)).toEqual([]);
  });

  /**
   * **먼저 vacuous 방지.** 스캔 디렉터리 경로가 틀리면 파일 목록이 비고, 위 단언은
   * **무엇도 검사하지 않고 통과**한다. 이 저장소가 반복해 겪은 형태라 하한을 못박는다.
   */
  it("[캐너리] 스캔 대상 파일 목록이 비어 있지 않다", () => {
    const counts = SCAN_DIRS.map(
      (rel) => listSourceFiles(path.join(ROOT, rel)).length,
    );
    // backend·frontend 는 각각 수백 개다. web-chat 은 작지만 0 이면 경로가 틀린 것.
    for (const n of counts) expect(n).toBeGreaterThan(0);
    expect(counts.reduce((a, b) => a + b, 0)).toBeGreaterThan(500);
  });

  /**
   * **가드가 실제로 탐지하는가.** 앞의 단언은 *"재선언이 없다"* 만 확인하므로, 스캐너가
   * 조용히 아무것도 못 보게 돼도 GREEN 이다 — 형제 가드에서 실제로 겪은 실패다.
   */
  it("[캐너리] 실제 재선언을 지목한다 (합성 fixture)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "marker-mirror-"));
    try {
      const dir = path.join(tmp, "codebase", "backend", "src");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, "mirror.ts"),
        'export const MASKED_MARKERS = ["***"];\n',
        "utf8",
      );
      fs.writeFileSync(
        path.join(dir, "clean.ts"),
        'export { MASKED_MARKERS } from "@workflow/masked-markers";\n',
        "utf8",
      );
      expect(findMirrorRedeclarations(tmp)).toEqual([
        { file: "codebase/backend/src/mirror.ts", symbol: "MASKED_MARKERS" },
      ]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it.each(SOT_SYMBOLS.map((s) => [s]))(
    "[캐너리] %s 의 재선언을 탐지한다",
    (symbol) => {
      expect(findRedeclaredSymbols(`const ${symbol} = 1;`)).toEqual([symbol]);
    },
  );

  /**
   * **정상 형태를 오탐하지 않는다.** 이관 후 두 스택이 실제로 쓰는 모양들이다 — 여기서
   * 오탐이 나면 올바른 코드가 RED 를 내고, 그러면 가드가 약화되거나 무시된다.
   */
  it.each([
    ["재export", 'export { MASKED_MARKERS } from "@workflow/masked-markers";'],
    [
      "import 후 재export",
      'import { isMaskedMarker } from "@workflow/masked-markers";\nexport { isMaskedMarker };',
    ],
    [
      "지역 별칭",
      'import { MAX_MASK_DEPTH } from "@workflow/masked-markers";\nexport const MAX_REDACT_DEPTH = MAX_MASK_DEPTH;',
    ],
    ["주석 속 언급", "// MASKED_MARKERS 를 여기서 다시 만들지 말 것"],
    ["문자열 속 언급", 'const doc = "MASKED_MARKERS";'],
    ["무관한 마커 리터럴", 'const REDACTED = "[REDACTED]";'],
  ])("[캐너리] %s 는 재선언이 아니다", (_kind, source) => {
    expect(findRedeclaredSymbols(source)).toEqual([]);
  });
});
