# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

- **[INFO]** 비밀번호 변경 시 전 세션 revoke + 현재 디바이스 재발급 동작이 신설됐으나 user-guide 문서에 해당 사용자 안내가 없음 (semantic 회색 지대)
  - 변경 파일: `codebase/backend/src/modules/users/users.controller.ts`, `codebase/backend/src/modules/auth/auth.service.ts` (`rotateSessionAfterPasswordChange`), `codebase/backend/src/modules/auth/sessions.service.ts` (`revokeAllFamilies`), `codebase/frontend/src/app/(main)/profile/change-password/page.tsx`
  - 매트릭스 항목: `auth-session-flow-change` — "인증·권한·세션 흐름 변경" / trigger `codebase/backend/src/modules/auth/**` (match: semantic). targets 원문: "codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e"
  - 누락된 동반 갱신: `codebase/frontend/src/content/docs/07-workspace-and-team/` 에 비밀번호 변경 → 전 디바이스 세션 종료(재로그인 필요) 동작을 설명하는 페이지/절
  - 상세: 비밀번호 변경 성공 시 사용자의 다른 모든 디바이스 세션이 강제 로그아웃되고 현재 디바이스는 새 토큰으로 재발급된다. 이는 사용자가 체감하는 동작 변화(타 기기 재로그인 필요)다. 다만 현재 `07-workspace-and-team/` (security-2fa, workspaces-and-members, system-status) 어느 페이지도 비밀번호 변경/세션 흐름을 다루지 않으며, 전체 docs 어디에도 "비밀번호 변경" 사용자 가이드 절이 없다(`grep` 결과 0건). 따라서 "stale 갱신 누락"이 아니라 "신규 동작에 대응 문서 부재"로, 매트릭스 semantic 행의 회색 지대다.
  - 제안: 필수는 아니나 권장 — `07-workspace-and-team/` 또는 향후 profile/account 섹션에 "비밀번호 변경 시 다른 기기는 모두 로그아웃됩니다" 1줄 안내 추가 검토. 신규 UI 문자열은 발생하지 않았으므로 dict/backend-labels 동반 갱신 의무는 없음.

## 부정합 없음으로 확인된 항목 (no-finding)

- **i18n parity**: `change-password/page.tsx` 변경은 `setAccessToken` 호출 추가뿐이며 신규 한국어 리터럴 없음. 모든 `t()` 키(`profile.*`, `common.cancel`)는 기존 키 — dict {ko,en} 양쪽 등록 의무 비해당.
- **backend warning/error code → ko 매핑**: `INVALID_PASSWORD` / `USER_NOT_FOUND` / `UNAUTHENTICATED` 는 controller 에서 service 로 이동한 기존 코드이며 신규 `ErrorCode` enum/`warningRules` 발행 아님. `error-codes.ts` 미변경 → `backend-labels.ts` 매핑 의무 비해당.
- **e2e 보강 (auth-session-flow-change 의 "+ e2e" 절반)**: 동일 변경 set 에 `codebase/backend/test/users-change-password.e2e-spec.ts` 신규 추가 — 세션 회전·session_revoked(bulk)·ip_address 감사를 실 flow 로 검증. e2e 동반 의무 충족.
- **신규 섹션 디렉토리 / 노드 / 통합 / 표현식 / 실행·디버깅**: 해당 변경 없음.
- `ipAddress` 동반 기록 추가(`auth.controller.ts`, `webauthn.controller.ts`, `users.controller.ts`)는 감사 로그 내부 필드이며 사용자 가이드 노출 surface 아님 — 동반 갱신 트리거 아님.

## 요약
매트릭스 trigger 19개 중 1개(`auth-session-flow-change`, semantic)에 매칭. 그 row 의 동반 갱신 target 2개("07-workspace-and-team docs", "e2e") 중 e2e 는 같은 변경 set 에 충족됐고, docs 절반은 해당 사용자 흐름을 다루는 기존 페이지가 전무해 "stale 누락"이 아닌 "신규 동작 문서 부재"의 회색 지대(INFO 1건). i18n parity·backend code ko 매핑·신규 섹션 등 CRITICAL/WARNING 트리거는 모두 비해당. 누락 0건(CRITICAL/WARNING 기준), 권장 보강 1건.

## 위험도
LOW
