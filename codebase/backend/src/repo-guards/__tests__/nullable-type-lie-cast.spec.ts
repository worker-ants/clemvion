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
 * 이 축의 전수 목록·완료 이력: `plan/complete/entity-nullable-column-type-mismatch.md`
 * (33/33 파일로 종결). **다음 배치**는 그 plan 이 아니라
 * `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "§5.4 drift 배치" 다 —
 * 엔티티 컬럼 축은 닫혔고 남은 것은 DTO 선언 축이다.
 */

import { withFiles } from '../../common/__test-utils__/temp-fixture';
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
 * 단일 파일 픽스처 — 공유 헬퍼에 엔티티 파일명을 고정한 얇은 래퍼.
 *
 * 골격(`mkdtempSync`→write→`try/finally` rmSync)은
 * `common/__test-utils__/temp-fixture.ts` 에 있다. 종전엔 이 파일 안의 지역 함수였는데,
 * 두 번째 소비처(`swagger-dto-contract.spec.ts`)가 생기면서 옮겼다 — **사본 5개를 없앤
 * 직후에 새 사본을 만들지 않기 위해서다.**
 */
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

    /**
     * 자매 `widenedEntityFields` 의 `it.each` 와 **대칭**이다. 3R 에서 그쪽만
     * `isNullableType` 으로 하드닝하고 이쪽은 옛 `includes('| null')` 을 그대로 뒀는데
     * (리뷰 8R), **이쪽이 막는 것이 더 비싸다** — 놓치면 앱이 부팅을 못 한다
     * (`DataTypeNotSupportedError`, 배치 1 실제 사고).
     *
     * 두 함수가 다시 갈라지지 않게 하는 것은 판정 함수 공유가 아니라 **양쪽의 캐너리**다.
     */
    it.each([
      ['공백 없음', 'string|null'],
      ['순서 반대', 'null | string'],
      ['표준 표기', 'string | null'],
    ])(
      '`| null` 표기 변형에서도 `type:` 누락을 잡는다 — %s',
      (_label, tsType) => {
        withFixture(
          `@Column({ name: 'password_hash', nullable: true, length: 255 })\n  passwordHash: ${tsType};\n`,
          (file) => {
            expect(
              findUntypedNullableColumns([file]).map((f) => f.field),
            ).toEqual(['passwordHash']);
          },
        );
      },
    );

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

  /**
   * ## 관계 데코레이터끼리의 충돌 — 위 `@Column` 대조군과 대칭
   *
   * 충돌 배제는 **데코레이터 종류를 구분하지 않는다**(`WIDENED_DECL` 이 `@Column`·
   * `@ManyToOne`·`@OneToOne` 을 모두 잡고, 배제는 이름 단위로 한다). 그런데 대조군이
   * `@Column` 조합으로만 있어서 **관계끼리의 충돌은 고정돼 있지 않았다**(리뷰 10R INFO#12).
   *
   * 저장소에 그런 충돌이 **3건 실재**한다 — `integration`(`integration_oauth_state` nullable
   * ↔ `integration_usage_log` non-null) · `trigger`(`execution` ↔ `schedule`) ·
   * `user`(`login_history` ↔ `audit_log`) (2026-09-04 실측).
   *
   * > **코드는 이미 옳았다.** 착수 전 프로브로 셋 다 제외됨을 확인했다 — 없던 것은 캐너리
   * > 뿐이다. 그래서 이 테스트가 하는 일은 "고친 것을 지키는" 게 아니라 **이미 옳은 동작이
   * > 조용히 갈라지지 않게 고정하는** 것이다.
   */
  it('[대조군] 관계 데코레이터끼리의 동명 충돌도 판정에서 뺀다', () => {
    withFiles(
      {
        'a.entity.ts': `
@Entity('a')
export class A {
  @ManyToOne(() => Target, { nullable: true })
  @JoinColumn({ name: 'target_id' })
  target: Target | null;
}
`,
        'b.entity.ts': `
@Entity('b')
export class B {
  @ManyToOne(() => Target)
  @JoinColumn({ name: 'target_id' })
  target: Target;
}
`,
        // B.target 은 non-null 이므로 이 캐스트는 **정당하다**.
        'b.spec.ts': `const f: Partial<B> = { target: null as unknown as Target };\n`,
      },
      (p) => {
        const w = widenedEntityFields([p['a.entity.ts'], p['b.entity.ts']]);
        expect(w.has('target')).toBe(false);
        expect(findStaleSpecCasts([p['b.spec.ts']], w)).toHaveLength(0);
      },
    );
  });

  it('[대조군] `@Column` 과 관계가 섞인 충돌도 뺀다 — 종류를 구분하지 않는다', () => {
    withFiles(
      {
        'a.entity.ts': `
@Entity('a')
export class A {
  @ManyToOne(() => Target, { nullable: true })
  @JoinColumn({ name: 'mixed_id' })
  mixed: Target | null;
}
`,
        'b.entity.ts': `
@Entity('b')
export class B {
  @Column({ type: 'uuid' })
  mixed: string;
}
`,
        // B.mixed 는 non-null 이므로 이 캐스트는 **정당하다**.
        'b.spec.ts': `const f: Partial<B> = { mixed: null as unknown as string };\n`,
      },
      (p) => {
        const w = widenedEntityFields([p['a.entity.ts'], p['b.entity.ts']]);
        expect(w.has('mixed')).toBe(false);
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
    // `includeSpec: true` 결과는 안 준 것의 **상위집합**이라 한 번만 훑고 파생한다.
    // 두 번 부르면 저장소 트리를 통째로 두 번 걷는다(리뷰 9R W1).
    // 파생 전후 집합이 동일함을 실측했다 — entities 41 · specs 443, 양쪽 같음.
    const all = collectTsFiles(SRC_ROOT, { includeSpec: true });
    const entities = all.filter((f) => f.endsWith('.entity.ts'));
    const specs = all.filter((f) => f.endsWith('.spec.ts'));
    const widened = widenedEntityFields(entities);

    it('[전제] 엔티티·spec 대상이 비어 있지 않다 — 비면 아래가 공허하다', () => {
      expect(entities.length).toBeGreaterThan(30);
      expect(specs.length).toBeGreaterThan(300);
    });

    it('[전제] 넓혀진 필드가 실제로 있다', () => {
      expect(widened.size).toBeGreaterThan(100);
    });

    it('낡은 캐스트가 남아 있지 않다', () => {
      const offenders = findStaleSpecCasts(specs, widened);
      expect(offenders.map((o) => `${o.file} :: ${o.field}`).sort()).toEqual(
        [],
      );
    });
  });
});
