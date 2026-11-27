import { randomBytes } from 'crypto';

/**
 * 트리거 단위 토큰(`itk_*`, per_trigger)의 모양. [External Interaction API 토큰](CLE-EIA-TOKEN) 이 정한다.
 *
 * 이 파일은 `crypto` 말고는 import 하지 않는다. `TriggersService` 가 토큰을 만들려고 `interaction-token.service.ts`
 * 를 import 하면 TypeORM 엔티티 · ioredis · 메트릭 서비스까지 끌려 온다. 그래서 토큰 모양만 여기로 떼어 냈다
 * (NERV Task `CLE-T-1T7Y35`). 검증(`InteractionTokenService.verifyPerTrigger`)과 guard 의 접두사 판정도 이 상수를 쓴다.
 */

export const ITK_PREFIX = 'itk_';

/** 토큰 본문의 난수 바이트 수. hex 로 64자가 된다. */
const ITK_BYTES = 32;

/**
 * 새 트리거 단위 토큰(`itk_` + 32 bytes hex). 토큰에는 트리거 id 정보가 없다.
 *
 * 트리거 생성 · PATCH 의 첫 발급과 재발급(`TriggersService`)이 이 함수를 쓴다. `TriggersModule` 은
 * `ExternalInteractionModule` 을 import 하지 않아 DI 없이 부를 수 있는 함수로 둔다(NERV Task `CLE-T-EQDYC1`).
 */
export function newPerTriggerToken(): string {
  return `${ITK_PREFIX}${randomBytes(ITK_BYTES).toString('hex')}`;
}
