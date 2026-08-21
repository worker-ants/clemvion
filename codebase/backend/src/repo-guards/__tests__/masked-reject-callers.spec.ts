import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  ALLOWED_DIRECT_CALLERS,
  findUnexpectedCallers,
  importsBaseFn,
} from './masked-reject-callers-guard';

/**
 * **Manual 실행 경로가 마커 거부를 건너뛰지 못하게 한다** (EIA §R17, `01_38_26` architecture W1).
 *
 * `resolveTriggerParameters`(base)와 `resolveTriggerParametersRejectingMasked`(wrapper)가 같은
 * `utils/` 폴더에 유사한 이름으로 나란히 있다. **어느 호출부가 어느 쪽을 써야 하는가** 는
 * 지금 JSDoc 으로만 강제된다 — 세 번째 Manual 경로가 생겼을 때 base 를 import 하면
 * 마커 재제출이 조용히 통과한다.
 *
 * > **주석은 규칙을 강제하지 못한다.** 이 시리즈에서 반복해 확인한 것이고(자매 중 하나만
 * > 고치는 형태가 네 번 나왔다), 재발이 멎은 지점은 늘 **행위 규칙이 아니라 산출물**이었다.
 * > 이 가드가 그 산출물이다 — 허용목록 밖에서 base 를 쓰면 여기가 RED 다.
 *
 * 새 파일이 걸리면 판단이 필요하다:
 * - **Manual 실행 경로**(사용자가 값을 저작) → wrapper 를 쓴다. 목록에 넣지 않는다.
 * - **외부 시스템이 저작하는 페이로드**(webhook·schedule 류) → 목록에 추가하고 **사유를
 *   같은 커밋에 적는다**.
 */
