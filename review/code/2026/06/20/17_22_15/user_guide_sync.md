# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재 결과

- SSOT: `/Volumes/project/private/clemvion/.claude/config/doc-sync-matrix.json` — 18개 row 적재 완료
- 변경 파일 집합: `codebase/backend/src/modules/auth/` 하위 4개 파일 (auth.controller.ts, auth.controller.spec.ts, auth.service.ts, auth.service.spec.ts)

## trigger 매칭 분석

변경 파일 `codebase/backend/src/modules/auth/**` 는 매트릭스 행 `auth-session-flow-change` (id) 의 trigger glob `codebase/backend/src/modules/auth/**` 에 매칭됩니다.

해당 행의 targets: `codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e`

## 동반 갱신 누락 여부

변경 set 안에 `codebase/frontend/src/content/docs/07-workspace-and-team/` 하위 파일 변경이 없습니다.

## 발견사항

### 해당 없음 — 순수 내부 레이어 정렬 리팩터

변경의 실질:
- `AuthController.disable2fa` 가 `UsersService.findById` + `bcrypt.compare` 를 직접 호출하던 인라인 검증을 `AuthService.verifyPasswordForUser()` 새 메서드로 추출(이관)한 것입니다.
- 에러 코드(`PASSWORD_REQUIRED`, `PASSWORD_INVALID`), HTTP 401 shape, 사용자에게 노출되는 메시지 문자열은 **변경 전과 동일하게 보존**됩니다.
- API 엔드포인트 시그니처(`POST /auth/2fa/disable`), 요청/응답 DTO, Swagger 설명도 변경 없습니다.
- 신규 `warningCode` / `ErrorCode` enum 값이 추가되지 않았습니다.
- 새 UI 문자열(TSX 한국어 리터럴)이 추가되지 않았습니다.
- 신규 섹션 디렉토리가 생성되지 않았습니다.

`auth-session-flow-change` trigger 의 목적은 **사용자 관점에서 인증·세션 흐름이 달라질 때** `07-workspace-and-team/` 문서 갱신을 강제하는 것입니다. 본 변경은 레이어 내부 코드 위치만 바꾸고 사용자 가시 동작이 동일하므로, 문서 동반 갱신 의무가 발생하지 않습니다.

## 요약

매트릭스 18개 trigger 중 `auth-session-flow-change` 1개가 파일 경로로 매칭됩니다. 그러나 본 변경은 `bcrypt.compare` 를 컨트롤러에서 서비스로 이관하는 순수 레이어 정렬 리팩터로, 에러 코드·메시지·API 동작이 변경 전과 동일하게 보존됩니다. 사용자에게 노출되는 2FA 비활성화 흐름·에러 메시지·i18n 키·backend-labels 에 변화가 없으므로 동반 갱신 누락 0건입니다.

## 위험도

NONE
