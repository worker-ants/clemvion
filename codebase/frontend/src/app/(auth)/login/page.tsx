import { LoginForm } from "@/components/auth/login-form";
import { fetchEnabledOauthProviders } from "@/lib/api/auth-providers";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const [enabledProviders, params] = await Promise.all([
    fetchEnabledOauthProviders(),
    searchParams,
  ]);

  // `?redirect=` 가 여러 번 오면 값이 배열이다. 하나로 정할 수 없으므로 없는 것으로 본다.
  const redirect =
    typeof params.redirect === "string" ? params.redirect : undefined;

  return <LoginForm enabledProviders={enabledProviders} redirect={redirect} />;
}
