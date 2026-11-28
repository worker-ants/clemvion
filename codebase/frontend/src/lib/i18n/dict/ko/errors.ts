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
    passwordInvalid: "비밀번호가 맞지 않아요.",
    totpInvalid: "인증 코드가 올바르지 않아요.",
    sessionNotFound: "세션을 찾을 수 없어요. 목록을 새로 고쳐 주세요.",
    cannotRevokeCurrentSession: "현재 세션은 로그아웃 버튼으로 종료해 주세요.",
    reauthNotAvailable:
      "이 작업을 하려면 먼저 비밀번호를 설정하거나 2단계 인증을 켜 주세요.",
    currentSessionRequired:
      "현재 세션을 확인할 수 없어요. 다시 로그인한 뒤 시도해 주세요.",
    reauthRequired: "계속하려면 비밀번호나 2단계 인증 코드를 입력해 주세요.",
    totpNotEnabled: "이 계정은 2단계 인증이 꺼져 있어요. 다시 로그인해 주세요.",
    webauthnRequired: "Passkey 또는 보안 키로 인증해 주세요.",
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
    rateLimited: "요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.",
    userNotFound: "계정을 찾을 수 없어요.",
    totpAlreadyEnabled: "이미 2단계 인증이 켜져 있어요.",
    recoveryCodeInvalid: "복구 코드가 맞지 않거나 이미 사용했어요.",
    challengeInvalid:
      "인증 요청이 만료됐거나 올바르지 않아요. 처음부터 다시 로그인해 주세요.",
    oauthConfigMissing:
      "서버에 이 서비스의 OAuth 설정이 없어요. 운영자에게 문의해 주세요.",
    internalError: "서버 오류가 발생했어요. 잠시 뒤 다시 시도해 주세요.",
    workspaceNameInvalid: "워크스페이스 이름은 2자 이상이어야 해요.",
    cannotAssignOwner: "소유자 역할은 직접 줄 수 없어요.",
    alreadyAMember: "이미 워크스페이스 멤버예요.",
    ownerRoleProtected: "소유자 역할은 소유자 이양으로만 바꿀 수 있어요.",
    memberNotFound: "멤버를 찾을 수 없어요. 목록을 새로 고쳐 주세요.",
    cannotRemoveOwner: "소유자는 내보낼 수 없어요.",
    invalidTimezone: "올바른 시간대가 아니에요.",
    cannotDeletePersonal: "개인 워크스페이스는 삭제할 수 없어요.",
    cannotLeavePersonal: "개인 워크스페이스에서는 나갈 수 없어요.",
    soleOwnerCannotLeave:
      "유일한 소유자는 나갈 수 없어요. 다른 멤버에게 소유자를 넘기거나 워크스페이스를 삭제해 주세요.",
    cannotTransferPersonal: "개인 워크스페이스는 소유자를 넘길 수 없어요.",
    targetIsSelf: "자기 자신에게는 소유자를 넘길 수 없어요.",
    targetAlreadyOwner: "이미 소유자인 멤버예요.",
    workspaceTypeMismatch: "이 워크스페이스에서는 할 수 없는 작업이에요.",
    passwordNotSet:
      "비밀번호가 설정되지 않은 계정이에요. 비밀번호 재설정으로 먼저 설정해 주세요.",
    invitationNotFound: "초대를 찾을 수 없어요. 링크를 다시 확인해 주세요.",
    invitationTeamOnly: "팀 워크스페이스에서만 초대할 수 있어요.",
    invitationAlreadyPending:
      "같은 이메일로 초대를 동시에 보냈어요. 잠시 뒤 다시 시도해 주세요.",
    invitationAlreadyAccepted: "이미 수락한 초대예요.",
    invitationEmailMismatch: "초대받은 이메일과 로그인한 이메일이 달라요.",
    invitationAlreadyUsed: "이미 사용한 초대예요.",
    invitationExpired: "초대가 만료됐어요. 초대한 사람에게 다시 요청해 주세요.",
  },
} as const;
