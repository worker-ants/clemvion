import { CallbackContent } from "./callback-content";

export default async function CallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; token?: string }>;
}) {
  const params = await searchParams;

  return (
    <CallbackContent
      success={params.success}
      error={params.error}
      token={params.token}
    />
  );
}
