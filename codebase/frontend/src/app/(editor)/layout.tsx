import { Sidebar } from "@/components/layout/sidebar";
import { AuthProvider } from "@/components/auth/auth-provider";
import { EditorContent } from "@/components/layout/editor-content";

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="h-screen overflow-hidden">
        <Sidebar />
        <EditorContent>{children}</EditorContent>
      </div>
    </AuthProvider>
  );
}
