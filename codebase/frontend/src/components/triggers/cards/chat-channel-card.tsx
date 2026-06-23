import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  triggersApi,
  type TriggerDetail,
  type ChatChannelConfigView,
} from "@/lib/api/triggers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDate } from "@/lib/utils/date";
import { useT } from "@/lib/i18n";
import { useHasRole } from "@/components/auth/role-gate";
import { toast } from "sonner";
import { useCardEditToggle } from "../hooks/use-card-edit-toggle";

/**
 * Chat Channel `rateLimitPerMinute` 의 제품 기본값 (spec Chat Channel §4.1).
 * read 표시·edit 폼 초기값·저장 시 fallback 세 곳에서 동일 값을 참조한다.
 */
const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;

/** ChatChannel edit 폼의 편집 가능 필드 묶음. */
interface ChatChannelEditValues {
  visualNode: "text" | "photo" | "auto";
  buttonLayout: "auto" | "vertical" | "horizontal";
  rateLimitPerMinute: string;
  languageHintsJson: string;
  languageLocale: "ko" | "en";
}

/** chatChannel config 에서 edit 폼 초기값을 도출한다 (마운트·cancel 리셋 공용). */
function initialChatChannelEditValues(
  chatChannel: ChatChannelConfigView | undefined,
): ChatChannelEditValues {
  return {
    visualNode: chatChannel?.uiMapping?.visualNode ?? "auto",
    buttonLayout: chatChannel?.uiMapping?.buttonLayout ?? "auto",
    rateLimitPerMinute: String(
      chatChannel?.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
    ),
    languageHintsJson: chatChannel?.languageHints
      ? JSON.stringify(chatChannel.languageHints, null, 2)
      : "",
    languageLocale: chatChannel?.languageLocale ?? "ko",
  };
}

/** languageHints JSON 파싱 실패를 saveFailed 와 구분해 i18n 메시지로 분기하기 위한 마커. */
class LanguageHintsParseError extends Error {}

/**
 * languageHints textarea(JSON) 를 flat `Record<string,string>` 로 파싱한다.
 * 빈 입력은 `undefined` (미설정). 형식 오류 시 `LanguageHintsParseError`.
 */
function parseLanguageHints(
  json: string,
): Record<string, string> | undefined {
  if (json.trim().length === 0) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new LanguageHintsParseError();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new LanguageHintsParseError();
  }
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [
      k,
      String(v),
    ]),
  );
}

/**
 * ChatChannel edit 폼 — uiMapping / rateLimit / languageLocale / languageHints.
 * 책임 분리(ai-review W): 폼 마크업을 카드 본체에서 분리한다.
 */
function ChatChannelEditForm({
  values,
  onChange,
}: {
  values: ChatChannelEditValues;
  onChange: (next: ChatChannelEditValues) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-3 text-sm">
      <div>
        <Label htmlFor="cc-visualNode">
          {t("triggers.chatChannel.uiMappingVisualNode")}
        </Label>
        <NativeSelect
          id="cc-visualNode"
          className="mt-1"
          value={values.visualNode}
          onChange={(e) =>
            onChange({
              ...values,
              visualNode: e.target.value as "text" | "photo" | "auto",
            })
          }
        >
          <option value="auto">
            {t("triggers.chatChannel.visualNodeAuto")}
          </option>
          <option value="text">
            {t("triggers.chatChannel.visualNodeText")}
          </option>
          <option value="photo">
            {t("triggers.chatChannel.visualNodePhoto")}
          </option>
        </NativeSelect>
      </div>
      <div>
        <Label htmlFor="cc-buttonLayout">
          {t("triggers.chatChannel.uiMappingButtonLayout")}
        </Label>
        <NativeSelect
          id="cc-buttonLayout"
          className="mt-1"
          value={values.buttonLayout}
          onChange={(e) =>
            onChange({
              ...values,
              buttonLayout: e.target.value as
                | "auto"
                | "vertical"
                | "horizontal",
            })
          }
        >
          <option value="auto">
            {t("triggers.chatChannel.buttonLayoutAuto")}
          </option>
          <option value="vertical">
            {t("triggers.chatChannel.buttonLayoutVertical")}
          </option>
          <option value="horizontal">
            {t("triggers.chatChannel.buttonLayoutHorizontal")}
          </option>
        </NativeSelect>
      </div>
      <div>
        <Label htmlFor="cc-rateLimit">
          {t("triggers.chatChannel.rateLimitPerMinute")}
        </Label>
        <Input
          id="cc-rateLimit"
          type="number"
          min={1}
          max={600}
          value={values.rateLimitPerMinute}
          onChange={(e) =>
            onChange({ ...values, rateLimitPerMinute: e.target.value })
          }
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="cc-languageLocale">
          {t("triggers.chatChannel.languageLocale")}
        </Label>
        <NativeSelect
          id="cc-languageLocale"
          className="mt-1"
          value={values.languageLocale}
          onChange={(e) =>
            onChange({
              ...values,
              languageLocale: e.target.value as "ko" | "en",
            })
          }
        >
          <option value="ko">
            {t("triggers.chatChannel.languageLocaleKo")}
          </option>
          <option value="en">
            {t("triggers.chatChannel.languageLocaleEn")}
          </option>
        </NativeSelect>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {t("triggers.chatChannel.languageLocaleHelp")}
        </p>
      </div>
      <div>
        <Label htmlFor="cc-languageHints">
          {t("triggers.chatChannel.languageHints")}
        </Label>
        <textarea
          id="cc-languageHints"
          rows={6}
          className="mt-1 w-full rounded border border-[hsl(var(--input))] bg-transparent p-2 font-mono text-xs"
          placeholder={`{\n  "groupChatRefusal": "...",\n  "executionStarted": "...",\n  "executionCompleted": "...",\n  "executionStillRunning": "...",\n  "help": "..."\n}`}
          value={values.languageHintsJson}
          onChange={(e) =>
            onChange({ ...values, languageHintsJson: e.target.value })
          }
        />
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {t("triggers.chatChannel.languageHintsHelp")}
        </p>
      </div>
    </div>
  );
}

