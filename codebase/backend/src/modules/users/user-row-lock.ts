import { EntityManager } from 'typeorm';

import { User } from './entities/user.entity';
import { setLocalLockTimeout } from '../triggers/trigger-config-lock';

/**
 * 사용자 행 잠금의 대기 상한. 같은 사용자의 Passkey 등록 저장 · 삭제 · 복구 코드 재발급 · 복구 코드 사용 ·
 * Passkey 인증이 이 잠금에서 줄을 선다. 잠금을 잡은 쪽은 외부 호출 없이 몇 문장만 돌고 끝나서 짧다.
 * 넘기면 `55P03` 으로 아무것도 바꾸지 않고 실패한다(500).
 */
export const USER_ROW_LOCK_TIMEOUT_MS = 5_000;

/**
 * 사용자 행을 `SELECT … FOR NO KEY UPDATE` 로 잠근다. 트랜잭션 안에서만 부른다.
 *
 * `user.webauthn_recovery_codes` 를 읽고 쓰는 경로와 그 판단에 쓰는 `webauthn_credential` 개수를 바꾸는
 * 경로가 같은 사용자끼리 이 잠금에서 차례로 돈다([Passkey 기능과 등록 「Passkey 삭제」](CLE-ACCT-SIGNIN-PASSKEY#passkey-삭제)).
 * credential 행도 잠그는 경로는 이 잠금을 먼저 잡는다(사용자 행 → credential). 순서가 뒤집히면 삭제와 교착한다.
 *
 * `FOR UPDATE` 는 `webauthn_credential` INSERT 의 외래 키 검사(`FOR KEY SHARE`)까지 막는다.
 * `FOR NO KEY UPDATE` 는 같은 사용자끼리만 줄을 세우고 자식 행 INSERT 는 막지 않는다.
 *
 * 대기 상한({@link USER_ROW_LOCK_TIMEOUT_MS})은 `SET LOCAL` 이라 이 트랜잭션의 뒤따르는 잠금 대기에도 걸린다.
 *
 * @returns 행이 있으면 true. 없으면(탈퇴 중) 잠글 것이 없어 false 다. 그때 등록 저장은 외래 키 제약이 막고,
 *   credential 은 이미 함께 지워져(ON DELETE CASCADE) 삭제는 404 다.
 */
export async function lockUserRow(
  manager: EntityManager,
  userId: string,
): Promise<boolean> {
  await setLocalLockTimeout(manager, USER_ROW_LOCK_TIMEOUT_MS);
  const row = await manager.getRepository(User).findOne({
    where: { id: userId },
    select: { id: true },
    lock: { mode: 'for_no_key_update' },
  });
  return row !== null;
}
