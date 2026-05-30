import type { ReactNode } from "react";

// 최소 root layout. 위젯은 iframe 내부 전체를 차지하므로 별도 chrome 없음.
export const metadata = {
  title: "Channel Web Chat Widget",
  // 위젯 문서는 검색 노출 불필요.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, background: "transparent" }}>{children}</body>
    </html>
  );
}
