import { Sidebar } from "@/components/layout/sidebar";
import { AuthProvider } from "@/components/auth/auth-provider";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen">
        <Sidebar />
        <main className="pl-0 transition-all duration-200 min-[1280px]:pl-16 min-[1440px]:pl-60">
          <div className="p-6 pt-16 min-[1280px]:pt-6">{children}</div>
        </main>
      </div>
    </AuthProvider>
  );
}