describe('resolveTriggerParameters 직접 호출부 허용목록', () => {
  const repoRoot = path.resolve(__dirname, '../../../../..');
  const srcDir = path.resolve(__dirname, '../..');

  it('허용목록 밖에서 base 함수를 직접 쓰지 않는다', () => {
    expect(findUnexpectedCallers(repoRoot, srcDir)).toEqual([]);
  });

  /**
   * 허용목록이 **실재하는 파일**을 가리키는지 — 파일이 옮겨지거나 지워지면 목록이 죽은
   * 문자열이 되고, 그때 가드는 조용히 아무것도 안 지킨다.
   */
  it('[캐너리] 허용목록 항목이 전부 실제 스캔에 잡힌다 (죽은 항목 없음)', () => {
    // 허용목록의 모든 항목은 **실재하고** base 를 실제로 import 해야 한다.
    // 어느 항목이 죽었는지 단언 메시지에 드러나야 진단이 된다 — boolean 단언은 파일 이름을
    // 숨긴다.
    const dead = ALLOWED_DIRECT_CALLERS.filter((rel) => {
      const abs = path.join(repoRoot, rel);
      if (!fs.existsSync(abs)) return true;
      return !importsBaseFn(fs.readFileSync(abs, 'utf8'));
    });
    expect(dead).toEqual([]);
  });

  /**
   * **가드가 실제 위반을 탐지하는가** (`02_04_38` testing W2).
   *
   * 앞의 두 테스트는 *"위반이 없다"* 만 확인한다 — 리뷰어가 `findUnexpectedCallers` 의 제외
   * 필터를 `.filter(() => false)` 로 무력화했더니 **3개 전부 GREEN 이었다**. 즉 가드가
   * 탐지를 멈춰도 아무도 모른다. 지키려는 것이 보안 불변식인데 그 가드 자체가 무보증이면
   * 없느니만 못하다(있다고 믿게 만든다).
   *
   * 임시 디렉터리에 **진짜 위반 파일**을 만들어, 가드가 그 파일을 정확히 지목하는지 본다.
   */
  it('[캐너리] 허용목록 밖 위반을 실제로 탐지한다 (합성 fixture)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'masked-guard-'));
    try {
      const offender = path.join(tmp, 'offending-manual-path.ts');
      fs.writeFileSync(
        offender,
        "import { resolveTriggerParameters } from './x';\nexport const y = resolveTriggerParameters;\n",
        'utf8',
      );
      // 위반 없는 대조군 — wrapper 만 쓴다.
      fs.writeFileSync(
        path.join(tmp, 'clean-manual-path.ts'),
        "import { resolveTriggerParametersRejectingMasked } from './x';\nexport const z = resolveTriggerParametersRejectingMasked;\n",
        'utf8',
      );

      // repoRoot 를 tmp 로 주면 상대경로가 파일명만 남아 허용목록과 겹치지 않는다.
      expect(findUnexpectedCallers(tmp, tmp)).toEqual([
        'offending-manual-path.ts',
      ]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  /**
   * **접두 겹침 오탐 방지** — wrapper 이름이 base 이름으로 시작하므로, 단순 substring 매칭은
   * wrapper 만 쓰는 파일을 base 사용으로 오인한다. 그러면 Manual 경로가 올바로 wrapper 를
   * 써도 가드가 RED 를 내 가드 자체가 무시된다.
   */
  it('[캐너리] wrapper 만 쓰는 소스를 base 사용으로 오인하지 않는다', () => {
    expect(
      importsBaseFn(
        "import { resolveTriggerParametersRejectingMasked } from './x';",
      ),
    ).toBe(false);
    expect(
      importsBaseFn("import { resolveTriggerParameters } from './x';"),
    ).toBe(true);
  });

  /**
   * **우회 형태를 전부 본다** (`02_49_22` → `03_14_16` security W1).
   *
   * 초판은 named import 만 봤고, 라운드마다 우회 형태를 하나씩 덧대 왔다. 그때마다
   * **무수정 프로브로 재면 새 형태가 조용히 통과**했다 — 새 Manual 경로가 그 형태로 base 를
   * 쓰면 마커 재제출이 다시 열린다. 우회 가능한 가드는 없느니만 못하다(있다고 믿게 만든다).
   *
   * `03_14_16` 에서 네 번째로 같은 클래스가 나와 **정규식을 버리고 AST 로 갔다**. 아래
   * 일곱 형태는 그 전환의 회귀 고정이다 — 뒤 셋(`dynamic-import`·`bracket`·`colon-rename`)이
   * 정규식 시절 미탐지였던 것들이다.
   *
   * 형태별로 단언을 나눠 **어느 형태가 깨졌는지**가 실패 메시지에 드러나게 한다.
   */
  it.each([
    ['named', "import { resolveTriggerParameters } from './x';"],
    ['named-as-rename', "import { resolveTriggerParameters as f } from './x';"],
    [
      'namespace',
      "import * as base from './resolve-trigger-parameters';\nbase.resolveTriggerParameters(s, r);",
    ],
    [
      'require',
      "const { resolveTriggerParameters } = require('./x') as never;",
    ],
    [
      'dynamic-import',
      "const { resolveTriggerParameters } = await import('./x');",
    ],
    [
      'bracket',
      "import * as base from './x';\nbase['resolveTriggerParameters'](s, r);",
    ],
    [
      'colon-rename',
      "const { resolveTriggerParameters: f } = require('./x') as never;",
    ],
  ])('[캐너리] %s 형태의 base 사용을 탐지한다', (_form, source) => {
    expect(importsBaseFn(source)).toBe(true);
  });

  /**
   * **주석·문자열은 식별자가 아니다** — AST 전환으로 `stripCommentsAndStrings` 보정 장치가
   * 사라졌으므로, 그 장치가 막던 오판(`02_04_38` W1: JSDoc 안의 import 예시 텍스트를 실제
   * import 로 오인)이 파서로 자연 해소됐는지 고정한다.
   */
  it.each([
    [
      '블록 주석 속 예시',
      "/** import { resolveTriggerParameters } from './x'; */",
    ],
    [
      '라인 주석 속 예시',
      "// const { resolveTriggerParameters } = require('./x');",
    ],
    ['평범한 문자열 리터럴', "const doc = 'resolveTriggerParameters';"],
  ])('[캐너리] %s 는 사용으로 오인하지 않는다', (_kind, source) => {
    expect(importsBaseFn(source)).toBe(false);
  });

  /** 그 확장이 wrapper 의 멤버 접근까지 잡으면 안 된다 — 접두 겹침이 여기도 걸린다. */
  it('[캐너리] namespace 경유 wrapper 접근은 오인하지 않는다', () => {
    expect(
      importsBaseFn(
        "import * as g from './reject-masked-resubmission';\ng.resolveTriggerParametersRejectingMasked(s, r);",
      ),
    ).toBe(false);
  });
});
