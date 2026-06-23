"use client";

import { useMemo } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";
import { useT } from "@/lib/i18n";
import { getWebhookBaseUrl } from "@/lib/utils/webhook-url";
import { buildWebChatSnippet } from "@/lib/web-chat/snippet";
import { getWidgetLoaderUrl } from "@/lib/web-chat/widget-base";
import { draftToBootInput } from "./snippet-input";
import type { WebChatDraft } from "./use-appearance-draft";

interface Props {
  endpointPath: string;
  draft: WebChatDraft;
}

export function InstallSnippetBox({ endpointPath, draft }: Props) {
  const t = useT();
  const copy = useCopyToClipboard();

  const snippet = useMemo(() => {
    const apiBase = getWebhookBaseUrl();
    const loaderUrl = getWidgetLoaderUrl();
    return buildWebChatSnippet(
      loaderUrl,
      draftToBootInput(draft, { apiBase, triggerEndpointPath: endpointPath }),
    );
  }, [draft, endpointPath]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("webChat.snippet.title")}</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void copy(snippet, {
              success: t("webChat.snippet.copied"),
              error: t("webChat.snippet.copyError"),
            })
          }
        >
          <Copy className="mr-1 h-4 w-4" />
          {t("webChat.snippet.copy")}
        </Button>
      </div>
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        {t("webChat.snippet.description")}
      </p>
      <pre className="overflow-x-auto rounded-md bg-[hsl(var(--muted))] p-3 text-xs leading-relaxed">
        <code>{snippet}</code>
      </pre>
    </section>
  );
}
