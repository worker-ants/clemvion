# Cross-Spec 일관성 검토 — `spec/2-navigation` (impl-done, `WorkspacesService.removeMember()` 동시 삭제 감사 중복 수정)

## 실측 메모 (판정 근거)

- 이 검토가 실제로 다루는 코드 diff(`origin/main...HEAD`)는 `codebase/backend/src/modules/workspaces/workspaces.service.ts`(+62/-16) ·
  `workspaces.service.spec.ts`(+163) · `codebase/backend/test/member-remove-concurrency.e2e-spec.ts`(신규, +208) 세 파일이다
  (워킹트리에서 `git diff origin/main...HEAD --stat` / `-- <path>` 직접 확인). `spec/2-navigation` 자체의 델타는 0개 —
  이 PR 은 `spec_impact: none` 으로 등재된 순수 코드 PR 이다(`plan/in-progress/member-dup-remove.md` frontmatter).
- 프롬프트 번들은 예산 절단으로 diff 본문과 `spec/2-navigation/9-user-profile.md`(실제로 관련된 파일)를 포함하지 못했다.
  워킹트리에서 절대경로로 직접 `Read`/`grep` 하여 보완했다: `spec/2-navigation/9-user-profile.md` §4.1/§6.1,
  `spec/data-flow/12-workspace.md` §1.6/§4/Audit 도메인 표, `spec/data-flow/1-audit.md`, `spec/2-navigation/2-trigger-list.md` §4.4,
  그리고 형제 축(`triggers.service.ts`/`schedules.service.ts`/`integrations.service.ts`)의 `throwXNotFound()` 패턴.
