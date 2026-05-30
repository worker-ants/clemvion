"use client";

import dynamic from "next/dynamic";

// 채팅 shell 은 dynamic(ssr:false) 로 로드 → static export 의 prerender 단계에서도 SSR 제외.
// spec/7-channel-web-chat/1-widget-app §1.
const WidgetApp = dynamic(() => import("@/widget/widget-app"), { ssr: false });

export default function Page() {
  return <WidgetApp />;
}
