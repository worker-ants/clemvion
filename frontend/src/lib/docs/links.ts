/**
 * 매뉴얼 딥링크 중앙 저장소.
 * 여기에 정의된 링크 상수만 사용해서 타입 세이프하게 이동할 수 있어요.
 * 새 페이지/앵커를 추가하면 이 파일에 등록해주세요.
 */

const section = (key: string) => `/docs/${key}`;

export const DOCS = {
  root: "/docs",
  gettingStarted: {
    whatIsThis: "/docs/01-getting-started/what-is-this",
    uiTour: "/docs/01-getting-started/ui-tour",
    firstWorkflow: "/docs/01-getting-started/first-workflow",
  },
  nodes: {
    overview: "/docs/02-nodes/overview",
    triggers: "/docs/02-nodes/triggers",
    logic: "/docs/02-nodes/logic",
    flow: "/docs/02-nodes/flow",
    data: "/docs/02-nodes/data",
    ai: "/docs/02-nodes/ai",
    integrations: "/docs/02-nodes/integrations",
    presentation: "/docs/02-nodes/presentation",
  },
  expression: {
    basics: "/docs/03-expression-language/basics",
    variablesAndContext: "/docs/03-expression-language/variables-and-context",
    cheatsheet: "/docs/03-expression-language/cheatsheet",
  },
  runAndDebug: {
    runningAWorkflow: "/docs/04-run-and-debug/running-a-workflow",
    runResults: "/docs/04-run-and-debug/run-results",
    errorHandling: "/docs/04-run-and-debug/error-handling",
    versionHistory: "/docs/04-run-and-debug/version-history",
  },
  integrationsAndConfig: {
    integrationManagement:
      "/docs/05-integrations-and-config/integration-management",
    llmConfig: "/docs/05-integrations-and-config/llm-config",
    knowledgeBase: "/docs/05-integrations-and-config/knowledge-base",
  },
  faq: "/docs/06-faq/faq",
  // 공용 fallback
  fallbackRedirect: "/dashboard",
  // 섹션 경로 generator (내부 유틸)
  section,
} as const;

/** 안전한 slug인지 확인해요(디렉터리 탐색 방지). */
export const SAFE_DOCS_SLUG_RE = /^[a-z0-9][a-z0-9\-]*$/i;

export function isSafeDocsSlug(parts: readonly string[]): boolean {
  if (parts.length < 2) return false;
  return parts.every((p) => SAFE_DOCS_SLUG_RE.test(p));
}
