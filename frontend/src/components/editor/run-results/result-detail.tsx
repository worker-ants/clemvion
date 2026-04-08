"use client";

import { useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  MinusCircle,
  PauseCircle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_COLORS, getNodeDefinition } from "@/lib/node-definitions";
import type {
  NodeResult,
  ConversationItem,
} from "@/lib/stores/execution-store";
import { getWsClient } from "@/lib/websocket/ws-client";
import { PresentationContent } from "./renderers/presentation-renderers";
import { GenericRenderer } from "./renderers/generic-renderer";
import { DynamicFormUI } from "./dynamic-form-ui";
import { ButtonBar } from "./button-bar";
import { ConversationInspector } from "./conversation-inspector";
import { parseHistoryMessages } from "./conversation-utils";
import { formatDuration } from "./utils";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "running":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-300"
        >
          <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
          Running
        </Badge>
      );
    case "completed":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-green-600 border-green-300"
        >
          <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
          Done
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-red-600 border-red-300"
        >
          <XCircle className="h-2.5 w-2.5 mr-0.5" />
          Failed
        </Badge>
      );
    case "skipped":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-gray-500 border-gray-300"
        >
          <MinusCircle className="h-2.5 w-2.5 mr-0.5" />
          Skipped
        </Badge>
      );
    case "waiting_for_input":
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300"
        >
          <PauseCircle className="h-2.5 w-2.5 mr-0.5" />
          Waiting
        </Badge>
      );
    default:
      return null;
  }
}

interface ResultDetailProps {
  result: NodeResult | null;
  isWaitingForm: boolean;
  formConfig: unknown;
  isWaitingButtons: boolean;
  buttonConfig: unknown;
  isWaitingConversation: boolean;
  conversationConfig: unknown;
  conversationMessages: ConversationItem[];
  selectedConversationItemIndex: number | null;
  isWaitingAiResponse: boolean;
  executionId: string | null;
  onFormSubmit: () => void;
  onButtonClick: () => void;
  onConversationEnd: () => void;
  onSendMessage: (message: string) => void;
}

export function ResultDetail({
  result,
  isWaitingForm,
  formConfig,
  isWaitingButtons,
  buttonConfig,
  isWaitingConversation,
  conversationConfig,
  conversationMessages,
  selectedConversationItemIndex,
  isWaitingAiResponse,
  executionId,
  onFormSubmit,
  onButtonClick,
  onConversationEnd,
  onSendMessage,
}: ResultDetailProps) {
  const handleFormSubmit = useCallback(
    (data: Record<string, unknown>) => {
      if (!executionId) return;
      const client = getWsClient();
      client.emit("execution.submit_form", {
        executionId,
        formData: data,
      });
      onFormSubmit();
    },
    [executionId, onFormSubmit],
  );

  const handlePortButtonClick = useCallback(
    (buttonId: string) => {
      if (!executionId) return;
      const client = getWsClient();
      client.emit("execution.click_button", {
        executionId,
        buttonId,
      });
      onButtonClick();
    },
    [executionId, onButtonClick],
  );

  const handleContinueClick = useCallback(() => {
    if (!executionId) return;
    const client = getWsClient();
    client.emit("execution.click_button", {
      executionId,
      buttonId: "__continue__",
    });
    onButtonClick();
  }, [executionId, onButtonClick]);

  const handleLinkButtonClick = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const handleSendMessage = useCallback(
    (message: string) => {
      if (!executionId || !result) return;
      onSendMessage(message);
      const client = getWsClient();
      client.emit("execution.submit_message", {
        executionId,
        nodeId: result.nodeId,
        message,
      });
    },
    [executionId, result, onSendMessage],
  );

  const handleEndConversation = useCallback(() => {
    if (!executionId || !result) return;
    const client = getWsClient();
    client.emit("execution.end_conversation", {
      executionId,
      nodeId: result.nodeId,
    });
    onConversationEnd();
  }, [executionId, result, onConversationEnd]);

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
        Select a node to view details
      </div>
    );
  }

  const definition = getNodeDefinition(result.nodeType);
  const categoryColor =
    CATEGORY_COLORS[result.nodeCategory] ?? "#6B7280";
  const isPresentation = result.nodeCategory === "presentation";

  // Check for completed multi-turn conversation (history mode)
  const isCompletedConversation =
    result.nodeType === "ai_agent" &&
    result.status === "completed" &&
    !!(result.outputData as Record<string, unknown> | null)?.messages;

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: categoryColor }}
        />
        <span className="text-sm font-medium">{result.nodeLabel}</span>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {definition?.label ?? result.nodeType}
        </span>
        <StatusBadge status={result.status} />
        {result.duration != null && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {formatDuration(result.duration)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isWaitingForm && formConfig ? (
          <div className="h-full overflow-y-auto p-3">
            <DynamicFormUI
              formConfig={formConfig as Record<string, unknown>}
              onSubmit={handleFormSubmit}
            />
          </div>
        ) : isWaitingConversation ? (
          <ConversationInspector
            result={result}
            conversationMessages={conversationMessages}
            selectedItemIndex={selectedConversationItemIndex}
            isLive={true}
            isWaitingAiResponse={isWaitingAiResponse}
            conversationConfig={conversationConfig}
            onSendMessage={handleSendMessage}
            onEndConversation={handleEndConversation}
          />
        ) : isWaitingButtons && buttonConfig ? (
          <div className="h-full overflow-y-auto p-3">
            {isPresentation ? (
              <PresentationContent
                result={result}
                onPortButtonClick={handlePortButtonClick}
                onLinkButtonClick={handleLinkButtonClick}
              />
            ) : (
              <ButtonBar
                buttons={
                  ((buttonConfig as Record<string, unknown>).buttons as Array<{
                    id: string;
                    label: string;
                    type: "link" | "port";
                    url?: string;
                    style?: "primary" | "secondary" | "outline" | "danger";
                  }>) ?? []
                }
                timeout={
                  (buttonConfig as Record<string, unknown>).timeout as
                    | number
                    | undefined
                }
                timeoutAction={
                  (buttonConfig as Record<string, unknown>).timeoutAction as
                    | "continue"
                    | "cancel"
                    | undefined
                }
                onPortButtonClick={handlePortButtonClick}
                onLinkButtonClick={handleLinkButtonClick}
                onContinueClick={handleContinueClick}
              />
            )}
          </div>
        ) : isCompletedConversation ? (
          <ConversationInspector
            result={result}
            conversationMessages={parseHistoryMessages(result.outputData)}
            selectedItemIndex={selectedConversationItemIndex}
            isLive={false}
            isWaitingAiResponse={false}
            conversationConfig={null}
            onSendMessage={() => {}}
            onEndConversation={() => {}}
          />
        ) : isPresentation && result.status === "completed" ? (
          <div className="h-full overflow-y-auto p-3">
            <PresentationContent result={result} />
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-3">
            <GenericRenderer result={result} />
          </div>
        )}
      </div>
    </div>
  );
}
