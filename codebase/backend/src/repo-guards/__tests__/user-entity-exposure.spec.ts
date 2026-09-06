import { describe, it, expect } from '@jest/globals';
import * as path from 'node:path';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import {
  SRC_ROOT,
  collectUserRelationNames,
  findEagerUserRelations,
  findUserRelationLoads,
} from './user-entity-exposure-guard';

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
 * 민감 7컬럼에 `select: false` 0건.
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
 * 그래서 **실행 시점에 막는 대신 구조가 생기는 순간 잡는다.** 런타임 위험 0이고 인증 경로를
 * 건드리지 않으며, 위 두 선택지를 나중에 배제하지도 않는다.
 *
 * ## 첫 판은 한 칸 좁았다 — 이름이 아니라 타입으로 본다
 *
 * 처음에는 관계 경로의 마지막 세그먼트가 `'user'` 인지만 봤다. 그래서 `creator`·`owner`
 * 처럼 **이름만 다른 `User` 관계**를 전부 놓쳤고, 그중 `WorkflowVersionsService.findOne`
 * (`relations: ['creator']`, 투영 없음)은 실제로
 * `GET /api/workflows/:wfId/versions/:versionId` 로 `User` 전 컬럼을 내보내고 있었다
 * (`review/code/2026/09/06/10_13_22` Critical 1 — security·requirement 두 reviewer 가
 * 독립 발견).
 *
 * 목록을 `['user','creator','owner']` 로 늘리는 것은 같은 결함의 다음 판이다. 대신
 * **출처를 바꿨다** — `collectUserRelationNames` 가 `*.entity.ts` 의 타입 주석에서 파생한다.
 *
 * ## 무엇을 세는가
 *
 * `User` 관계를 **투영 없이 통째로** 싣는 세 형태 — `relations` 배열 · `relations` 객체
 * (0.3) · `leftJoinAndSelect`/`inner`. `select` 로 좁힌 자리와 `leftJoin`(AndSelect 없음)은
 * 세지 않는다.
 */

