import { RegisterForm } from "@/components/auth/register-form";
import { fetchEnabledOauthProviders } from "@/lib/api/auth-providers";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invitationToken?: string }>;
}) {
  const [enabledProviders, params] = await Promise.all([
    fetchEnabledOauthProviders(),
    searchParams,
  ]);

  return (
    <RegisterForm
      enabledProviders={enabledProviders}
      invitationToken={params.invitationToken}
    />
  );
}
