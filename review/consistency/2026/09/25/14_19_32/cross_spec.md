# Cross-Spec 일관성 검토 — spec-draft-workspace-path-guard

대상: `plan/in-progress/spec-draft-workspace-path-guard.md` (spec draft, `--spec` 모드)

## 발견사항

### [CRITICAL] `RolesGuard` 코드 부여가 전역 변경인데 `2-navigation/6-config.md` 의 명시적 `403 FORBIDDEN` 계약이 누락됨

- **target 위치**: C-1 (e) 신설 Rationale «가드 거부의 오류 코드» (draft 122~141행) — "가드의 **모든** 멤버십 · 역할 거부에 함께 코드를 붙인다" 문장. `spec_impact` 목록(frontmatter)에는 이 변경이 반영되지 않음.
- **충돌 대상**: `spec/2-navigation/6-config.md` §A.4 "권한" — "Editor / Viewer 는 … 변경 액션 버튼은 미노출 + API 직접 호출 시 **403 `FORBIDDEN`**. … 실제 인가는 백엔드 `@Roles('admin')` 가 fail-closed 로 강제한다."
- **상세**: `RolesGuard` 는 앱 전역 `APP_GUARD` 이며 (`codebase/backend/src/common/guards/roles.guard.ts`), `@Roles('admin')` 로 게이트된 `auth-configs.controller.ts` 의 5개 라우트도 **동일한 가드 인스턴스**를 거친다. C-1(e) 는 "가드의 모든 멤버십 · 역할 거부" 라고 명시적으로 전역 범위를 선언했고, C-2 가 `error-handling.md` 의 "`X-Workspace-Id` 3분기 (3)" 를 "코드 없는 403" → "`NOT_A_MEMBER`(403)" 로 바꾸는 것도 이 라우트 특정이 아니라 시스템 전역 규칙이다. 실측(`roles.guard.ts` 96~144행)으로도 현재 역할 거부는 `return false` 만 하고 NestJS 기본 `ForbiddenException`(코드 없음, `api-convention.md §5.3` 기본값 `403=FORBIDDEN`)이 나가는 것을 확인했다 — `6-config.md` 의 현재 서술과 일치. 이 draft 가 채택되면 `auth-configs` Admin-gated 라우트를 Editor/Viewer 가 직접 호출했을 때 응답이 `FORBIDDEN` → `ADMIN_REQUIRED` 로 **반드시** 바뀌는데, `6-config.md` 는 `spec_impact` 에 없고 draft C-1~C-6 어디에도 갱신 계획이 없다. 즉 이 draft 를 그대로 반영하면, 구현 직후 `6-config.md` 의 API 계약 서술이 실제 응답과 어긋나는 상태가 된다(두 spec 이 같은 엔드포인트의 응답 `code` 를 다르게 주장).
- **제안**: (1) draft 의 C 절에 `spec/2-navigation/6-config.md` §A.4 갱신을 추가 — `FORBIDDEN` → `ADMIN_REQUIRED` (근거: 신설 Rationale 링크). (2) `spec_impact` 목록에 이 파일을 추가. (3) 동일 패턴(모든 `@Roles()` 게이트가 이제 코드를 낸다)이 다른 화면 spec 에도 남아 있을 수 있으므로, `@Roles(` 를 인용하며 구체적 wire code(특히 `FORBIDDEN`)를 명시한 다른 spec 문서 전수를 확인할 것을 권한다(본 검토에서는 `spec/` 전수 grep 상 `6-config.md` 가 유일한 명시적 사례였다).

### [WARNING] `error-codes.md §3` historical-artifact 레지스트리가 `1-auth.md §1.5.4` 의 `forbidden` 삭제를 반영하지 못함

