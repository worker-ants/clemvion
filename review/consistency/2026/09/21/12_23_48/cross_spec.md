# Cross-Spec 일관성 검토 — `spec/2-navigation` (impl-prep, `WorkspacesService.removeMember()` 동시 삭제 감사 중복 수정)

## 실측 메모 (판정 근거)

- `--impl-prep` 프롬프트 번들은 컨텍스트 예산 절단으로 `spec/2-navigation` 15개 파일과 다른 영역 spec
  대다수가 생략됐다. 절단으로 안 보이는 파일 중 이번 작업(`plan/in-progress/member-dup-remove.md`)이
  실제로 건드리는 `spec/2-navigation/9-user-profile.md`(§4 워크스페이스 관리·§6.1 API)는 프롬프트에
  없어서 워킹트리에서 직접 `Read` 로 전문을 열었다. `spec/data-flow/12-workspace.md`·
  `spec/5-system/1-auth.md`·`spec/5-system/2-api-convention.md`·`spec/data-flow/1-audit.md` 도 같은
  이유로 직접 열었다.
- 현재 diff 는 `plan/in-progress/member-dup-remove.md`(신규) +
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 갱신) 두 파일뿐이다
  (`git diff origin/main...HEAD --stat`). `codebase/**` 변경은 아직 없다 — 이 PR 은 구현 착수 **전**
  단계이고, 계획서 자체가 코드 변경 내용을 상세히 예고한다(무락 `findOne`→`memberRepository.remove()`를
  원자적 `delete({id, workspaceId})` + `affected===0` 판정으로 교체). 이 review 는 그 예고된 변경이
  `spec/2-navigation` 및 인접 영역과 충돌하는지를 본다.
- 같은 결함 클래스의 선행 5건(#1369 workflow/workspace·#1370 trigger·#1371 schedule·#1372
  integration)의 직전 `--impl-done` 검토(`review/consistency/2026/09/21/11_42_00`)를 대조군으로
  확인했다 — 매번 "spec 델타 0, RBAC·데이터모델·API shape 불변, 내부 판정 로직만 교체"로 처분됐고
  위험도는 NONE/LOW 였다. 이번 6번째 자리도 같은 형태다.

## 발견사항

### [WARNING] `2-api-convention.md §3` "DELETE = 멱등(O)" 표가 이제 여섯 번째 사례에서도 "패자는 404"와 충돌 — 이미 추적 중, 재확인

