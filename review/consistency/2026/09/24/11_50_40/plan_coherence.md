# Plan 정합성 검토 — spec/5-system (impl-done)

## 발견사항

검토 결과 CRITICAL/WARNING 급 불일치를 찾지 못했다. 구현(`workspaces.service.ts` 의
`removeMember()` 판정 순서 재배치)과 그 판단이 남긴 후속 항목 전부가
`plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 등재돼 있고,
target 문서(`spec/5-system`) 는 이번 diff 에서 0개 변경이라 그 자체로 새 결정을 내리지도
않았다. 아래는 확인 과정에서 검토한 근거와, 정합성이 유지됨을 뒷받침하는 실측이다(발견사항이
아니라 검증 기록).

- **[INFO]** `member-auth-order.md` 완료 시 `spec_impact: none` 표기가 유지될 근거를 명확히
  남길 것
  - target 위치: `spec/5-system/1-auth.md:551`(§3.2 정정 노트 — `removeMember()` 는
    `assertAdmin(workspaceId, requesterId)` 만 요구한다), `spec/5-system/3-error-handling.md:46`
    (`ADMIN_REQUIRED` 발행처를 `assertAdmin()` 단수로 명시), `:49`(`NOT_A_MEMBER` 발행 경로
    열거에 `removeMember` 미포함)
  - 관련 plan: `plan/in-progress/member-auth-order.md` §E "또 하지 않는 것" ·
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "`removeMember` 리팩터로
    낡은 spec 서술 세 줄" 항목(2026-09-24 등재, planner 소유)
  - 상세: 실측 확인 결과 위 3곳 모두 실제로 이번 코드 변경(요청자 role 을 `getMemberRole` 로
    직접 읽고 `throwNotAMember()`/`throwAdminRequired()` 로 판정 — `assertAdmin()` 직접 호출
    제거)으로 인해 stale 해졌다. `member-auth-order.md` 는 이를 인지하고 있고, `spec/` 은
    developer 쓰기 권한 밖이라 planner 소유 트래커 항목으로 정확히 위임했다(자기-반증형
    소정정 5조건 중 조건1 미충족을 명시적으로 확인 — `1-auth.md:551` 은 developer 가 쓴
    문장이 아니라 2026-07-28 §3.2 정정 노트). 이 처리 자체는 문제가 없다. 다만 이 plan 이
    `complete/` 로 이동할 때 frontmatter `spec_impact: none` 을 쓰게 될 텐데, 위 3줄의
    staleness 를 이 plan 자신이 유발했다는 사실과 얼핏 어긋나 보일 수 있다. 저장소에는 직접
    선례가 있다 — 현재 in-progress 인 `auth-guard-reflection-hardening.md` 도 `spec_impact:
    none` 을 유지한 채 "developer 권한 밖" 스펙 갱신 4건을 별도 planner 턴으로 위임했다(그
    문서 §"후속" 참고). 즉 "이 PR 이 유발한 spec staleness 를 planner 트래커 항목으로 위임한
    경우 closing plan 의 spec_impact 는 그대로 none" 이 이 저장소의 기존 관행과 일치한다.
  - 제안: CRITICAL/WARNING 아님 — 단순 참고. `complete/` 이동 커밋에서 `spec_impact: none`
    을 쓸 때, 위 선례(`auth-guard-reflection-hardening.md`)를 근거로 남기면 다음 리뷰어가
    같은 질문을 반복하지 않는다.

## 검증 기록 (참고 — 정합성이 유지됨을 확인한 근거)

- **13-라우트 축 분리 등재 확인**: `member-auth-order.md` §E 가 "이 PR 이 닫지 않는다" 며
  별 항목으로 가른다고 주장한 항목이 실제로
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 2026-09-24 자로 등재돼
  있음을 확인(`경로 파라미터로 워크스페이스를 받는 라우트 13개가 가드 층 보호를 전혀 못
  받는다`). 스코프 조건("구조적 해법을 먼저 검토")도 함께 등재돼, 2026-08-08
  `data-flow/12-workspace.md` §"멤버십 검증은 가드 1곳에서" 가 기각한 "라우트별 opt-in
  마커" 패턴의 재도입을 이 항목이 선언적으로 차단하고 있다.
  실측으로 라우트 수도 검증: `workspaces.controller.ts` 핸들러 17개 중 `@WorkspaceId()` 0건·
  `@Roles()` 1건(`transferOwnership`)뿐이라, 나머지 13개(`update`·`updateSettings`·
  `getSettings`·`remove`·`leave`·`listMembers`·`addMember`·`updateMember`·`removeMember`·
  `listInvitations`·`createInvitation`·`resendInvitation`·`revokeInvitation`)가 가드
  층에서 `handlerConsumesWorkspaceId=false` 로 단축 통과되는 population 이라는 주장과 일치.
  완료된 `plan/complete/auth-workspace-membership-guard.md` 의 모집단(73건, `@WorkspaceId()`
  소비 + `@Roles()` 부재)과 구성상 겹치지 않는다는 주장도 그 문서 실측(`69-73`행)과 일치한다.
- **판정-순서 커버리지 비대칭 항목 확인**: `/ai-review` 2라운드 INFO#5·#6 이 남긴 두 칸
  (대상 부재 vs admin 판정 순서, 요청자 role 단일-조회 회귀 테스트 부재)이 같은 트래커에
  낮은 우선순위로 등재돼 있음을 확인 — 수렴 예외 (a)~(d) 근거도 함께 기록됨.
  이 플랜의 빈 conflict 없음.
- **다른 in-progress plan 과의 충돌 없음**: `plan/in-progress/` 전체에서 `removeMember`·
  `CANNOT_REMOVE_OWNER` 를 언급하는 문서는 `member-auth-order.md` 와
  `spec-draft-nullable-notation-followups.md` 두 개뿐이며, `spec-sync-auth-gaps.md`
  (`1-auth.md` frontmatter `pending_plans`, §1.3 LDAP/SAML 미구현 추적)나
  `auth-guard-reflection-hardening.md`(reflection fail-open·메모이제이션·헤더 400 축)는
  이 변경과 겹치는 코드 표면·결정 축이 없음을 확인(각각 grep 0건, 별도 주제).
- **코드 diff 와 plan 서술 일치 확인**: `git diff origin/main...HEAD --
  codebase/backend/src/modules/workspaces/workspaces.service.ts` 를 직접 읽어
  plan §B 가 서술한 처방(요청자 role 1회 조회 → 비-멤버 `NOT_A_MEMBER` → self 위임 →
  admin 판정(owner 판정보다 앞) → `CANNOT_REMOVE_OWNER`, `throwNotAMember()`/
  `throwAdminRequired()` 추출)과 정확히 일치함을 확인.
- **CHANGELOG 정합성**: 이전 PR 이 남긴 "남는 것: 권한 검사 순서 오라클은 여전히 열려
  있다" 문장이 취소선 처리되고 "2026-09-24 해소 — 맨 위 항목이 그것이다" 로 정정됐음을
  확인 — "곧 참이 될 것을 지금 참으로 쓰는" 패턴 재발 없음.

## 요약

target(`spec/5-system`)은 이번 브랜치에서 변경되지 않았고(diff 0), 실제 코드 변경은
`WorkspacesService.removeMember()` 의 인가 판정 순서 재배치다. 이 변경이 남기는 spec
staleness(3줄)와 구조적 후속 결정(13-라우트 가드 커버리지 축)은 모두
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 적절한 소유자(planner/
developer)·스코프 조건과 함께 실제로 등재돼 있음을 실측으로 확인했다. 2026-08-08 에 기각된
"라우트별 opt-in 마커" 결정과 충돌하지 않도록 새 항목에 "구조적 해법 우선 검토" 조건을 명시적으로
박아 둔 것도 확인했다. 다른 in-progress plan 과의 결정 충돌·선행 조건 미해소는 발견되지 않았다.
유일한 참고 사항은 완료 시점 `spec_impact: none` 표기가 이 저장소의 기존 선례
(`auth-guard-reflection-hardening.md`)와 일치하는 관행이라는 점을 재확인해 둔 것뿐이며, 이는
INFO 수준의 기록 권고이지 차단 사유가 아니다.

## 위험도

NONE
