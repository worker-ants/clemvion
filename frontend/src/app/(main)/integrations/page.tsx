"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Inbox,
  Trash2,
  X,
  Zap,
  Globe,
  GitBranch,
  Mail,
  Database,
  MessageSquare,
  Search,
  RefreshCw,
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  serviceType: string;
  authType: string;
  status: "connected" | "expired" | "error";
  scope?: "personal" | "organization";
}

type ScopeFilter = "all" | "personal" | "organization";

const SERVICE_TYPES = [
  "Slack",
  "Google",
  "GitHub",
  "HTTP",
  "Database",
  "Email",
] as const;

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  Slack: <MessageSquare className="h-6 w-6" />,
  Google: <Globe className="h-6 w-6" />,
  GitHub: <GitBranch className="h-6 w-6" />,
  HTTP: <Zap className="h-6 w-6" />,
  Database: <Database className="h-6 w-6" />,
  Email: <Mail className="h-6 w-6" />,
};

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  connected: { dot: "bg-green-500", label: "Connected" },
  expired: { dot: "bg-yellow-500", label: "Expired" },
  error: { dot: "bg-red-500", label: "Error" },
};

const SCOPE_OPTIONS: { value: ScopeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "personal", label: "Personal" },
  { value: "organization", label: "Organization" },
];

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [formName, setFormName] = useState("");
  const [formServiceType, setFormServiceType] = useState("");
  const [formAuthType, setFormAuthType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");

  const { data: integrations = [], isLoading, isError } = useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: async () => {
      const res = await apiClient.get("/integrations");
      return res.data.data ?? res.data;
    },
  });

  const filteredIntegrations = useMemo(() => {
    return integrations.filter((integration) => {
      const matchesSearch =
        !searchQuery.trim() ||
        integration.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesScope =
        scopeFilter === "all" || integration.scope === scopeFilter;
      return matchesSearch && matchesScope;
    });
  }, [integrations, searchQuery, scopeFilter]);

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/integrations", {
        name: formName,
        serviceType: formServiceType,
        authType: formAuthType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integration added");
      resetForm();
    },
    onError: () => {
      toast.error("Failed to add integration");
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/integrations/${id}/test`);
    },
    onSuccess: () => {
      toast.success("Connection test successful");
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: () => {
      toast.error("Connection test failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/integrations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integration deleted");
    },
    onError: () => {
      toast.error("Failed to delete integration");
    },
  });

  const reauthorizeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/integrations/${id}/reauthorize`);
      return res.data.data ?? res.data;
    },
    onSuccess: (data: { authUrl?: string; state?: string }) => {
      if (data.authUrl) {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        window.open(
          data.authUrl,
          "reauthorize",
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
        );
        toast.success("Reauthorization window opened");
      } else {
        toast.success("Reauthorization initiated");
        queryClient.invalidateQueries({ queryKey: ["integrations"] });
      }
    },
    onError: () => {
      toast.error("Failed to reauthorize integration");
    },
  });

  const handleReauthorize = useCallback(
    (id: string) => {
      reauthorizeMutation.mutate(id);
    },
    [reauthorizeMutation],
  );

  function resetForm() {
    setFormName("");
    setFormServiceType("");
    setFormAuthType("");
    setShowDialog(false);
  }

  function handleCreate() {
    if (!formName.trim() || !formServiceType || !formAuthType.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    createMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Integrations</h1>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </div>

      {/* Search & Scope Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <Input
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="inline-flex rounded-lg border border-[hsl(var(--border))] p-1">
          {SCOPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                scopeFilter === option.value
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
              )}
              onClick={() => setScopeFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Add Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Integration</h2>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="int-service">Service Type</Label>
                <select
                  id="int-service"
                  className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                  value={formServiceType}
                  onChange={(e) => setFormServiceType(e.target.value)}
                >
                  <option value="">Select a service</option>
                  {SERVICE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="int-name">Name</Label>
                <Input
                  id="int-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My Integration"
                />
              </div>
              <div>
                <Label htmlFor="int-auth">Auth Type</Label>
                <Input
                  id="int-auth"
                  value={formAuthType}
                  onChange={(e) => setFormAuthType(e.target.value)}
                  placeholder="OAuth2, API Key, etc."
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
                  Add
                </Button>
              </div>
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
          Failed to load integrations.
        </p>
      )}

      {!isLoading && !isError && integrations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Inbox className="mb-2 h-10 w-10" />
          <p className="text-sm">No integrations found.</p>
        </div>
      )}

      {!isLoading && !isError && integrations.length > 0 && filteredIntegrations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Search className="mb-2 h-10 w-10" />
          <p className="text-sm">No integrations match your filters.</p>
        </div>
      )}

      {!isLoading && !isError && filteredIntegrations.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredIntegrations.map((integration) => {
            const statusInfo = STATUS_STYLES[integration.status] ?? STATUS_STYLES.error;
            const needsReauth =
              integration.status === "expired" || integration.status === "error";
            return (
              <Card key={integration.id}>
                <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                  <div className="rounded-lg border border-[hsl(var(--border))] p-2">
                    {SERVICE_ICONS[integration.serviceType] ?? (
                      <Zap className="h-6 w-6" />
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">
                      {integration.name}
                    </CardTitle>
                    <CardDescription>{integration.authType}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          statusInfo.dot,
                        )}
                      />
                      {statusInfo.label}
                    </span>
                    <div className="flex gap-1">
                      {needsReauth && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={reauthorizeMutation.isPending}
                          onClick={() => handleReauthorize(integration.id)}
                        >
                          {reauthorizeMutation.isPending ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-1 h-3 w-3" />
                          )}
                          Reauthorize
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={testMutation.isPending}
                        onClick={() => testMutation.mutate(integration.id)}
                      >
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[hsl(var(--destructive))]"
                        onClick={() => deleteMutation.mutate(integration.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
