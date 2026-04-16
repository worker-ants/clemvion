"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  knowledgeBasesApi,
  type KnowledgeBaseData,
} from "@/lib/api/knowledge-bases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleGate } from "@/components/auth/role-gate";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Inbox,
  Trash2,
  X,
  BookOpen,
  FileText,
} from "lucide-react";

export default function KnowledgeBasesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEmbeddingModel, setFormEmbeddingModel] = useState(
    "text-embedding-3-small",
  );
  const [formChunkSize, setFormChunkSize] = useState("1000");
  const [formChunkOverlap, setFormChunkOverlap] = useState("200");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: () => knowledgeBasesApi.getAll(),
  });
  const collections: KnowledgeBaseData[] = data?.data ?? data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      knowledgeBasesApi.create({
        name: formName,
        description: formDescription || undefined,
        embeddingModel: formEmbeddingModel,
        chunkSize: parseInt(formChunkSize) || 1000,
        chunkOverlap: parseInt(formChunkOverlap) || 200,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      toast.success("Collection created");
      resetForm();
    },
    onError: () => toast.error("Failed to create collection"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => knowledgeBasesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      toast.success("Collection deleted");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete collection"),
  });

  function resetForm() {
    setShowDialog(false);
    setFormName("");
    setFormDescription("");
    setFormEmbeddingModel("text-embedding-3-small");
    setFormChunkSize("1000");
    setFormChunkOverlap("200");
  }

  function handleCreate() {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }
    createMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Knowledge Base</h1>
        <RoleGate minRole="editor">
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Collection
          </Button>
        </RoleGate>
      </div>

      {/* Create Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Collection</h2>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Customer Support FAQ"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description..."
                />
              </div>
              <div>
                <Label>Embedding Model</Label>
                <Input
                  value={formEmbeddingModel}
                  onChange={(e) => setFormEmbeddingModel(e.target.value)}
                  placeholder="text-embedding-3-small"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Chunk Size</Label>
                  <Input
                    type="number"
                    min="100"
                    max="8000"
                    value={formChunkSize}
                    onChange={(e) => setFormChunkSize(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Chunk Overlap</Label>
                  <Input
                    type="number"
                    min="0"
                    max="2000"
                    value={formChunkOverlap}
                    onChange={(e) => setFormChunkOverlap(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
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
            <h2 className="mb-2 text-lg font-semibold">Delete Collection</h2>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              This will delete all documents and embeddings. This action cannot
              be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget)}
              >
                {deleteMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
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
          Failed to load knowledge bases.
        </p>
      )}
      {!isLoading && !isError && collections.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[hsl(var(--muted-foreground))]">
          <Inbox className="mb-2 h-10 w-10" />
          <p className="text-sm">No collections yet.</p>
        </div>
      )}
      {!isLoading && !isError && collections.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((kb) => (
            <div
              key={kb.id}
              className="cursor-pointer rounded-lg border border-[hsl(var(--border))] p-4 transition-colors hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--muted)/0.3)]"
              onClick={() => router.push(`/knowledge-bases/${kb.id}`)}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[hsl(var(--primary))]" />
                  <h3 className="font-semibold">{kb.name}</h3>
                </div>
                <RoleGate minRole="editor">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-[hsl(var(--destructive))]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(kb.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </RoleGate>
              </div>
              {kb.description && (
                <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {kb.description}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {kb.documentCount} docs
                </span>
                <span className="font-mono">{kb.embeddingModel}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
