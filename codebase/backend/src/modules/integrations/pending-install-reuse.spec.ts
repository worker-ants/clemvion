import { describe, it, expect } from '@jest/globals';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  assertPendingReusable,
  makeshopPendingLockKey,
  MAKESHOP_PENDING_LOCK_PREFIX,
  PENDING_INSTALL_TTL_HOURS,
  pendingInstallConflict,
  pendingInstallExpiresAt,
  pendingReuseVerdict,
  pickPendingToReuse,
} from './pending-install-reuse';

/*
 * 설치 대기 행 재사용의 판정 — NERV CLE-INT-OAUTH 「설치 대기 행 재사용의 권한」(REQ-INTOAUTH-058~062 · 066).
 * 잠금과 쓰기는 서비스 테스트(`integration-oauth.service.{cafe24,makeshop}.spec.ts`)와 e2e 가 본다.
 */

const OWNER = 'u-owner';
const OTHER = 'u-other';

const row = (
  scope: 'personal' | 'organization',
  createdBy: string,
  id = `${scope}-${createdBy}`,
) => ({ id, scope, createdBy });

describe('pendingReuseVerdict', () => {
  it.each([
    ['개인 행 · 통합 소유자', row('personal', OWNER), OWNER, 'editor', 'reuse'],
    // 역할 우위가 없다 — 소유자 · 관리자도 남의 개인 행을 다시 쓰지 못한다.
    [
      '개인 행 · 다른 멤버(소유자)',
      row('personal', OTHER),
      OWNER,
      'owner',
      'owned_by_other',
    ],
    [
      '개인 행 · 다른 멤버(편집자)',
      row('personal', OTHER),
      OWNER,
      'editor',
      'owned_by_other',
    ],
    ['조직 행 · 관리자', row('organization', OTHER), OWNER, 'admin', 'reuse'],
    ['조직 행 · 소유자', row('organization', OTHER), OWNER, 'owner', 'reuse'],
    // 조직 행은 만든 사람이어도 관리자 미만이면 다시 쓰지 못한다(별칭 수정과 같다).
    [
      '조직 행 · 만든 편집자',
      row('organization', OWNER),
      OWNER,
      'editor',
      'admin_required',
    ],
    [
      '조직 행 · 역할 모름',
      row('organization', OTHER),
      OWNER,
      null,
      'admin_required',
    ],
  ] as const)('%s → %s', (_label, target, userId, role, expected) => {
    expect(pendingReuseVerdict(target, userId, role)).toBe(expected);
  });
});

describe('pickPendingToReuse', () => {
  it('행이 없으면 null — 새 행을 만든다', () => {
    expect(pickPendingToReuse([], OWNER, 'editor')).toBeNull();
  });

  it('바꿀 수 있는 행을 앞선 행보다 먼저 고른다', () => {
    const others = row('personal', OTHER, 'first');
    const mine = row('personal', OWNER, 'second');
    expect(pickPendingToReuse([others, mine], OWNER, 'editor')).toEqual({
      row: mine,
      verdict: 'reuse',
    });
  });

  it('바꿀 수 있는 행이 여럿이면 순서상 첫 행을 고른다', () => {
    const a = row('personal', OWNER, 'a');
    const b = row('organization', OTHER, 'b');
    expect(pickPendingToReuse([a, b], OWNER, 'admin')?.row).toBe(a);
  });

  it.each([
    [
      '남의 개인 행이 앞',
      [row('personal', OTHER, 'p'), row('organization', OTHER, 'o')],
      'p',
      'owned_by_other',
    ],
    [
      '조직 행이 앞',
      [row('organization', OTHER, 'o'), row('personal', OTHER, 'p')],
      'o',
      'admin_required',
    ],
  ] as const)(
    '바꿀 수 있는 행이 없으면 첫 행으로 거절을 정한다 — %s',
    (_label, rows, expectedId, expectedVerdict) => {
      const picked = pickPendingToReuse(rows, OWNER, 'editor');
      expect(picked?.row.id).toBe(expectedId);
      expect(picked?.verdict).toBe(expectedVerdict);
    },
  );
});

describe('pendingInstallExpiresAt', () => {
  const createdAt = new Date('2026-10-01T00:00:00.000Z');

  it('설치 토큰 발급 시각에 24시간을 더한다', () => {
    const issued = new Date('2026-10-05T12:00:00.000Z');
    expect(
      pendingInstallExpiresAt({ installTokenIssuedAt: issued, createdAt }),
    ).toEqual(new Date('2026-10-06T12:00:00.000Z'));
  });

  it('발급 시각이 없으면 생성 시각을 기준으로 한다(만료 스캐너의 COALESCE 와 같다)', () => {
    expect(
      pendingInstallExpiresAt({ installTokenIssuedAt: null, createdAt }),
    ).toEqual(new Date('2026-10-02T00:00:00.000Z'));
  });

  it('기한은 만료 스캐너와 같은 24시간이다', () => {
    expect(PENDING_INSTALL_TTL_HOURS).toBe(24);
  });
});

