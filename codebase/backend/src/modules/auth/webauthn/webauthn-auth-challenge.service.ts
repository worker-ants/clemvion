import { Injectable } from '@nestjs/common';
import { RedisConnectionProvider } from '../../../common/redis/redis-connection.provider';

/** Passkey 인증 챌린지 사용 기록 키. 테스트가 import 해 문자열 중복 정의를 피한다. */
export const makeWebAuthnAuthChallengeKey = (challenge: string): string =>
  `auth:webauthn-auth-challenge:${challenge}`;

/**
 * 옵션 토큰 만료 시각(`exp`) 뒤로 기록을 더 남기는 시간(초). JWT 검증에는 시계 허용 오차가
 * 없어서 시계가 늦은 서버 인스턴스는 다른 인스턴스 기준으로 만료된 토큰도 받아 준다. 기록이
 * 그보다 먼저 사라지면 같은 챌린지를 다시 쓸 수 있다.
 */
export const WEBAUTHN_AUTH_CHALLENGE_EXPIRY_MARGIN_SEC = 60;

/**
 * 로그인 2단계 Passkey 인증 챌린지(`optionsToken` 의 `challenge`)를 한 번만 쓰게 하는 기록.
 * CLE-ACCT-SIGNIN 「Passkey 등록·인증 흐름」 (REQ-SIGNIN-030 · 068 · 069).
 *
 * `SET key 1 EX ttl NX` 단일 호출이라 여러 서버 인스턴스에서도 원자적이다. 같은 챌린지로
 * 동시에 온 요청 가운데 하나만 `true` 를 받는다. 기록은 만료 시각에 여유 시간
 * (`WEBAUTHN_AUTH_CHALLENGE_EXPIRY_MARGIN_SEC`, 60초)을 더한 때에 Redis TTL 로 사라지므로
 * 정리 작업이 없다.
 *
 * 다른 Redis 소비자(`ChatChannelDedupService` · `Cafe24InstallNonceCache`)와 달리
 * fail-open 하지 않는다. Redis 설정이 없거나 명령이 실패하면 예외를 그대로 던지고 호출자가
 * 503 으로 응답한다. 기록 없이 판정으로 보내면 같은 assertion 의 두 번째 요청이 counter
 * 역행으로 처분돼 credential 이 지워진다.
 */
@Injectable()
export class WebAuthnAuthChallengeService {
  constructor(private readonly redisConn: RedisConnectionProvider) {}

  /**
   * 챌린지를 쓴 것으로 기록한다.
   *
   * @param challenge 옵션 토큰의 `challenge`(base64url). 기록 키의 일부가 된다
   * @param expSec 옵션 토큰의 만료 시각(Unix 초)
   * @returns `true` = 처음 쓰는 챌린지(기록함) / `false` = 이미 쓴 챌린지
   * @throws Redis 설정 누락 · 명령 실패
   */
  async consume(challenge: string, expSec: number): Promise<boolean> {
    const nowSec = Math.floor(Date.now() / 1000);
    const ttlSec =
      Math.max(0, expSec - nowSec) + WEBAUTHN_AUTH_CHALLENGE_EXPIRY_MARGIN_SEC;
    const result = await this.redisConn
      .getClient()
      .set(makeWebAuthnAuthChallengeKey(challenge), '1', 'EX', ttlSec, 'NX');
    return result === 'OK';
  }
}
