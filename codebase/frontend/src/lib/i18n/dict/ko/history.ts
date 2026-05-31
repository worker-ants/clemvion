export const history = {
  actions: {
    rerun: "재실행",
  },
  rerun: {
    modal: {
      title: "실행 다시 시작",
      originalLabel: "원본 실행",
      sideEffectWarning: "이 워크플로는 외부 호출 노드 {{count}}개를 포함합니다",
    },
    useOriginalInput: "원본 입력 그대로 사용",
    dryRunToggle: "dry-run 모드 (외부 호출 skip)",
    dryRunDisabledTooltip: "이 워크플로는 dry-run 미지원 노드를 포함합니다",
    confirmButton: "재실행",
    cancelButton: "취소",
    chainBadge: "#{{n}}-th re-run",
    chainBadgeDryRun: "dry-run",
    chainOrigin: "원본",
    viewChain: "chain 보기 ({{count}})",
    permissionDenied: "Re-run 권한이 없습니다 (정책 RR-PL-06)",
    chainDepthExceeded: "같은 체인의 재실행이 한도(32)에 도달했습니다",
    workflowDeleted: "원본 실행의 워크플로가 삭제되어 재실행할 수 없습니다",
    dryRunNotApplicable: "이 워크플로는 dry-run 모드로 재실행할 수 없습니다",
    assistantBlocked:
      "Re-run 은 사용자가 실행 상세 페이지에서 직접 트리거해야 합니다 (RR-PL-07)",
  },
} as const;
