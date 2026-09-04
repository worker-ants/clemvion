/**
 * 감사 helper 의 `action` 이 **리소스에 묶인** 타입인지 강제한다.
 *
 * ## 왜 이 가드인가 — 팩토리 추출을 대신한다
 *
 * `plan/in-progress/spec-sync-auth-gaps.md` 에 "`recordAudit` 공통 팩토리 추출" 항목이 있었다.
 * 다섯 helper 를 전부 읽어 그 plan 의 근거를 실측했고, **plan 이 옳았다** — 공통분모가
 * `resourceType` 바인딩 + 필드 전달뿐이고 `details` 계약이 전부 다르다:
 *
 *   triggers      AuditActionFor<'trigger'>       type      → details {type}
 *   workflows     AuditActionFor<'workflow'>      details?  → passthrough
 *   schedules     AuditActionFor<'schedule'>      —         → details 없음
 *   model_config  AuditActionFor<'model_config'>  kind      → details {kind}
 *   auth_config   AuditAction  ← 묶이지 않음      ipAddress → details 없음
 *
 * **그런데 그 표가 plan 이 적지 않은 것을 드러냈다.** 넷은 리소스에 묶는데 `auth_config`
 * 만 맨 union 이었다. 판별 프로브로 실재를 확인했다 — 같은 코드를 두 곳에 넣고:
 *
 *   auth-configs 에 `action: 'trigger.created'`  → tsc **0 에러** (구멍)
 *   schedules   에 `action: 'trigger.created'`  → **TS2322** (대조군)
 *
 * 즉 `AuditActionFor` 는 정상 동작하고 구멍은 한 곳이었다. 그래서 처방을 바꿨다 —
 * **팩토리를 추출하면 그것을 쓰는 곳만 안전해지지만, 가드는 앞으로 생길 서비스도 잡는다.**
 * 얇은 공통분모를 억지로 뽑는 대신 그 공통분모가 **지켜지는지**를 검사한다.
 *
 * ## 무엇을 단언하지 않는가
 *
 * 액션 문자열의 **값**은 보지 않는다. 값으로 판정하면 액션이 추가될 때마다 가드를 고쳐야
 * 하고, 정작 "묶이지 않았다" 는 구조적 사실은 놓친다. 판정은 **형태**로 한다.
 */

import * as nodePath from 'node:path';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { toPosixRelative } from '../../common/__test-utils__/source-scan';

import {
  AUDIT_HELPER_NAMES,
  BOUND_TYPE_NAME,
  collectSourceFiles,
  findAuditHelpers,
  findMisboundHelpers,
  findUnboundHelpers,
} from './audit-action-binding-guard';
import {
  ARROW_FIELD_BARE_SOURCE,
  ARROW_FIELD_BOUND_SOURCE,
  BARE_UNION_SOURCE,
  BOUND_SOURCE,
  LOOKALIKE_TYPE_SOURCE,
  MATCHED_RESOURCE_SOURCE,
  MIXED_NOTATION_SOURCE,
  NO_ACTION_SOURCE,
  POSITIONAL_SOURCE,
  UNRELATED_METHOD_SOURCE,
  WRONG_RESOURCE_BOUND_SOURCE,
} from './audit-action-binding-fixture';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');

describe('감사 helper 의 action 은 리소스에 묶인 타입이어야 한다', () => {
  const files = collectSourceFiles(REPO_ROOT);
  const sites = files.flatMap((f) =>
    findAuditHelpers(
      fs.readFileSync(f, 'utf-8'),
      toPosixRelative(REPO_ROOT, f),
    ),
  );

  it('[전제] helper 를 실제로 찾았다 — 0건이면 아래 단언이 vacuous 하다', () => {
    // 메서드 이름 오탈자나 스캔 경로 실수가 "위반 0건" 으로 보이는 것을 막는다.
    expect(sites.length).toBeGreaterThanOrEqual(5);
  });

  it('[전제] 검사 이름 집합이 비어 있지 않다', () => {
    expect(AUDIT_HELPER_NAMES.size).toBeGreaterThan(0);
  });

  it('모든 helper 가 리소스에 묶여 있다', () => {
    const unbound = findUnboundHelpers(sites).map(
      (s) =>
        `${s.file}:${s.line} ${s.method} — action: ${s.actionType ?? '(없음)'}`,
    );
    // 맨 `AuditAction` 이면 다른 리소스의 액션을 이 resourceType 으로 기록해도
    // 컴파일러가 잡지 못한다. `AuditActionFor<...>` 로 묶을 것.
    expect(unbound).toEqual([]);
  });

  it('[전제] 바인딩 대상까지 실제로 해석됐다 — null 이면 아래 단언이 vacuous 하다', () => {
    // `findMisboundHelpers` 는 양쪽이 해석될 때만 판정한다. 정규화가 조용히 전부 `null` 을
    // 내면 "위반 0건" 이 되므로, 해석된 helper 가 실제로 있는지를 먼저 고정한다.
    const resolved = sites.filter(
      (s) => s.boundResource !== null && s.recordedResource !== null,
    );
    expect(resolved.length).toBeGreaterThanOrEqual(5);
  });

  it('모든 helper 가 **자기** 리소스에 묶여 있다', () => {
    const misbound = findMisboundHelpers(sites).map(
      (s) =>
        `${s.file}:${s.line} ${s.method} — bound=${String(s.boundResource)} recorded=${String(s.recordedResource)}`,
    );
    // "묶였는가" 는 이 가드가 지키려는 불변식보다 한 칸 좁다. `AuditActionFor<'workflow'>`
    // 로 선언하고 `resourceType: 'auth_config'` 를 기록해도 접두 검사는 통과한다.
    // 컴파일러는 이것을 호출부에서 잡지만(뮤턴트 → tsc 5건), 호출부가 아직 없는 helper 는
    // 그 그물에 걸리지 않는다. 여기서 선언 단계로 앞당긴다.
    expect(misbound).toEqual([]);
  });
});

