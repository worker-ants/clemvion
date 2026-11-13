import { FindOptionsWhere, IsNull, Not, Or, Repository } from 'typeorm';
import type { Integration } from './entities/integration.entity';

/*
 * 같은 Cafe24 상점의 통합 행을 찾는 조회와 그 조회가 쓰는 만료 행 제외 술어. `oauth/begin` 의 설치 대기 행 쓰기
 * (`PendingInstallWriter`)와 `IntegrationOAuthService` 의 Public begin 사전 검사 · 중복 사전 감지가 함께 쓴다.
 */

/**
 * 같은 상점 판정의 후보가 아닌 행인가. 설치 기한이 지나 만료된 행은 상점 자리를 놓는다(REQ-INTOAUTH-068). 만료할 때
 * `mall_id` 컬럼을 비우므로 컬럼으로 찾으면 저절로 빠지지만, 컬럼이 빈 옛 행을 `credentials.mall_id` 로 맞추는 대체
 * 경로는 이 판정 없이는 만료 행을 다시 찾는다. 같은 상점의 행을 찾는 곳은 모두 이 함수를 거친다.
 * 상점을 찾지 않는 두 곳도 같은 술어를 쓴다. 콜백 트랜잭션의 되살림 차단 가드(`handleCallback`)와, 그 거절을 만료 행에
 * 기록하지 않고 건너뛰는 `markIntegrationCallbackError` 다.
 * 근거: [OAuth 연결과 토큰 갱신 「만료된 설치 대기 행은 상점 자리를 놓는다」](CLE-INT-OAUTH#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29)
 */
export function hasReleasedStoreSlot(
  row: Pick<Integration, 'status' | 'statusReason'>,
): boolean {
  return row.status === 'expired' && row.statusReason === 'install_timeout';
}

/**
 * {@link hasReleasedStoreSlot} 가 거짓인 행만 고르는 SQL 조건(`NOT (status = 'expired' AND status_reason =
 * 'install_timeout')`). `status` 는 NOT NULL 이지만 `status_reason` 은 NULL 일 수 있고, 사유가 NULL 인 만료 행은 상점 자리를
 * 놓지 않은 행이다. `status_reason <> 'install_timeout'` 만 쓰면 NULL 행이 빠지므로 NULL 을 따로 받는다. `where` 는 배열로 넘긴
 * 갈래의 합집합(OR)이라 호출자의 공통 조건에 이 두 갈래를 각각 펼쳐 넣는다.
 */
function keptStoreSlotBranches(): Array<
  Pick<FindOptionsWhere<Integration>, 'status' | 'statusReason'>
> {
  return [
    { status: Not('expired') },
    { status: 'expired', statusReason: Or(IsNull(), Not('install_timeout')) },
  ];
}

/**
 * Return all cafe24 Integration rows for `(workspaceId, mallId)`.
 *
 * Primary path: SQL filter on the V045 plain `mall_id` column (O(1) rows).
 * Legacy fallback: rows from before V045 still have `mall_id IS NULL` —
 * match them via the encrypted `credentials.mall_id` JSONB field.
 *
 * **Legacy fallback 제거 조건** (2026-05-16 기준): V045 backfill 마이그레이션
 * (마이그레이션 추적 plan `plan/in-progress/cafe24-mall-dup-ux.md` 참조) 이
 * 완료되어 모든 cafe24 row 의 `mall_id` plain 컬럼이 NOT NULL 임을 확인한
 * 뒤 legacy 쿼리 + filter 블록을 삭제. 동시에 V046 partial UNIQUE 의
 * `mall_id IS NOT NULL` 조건도 검토 (NOT NULL constraint 로 강화 가능).
 *
 * `PendingInstallWriter` 는 begin private guard 와 pending_install 재사용 후보 조회에 트랜잭션 저장소(`repo`)를 넘기고,
 * `IntegrationOAuthService` 의 public-flow begin guard 와 `precheckCafe24Mall`(frontend pre-detection endpoint)은 기본
 * 저장소를 넘긴다.
 *
 * 설치 기한이 지나 만료된 행은 두 경로 모두에서 뺀다({@link hasReleasedStoreSlot}, REQ-INTOAUTH-068). 컬럼 경로는
 * 만료 때 `mall_id` 를 비워 저절로 빠진다. 대체 경로는 `credentials.mall_id` 가 남아 있어 만료 행이 걸리므로
 * SQL 조건({@link keptStoreSlotBranches})으로 먼저 빼 `credentials` 를 읽고 복호화하지 않는다. 읽은 뒤의 판정은 방어선이다.
 *
 * 두 쿼리는 `Promise.all` 로 함께 낸다. 기본 저장소(연결 풀)에서는 두 쿼리가 서로 다른 연결에서 함께 돌아 기다리는
 * 시간이 준다. 트랜잭션 저장소(`repo`)는 연결 하나를 쓰므로 두 쿼리가 차례로 돌고 기다리는 시간은 줄지 않는다.
 * legacy 쿼리는 backfill 완료 후 제거 예정이며 그 시점에 단일 쿼리로 회귀.
 */
export async function findAllCafe24RowsForMall(
  repo: Repository<Integration>,
  workspaceId: string,
  mallId: string,
): Promise<Integration[]> {
  const [direct, legacyRaw] = await Promise.all([
    repo.find({
      where: { workspaceId, serviceType: 'cafe24', mallId },
    }),
    // 만료로 `mall_id` 가 비워진 install_timeout 행이 시간이 지날수록 이 집합에 쌓인다. 그 행은 어차피 아래에서 빠지므로
    // SQL 에서 먼저 빼 `credentials` 를 읽고 복호화하는 비용을 내지 않는다. 아래 `hasReleasedStoreSlot` 필터는 방어선으로 남긴다.
    repo.find({
      where: keptStoreSlotBranches().map((branch) => ({
        workspaceId,
        serviceType: 'cafe24',
        mallId: IsNull(),
        ...branch,
      })),
    }),
  ]);
  const legacy = legacyRaw.filter((row) => row.credentials?.mall_id === mallId);
  return [...direct, ...legacy].filter((row) => !hasReleasedStoreSlot(row));
}
