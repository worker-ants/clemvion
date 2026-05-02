"use client";

import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { knowledgeBasesApi } from "@/lib/api/knowledge-bases";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

interface EmbeddingTestButtonProps {
  /**
   * 폼 state 의 LLMConfig id. 빈 문자열은 undefined 로 변환되어 워크스페이스 default 로
   * 폴백한다.
   */
  llmConfigId?: string;
  /** 폼 state 의 임베딩 모델 식별자. 비어 있으면 버튼 비활성. */
  embeddingModel: string;
  /**
   * 기존 KB 의 임베딩 차원. create 폼에서는 undefined.
   * - undefined / null: 새 KB → "차원: N" 으로만 표시
   * - 같음: "차원: N (기존과 동일)" 초록
   * - 다름: "차원: A→B. 재임베딩 필요" 노란/주황
   */
  currentDimension?: number | null;
}

interface ProbeError {
  isAxiosError?: boolean;
  response?: { data?: { message?: string; error?: { message?: string } } };
  message?: string;
}

function extractMessage(err: unknown): string {
  const e = err as ProbeError;
  return (
    e?.response?.data?.error?.message ??
    e?.response?.data?.message ??
    e?.message ??
    "Unknown error"
  );
}

export function EmbeddingTestButton({
  llmConfigId,
  embeddingModel,
  currentDimension,
}: EmbeddingTestButtonProps) {
  const t = useT();

  const mutation = useMutation({
    mutationFn: () =>
      knowledgeBasesApi.probeEmbedding({
        llmConfigId: llmConfigId || undefined,
        embeddingModel,
      }),
  });

  // llmConfigId / 모델이 바뀌면 이전 결과는 더 이상 유효하지 않으므로 reset.
  useEffect(() => {
    mutation.reset();
    // mutation 인스턴스는 안정적이지만 ESLint 경고 회피를 위해 reset 만 의도적으로 deps 에서 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llmConfigId, embeddingModel]);

  const disabled = !embeddingModel || mutation.isPending;

  return (
    <div className="flex flex-col gap-1.5">
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending && (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          )}
          {t("knowledgeBases.embeddingTestButton")}
        </Button>
      </div>
      {renderResult({
        t,
        mutation,
        currentDimension,
      })}
    </div>
  );
}

function renderResult({
  t,
  mutation,
  currentDimension,
}: {
  t: ReturnType<typeof useT>;
  mutation: ReturnType<typeof useMutation<{ dimension: number }>>;
  currentDimension?: number | null;
}) {
  if (mutation.isPending) {
    return (
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        {t("knowledgeBases.embeddingTestPending")}
      </p>
    );
  }
  if (mutation.isError) {
    return (
      <p className="flex items-start gap-1 text-xs text-[hsl(var(--destructive))]">
        <X className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          {t("knowledgeBases.embeddingTestFailed", {
            message: extractMessage(mutation.error),
          })}
        </span>
      </p>
    );
  }
  if (mutation.isSuccess && mutation.data) {
    const probed = mutation.data.dimension;
    if (currentDimension == null) {
      return (
        <p className="flex items-center gap-1 text-xs text-[hsl(var(--success,142_72%_29%))]">
          <Check className="h-3 w-3" />
          {t("knowledgeBases.embeddingDimensionNew", { dim: probed })}
        </p>
      );
    }
    if (probed === currentDimension) {
      return (
        <p className="flex items-center gap-1 text-xs text-[hsl(var(--success,142_72%_29%))]">
          <Check className="h-3 w-3" />
          {t("knowledgeBases.embeddingDimensionSame", { dim: probed })}
        </p>
      );
    }
    return (
      <p className="flex items-start gap-1 text-xs text-[hsl(var(--warning,38_92%_50%))]">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          {t("knowledgeBases.embeddingDimensionMismatch", {
            old: currentDimension,
            new: probed,
          })}
        </span>
      </p>
    );
  }
  return (
    <p className="text-xs text-[hsl(var(--muted-foreground))]">
      {t("knowledgeBases.embeddingTestIdle")}
    </p>
  );
}
