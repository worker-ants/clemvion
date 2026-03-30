"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import { Plus, Loader2, Inbox, Trash2, X } from "lucide-react";

interface Schedule {
  id: string;
  name: string;
  cronExpression: string;
  cronDescription?: string;
  timezone: string;
  active: boolean;
  nextRunAt?: string;
  workflowId: string;
  workflowName: string;
}

interface Workflow {
  id: string;
  name: string;
}

export default function SchedulesPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formWorkflowId, setFormWorkflowId] = useState("");
  const [formCron, setFormCron] = useState("");
  const [formTimezone, setFormTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  const { data: schedules = [], isLoading, isError } = useQuery<Schedule[]>({
    queryKey: ["schedules"],
    queryFn: async () => {
      const res = await apiClient.get("/schedules");
      return res.data.data ?? res.data;
    },
  });

  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ["workflows-list"],
    queryFn: async () => {
      const res = await apiClient.get("/workflows");
      return res.data.data ?? res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/schedules", {
        name: formName,
        workflowId: formWorkflowId,
        cronExpression: formCron,
        timezone: formTimezone,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule created");
      resetForm();
    },
    onError: () => {
      toast.error("Failed to create schedule");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await apiClient.patch(`/schedules/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule updated");
    },
    onError: () => {
      toast.error("Failed to update schedule");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule deleted");
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error("Failed to delete schedule");
    },
  });

  function resetForm() {
    setFormName("");
    setFormWorkflowId("");
    setFormCron("");
    setFormTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setShowDialog(false);
  }

  function handleCreate() {
    if (!formName.trim() || !formWorkflowId || !formCron.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    createMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Schedules</h1>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Schedule
        </Button>
      </div>

      {/* Create Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Schedule</h2>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="schedule-name">Name</Label>
                <Input
                  id="schedule-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My Schedule"
                />
              </div>
              <div>
                <Label htmlFor="schedule-workflow">Workflow</Label>
                <select
                  id="schedule-workflow"
                  className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                  value={formWorkflowId}
                  onChange={(e) => setFormWorkflowId(e.target.value)}
                >
                  <option value="">Select a workflow</option>
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.id}>
                      {wf.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="schedule-cron">Cron Expression</Label>
                <Input
                  id="schedule-cron"
                  value={formCron}
                  onChange={(e) => setFormCron(e.target.value)}
                  placeholder="0 * * * *"
                />
              </div>
              <div>
                <Label htmlFor="schedule-tz">Timezone</Label>
                <Input
                  id="schedule-tz"
                  value={formTimezone}
                  onChange={(e) => setFormTimezone(e.target.value)}
                  placeholder="Asia/Seoul"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Create
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-semibold">Delete Schedule</h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              Are you sure you want to delete this schedule? This action cannot
              be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget)}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-[hsl(var(--destructive))]">
          Failed to load schedules.
        </p>
      )}

      {!isLoading && !isError && schedules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Inbox className="mb-2 h-10 w-10" />
          <p className="text-sm">No schedules found.</p>
        </div>
      )}

      {!isLoading && !isError && schedules.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Cron</th>
                <th className="px-4 py-3 text-left font-medium">
                  Description
                </th>
                <th className="px-4 py-3 text-left font-medium">Next Run</th>
                <th className="px-4 py-3 text-left font-medium">Workflow</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {schedules.map((schedule) => (
                <tr key={schedule.id}>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block h-2.5 w-2.5 rounded-full",
                        schedule.active ? "bg-green-500" : "bg-gray-400",
                      )}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{schedule.name}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs">
                      {schedule.cronExpression}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {schedule.cronDescription ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {schedule.nextRunAt
                      ? new Date(schedule.nextRunAt).toLocaleString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3">{schedule.workflowName}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({
                            id: schedule.id,
                            active: !schedule.active,
                          })
                        }
                      >
                        {schedule.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[hsl(var(--destructive))]"
                        onClick={() => setDeleteTarget(schedule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
