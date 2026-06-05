"use client";

import { type RagMode, type RerankMode } from "@/lib/api/knowledge-bases";
import { type LlmConfigData } from "@/lib/api/llm-configs";
import { type RerankConfigData } from "@/lib/api/rerank-configs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { EmbeddingModelCombobox } from "@/components/knowledge-base/embedding-model-combobox";
import { EmbeddingTestButton } from "@/components/knowledge-base/embedding-test-button";
import { useT } from "@/lib/i18n";

export type KbFormTab = "basic" | "embedding" | "graph" | "rerank";

export interface KbFormBodyProps {
  activeTab: KbFormTab;
  onActiveTabChange: (t: KbFormTab) => void;

  ragMode: RagMode;
  // create 모드일 때만 전달. 미전달이면 read-only badge 로 표시.
  onRagModeChange?: (m: RagMode) => void;

  formName: string;
  setFormName: (v: string) => void;
  formDescription: string;
  setFormDescription: (v: string) => void;

  formEmbeddingLlmConfigId: string;
  setFormEmbeddingLlmConfigId: (v: string) => void;
  formEmbeddingModel: string;
  setFormEmbeddingModel: (v: string) => void;
  formChunkSize: string;
  setFormChunkSize: (v: string) => void;
  formChunkOverlap: string;
  setFormChunkOverlap: (v: string) => void;

  formExtractionLlmConfigId: string;
  setFormExtractionLlmConfigId: (v: string) => void;
  formMaxHops: string;
  setFormMaxHops: (v: string) => void;
  formVectorSeedTopK: string;
  setFormVectorSeedTopK: (v: string) => void;
  formExpandedChunkLimit: string;
  setFormExpandedChunkLimit: (v: string) => void;

  // ──────── 검색 후처리(리랭킹) ────────
  formRerankMode: RerankMode;
  setFormRerankMode: (v: RerankMode) => void;
  formRerankConfigId: string;
  setFormRerankConfigId: (v: string) => void;
  formRerankCandidateK: string;
  setFormRerankCandidateK: (v: string) => void;
  formRerankScoreThreshold: string;
  setFormRerankScoreThreshold: (v: string) => void;
  formRerankLlmConfigId: string;
  setFormRerankLlmConfigId: (v: string) => void;
  rerankConfigs: RerankConfigData[];

  llmConfigs: LlmConfigData[];
  // settings 모드: 기존 KB 의 임베딩 차원. 임베딩 테스트 버튼이 비교 표시할 때 사용.
  currentEmbeddingDimension?: number | null;
  // settings 모드: 임베딩 모델이 기존과 달라졌을 때 경고 노출.
  embeddingModelChanged?: boolean;
}

const PANEL_CLS = "space-y-4 max-h-[60vh] overflow-y-auto pr-1";

