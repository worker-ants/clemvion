# 문서화(Documentation) Review — invite-accept-confirm-ui (V-09, 재검토 15_33_01)

## 발견사항

- **[WARNING]** CHANGELOG.md 에 이번 변경(사용자 대면 UX 흐름 변경) 항목이 없음
  - 위치: 루트 `CHANGELOG.md` (이번 diff 에 미포함 — `git diff origin/main...HEAD -- CHANGELOG.md` 결과 없음)
  - 상세: `CHANGELOG.md` 를 확인한 결과, 최근 병합된 PR들(#762 webhook body 게이트, #805/#806/#807 workflow settings DTO·orphan pending backstop 등)은 예외 없이 `## Unreleased — <제목>` 형식의 항목을 매 PR 마다 추가하는 확립된 관례를 따르고 있다. 이번 변경은 (a) 초대 수락 페이지의 핵심 UX 흐름을 자동수락→명시적 확인 버튼/불일치 안내로 전면 교체하고 (b) 로그인 사용자가 초대 가입 링크로 진입 시 리다이렉트하는 신규 진입 경로를 추가하는 **사용자 대면 major 변경**으로, 다른 CHANGELOG 등재 항목들과 영향 범위·성격이 동등하거나 그 이상이다. 그럼에도 이번 changeset 에는 CHANGELOG 항목이 없어 관례상 누락으로 보인다. (이전 세션 15_20_19 documentation 리뷰에서는 "관례 확립 여부가 불확실"하다는 이유로 INFO 로 남겼으나, 이번 확인 결과 관례가 명확히 확립되어 있음을 확인했다.)
  - 제안: `## Unreleased — 초대 수락 확인 UI (§1.5.3, V-09)` 형태로 항목을 추가하고, 자동수락 제거·확인 버튼/불일치 안내 도입·register 페이지 로그인 감지 리다이렉트를 요약. 이미 팀 판단으로 CHANGELOG 를 스킵하기로 확정했다면(예: 프론트엔드 UI-only 변경은 별도 트랙) 이 WARNING 은 조치불요로 넘겨도 무방하나, 최근 항목들이 모두 백엔드 변경 중심이라 프론트 변경에 대한 명시적 스킵 정책이 문서화된 근거는 확인되지 않았다.

- **[INFO]** `InvitationMeta`/`invitationsApi`/`INVITATION_ERROR` (lib/api/invitations.ts) 는 이미 충분한 JSDoc 보유 — 이전 리뷰의 확인 필요 항목 해소
  - 위치: `codebase/frontend/src/lib/api/invitations.ts`
  - 상세: 이전 세션(15_20_19) documentation 리뷰가 "`invitations.ts` 를 직접 리뷰할 일이 있으면 JSDoc 유무 확인 권장"이라고 남긴 open 항목을 확인했다. `invitationsApi` 객체 상단에 spec 참조(spec/2-navigation/10-auth-flow.md §2.6, spec/5-system/1-auth.md §1.5)를 포함한 JSDoc 블록이 있고, `InvitationMeta.invitedByName` 필드에도 null 의미를 설명하는 인라인 주석이 있으며, `INVITATION_ERROR` 상수에도 spec 참조 주석이 있다. 별도 조치 불요.

- **[INFO]** plan 체크박스는 이미 갱신 완료 상태 확인 (이전 리뷰의 WARNING 은 해소됨)
  - 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` L35
  - 상세: 이전 세션(15_20_19)의 documentation/consistency 리뷰가 지적한 "V-09 plan 체크박스 미갱신" WARNING 은 이번 changeset 에 포함된 `RESOLUTION.md` 조치로 이미 해소되어, 현재 L35 가 `- [x] **V-09** (...) — invite-accept-confirm-ui 브랜치(본 PR)에서 코드 구현...` 형태로 다른 완료 항목과 동일한 형식을 갖추고 있다. 재확인 결과 실질 갭 없음.

- **[INFO]** 인라인 주석·spec 상호 참조 품질 양호, 오래된 주석 없음
  - 위치: `accept-invitation-content.tsx` (§1.5.3 참조 주석, deps 배제 근거), `register-form.tsx` (V-09 진입 경로 주석), `spec/5-system/1-auth.md` (신규 "경로·진입" 문단)
  - 상세: 코드 인라인 주석과 spec 본문(§1.5.3 인접 "경로·진입" 문단)이 서로 정합적으로 갱신되어 이번 diff 범위 내에서 stale 주석은 발견되지 않았다. `register-form.tsx` 의 로그인 사용자 리다이렉트 effect 주석도 spec 문구("register 폼은 미가입자 가입 경로")와 실제 조건 분기(`invitationToken && isAuthenticated`)가 일치한다.

- **[INFO]** 테스트 파일이 사용 예제 역할 충분 — 별도 사용법 문서 불요
  - 위치: `accept-invitation-content.test.tsx`, `register-form.test.tsx`
  - 상세: 신규 상태 전이(수락 버튼 클릭 흐름, 이메일 불일치+로그아웃, redirect)를 각각 커버하는 테스트가 실질적으로 컴포넌트 사용 예제 역할을 겸한다. 추가 조치 불요.

## 요약

이번 재검토(15_33_01) 시점에는 이전 세션(15_20_19)에서 지적된 plan 체크박스 미갱신 WARNING 이 이미 RESOLUTION 으로 해소되어 있고, 코드의 독스트링·인라인 주석·spec-코드 정합성은 전반적으로 양호하다. 다만 CHANGELOG.md 를 직접 확인한 결과 최근 병합 PR 전건이 `## Unreleased — <제목>` 항목을 남기는 확립된 관례를 따르고 있음에도 이번 사용자 대면 UX 변경(초대 수락 흐름 재설계 + 로그인 사용자 리다이렉트 진입 경로)에는 해당 항목이 없어, 이전 리뷰에서 INFO 로 유보됐던 사안을 WARNING 으로 격상해 기록한다. 이 외 문서화 관점의 실질적 갭은 발견되지 않았다.

## 위험도

LOW
