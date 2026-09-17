# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-done, 트리거 삭제 자원 정리)

대상: `spec/2-navigation/2-trigger-list.md` §3(«동시 쓰기 직렬화»)·§4.3(cascade 동작, 2026-09-17
결정 「트리거 행을 없애는 모든 경로는 그 트리거의 자원을 정리한다」). 이번 브랜치는
`spec/2-navigation/**` 을 전혀 건드리지 않는다(diff 델타 0, `spec_impact: none`) — 구현
(`trigger-resource-release.ts` · `trigger-resource-releaser.service.ts` · `triggers/workflows/
workspaces/schedules` 각 service)이 이미 확정된 spec 텍스트를 그대로 따라잡는 설계다. 대조군은
`spec/1-data-model.md` §2.8~§2.9.1, `spec/data-flow/10-triggers.md` §1.4, `spec/data-flow/
11-workflow.md` §3.1/§3.2, `spec/data-flow/12-workspace.md` §1.10, `spec/conventions/
secret-store.md`, `spec/2-navigation/1-workflow-list.md`, `spec/2-navigation/9-user-profile.md`,
그리고 직전 impl-prep 세션(`review/consistency/2026/09/17/18_00_19/cross_spec.md`) 및
`plan/in-progress/trigger-deletion-release.md` 의 3라운드 `/ai-review` 처분 기록이다.

## 발견사항

