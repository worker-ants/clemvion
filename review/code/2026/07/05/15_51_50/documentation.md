# 문서화(Documentation) Review — invite-accept-confirm-ui 후속 (CHANGELOG + §2.6 검증)

## 발견사항

- **[INFO]** 신규 CHANGELOG 항목·spec §2.6 신설 노트가 코드와 정확히 일치함 (검증 완료)
  - 위치: `CHANGELOG.md` L3-8(`## Unreleased — 초대 수락 확인 UI + 기가입자 진입 경로 (§1.5.3, V-09)`), `spec/2-navigation/10-auth-flow.md` §2.6(L127 헤딩, L130 신규 인용문), `spec/5-system/1-auth.md` §1.5.3 신규 인용문(L267)
  - 상세: 이전 라운드(15_20_19) documentation 리뷰의 WARNING(plan 체크박스 미갱신)은 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` L35 V-09 항목이 `[x]` 로 갱신되며 해소됐다. 이번 diff 의 실제 초점인 CHANGELOG 신규 항목과 두 spec 노트는 코드와 대조한 결과 모두 정확하다.
    - CHANGELOG 항목 1 (`accept-invitation-content.tsx`): "마운트 즉시 무조건 `acceptInvitation` 호출 → 토큰 메타 먼저 조회 → (a) 이메일 일치 시 [수락] 버튼, (b) 불일치/미로그인 시 안내+로그아웃 버튼" — 실제 코드(`useEffect`가 `invitationsApi.getByToken` 조회 후 `useAuthStore` 이메일과 비교해 `"ready"`/`"mismatch"` 분기, `handleAccept` 는 버튼 클릭으로만 트리거)와 정확히 일치. "클라이언트 이메일 일치 검사는 UX 게이팅일 뿐, 실제 인가는 서버가 재검증" 서술도 `handleAccept` 가 `workspacesApi.acceptInvitation(token)` 서버 호출에 의존하는 구조와 부합.
    - CHANGELOG 항목 2 (`register-form.tsx`): "`has_session` 힌트 쿠키로 기존 세션 감지 → `/invitations/accept?token=` redirect", "`(auth)` 라우트 그룹엔 AuthProvider 없어 쿠키로 판정" — 코드의 신규 `useEffect`(L104-124, `document.cookie.split("; ").includes("has_session=1")` 검사 후 `router.replace`)와 정확히 일치. `has_session` 쿠키는 `auth-store.ts:36,45`(로그인 시 심음/로그아웃 시 지움)와 `proxy.ts:35`(라우팅 판단에 동일 신호 사용)가 실제로 존재해 "proxy.ts 와 동일 신호" 서술도 사실과 부합.
    - `spec/2-navigation/10-auth-flow.md` §2.6(L127 헤딩) 바로 아래 삽입된 인용문 블록은 CHANGELOG 가 가리키는 "§2.6" 위치와 정확히 일치하며, `spec/5-system/1-auth.md` §1.5.3(anchor `#153-흐름-이미-가입한-사용자가-다른-워크스페이스에-초대된-경우`)로의 상호 링크도 유효하다. `1-auth.md` 측에도 대칭되는 "경로·진입" 인용문(§1.5.3 하단)이 추가되어 두 spec 문서가 서로를 참조하는 구조가 코드의 실제 진입 경로(메일 링크 `/auth/register?invitationToken=` → 로그인 사용자 감지 → `/invitations/accept?token=` redirect)와 정확히 대응한다.
    - `1-auth.md` frontmatter `code:` 매핑에 `codebase/frontend/src/app/(main)/invitations/accept/**`, `register-form.tsx`, `lib/api/invitations.ts` 세 경로가 추가되어 있고, 실제로 diff 에 포함된 파일들과 일치한다.
  - 제안: 조치 불요 — 확인만 완료.

- **[INFO]** CHANGELOG 항목 2 문장 안 "SoT" 참조가 두 spec 파일을 정확히 가리킴
  - 위치: `CHANGELOG.md` L8 끝 `SoT: spec/5-system/1-auth.md §1.5.3 + spec/2-navigation/10-auth-flow.md §2.6.`
  - 상세: 두 경로·섹션 번호 모두 실제 파일에 존재하고(§1.5.3 은 `1-auth.md` 기존 섹션, §2.6 은 `10-auth-flow.md` 기존 섹션 "초대 토큰을 통한 가입") 이번 diff 로 두 곳 모두 신규 인용문이 삽입되어 있어 참조가 stale 하지 않다.
  - 제안: 조치 불요.

- **[INFO]** `10-auth-flow.md` §2.6 신규 노트의 "아래 표(1~7)는 로그인하지 않은 미가입자 경로에만 적용된다" 서술이 표 구조와 일치
  - 위치: `spec/2-navigation/10-auth-flow.md` L130(신규 노트) 직후 L132 이하 "단계 1~7" 표
  - 상세: 신규 노트가 표 앞에 삽입되어 "표는 미가입자 경로 전용, 기가입자는 별도 분기(redirect)"라는 스코프 한정이 표 구조상 자연스럽게 읽힌다. 순서·위치 모두 적절.
  - 제안: 조치 불요.

## 요약

이번 changeset 의 핵심 목적(이전 WARNING 조치 검증)은 확인 완료다. 신규 CHANGELOG `## Unreleased` 항목 2건(수락 확인 UI 전환, 기가입자 register redirect)은 실제 코드(`accept-invitation-content.tsx`, `register-form.tsx`) 동작과 문구·인과관계·SoT 참조 모두 정확히 일치하며, 과장되거나 누락된 서술이 없다. `spec/2-navigation/10-auth-flow.md` §2.6 신규 인용문과 `spec/5-system/1-auth.md` §1.5.3 신규 인용문도 서로 상호 링크하며 코드의 실제 진입 경로(메일 링크 → register 폼의 `has_session` 쿠키 감지 → accept 페이지 redirect)를 정확히 반영한다. 이전 라운드에서 지적된 plan 체크박스 미갱신 WARNING 도 V-09 `[x]` 처리로 해소됐다. 추가로 발견된 문제는 없다.

## 위험도

NONE
