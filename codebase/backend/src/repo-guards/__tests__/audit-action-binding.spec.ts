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

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  AUDIT_HELPER_NAMES,
  BOUND_TYPE_NAME,
  collectSourceFiles,
  findAuditHelpers,
  findUnboundHelpers,
} from './audit-action-binding-guard';
import {
  ARROW_FIELD_BARE_SOURCE,
  ARROW_FIELD_BOUND_SOURCE,
  BARE_UNION_SOURCE,
  BOUND_SOURCE,
  LOOKALIKE_TYPE_SOURCE,
  NO_ACTION_SOURCE,
  POSITIONAL_SOURCE,
  UNRELATED_METHOD_SOURCE,
} from './audit-action-binding-fixture';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');

describe('감사 helper 의 action 은 리소스에 묶인 타입이어야 한다', () => {
  const files = collectSourceFiles(REPO_ROOT);
  const sites = files.flatMap((f) =>
    findAuditHelpers(fs.readFileSync(f, 'utf-8'), path.relative(REPO_ROOT, f)),
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
