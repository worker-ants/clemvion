"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ServiceIcon } from "./service-icons";
import type { ServiceDefinition } from "@/lib/api/integrations";

interface Props {
  services: ServiceDefinition[];
  onClose: () => void;
}

export function ServicePickerModal({ services, onClose }: Props) {
  const router = useRouter();

  const pick = (type: string) => {
    router.push(`/integrations/new?service=${type}&step=auth`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Integration</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
          Select a service to connect.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {services.map((s) => (
            <button
              key={s.type}
              type="button"
              onClick={() => pick(s.type)}
              className="flex flex-col items-center gap-2 rounded-lg border border-[hsl(var(--border))] p-4 text-sm font-medium transition-colors hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]"
            >
              <ServiceIcon type={s.type} className="h-6 w-6" />
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
