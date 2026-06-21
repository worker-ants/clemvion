import { registerAs } from '@nestjs/config';

/**
 * External-interaction(iext_*) 토큰 HS256 secret namespace (refactor M-6 — Option B).
 *
 * 기존 `InteractionTokenService` 생성자의 `process.env.INTERACTION_JWT_SECRET` 직접 접근을
 * ConfigService 로 중앙화한다. `InteractionTokenService` 는 이미 `interaction.jwtSecret` 를
 * 조회하나 본 namespace 부재로 그동안 raw env fallback 만 작동했다 — 본 파일이 그 빈틈을 메운다.
 *
 * 동작 보존 계약 (중요):
 * - 미설정 시 `undefined` 를 노출한다(기본값 부여 금지). 서비스의
 *   `configService.get('interaction.jwtSecret') ?? configService.get('jwt.secret')` `??` 체인이
 *   `INTERACTION_JWT_SECRET` 미설정 시 `JWT_SECRET`(jwt namespace)으로 fallback 하도록 보존하기
 *   위함이다. `?? ''` 로 두면 빈 문자열이 non-nullish 라 fallback 체인이 깨진다.
 * - 프로덕션에서 둘 다 미설정이면 서비스 생성자가 fail-closed throw.
 *   SoT: spec/5-system/14-external-interaction-api.md §8.3.
 */
export const interactionConfig = registerAs('interaction', () => ({
  jwtSecret: process.env.INTERACTION_JWT_SECRET,
}));
