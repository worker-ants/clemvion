import { notFound } from "next/navigation";
import { isDemoEnabled } from "./demo-config";
import DemoHost from "./demo-host";

// dev 전용 데모 라우트 게이트. production static export(`next build`)에서는 notFound 로 제외하고,
// dev(`next dev`)에서는 노출한다. prod 미리보기는 opt-in `NEXT_PUBLIC_ENABLE_DEMO=1` 로만.
// 본 페이지는 렌더 분기만 하는 (layout.tsx 와 동일한) 서버 컴포넌트이며, 실제 UI/브라우저 로직은
// client DemoHost 가 담당해 위젯 본체의 CSR-only 원칙(1-widget-app §1)을 침범하지 않는다.
export default function DemoPage() {
  if (
    !isDemoEnabled({
      nodeEnv: process.env.NODE_ENV,
      enableFlag: process.env.NEXT_PUBLIC_ENABLE_DEMO,
    })
  ) {
    notFound();
  }
  return <DemoHost />;
}
