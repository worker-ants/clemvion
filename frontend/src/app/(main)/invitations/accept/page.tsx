import { Suspense } from "react";
import { AcceptInvitationContent } from "./accept-invitation-content";

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
