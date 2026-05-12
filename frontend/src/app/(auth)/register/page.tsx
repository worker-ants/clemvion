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

  // `?invitationToken=` (값 없음) 케이스에서 빈 문자열이 form 으로 흘러가
  // `getByToken("")` 가 호출되는 사고를 막기 위해 정규화한다.
  const invitationToken = params.invitationToken?.trim() || undefined;

  return (
    <RegisterForm
      enabledProviders={enabledProviders}
      invitationToken={invitationToken}
    />
  );
}