- **target 위치**: C-3 `spec/5-system/1-auth.md` — "§1.5.4(초대 발송 · 재발송 · 취소) 권한 실패의 코드: `forbidden` → `ADMIN_REQUIRED`."
- **충돌 대상**: `spec/conventions/error-codes.md` §3 레지스트리 행 — `` `invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` · `forbidden` · `rate_limited` `` , 근거 열이 정확히 `` [`1-auth.md §1.5.4`](../5-system/1-auth.md#154-에러-응답) `` 를 가리킨다.
- **상세**: 이 레지스트리 행은 "위 6개 코드가 모두 `1-auth.md §1.5.4` 에 문서화된 lowercase historical-artifact 다" 라고 주장하며 그 절을 근거로 인용한다. C-3 이 §1.5.4 의 "권한 부족" 행을 `forbidden` → `ADMIN_REQUIRED`(UPPER_SNAKE) 로 바꾸면, 근거 문서는 더는 `forbidden` 을 담고 있지 않은데 레지스트리는 여전히 `forbidden` 을 그 근거로 인용한 채 남는다 — 두 spec 파일이 같은 행에 대해 서로 다른 사실(있음 vs 없음)을 주장하게 된다. draft 의 C-4 는 error-codes.md 의 **다른** 행(`workspace_not_found`·`user_not_found`·`admin_required` — §1.9/§1.2 초대 모듈 lookup 코드)에만 註를 달아, 이 §1.5.4 인용 행은 손대지 않는다. (참고: 실측상 frontend `invitations.ts` 의 `INVITATION_ERROR` 상수는 `forbidden`/`rate_limited` 를 애초에 소비하지 않으므로 breaking-change 위험 자체는 낮다 — 다만 레지스트리 문서의 자기 정합성 문제는 남는다.)
- **제안**: C-4 에 §3 레지스트리의 `forbidden` 열거에서 해당 항목을 제거하거나 "2026-09-25 이후 §1.5.4 초대 권한-부족 케이스는 `ADMIN_REQUIRED` 로 대체, 이 행은 나머지 5개 코드(`invitation_not_found` 등)에만 적용" 이라는 각주를 추가.

### [WARNING] "URL slug = FE 라우팅 SoT (≠ backend 인가 SoT)" Rationale 의 무조건적 서술이 새 예외를 반영하지 못함

- **target 위치**: draft 가 patch 하는 `spec/data-flow/12-workspace.md` 의 세 자매 Rationale 중 "멤버십 검증은 가드 1곳에서"(C-1 (b))와 "UUID 검증 강도 비대칭"(C-1 (d))은 명시적으로 patch 되지만, 같은 파일의 세 번째 자매 절 "URL slug = FE 라우팅 SoT (≠ backend 인가 SoT)" 는 draft C 절 어디에도 등장하지 않는다.
- **충돌 대상**: 그 절의 문장 — "인가는 **여전히 위 header-first(`X-Workspace-Id`) → 토큰 클레임(`activeWorkspaceId`) 모델이 결정**하며, slug 라우팅은 그 위에서 헤더가 유래하는 값의 출처만 바꾼다."
- **상세**: draft C-1 (a)/(c) 는 새 불변식을 도입한다 — "경로 파라미터로 워크스페이스를 받는 라우트는 **헤더 · 토큰이 아니라 경로 값이 인가 대상**." 이는 위 인용문이 무조건적으로 단언하는 "인가는 여전히 header-first → 토큰 모델이 결정한다" 는 명제의 반례가 된다(경로 라우트 15곳은 이제 그 모델을 따르지 않는다). "UUID 검증 강도 비대칭" 절은 정확히 같은 종류의 낡은 단언("`:id` 는 인가 판정의 입력이 아니라 리소스 지목")에 draft (d)로 "2026-09-25 정정 — 워크스페이스 `:id` 에 한해 더는 참이 아니다" 라는 캐벗을 붙였다. "URL slug" 절도 동일한 population 가정(헤더/토큰 컨텍스트만 다룬다)을 공유하는데, 이쪽만 정정이 누락되면 이 spec 파일 안에서 서로 다른 절이 서로 다른 진실을 말하게 된다.
- **제안**: "URL slug = FE 라우팅 SoT" 절의 "계층 분리" 문단 끝에, (d)와 동일한 패턴으로 "경로 파라미터 워크스페이스 라우트는 이 header-first→토큰 모델의 예외다 — [Rationale «경로 파라미터 워크스페이스도 가드가 본다»] 참조" 캐벗을 추가할 것.

## 요약

핵심 대상 파일(`spec/data-flow/12-workspace.md`)의 실측·결정·spec 변경 초안은 내부적으로 꼼꼼하다 — 15개 경로 라우트의 census, 역할별 버킷 분류(Admin 8 / Owner 2 / 멤버 4 / 전환 1)는 `2-navigation/9-user-profile.md` §6.1 API 표와 `data-flow/12-workspace.md` §1.6 권한 표에 문자 그대로 부합했고, `removeMember` 의 조건부 admin 요구(자가 탈퇴 예외)도 실제 서비스 코드(`workspaces.service.ts`)와 정확히 일치해 최초 의심(허위 충돌)은 반증됐다. 그러나 draft 가 스스로 명명한 변경의 **실제 반경**이 draft 의 `spec_impact` 목록보다 넓다 — `RolesGuard` 는 앱 전역 가드이므로 "가드의 모든 역할 거부에 코드를 붙인다" 는 결정은 워크스페이스 경로 라우트뿐 아니라 `auth-configs` 같은 기존 `@Roles('admin')` 라우트에도 적용되는데, 그 영향을 명시한 유일한 기존 spec(`2-navigation/6-config.md`)이 갱신 대상에서 빠졌다(CRITICAL). 그 밖에 같은 파일·인접 파일 안에서 draft 가 두 개의 자매 Rationale 은 정정하면서 population 가정이 같은 세 번째·네 번째 절(`error-codes.md §3` 레지스트리, "URL slug" Rationale)은 정정하지 않아, 채택 시 spec 내부에 자기모순 문장이 남는다(WARNING ×2).

## 위험도
HIGH