- target 위치: `spec/2-navigation/9-user-profile.md` §6.1 (`DELETE /api/workspaces/:id/members/:memberId` 행) · 계획서가 예고하는 `WorkspacesService.removeMember()` 변경
- 충돌 대상: `spec/5-system/2-api-convention.md` §3 HTTP 메서드 표 — `DELETE | 리소스 삭제 | O`(멱등)
- 상세: 이 변경이 실제로 적용되면 동시 DELETE 두 건 중 패자는 `204` 가 아니라 `404 RESOURCE_NOT_FOUND` 를 받게 된다(승자만 감사·응답 성공). `2-api-convention.md §3` 은 DELETE 를 무조건 멱등(O)으로만 적어, "같은 요청을 반복해도 항상 같은 응답"으로 오독될 여지를 남긴다. 이 사안은 이미 워크플로/워크스페이스(#1369)·트리거(#1370)·스케줄(#1371)·통합(#1372) 네 자리에서 같은 형태로 발생했고, 직전 세션(`review/consistency/2026/09/21/11_42_00/rationale_continuity.md` WARNING)이 처음 명시적으로 짚어 `plan/in-progress/spec-draft-nullable-notation-followups.md`(라인 4857~4862)에 planner 소유 항목("멱등성은 최종 상태 기준이며, 동시 요청 중 진 쪽은 404 를 받을 수 있다"는 각주 추가)으로 이미 등재돼 있다. `removeMember()` 는 이 패턴의 **여섯 번째** 사례가 되어 그 각주의 필요성을 다시 한 번 확증할 뿐, 새로운 충돌 형태를 만들지 않는다.
- 제안: 신규 조치 불요 — 이미 열려 있는 planner 항목이 실행될 때 `2-api-convention.md §3` 각주와 함께 처리된다. 다만 그 항목을 닫을 때 이번 여섯 번째 사례(`workspace_member` DELETE)도 근거 목록에 추가하면 좋다.

### [INFO] "동시 삭제 → 두 번째 404" 서술 부재 목록에 `9-user-profile.md §6.1` · `data-flow/12-workspace.md §1.6` 이 아직 없음

- target 위치: `spec/2-navigation/9-user-profile.md` §6.1 (`DELETE /api/workspaces/:id/members/:memberId` — "멤버 제거 (Admin+ / 자가 탈퇴 시 leave로 위임)"만 서술, 동시 삭제 언급 없음)
- 충돌 대상: `spec/2-navigation/2-trigger-list.md` §4.4 (유일하게 "동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`"를 명시) · `spec/data-flow/12-workspace.md` §1.6 (`DELETE /api/workspaces/:id/members/:memberId` 행 — "`DELETE workspace_member`. owner 는 제거 불가. 본인 제거는 자가 탈퇴로 위임"만 서술)
- 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md`(라인 4849~4862)의 기존 planner 항목은 이 침묵을 `1-workflow-list.md §2.6`·`data-flow/12-workspace.md §1.10`(워크스페이스 **삭제** 행)·`3-schedule.md §4`·`4-integration.md §9` 네 자리에 대해서만 추적한다. 이번 PR 이 `removeMember()` 를 동일 패턴으로 고치면 `9-user-profile.md §6.1` 의 멤버 제거 행과 `data-flow/12-workspace.md §1.6`(§1.10 과는 다른 행 — 워크스페이스 **삭제**가 아니라 **멤버** 삭제)도 같은 침묵 목록에 들어가야 하는데, 아직 등재돼 있지 않다. 모순이 아니라 **누락**이므로 CRITICAL/WARNING 요건(직접 모순)에는 해당하지 않는다.
- 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 항목(라인 4849)에 `9-user-profile.md §6.1`·`data-flow/12-workspace.md §1.6` 두 자리를 이번 트래커 갱신 시 함께 추가할 것을 권한다 — 위 WARNING 항목과 같은 planner 턴에서 처리 가능.

### [정보용 확인 — 결론 NONE] RBAC·데이터 모델·계층 책임은 계획된 변경과 정합

- target 위치: `spec/2-navigation/9-user-profile.md` §4.1(멤버 관리 권한표)·§4.2(역할 권한 매트릭스)
- 대조: `spec/data-flow/12-workspace.md` §1.6(역할 변경/소유권 이전 표)·§4(RBAC 요약) · `spec/5-system/1-auth.md` §3.2 정정(2026-07-28, "멤버 관리" Admin 열 CRU→CRUD)
- 상세: 계획서가 예고하는 변경은 `findOne`+`memberRepository.remove(member)` 를 원자적 `memberRepository.delete({id, workspaceId})` + `affected===0` 판정으로 바꾸는 **내부 구현 교체**일 뿐, 권한 가드(`assertAdmin`)·owner 보호(`CANNOT_REMOVE_OWNER`)·자가 탈퇴 위임(`leaveWorkspace`) 순서를 바꾸지 않는다. 이 RBAC 서술은 `9-user-profile.md`·`data-flow/12-workspace.md`·`5-system/1-auth.md` 세 곳에서 이미 상호 정합하게 기술돼 있고(§3.2 정정 이력이 그 정합성을 명시적으로 확인함), 이번 변경 예고와도 충돌하지 않는다.
- `workspace_member` 삭제는 트리거·스케줄과 달리 FK CASCADE 로 연쇄 삭제되는 자식 테이블이 없어(스케줄 축이 "판별자가 다르다"고 짚었던 문제), `affected` 판정을 단순 채택해도 `IntegrationsService.remove()`(#1372, 락 없음 → 동일 처방)와 같은 형태로 안전하게 닫힌다.
- 제안: 조치 불필요.

## 요약

이번 target(`spec/2-navigation`, `WorkspacesService.removeMember()` 동시 삭제 감사 중복 수정 예고)은
`codebase/` 변경이 아직 없는 순수 계획 단계이며, 계획이 예고하는 처방(원자적 `delete`+`affected===0`
판정)은 이미 다섯 차례(#1369~#1372) 검증된 동일 패턴의 여섯 번째 적용이다. 데이터 모델·API
shape·요구사항 ID·상태 머신·RBAC 중 어느 것도 새로 정의하거나 바꾸지 않으며, `9-user-profile.md`·
`data-flow/12-workspace.md`·`5-system/1-auth.md` 의 멤버 관리 RBAC 서술은 상호 정합해 계획과 충돌하지
않는다. 유일하게 의미 있는 지점은 이미 추적 중인 "DELETE 는 멱등(O)"(`2-api-convention.md §3`)과
"패자는 404"의 정합 서술 부재인데, 이는 이번 PR 이 새로 만드는 결함이 아니라 다섯 자리에서 반복
관찰돼 planner 백로그에 이미 등재된 낮은 우선순위 항목이며, 이번 PR 로 그 목록에 `9-user-profile.md
§6.1`·`data-flow/12-workspace.md §1.6` 두 자리가 추가로 편입돼야 한다는 점만 새로 확인했다. Cross-spec
관점에서 이 target 의 구현 착수를 막을 근거는 없다.

## 위험도

LOW
