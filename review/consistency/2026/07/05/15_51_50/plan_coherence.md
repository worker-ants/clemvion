# Plan 정합성 검토 — spec/2-navigation/ (impl-done)

## 검토 대상
- Target: `spec/2-navigation/{0-dashboard,1-workflow-list,10-auth-flow,11-error-empty-states,13-user-guide,14-execution-history,15-system-status,16-agent-memory}.md`
- diff-base: `origin/main`, 검토 시점 HEAD 워크트리(`invite-accept-confirm-ui-c51e95`)
- 실제 코드 diff 범위(`git diff origin/main --stat`)는 `spec/2-navigation/10-auth-flow.md`(+2)·`spec/5-system/1-auth.md`(+5)·`plan/in-progress/spec-code-cross-audit-2026-06-10.md`(+2/-1) + review 산출물뿐 — 이번 PR 은 사실상 V-09(초대 수락 확인 UI) 단일 변경.

## 발견사항

이번 검토에서 CRITICAL/WARNING 급 불일치는 발견되지 않았다. 근거는 다음과 같다.

- **[INFO] V-09 구현이 미해결 plan 항목과 정확히 일치 — 결정 우회 없음, 이미 이전 impl-prep 검토(14_54_13)에서 확인된 방향**
  - target 위치: `spec/2-navigation/10-auth-flow.md` §2.6 (초대 토큰을 통한 가입 — "이미 로그인한 사용자의 진입 분기" 콜아웃)
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` — L35 `[x] V-09 (초대 수락 페이지 자동수락, major)` (본 PR 브랜치 `invite-accept-confirm-ui` 로 명시), L61-67 "결정 옵션" 절의 "코드 구현" 권장안
  - 상세: plan 은 V-09 에 대해 (1) §1.5.3 대로 코드 구현 vs (2) spec 하향(자동수락을 의도된 진화로 인정) 두 옵션을 제시하고 "코드 구현" 을 명시적으로 권장했다. target(`10-auth-flow.md §2.6`) 은 정확히 그 권장 방향 — 이미 로그인한 사용자가 초대 링크를 클릭하면 `/invitations/accept?token=` 로 리다이렉트되어 이메일 일치 시 [수락] 버튼, 불일치 시 안내+로그아웃을 노출하는 흐름을 서술한다. `spec/5-system/1-auth.md §1.5.3`(target 범위 밖이나 diff 에 포함, SoT)도 동일 흐름을 규정하며 코드(`accept-invitation-content.tsx` 계열)와 정합됨을 이전 impl-prep 단계 plan_coherence(14_54_13) 가 이미 확인했다. 미해결 결정을 일방적으로 뒤집거나 우회하는 사례가 아니라, plan 이 이미 승인한 방향을 그대로 실행 완료한 것이다.
  - 제안: 없음 (이미 반영됨) — plan L35 가 이번 PR 에서 `[x]` + 브랜치/구현 요약으로 갱신된 것을 확인(diff 에 `spec-code-cross-audit-2026-06-10.md` +2/-1 포함). plan lifecycle 관례(체크박스=실제 상태) 충족.

- **[INFO] 이전 검토(14_54_13)가 지적한 WARNING(frontmatter code: 프론트엔드 경로 누락)이 이번 구현에서 해소됨**
  - target 위치: `spec/5-system/1-auth.md` frontmatter `code:` (target 범위 밖이나 diff 에 포함)
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` L61 "frontmatter `code:` 매핑도 부재" 요구사항
  - 상세: 현재 `1-auth.md` frontmatter 에 `codebase/frontend/src/app/(main)/invitations/accept/**` · `codebase/frontend/src/components/auth/register-form.tsx` · `codebase/frontend/src/lib/api/invitations.ts` 가 추가되어 있음을 확인. `10-auth-flow.md` frontmatter 에도 `codebase/frontend/src/lib/api/invitations.ts` 가 포함됨. plan 이 요구한 매핑 공백이 정확히 메워졌다.
  - 제안: 없음 (이미 반영됨).

- **[INFO] `spec/2-navigation/9-user-profile.md` — target 범위 밖, 모순 없음 확인**
  - target 위치: 없음 (target 목록에 `9-user-profile.md` 불포함, diff 에도 불포함)
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` L65 spec-하향 옵션(기각됨)이 언급했던 `9-user-profile.md §4.1.1`
  - 상세: 채택된 옵션이 "코드 구현"(spec 하향 아님)이므로 `9-user-profile.md` 갱신은애초에 불필요. 실제로 `9-user-profile.md:216` 의 "가입 성공 트랜잭션 내에서 자동 accept" 서술은 *신규 가입자의 register-time 자동 accept*(§1.5.2 흐름, 서버 트랜잭션 내부 동작)를 가리키는 것으로, 본 PR 이 변경한 *이미 로그인한 사용자의 accept 페이지 확인 버튼 흐름*(§1.5.3)과는 별개 경로라 모순되지 않는다.
  - 제안: 없음 — 정보성 확인.

- **[INFO] `spec-sync-data-flow-8-notifications-gaps.md` 의 `team_invite` 알림 미구현은 본 PR 과 독립**
  - target 위치: 없음
  - 관련 plan: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` L21 `team_invite` 알림 발사 미구현
  - 상세: 초대 발송측(inviter) 알림 적재 갭으로, 본 PR 의 범위(수락측 UI 확인 흐름)와 무관한 독립 갭. 이번 diff 가 이 항목을 무효화하거나 새로운 후속 항목을 만들지 않는다.
  - 제안: 없음.

- **[INFO] `spec-sync-workflow-list-gaps.md` (target `1-workflow-list.md` 의 pending_plans) — 본 PR 과 무관, 정합 유지**
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans`
  - 관련 plan: `plan/in-progress/spec-sync-workflow-list-gaps.md` (태그/폴더 필터 UI·빈 상태 마켓플레이스 링크 잔여)
  - 상세: 이번 PR 은 `1-workflow-list.md` 를 변경하지 않았고(diff 미포함), pending_plans 참조도 그대로 유지된다. 잔여 미구현 항목과 충돌 없음.
  - 제안: 없음.

- **[INFO] `spec-sync-auth-gaps.md` (LDAP/SAML) — 본 PR 과 무관**
  - target 위치: 없음
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` (`spec/5-system/1-auth.md` pending_plans — LDAP/SAML 미구현 추적)
  - 상세: 본 PR 이 다룬 §1.5.3 초대 수락 흐름과는 완전히 다른 섹션(§1.3 SSO)의 갭이라 교차점 없음.
  - 제안: 없음.

## 요약
본 PR(`invite-accept-confirm-ui`)은 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 가 이미 명시적으로 권장한 V-09 "코드 구현" 옵션을 그대로 실행한 것으로, plan 이 남겨둔 미해결 결정을 우회하거나 다른 방향으로 일방 결정한 사례가 없다. 오히려 이전 impl-prep 단계 plan_coherence 검토(14_54_13)가 지적했던 WARNING(frontend frontmatter code: 매핑 공백)을 이번 구현이 정확히 메웠고, plan 문서 자체의 V-09 체크박스도 `[x]` + 브랜치/PR 근거로 갱신되어 plan lifecycle 관례(체크박스=실제 상태)를 충족한다. `9-user-profile.md`·`team_invite` 알림·워크플로 목록 필터 UI 등 인접 갭들은 모두 본 PR 범위와 독립적이며 무효화·신규 후속 항목 발생도 없다.

## 위험도
NONE
