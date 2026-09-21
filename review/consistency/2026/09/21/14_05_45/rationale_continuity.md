# Rationale 연속성 검토 — spec/2-navigation (--impl-done, member-dup-remove)

## 사전 확인 (범위 불일치)

이 검토가 실제로 다루는 코드 변경(`origin/main` 대비)은 `codebase/backend/src/modules/workspaces/workspaces.service.ts`
(`removeMember()` 동시 삭제 시 감사 로그 중복 수정 + `MEMBER_NOT_FOUND` 중복 제거)와 그 테스트뿐이며,
`spec/2-navigation/**` 파일 델타는 0개다(정상 — 코드 전용 PR). 이 코드의 실제 spec 소유 문서는
`spec/2-navigation` 이 아니라 `spec/data-flow/12-workspace.md` §1.6·`spec/5-system/1-auth.md` §3.2·
`spec/5-system/2-api-convention.md` §3 이다. 프롬프트 번들은 이 세 파일을 전부 "컨텍스트 예산 초과"로
생략했으므로, 아래는 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/member-dup-remove-2d4f8b`)의
해당 파일을 절대경로로 직접 Read 하여 보완한 결과다.

## 발견사항

### [WARNING] `DELETE = 멱등 O` 표와의 정면 충돌 — 6번째 사례로 확정, 이미 열린 tracker 항목의 재확인

- target 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:795-838` (`removeMember()`,
  원자적 `delete({id, workspaceId})` + `affected === 0` → `MEMBER_NOT_FOUND`).
- 과거 결정 출처: `spec/5-system/2-api-convention.md` §3 (`:111`) `DELETE | 리소스 삭제 | O`(멱등 O, 각주 없음).
  이 충돌은 developer 자신이 동일 세션의 `--impl-prep` 단계에서 이미 지적했다
  (`review/consistency/2026/09/21/12_23_48/rationale_continuity.md` WARNING 1) 및
  `plan/in-progress/spec-draft-nullable-notation-followups.md:4926-4935`.
- 상세: 이번 PR로 workflow·workspace(삭제)·trigger·schedule·integration·**member**(6번째) 여섯 경로
  전부가 "동시 삭제의 진 쪽 요청은 404를 받는다"로 동작하지만, §3 표는 무조건 멱등 O라고만 적어
  각주가 없다. 이번 PR은 **새 위반을 만드는 것이 아니라 기존에 식별된 미해결 충돌의 인스턴스 수를
  5→6으로 늘린다.**
- 확인: tracker 는 이미 이 인스턴스 증가를 반영했다 — `spec-draft-nullable-notation-followups.md:4931-4935`
  가 "다섯 경로라고 적지 말 것 — 아홉 자리(6완료+3대기)"로 갱신돼 있어, 이 finding 은 **차단 사유가
  아니라 기존 처분(각주 신설, planner 소관, spec_impact 는 developer 권한 밖)의 재확인**이다.
- 제안: 추가 조치 불요. planner 가 §3 표에 "멱등성은 최종 상태 기준이며, 동시 요청 중 진 쪽은 404를
  받을 수 있다" 각주를 넣을 때(tracker `:4926-4935` 항목) 인스턴스 수 대신 계약 문장만 적으라는
  기존 방침을 그대로 따르면 된다.

### [INFO] owner 보호 invariant 의 TOCTOU 창 — 측정된 유예이나 spec 자체엔 반영되지 않음

- target 위치: `workspaces.service.ts:795-838` (`removeMember()`) — `member.role === 'owner'` 가드와
  `assertAdmin` 검사가 **무락 `findOne`(:803) 위에서** 수행되고, 그 뒤 `delete()`(:834)까지 사이에
  잠금이 없다.
