# Plan 정합성 검토 — `spec/2-navigation` (--impl-prep, target plan: `plan/in-progress/dup-delete-audit.md`)

## 발견사항

- **[WARNING]** `lockParentAndListTriggerIds` 반환 계약 변경이 열려 있는 "4-자리 공용 형태" 설계 항목과 교차 참조되지 않음
  - target 위치: `plan/in-progress/dup-delete-audit.md` §B (반환을 `string[] | null` → `{ parent: 'present' | 'absent'; triggerIds: string[] }` 로 바꾸는 결정), 영향받는 시행 코드는 `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 에 등재된 `trigger-resource-release.ts` / `trigger-resource-releaser.service.ts`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 4492~4521 의 developer 항목 "`trigger-config` advisory lock 이 남긴 developer 범위 후속" 표 #1 — "`TriggersService.remove()` 와 `SchedulesService.remove()` 의 «락 → 삭제 → 실패 로깅 → 재던짐» 블록이 복제돼 있다" 이며, 2026-09-17 갱신 메모가 "워크플로·워크스페이스 삭제가 …를 더해 **네 자리**가 됐다(트리거 5초 락 · 스케줄 BullMQ · 부모 트랜잭션) 공용 형태는 설계가 필요하다" 라고 아직 미해결(`- [ ]`)로 남겨 둠
  - 상세: 이 미해결 항목이 가리키는 "부모 트랜잭션" 자리가 정확히 `lockParentAndListTriggerIds` (WorkflowsService·WorkspacesService 공유 헬퍼) 다. dup-delete-audit 플랜은 이 헬퍼의 반환 타입을 이번 PR 에서 바꾸는데, 트래커 항목 #1 은 "네 자리를 아우르는 공용 형태" 를 나중에 설계하겠다고 예고해 둔 상태다. 지금 반환 계약을 바꾸면, 나중에 그 설계를 진행하는 사람이 옛 반환 형태(`string[] | null` 류)를 전제로 항목을 다시 읽을 위험이 있다 — 결정을 정면으로 뒤집는 것은 아니지만(그 항목은 "지금 이 헬퍼를 건드리지 말라" 고 말하지 않는다), 통합 설계의 입력이 바뀌는 side effect 를 그 항목이 모르는 채로 남는다.
  - 제안: dup-delete-audit 플랜의 "체크리스트" 또는 커밋 본문에 트래커 항목 #1(라인 4501)을 한 줄로 교차 참조 — 예: "이 PR 이후 `lockParentAndListTriggerIds` 반환 형태는 `{parent, triggerIds}` 다. 향후 4-자리 공용 형태 설계 시 이 계약을 전제로 할 것." 트래커 자체를 지금 갱신할 필요는 없다(그 항목은 여전히 미착수 설계 항목으로 유효) — 단, 플랜이 "트래커 항목 해소" 체크리스트 항목에서 라인 4741~4744 만 닫고 4501 은 언급하지 않으므로, 완료 시점에 놓치기 쉽다.

- **[INFO]** workflow-list.md 는 trigger-list.md §4.4 와 달리 "동시 삭제 시 두 번째 요청" 동작을 명시하지 않음
  - target 위치: `spec/2-navigation/1-workflow-list.md` §2.6(더보기 메뉴 "삭제") 및 §3 API 표의 `DELETE /api/workflows/:id` 행 — 응답 코드·동시 삭제 결과 서술 없음
  - 관련 plan: `plan/in-progress/dup-delete-audit.md` (spec_impact: none)
  - 상세: `2-trigger-list.md §4.4` 는 이미 "동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`" 를 명문화하고 있다. dup-delete-audit 이 착지하면 워크플로 삭제도 정확히 같은 동작(두 번째 요청 404)을 갖게 되는데, workflow-list.md 는 이런 세부를 서술한 적이 없어 "spec_impact: none" 판단이 트리거 화면의 문서화 관례와는 비대칭이다. 다만 이 비대칭은 `spec/5-system/3-error-handling.md` 의 일반 `RESOURCE_NOT_FOUND=404` 규약으로 이미 커버되므로 스펙 위반은 아니다.
  - 제안: 차단 사유는 아니다. 문서 대칭성을 원하면 후속 planner 턴에서 workflow-list.md §2.6 근처에 한 줄 추가를 고려할 수 있다 — 이번 PR 의 `spec_impact: none` 선언을 바꿀 필요는 없다.

## 요약

target(`spec/2-navigation`, 특히 `1-workflow-list.md`·`2-trigger-list.md`)과 이번에 착수하려는 `plan/in-progress/dup-delete-audit.md` 는 정합적이다. 이 플랜은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 2026-09-17 에 등재한 "동시 중복 DELETE 가 감사 행을 두 번 남길 수 있다" 항목(라인 4741)이 제시한 처방(부모 부재를 헬퍼가 돌려주고 호출자가 404 로 끝낸다)을 그대로 따르고, 스코프도 "이 PR 이 하지 않는 것" 절로 명확히 좁혀 다른 미해결 항목(외부 해제 중복, `findById` 잠금화 등)을 건드리지 않는다. `spec/2-navigation` 안에서 이 결정과 충돌하는 "결정 필요" 서술이나, 이 플랜이 전제하는 미해소 선행 조건은 발견되지 않았다. 다만 같은 트래커 파일의 별도 미해결 항목(#1, 4-자리 삭제 헬퍼의 "공용 형태" 설계)이 이번 PR 이 바꾸는 바로 그 헬퍼(`lockParentAndListTriggerIds`)를 대상으로 하므로, 완료 후 그 항목에 계약 변경 사실을 한 줄 남겨 두는 것이 향후 통합 설계자의 혼선을 줄인다(WARNING). workflow-list.md 가 trigger-list.md 만큼 동시 삭제 결과를 명시하지 않는 비대칭은 일반 에러 규약으로 이미 커버되어 차단 사유가 아니다(INFO).

## 위험도

LOW
