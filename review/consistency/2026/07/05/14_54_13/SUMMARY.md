# consistency-check --impl-prep SUMMARY — V-09 초대 수락 확인 UI (14_54_13)

**BLOCK: NO (스코프 확장으로 대응)** — cross_spec CRITICAL(accept page 재작성만으론 진입 경로 부재)을 **스코프에 register redirect 포함**으로 해소(사용자 결정 2026-07-05). checker 5/5.

| Checker | 위험도 | 핵심 |
|---|---|---|
| cross_spec | MEDIUM(CRITICAL) | **초대 메일 링크가 /auth/register?invitationToken 으로 가고, register page 에 로그인 감지→/invitations/accept redirect 로직 부재 → §1.5.3 흐름 진입 경로 없음**. → 스코프에 register redirect 포함(사용자 결정). WARNING: §1.5.3 에 accept page query param `token` 미명시 → spec 1줄 추가. INFO: invitations.ts doc comment |
| rationale_continuity | LOW | §1.5.3 흐름과 정합. invitation lowercase 에러코드 historical-artifact 예외 등록됨 |
| convention_compliance | NONE | 규약 정합. INFO 2(pre-existing) |
| plan_coherence | WARNING | V-09 plan 권장(코드 구현) 일치. frontmatter code 매핑 부재 → 구현 동반 추가 |
| naming_collision | LOW | WARNING: GET /invitations/:token 이 1-auth:481·9-user-profile:349 중복(문서 nit, 무관·선택) |

## 확정 스코프 (진입 경로 포함)
1. `accept-invitation-content.tsx` 재작성 — 마운트 시 getByToken→user.email==meta.email 이면 [수락] 버튼(workspaceName), 불일치면 "{email} 로 발송, 해당 계정 로그인" + 로그아웃, 410 만료 error.
2. **register page/form** — 로그인 상태 + invitationToken → `/invitations/accept?token=` redirect (진입 경로, cross_spec CRITICAL).
3. frontmatter code 매핑(1-auth.md 에 frontend paths) + spec §1.5.3 에 accept page `token` query param 명시(cross_spec WARNING).
4. i18n 키 추가(mismatch/logout/ready) + 테스트.

## 판정: BLOCK: NO (스코프 확장 대응)
