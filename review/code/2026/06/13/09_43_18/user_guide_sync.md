# 유저 가이드 동반 갱신(User Guide Sync) Review

## 매트릭스 적재 결과

`.claude/config/doc-sync-matrix.json` 에서 19개 행 적재 완료. `PROJECT.md` §변경 유형 → 갱신 위치 매핑 보조 확인.

## 변경 파일 목록 (이번 PR)

- `codebase/backend/src/modules/audit-logs/audit-action.const.ts` — `user.password_changed` / `user.2fa_enabled` / `user.2fa_disabled` 3개 액션 상수 추가
- `codebase/backend/src/modules/auth/auth.controller.ts` — `verify2fa`, `disable2fa` 에 audit 기록 추가
- `codebase/backend/src/modules/auth/auth.controller.spec.ts` — 2FA audit 테스트 추가
- `codebase/backend/src/modules/auth/auth.module.ts` — `AuditLogsModule` import 추가
- `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` — WebAuthn 등록/삭제 시 audit 기록 추가
- `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts` — WebAuthn audit 테스트 (신규)
- `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` — `deleteCredential` 반환 타입 `Promise<{ remaining: number }>`로 변경
- `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts` — 반환값 검증 추가
- `codebase/backend/src/modules/users/users.controller.ts` — `changePassword` 에 audit 기록 추가
- `codebase/backend/src/modules/users/users.controller.spec.ts` — password_changed audit 테스트 추가
- `codebase/backend/src/modules/users/users.module.ts` — `AuditLogsModule` import 추가
- `plan/complete/spec-draft-audit-workspace-scope.md` (신규 — 완료 plan)
- `plan/complete/spec-draft-refactor-04-security-drift.md` (신규 — 완료 plan)
- `review/code/2026/06/13/09_28_06/` — 직전 리뷰 산출물

## Trigger 매칭 분석

### 매칭된 Trigger

**`auth-session-flow-change`** (id)
- glob: `codebase/backend/src/modules/auth/**` (match: semantic)
- 변경 파일 `auth.controller.ts`, `webauthn/webauthn.controller.ts`, `auth.module.ts` 등이 글로브에 매칭됨.
- Target: `codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e`

### 동반 갱신 필요 여부 판정

`07-workspace-and-team/` 에는 `security-2fa.mdx` + `security-2fa.en.mdx` 가 존재하며 2FA 설정 UX를 설명한다. 이번 변경의 실질적 내용은:

1. 기존 2FA 활성화/비활성화 엔드포인트(`verify2fa`, `disable2fa`, WebAuthn `registerVerify`/`delete`, `changePassword`)에 **감사 로그 기록 코드를 삽입**한 것.
2. `webauthn.service.ts` `deleteCredential` 반환 타입 변경(`void` → `{ remaining: number }`) — controller 내부 사용 전용, API 응답 변경 없음.
3. 새 audit action 상수 추가 — 순수 내부 상수, 사용자에게 직접 노출되지 않음.

**사용자 관점 변화 없음**: 2FA 등록·해제·비밀번호 변경의 UI/UX 흐름, API 응답, 동작은 전혀 바뀌지 않았다. 이번 PR은 기존 동작 뒤에 내부 감사 로그 emit을 추가한 것이며, `security-2fa.mdx` 가 설명하는 내용(등록 절차, 로그인 우선순위, Passkey 관리)은 여전히 정확하다.

`auth-session-flow-change` 의 target인 "관련 페이지"는 **흐름이 사용자에게 가시적으로 변경되었을 때** 갱신 대상이 된다. 감사 로그 수집은 사용자에게 노출되지 않는 백엔드 내부 동작이므로 해당 페이지의 갱신 필요성이 없다.

또한:
- 신규 UI 문자열 없음 → `new-ui-string` trigger 미해당
- 신규 노드 없음 → `new-node` / `node-schema-change` 미해당
- 신규 warning/error code 발행 없음 → `new-warning-code` / `new-error-code` 미해당
- 신규 섹션 디렉토리 없음 → `new-userguide-section-dir` 미해당
- 통합/제공자 변경 없음 → `integration-provider-change` 미해당
- 표현식 언어 변경 없음 → `expression-language-change` 미해당
- 실행·디버깅 흐름 변경 없음 → `run-debug-flow-change` 미해당

## 발견사항

해당 없음. 변경 파일이 `auth-session-flow-change` glob에 형식상 매칭되나, 이번 변경의 내용은 기존 인증 흐름 뒤에 감사 로그 emit을 추가한 것으로 사용자 가시 흐름 변경이 없다. `codebase/frontend/src/content/docs/07-workspace-and-team/security-2fa.mdx` + `.en.mdx` 는 여전히 정확하며 갱신 불필요. 매트릭스 19개 trigger 중 1개 형식 매칭, 실질 동반 갱신 필요 항목 0건.

## 요약

매트릭스 19개 trigger 중 `auth-session-flow-change` 1개가 glob 형식으로 매칭되나, 이번 변경은 기존 2FA·비밀번호 변경 엔드포인트에 감사 로그 emit만 추가한 것으로 사용자 가시 흐름·UI·API 응답이 변경되지 않았다. `07-workspace-and-team/security-2fa.{mdx,en.mdx}` 는 현재 내용 그대로 정확하며 동반 갱신 불필요. 다른 trigger(신규 노드·UI 문자열·경고/오류 코드·섹션 디렉토리·통합 변경 등)는 모두 비매칭. 누락된 동반 갱신 0건.

## 위험도

NONE