export function KbFormBody({
  activeTab,
  onActiveTabChange,
  ragMode,
  onRagModeChange,
  formName,
  setFormName,
  formDescription,
  setFormDescription,
  formEmbeddingLlmConfigId,
  setFormEmbeddingLlmConfigId,
  formEmbeddingModel,
  setFormEmbeddingModel,
  formChunkSize,
  setFormChunkSize,
  formChunkOverlap,
  setFormChunkOverlap,
  formExtractionLlmConfigId,
  setFormExtractionLlmConfigId,
  formMaxHops,
  setFormMaxHops,
  formVectorSeedTopK,
  setFormVectorSeedTopK,
  formExpandedChunkLimit,
  setFormExpandedChunkLimit,
  formRerankMode,
  setFormRerankMode,
  formRerankConfigId,
  setFormRerankConfigId,
  formRerankCandidateK,
  setFormRerankCandidateK,
  formRerankScoreThreshold,
  setFormRerankScoreThreshold,
  formRerankLlmConfigId,
  setFormRerankLlmConfigId,
  rerankConfigs,
  llmConfigs,
  currentEmbeddingDimension,
  embeddingModelChanged,
}: KbFormBodyProps) {
  const t = useT();
  const isGraph = ragMode === "graph";
  const rerankEnabled = formRerankMode !== "off";

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => onActiveTabChange(v as KbFormTab)}
    >
      <TabsList className="w-full">
        <TabsTrigger value="basic">
          {t("knowledgeBases.formTabBasic")}
        </TabsTrigger>
        <TabsTrigger value="embedding">
          {t("knowledgeBases.formTabEmbedding")}
        </TabsTrigger>
        {isGraph && (
          <TabsTrigger value="graph">
            {t("knowledgeBases.formTabGraph")}
          </TabsTrigger>
        )}
        <TabsTrigger value="rerank">
          {t("knowledgeBases.formTabRerank")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className={PANEL_CLS}>
        <div>
          <Label>{t("knowledgeBases.name")}</Label>
          <Input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={t("knowledgeBases.createPlaceholder")}
          />
        </div>
        <div>
          <Label>{t("common.description")}</Label>
          <Input
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder={t("knowledgeBases.descriptionPlaceholderOptional")}
          />
        </div>
        <div>
          <Label>{t("knowledgeBases.ragMode")}</Label>
          {onRagModeChange ? (
            <>
              <NativeSelect
                value={ragMode}
                onChange={(e) => onRagModeChange(e.target.value as RagMode)}
              >
                <option value="vector">
                  {t("knowledgeBases.ragModeVector")}
                </option>
                <option value="graph">
                  {t("knowledgeBases.ragModeGraph")}
                </option>
              </NativeSelect>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                {t("knowledgeBases.ragModeHint")}
              </p>
            </>
          ) : (
            <>
              <div className="flex h-9 items-center rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--muted))]/30 px-2 text-sm text-[hsl(var(--muted-foreground))]">
                {isGraph
                  ? t("knowledgeBases.ragModeGraph")
                  : t("knowledgeBases.ragModeVector")}
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                {t("knowledgeBases.ragModeHint")}
              </p>
            </>
          )}
        </div>
      </TabsContent>

      <TabsContent value="embedding" className={PANEL_CLS}>
        <div>
          <Label>{t("knowledgeBases.embeddingLlm")}</Label>
          <NativeSelect
            value={formEmbeddingLlmConfigId}
            onChange={(e) => setFormEmbeddingLlmConfigId(e.target.value)}
          >
            <option value="">
              {t("nodeConfigs.llmConfigSelector.defaultOption")}
            </option>
            {llmConfigs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.defaultModel})
                {c.isDefault ? " *" : ""}
              </option>
            ))}
          </NativeSelect>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            {t("knowledgeBases.embeddingLlmHint")}
          </p>
        </div>
        <div>
          <Label>{t("knowledgeBases.embeddingModel")}</Label>
          <EmbeddingModelCombobox
            value={formEmbeddingModel}
            onChange={setFormEmbeddingModel}
            placeholder="text-embedding-3-small"
            llmConfigId={formEmbeddingLlmConfigId || undefined}
          />
          {embeddingModelChanged && (
            <p className="mt-1 text-xs text-[hsl(var(--warning,38_92%_50%))]">
              {t("knowledgeBases.modelChangedNeedsReembed")}
            </p>
          )}
          <div className="mt-2">
            <EmbeddingTestButton
              llmConfigId={formEmbeddingLlmConfigId || undefined}
              embeddingModel={formEmbeddingModel}
              currentDimension={currentEmbeddingDimension}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("knowledgeBases.chunkSize")}</Label>
            <Input
              type="number"
              min="100"
              max="8000"
              value={formChunkSize}
              onChange={(e) => setFormChunkSize(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("knowledgeBases.chunkOverlap")}</Label>
            <Input
              type="number"
              min="0"
              max="2000"
              value={formChunkOverlap}
              onChange={(e) => setFormChunkOverlap(e.target.value)}
            />
          </div>
        </div>
      </TabsContent>

      {isGraph && (
        <TabsContent value="graph" className={PANEL_CLS}>
          <div>
            <Label>{t("knowledgeBases.extractionLlm")}</Label>
            <NativeSelect
              value={formExtractionLlmConfigId}
              onChange={(e) => setFormExtractionLlmConfigId(e.target.value)}
            >
              <option value="">
                {t("nodeConfigs.llmConfigSelector.defaultOption")}
              </option>
              {llmConfigs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.defaultModel})
                  {c.isDefault ? " *" : ""}
                </option>
              ))}
            </NativeSelect>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {t("knowledgeBases.extractionLlmHint")}
            </p>
          </div>
          <div>
            <Label>{t("knowledgeBases.graphSearchParams")}</Label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">
                  {t("knowledgeBases.maxHops")}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="2"
                  value={formMaxHops}
                  onChange={(e) => setFormMaxHops(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">
                  {t("knowledgeBases.vectorSeedTopK")}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={formVectorSeedTopK}
                  onChange={(e) => setFormVectorSeedTopK(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">
                  {t("knowledgeBases.expandedChunkLimit")}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={formExpandedChunkLimit}
                  onChange={(e) => setFormExpandedChunkLimit(e.target.value)}
                />
              </div>
            </div>
          </div>
        </TabsContent>
      )}

      <TabsContent value="rerank" className={PANEL_CLS}>
        <div>
          <Label>{t("knowledgeBases.rerankMode")}</Label>
          <NativeSelect
            value={formRerankMode}
            onChange={(e) =>
              setFormRerankMode(e.target.value as RerankMode)
            }
          >
            <option value="off">
              {t("knowledgeBases.rerankModeOff")}
            </option>
            <option value="cross_encoder">
              {t("knowledgeBases.rerankModeCrossEncoder")}
            </option>
            <option value="cross_encoder_llm">
              {t("knowledgeBases.rerankModeCrossEncoderLlm")}
            </option>
          </NativeSelect>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            {t("knowledgeBases.rerankModeHint")}
          </p>
        </div>

        {rerankEnabled && (
          <>
            <div>
              <Label>{t("knowledgeBases.rerankConfig")}</Label>
              <NativeSelect
                value={formRerankConfigId}
                onChange={(e) => setFormRerankConfigId(e.target.value)}
              >
                <option value="">
                  {t("nodeConfigs.llmConfigSelector.defaultOption")}
                </option>
                {rerankConfigs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.defaultModel})
                    {c.isDefault ? " *" : ""}
                  </option>
                ))}
              </NativeSelect>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                {t("knowledgeBases.rerankConfigHint")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">
                  {t("knowledgeBases.rerankCandidateK")}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="200"
                  value={formRerankCandidateK}
                  onChange={(e) => setFormRerankCandidateK(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">
                  {t("knowledgeBases.rerankScoreThreshold")}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formRerankScoreThreshold}
                  onChange={(e) =>
                    setFormRerankScoreThreshold(e.target.value)
                  }
                  placeholder=""
                />
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {t("knowledgeBases.rerankScoreThresholdHint")}
                </p>
              </div>
            </div>
            {formRerankMode === "cross_encoder_llm" && (
              <div>
                <Label>{t("knowledgeBases.rerankGradingLlm")}</Label>
                <NativeSelect
                  value={formRerankLlmConfigId}
                  onChange={(e) => setFormRerankLlmConfigId(e.target.value)}
                >
                  <option value="">
                    {t("nodeConfigs.llmConfigSelector.defaultOption")}
                  </option>
                  {llmConfigs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.defaultModel})
                      {c.isDefault ? " *" : ""}
                    </option>
                  ))}
                </NativeSelect>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {t("knowledgeBases.rerankGradingLlmHint")}
                </p>
              </div>
            )}
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
