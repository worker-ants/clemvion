# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

- **[INFO]** 초대 수락 흐름의 신규 "이미 로그인 사용자 → register 링크 진입 시 자동 리다이렉트" 경로가 유저 가이드에 텍스트로 명시되지 않음
  - 변경 파일: `codebase/frontend/src/components/auth/register-form.tsx` (already-authenticated 사용자를 `/invitations/accept?token=` 로 `router.replace`), `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx`
  - 매트릭스 항목: 매트릭스에 정확히 대응하는 행은 없음 (`auth-session-flow-change` 는 `codebase/backend/src/modules/auth/**` glob 트리거이나 본 PR 은 backend `modules/auth` 무변경이라 미매칭). 가장 근접한 것은 `userguide-gui-flow-section`(user-guide GUI 흐름 절 신규/변경) 의 정신 — GUI 진입 경로가 바뀌면 가이드가 그 경로를 반영해야 한다는 일반 원칙
  - 누락된 동반 갱신(엄밀히는 "누락"이 아니라 "불완전"): `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` + `.en.mdx` 의 "## 초대를 받은 사용자 / What the invited person sees" 절
  - 상세: 위 두 문서는 이미 "이미 가입한 사용자 → `[Accept]` 버튼 / 이메일 불일치 → 로그인 안내" 최종 상태를 정확히 서술하고 있어(코드 변경 전부터 존재하던 문구) 사용자가 보는 **결과 화면**은 정합함. 다만 "메일의 `초대 수락하기` 버튼은 회원가입 페이지를 열어줘요" 라는 진입 문구는 이미 로그인한 사용자가 그 링크를 클릭했을 때 실제로는 register 페이지가 아니라 (내부적으로 `/invitations/accept` 로) 리다이렉트된다는 구현 디테일까지는 설명하지 않는다. 사용자 관점에서 최종 화면은 doc 서술과 일치하므로 사용자 경험을 오도하지는 않는다 — 순수 사용자 안내 문서로서는 corner-case 세부(내부 라우팅 메커니즘)까지 다룰 필요가 없을 수 있어 confirmatory 성격의 gray-area 로 판단
  - 제안: 필수는 아니나, 다음 문서 갱신 사이클에서 "메일 링크를 클릭하면 로그인 상태에 따라 자동으로 알맞은 화면(가입 또는 수락)으로 연결돼요" 정도의 한 문장 보강을 고려. 즉시 조치 불필요

## 요약

매트릭스 `rows[]` 9개 중 이번 변경 set 과 관련해 검토한 trigger 는 `new-ui-string`(신규 UI 문자열/i18n parity), `auth-session-flow-change`(인증·세션 흐름), `spec-major-change`(spec/5-system/1-auth.md 갱신) 3개다. 신규 한국어 리터럴(`mismatchTitle`/`mismatchHint`/`logoutAndSwitch`)은 `dict/ko/invitations.ts`·`dict/en/invitations.ts` 양쪽에 동일 PR 내에서 parity 등록됐고, `spec/5-system/1-auth.md` 는 §1.5.3 에 신규 진입 경로 안내 문단 + frontmatter `code:` 글로브(frontend accept 페이지·register-form·invitations API)까지 동반 갱신되어 SoT 정합이 유지된다. `auth-session-flow-change` 트리거는 backend `modules/auth/**` glob 무변경이라 실제로는 미매칭(순수 frontend 버그 수정 — 자동수락→확인 버튼 UX 정정)이었고, `07-workspace-and-team/workspaces-and-members.{mdx,en.mdx}` 의 사용자 가시 문구는 이미 최종 동작(수락 버튼/불일치 안내)과 일치해 실질적 stale 은 없다. 동반 갱신 누락은 CRITICAL/WARNING 급으로 확인된 것이 없고, 리다이렉트 진입 경로의 문서 세부 서술 보강 여지 정도만 INFO 로 기록한다.

## 위험도

LOW