/**
 * 관계를 통째로 싣지만 **반환 전에 명시 투영**하는 자리 (전부 코드로 확인).
 *
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

describe('`User` 관계 전체 로드 래칫', () => {
  const moduleFiles = collectTsFiles(path.join(SRC_ROOT, 'modules'));
  const entityFiles = moduleFiles.filter((f) => f.endsWith('.entity.ts'));
  const userRelationNames = collectUserRelationNames(entityFiles);

  // 스캔 범위는 `src/modules` — 서비스가 전부 그 아래에 있고(실측), 그래야 아래
  // 양성 대조군 fixture(`repo-guards/__tests__/fixtures/`)가 베이스라인을 오염시키지 않는다.
  const loads = findUserRelationLoads(moduleFiles, SRC_ROOT, userRelationNames);

  describe('관계 이름 집합은 엔티티에서 파생한다', () => {
    it('타입이 `User` 인 속성 이름을 전부 모은다', () => {
      // 손으로 적은 목록이 아니라 **엔티티 선언**이 SoT 다. 새 `User` 관계가 다른 이름으로
      // 생기면 이 집합이 자동으로 넓어지고, 그 순간 아래 래칫이 그 자리를 본다.
      //
      // **파생이 손 열거보다 넓었다.** 이 목록을 쓰기 전에 `grep '=> User)'` 로 세어
      // `user`·`creator`·`owner` 셋을 얻었는데, 파생은 `executor`(`Execution.executor:
      // User | null`)를 하나 더 찾았다 — 그쪽은 데코레이터 인자 형태가 달라 grep 이
      // 놓쳤다. 목록을 넓히는 대신 출처를 바꾼 이유가 바로 이것이다.
      expect(userRelationNames).toEqual([
        'creator',
        'executor',
        'owner',
        'user',
      ]);
    });

    it('[전제] 엔티티 파일을 실제로 읽었다 — 0개면 술어가 통째로 죽는다', () => {
      expect(entityFiles.length).toBeGreaterThan(0);
    });
  });

  describe('eager 관계 축', () => {
    it('프로덕션 엔티티에 `eager: true` 인 `User` 관계는 하나도 없다', () => {
      // eager 관계는 **호출부에 아무 텍스트도 남기지 않아** 위 스캔이 원리적으로 못 본다.
      // 0을 유지하는 것이 이 축의 계약이다 (`review/code/2026/09/06/11_27_53` W1).
      expect(findEagerUserRelations(entityFiles, SRC_ROOT)).toEqual([]);
    });

    /**
     * **"현재 0건이다" 와 "이 함수가 잡는다" 는 다른 주장이다.**
     *
     * 위 단언만 있을 때 `hasEagerDecorator` 를 `return false` 로 무력화해도 스위트가
     * 15/15 초록이었다 (`review/code/2026/09/06/11_55_36` W1 — 리뷰어가 직접 뮤테이션).
     * 술어가 죽어 있어도 0건은 0건이기 때문이다. 이 대조군이 그 구멍을 막는다.
     */
    it('[대조군] eager `User` 관계를 잡고, 아닌 것은 놓아 준다', () => {
      const fixture = path.join(
        __dirname,
        'fixtures',
        'user-eager-relation.fixture.ts',
      );
      const found = findEagerUserRelations([fixture], SRC_ROOT);
      const props = found.map((k) => k.split('#')[1]).sort();

      // 양성 — eager 인 `User` 관계 둘.
      expect(props).toEqual(['eagerCreator', 'eagerOwner']);
      // 음성 — 옵션 없음 · `eager:false` · `User` 아님. 셋 다 안 걸려야 한다.
      expect(props).not.toContain('lazyUser');
      expect(props).not.toContain('explicitlyLazy');
      expect(props).not.toContain('eagerButNotUser');
    });
  });

  it('알려진 목록과 정확히 일치한다 (새로 생겨도, 남몰래 줄어도 실패)', () => {
    expect(loads.map((l) => l.key).sort()).toEqual(
      [...EXPECTED_USER_RELATION_LOADS].sort(),
    );
  });

  it('[전제] 스캔이 비어 있지 않다 — 0건이면 위 단언이 조용히 통과한다', () => {
    expect(loads.length).toBeGreaterThan(0);
  });

  it('`leftJoinAndSelect` 로 `User` 관계를 싣는 자리는 하나도 없다', () => {
    // 감사 로그 유출이 정확히 이 형태였다. `relations` 축과 달리 **0을 유지**한다 —
    // 이 형태는 `select` 로 좁힐 자리가 없어 언제나 전 컬럼을 싣는다.
    expect(loads.filter((l) => l.kind === 'joinAndSelect')).toEqual([]);
  });

  describe('[대조군] fixture 로 술어를 양쪽에서 확인한다', () => {
    const fixture = path.join(
      __dirname,
      'fixtures',
      'user-relation-load.fixture.ts',
    );
    // 여기서는 **파생 집합을 쓰지 않는다** — 이 블록이 검증하는 것은 매칭 술어이지
    // 파생이 아니다. 파생은 위 describe 가 따로 문다.
    const found = findUserRelationLoads([fixture], SRC_ROOT, [
      'user',
      'creator',
      'owner',
    ]);

    /**
     * 제목에 **개수를 적지 않는다.** 종전 이 자리는 "위반 10형태" 였는데 fixture 에 하나를
     * 더하자 곧바로 낡았고, 같은 브랜치의 RESOLUTION 은 "11형태" 라고 적어 두 문서가
     * 갈렸다 (`review/code/2026/09/06/11_27_53` W3). 단언 자체가 전체 목록을 비교하므로
     * 숫자는 애초에 필요 없다.
     */
    it('fixture 의 위반 함수를 하나도 빠짐없이 잡는다', () => {
      expect(found.map((f) => f.method).sort()).toEqual(
        [
          'violationRelationsUser',
          'violationNestedRelationPath',
          'violationCreatorRelation',
          'violationObjectRelations',
          'violationUppercaseRelation',
          'violationLeftJoinAndSelect',
          'violationInnerJoinAndSelect',
          'violationTwiceInOneFunction',
          'violationTwiceInOneFunction',
          'violationNestedObjectRelations',
          'violationViaIntermediateVariable',
          'violationSatisfiesRelations',
          'violationSelectBooleanNotObject',
        ].sort(),
      );
    });

    it('두 종류를 각각 잡는다 — 한 축만 물면 다른 축으로 샌다', () => {
      const kinds = found.map((f) => f.kind);
      expect(kinds.filter((k) => k === 'joinAndSelect')).toHaveLength(2);
      expect(kinds.filter((k) => k === 'relations')).toHaveLength(11);
    });

    it('중첩 **객체** 형태도 잡는다 — 배열 중첩만 잡으면 반쪽이다', () => {
      // `relations: { workflow: { creator: true } }`. 배열 쪽은 `'member.user'` 로
      // 중첩을 잡으면서 객체 쪽은 최상위만 보던 사각지대였다.
      const nested = found.find(
        (f) => f.method === 'violationNestedObjectRelations',
      );
      expect(nested?.relation).toBe('creator');
    });

    it('타입 연산을 한 겹 씌워도 잡는다 — 술어가 눈 감는 자리였다', () => {
      const wrapped = found.find(
        (f) => f.method === 'violationSatisfiesRelations',
      );
      expect(wrapped?.relation).toBe('creator');
    });

    it('감싸는 변수가 있어도 키는 **함수 이름**으로 잡힌다', () => {
      // `const stored = await repo.findOne(...)` — `enclosingName` 이 변수보다 메서드를
      // 먼저 보지 않으면 키가 `#stored` 가 되어 같은 이름이 여러 파일에서 겹친다.
      const viaVar = found.find(
        (f) => f.method === 'violationViaIntermediateVariable',
      );
      expect(viaVar).toBeDefined();
      expect(viaVar?.key).toMatch(/#violationViaIntermediateVariable$/);
    });

    it('이름이 `user` 가 아닌 `User` 관계도 잡는다 — Critical 1 의 형태', () => {
      const relations = found.map((f) => f.relation);
      expect(relations).toContain('creator');
      expect(relations).toContain('owner');
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

    it('`select` 값이 `true` 면 투영으로 인정하지 않는다', () => {
      // `select: { creator: true }` 는 키만 있고 컬럼을 안 좁힌다. 값이 객체인지까지
      // 봐야 "겉은 투영, 실은 전체 노출" 을 잡는다.
      const boolSelect = found.find(
        (f) => f.method === 'violationSelectBooleanNotObject',
      );
      expect(boolSelect?.relation).toBe('creator');
    });

    it('fixture 의 준수 함수는 하나도 잡지 않는다', () => {
      const methods = found.map((f) => f.method);
      expect(methods).not.toContain('compliantProjectedJoin');
      expect(methods).not.toContain('compliantProjectedRelations');
      // 이름 있는 상수로 투영하는 형태 — 저장소가 실제로 쓰는 모양이다. "값이 객체
      // 리터럴이어야 한다" 로 좁히면 이 정상 형태가 위반으로 잡힌다(실제로 잡혔다).
      expect(methods).not.toContain('compliantNamedConstProjection');
      expect(methods).not.toContain('compliantOtherRelation');
      expect(methods).not.toContain('compliantUserPrefixedRelation');
    });
  });
});
