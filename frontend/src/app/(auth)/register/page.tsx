import { RegisterForm } from "@/components/auth/register-form";
import { fetchEnabledOauthProviders } from "@/lib/api/auth-providers";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const enabledProviders = await fetchEnabledOauthProviders();
  return <RegisterForm enabledProviders={enabledProviders} />;
}
