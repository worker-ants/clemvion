import { registerAs } from '@nestjs/config';

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
   */
  publicBaseUrl:
    process.env.S3_PUBLIC_BASE_URL ||
    process.env.S3_ENDPOINT ||
    'http://localhost:9000',
}));