- 이 결함 클래스(#1369~#1372, 워크플로/워크스페이스·트리거·스케줄·통합)의 6번째 적용이며, 직전 `--impl-prep` 검토
  (`review/consistency/2026/09/21/12_23_48/cross_spec.md`)가 이미 이 예고된 변경을 상세 심사해 LOW 로 처분했다. 이번 라운드는
  실제 착지한 코드가 그 예고와 일치하는지, 그리고 코드화 과정에서 새 충돌이 생기지 않았는지를 확인한다.

## 발견사항

### [정보용 확인 — 결론 NONE] 실제 코드가 impl-prep 예고와 정확히 일치, 새 충돌 없음

- target 위치: `workspaces.service.ts:783-847` `removeMember()`, 신규 `private throwMemberNotFound()` (`:342`)
- 대조: `plan/in-progress/member-dup-remove.md` §B 가 예고한 처방(원자적 `delete({id, workspaceId})` + `affected === 0`
  명시 비교로 `MEMBER_NOT_FOUND` 던지기), `spec/data-flow/1-audit.md:75`(`member.removed`, `details.mode='removed'|'left'`)
- 상세: 실제 diff 는 예고와 1:1 일치한다 — `assertAdmin` 위치·owner 가드·self-위임(`leaveWorkspace`) 순서는 그대로이고,
  `memberRepository.remove(member)` 만 `memberRepository.delete({id, workspaceId})` + `affected===0` 판정으로 교체됐다.
  에러 코드(`MEMBER_NOT_FOUND`, 메시지 동일)·감사 액션(`MEMBER_REMOVED`, `mode='removed'`)·응답 shape(컨트롤러
  `{ data: { ok: true } }`, 200)는 diff 전후 불변이므로 API 계약·RBAC·데이터 모델·상태 전이 어느 축에도 새 정의가 없다.
  신설 헬퍼 `throwMemberNotFound()` 는 형제 `throwTriggerNotFound()`/`throwScheduleNotFound()`/`throwIntegrationNotFound()`
  와 이름·형태(`private ...(): never`)가 일치해 계층 책임(서비스가 자기 도메인 NOT_FOUND 를 스스로 던진다) 관례도 유지한다.
- 제안: 조치 불필요.

### [WARNING — 이미 추적 중, 신규 아님] `data-flow/12-workspace.md:141` "owner 는 제거 불가" 가 TOCTOU 로 깨짐 — 이 PR 은 고치지 않음

- target 위치: `spec/2-navigation/9-user-profile.md` §4.1(제거 행, owner 예외 미서술) · 관련 코드 `workspaces.service.ts:797`(owner 가드) + `:832`(신규 원자적 DELETE)
- 충돌 대상: `spec/data-flow/12-workspace.md:141` — `DELETE /api/workspaces/:id/members/:memberId … owner 는 제거 불가.`(무조건 서술, 예외 없음)
- 상세: `plan/in-progress/member-dup-remove.md` §C-2 가 재진입 기법으로 **직접 재현**했다 — owner 가드가 무락 `findOne` 위에
  있어, 읽기와 신규 원자적 `DELETE` 사이에 동시 `transferOwnership` 이 대상을 owner 로 승격시키면 가드를 통과한 채 owner 가
  지워진다(실측 `status=200`, `rows_remaining=0`). 이 PR **이전부터** 있던 결함이고(무락 읽기 자체는 diff 이전에도 있었다)
  이번 diff 로 새로 생기거나 악화되지 않았지만, `data-flow/12-workspace.md` 의 "owner 는 제거 불가" 라는 절대 서술은 여전히
  실측과 어긋난 채로 남는다. 처방이 이 PR 에 포함되지 않은 이유는 계약이 다르기 때문이다(§B "감사 중복 방지" vs
  owner 보호는 `affected===0` 판별자의 의미를 하나에서 둘로 늘리는 별도 변경) — `plan/in-progress/spec-draft-nullable-notation-followups.md`
  (2026-09-21 추가 항목 "`removeMember()` 의 owner 보호 가드가 TOCTOU 로 뚫린다")에 재현 레시피·후보 처방과 함께 이미 개별
  planner/developer 항목으로 등재돼 있어 유실 위험은 낮다.
- 제안: 이 PR 을 막을 근거는 아니다(신규 결함 아님·별도 트래커 항목 존재). 다만 `data-flow/12-workspace.md:141` 자체에는 아직
  이 예외에 대한 각주가 없다 — 후속 PR 이 owner-TOCTOU 를 닫을 때 "owner 는 제거 불가(단, `transferOwnership` 과 경합하는
  좁은 창에서 예외 있음 — #추적)" 류의 각주를 함께 넣을 것을 권한다. 지금 당장 문서만 먼저 고치는 것은 권하지 않는다 —
  아직 처방이 검증 전이라 각주 문구가 처방보다 먼저 굳을 수 있다.

### [INFO — 이미 계획에 등재됨] 형제 축 관례("동시 삭제 → 진 쪽 404") 서술 부재 목록에 이번 두 자리가 이미 반영됨

- target 위치: `spec/2-navigation/9-user-profile.md` §6.1(`:378`) · `spec/data-flow/12-workspace.md` §1.6
- 충돌 대상: `spec/2-navigation/2-trigger-list.md` §4.4(유일하게 "동시 삭제 → 두 번째 404" 명시), `spec/5-system/2-api-convention.md` §3(DELETE 를 멱등 `O` 로만 표기)
- 상세: 직전 `--impl-prep` 라운드(WARNING·INFO)가 지적한 두 자리(멱등성 각주 부재, 서술 부재 목록 확장)는 이번 PR 의
  트래커 갱신(`plan/in-progress/spec-draft-nullable-notation-followups.md` diff)에서 실제로 반영됐다 — "재확장 (3)" 항목이
  `9-user-profile.md §6.1`·`data-flow/12-workspace.md §1.6` 두 자리를 명시적으로 추가했고, 각주 집행 시 "다섯 경로" 로
  경로 수를 고정하지 말라는 주의도 함께 남겼다(전수 조사 결과 9자리로 확장됐으므로). 새로 발견할 갭은 없다.
- 제안: 조치 불필요 — 계획대로 진행.

## 요약

이번 라운드(impl-done)는 `workspaces.service.ts`·`workspaces.service.spec.ts`·신규 e2e 세 파일 diff 를 대상으로 하며,
착지한 코드는 직전 `--impl-prep` 검토가 심사한 예고와 정확히 일치한다 — API 계약(엔드포인트·응답 shape·에러 코드)·RBAC·
데이터 모델·상태 머신 어느 것도 새로 정의하거나 바꾸지 않고, 형제 다섯(#1369~#1372)과 동일한 명명·구조의 내부 원자성
교체다. 유일하게 의미 있는 cross-spec 갭은 `data-flow/12-workspace.md:141` 의 "owner 는 제거 불가" 절대 서술이 실측
재현된 TOCTOU(`transferOwnership` 경합)로 이미 깨져 있다는 점인데, 이는 이 PR 이전부터 있던 결함이고 이 PR 은 그것을
악화시키지도 고치지도 않으며 이미 별도 트래커 항목(재현 레시피·후보 처방 포함)으로 등재돼 있다. 이 PR 자체를 막을 근거는
없다.

## 위험도

LOW
