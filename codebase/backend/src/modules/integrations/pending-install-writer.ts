import { ConflictException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  isPostgresUniqueViolation,
  pgErrorConstraint,
} from '../../common/db/pg-error';
import { Integration } from './entities/integration.entity';
import {
  isStoreIdentifierConflict,
  resolveBeginScope,
  toAlreadyConnectedConflict,
} from './begin-policy';
import { findAllCafe24RowsForMall } from './cafe24-store-rows';
import {
  lockForIntegrationWrite,
  throwUnlessIntegrationCreateLocked,
} from './integration-owner-write-lock';
import {
  INTEGRATION_NAME_TAKEN,
  WORKSPACE_NAME_UNIQUE_CONSTRAINT,
} from './integrations.constants';
import {
  makeshopPendingLockKey,
  PENDING_INSTALL_CONFLICT,
  pickPendingToReuse,
  resolvePendingReuse,
} from './pending-install-reuse';
import { INSTALL_TOKEN_BYTES } from './third-party-oauth.constants';
import type { Cafe24BeginMeta, MakeshopBeginMeta } from './oauth-providers';

/*
 * `oauth/begin`(`new`)의 Cafe24 Private · MakeShop 설치 대기 행 쓰기. 후보 조회 → 잠금 → 재사용 판정 → 쓰기 → 동시 INSERT
 * 재시도를 이 파일 하나에 둔다(NERV CLE-INT-OAUTH 「설치 대기 행 재사용의 권한」, Task CLE-T-JDQYT8). 무엇을 다시 쓸지
 * 정하는 순수 판정은 `pending-install-reuse.ts` 에 있고, 쓰기가 내는 409 · 403 은 모두 이 파일에서 응답으로 바뀐다.
 *
 * 두 서비스는 같은 요청의 경쟁을 다르게 줄 세운다. Cafe24 Private 행은 상점 식별자 UNIQUE(V072)가 막으므로 늦은 INSERT 가
 * 23505 를 받고 한 번 다시 판정한다. MakeShop 행은 설치 전에 `mall_id` 가 비어 UNIQUE 가 막지 못하므로 advisory lock 으로
 * 미리 줄 세운다.
 */

/** 설치 대기 행을 쓰는 요청. `IntegrationOAuthService` 의 `BeginParams` 에서 쓰기에 필요한 값만 받는다. */
export interface PendingInstallRequest {
  workspaceId: string;
  userId: string;
  scopes: string[];
  integrationName?: string;
  scope?: 'personal' | 'organization';
  /** 요청자의 워크스페이스 역할. 없으면 관리자 미만으로 본다(REQ-INTOAUTH-062). */
  requesterRole?: string | null;
}

/** 검증을 마친 Cafe24 Private `oauth/begin` 메타. 상점과 자격 증명이 다 있다. */
export type Cafe24PrivateBeginMeta = Required<
  Pick<Cafe24BeginMeta, 'mall_id' | 'client_id' | 'client_secret'>
> &
  Cafe24BeginMeta;

/** 설치 대기 행을 쓴 결과. 응답의 App URL 은 저장된 설치 토큰으로 만든다. */
export interface PendingInstallWrite {
  saved: Integration;
  installToken: string;
}

/** 워크스페이스 안 통합 이름 UNIQUE 위반인가. 다른 통합이 그 이름을 쓴다. */
function isNameConflict(err: unknown): boolean {
  return (
    isPostgresUniqueViolation(err) &&
    pgErrorConstraint(err) === WORKSPACE_NAME_UNIQUE_CONSTRAINT
  );
}

/**
 * 설치 대기 행 INSERT 가 동시에 들어온 begin 과 부딪혔을 수 있는가. 같은 화면에서 온 두 begin 은 이름도 같아서
 * 이름 UNIQUE 가 상점 식별자 UNIQUE 보다 먼저 걸리기도 한다. 그래서 둘 다 다시 판정할 이유로 본다.
 */
function isPendingInsertRace(err: unknown): boolean {
  return isStoreIdentifierConflict(err) || isNameConflict(err);
}

