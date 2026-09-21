# Plan 정합성 검토 — spec/2-navigation (--impl-prep, member-dup-remove)

## 발견사항

- **[WARNING]** `9-user-profile.md:378` 의 멤버 제거 DELETE 가 「동시 삭제 → 두 번째 404」 문서 부채 목록에서 빠져 있다
  - target 위치: `spec/2-navigation/9-user-profile.md` §4.1 / §API 표 `DELETE /api/workspaces/:id/members/:memberId` (line 378, "멤버 제거 (Admin+ / 자가 탈퇴 시 leave로 위임)")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 4849-4862 의 planner 항목
    「`1-workflow-list.md §2.6` · `data-flow/12-workspace.md §1.10` · `3-schedule.md §4` · `4-integration.md §9` 에
    «동시 삭제 → 두 번째 404» 서술이 없다」— 이 항목은 2026-09-20(schedule)·2026-09-21(integration) 두 차례
    "재확장"되며 형제 엔드포인트가 하나씩 고쳐질 때마다 그 위치를 추가해 온 관례가 있다(같은 파일 4853·4855행).
  - 상세: `member-dup-remove.md` 는 `WorkspacesService.removeMember()` 를 형제 다섯(workflow #1369 · workspace
    #1369 · trigger #1370 · schedule #1371 · integration #1372)과 같은 처방(원자적 `delete` 의
    `affected === 0` → 404)으로 고친다. 고치고 나면 `DELETE /api/workspaces/:id/members/:memberId` 도
    "동시 요청 중 진 쪽은 404" 비대칭을 갖게 되어, 위 tracker 항목이 이미 지적한 "코드는 되는데 spec 은
    침묵" 패턴에 여섯 번째로 들어간다 — 그런데 tracker 항목도, `member-dup-remove.md` 의
    `spec_impact: none` 도 `9-user-profile.md` 를 언급하지 않는다. 같은 tracker 는 §5.4 문단(4857-4862)에서
    이것이 "침묵" 을 넘어 `spec/5-system/2-api-convention.md §3` 의 `DELETE` "멱등 `O`" 서술과
    **정면 충돌**한다고까지 적었는데, 멤버 제거가 다섯 번째가 아니라 여섯 번째 충돌 지점이 되는 사실이
    반영되지 않았다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 planner 항목에
    "2026-09-21 재확장(3)" 으로 `9-user-profile.md:378` 을 추가하거나, `member-dup-remove.md` 의
    `spec_impact` 를 `none` 대신 이 문서를 가리키도록 갱신한다. (구현 자체를 막을 사유는 아니다 — 선례들도
    코드 PR 과 문서 갱신을 분리해 왔다. 다만 이번에 tracker 갱신을 빠뜨리면 "다음 사람이 또 좁게 센다"는
    `member-dup-remove.md` §A 자신의 경고가 이 자리에서 반복된다.)

- **[INFO]** trigger-list.md 가 가리키는 plan `eia-trigger-edit-ui` 가 저장소에 존재하지 않는다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 필드 권한 매트릭스, `External Interaction (Notification)` 행
    ("별 plan `eia-trigger-edit-ui` 가 구현")
  - 관련 plan: 없음 — `plan/in-progress/`·`plan/complete/` 어디에도 `eia-trigger-edit-ui*.md` 파일이 없다
    (`git log --all --diff-filter=A --name-only` 로도 커밋된 적이 없다. 다른 완료 plan 의 본문에 계획 문구로만
    언급된 적이 있다).
  - 상세: 이 PR(`member-dup-remove`)의 범위와는 무관한 기존 dangling 참조다 — External Interaction 필드
    편집 UI 구현 여부·소유 plan 이 불명확한 채로 spec 이 참조만 하고 있다.
  - 제안: 이번 PR 의 차단 사유는 아니다. 별도 planner 턴에서 그 plan 을 실제로 생성하거나(구현이 이미
    되어 있다면) 참조를 제거/정정할 것.

## 요약

이번 세션이 곧 구현할 `WorkspacesService.removeMember()` 동시-삭제 감사 중복 수정은 spec/2-navigation
자체와 직접 충돌하는 결정은 없다 — target 문서가 "결정 필요" 로 남겨둔 항목을 이 구현이 우회하지도,
선행 plan 의 미해소 전제를 조용히 가정하지도 않는다. 다만 `plan/in-progress/spec-draft-nullable-notation-followups.md`
가 이미 추적 중인 "동시 삭제 → 두 번째 404" 문서 부채 계열(workflow·schedule·integration·workspace-delete)에
`9-user-profile.md:378` (멤버 제거) 이 다섯 번째 자리로 추가되어야 하는데 아직 어느 plan 에도 반영되지
않았다 — 형제 PR 들이 매번 그 tracker 항목을 확장해 온 관례와 어긋나는 후속 항목 누락이다. 구현을 막을
정도는 아니며(선례들도 코드와 문서 갱신을 분리했다), 트래커 갱신을 이번 PR 의 마무리 커밋에 함께 넣는
것을 권한다. 그 외 trigger-list.md 의 dangling plan 참조(`eia-trigger-edit-ui`)는 이번 작업과 무관한
기존 결함으로 별도 처리 대상이다.

## 위험도

LOW
