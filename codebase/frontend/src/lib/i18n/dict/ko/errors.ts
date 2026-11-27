export const errors = {
  generic: "오류가 발생했어요",
  network: "네트워크 오류가 발생했어요",
  unauthorized: "로그인이 필요해요",
  forbidden: "권한이 없어요",
  notFound: "찾을 수 없어요",
  validation: "입력값을 확인해 주세요",
  server: "서버 오류가 발생했어요",
  unknown: "알 수 없는 오류가 발생했어요",
  /**
   * 서버 에러 코드별 화면 문구. 서버 `message` 는 영문이라 한국어는 코드로 고른다(CLE-UI-I18N-BACKEND 규칙 5).
   * 코드와 키의 짝은 `lib/api/server-error-messages.ts` 의 `SERVER_ERROR_CODE_TO_I18N` 에 있다.
   */
  codes: {
    notAMember: "이 워크스페이스의 멤버가 아니에요.",
    workspaceNotFound: "워크스페이스를 찾을 수 없어요.",
    editorRequired: "편집자 이상 역할이 필요해요.",
    adminRequired: "관리자 이상 역할이 필요해요.",
    ownerRequired: "소유자 역할이 필요해요.",
    sessionNotFound: "세션을 찾을 수 없어요. 목록을 새로 고쳐 주세요.",
    currentSessionRequired:
      "현재 세션을 확인할 수 없어요. 다시 로그인한 뒤 시도해 주세요.",
    reauthRequired: "계속하려면 비밀번호나 2단계 인증 코드를 입력해 주세요.",
    totpNotEnabled: "이 계정은 2단계 인증이 꺼져 있어요. 다시 로그인해 주세요.",
    challengeMethodMismatch:
      "다른 인증 방식의 요청이에요. 처음부터 다시 로그인해 주세요.",
    webauthnDisabled:
      "이 서버에서는 Passkey 와 보안 키를 쓸 수 없어요. 운영자에게 문의해 주세요.",
    webauthnNotRegistered: "등록된 Passkey 나 보안 키가 없어요.",
    webauthnCounterRegression:
      "인증기에서 이상 신호가 감지돼 등록을 해제했어요. 다시 등록해 주세요.",
    invalidOptionsToken:
      "인증 요청이 만료됐거나 올바르지 않아요. 다시 시도해 주세요.",
    serviceUnavailable:
      "지금은 서비스를 쓸 수 없어요. 잠시 뒤 다시 시도해 주세요.",
    userNotFound: "계정을 찾을 수 없어요.",
    totpAlreadyEnabled: "이미 2단계 인증이 켜져 있어요.",
    recoveryCodeInvalid: "복구 코드가 맞지 않거나 이미 사용했어요.",
    challengeInvalid:
      "인증 요청이 만료됐거나 올바르지 않아요. 처음부터 다시 로그인해 주세요.",
  },
} as const;
