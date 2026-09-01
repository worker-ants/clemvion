import { registerAs } from '@nestjs/config';

import { isPrivateHost } from '../utils/ssrf.util';

/**
 * 아바타 공개 URL base 의 폴백 규칙 — **이 함수가 SoT 다.**
 *
 * `main.ts` 의 production 부팅 경고도 같은 값을 봐야 한다. 처음에는 그쪽이 규칙을 손으로
 * 다시 적었는데 마지막 항이 `''` 였다 — 두 env 가 **모두 미설정**이면 앱은 여기 기본값인
 * `http://localhost:9000` 을 서빙하는데 경고는 빈 문자열을 보고 침묵했다. 즉 **가드가
 * 정확히 기본값 케이스를 놓쳤다**(리뷰 4라운드). 규칙이 두 곳에 있으면 이렇게 갈린다.
 *
 * `||`(falsy)를 쓰는 것도 의도다 — 빈 문자열로 설정된 env 는 미설정과 같게 다뤄야 한다.
 * `??`(nullish)면 `S3_PUBLIC_BASE_URL=` 이 빈 base 로 통과한다.
 */
export function resolvePublicBaseUrl(env: NodeJS.ProcessEnv): string {
  return env.S3_PUBLIC_BASE_URL || env.S3_ENDPOINT || 'http://localhost:9000';
}

/**
 * production 부팅 시 아바타 공개 base 가 브라우저에서 도달 불가능한 주소인지.
 *
 * `main.ts` 가 이 값으로 경고를 낸다. **판정을 순수 함수로 뺀 이유**는 리뷰 6라운드가
 * `main.ts` 안의 조합(`NODE_ENV==='production' && isPrivateHost(resolve…)`)을
 * `if (false && …)` 로 뮤테이션해도 85건이 전부 GREEN 임을 실측했기 때문이다 — 부트스트랩
 * 본문은 유닛으로 붙잡기 어렵다. 조합을 여기로 옮기면 그 자체를 테스트로 고정할 수 있다.
 *
 * `throw` 가 아니라 `warn` 인 판단은 호출자(`main.ts`)의 몫이다 — 단일 호스트·사내망
 * self-host 는 사설 주소가 정답일 수 있다(`ALLOW_PRIVATE_HOST_TARGETS` 와 같은 정책).
 */
export function shouldWarnPublicBaseIsPrivate(env: NodeJS.ProcessEnv): boolean {
  if (env.NODE_ENV !== 'production') return false;
  const base = resolvePublicBaseUrl(env);
  return Boolean(base) && isPrivateHost(base);
}

export const s3Config = registerAs('s3', () => ({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
  bucket: process.env.S3_BUCKET || 'workflow-storage',
  region: process.env.S3_REGION || 'us-east-1',
  /**
   * 공개 오브젝트를 브라우저가 가져갈 때 쓰는 base URL.
   *
   * **`endpoint` 와 같은 값이 아닐 수 있다** — `endpoint` 는 백엔드가 SDK 로 접속하는
   * 내부 주소(`http://minio:9000` 같은 컨테이너 호스트명)이고, 이 값은 **브라우저가
   * 도달할 수 있어야** 한다(CDN·공개 도메인). 미설정 시 `endpoint` 로 폴백하는데,
   * 그건 단일 호스트 개발 환경에서만 맞는 가정이다.
   *
   * SoT: `spec/2-navigation/9-user-profile.md` §6.1 아바타 업로드.
   *
   * **주의**: 그 §6.1 은 이 글을 쓰는 시점에 아직 "미구현 (Planned)" 로 남아 있다 —
   * spec 쓰기가 planner 트랙이라 배지 flip 을 분리했다
   * (`plan/in-progress/spec-update-avatar-upload-implemented.md`). 구현은 이미 있다.
   */
  publicBaseUrl: resolvePublicBaseUrl(process.env),
}));
