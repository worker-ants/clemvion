"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { ModelConfigManager } from "@/components/models/model-config-manager";
import { type ModelConfigKind } from "@/lib/api/model-configs";
import { useT } from "@/lib/i18n";

const TABS: ModelConfigKind[] = ["chat", "embedding", "rerank"];

function parseTab(raw: string | null): ModelConfigKind {
  return TABS.includes(raw as ModelConfigKind) ? (raw as ModelConfigKind) : "chat";
}

/**
 * 통합 모델 설정 화면 — Chat / Embedding / Rerank 탭. 구 `/llm-configs`·`/rerank-configs`
 * 를 본 페이지로 통합한다 (spec/2-navigation/6-config.md Part B). 활성 탭은 `?tab=` 으로
 * 운반돼 구 라우트 redirect(`/models?tab=chat|rerank`)와 북마크를 보존한다.
 */
export default function ModelsPage() {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));

  const onTabChange = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      // 탭 전환 시 페이지네이션은 초기화 (각 kind 가 독립 목록).
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("models.title")}</h1>

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="chat">{t("models.tabChat")}</TabsTrigger>
          <TabsTrigger value="embedding">
            {t("models.tabEmbedding")}
          </TabsTrigger>
          <TabsTrigger value="rerank">{t("models.tabRerank")}</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-6">
          <ModelConfigManager kind="chat" />
        </TabsContent>
        <TabsContent value="embedding" className="mt-6">
          <ModelConfigManager kind="embedding" />
        </TabsContent>
        <TabsContent value="rerank" className="mt-6">
          <ModelConfigManager kind="rerank" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