describe('pendingInstallConflict', () => {
  const target = {
    installTokenIssuedAt: new Date('2026-10-05T12:00:00.000Z'),
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
  };

  it.each([
    ['cafe24', 'CAFE24_PRIVATE_APP_INSTALL_PENDING'],
    ['makeshop', 'MAKESHOP_INSTALL_PENDING'],
  ] as const)(
    '%s — 409 에 설치 기한만 싣고 통합 ID · App URL 은 싣지 않는다',
    (service, code) => {
      const err = pendingInstallConflict(service, {
        ...target,
        // 판정 대상 행에 무엇이 있든 응답에 새지 않아야 한다.
        ...({
          id: 'secret-id',
          installToken: 'SecretTokenSecretToken',
        } as object),
      });
      expect(err).toBeInstanceOf(ConflictException);
      const body = err.getResponse() as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(['code', 'details', 'message']);
      expect(body.code).toBe(code);
      expect(body.details).toEqual({
        pendingInstallExpiresAt: '2026-10-06T12:00:00.000Z',
      });
      expect(JSON.stringify(body)).not.toMatch(/secret-id|SecretToken/);
    },
  );
});

describe('assertPendingReusable', () => {
  const stamp = {
    installTokenIssuedAt: new Date('2026-10-05T12:00:00.000Z'),
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
  };
  const target = (
    scope: 'personal' | 'organization',
    createdBy: string,
    id: string,
  ) => ({ ...row(scope, createdBy, id), ...stamp });

  it('고른 행이 없으면 null — 새 행을 만든다', () => {
    expect(assertPendingReusable(null, 'cafe24')).toBeNull();
    expect(assertPendingReusable(null, 'makeshop')).toBeNull();
  });

  it('다시 쓸 행이면 그 행을 돌려준다', () => {
    const mine = target('personal', OWNER, 'mine');
    expect(
      assertPendingReusable({ row: mine, verdict: 'reuse' }, 'cafe24'),
    ).toBe(mine);
  });

  it.each([
    ['cafe24', 'CAFE24_PRIVATE_APP_INSTALL_PENDING'],
    ['makeshop', 'MAKESHOP_INSTALL_PENDING'],
  ] as const)(
    '%s — 남의 개인 행이면 409 %s 를 던지고 설치 기한만 싣는다',
    (service, code) => {
      const others = target('personal', OTHER, 'others');
      let thrown: unknown;
      try {
        assertPendingReusable(
          { row: others, verdict: 'owned_by_other' },
          service,
        );
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(ConflictException);
      const body = (thrown as ConflictException).getResponse() as Record<
        string,
        unknown
      >;
      expect(body.code).toBe(code);
      expect(body.details).toEqual({
        pendingInstallExpiresAt: '2026-10-06T12:00:00.000Z',
      });
    },
  );

  it.each(['cafe24', 'makeshop'] as const)(
    '%s — 관리자 미만이 만난 조직 행이면 403 ADMIN_REQUIRED 를 던진다',
    (service) => {
      const org = target('organization', OTHER, 'org');
      let thrown: unknown;
      try {
        assertPendingReusable({ row: org, verdict: 'admin_required' }, service);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(ForbiddenException);
      expect(
        ((thrown as ForbiddenException).getResponse() as { code: string }).code,
      ).toBe('ADMIN_REQUIRED');
    },
  );
});

describe('makeshopPendingLockKey', () => {
  it('접두어 · 워크스페이스 · client_id 의 SHA-256 으로 만든다', () => {
    const key = makeshopPendingLockKey('ws-1', 'mk-client-id');
    expect(key).toMatch(
      new RegExp(`^${MAKESHOP_PENDING_LOCK_PREFIX}:ws-1:[0-9a-f]{64}$`),
    );
  });

  it('client_id 원문을 키에 넣지 않는다', () => {
    expect(makeshopPendingLockKey('ws-1', 'mk-client-id')).not.toContain(
      'mk-client-id',
    );
  });

  it('워크스페이스나 client_id 가 다르면 키가 다르다', () => {
    const base = makeshopPendingLockKey('ws-1', 'cid');
    expect(makeshopPendingLockKey('ws-2', 'cid')).not.toBe(base);
    expect(makeshopPendingLockKey('ws-1', 'cid2')).not.toBe(base);
    expect(makeshopPendingLockKey('ws-1', 'cid')).toBe(base);
  });
});