/** 이름 UNIQUE 위반의 응답. 통합 생성 · 별칭 수정과 같은 409 `INTEGRATION_NAME_TAKEN` 이다(REQ-INTMGMT-005). */
function toNameTakenConflict(): ConflictException {
  return new ConflictException({ ...INTEGRATION_NAME_TAKEN });
}

/**
 * Cafe24 Private 재시도가 다시 실패했을 때의 응답. 이름 UNIQUE 면 다른 통합이 그 이름을 쓰는 것이고, 상점 식별자 UNIQUE
 * 면 begin 이 다시 쓰지 않는 같은 상점의 행(만료됨 · 오류)이 있는 것이다. 그 밖의 오류는 바꾸지 않는다(`null`).
 */
function toCafe24RetryConflict(err: unknown): ConflictException | null {
  if (isNameConflict(err)) return toNameTakenConflict();
  if (isStoreIdentifierConflict(err)) {
    return toAlreadyConnectedConflict('cafe24');
  }
  return null;
}

/**
 * `write` 를 부르고 `shouldRetry` 가 참인 오류면 한 번만 다시 부른다. 다시 부른 쓰기의 오류는 `toResponse` 가 바꾼 응답으로
 * 던지고, `toResponse` 가 `null` 이면 그 오류를 그대로 던진다. 처음 오류가 `shouldRetry` 에 들지 않으면 그대로 던진다.
 */
async function writeWithOneRetry<T>(
  write: () => Promise<T>,
  shouldRetry: (err: unknown) => boolean,
  toResponse: (err: unknown) => Error | null,
): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if (!shouldRetry(err)) throw err;
  }
  try {
    return await write();
  } catch (err) {
    throw toResponse(err) ?? err;
  }
}

/**
 * 설치 대기 행 쓰기의 잠금(REQ-INTMGMT-066). 트랜잭션의 첫 문장이다. 워크스페이스는 공개 범위와 관계없이 잡고 멤버십은
 * 요청 공개 범위가 개인일 때만 잡는다. 다시 쓰는 행의 공개 범위는 아직 모르지만, 개인 행을 다시 쓰는 사람은 그 행의 통합
 * 소유자라 요청 범위가 조직이어도 새 개인 행은 생기지 않는다. 기존 행은 나가기 · 제거의 통합 DELETE 가 행 잠금을 기다린 뒤
 * 지운다.
 */
async function lockForPendingWrite(
  manager: EntityManager,
  request: Pick<PendingInstallRequest, 'workspaceId' | 'userId' | 'scope'>,
): Promise<void> {
  throwUnlessIntegrationCreateLocked(
    await lockForIntegrationWrite(manager, {
      workspaceId: request.workspaceId,
      personalOwnerId:
        resolveBeginScope(request) === 'personal' ? request.userId : null,
    }),
  );
}

/**
 * 다시 쓸 후보 행을 `FOR UPDATE` 로 잠그고 아직 설치 대기인 행만 `created_at` · `id` 순으로 돌려준다. 잠금을 기다리는
 * 동안 다른 요청이 설치를 마치거나 만료시킨 행은 Postgres 가 잠근 뒤 WHERE 를 다시 평가해 뺀다(READ COMMITTED).
 */
async function lockPendingRows(
  repo: Repository<Integration>,
  ids: readonly string[],
): Promise<Integration[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  return repo.find({
    where: { id: In(unique), status: 'pending_install' },
    order: { createdAt: 'ASC', id: 'ASC' },
    lock: { mode: 'pessimistic_write' },
  });
}

/**
 * 후보를 잠그고, 잠근 뒤에도 `stillMatches` 인 행 가운데 다시 쓸 행을 고른다. 요청자가 바꿀 수 있는 행이 먼저다. 고를 수
 * 있는 행이 없고 남의 행만 남았으면 409 · 403 으로 거절한다. 다시 쓸 행이 없으면 `null` 이라 호출자가 새 행을 만든다.
 * 다시 고르는 일은 이 한 번뿐이다.
 */
