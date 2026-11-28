// 전체화면 에러 페이지 5종 (spec/2-navigation/11-error-empty-states.md §1.2)
export const errorPage = {
  sessionExpired: {
    title: "세션이 만료됐어요",
    description: "보안을 위해 자동으로 로그아웃됐어요. 다시 로그인해 주세요.",
    cta: "다시 로그인",
  },
  forbidden: {
    title: "접근 권한이 없어요",
    description: "이 페이지에 접근할 권한이 없어요. 워크스페이스 관리자에게 문의해 주세요.",
    cta: "대시보드로 이동",
  },
  notFound: {
    title: "페이지를 찾을 수 없어요",
    description: "요청한 페이지가 없거나 다른 곳으로 옮겨졌어요.",
    cta: "대시보드로 이동",
  },
  server: {
    title: "문제가 생겼어요",
    description: "서버에서 예기치 않은 오류가 생겼어요. 잠시 후 다시 시도해 주세요.",
    retry: "다시 시도",
    dashboard: "대시보드로 이동",
  },
  network: {
    title: "네트워크에 연결할 수 없어요",
    description: "인터넷 연결을 확인하고 다시 시도해 주세요.",
    retry: "다시 시도",
  },
} as const;
