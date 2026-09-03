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
import * as os from 'node:os';
import * as path from 'node:path';

import {
  countNullAsUnknownAsCasts,
  hasNullAsUnknownAsCast,
} from '../../common/__test-utils__/source-scan';
import {
  collectScanTargets,
  findCastOffenders,
  findUntypedNullableColumns,
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

  /**
   * 타입만 넓히면 **런타임이 깨진다** — TypeORM 이 `design:type` 으로 컬럼 타입을 추론하는데
   * `string | null` 은 `Object` 로 방출돼 부팅이 `DataTypeNotSupportedError` 로 죽는다.
   *
   * 2026-09-03 에 실제로 그렇게 깨뜨렸고 **lint·unit·build·`tsc` 가 전부 통과했다.**
   * 오직 e2e 만 잡았다 — 타입 검사로는 원리적으로 못 보는 자리다.
   */
  it('`| null` 컬럼은 @Column 에 type 을 명시한다 — 없으면 부팅이 죽는다', () => {
    expect(findUntypedNullableColumns(files)).toEqual([]);
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

    /**
     * 합성 fixture 를 쓴다 — 형제 가드(`masked-reject-callers.spec.ts`)의 관례다.
     *
     * 처음엔 실제 `users.service.ts`·`user.entity.ts` 를 `writeFileSync` 로 변형했다가
     * 복원했다. 두 가지가 잘못됐다: (a) 복원이 실패하면 **서비스 파일이 변조된 채 남고**
     * (리뷰 W1), (b) `eslint --fix` 가 데코레이터를 여러 줄로 바꾸자 `.replace()` 가
     * **조용히 no-op** 이 돼 전체 스위트에서만 실패했다 — **무효 뮤턴트**다.
     */
    function withFixture<T>(content: string, fn: (file: string) => T): T {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nullable-guard-'));
      const file = path.join(dir, 'probe.entity.ts');
      fs.writeFileSync(file, content);
      try {
        return fn(file);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }

    it('캐스트가 있는 파일을 offender 로 잡고, 없으면 통과한다', () => {
      withFixture('const a = null as unknown as Date;\n', (file) => {
        expect(findCastOffenders([file])).toHaveLength(1);
      });
      withFixture('const a = null;\n', (file) => {
        expect(findCastOffenders([file])).toEqual([]);
      });
    });

    it('type 없는 `| null` 컬럼을 잡는다 — 있으면 통과', () => {
      withFixture(
        "@Column({ name: 'password_hash', nullable: true, length: 255 })\n  passwordHash: string | null;\n",
        (file) => {
          expect(
            findUntypedNullableColumns([file]).map((f) => f.field),
          ).toEqual(['passwordHash']);
        },
      );
      withFixture(
        "@Column({ name: 'password_hash', type: 'varchar', nullable: true })\n  passwordHash: string | null;\n",
        (file) => {
          expect(findUntypedNullableColumns([file])).toEqual([]);
        },
      );
    });

    it('여러 줄 데코레이터도 잡는다 — prettier 가 실제로 이 형태로 바꾼다', () => {
      withFixture(
        "@Column({\n    name: 'password_hash',\n    nullable: true,\n    length: 255,\n  })\n  passwordHash: string | null;\n",
        (file) => {
          expect(
            findUntypedNullableColumns([file]).map((f) => f.field),
          ).toEqual(['passwordHash']);
        },
      );
    });

    it('[예외 경계] JoinColumn 이 같은 컬럼명이면 면제, 다르면 면제 안 된다', () => {
      withFixture(
        "@Column({ name: 'parent_id', nullable: true })\n  parentId: string | null;\n\n  @JoinColumn({ name: 'parent_id' })\n  parent: X | null;\n",
        (file) => {
          expect(findUntypedNullableColumns([file])).toEqual([]);
        },
      );
      withFixture(
        "@Column({ name: 'parent_id', nullable: true })\n  parentId: string | null;\n\n  @JoinColumn({ name: 'unrelated_col' })\n  other: X | null;\n",
        (file) => {
          expect(
            findUntypedNullableColumns([file]).map((f) => f.field),
          ).toEqual(['parentId']);
        },
      );
    });
  });
});