async function lockAndPickReusable(
  repo: Repository<Integration>,
  candidates: readonly Integration[],
  stillMatches: (row: Integration) => boolean,
  request: PendingInstallRequest,
  service: keyof typeof PENDING_INSTALL_CONFLICT,
): Promise<Integration | null> {
  const locked = (
    await lockPendingRows(
      repo,
      candidates.map((row) => row.id),
    )
  ).filter(stillMatches);
  return resolvePendingReuse(
    pickPendingToReuse(locked, request.userId, request.requesterRole ?? null),
    service,
  );
}

/** 16바이트 base64url(22자, 128-bit). Cafe24 App URL 100자 한도 때문에 길이를 {@link INSTALL_TOKEN_BYTES} 로 둔다. */
function newInstallToken(): string {
  return randomBytes(INSTALL_TOKEN_BYTES).toString('base64url');
}

/**
 * 다시 쓰는 Cafe24 Private 설치 대기 행을 고친다. **install_token 보존 (idempotent begin)**: 같은 mall_id 에 대해 begin 을
 * 여러 번 호출해도 사용자가 처음 Cafe24 Developers 에 등록한 URL 이 계속 유효하도록 기존 토큰을 유지한다. 토큰이 없거나
 * (legacy / null) 자격 증명이 바뀐 경우에만 새 토큰을 넣는다. 발급 시각도 그때만 바꾼다. 보존하면 기존 기한 그대로다.
 *
 * 옛 동작(매 호출 토큰 재발급)은 "Connect 버튼 두 번 누르면 첫 번째 URL 이 갑자기 무효화" UX 버그를 일으켰다(2026-05-15
 * 운영 보고). 공개 범위와 통합 소유자(`created_by`)는 바꾸지 않는다.
 */
function overwriteCafe24Pending(
  row: Integration,
  request: PendingInstallRequest,
  meta: Cafe24PrivateBeginMeta,
  issued: { installToken: string; issuedAt: Date },
): void {
  const credsChanged =
    row.credentials?.mall_id !== meta.mall_id ||
    row.credentials?.client_id !== meta.client_id ||
    row.credentials?.client_secret !== meta.client_secret;
  if (!row.installToken || credsChanged) {
    row.installToken = issued.installToken;
    row.installTokenIssuedAt = issued.issuedAt;
  }
  row.mallId = meta.mall_id; // backfill plain column if still NULL
  row.credentials = {
    ...row.credentials,
    mall_id: meta.mall_id,
    app_type: 'private',
    client_id: meta.client_id,
    client_secret: meta.client_secret,
    scopes: request.scopes,
  };
  row.statusReason = null;
  row.lastError = null;
}

/**
 * 다시 쓰는 MakeShop 설치 대기 행을 고친다. 설치 토큰은 없을 때만 새로 넣는다. client_secret 이 바뀌어도 그대로 둔다
 * (Cafe24 Private 과 다르다). 공개 범위와 통합 소유자(`created_by`)는 바꾸지 않는다.
 */
function overwriteMakeshopPending(
  row: Integration,
  request: PendingInstallRequest,
  meta: Required<MakeshopBeginMeta>,
  issued: { installToken: string; issuedAt: Date },
): void {
  if (!row.installToken) {
    row.installToken = issued.installToken;
    row.installTokenIssuedAt = issued.issuedAt;
  }
  row.credentials = {
    ...row.credentials,
    client_id: meta.client_id,
    client_secret: meta.client_secret,
    scopes: request.scopes,
  };
  row.statusReason = null;
  row.lastError = null;
}

/**
 * `(workspaceId, client_id)` 의 `pending_install` makeshop 행을 `created_at` · `id` 순으로 모두 찾는다. begin 이
 * 다시 쓸 행을 고를 때 쓴다. `client_id` 는 암호화한 자격 증명 안에 있어 복호화한 뒤 비교한다.
 */
