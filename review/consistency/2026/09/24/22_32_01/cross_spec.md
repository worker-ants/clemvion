# Cross-Spec 일관성 검토 — `spec/2-navigation/`(impl-done)

## 검토 대상 요약

- scope(`spec/2-navigation/`) 델타: **0개 파일** — 이 브랜치는 spec 을 변경하지 않았다.
- 구현 diff: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 1개 파일, 58줄 — 기존 `removeMember()` 서비스 메서드(프로덕션 코드 변경 없음)의 두 판정 지점(① 대상 미존재 vs admin 판정 순서, ② 요청자 role 조회 1회)에 대한 **유닛 테스트 추가뿐**이다.
- HEAD 워킹트리(`codebase/backend/src/modules/workspaces/workspaces.service.ts:814-854`)를 절대경로로 직접 확인한 결과, 테스트가 검증하는 판정 순서(멤버십 → 대상 조회 → self-위임 → admin → owner)는 **이번 diff 이전부터 이미 코드에 존재하던 동작**이며, 그 순서를 설명하는 상세 주석(819-850행)도 기존 코드에 이미 있었다. 이번 변경은 그 기존 동작을 회귀로부터 고정하는 캐릭터라이제이션 테스트다.

## 발견사항

없음. 아래 이유로 CRITICAL/WARNING/INFO 등급의 cross-spec 충돌 후보를 찾지 못했다.

1. **데이터 모델 충돌** — 대상 없음. 이번 diff 는 엔티티·필드를 정의/변경하지 않는다.
2. **API 계약 충돌** — 대상 없음. `DELETE /api/workspaces/:id/members/:memberId` 의 계약(`spec/2-navigation/9-user-profile.md` §6.1, "멤버 제거 (Admin+ / 자가 탈퇴 시 leave로 위임)")은 변경되지 않았고, 테스트도 프로덕션 응답 바디·상태 코드 정의를 바꾸지 않는다. 테스트가 확인하는 것은 두 에러 코드(`MEMBER_NOT_FOUND` vs `ADMIN_REQUIRED`) 중 어느 쪽이 선행하느냐인데, spec §4.1/§4.2/§6.1 어디에도 이 두 에러의 선후 관계를 규정한 문장이 없어 모순 자체가 성립하지 않는다.
3. **요구사항 ID 충돌** — 대상 없음. 신규 요구사항 ID 부여 없음.
4. **상태 전이 충돌** — 대상 없음. 멤버 상태 머신(초대→수락, active→removed 등)에 대한 변경 없음.
5. **권한·RBAC 모델 충돌** — 검토했으나 충돌 없음. `spec/2-navigation/9-user-profile.md` §4.2 역할 권한 매트릭스는 "멤버 관리: Owner✅/Admin✅/Editor❌/Viewer❌" 로 최종 결과만 규정한다. 테스트가 추가한 케이스(비-admin 이 존재하지 않는 대상을 지목하면 403 대신 400 `MEMBER_NOT_FOUND`)는 **최종 결과**(비-admin 은 멤버를 제거하지 못한다)를 바꾸지 않고, 다만 실패 사유의 HTTP 코드/에러 바디가 달라질 뿐이다 — RBAC 매트릭스가 보장하는 것과 모순되지 않는다. diff 의 테스트 주석 자체도 "이것은 보안 불변이 아니라 문서화된 순서다 — 403 을 줘도 새는 것이 없다(`listMembers` 가 이미 모든 `memberId` 를 멤버에게 노출)" 라고 명시해, RBAC 경계 유지와 정보 노출 범위를 스스로 근거를 대며 구분하고 있다.
6. **계층 책임 충돌** — 대상 없음. 서비스 계층(`WorkspacesService`) 내부의 검증 순서 문제로, FE/BE 계층 분리나 도메인 모듈 책임 분할에 관한 기존 결정(예: `data-flow/12-workspace.md` "멤버십 검증은 가드 1곳에서")과 충돌하지 않는다. 오히려 diff 의 테스트 헤더 주석은 형제 메서드(`updateMemberRole`)와의 판정 순서 비대칭을 명시적으로 문서화하고, 그 비대칭을 없애려면 "머리 주석과 이 테스트 블록을 함께 바꾸라"고 후속 변경 지점까지 지정해 두어 오히려 cross-consistency 를 강화하는 방향이다.

## 요약

이번 변경은 `spec/2-navigation/` 를 전혀 건드리지 않았고, 구현 diff 도 프로덕션 코드가 아닌 `workspaces.service.spec.ts` 에 국한된 순수 테스트 추가(기존 `removeMember()` 판정 순서에 대한 캐릭터라이제이션 테스트 2건)다. 대상 코드의 판정 순서·RBAC 결과·API 계약은 diff 이전과 이후가 동일하며, `spec/2-navigation/9-user-profile.md` 의 멤버 관리 API·역할 매트릭스·초대 정책 어디와도 직접 모순되지 않는다. 테스트가 스스로 "보안 불변이 아니라 문서화된 순서" 라고 명시하며 근거(`listMembers` 가 이미 memberId 전체를 노출)까지 제시하고 있어, cross-spec 관점에서 추가 조치가 필요한 항목은 없다.

## 위험도
NONE
