export const agentMemory = {
  title: "에이전트 메모리",
  description: "AI Agent persistent 메모리를 scope 별로 조회하고 정리해요",
  refresh: "새로고침",
  scopes: {
    title: "Scope 목록",
    searchPlaceholder: "scope 검색...",
    count: "{{count}}건",
    loadFailed: "scope 목록을 불러올 수 없어요",
    empty: "아직 메모리가 없습니다",
    emptyHint:
      "AI Agent 노드의 memoryStrategy 를 persistent 로 설정하면 실행을 가로질러 메모리가 누적돼요.",
    emptyHintLink: "에이전트 메모리 설정 가이드 보기",
    delete: "scope 전체 삭제",
  },
  memories: {
    selectScope: "왼쪽에서 scope 를 선택하면 메모리를 볼 수 있어요",
    empty: "이 scope 에는 메모리가 없어요",
    loadFailed: "메모리를 불러올 수 없어요",
    count: "{{count}}건",
    expiresAt: "만료 예정",
    updatedAt: "갱신",
    delete: "메모리 삭제",
  },
  kind: {
    filterLabel: "kind",
    all: "전체",
    fact: "사실",
    preference: "선호",
    entity: "엔티티",
  },
  loadMore: "더 보기",
  deleteMemory: {
    title: "메모리 삭제",
    message: "이 메모리를 삭제할까요? 되돌릴 수 없어요.",
    success: "메모리를 삭제했어요",
    failed: "메모리 삭제에 실패했어요",
  },
  clearScope: {
    title: "scope 전체 삭제",
    message:
      "'{{scopeKey}}' scope 의 메모리 {{count}}건을 모두 삭제할까요? 되돌릴 수 없어요.",
    success: "scope 의 메모리를 모두 삭제했어요",
    failed: "scope 삭제에 실패했어요",
  },
} as const;
