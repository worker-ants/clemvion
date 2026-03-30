import { Sidebar } from "@/components/layout/sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="pl-60 transition-all duration-200">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
