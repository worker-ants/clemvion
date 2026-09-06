import { describe, it, expect } from '@jest/globals';
import * as path from 'node:path';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import { SRC_ROOT, findUserRelationLoads } from './user-entity-exposure-guard';

/**
 * `User` 엔티티 전체가 응답에 실릴 수 있는 자리를 **양방향으로 조인다.**
 *
 * ## 왜 이 가드인가
 *
 * `GET /api/audit-logs` 가 `AuditLogUserDto` 는 3필드를 광고하면서 실제로는 `User` **26키**를
 * 내보냈다 — `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes` 와
 * 계정 탈취에 쓰이는 `passwordResetToken`·`emailVerifyToken`·`emailChangeToken` 이 전부.
 * 원인은 `leftJoinAndSelect('al.user', …)` 한 줄이었다.
 *
 * 그 자리는 고쳤지만 **`User` 자체에는 마지막 방어선이 없다** — 실측(2026-09-06):
 * `@Exclude()` 0건 · `@Expose()` 0건 · 전역 `ClassSerializerInterceptor` 0건 ·
 * 민감 7컬럼에 `select: false` 0건. 다음에 누가 `User` 를 통째로 싣는 쿼리를 쓰면 같은
 * 클래스가 그대로 재발한다.
 *
 * ## 왜 `select: false` 가 아닌가 (2026-09-06 실측 후 결정)
 *
 * 민감 7컬럼을 읽는 자리는 6개 서비스 파일의 **19곳**이고, 전부
 * `UsersService.findById`/`findByEmail` 이라는 **공유 깔때기**를 지난다. 그 깔때기의 호출
 * 지점은 저장소 전체에 **46곳**이다 — 깔때기에 `addSelect` 를 넣으면 46곳이 전부 컬럼을
 * 다시 받아 방어가 무의미해지고, 넣지 않으면 로더를 "비밀 포함/미포함" 으로 쪼개 19곳을
 * 재배선해야 한다. 하나라도 놓치면 `comparePassword(x, undefined)` 가 되어 **인증이 예외
 * 없이 조용히 실패**한다 (fail-safe 가 아니라 **fail-silent**).
 *
 * 전역 `ClassSerializerInterceptor` 도 택하지 않았다 — 이 저장소는 응답 직렬화를 한 번도
 * 켠 적이 없어(위 0건 실측) 도입 자체가 API 전체의 wire 를 건드린다.
 *
 * 그래서 **실행 시점에 막는 대신 구조가 생기는 순간 잡는다.** 이 가드는 유출의 *원인 형태*를
 * 겨눈다. 런타임 위험 0이고 인증 경로를 건드리지 않으며, 위 두 선택지를 나중에 배제하지도
 * 않는다.
 *
 * ## 무엇을 세는가
 *
 * `User` 를 **투영 없이 통째로** 싣는 두 형태 — `relations: [… 'user' …]` 와
 * `leftJoinAndSelect`/`innerJoinAndSelect`. `leftJoin` + `addSelect`(정상 형태)는 세지
 * 않는다.
 *
 * ## 베이스라인이 "0" 이 아닌 이유
 *
 * 아래 세 자리는 `User` 를 통째로 싣지만 **반환 전에 명시 투영**한다(전부 코드로 확인).
 * 로드 자체가 결함은 아니므로 지우지 않고 **동결**한다 — 새로 생기면 목록에 없어 실패하고,
 * 투영으로 바꿔 없애면 목록에서 빼야 통과한다. 양방향 래칫이다.
 */
const EXPECTED_USER_RELATION_LOADS: readonly string[] = [
  // `logout` — `stored.user` 에서 `id`·`email` 만 읽어 로그인 이력에 기록한다.
  'modules/auth/auth.service.ts#logout',
  // 리프레시 회전 — 같은 파일의 자매 경로. `stored.user` 를 이력 기록에만 쓴다.
  'modules/auth/auth.service.ts#refresh',
  // 멤버 목록 — `m.user?.email`·`m.user?.name` 만 뽑아 새 객체로 돌려준다.
  'modules/workspaces/workspaces.service.ts#listMembers',
];

describe('`User` 엔티티 전체 로드 래칫', () => {
  // 스캔 범위는 `src/modules` — 서비스가 전부 그 아래에 있고(실측), 그래야 아래
  // 양성 대조군 fixture(`repo-guards/__tests__/fixtures/`)가 베이스라인을 오염시키지 않는다.
  const loads = findUserRelationLoads(
    collectTsFiles(path.join(SRC_ROOT, 'modules')),
    SRC_ROOT,
  );

  it('알려진 목록과 정확히 일치한다 (새로 생겨도, 남몰래 줄어도 실패)', () => {
    expect(loads.map((l) => l.key).sort()).toEqual(
      [...EXPECTED_USER_RELATION_LOADS].sort(),
    );
  });

  it('[전제] 스캔이 비어 있지 않다 — 0건이면 위 단언이 조용히 통과한다', () => {
    expect(loads.length).toBeGreaterThan(0);
  });

  it('`leftJoinAndSelect` 로 `User` 를 싣는 자리는 하나도 없다', () => {
    // 감사 로그 유출이 정확히 이 형태였다. `relations` 축과 달리 **0을 유지**한다 —
    // 이 형태는 투영할 자리가 없어 언제나 전 컬럼을 싣기 때문이다.
    expect(loads.filter((l) => l.kind === 'joinAndSelect')).toEqual([]);
  });

  describe('[대조군] fixture 로 술어를 양쪽에서 확인한다', () => {
    const fixture = path.join(
      __dirname,
      'fixtures',
      'user-relation-load.fixture.ts',
    );
    const found = findUserRelationLoads([fixture], SRC_ROOT);

    it('위반 5형태를 전부 잡는다 (한 함수 안 두 번은 두 건으로)', () => {
      expect(found.map((f) => f.method).sort()).toEqual(
        [
          'violationRelationsUser',
          'violationNestedRelationPath',
          'violationLeftJoinAndSelect',
          'violationInnerJoinAndSelect',
          'violationTwiceInOneFunction',
          'violationTwiceInOneFunction',
        ].sort(),
      );
    });

    it('두 종류를 각각 잡는다 — 한 축만 물면 다른 축으로 샌다', () => {
      const kinds = found.map((f) => f.kind).sort();
      expect(kinds).toEqual(
        [
          'joinAndSelect',
          'joinAndSelect',
          'relations',
          'relations',
          'relations',
          'relations',
        ].sort(),
      );
    });

    it('한 함수 안의 두 번째 로드에 `#2` 가 붙어 키가 갈린다', () => {
      const keys = found
        .filter((f) => f.method === 'violationTwiceInOneFunction')
        .map((f) => f.key)
        .sort();
      // 접미 번호가 없으면 두 건이 한 키로 접혀, 하나를 지워도 베이스라인이 통과한다.
      expect(keys).toHaveLength(2);
      expect(keys[1]).toMatch(/#violationTwiceInOneFunction#2$/);
    });

    it('준수 3형태는 놓아 준다 — 투영 join · 다른 관계 · 접두어만 같은 이름', () => {
      const methods = found.map((f) => f.method);
      expect(methods).not.toContain('compliantProjectedJoin');
      expect(methods).not.toContain('compliantOtherRelation');
      expect(methods).not.toContain('compliantUserPrefixedRelation');
    });
  });
});
