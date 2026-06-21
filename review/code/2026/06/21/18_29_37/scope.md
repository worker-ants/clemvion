# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] 이메일 변경 기능의 완전한 풀스택 구현 — 범위 내
- 위치: 파일 1~23 전체 (backend 12개, frontend 8개, doc 2개, plan 1개)
- 상세: 모든 변경이 "이메일 변경 프로세스 구현 (spec/5-system/1-auth.md §1.1.B)" 단일 기능에 집중되어 있다. DB migration (V100), entity, DTO, service, controller, mail, API client, frontend page, i18n, docs, plan 파일이 모두 동일 목적의 수직 구성이다.
- 제안: 해당 없음.

### [INFO] `MessageResponseDto` 를 `user-response.dto.ts` 에 추가 — 범위 내
- 위치: `codebase/backend/src/modules/users/dto/responses/user-response.dto.ts`
- 상세: `MessageResponseDto` 는 이메일 변경 3개 엔드포인트(request/resend/cancel)의 응답 타입으로 즉시 사용된다. 범위를 벗어난 범용 리팩토링이 아니라 필요에 의한 추가다.
- 제안: 해당 없음.

### [INFO] `SessionsService.reauthenticate` 공개 메서드 추가 — 범위 내
- 위치: `codebase/backend/src/modules/auth/sessions.service.ts`
- 상세: `verifyReauth` (private)를 래핑하는 `reauthenticate` (public)를 신설한다. `AuthService.requestEmailChange` 에서 단일 호출점으로 사용되며, 기존 코드 수정은 없다. 기능 확장이 아닌 최소 인터페이스 노출이다.
- 제안: 해당 없음.

### [INFO] `UsersService.emailTakenByOther` 추가 — 범위 내
- 위치: `codebase/backend/src/modules/users/users.service.ts`
- 상세: 이메일 변경 흐름의 신규 이메일 중복 검사용으로 직접 필요하다. 기존 `isEmailTaken` 과 별도로 자신(excludeUserId)을 제외하는 쿼리가 필요하다. 기존 코드 수정 없이 순수 추가.
- 제안: 해당 없음.

### [INFO] `isUniqueEmailViolation` private 헬퍼 추가 — 범위 내
- 위치: `codebase/backend/src/modules/auth/auth.service.ts`
- 상세: `verifyEmailChange` 내 race condition 처리를 위한 DB 에러 코드 감지 헬퍼다. 동일 서비스 내 즉시 사용되며 추가 공개 API를 노출하지 않는다.
- 제안: 해당 없음.

### [INFO] 프로필 페이지 이메일 섹션 UI 변경 — 범위 내
- 위치: `codebase/frontend/src/app/(main)/profile/components/profile-info-card.tsx`, `codebase/frontend/src/app/(main)/profile/page.tsx`
- 상세: "이메일 변경하기" CTA 링크와 pending 상태 표시가 추가됐다. 기존 `emailReadonlyHint` 문구에서 "(coming soon)" 제거도 기능 출시에 따른 당연한 업데이트다. 이메일 변경 기능의 진입점 구현으로 범위 내다.
- 제안: 해당 없음.

### [INFO] 일관성 검토 산출물 커밋 포함 — 프로젝트 규약 내
- 위치: `review/consistency/2026/06/21/17_18_50/` 하위 파일들 (파일 26~32)
- 상세: `CLAUDE.md` 및 MEMORY의 "plan 체크박스 = 실제 상태" 규약에 따라 review/ 산출물도 커밋 대상이다. 구현 PR 에 일관성 검토 결과가 포함되는 것은 이 프로젝트의 의도된 워크플로다.
- 제안: 해당 없음.

### [INFO] 문서 파일 2개(`.mdx`, `.en.mdx`) 동시 수정 — 범위 내
- 위치: `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx`, `password-and-sessions.en.mdx`
- 상세: 두 파일 모두 이메일 변경 기능의 사용자 가이드 문단 추가다. 기존 비밀번호 변경 문서와 같은 파일에 추가된 것은 "password-and-sessions" 주제 그룹으로 자연스럽게 묶인 결과다.
- 제안: 해당 없음.

### [INFO] `_retry_state.json` 커밋 포함 — 의도 확인 필요 (low concern)
- 위치: `review/consistency/2026/06/21/17_18_50/_retry_state.json`
- 상세: 오케스트레이터가 생성한 내부 상태 파일이 커밋에 포함됐다. `agents_success: []`, `agents_fatal: []` 로 초기 상태인 점이 눈에 띄나, 해당 파일 자체가 `review/` 디렉터리의 일부이며 프로젝트 `.gitignore` 제외 대상이 아님이 MEMORY에 명시됐다. 기능 변경과 무관한 인프라 파일이지만 review/ 산출물 범주로 허용된다.
- 제안: 향후 `_retry_state.json` 을 `.gitignore` 에 추가할지 여부를 팀이 명시적으로 결정하는 것을 권장하나, 현재 변경을 차단할 수준은 아니다.

## 요약

변경 범위 관점에서 이번 PR은 "이메일 변경 프로세스 구현 (spec §1.1.B)" 단일 기능에 매우 잘 집중되어 있다. 23개 기능 파일 모두 DB migration → entity → service → controller → mail → frontend page → API client → i18n → docs의 수직 연결고리 안에 있으며, 불필요한 리팩토링이나 무관한 파일 수정은 발견되지 않는다. `review/consistency/` 산출물 포함도 프로젝트 규약에 따른 정상 범위다. `_retry_state.json`의 커밋 포함이 미세하게 의문이나 범위를 위반한다고 볼 수 없다.

## 위험도

NONE
