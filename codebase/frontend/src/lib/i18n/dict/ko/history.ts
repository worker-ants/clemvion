export const history = {
  actions: {
    rerun: "재실행",
  },
  rerun: {
    modal: {
      title: "실행 다시 시작",
      originalLabel: "원본 실행",
      sideEffectWarning: "이 워크플로우에는 부수효과 노드가 {{count}}개 있어요",
      agentToolWarning: "MCP 서버를 연결한 AI 에이전트 노드 {{count}}개",
    },
    useOriginalInput: "원본 입력 그대로 사용",
    maskedInputBlocked:
      "자격증명으로 판별돼 가려진 입력이 있어요. 해당 항목을 직접 입력하거나 '원본 입력 그대로 사용'을 켜 주세요.",
    dryRunToggle: "dry-run 모드 (부수효과 호출은 모의 처리)",
    dryRunDisabledTooltip: "이 워크플로우에는 dry-run 미지원 노드가 있어요",
    confirmButton: "재실행",
    cancelButton: "취소",
    chainBadge: "#{{n}}-th re-run",
    chainBadgeDryRun: "dry-run",
    chainOrigin: "원본",
    viewChain: "chain 보기 ({{count}})",
    permissionDenied: "Re-run 권한이 없어요 (정책 RR-PL-06)",
    chainDepthExceeded: "같은 체인의 재실행이 한도(32)에 도달했어요",
    workflowDeleted: "원본 실행의 워크플로우가 삭제되어 재실행할 수 없어요",
    dryRunNotApplicable: "이 워크플로우는 dry-run 모드로 재실행할 수 없어요",
    assistantBlocked:
      "Re-run 은 사용자가 실행 상세 페이지에서 직접 트리거해야 해요 (RR-PL-07)",
    genericError: "재실행하지 못했어요",
  },
} as const;
