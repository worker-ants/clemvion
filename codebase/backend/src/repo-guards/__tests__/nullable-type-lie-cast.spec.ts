/**
 * `null as unknown as X` 이중 캐스트가 프로덕션 소스에 없어야 한다.
 *
 * ## 왜 필요한가 — 어떤 게이트도 이 자리를 안 본다
 *
 * 엔티티 컬럼이 `nullable: true` 인데 TS 필드가 non-null 로 선언돼 있으면, `null` 을 대입하는
 * 코드가 컴파일러를 **두 단계로 우회**해야 한다. 그 캐스트는 "타입이 실제보다 좁다" 는
 * 기계적 증거다.
 *
 * backend typecheck ratchet 의 baseline 은 **`*.spec.ts` 만** 담는다 — 2026-09-03 실측으로
 * 37파일 중 비-spec 이 **0개**였다. 설계상 맞다(spec 은 build 가 exclude 하고 jest 가 타입을
 * strip 하므로 그 ratchet 말고는 아무도 못 본다). 그 결과 **프로덕션 소스의 타입 회피는
 * 무방비**였다.
 *
 * ## 이 가드가 `.claude/tests/` 가 아니라 여기 있는 이유
 *
 * 처음엔 harness 테스트로 썼다. 그런데 `harness-checks.yml` 의 `changes.pathspecs` 는
 * `codebase/backend/**` 를 **덮지 않는다** — 즉 backend 소스만 고친 PR 에서 그 워크플로가
 * 아예 안 돌아 **가드가 발화하지 못한다.** 스캔 대상이 있는 곳에서 돌아야 한다:
 * `backend-checks.yml` 이 `codebase/backend/**` 를 덮는다.
 *
 * 전수 목록·다음 배치 기준: `plan/in-progress/entity-nullable-column-type-mismatch.md`
 */

import * as fs from 'node:fs';

import {
  countNullAsUnknownAsCasts,
  hasNullAsUnknownAsCast,
} from '../../common/__test-utils__/source-scan';
import {
  collectScanTargets,
  findCastOffenders,
} from './nullable-type-lie-cast-guard';

describe('nullable 타입 거짓말이 강제하는 이중 캐스트', () => {
  const files = collectScanTargets();

  it('[전제] 스캔 대상이 비어 있지 않다 — 비면 아래 단언이 공허하다', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('[전제] 자기 자신은 스캔 대상이 아니다 — spec 은 제외된다', () => {
    expect(files.some((f) => f.endsWith('.spec.ts'))).toBe(false);
  });

  it('프로덕션 소스에 `null as unknown as` 가 없다', () => {
    const offenders = findCastOffenders(files);
    expect(offenders).toEqual([]);
  });

  describe('[대조군] 술어가 실제로 무는가', () => {
    it('캐스트가 있으면 잡는다', () => {
      expect(hasNullAsUnknownAsCast('a.b = null as unknown as Date;')).toBe(
        true,
      );
      expect(
        countNullAsUnknownAsCasts(
          'x: null as unknown as string, y: null as unknown as Date',
        ),
      ).toBe(2);
    });

    it('주석 안의 언급은 안 잡는다 — 저장소에 정리 이력 주석이 실재한다', () => {
      expect(
        hasNullAsUnknownAsCast('// 종전엔 null as unknown as Date 였다'),
      ).toBe(false);
      expect(hasNullAsUnknownAsCast('/* null as unknown as string */')).toBe(
        false,
      );
    });

    it('코드 뒤 인라인 주석은 잡는다 — 캐스트는 실제 코드다', () => {
      expect(
        hasNullAsUnknownAsCast('a = null as unknown as Date; // 되돌림'),
      ).toBe(true);
    });

    it('평범한 null 대입은 안 잡는다', () => {
      expect(hasNullAsUnknownAsCast('a.b = null;')).toBe(false);
    });
  });

  it('[대조군] 캐스트를 주입한 파일을 넣으면 offender 로 잡힌다', () => {
    const victim = files.find((f) => f.endsWith('users.service.ts'));
    expect(victim).toBeDefined();
    const original = fs.readFileSync(victim as string, 'utf8');
    try {
      fs.writeFileSync(
        victim as string,
        `${original}\n// eslint-disable-next-line\nconst __probe = null as unknown as Date;\n`,
      );
      expect(findCastOffenders([victim as string])).toHaveLength(1);
    } finally {
      fs.writeFileSync(victim as string, original);
    }
    // 원복 확인 — 실패해도 다음 테스트가 조용히 깨지지 않게 여기서 못박는다.
    expect(findCastOffenders([victim as string])).toEqual([]);
  });
});
