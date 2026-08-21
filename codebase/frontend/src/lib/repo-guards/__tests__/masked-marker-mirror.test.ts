import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  findMirrorRedeclarations,
  findRedeclaredSymbols,
  listSourceFiles,
  ROOT,
  resolveScanDirs,
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
 * ## backend 에 같은 가드가 하나 더 있다 (`11_27_29` architecture W1)
 *
 * 초판은 이 파일 하나였고, 헤더에 *"재선언은 그 파일을 바꾼 PR 에서만 생기니 경로 갭이
 * 문제되지 않는다"* 고 적어 뒀다. **그 문장이 거짓이었다.** backend-only PR 이 마커를
 * 재선언하면 `frontend-checks` 가 통째로 skip 되므로 이 가드는 **아예 실행되지 않는다** —
 * 이 PR 이 없애려던 바로 그 경로 게이팅을 가드 배치로 재도입한 것이었다.
 *
 * 그래서 `backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` 에 사본을 두고,
 * 둘 다 저장소 전체를 훑는다 — 어느 쪽이 바뀌든 최소 하나는 자기 워크플로에서 실행된다.
 * 값의 미러와 달리 **탐지 로직의 중복은 구멍을 만들지 않는다**: 한 사본이 낡아도 다른
 * 사본이 같은 불변식을 자기 트리거에서 계속 지킨다.
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
    const dirs = resolveScanDirs(ROOT);
    expect(dirs.length).toBeGreaterThanOrEqual(3);
    const counts = dirs.map(
      (rel) => listSourceFiles(path.join(ROOT, rel)).length,
    );
    // backend·frontend 는 각각 수백 개다. web-chat 은 작지만 0 이면 경로가 틀린 것.
    for (const n of counts) expect(n).toBeGreaterThan(0);
    expect(counts.reduce((a, b) => a + b, 0)).toBeGreaterThan(500);
  });


  /**
   * **파생이 새 vacuous 경로를 만든다.** `SOT_SYMBOLS` 를 패키지 export 에서 뽑는 순간,
   * import 가 비면(`{}`) 목록이 `[]` 가 되고 `findRedeclaredSymbols` 는 **무엇도 잡지 않으며**
   * 주 단언이 조용히 통과한다. 손 목록의 미러 위험을 없앤 대가로 생긴 표면이라 함께 막는다.
   */
  it("[캐너리] SoT 심볼 파생이 비지 않는다", () => {
    expect(SOT_SYMBOLS.length).toBeGreaterThanOrEqual(6);
    for (const required of [
      "MASKED_MARKERS",
      "isMaskedMarker",
      "MAX_MASK_DEPTH",
    ]) {
      expect(SOT_SYMBOLS).toContain(required);
    }
  });


  /**
   * **스캔 범위가 "전수처럼 보이지만 아닌" 상태가 되지 않게 한다** (`12_25_15` W1).
   *
   * 초판 파생은 `codebase/` 를 한 단계만 훑어 워크스페이스 패키지 7개의 `src` 가 통째로
   * 빠졌다. 그런데 당시 캐너리는 `dirs.length >= 3` 이라 **그 좁은 목록도 그대로 통과**시켰다
   * — 하한만 보는 단언은 누락을 못 본다. 형제 패키지가 실제로 들어오는지 **직접** 묻는다.
   */
  it("[캐너리] 워크스페이스 패키지의 src 도 스캔 대상이다", () => {
    const dirs = resolveScanDirs(ROOT);
    expect(dirs).toContain("codebase/backend/src");
    expect(dirs).toContain("codebase/frontend/src");
    // SoT 가 아닌 형제 패키지 — 여기서 마커 심볼을 재선언해도 잡혀야 한다.
    expect(dirs).toContain("codebase/packages/ai-end-reason/src");
    // SoT 패키지 자신은 스캔 대상에 **있고**, 재선언 판정에서만 제외된다.
    expect(dirs).toContain("codebase/packages/masked-markers/src");
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
    ["접두가 겹치는 다른 식별자", "const MAX_MASK_DEPTH_OLD = 8;"],
  ])("[캐너리] %s 는 재선언이 아니다", (_kind, source) => {
    expect(findRedeclaredSymbols(source)).toEqual([]);
  });
});
