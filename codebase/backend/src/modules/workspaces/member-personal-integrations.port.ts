import type { ModuleRef } from '@nestjs/core';
import type { EntityManager } from 'typeorm';

/**
 * 멤버가 나가거나 제거될 때 그 사람의 개인 통합을 지우는 포트. 워크스페이스 모듈이 정의하고 통합 모듈이 구현한다
 * (`MemberPersonalIntegrationsPurgerService`).
 *
 * **토큰으로 지연 해석한다.** `IntegrationsModule` 이 `WorkspacesModule` 을 import 하므로 워크스페이스 서비스가 통합
 * 서비스를 직접 주입받으면 순환 의존이다. 트리거 정리 포트(`TRIGGER_RESOURCE_RELEASER`)와 같은 방식으로 호출자가
 * `ModuleRef.get(TOKEN, { strict: false })` 로 찾는다. 못 찾으면 던지고, 호출자는 트랜잭션을 열기 전에 해석하므로 나가기 ·
 * 제거 전체가 실패하고 멤버십도 남는다. 조용히 넘어가면 나간 멤버의 개인 통합이 다시 남기 때문이다. 해석은
 * {@link resolveMemberPersonalIntegrationsPurger} 한 곳에서만 한다.
 *
 * 두 단계다. 트랜잭션 안 삭제({@link MemberPersonalIntegrationsPurger.purgeInTransaction})와 커밋 뒤 후처리
 * ({@link MemberPersonalIntegrationsPurger.finishAfterCommit})를 나눠 워크스페이스 서비스가 커밋 뒤에 두 번째를 부른다.
 * 근거: [통합 데이터와 흐름 「멤버가 나가거나 제거될 때」](CLE-INT-DATA#멤버가-나가거나-제거될-때)
 */
export const MEMBER_PERSONAL_INTEGRATIONS_PURGER = Symbol(
  'MEMBER_PERSONAL_INTEGRATIONS_PURGER',
);

/** 트랜잭션 안에서 지운 개인 통합. 커밋 뒤 감사 행의 `details` 와 캐시 무효화에 쓴다. */
export interface PurgedPersonalIntegration {
  id: string;
  serviceType: string;
  name: string;
}

/** 감사 행에 싣는 나가기 · 제거의 맥락. 키는 `member.removed` 감사의 `details` 와 같다. */
export interface MemberDeparture {
  workspaceId: string;
  /** 감사 행의 행위자. 나가기면 나간 멤버, 제거면 제거한 관리자다. */
  actorUserId: string;
  mode: 'left' | 'removed';
  memberUserId: string;
}

export interface MemberPersonalIntegrationsPurger {
  /**
   * 그 워크스페이스에서 그 사용자가 통합 소유자인 개인 통합을 상태와 사용처에 관계없이 모두 지우고 지운 행을 돌려준다.
   * 멤버십 DELETE 가 1행을 지운 **같은 트랜잭션**에서, 그 DELETE **뒤에** 부른다. 잠금 순서는 멤버십 다음 통합이다.
   */
  purgeInTransaction(
    manager: EntityManager,
    member: { workspaceId: string; userId: string },
  ): Promise<PurgedPersonalIntegration[]>;
  /**
   * 커밋 뒤에 부른다. 지운 통합마다 `integration.deleted` 감사를 남기고 캐시를 무효화한다. **던지지 않는다.** 삭제는
   * 이미 커밋됐고, 그 사이 창은 실행 판정(REQ-INTMGMT-058)이 막는다.
   */
  finishAfterCommit(
    purged: readonly PurgedPersonalIntegration[],
    departure: MemberDeparture,
  ): Promise<void>;
}

/** 포트를 지연 해석한다. 못 찾으면 `ModuleRef.get` 이 던지고 그 오류를 삼키지 않는다(나가기 · 제거가 실패한다). */
export function resolveMemberPersonalIntegrationsPurger(
  moduleRef: Pick<ModuleRef, 'get'>,
): MemberPersonalIntegrationsPurger {
  return moduleRef.get<MemberPersonalIntegrationsPurger>(
    MEMBER_PERSONAL_INTEGRATIONS_PURGER,
    { strict: false },
  );
}