describe('판정은 형태로 한다 — fixture', () => {
  const parse = (src: string) => findAuditHelpers(src, 'fixture.ts');

  it('리소스에 묶인 형태는 통과', () => {
    expect(findUnboundHelpers(parse(BOUND_SOURCE))).toEqual([]);
  });

  it.each([
    ['맨 union (auth-configs 에 실재했던 구멍)', BARE_UNION_SOURCE],
    ['action 프로퍼티 자체가 없음', NO_ACTION_SOURCE],
    ['positional 파라미터', POSITIONAL_SOURCE],
    ['이름만 비슷한 타입 (AuditActionOf)', LOOKALIKE_TYPE_SOURCE],
    ['화살표 함수 클래스 필드에 맨 union', ARROW_FIELD_BARE_SOURCE],
  ])('%s → 잡는다', (_label, src) => {
    expect(findUnboundHelpers(parse(src))).toHaveLength(1);
  });

  it('화살표 함수 필드라도 묶여 있으면 통과한다 (판정은 문법이 아니라 바인딩)', () => {
    expect(findUnboundHelpers(parse(ARROW_FIELD_BOUND_SOURCE))).toEqual([]);
  });

  it('묶였지만 엉뚱한 리소스면 잡는다', () => {
    const sites = parse(WRONG_RESOURCE_BOUND_SOURCE);
    // 접두 검사는 통과한다 — 그래서 별도 술어가 필요하다.
    expect(findUnboundHelpers(sites)).toEqual([]);
    expect(findMisboundHelpers(sites)).toHaveLength(1);
    expect(sites[0]).toMatchObject({
      boundResource: 'foo',
      recordedResource: 'bar',
    });
  });

  it('자기 리소스에 묶였으면 잡지 않는다 (대조군)', () => {
    expect(findMisboundHelpers(parse(MATCHED_RESOURCE_SOURCE))).toEqual([]);
  });

  it('표기만 다르고 값이 같으면 잡지 않는다 — 상수를 실제로 푼다', () => {
    const sites = parse(MIXED_NOTATION_SOURCE);
    // 문자열 표기로만 비교하면 `'foo'` vs `FOO_RESOURCE_TYPE` 이 거짓 경보가 된다.
    expect(sites[0]).toMatchObject({
      boundResource: 'foo',
      recordedResource: 'foo',
    });
    expect(findMisboundHelpers(sites)).toEqual([]);
  });

  it('화살표 함수 필드를 실제로 수집한다 — 종전에는 탐지 0건이었다', () => {
    // 이 단언이 없으면 "안 잡는다" 와 "잡았는데 묶여 있다" 가 구분되지 않는다.
    expect(parse(ARROW_FIELD_BOUND_SOURCE)).toHaveLength(1);
  });

  it('이름이 다른 메서드는 아예 수집하지 않는다', () => {
    expect(parse(UNRELATED_METHOD_SOURCE)).toEqual([]);
  });

  it('묶인 형태의 타입 문자열을 그대로 보고한다 (진단 가능성)', () => {
    const [site] = parse(BOUND_SOURCE);
    expect(site.actionType).toContain(BOUND_TYPE_NAME);
    expect(site.line).toBeGreaterThan(0);
  });
});

/**
 * ## 호출부의 인자 순서를 겨눈다 (리뷰 4R WARNING#1)
 *
 * 위 `sites` 는 `toPosixRelative(REPO_ROOT, f)` 로 `fileLabel` 을 만드는데, 저장소 단언이
 * 전부 `toEqual([])`(위반 0건) 이라 **그 값이 관측되는 자리가 없었다** — 리뷰어가 인자
 * 순서 뮤턴트를 심어 18/18 GREEN 임을 실측했다.
 *
 * 같은 함수를 같은 인자로 다시 부르면 tautology 가 되므로, **되짚기 불변식**을 쓴다:
 * 올바른 순서라면 `resolve(REPO_ROOT, .file)` 이 원본 절대 경로로 돌아온다.
 */
describe('[대조군] AuditHelperSite.file 이 REPO_ROOT 기준 상대경로인가', () => {
  it('되짚으면 원본 절대 경로가 나온다', () => {
    const scanned = collectSourceFiles(REPO_ROOT);
    const withHelper = scanned.find(
      (f) => findAuditHelpers(fs.readFileSync(f, 'utf-8'), 'x').length > 0,
    );
    expect(withHelper).toBeDefined();
    const [site] = findAuditHelpers(
      fs.readFileSync(withHelper as string, 'utf-8'),
      toPosixRelative(REPO_ROOT, withHelper as string),
    );
    expect(nodePath.resolve(REPO_ROOT, site.file)).toBe(withHelper);
    expect(site.file).not.toContain('\\');
  });
});
