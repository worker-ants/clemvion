# Plan 정합성 검토 — spec/5-system/ (impl-prep)

## 검토 대상
- Target: `spec/5-system/1-auth.md`(§1.5 초대 토큰 흐름 포함, 전체), `spec/5-system/10-graph-rag.md`(전체)
- 검토 시점 기준 worktree(`invite-accept-confirm-ui-c51e95`)는 `origin/main` 대비 무변경(clean) — 아직 구현 착수 전.

## 발견사항

- **[INFO] V-09 (초대 수락 자동수락 갭)가 본 task 의 근거 plan — 방향 이미 확정, 충돌 없음**
  - target 위치: `spec/5-system/1-auth.md` §1.5.3 (흐름 — 이미 가입한 사용자가 다른 워크스페이스에 초대된 경우)
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` L60-66 `V-09 [major] 초대 수락 페이지 자동수락` — L35 `잔여: V-05·V-09·V-10·...` (미해결로 표시)
  - 상세: V-09 는 `accept-invitation-content.tsx` 가 마운트 즉시 `acceptInvitation` 을 자동 호출해 §1.5.3 이 규정하는 "[수락] 버튼 → 이메일 불일치 시 계정전환 안내 + 로그아웃" UI 계약과 어긋난다고 지적한다. 옵션은 (1) 코드 구현(§1.5.3 그대로) vs (2) spec 하향(자동수락을 의도된 진화로 인정) 이며, plan 은 **코드 구현을 명시적으로 권장**("서버측 email 일치 강제는 있으나 프론트 흐름 계약과 모순"). target 문서(§1.5.3, §1.5.4 에러 코드 표)는 이 권장안과 동일한 명시적 확인 버튼 + 불일치 안내 흐름을 그대로 유지하고 있어 — 즉 본 worktree(`invite-accept-confirm-ui`) 는 V-09 의 "코드 구현" 옵션을 실행하려는 것으로 보이며, target 이 그 미해결 결정을 일방적으로 뒤집거나 우회하고 있지 않다. 결정 자체는 이미 plan 안에서 방향이 정해져 있고(스펙 하향 대안은 기각 성격), 남은 것은 실행뿐이다.
  - 제안: 구현 완료 후 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` L35 의 `V-09` 를 완료 처리(다른 완료 항목과 동일한 형식, 브랜치/PR 참조 포함)하고 L60-66 절 갱신 필요. plan lifecycle 관례상 developer 완료 후 plan 체크박스 갱신 의무.

- **[WARNING] frontmatter `code:` 누락 — V-09 가 이미 지적한 매핑 공백, 본 작업과 함께 해소 필요**
  - target 위치: `spec/5-system/1-auth.md` frontmatter `code:` 목록 (L28-34) — backend 경로만 나열, frontend 경로 전무
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` L61 "frontmatter `code:` 매핑도 부재"
  - 상세: 실제로 `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` 와 `codebase/frontend/src/lib/api/invitations.ts` 등 초대 수락 프론트 파일이 존재하지만 `1-auth.md` frontmatter 는 backend 전용 경로만 담고 있다(초대 흐름 §1.5 는 본 문서가 SoT 인데도). V-09 가 이미 이 갭을 명시했으므로, 본 task 구현 시 frontmatter 를 갱신하지 않으면 동일 지적이 다시 반복(spec-coverage audit 재발)될 것이다.
  - 제안: 구현 커밋에 `1-auth.md` frontmatter `code:` 에 `codebase/frontend/src/app/(main)/invitations/**`, `codebase/frontend/src/lib/api/invitations.ts` 를 추가.

- **[INFO] `9-user-profile.md §4.1.1` 은 target 범위 밖 — 미러 문서 동기 확인만 권장**
  - target 위치: 없음 (target 은 `1-auth.md`·`10-graph-rag.md` 만 포함)
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` L64 spec-하향 옵션이 언급한 `9-user-profile.md §4.1.1`
  - 상세: `9-user-profile.md` §4.1.1 은 초대 정책 요약이며 상세는 "`1-auth.md §1.5` 참고" 로 위임하는 포인터 문서다(`9-user-profile.md:220`). 본 구현이 §1.5.3 그대로(자동수락 → 명시 확인 버튼)를 구현하는 방향이라면 `9-user-profile.md` 본문 자체는 변경이 불필요할 가능성이 높다(포인터라 세부 UI 서술이 없음). 다만 라인 181-182 의 목업(`│ 대기 중인 초대: ... [취소] │`)이 수락 페이지가 아닌 발송측 UI 라 무관함을 재확인 요망.
  - 제안: 구현 완료 후 `9-user-profile.md §4.1.1` 근처에 자동수락→확인 버튼 UX 변경과 모순되는 서술이 없는지 1회 점검(가벼운 확인, target 변경 아님).

- **[INFO] `spec-sync-data-flow-8-notifications-gaps.md` 의 `team_invite` 알림 미구현은 본 작업과 독립**
  - target 위치: 없음 (별도 spec 영역)
  - 관련 plan: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` L21 `type team_invite 발사 — WorkspaceInvitationsService 에서 notification row 적재 미구현`
  - 상세: 초대 발송 시 `notification` row 적재(`team_invite` 타입)가 별도 미구현 갭으로 추적 중이나, 이는 발송측(inviter 알림) 이슈이고 본 task(수락 페이지 UI 확인 흐름)와는 무관한 독립 갭이다. 구현 범위를 수락 플로우로 한정한다면 이 항목을 함께 처리할 필요는 없다.
  - 제안: 범위 확인 차원의 기록. 혼동 방지를 위해 PR 설명에 "team_invite 알림 적재는 별도 plan(`spec-sync-data-flow-8-notifications-gaps.md`) 소관, 본 PR 범위 아님" 명시 권장.

- **[INFO] `spec/5-system/10-graph-rag.md` 는 본 task 와 무관 — 대상 포함 사유만 확인**
  - target 위치: `spec/5-system/10-graph-rag.md` 전체
  - 관련 plan: 없음 (in-progress plan 어디에도 graph-rag 관련 미해결 결정·초대 흐름과의 교차점 없음)
  - 상세: `10-graph-rag.md` 는 `status: implemented` 이며 미결 항목(§8)도 초대/인증과 무관한 community detection·predicate enum 화 등만 남아 있다. `spec/5-system/` 디렉터리 스코프로 함께 번들된 것으로 보이나 plan 정합성 관점에서 언급할 충돌·누락이 없다.
  - 제안: 없음 — 정보성 확인.

## 요약
본 worktree(`invite-accept-confirm-ui`)가 착수하려는 작업은 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 미해결 V-09 항목("코드 구현" 권장, spec 하향 아님)과 정확히 일치하는 방향이며, target spec(`1-auth.md` §1.5.3)은 이미 그 권장 흐름(명시 확인 버튼 + 이메일 불일치 안내)을 서술하고 있어 미해결 결정을 일방적으로 우회하는 충돌은 없다. 다만 V-09 자체가 지적한 frontmatter `code:` 매핑 공백(frontend 경로 누락)을 이번 구현에서 함께 메우지 않으면 동일 갭이 재발할 것이므로 WARNING 으로 별도 표기했다. `9-user-profile.md` 포인터 문서·`team_invite` 알림 미구현 갭은 참고용 INFO 로, 실질적인 후속 항목 무효화나 선행 조건 미해소는 발견되지 않았다. `10-graph-rag.md` 는 이번 검토 범위에서 실질 연관성이 없다.

## 위험도
LOW
