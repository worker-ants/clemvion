// (main) 세그먼트 내 notFound() 호출 시 — 사이드바를 유지한 404 페이지.
// spec/2-navigation/11-error-empty-states.md §1.3 "404 = 사이드바 표시".
import { ErrorPage } from "@/components/ui/error-page";

export default function MainNotFound() {
  return <ErrorPage variant="notFound" />;
}
