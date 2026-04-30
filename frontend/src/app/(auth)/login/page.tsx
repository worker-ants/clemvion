import { LoginForm } from "@/components/auth/login-form";
import { fetchEnabledOauthProviders } from "@/lib/api/auth-providers";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const enabledProviders = await fetchEnabledOauthProviders();
  return <LoginForm enabledProviders={enabledProviders} />;
}