/**
 * Bot Token 재발급 모달 — spec §5.4.1 single-path.
 * 책임 분리(ai-review W): modal 마크업·입력 state 를 카드 본체에서 분리한다.
 */
function RotateBotTokenModal({
  pending,
  onConfirm,
  onClose,
}: {
  pending: boolean;
  onConfirm: (newBotToken: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5">
        <h3 className="mb-2 text-base font-semibold">
          {t("triggers.chatChannel.rotateBotTokenDialogTitle")}
        </h3>
        <p className="mb-2 text-xs text-[hsl(var(--muted-foreground))]">
          {t("triggers.chatChannel.rotateBotTokenDescription")}
        </p>
        <p className="mb-3 text-sm">
          {t("triggers.chatChannel.rotateBotTokenConfirm")}
        </p>
        <Label htmlFor="cc-rotate-input">
          {t("triggers.chatChannel.botTokenInputLabel")}
        </Label>
        <Input
          id="cc-rotate-input"
          placeholder={t("triggers.chatChannel.botTokenInputPlaceholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 font-mono"
          autoFocus
        />
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {t("triggers.chatChannel.botTokenFormatHelp")}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            disabled={pending}
          >
            {t("triggers.chatChannel.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm(value.trim())}
            disabled={pending || value.trim().length === 0}
          >
            {pending
              ? t("triggers.chatChannel.saving")
              : t("triggers.chatChannel.rotateBotTokenDialogConfirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Chat Channel 카드 (Spec 2-trigger-list §2.3.1 + Rationale R-8).
 *
 * - read 모드: provider · bot identity · uiMapping · rateLimit · languageHints · health 그룹
 * - edit 모드: uiMapping / rateLimitPerMinute / languageHints 만 편집 (provider/botToken 은 별 경로)
 * - rotate Bot Token: spec §5.4.1 single-path — POST /chat-channel/rotate-bot-token
 *
 * 내부 ref (botTokenRef/secretTokenRef) 는 backend 가 응답에서 strip (CCH-SE-03 UI 차원).
 * hasBotToken derived 필드로 등록 여부만 노출 (spec §5.4.2).
 */
export function ChatChannelCard({
  trigger,
  onSaved,
}: {
  trigger: TriggerDetail;
  onSaved: () => void;
}) {
  const t = useT();
  const canEdit = useHasRole("editor");
  const chatChannel = trigger.config?.chatChannel;
  const hasChatChannel = Boolean(chatChannel?.provider);
  const health = trigger.chatChannelHealth ?? "unknown";
  const healthVariant: "success" | "outline" | "destructive" =
    health === "healthy"
      ? "success"
      : health === "degraded"
        ? "destructive"
        : "outline";
  const healthLabel: Record<typeof health, string> = {
    unknown: t("triggers.chatChannel.healthUnknown"),
    healthy: t("triggers.chatChannel.healthHealthy"),
    degraded: t("triggers.chatChannel.healthDegraded"),
  };

  // Edit state
  const { editing, setEditing, startEdit, cancelEdit } = useCardEditToggle();
  const [editValues, setEditValues] = useState<ChatChannelEditValues>(() =>
    initialChatChannelEditValues(chatChannel),
  );

  // Rotate Bot Token modal
  const [rotateOpen, setRotateOpen] = useState(false);

  // PROVIDER LABEL — extensible when more providers land
  function providerLabel(p?: string): string {
    if (p === "telegram") return t("triggers.chatChannel.providerTelegram");
    if (p === "slack") return t("triggers.chatChannel.providerSlack");
    if (p === "discord") return t("triggers.chatChannel.providerDiscord");
    return p ?? "-";
  }

  function visualNodeLabel(v?: string): string {
    if (v === "text") return t("triggers.chatChannel.visualNodeText");
    if (v === "photo") return t("triggers.chatChannel.visualNodePhoto");
    return t("triggers.chatChannel.visualNodeAuto");
  }

  function formModeLabel(v?: string): string {
    if (v === "native_modal") return t("triggers.chatChannel.formModeNativeModal");
    if (v === "auto") return t("triggers.chatChannel.formModeAuto");
    return t("triggers.chatChannel.formModeMultiStep");
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      // languageHints JSON 검증 — 잘못된 JSON 은 네트워크 호출 전 차단.
      const parsedHints = parseLanguageHints(editValues.languageHintsJson);
      const rateLimitParsed = Number(editValues.rateLimitPerMinute);
      const patchChatChannel: Record<string, unknown> = {
        provider: chatChannel?.provider ?? "telegram",
        // botToken 은 입력 단계에서 별 path — 본 PATCH 에는 미포함 (single-path).
        // backend 가 PATCH body 의 chatChannel 을 받으면 setupChannel 재호출하지만
        // botToken 없으면 botTokenRef 유지 (mergeExternalConfig).
        uiMapping: {
          formMode: "multi_step",
          visualNode: editValues.visualNode,
          buttonLayout: editValues.buttonLayout,
        },
        rateLimitPerMinute: Number.isFinite(rateLimitParsed)
          ? rateLimitParsed
          : DEFAULT_RATE_LIMIT_PER_MINUTE,
        languageLocale: editValues.languageLocale,
        ...(parsedHints ? { languageHints: parsedHints } : {}),
      };
      // backend mergeExternalConfig 가 chatChannel 전체를 교체하므로 비편집 필드도 동봉
      // 단 botToken 은 미포함 — single-path 정책상 PATCH 로 토큰 변경 불가
      // botTokenRef / secretTokenRef / secretToken 도 미포함 — backend assertChatChannelInputSafe 차단
      await triggersApi.update(trigger.id, {
        chatChannel: patchChatChannel,
      });
    },
    onSuccess: () => {
      toast.success(t("triggers.chatChannel.saveSucceeded"));
      setEditing(false);
      onSaved();
    },
    // 보안(ai-review W): 서버/검증 err.message 원문을 toast 에 노출하지 않는다.
    onError: (err) => {
      toast.error(
        err instanceof LanguageHintsParseError
          ? t("triggers.chatChannel.languageHintsInvalid")
          : t("triggers.chatChannel.saveFailed"),
      );
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async (newBotToken: string) => {
      await triggersApi.rotateBotToken(trigger.id, newBotToken);
    },
    onSuccess: () => {
      toast.success(t("triggers.chatChannel.rotateBotTokenSucceeded"));
      setRotateOpen(false);
      onSaved();
    },
    onError: () => {
      toast.error(t("triggers.chatChannel.rotateBotTokenFailed"));
    },
  });

  function handleCancel(): void {
    cancelEdit(() => {
      // cancel 시 미저장 입력값을 원래 값으로 리셋.
      setEditValues(initialChatChannelEditValues(chatChannel));
      saveMutation.reset();
    });
  }

  if (!hasChatChannel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("triggers.chatChannel.section")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t("triggers.chatChannel.notConfigured")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          {t("triggers.chatChannel.section")}
        </CardTitle>
        {canEdit && !editing ? (
          <Button size="sm" variant="outline" onClick={startEdit}>
            {t("triggers.chatChannel.edit")}
          </Button>
        ) : editing ? (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={saveMutation.isPending}
            >
              {t("triggers.chatChannel.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? t("triggers.chatChannel.saving")
                : t("triggers.chatChannel.save")}
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {!editing ? (
          <>
            {/* Provider · Bot Token · Health 그룹 */}
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-[hsl(var(--muted-foreground))]">
                {t("triggers.chatChannel.provider")}
              </dt>
              <dd>{providerLabel(chatChannel?.provider)}</dd>
              <dt className="text-[hsl(var(--muted-foreground))]">
                {t("triggers.chatChannel.botToken")}
              </dt>
              <dd className="flex items-center gap-2">
                <span>
                  {chatChannel?.hasBotToken
                    ? t("triggers.chatChannel.botTokenRegistered")
                    : t("triggers.chatChannel.botTokenMissing")}
                </span>
                {canEdit && chatChannel?.hasBotToken ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRotateOpen(true)}
                  >
                    {t("triggers.chatChannel.rotateBotToken")}
                  </Button>
                ) : null}
              </dd>
              {chatChannel?.botIdentity?.username || chatChannel?.botIdentity?.botId ? (
                <>
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.chatChannel.botIdentity")}
                  </dt>
                  <dd>
                    {chatChannel.botIdentity.username
                      ? `@${chatChannel.botIdentity.username}`
                      : ""}
                    {chatChannel.botIdentity.botId
                      ? ` (id=${chatChannel.botIdentity.botId})`
                      : ""}
                  </dd>
                </>
              ) : (
                <>
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.chatChannel.botIdentity")}
                  </dt>
                  <dd className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.chatChannel.botIdentityNotResolved")}
                  </dd>
                </>
              )}
              <dt className="text-[hsl(var(--muted-foreground))]">
                {t("triggers.chatChannel.health")}
              </dt>
              <dd className="flex items-center gap-2">
                <Badge variant={healthVariant}>{healthLabel[health]}</Badge>
                {health === "degraded" ? (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {t("triggers.chatChannel.healthDegradedHelp")}
                  </span>
                ) : null}
              </dd>
              {trigger.chatChannelLastError ? (
                <>
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.chatChannel.lastError")}
                  </dt>
                  <dd className="font-mono text-xs">
                    {trigger.chatChannelLastError}
                  </dd>
                </>
              ) : null}
              {trigger.chatChannelSetupAt ? (
                <>
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.chatChannel.setupAt")}
                  </dt>
                  <dd className="text-xs">
                    {formatDate(trigger.chatChannelSetupAt, "datetime")}
                  </dd>
                </>
              ) : null}
              {trigger.chatChannelRotatedAt ? (
                <>
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    {t("triggers.chatChannel.rotatedAt")}
                  </dt>
                  <dd className="text-xs">
                    {formatDate(trigger.chatChannelRotatedAt, "datetime")}
                  </dd>
                </>
              ) : null}
            </dl>

            {/* UI Mapping 그룹 */}
            <div className="border-t border-[hsl(var(--border))] pt-3">
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-[hsl(var(--muted-foreground))]">
                  {t("triggers.chatChannel.uiMappingFormMode")}
                </dt>
                <dd>{formModeLabel(chatChannel?.uiMapping?.formMode)}</dd>
                <dt className="text-[hsl(var(--muted-foreground))]">
                  {t("triggers.chatChannel.uiMappingVisualNode")}
                </dt>
                <dd>{visualNodeLabel(chatChannel?.uiMapping?.visualNode)}</dd>
                <dt className="text-[hsl(var(--muted-foreground))]">
                  {t("triggers.chatChannel.uiMappingButtonLayout")}
                </dt>
                <dd>{chatChannel?.uiMapping?.buttonLayout ?? "auto"}</dd>
                <dt className="text-[hsl(var(--muted-foreground))]">
                  {t("triggers.chatChannel.rateLimitPerMinute")}
                </dt>
                <dd>
                  {chatChannel?.rateLimitPerMinute ??
                    DEFAULT_RATE_LIMIT_PER_MINUTE}
                </dd>
                <dt className="text-[hsl(var(--muted-foreground))]">
                  {t("triggers.chatChannel.languageLocale")}
                </dt>
                <dd>
                  {(chatChannel?.languageLocale ?? "ko") === "en"
                    ? t("triggers.chatChannel.languageLocaleEn")
                    : t("triggers.chatChannel.languageLocaleKo")}
                </dd>
              </dl>
            </div>

            {/* languageHints */}
            {chatChannel?.languageHints &&
            Object.keys(chatChannel.languageHints).length > 0 ? (
              <div className="border-t border-[hsl(var(--border))] pt-3">
                <p className="mb-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                  {t("triggers.chatChannel.languageHints")}
                </p>
                <pre className="overflow-x-auto rounded bg-[hsl(var(--muted))] p-2 text-xs">
                  {JSON.stringify(chatChannel.languageHints, null, 2)}
                </pre>
              </div>
            ) : null}
          </>
        ) : (
          <ChatChannelEditForm values={editValues} onChange={setEditValues} />
        )}

        {/* Rotate Bot Token modal — single-path via rotate API */}
        {rotateOpen ? (
          <RotateBotTokenModal
            pending={rotateMutation.isPending}
            onConfirm={(token) => rotateMutation.mutate(token)}
            onClose={() => {
              // 재진입 시 직전 회전 실패 error 상태가 잔류하지 않도록 초기화.
              rotateMutation.reset();
              setRotateOpen(false);
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
