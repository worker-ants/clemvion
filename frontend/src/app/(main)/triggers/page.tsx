"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import { Copy, Loader2, Inbox } from "lucide-react";
import Link from "next/link";

interface Trigger {
  id: string;
  name: string;
  type: "webhook" | "schedule" | "manual";
  active: boolean;
  workflowId: string;
  workflowName: string;
  endpoint?: string;
  lastTriggeredAt?: string;
}

const FILTER_TABS = ["all", "webhook", "schedule", "manual"] as const;
type FilterTab = (typeof FILTER_TABS)[number];

const TYPE_BADGE_STYLES: Record<string, string> = {
  webhook:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  schedule:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  manual:
    "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function TriggersPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const queryClient = useQueryClient();

  const { data: triggers = [], isLoading, isError } = useQuery<Trigger[]>({
    queryKey: ["triggers", activeTab],
    queryFn: async () => {
      const params = activeTab !== "all" ? { type: activeTab } : {};
      const res = await apiClient.get("/triggers", { params });
      return res.data.data ?? res.data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await apiClient.patch(`/triggers/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
      toast.success("Trigger updated");
    },
    onError: () => {
      toast.error("Failed to update trigger");
    },
  });

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Failed to copy"),
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Triggers</h1>

      <div className="flex gap-2">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-[hsl(var(--destructive))]">
          Failed to load triggers.
        </p>
      )}

      {!isLoading && !isError && triggers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Inbox className="mb-2 h-10 w-10" />
          <p className="text-sm">No triggers found.</p>
        </div>
      )}

      {!isLoading && !isError && triggers.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Workflow</th>
                <th className="px-4 py-3 text-left font-medium">Endpoint</th>
                <th className="px-4 py-3 text-left font-medium">Last Triggered</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {triggers.map((trigger) => (
                <tr key={trigger.id}>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block h-2.5 w-2.5 rounded-full",
                        trigger.active ? "bg-green-500" : "bg-gray-400",
                      )}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{trigger.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                        TYPE_BADGE_STYLES[trigger.type],
                      )}
                    >
                      {trigger.type.charAt(0).toUpperCase() + trigger.type.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/workflows/${trigger.workflowId}`}
                      className="text-[hsl(var(--primary))] hover:underline"
                    >
                      {trigger.workflowName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {trigger.type === "webhook" && trigger.endpoint ? (
                      <span className="inline-flex items-center gap-1">
                        <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs">
                          {trigger.endpoint}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(trigger.endpoint!)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    ) : (
                      <span className="text-[hsl(var(--muted-foreground))]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {trigger.lastTriggeredAt
                      ? new Date(trigger.lastTriggeredAt).toLocaleString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={toggleMutation.isPending}
                      onClick={() =>
                        toggleMutation.mutate({
                          id: trigger.id,
                          active: !trigger.active,
                        })
                      }
                    >
                      {trigger.active ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
