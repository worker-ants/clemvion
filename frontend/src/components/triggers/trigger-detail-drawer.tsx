"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { SlideDrawer } from "@/components/ui/slide-drawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { Loader2 } from "lucide-react";
import Link from "next/link";

interface TriggerDetail {
  id: string;
  name: string;
  type: "webhook" | "schedule" | "manual";
  active: boolean;
  workflowId: string;
  workflowName: string;
  endpoint?: string;
  httpMethod?: string;
  contentType?: string;
  cronExpression?: string;
  timezone?: string;
  nextRunAt?: string;
}

interface TriggerHistoryEntry {
  id: string;
  startedAt: string;
  status: string;
}

const TYPE_BADGE_STYLES: Record<string, string> = {
  webhook: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  schedule: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  manual: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

interface TriggerDetailDrawerProps {
  triggerId: string | null;
  open: boolean;
  onClose: () => void;
}

export function TriggerDetailDrawer({ triggerId, open, onClose }: TriggerDetailDrawerProps) {
  const { data: trigger, isLoading: isLoadingTrigger } = useQuery<TriggerDetail>({
    queryKey: ["trigger-detail", triggerId],
    queryFn: async () => {
      const res = await apiClient.get(`/triggers/${triggerId}`);
      return res.data.data ?? res.data;
    },
    enabled: !!triggerId && open,
  });

  const { data: history = [], isLoading: isLoadingHistory } = useQuery<TriggerHistoryEntry[]>({
    queryKey: ["trigger-history", triggerId],
    queryFn: async () => {
      const res = await apiClient.get(`/triggers/${triggerId}/history`, {
        params: { limit: "10" },
      });
      const responseData = res.data.data ?? res.data;
      return Array.isArray(responseData) ? responseData : responseData.items ?? [];
    },
    enabled: !!triggerId && open,
  });

  return (
    <SlideDrawer open={open} onClose={onClose} title="Trigger Details">
      {isLoadingTrigger ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : trigger ? (
        <div className="space-y-6">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-[hsl(var(--muted-foreground))]">Name</dt>
                  <dd className="font-medium">{trigger.name}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[hsl(var(--muted-foreground))]">Type</dt>
                  <dd>
                    <span
                      className={cn(
                        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                        TYPE_BADGE_STYLES[trigger.type],
                      )}
                    >
                      {trigger.type.charAt(0).toUpperCase() + trigger.type.slice(1)}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[hsl(var(--muted-foreground))]">Status</dt>
                  <dd>
                    <Badge variant={trigger.active ? "success" : "outline"}>
                      {trigger.active ? "Active" : "Inactive"}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[hsl(var(--muted-foreground))]">Workflow</dt>
                  <dd>
                    <Link
                      href={`/workflows/${trigger.workflowId}`}
                      className="text-[hsl(var(--primary))] hover:underline"
                    >
                      {trigger.workflowName}
                    </Link>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Webhook Details */}
          {trigger.type === "webhook" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Webhook Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  {trigger.endpoint && (
                    <div>
                      <dt className="text-[hsl(var(--muted-foreground))] mb-1">URL</dt>
                      <dd>
                        <code className="block break-all rounded bg-[hsl(var(--muted))] px-2 py-1.5 text-xs">
                          {trigger.endpoint}
                        </code>
                      </dd>
                    </div>
                  )}
                  {trigger.httpMethod && (
                    <div className="flex items-center justify-between">
                      <dt className="text-[hsl(var(--muted-foreground))]">HTTP Method</dt>
                      <dd>
                        <Badge variant="outline">{trigger.httpMethod}</Badge>
                      </dd>
                    </div>
                  )}
                  {trigger.contentType && (
                    <div className="flex items-center justify-between">
                      <dt className="text-[hsl(var(--muted-foreground))]">Content Type</dt>
                      <dd className="font-medium">{trigger.contentType}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Schedule Details */}
          {trigger.type === "schedule" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Schedule Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  {trigger.cronExpression && (
                    <div className="flex items-center justify-between">
                      <dt className="text-[hsl(var(--muted-foreground))]">Cron Expression</dt>
                      <dd>
                        <code className="rounded bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">
                          {trigger.cronExpression}
                        </code>
                      </dd>
                    </div>
                  )}
                  {trigger.timezone && (
                    <div className="flex items-center justify-between">
                      <dt className="text-[hsl(var(--muted-foreground))]">Timezone</dt>
                      <dd className="font-medium">{trigger.timezone}</dd>
                    </div>
                  )}
                  {trigger.nextRunAt && (
                    <div className="flex items-center justify-between">
                      <dt className="text-[hsl(var(--muted-foreground))]">Next Run</dt>
                      <dd className="font-medium">
                        {new Date(trigger.nextRunAt).toLocaleString()}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Recent History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Calls</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  No recent calls found.
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm"
                    >
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {new Date(entry.startedAt).toLocaleString()}
                      </span>
                      <Badge
                        variant={
                          entry.status === "success"
                            ? "success"
                            : entry.status === "error" || entry.status === "failed"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {entry.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Trigger not found.
        </p>
      )}
    </SlideDrawer>
  );
}
