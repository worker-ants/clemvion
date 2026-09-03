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
  collectTsFiles,
  countNullAsUnknownAsCasts,
  hasNullAsUnknownAsCast,
} from '../../common/__test-utils__/source-scan';
import {
  collectScanTargets,
  findCastOffenders,
  findStaleSpecCasts,
  findUntypedNullableColumns,
  SRC_ROOT,
  widenedEntityFields,
} from './nullable-type-lie-cast-guard';

/**
 * tmpdir 픽스처. **실제 소스를 변형하지 않는다.**
 *
 * 처음엔 실제 `users.service.ts`·`user.entity.ts` 를 `writeFileSync` 로 변형했다가
 * 복원했다. 두 가지가 잘못됐다: (a) 복원이 실패하면 **서비스 파일이 변조된 채 남고**,
 * (b) `eslint --fix` 가 데코레이터를 여러 줄로 바꾸자 `.replace()` 가 **조용히 no-op** 이
 * 돼 전체 스위트에서만 실패했다 — **무효 뮤턴트**다.
 *
 * > 종전에는 단일 파일용 `withFixture` 와 다중 파일용 `withFiles` 가 **따로** 있었다.
 * > 골격(`mkdtempSync`→write→`try/finally` rmSync)이 같은데, **사본 5개를 없애는 diff
 * > 안에서 새 사본을 만든 것**이었다(리뷰 W3). 하나로 합치고 단일 파일은 얇은 래퍼로 둔다.
 */