- **[WARNING]** 이 PR 이 머지되면 spec 4곳의 "미구현 (Planned)" / `status: partial` 태그가
  거짓이 된다 — 후속 spec 정정이 아직 실행되지 않았다 (unchecked 항목)
  - target 위치: `spec/2-navigation/2-trigger-list.md` §4.3 상단 註 — *"구현은 frontmatter
    `pending_plans` 에서 추적 — **그 전까지는** 트리거 화면 삭제만 네 자원을 모두 정리하고(스케줄
    화면 삭제는 schedule job 만), 비밀을 행 삭제 **전에** 지운다"*. 이 "그 전까지는" 과도기 문구
    자체가 이 PR 로 무효화되는 전제를 담고 있다.
  - 충돌 대상(머지 후 거짓이 되는 서술 4곳):
    1. `spec/data-flow/10-triggers.md` §1.4 표 "Schedule 삭제" 행 — *"행 삭제 커밋 뒤 그 트리거의
       `secret_store` 비밀 정리 — **미구현 (Planned)**"*
    2. 같은 표 "Workflow·Workspace 삭제 (FK CASCADE)" 행 — 헤더 자체에 **"— 미구현 (Planned)"**
    3. `spec/data-flow/11-workflow.md` §3.1 `workflow` 삭제 행 및 §3.2 `trigger` 파급 행 — 둘 다
       **"트리거 자원 정리 — 미구현 (Planned)"**
    4. `spec/data-flow/12-workspace.md` §1.10 `DELETE /api/workspaces/:id` 행 및 cascade 표
       `secret_store` 행 — 둘 다 **"미구현 (Planned)"**, `spec/conventions/secret-store.md`
       frontmatter `status: partial`
  - 상세: `git diff origin/main...HEAD` 로 실측하면 이번 브랜치가 `trigger-resource-release.ts`
    (순수 함수) + `TriggerResourceReleaserService` + 네 삭제 경로(트리거·스케줄·워크플로·
    워크스페이스) 전부에 "외부 해제 → 락/행 삭제 → 커밋 뒤 비밀 정리" 를 배선했다(커밋
    `1544a1501`·`097e583e1`·`d2184dcf2`, e2e `trigger-deletion-releases-resources.e2e-spec.ts` 로
    고정). 즉 위 4곳이 "아직 아니다" 라고 말하는 그 동작이 이 브랜치에서 **이미 참**이 된다.
    이것은 새로 발견한 결함이 아니라 — `plan/in-progress/trigger-deletion-release.md` 의
    `--impl-prep` 처분 표 **W5** 가 정확히 이 위치들을 미리 지목했고("이 PR 이 그 문장을 참으로
    만든다... 이 PR 머지 뒤 거짓이 된다"), plan 체크리스트 하단에 "planner 후속 신설(Planned
    태그·§4.3 과도기 문구 제거 · `secret-store.md` partial→implemented ...)" 항목이 이미 있다.
    다만 그 항목은 **아직 `[ ]` 미체크**이고 `--impl-done` 체크리스트 줄도 비어 있다 — 즉 알려진
    채무이지 해소된 채무가 아니다.
  - 제안: 이 PR 자체를 막을 사유는 아니다(설계가 명시적으로 `spec_impact: none` 을 선언했고,
    developer 는 이미 결정된 spec 목표에 코드를 맞췄다). 다만 push/머지 직후 **project-planner
    턴**으로 위 4곳 + `2-trigger-list.md §4.3` 과도기 문구를 "구현 완료" 로 flip 하는 짧은 spec
    정정을 반드시 예약해 둘 것 — plan 체크리스트의 해당 항목을 이 PR 종결과 별개로 유실하지 않게
    `plan/complete/` 이관 전에 재확인.

- **[INFO]** 부모 삭제 트랜잭션에 새로 추가된 5초 `lock_timeout` (워크플로·워크스페이스)이 아직
  어떤 spec 문서에도 노출되지 않음 — 위와 같은 뿌리(Planned 문구 미정정)의 하위 항목
  - target 위치: 없음(target 델타 0) — 코드만 변경 (`d2184dcf2`, `lockParentAndListTriggerIds` /
    `setLocalLockTimeout`).
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` §4.4 "결과·에러" 는 트리거 단위 advisory
    lock 의 "락 대기 상한 5초" 만 규정한다. `spec/data-flow/11-workflow.md` §3.1, `spec/data-flow/
    12-workspace.md` §1.10, `spec/2-navigation/1-workflow-list.md`(삭제 행), `spec/2-navigation/
    9-user-profile.md`(§ 워크스페이스 삭제, "이름 재입력 확인 → 멤버·초대·워크스페이스 순으로
    트랜잭션 삭제")는 이 신규 잠금 상한이나 그로 인한 에러 가능성을 언급하지 않는다.
  - 상세: 워크플로/워크스페이스 삭제가 이제 "행을 잠그기 전 되돌릴 수 없는 외부 자원(schedule job
    · chat channel teardown)을 먼저 해제" 하고 그 뒤 부모 행을 5초 상한으로 잠근다 — 상한 초과 시
    거동(에러 코드·사용자 노출 메시지)이 어느 spec 에도 없다. 트리거 자체의 §4.4 패턴("타임아웃 시
    비가역 부분 상태를 서버 로그에만 남긴다")과 같은 계열일 가능성이 높지만 문서화된 적이 없다.
  - 제안: 새로 발견한 gap 이 아니라 `trigger-deletion-release.md` 플랜 체크리스트가 이미
    "planner 후속 신설 ... §4.4 «락 대기 상한 5초» 를 워크플로·워크스페이스 부모 잠금까지(3라운드
    W2)" 로 등재해 두었다. 위 WARNING 과 같은 planner 턴에서 함께 처리할 것 — 별도 트랙 불필요.

- **[INFO]** `data-flow/10-triggers.md` §1.4 "Trigger(type='schedule') 직접 삭제" 행은 이 PR
  머지로 오히려 **정합해진다** (참고용, 조치 불필요)
  - 상세: 직전 impl-prep 세션(`18_00_19/cross_spec.md`)이 WARNING 으로 지목했던 자리 — 그 행만
    "미구현 (Planned)" 태그 없이 "비밀 정리는 행 삭제 커밋 뒤" 라고 **앞서서** 적혀 있었는데,
    `origin/main` 의 실제 코드는 반대(커밋 전에 지움)였다. 이번 브랜치가 정확히 그 순서를
    반전시켰으므로("트리거: 외부 해제 → 락·행 삭제 → 커밋 뒤 비밀(순서 반전)", plan §설계),
    머지 후에는 이 행이 처음으로 사실과 일치한다. 위 WARNING 목록에 넣지 않는다.

## 확인했으나 충돌 없음 (참고)

- 데이터 모델: `1-data-model.md` §2.8 Trigger / §2.9 Schedule / §2.9.1 동기화 규칙, §2.13 Execution
  `trigger_id` 필드 서술은 target §4.3 cascade 표(schedule CASCADE · execution SET NULL ·
  auth_config FK 만 끊김)와 정합. 이번 브랜치는 이 엔티티 정의 자체를 바꾸지 않는다(마이그레이션
  신규 없음 — diff 에 `V*.sql` 없음).
- RBAC: 이번 브랜치는 `5-system/1-auth.md` 를 건드리지 않았고, 삭제 권한 로직(`editor`+)도 변경하지
  않았다 — 직전 impl-prep 세션이 확인한 정합이 그대로 유지된다.
- API 계약: 이번 diff 는 `triggers.controller.ts`/DTO 의 공개 계약을 바꾸지 않는다(순수 내부 정리
  로직 + 서비스 레이어 배선). `2-trigger-list.md §3` 의 엔드포인트 표·에러 코드는 영향받지 않는다.
- `1-workflow-list.md` 삭제 행("트리거가 쓰던 외부 등록과 비밀도 정리한다")은 애초에 Planned 태그
  없이 목표 상태를 서술하도록 설계됐다(`aaee17206` 원커밋 diff 확인) — data-flow 문서군과 표현
  층위가 다른 의도된 설계이며 이번 PR 로 모순이 생기지 않는다(오히려 그 문구가 참이 된다).

## 요약

이번 검토 대상(`spec/2-navigation/`)은 diff 델타 0 — 이 브랜치는 spec 을 고치지 않고 이미 확정된
목표 상태(`2-trigger-list.md §4.3`)에 코드를 맞추는 순수 구현 PR 이다. Cross-spec 관점에서 새로
발견한 모순은 없다: 데이터 모델·RBAC·API 계약은 안정적이며, 직전 impl-prep 라운드가 지적한 유일한
WARNING(`10-triggers.md` "Trigger 직접 삭제" 행의 시제 불일치)은 이번 구현으로 오히려 해소된다.
다만 이 구현이 `data-flow/10-triggers.md`(2행) · `data-flow/11-workflow.md`(2곳) ·
`data-flow/12-workspace.md`(2곳) · `secret-store.md`(`status: partial`) · `2-trigger-list.md §4.3`
자신의 "그 전까지는" 문구에 걸린 "미구현 (Planned)" 표시들을 머지 시점부터 거짓으로 만든다 — 이는
새로 발견한 결함이 아니라 developer 자신의 plan(`trigger-deletion-release.md` `--impl-prep` W5)이
이미 정확히 예견하고 planner 후속으로 등재해 둔 항목이지만, 그 체크리스트 항목이 **아직 미체크**
상태라 이 PR 종결 전에 놓치지 않도록 재확인이 필요하다. 같은 뿌리에서 파생된 하위 항목(워크플로·
워크스페이스 부모 잠금에 신설된 5초 lock_timeout 이 아직 어느 spec 에도 노출되지 않음)도 같은
planner 턴에서 함께 처리하면 된다. 이 PR 의 push 를 막을 CRITICAL 은 없다.

## 위험도

LOW
