import type { Integration } from './entities/integration.entity';

/*
 * Cafe24 Private 재설치 요청 표시(`integration.reinstall_requested_at`, V151)를 읽는 판정 — NERV CLE-INT-OAUTH ·
 * CLE-INT-DATA, Task CLE-T-NNENG8.
 *
 * 표시는 `:id/reauthorize` · `:id/request-scopes` 가 남기고 OAuth 콜백 성공이 지운다. 표시가 있는 행은 설치 흐름의
 * 행처럼 다룬다 — App URL(`handleInstall`)이 OAuth authorize 로 보내고, 콜백이 요청자 인가를 다시 보지 않는다. 그 대신
 * 표시에는 유효 기간이 있다. `pending_install` 행은 24시간 TTL 스캐너가 창을 닫지만 표시는 그 스캐너의 대상이 아니라서,
 * 읽는 쪽이 이 파일의 술어로 만료를 본다. 만료된 표시는 값이 남아 있어도 없는 것으로 읽는다(지우는 스윕은 없다).
 * 읽는 곳이 늘면 술어를 직접 쓰지 않고 이 파일을 거친다 — 한 곳만 만료를 빠뜨리면 인가 재판정을 건너뛰는 창이 열린다.
 */

/**
 * 재설치 요청 표시의 유효 시간. 설치 대기 TTL(`integration-expiry-scanner.service.ts` 의 `PENDING_INSTALL_TTL_HOURS`,
 * 24시간)과 같은 값이다 — 두 흐름이 "App URL 이 OAuth 로 보내는 창"의 길이를 맞춘다. 한쪽을 바꾸면 다른 쪽도 본다.
 */
export const REINSTALL_REQUEST_TTL_HOURS = 24;

const REINSTALL_REQUEST_TTL_MS = REINSTALL_REQUEST_TTL_HOURS * 60 * 60 * 1000;

/**
 * 표시가 **지금 유효한가** — 표시가 있고 남긴 지 {@link REINSTALL_REQUEST_TTL_HOURS} 시간이 지나지 않았다. 경계는
 * 닫힌다: 정확히 24시간이 지난 표시는 무효다. 읽을 수 없는 값(NaN)도 무효로 본다(fail-closed).
 */
export function isReinstallRequestActive(
  row: Pick<Integration, 'reinstallRequestedAt'>,
  now: Date = new Date(),
): boolean {
  const requestedAt = row.reinstallRequestedAt;
  if (!requestedAt) return false;
  const age = now.getTime() - new Date(requestedAt).getTime();
  return Number.isFinite(age) && age < REINSTALL_REQUEST_TTL_MS;
}

/**
 * Cafe24 App URL 이 OAuth authorize 로 보내는 행인가 — 설치 대기이거나 유효한 재설치 요청 표시가 있다. 그 밖의
 * connected · error · expired 행은 App URL 을 post-install navigation(상세 화면 302)으로 본다.
 */
export function isInstallFlowRow(
  row: Pick<Integration, 'status' | 'reinstallRequestedAt'>,
  now: Date = new Date(),
): boolean {
  return row.status === 'pending_install' || isReinstallRequestActive(row, now);
}

/**
 * Cafe24 Private 행인가. 재설치 요청 표시를 남기는 행은 이것뿐이라, 표시를 근거로 인가 재판정을 건너뛰는 곳은 이 조건을
 * 함께 본다 — Public · MakeShop 행에 표시가 우연히 있어도 재판정한다(`assertRequesterStillAllowed`).
 */
export function isCafe24PrivateRow(
  row: Pick<Integration, 'serviceType' | 'credentials'>,
): boolean {
  return (
    row.serviceType === 'cafe24' && row.credentials?.app_type === 'private'
  );
}
