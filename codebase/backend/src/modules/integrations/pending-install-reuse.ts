import { ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ADMIN_ROLES } from '../../common/constants/workspace-roles';
import type { Integration } from './entities/integration.entity';
import { adminRequiredError } from './integration-visibility';

/*
 * `oauth/begin`(`new`)이 Cafe24 Private · MakeShop 설치 대기 행을 다시 쓸 때의 판정 — NERV CLE-INT-OAUTH
 * 「설치 대기 행 재사용의 권한」, Task CLE-T-N7ENKQ. 잠금과 쓰기는 `IntegrationOAuthService` 가 한 트랜잭션에서 하고,
 * 이 파일은 잠근 행을 보고 무엇을 할지만 정한다.
 */

/**
 * 설치 대기 행의 설치 기한(시간). 만료 스캐너(`IntegrationExpiryScannerService.expirePendingInstalls`)와 409
 * `details.pendingInstallExpiresAt` 이 같은 값을 쓴다.
 */
export const PENDING_INSTALL_TTL_HOURS = 24;

const PENDING_INSTALL_TTL_MS = PENDING_INSTALL_TTL_HOURS * 60 * 60 * 1000;

/** 설치 기한 — `COALESCE(install_token_issued_at, created_at)` 에 {@link PENDING_INSTALL_TTL_HOURS} 를 더한다. */
export function pendingInstallExpiresAt(
  row: Pick<Integration, 'installTokenIssuedAt' | 'createdAt'>,
): Date {
  const base = row.installTokenIssuedAt ?? row.createdAt;
  return new Date(new Date(base).getTime() + PENDING_INSTALL_TTL_MS);
}

/**
 * 다시 쓸 행을 요청자가 바꿀 수 있는가. 바꿀 수 있는 사람은 별칭 수정과 같다. 개인 행은 통합 소유자, 조직 행은 관리자
 * 이상이다. 요청 본문의 공개 범위는 보지 않는다(REQ-INTOAUTH-012 · 058 · 059 · 060 · 062).
 *
 * - `reuse` — 그 행을 덮는다
 * - `owned_by_other` — 남의 개인 행이다. 409 `*_INSTALL_PENDING`
 * - `admin_required` — 관리자 미만이 만난 조직 행이다. 403 `ADMIN_REQUIRED`
 */
export type PendingReuseVerdict = 'reuse' | 'owned_by_other' | 'admin_required';

export function pendingReuseVerdict(
  row: Pick<Integration, 'scope' | 'createdBy'>,
  userId: string,
  userRole: string | null,
): PendingReuseVerdict {
  if (row.scope === 'organization') {
    return userRole && ADMIN_ROLES.has(userRole) ? 'reuse' : 'admin_required';
  }
  return row.createdBy === userId ? 'reuse' : 'owned_by_other';
}

/**
 * 다시 쓸 행을 고른다. `rows` 는 `created_at` · `id` 순이어야 한다. 요청자가 바꿀 수 있는 행을 먼저 고르고, 없으면 첫
 * 행으로 거절을 정한다. 행이 없으면 `null` 이다(새 행을 만든다).
 */
export function pickPendingToReuse<
  T extends Pick<Integration, 'scope' | 'createdBy'>,
>(
  rows: readonly T[],
  userId: string,
  userRole: string | null,
): { row: T; verdict: PendingReuseVerdict } | null {
  if (rows.length === 0) return null;
  const reusable = rows.find(
    (row) => pendingReuseVerdict(row, userId, userRole) === 'reuse',
  );
  if (reusable) return { row: reusable, verdict: 'reuse' };
  return {
    row: rows[0],
    verdict: pendingReuseVerdict(rows[0], userId, userRole),
  };
}

/** 남의 개인 설치 대기 행을 만났을 때의 409 코드. */
export const PENDING_INSTALL_CONFLICT = {
  cafe24: {
    code: 'CAFE24_PRIVATE_APP_INSTALL_PENDING',
    message:
      '같은 상점에 다른 멤버가 시작한 Cafe24 Private 설치가 기다리고 있습니다. 설치 기한이 지난 뒤 다시 시도하세요.',
  },
  makeshop: {
    code: 'MAKESHOP_INSTALL_PENDING',
    message:
      '같은 client_id 로 다른 멤버가 시작한 MakeShop 설치가 기다리고 있습니다. 설치 기한이 지난 뒤 다시 시도하세요.',
  },
} as const;

/**
 * 남의 개인 설치 대기 행 409. 그 행의 통합 ID 와 App URL 은 싣지 않는다. App URL 에는 설치 토큰이 들어 있어 받은 사람이
 * 남의 설치 흐름에 끼어들 수 있다(REQ-INTOAUTH-061).
 */
export function pendingInstallConflict(
  service: keyof typeof PENDING_INSTALL_CONFLICT,
  row: Pick<Integration, 'installTokenIssuedAt' | 'createdAt'>,
): ConflictException {
  return new ConflictException({
    ...PENDING_INSTALL_CONFLICT[service],
    details: {
      pendingInstallExpiresAt: pendingInstallExpiresAt(row).toISOString(),
    },
  });
}

/**
 * {@link pickPendingToReuse} 가 고른 결과를 응답으로 옮긴다. 거절이면 던지고, 다시 쓸 행이면 그 행을 돌려준다. 고른 행이
 * 없으면(`null`) 새 행을 만들 차례라 `null` 을 돌려준다. Cafe24 Private 과 MakeShop 이 같은 거절 응답을 내도록 두 서비스가
 * 이 함수 하나로 처리한다. 판정 값이 늘면 아래 `never` 에서 컴파일이 멈춘다.
 */
export function assertPendingReusable<
  T extends Pick<
    Integration,
    'scope' | 'createdBy' | 'installTokenIssuedAt' | 'createdAt'
  >,
>(
  picked: { row: T; verdict: PendingReuseVerdict } | null,
  service: keyof typeof PENDING_INSTALL_CONFLICT,
): T | null {
  if (!picked) return null;
  switch (picked.verdict) {
    case 'reuse':
      return picked.row;
    case 'owned_by_other':
      throw pendingInstallConflict(service, picked.row);
    case 'admin_required':
      throw adminRequiredError('modify');
    default: {
      const unreachable: never = picked.verdict;
      return unreachable;
    }
  }
}

/**
 * MakeShop begin 을 `(workspace_id, client_id)` 마다 줄 세우는 트랜잭션 advisory lock 키의 접두어.
 *
 * Redis 키가 아니다. `pg_advisory_xact_lock(hashtextextended(<키>, 0))` 의 입력 문자열이다. 계열 목록의 정본은
 * NERV CLE-ENG-REDIS 「Redis 키가 아닌 인접 이름」 표다. 32비트 `hashtext()` 를 쓰는 `trigger-config:` · `exec-cap:`
 * 과 달리 64비트 해시를 써서 관계없는 begin 이 같은 키에 걸리는 일을 줄인다.
 */
export const MAKESHOP_PENDING_LOCK_PREFIX = 'makeshop-pending';

/**
 * `client_id` 는 암호화해 저장하는 자격 증명의 값이라 키 문자열에 원문을 넣지 않는다. 되돌릴 수 없는 SHA-256 으로 넣는다.
 */
export function makeshopPendingLockKey(
  workspaceId: string,
  clientId: string,
): string {
  const digest = createHash('sha256').update(clientId, 'utf8').digest('hex');
  return `${MAKESHOP_PENDING_LOCK_PREFIX}:${workspaceId}:${digest}`;
}