function withFiles<T>(
  files: Record<string, string>,
  fn: (paths: Record<string, string>) => T,
): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nullable-guard-'));
  const paths: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.writeFileSync(full, content);
    paths[name] = full;
  }
  try {
    return fn(paths);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** 파일 하나짜리 픽스처 — {@link withFiles} 의 얇은 래퍼. */
function withFixture<T>(content: string, fn: (file: string) => T): T {
  return withFiles({ 'probe.entity.ts': content }, (paths) =>
    fn(paths['probe.entity.ts']),
  );
}

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
    // 구현은 모듈 스코프의 `withFiles` — 단일 파일 호출은 그 얇은 래퍼다.

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

/**
 * ## 넓혀진 필드를 겨눈 `.spec.ts` 의 낡은 캐스트
 *
 * 위 `findCastOffenders` 는 `.spec.ts` 를 **의도적으로 제외**한다 — fixture 가 부분 객체를
 * 캐스트하는 것은 정당하다. 그런데 필드가 `| null` 로 넓혀지면 **그 필드에 대한 캐스트만은**
 * 불필요해지는데, spec 을 안 보므로 구조적으로 못 잡는다.
 *
 * 배치 1~3 에서 이 잔재를 **손으로** 찾았고, 세 번째에는 훑는 대상을 *그 배치가 넓힌 필드*
 * 로만 잡아 앞 배치가 남긴 것을 놓쳤다(`auth.service.spec.ts` 의 `lockedUntil`). 사람이
 * 매번 대상 집합을 다시 정할 일이 아니다.
 */
describe('넓혀진 필드를 겨눈 낡은 spec 캐스트', () => {
  const ENTITY = `
@Entity('probe')
export class Probe {
  @Column({ type: 'timestamptz', nullable: true })
  widenedAt: Date | null;

  @Column({ type: 'varchar' })
  notWidened: string;

  @ManyToOne(() => Probe, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Probe | null;
}
`;

  it('넓혀진 필드명을 전수로 뽑는다 — 관계(@ManyToOne + @JoinColumn)도 포함', () => {
    withFiles({ 'probe.entity.ts': ENTITY }, (p) => {
      const w = widenedEntityFields([p['probe.entity.ts']]);
      expect([...w].sort()).toEqual(['parent', 'widenedAt']);
    });
  });

  /**
   * `includes('| null')` 로 판정하면 아래 두 표기를 **놓친다**(위음성). 조용한 누락을
   * 막겠다는 이 가드의 존재 이유와 정면으로 어긋나므로 표기 형태에 기대지 않는다.
   * 저장소는 전부 `T | null` 이라(2026-09-04 실측) 이 테스트가 유일한 방어다
   * (리뷰 3R INFO#4).
   */
  it.each([
    ['공백 없음', 'Date|null'],
    ['순서 반대', 'null | Date'],
    ['표준 표기', 'Date | null'],
  ])('`| null` 표기 변형을 모두 nullable 로 본다 — %s', (_label, tsType) => {
    withFiles(
      {
        'probe.entity.ts': `
@Entity('probe')
export class Probe {
  @Column({ type: 'timestamptz', nullable: true })
  oddlyTyped: ${tsType};
}
`,
      },
      (p) => {
        expect(
          widenedEntityFields([p['probe.entity.ts']]).has('oddlyTyped'),
        ).toBe(true);
      },
    );
  });

  it('넓혀진 필드를 겨눈 캐스트를 잡는다', () => {
    withFiles(
      {
        'probe.entity.ts': ENTITY,
        'probe.spec.ts': `const f = { widenedAt: null as unknown as Date };\n`,
      },
      (p) => {
        const w = widenedEntityFields([p['probe.entity.ts']]);
        const found = findStaleSpecCasts([p['probe.spec.ts']], w);
        expect(found).toHaveLength(1);
        expect(found[0].field).toBe('widenedAt');
      },
    );
  });

  it('[대조군] 넓혀지지 않은 필드의 캐스트는 잡지 않는다 — 그건 정당한 fixture 다', () => {
    withFiles(
      {
        'probe.entity.ts': ENTITY,
        'probe.spec.ts': `const f = { notWidened: null as unknown as string };\n`,
      },
      (p) => {
        const w = widenedEntityFields([p['probe.entity.ts']]);
        expect(findStaleSpecCasts([p['probe.spec.ts']], w)).toHaveLength(0);
      },
    );
  });

  it('관계 필드를 겨눈 캐스트도 잡는다', () => {
    withFiles(
      {
        'probe.entity.ts': ENTITY,
        'probe.spec.ts': `const f = { parent: null as unknown as Probe };\n`,
      },
      (p) => {
        const w = widenedEntityFields([p['probe.entity.ts']]);
        expect(findStaleSpecCasts([p['probe.spec.ts']], w)).toHaveLength(1);
      },
    );
  });

  /**
   * ## 이름 충돌 — 이 가드가 실제로 밟았던 오탐
   *
   * 판정 단위가 **필드 이름**이라, 한 엔티티는 nullable 이고 다른 엔티티는 non-null 인
   * 동명 필드가 있으면 non-null 쪽의 **정당한** 캐스트를 잡는다. 저장소에 그런 충돌이
   * 실재한다(`userId`·`workflowId`·`triggerId` 등). 개수는 적지 않는다 — 낡는다.
   *
   * 초판은 이 반례를 못 본 채 docstring 에 "왜 오탐이 없나" 를 적었다 — 자매 축(DTO 필드명
   * 매칭)에서 같은 실패 모드를 바로 앞 PR 에 반증해 놓고 그대로 재도입한 것이다(리뷰 2R W1).
   */
  it('[대조군] 다른 엔티티에서 non-null 인 동명 필드는 판정에서 뺀다', () => {
    withFiles(
      {
        'a.entity.ts': `
@Entity('a')
export class A {
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;
}
`,
        'b.entity.ts': `
@Entity('b')
export class B {
  @Column({ type: 'uuid' })
  userId: string;
}
`,
        // B.userId 는 non-null 이므로 이 캐스트는 **정당하다**.
        'b.spec.ts': `const f: Partial<B> = { userId: null as unknown as string };\n`,
      },
      (p) => {
        const w = widenedEntityFields([p['a.entity.ts'], p['b.entity.ts']]);
        expect(w.has('userId')).toBe(false);
        expect(findStaleSpecCasts([p['b.spec.ts']], w)).toHaveLength(0);
      },
    );
  });

  it('충돌이 없으면 그대로 잡는다 — 건전성을 얻느라 전부 잃지는 않았다', () => {
    withFiles(
      {
        'a.entity.ts': `
@Entity('a')
export class A {
  @Column({ type: 'timestamptz', nullable: true })
  onlyHereAt: Date | null;
}
`,
        'a.spec.ts': `const f = { onlyHereAt: null as unknown as Date };\n`,
      },
      (p) => {
        const w = widenedEntityFields([p['a.entity.ts']]);
        expect(w.has('onlyHereAt')).toBe(true);
        expect(findStaleSpecCasts([p['a.spec.ts']], w)).toHaveLength(1);
      },
    );
  });

  it('주석 속 캐스트 인용은 잡지 않는다 — 고칠 것이 없는 파일이 영구 RED 가 된다', () => {
    withFiles(
      {
        'probe.entity.ts': ENTITY,
        'probe.spec.ts':
          `// 종전엔 widenedAt: null as unknown as Date 였다\n` +
          `/* widenedAt: null as unknown as Date */\n` +
          `const f = { widenedAt: null };\n`,
      },
      (p) => {
        const w = widenedEntityFields([p['probe.entity.ts']]);
        expect(findStaleSpecCasts([p['probe.spec.ts']], w)).toHaveLength(0);
      },
    );
  });

  it('`undefined as unknown as` 도 같은 잔재다', () => {
    withFiles(
      {
        'probe.entity.ts': ENTITY,
        'probe.spec.ts': `const f = { widenedAt: undefined as unknown as Date };\n`,
      },
      (p) => {
        const w = widenedEntityFields([p['probe.entity.ts']]);
        expect(findStaleSpecCasts([p['probe.spec.ts']], w)).toHaveLength(1);
      },
    );
  });

  describe('저장소 전수', () => {
    const entities = collectTsFiles(SRC_ROOT).filter((f) =>
      f.endsWith('.entity.ts'),
    );
    const specs = collectTsFiles(SRC_ROOT, { includeSpec: true }).filter((f) =>
      f.endsWith('.spec.ts'),
    );

    it('[전제] 엔티티·spec 대상이 비어 있지 않다 — 비면 아래가 공허하다', () => {
      expect(entities.length).toBeGreaterThan(30);
      expect(specs.length).toBeGreaterThan(300);
    });

    it('[전제] 넓혀진 필드가 실제로 있다', () => {
      expect(widenedEntityFields(entities).size).toBeGreaterThan(100);
    });

    it('낡은 캐스트가 남아 있지 않다', () => {
      const offenders = findStaleSpecCasts(
        specs,
        widenedEntityFields(entities),
      );
      expect(offenders.map((o) => `${o.file} :: ${o.field}`).sort()).toEqual(
        [],
      );
    });
  });
});
