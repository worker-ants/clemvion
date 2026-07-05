# 문서화(Documentation) Review — invite-accept-confirm-ui (V-09)

## 발견사항

- **[WARNING]** plan 체크박스가 구현 완료를 반영하지 않음 (V-09 잔류 표시)
  - 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` L35 `- [ ] 잔여: V-05·V-09·V-10·V-12·V-13·V-14·V-18 (major/minor — 결정 대기)`, L60-66 `V-09 [major] 초대 수락 페이지 자동수락` 절
  - 상세: 이번 changeset 은 V-09 가 지적한 갭(자동수락 → 확인 버튼/이메일 불일치 안내 UI)을 "코드 구현" 옵션으로 정확히 해소했다. 그러나 리뷰 대상 diff 에는 plan 파일 갱신이 포함되어 있지 않다. 프로젝트 관례(`plan_coherence` consistency checker 가 이미 동일 diff 에서 WARNING 으로 지적, `review/consistency/2026/07/05/14_54_13/plan_coherence.md`)상 developer 가 구현 완료 후 plan 체크박스를 갱신할 의무가 있으며, 다른 V-* 항목들(V-01, V-02, V-03, V-04, V-06 등)은 모두 완료 시 `[x]` + 브랜치/PR 참조 형식으로 갱신되어 있어 V-09 만 미갱신 상태로 남으면 plan 이 실제 상태와 어긋난다(`plan 체크박스 = 실제 상태` 원칙 위반).
  - 제안: 이 PR 또는 후속 커밋에서 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` L35 의 `V-09` 를 다른 완료 항목과 같은 형식으로 `[x]` 처리하고("코드 구현" 채택, 브랜치명/PR 번호 포함), L60-66 V-09 절에도 완료 사실과 실제 구현 요약(§1.5.3 흐름 + register redirect 진입 경로)을 덧붙인다.

- **[WARNING]** V-09 plan 항목이 언급한 frontmatter `code:` 매핑 공백은 해소됐으나, 나머지 minor 항목(V-05·V-10 등)과의 배치 맥락이 plan 본문에 반영 안 됨
  - 위치: `spec/5-system/1-auth.md` frontmatter `code:` (이미 이번 diff 로 `codebase/frontend/src/app/(main)/invitations/accept/**`, `register-form.tsx`, `lib/api/invitations.ts` 추가됨) vs `plan/.../spec-code-cross-audit-2026-06-10.md` L61 "frontmatter `code:` 매핑도 부재"
  - 상세: frontmatter 매핑 자체는 이번 diff 로 정정되어 실질 갭은 해소됐다. 다만 plan 문서의 "부재" 서술이 그대로 남아 있으면 향후 재감사 시 이미 해소된 항목을 다시 지적하는 오탐 소지가 있다. 위 첫 항목의 plan 갱신에 이 부분도 함께 반영하면 된다(별도 액션 불요, 첫 항목과 동일 커밋으로 처리 가능).
  - 제안: 첫 항목의 plan 갱신 시 "frontmatter code 매핑 완료"를 명시적으로 언급.

- **[INFO]** 인라인 주석 품질은 전반적으로 양호 — 의도가 비직관적인 지점에 근거가 잘 남아있음
  - 위치: `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` L343-345 (`§1.5.3` 참조 + 자동수락→버튼 전환의 배경 설명), L371-372 (`deps` 에 `locale` 미포함 근거), `codebase/frontend/src/components/auth/register-form.tsx` L1153-1156 (로그인 사용자 redirect 근거 + V-09 진입 경로 참조), L1164-1167 (동일 패턴의 `t` deps 제외 근거, 기존 관례와 일관)
  - 상세: 두 컴포넌트 모두 "왜 이렇게 짜여졌는지"를 설명하는 근거성 주석(effect deps 의도적 배제, 자동수락→명시적 확인 전환의 스펙 근거)을 포함해 향후 유지보수자가 되돌리는 실수를 방지하는 데 도움이 된다. 별도 조치 불요, 참고로만 기록.

