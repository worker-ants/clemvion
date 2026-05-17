import { Sidebar } from "@/components/layout/sidebar";
import { AuthProvider } from "@/components/auth/auth-provider";
import { MainContent } from "@/components/layout/main-content";
import { SkipToMain } from "@/components/ui/skip-to-main";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen">
        {/* a11y: 첫 Tab 시 노출되어 키보드 사용자가 sidebar 를 건너뛰고
            main content 로 직행하게 한다. (Stage 10 NF-A11Y) */}
        <SkipToMain />
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
    </AuthProvider>
  );
}
