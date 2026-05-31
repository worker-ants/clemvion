// 루트 not-found — 매칭되지 않는 URL(앱 전역) 진입 시.
// 루트 layout 만 적용돼 사이드바는 없다 (인증/워크스페이스 컨텍스트 없는 미지의 경로).
// spec/2-navigation/11-error-empty-states.md §1.2 404.
import { ErrorPage } from "@/components/ui/error-page";

export default function NotFound() {
  return <ErrorPage variant="notFound" />;
}