- **[INFO]** CHANGELOG 업데이트 미포함 — 프로젝트 관례상 검토 필요
  - 위치: `CHANGELOG.md` (루트) — 최근 커밋들(webhook body 게이트, workflow settings DTO 등)은 매 PR 마다 `## Unreleased — <제목>` 항목을 추가하는 관례를 따르고 있으나, 이번 diff 에는 CHANGELOG 항목이 없음
  - 상세: 이 변경은 사용자 대면 UX 흐름을 바꾸는 major 수정(자동수락 제거 → 확인 버튼/불일치 안내, register 페이지 로그인 감지 redirect 추가)이라 다른 CHANGELOG 항목들과 비교했을 때 규모·영향 면에서 준하는 항목으로 보인다. CLAUDE.md/SKILL 문서에 CHANGELOG 작성이 강제 의무로 명시되어 있는지는 이 프롬프트 범위에서 확인되지 않았으므로 BLOCKER 로 올리지 않고 INFO 로 남긴다.
  - 제안: 팀 관례가 "모든 사용자 대면 변경에 CHANGELOG 항목 추가"라면, `## Unreleased — 초대 수락 확인 UI (V-09)` 형태로 항목을 추가할 것을 권장. 이미 정착된 관례가 아니라면 스킵 가능.

- **[INFO]** 새 상태(`Status` 타입 확장, `InvitationState`)에 대한 타입/함수 자체 JSDoc 은 없으나 spec 참조 주석으로 충분히 대체됨
  - 위치: `accept-invitation-content.tsx` L346-353 (`Status` 유니온), `register-form.tsx` L1112-1122 (`InvitationState` 유니온)
  - 상세: `AcceptInvitationContent`, `handleAccept`, `handleLogout`, `RegisterFormInner` 등 공개/핵심 함수에는 별도 JSDoc 블록이 없지만, 파일 상단 근접 주석(§1.5.3 참조)과 타입 정의 옆 인라인 주석이 그 역할을 충분히 대신하고 있다. 이 프로젝트의 다른 유사 컴포넌트도 JSDoc 보다 근접 주석 스타일을 주로 쓰므로 스타일 일관성 문제는 아니다. 다만 `InvitationMeta` 처럼 여러 파일(`accept-invitation-content.tsx`, `register-form.tsx`, 테스트)에서 공유되는 타입은 `lib/api/invitations.ts` (이번 diff 범위 밖, 미변경) 원본에 JSDoc 이 있는지 확인 권장 — 있다면 문제 없음.
  - 제안: 조치 불요(정보성). 향후 `invitations.ts` 를 직접 리뷰할 일이 있으면 `InvitationMeta`/`INVITATION_ERROR` export 에 JSDoc 유무만 한 번 확인.

- **[INFO]** 테스트 파일 자체가 사용법 예제 역할을 잘 수행
  - 위치: `accept-invitation-content.test.tsx`, `register-form.test.tsx` (§1.5.3 entry, V-09 케이스 포함)
  - 상세: 신규 UI 분기(수락 버튼, 불일치+로그아웃, redirect)에 대한 e2e 성격의 컴포넌트 테스트가 각 분기별로 존재해 "예제 코드" 요구를 사실상 충족한다. 별도의 사용 예제 문서는 불필요.

## 요약

이번 diff 는 spec(`1-auth.md` §1.5.3)에 이미 반영된 코드 주석 근거·i18n 키·테스트가 잘 갖춰져 있고, spec 자체도 진입 경로(register redirect)를 명시적으로 추가해 정합성이 높다. 유일한 실질 갭은 **plan 트래킹 문서**(`spec-code-cross-audit-2026-06-10.md`)가 이번 구현으로 V-09 가 해소되었음을 반영하지 못한 채 "미해결"로 남아있다는 점이며, 이는 이미 동일 changeset 의 consistency-check(`plan_coherence`, WARNING)에서도 지적된 사항이라 재확인 성격의 WARNING 으로 격상해 기록한다. CHANGELOG 미포함은 관례 확립 여부가 불확실해 INFO 로만 남긴다. 코드 자체의 독스트링·인라인 주석·주석 정확성은 양호하며 오래된/부정확한 주석은 발견되지 않았다.

## 위험도

LOW