- 과거 결정 출처: `spec/data-flow/12-workspace.md:141` (`DELETE .../members/:memberId | owner / admin |
  ... owner 는 제거 불가`) 와 `spec/5-system/1-auth.md:377-381`(§3.2 † 각주, "Admin 의 멤버 삭제는
  대상이 Owner 인 경우 거부된다")는 이 invariant 를 **레이스 조건 언급 없이 무조건**으로 서술한다.
  대조적으로 같은 파일 `spec/data-flow/12-workspace.md:189`(`leaveWorkspace`)와 `:188`(`deleteWorkspace`)
  는 정확히 이런 종류의 role-sensitive 판정을 **비관적 락(`pessimistic_write`) 트랜잭션 안**에서 하도록
  이미 확립한 패턴이다.
- 상세: `plan/in-progress/member-dup-remove.md` §C.2 및 `plan/in-progress/spec-draft-nullable-notation-followups.md:4850-4882`
  가 이 TOCTOU 를 재진입 기법으로 **실제 재현**했다(`status=200, rows_remaining=0` — owner가 지워짐).
  developer 는 이것을 "이번 PR과 계약이 다른 별개 결함"으로 **의도적으로 유예**했고, 재현 레시피·후보
  처방(`role: Not('owner')` + 0-행 시 재조회로 원인 분기)까지 tracker 에 등재했다 — 이는 근거 없는
  번복이 아니라 **측정된 유예**(reproduced, documented, tracked)로 프로젝트 관례에 부합한다.
- 다만 `spec/data-flow/12-workspace.md:141`과 `spec/5-system/1-auth.md:377-381` 자체는 이 알려진 갭에
  대해 여전히 아무 각주도 갖지 않는다 — `leaveWorkspace`/`deleteWorkspace` 옆에는 각각 락 방식이
  명시돼 있는 것과 비대칭이다. 이 diff 가 새로 만든 결함이 아니라 기존 코드에 이미 있던 갭이므로
  이번 PR을 막을 사안은 아니다.
- 제안: 후보 처방(다음 PR)이 착지할 때, `data-flow/12-workspace.md:141` 곁에 "동시 `transferOwnership`
  경합 시 owner 도 제거될 수 있었던 기간이 있었다/처방됐다" 를 트리거 삭제 §4.3의 "남는 창" 서술과
  같은 패턴으로 남기면, invariant 서술과 실제 보장 사이의 간극이 spec 층위에서도 추적 가능해진다.
  지금 당장은 `plan/in-progress/spec-draft-nullable-notation-followups.md:4850-4882` 등재로 충분하다.

### [INFO] 기각된 대안(advisory lock)의 재도입 없음 — 확인만

- target 위치: `workspaces.service.ts:786-838` 주석 — "형제 다섯과 달리 이 경로엔 잠글 것이 없으므로
  ... 락을 새로 들이지 않고 단일 원자적 DELETE 로 가른다."
- 과거 결정 출처: `plan/in-progress/spec-draft-nullable-notation-followups.md:4801-4805`(integration 삭제,
  #1372)가 동일 논리로 이미 "advisory lock 도 행 락도 없다 → 원자적 delete 의 affected" 를 채택한 선례.
- 상세: 이번 PR은 이 선례를 그대로 재사용하며, `4-integration.md` Rationale(`:1494`)이 별도 문맥
  (rotate 동시성)에서 advisory lock 의 비용을 이미 논한 것과도 배치되지 않는다. 기각된 대안의 이유
  명시 없는 재도입은 발견되지 않았다.
- 제안: 없음(정보성 확인).

## 요약

이번 `--impl-done` 검토가 실제로 다루는 유일한 코드 변경(`WorkspacesService.removeMember()` 의 감사
로그 중복 제거 + `throwMemberNotFound()` 헬퍼 추출)은 동일 세션 안에서 이미 5회 반복 적용된
"락 없음 → 원자적 DELETE 의 `affected` 판정" 패턴(workflow/trigger/schedule/integration, #1369~#1372)을
그대로 따르며, 과거 Rationale 이 명시적으로 기각한 대안(advisory lock 등)을 이유 없이 재도입하지
않는다. `--impl-prep` 단계(`review/consistency/2026/09/21/12_23_48`)에서 이미 식별된 두 논점 —
(1) `spec/5-system/2-api-convention.md §3` "DELETE=멱등 O" 표와 실제 "동시 요청 진 쪽=404" 동작의
정면 충돌이 이번 PR로 6번째 인스턴스를 얻는 것, (2) `removeMember()` owner 보호 가드의 TOCTOU 창이
`data-flow/12-workspace.md`·`5-system/1-auth.md` 의 무조건적 invariant 서술과 어긋나는 것 — 둘 다
이번 세 라운드의 코드 리뷰·plan 갱신 과정에서 재현·측정·tracker 등재까지 마쳤고 새로운 코드 변경 없이
문서로만 수렴했다. 두 논점 모두 이번 diff 가 새로 만든 위반이 아니라 기존에 알려진 갭의 재확인이며,
`spec_impact: none` 선언과 정합한다. 새로 발견된 Critical 급 Rationale 위반은 없다.

## 위험도

LOW
