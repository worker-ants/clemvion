import { CallbackContent } from "./callback-content";

export default async function CallbackPage({
  searchParams,
}: {
  // decision A (2026-05-31) — OAuth 콜백 URL 에 access token 을 싣지 않는다.
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;

  return <CallbackContent success={params.success} error={params.error} />;
}
