import type { NextConfig } from "next";

// 위젯 SPA — CSR 전용. spec/7-channel-web-chat/1-widget-app §1.
// - output:'export' → Node 서버 런타임 없는 정적 번들(`out/`). CDN 호스팅 + iframe 임베드.
// - SSR / 서버 컴포넌트 데이터 페칭 / Route Handlers / Server Actions 미사용.
// - 모든 UI 는 Client Component, 채팅 shell 은 dynamic(ssr:false) 로 prerender 제외.
const nextConfig: NextConfig = {
  output: "export",
  poweredByHeader: false,
  reactStrictMode: true,
  // 정적 export 는 next/image 최적화 서버가 없으므로 unoptimized.
  images: { unoptimized: true },
  // 위젯은 base path 하위(/web-chat/v1/app)로 서빙될 수 있음 — 배포 env 로 주입(0-architecture §4).
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
};

export default nextConfig;