async function findMakeshopPendingByClient(
  repo: Repository<Integration>,
  workspaceId: string,
  clientId: string,
): Promise<Integration[]> {
  const rows = await repo.find({
    where: {
      workspaceId,
      serviceType: 'makeshop',
      status: 'pending_install',
    },
    order: { createdAt: 'ASC', id: 'ASC' },
  });
  return rows.filter((r) => r.credentials?.client_id === clientId);
}

/**
 * Cafe24 Private · MakeShop 설치 대기 행을 쓰는 협력 클래스. `IntegrationOAuthService` 가 생성자에서 만들어 begin 에서
 * 부른다. 상태가 없어 요청마다 새로 만들지 않는다.
 */
export class PendingInstallWriter {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Cafe24 Private 설치 대기 행을 쓴다(REQ-INTOAUTH-058 · 062 · 066).
   *
   * 같은 상점의 설치 대기 행을 두 begin 이 동시에 만들면 늦은 쪽의 INSERT 가 23505 로 막힌다. 걸리는 제약은 상점 식별자
   * UNIQUE(V072)이거나, 두 요청의 이름이 같으면 먼저 검사되는 이름 UNIQUE 다. 늦은 쪽은 새 트랜잭션에서 한 번만 다시
   * 판정한다. 그때는 앞선 begin 이 만든 행이 보여서 재사용이나 409 로 끝난다. 다시 판정해도 막히면
   * {@link toCafe24RetryConflict} 의 409 다.
   * 근거: [OAuth 연결과 토큰 갱신 「설치 대기 행 재사용의 권한」](CLE-INT-OAUTH#설치-대기-행-재사용의-권한)
   */
  writeCafe24Private(
    request: PendingInstallRequest,
    meta: Cafe24PrivateBeginMeta,
  ): Promise<PendingInstallWrite> {
    return writeWithOneRetry(
      () => this.writeCafe24PrivateTx(request, meta),
      isPendingInsertRace,
      toCafe24RetryConflict,
    );
  }

  /**
   * MakeShop 설치 대기 행을 쓴다(REQ-INTOAUTH-059 · 060 · 062 · 066). 같은 `client_id` 의 begin 은 advisory lock 으로 줄
   * 세우므로 Cafe24 Private 처럼 다시 판정할 경쟁이 없다. 이름 UNIQUE 에 걸리면 생성과 같은 409 다.
   */
  async writeMakeshop(
    request: PendingInstallRequest,
    meta: Required<MakeshopBeginMeta>,
  ): Promise<PendingInstallWrite> {
    try {
      return await this.writeMakeshopTx(request, meta);
    } catch (err) {
      if (isNameConflict(err)) throw toNameTakenConflict();
      throw err;
    }
  }

  /** Cafe24 Private 설치 대기 행을 한 트랜잭션에서 고르고 잠그고 판정한 뒤 쓴다. */
  private writeCafe24PrivateTx(
    request: PendingInstallRequest,
    meta: Cafe24PrivateBeginMeta,
  ): Promise<PendingInstallWrite> {
    return this.dataSource.transaction(async (manager) => {
      // 통합 행을 읽거나 잠그기 전에 워크스페이스 → 멤버십 순으로 잠근다(REQ-INTMGMT-066).
      await lockForPendingWrite(manager, request);
      const repo = manager.getRepository(Integration);
      // 같은 상점에 연결된 행이 있으면 app_type 과 관계없이 409 다. 겹친 행의 통합 ID 는 싣지 않는다. 남의 개인 통합일 수
      // 있다(REQ-INTOAUTH-065).
      const allSameMall = await findAllCafe24RowsForMall(
        repo,
        request.workspaceId,
        meta.mall_id,
      );
      if (allSameMall.some((row) => row.status === 'connected')) {
        throw new ConflictException({
          code: 'CAFE24_PRIVATE_APP_ALREADY_CONNECTED',
          message: `A Cafe24 integration for mall_id "${meta.mall_id}" already exists and is connected. Use the existing integration or delete it first.`,
        });
      }
      // 기존 pending_install 재사용은 private app 끼리만 의미가 있다(public app 의 pending 행은 OAuth 흐름 자체가 다르다).
      // 잠근 뒤에도 같은 조건으로 다시 거른다.
      const isReusable = (row: Integration) =>
        row.status === 'pending_install' &&
        row.credentials?.app_type === 'private' &&
        (row.mallId ?? row.credentials?.mall_id) === meta.mall_id;
      const reusable = await lockAndPickReusable(
        repo,
        allSameMall.filter(isReusable),
        isReusable,
        request,
        'cafe24',
      );

      const issued = { installToken: newInstallToken(), issuedAt: new Date() };
      let target: Integration;
      if (reusable) {
        overwriteCafe24Pending(reusable, request, meta, issued);
        target = reusable;
      } else {
        target = repo.create({
          workspaceId: request.workspaceId,
          createdBy: request.userId,
          serviceType: 'cafe24',
          authType: 'oauth2',
          name: request.integrationName || `${meta.mall_id} (Cafe24 Private)`,
          scope: resolveBeginScope(request),
          status: 'pending_install',
          installToken: issued.installToken,
          installTokenIssuedAt: issued.issuedAt,
          mallId: meta.mall_id,
          credentials: {
            mall_id: meta.mall_id,
            app_type: 'private',
            client_id: meta.client_id,
            client_secret: meta.client_secret,
            scopes: request.scopes,
          },
        });
      }
      const saved = await repo.save(target);
      // 재사용하면 기존 토큰을 그대로 둘 수 있으므로 DB 에 실제 저장된 `saved.installToken` 을 쓴다.
      return { saved, installToken: saved.installToken ?? issued.installToken };
    });
  }

  /** MakeShop 설치 대기 행을 한 트랜잭션에서 고르고 잠그고 판정한 뒤 쓴다. */
  private writeMakeshopTx(
    request: PendingInstallRequest,
    meta: Required<MakeshopBeginMeta>,
  ): Promise<PendingInstallWrite> {
    return this.dataSource.transaction(async (manager) => {
      // advisory lock 보다 먼저 워크스페이스 → 멤버십 순으로 잠근다(REQ-INTMGMT-066).
      await lockForPendingWrite(manager, request);
      // 같은 `(workspace_id, client_id)` 의 begin 을 줄 세운다. MakeShop 설치 대기 행은 `mall_id` 가 비어 있어
      // 상점 식별자 UNIQUE 가 막지 못한다. 이 잠금이 없으면 동시에 들어온 두 begin 이 모두 다시 쓸 행이 없다고 보고
      // 설치 대기 행을 둘 만든다.
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [makeshopPendingLockKey(request.workspaceId, meta.client_id)],
      );
      const repo = manager.getRepository(Integration);
      // shop_uid 를 아직 모르므로 상점으로 거르지 못한다. 같은 client_id 의 설치 대기 행이 여럿이면 바꿀 수 있는 행을
      // 먼저 고른다.
      const reusable = await lockAndPickReusable(
        repo,
        await findMakeshopPendingByClient(
          repo,
          request.workspaceId,
          meta.client_id,
        ),
        (row) => row.credentials?.client_id === meta.client_id,
        request,
        'makeshop',
      );

      const issued = { installToken: newInstallToken(), issuedAt: new Date() };
      let target: Integration;
      if (reusable) {
        overwriteMakeshopPending(reusable, request, meta, issued);
        target = reusable;
      } else {
        target = repo.create({
          workspaceId: request.workspaceId,
          createdBy: request.userId,
          serviceType: 'makeshop',
          authType: 'oauth2',
          name: request.integrationName || 'MakeShop',
          scope: resolveBeginScope(request),
          status: 'pending_install',
          installToken: issued.installToken,
          installTokenIssuedAt: issued.issuedAt,
          // mallId (=shop_uid projection) stays NULL until install callback.
          credentials: {
            client_id: meta.client_id,
            client_secret: meta.client_secret,
            scopes: request.scopes,
          },
        });
      }
      const saved = await repo.save(target);
      return { saved, installToken: saved.installToken ?? issued.installToken };
    });
  }
}
