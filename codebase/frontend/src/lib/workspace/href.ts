import { toSafeInternalPath } from "./safe-path";

/**
 * 워크스페이스 스코프 라우트의 첫 세그먼트 — `(main)/w/[slug]` · `(editor)/w/[slug]` 의 `w`.
 *
 * 링크 **생성**(`buildWorkspaceHref`)과 **판별**(`(main)/[...rest]` catch-all 의 재부착 가드)이
 * 같은 값에 의존하므로 상수로 묶는다. 둘이 어긋나면 catch-all 이 `/w/…` 를 못 알아보고 slug 를
 * 재부착해 무한 중첩이 재발한다.
 */
export const WORKSPACE_ROUTE_SEGMENT = "w";

/**
 * 활성 워크스페이스 slug 를 붙인 앱 내부 절대경로를 만든다 — `/w/<slug><path>`.
 *
 * URL 이 활성 워크스페이스의 **FE 라우팅 SoT** 다 (spec/2-navigation/9-user-profile.md §3).
 * 이 헬퍼가 하드코딩 절대경로를 대체해 broken-link 회귀 표면을 좁힌다.
 *
 * slug 가 없으면(아직 미해소·slug 밖 컨텍스트) bare path 를 반환한다 —
 * `(main)/[...rest]` catch-all 이 활성 slug 로 흡수하므로 링크가 깨지지 않는다.
 *
 * **보안 경계**: protocol-relative(`//host`·`\\host`) 및 제어문자 입력은 `toSafeInternalPath`
 * (open-redirect 방어 공용 정규화)로 same-origin 절대경로화된다.
 *
 * **비-idempotent 는 의도된 것**: 이미 `/w/…` 인 path 를 넘겨도 접두를 또 붙인다. 조용히
 * 삼키면 호출자 버그를 은폐하고, `buildWorkspaceHref("team-a", "/w/team-b/x")` 의 올바른
 * 답(team-a? team-b?)이 정의되지 않는다. 대신 `(main)/[...rest]` catch-all 이 `/w/` 접두
 * 경로를 terminal 로 다뤄(재부착 금지 → dashboard forward 또는 `notFound()`) 이 클래스의
 * 실패를 무한 리다이렉트가 아니라 **가시적 404** 로 떨어뜨린다.
 * (`no-raw-execution-href`·`no-raw-editor-href` guard 는 *호출부가 경로 리터럴을 직접
 * 조립* 하는 것을 막는 장치이지, 헬퍼에 idempotency 를 요구하는 관행이 아니다.)
 */
export function buildWorkspaceHref(
  slug: string | null | undefined,
  path: string,
): string {
  const clean = toSafeInternalPath(path);
  return slug ? `/${WORKSPACE_ROUTE_SEGMENT}/${slug}${clean}` : clean;
}

/**
 * 실행 내역 경로를 만든다 — 목록 `/w/<slug>/workflows/<id>/executions`, 상세면 `.../<execId>`.
 *
 * 실행 경로는 `(main)/w/[slug]` 라우트라 **항상 slug 를 붙여야** 하는데, 리터럴이 여러 소비처에
 * 흩어져 한 곳이 slug 를 빠뜨리는 회귀가 있었다 (PR #865 rerun-modal). 경로 조립을 단일화해 그
 * 클래스를 구조적으로 제거한다. `__tests__/no-raw-execution-href.test.ts` guard 가 raw
 * `/workflows/…/executions` 리터럴을 소스에서 금지해(ESLint AST 는 템플릿 리터럴 quasi 분해로
 * 매칭이 취약하므로 소스텍스트 스캔으로 대체) 이 헬퍼 사용을 강제한다.
 */
export function buildExecutionHref(
  slug: string | null | undefined,
  workflowId: string,
  executionId?: string,
): string {
  const base = `/workflows/${workflowId}/executions`;
  return buildWorkspaceHref(slug, executionId ? `${base}/${executionId}` : base);
}

/**
 * 에디터 캔버스 경로를 만든다 — `/w/<slug>/workflows/<id>`.
 *
 * 슬러그 라우팅 phase 2 에서 에디터가 `(editor)/w/[slug]/workflows/[id]` 로 편입돼, 실행 경로처럼
 * 항상 slug 를 붙인다(phase 1 의 bare 예외 폐지). 리터럴 산재로 인한 slug 누락 broken-link 를
 * `__tests__/no-raw-editor-href.test.ts` guard 로 막는다(executions 와 동일 방어). 단 알림 딥링크
 * (`lib/notifications/href.ts`)는 slug 컨텍스트 없이 생성돼 bare 를 발행하고 catch-all 이 흡수하므로
 * 그 헬퍼는 예외다.
 */
export function buildEditorHref(
  slug: string | null | undefined,
  workflowId: string,
): string {
  return buildWorkspaceHref(slug, `/workflows/${workflowId}`);
}
