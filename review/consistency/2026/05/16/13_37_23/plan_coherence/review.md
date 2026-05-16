# Plan 정합성 검토 — `spec/2-navigation/4-integration.md`

검토 모드: `--impl-prep`
검토 대상 worktree: `cafe24-test-connection-2d7fa4`
관련 plan: `plan/in-progress/cafe24-test-connection.md`

---

## 발견사항

- **[CRITICAL]** `spec/2-navigation/4-integration.md` 동시 수정 — worktree 충돌
  - target 위치: `cafe24-test-connection.md` §"Spec 갱신 (project-planner 위임 대상)" — §5.8 "테스트 방법" 항목 갱신 예정
  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`) — `spec/2-navigation/4-integration.md` §3.2 / §4.4 / §6 / §9 / §10.2 / Rationale 다수 절 동시 수정 중. `git diff main --name-only` 기준 `cafe24-spec-sync-e2a8b9` 도 `spec/2-navigation/4-integration.md` 를 직접 수정하고 있음 (커밋 `75126762`).
  - 상세: `cafe24-spec-sync-e2a8b9` 브랜치가 이미 `spec/2-navigation/4-integration.md` 를 수정한 상태로 존재하며, `cafe24-app-url-reuse-f9a2e3` plan 도 같은 파일의 여러 절을 손대고 있다. 본 plan 이 project-planner 위임을 통해 §5.8 을 추가 갱신하면 세 개 변경이 동시에 해당 파일을 목표로 하는 경합이 발생한다. 현재 `cafe24-spec-sync-e2a8b9` 는 main 보다 앞서 있으며 미머지 상태다.
  - 제안: 본 plan 의 spec 갱신 위임(`spec-update-cafe24-test-connection.md` 생성)은 `cafe24-spec-sync-e2a8b9` 와 `cafe24-app-url-reuse-f9a2e3` 의 관련 변경이 main 에 머지된 이후로 직렬화한다. 구현(코드) 작업 자체는 별도 파일이므로 선진행 가능하나, spec 갱신 위임 분리는 위 두 PR 머지 후 착수하도록 plan 에 의존성 주석을 추가한다.

- **[CRITICAL]** `spec/2-navigation/4-integration.md §11` 동시 수정 — 별도 plan 충돌
  - target 위치: `cafe24-test-connection.md` §"Spec 갱신" — 간접적으로 §10.5 참조 + §5.8 신규 기술
  - 관련 plan: `plan/in-progress/spec-update-cafe24-background-refresh.md` (worktree: `prod-rereview-fix-a7c93f`) — 동일 파일 §11 (`cafe24-background-refresh` BullMQ job 신규 소절) 갱신 예정
  - 상세: `prod-rereview-fix-a7c93f` plan 은 `spec/2-navigation/4-integration.md §11` 전체를 재구성하는 작업(4개 항목)을 project-planner 에 위임 중이다. 본 plan 은 §5.8 만 건드리지만, 두 위임이 동시에 project-planner 세션에서 진행되면 동일 파일에 순서 없이 편집이 가해질 수 있다. worktree 가 다르므로 git 레벨 충돌은 발생할 수 있다.
  - 제안: `spec-update-cafe24-background-refresh.md` 의 project-planner 작업이 완료·머지된 후 본 spec 위임을 착수하거나, 두 위임을 동일 project-planner 세션에서 병합 처리한다.

- **[WARNING]** 사전 의무 절차(`/consistency-check --impl-prep`) 미실행
  - target 위치: `cafe24-test-connection.md` §"진행 체크리스트" — `[ ] 사전 일관성 검토 (/consistency-check --impl-prep)` 체크박스 미체크
  - 관련 plan: 동일 plan 내 체크리스트 항목
  - 상세: developer skill 규약은 구현 착수 직전 `--impl-prep` 을 의무 호출로 정한다. 본 consistency-check 가 `--impl-prep` 모드로 호출됐으나 이는 orchestrator 가 실행한 것이며, plan 체크리스트의 해당 항목은 아직 미체크 상태다. 테스트 선작성·구현 체크박스도 모두 미체크이므로 아직 착수 전임을 확인 — 순서 자체는 올바르나 plan 에 이 검토 결과가 기록·체크돼야 다음 단계 착수 근거가 생긴다.
  - 제안: 본 검토(`--impl-prep`) 결과(CRITICAL 2건)를 plan 에 기록하고, CRITICAL 해소(의존 PR 직렬화 확인) 후 체크박스를 체크한다.

- **[WARNING]** §5.8 엔드포인트 변경 결정의 spec 선행 미반영
  - target 위치: `cafe24-test-connection.md` §"Spec 갱신" — "사용자 지시(2026-05-16)로 `GET /api/v2/admin/apps` 로 변경" 명시
  - 관련 plan: 현재 `spec/2-navigation/4-integration.md §5.8` 은 기존 `/store` ping 방식으로 기술됐을 가능성 (cafe24-spec-sync-e2a8b9 의 변경 내역에 §5.8 수정 여부 미확인)
  - 상세: 사용자 결정으로 테스트 엔드포인트가 `/store` → `/apps` + 401 재시도로 변경됐으나, 이 결정이 spec 에 반영되기 전에 구현이 진행되면 spec ↔ 코드 불일치가 발생한다. 본 plan 은 spec 갱신을 project-planner 에 위임 예정이지만, 구현 착수 순서와 spec 갱신 순서가 역전될 경우 일시적 불일치 구간이 생긴다.
  - 제안: 구현 PR 과 spec 갱신 위임 plan(`spec-update-cafe24-test-connection.md`)을 동시에 진행하되, spec 갱신 PR 이 구현 PR 과 동시 또는 선행 머지되도록 계획한다. plan 에 이 순서 제약을 명시한다.

- **[INFO]** plan frontmatter `worktree` 필드 기재 — 정상
  - target 위치: `cafe24-test-connection.md` frontmatter `worktree: cafe24-test-connection-2d7fa4`
  - 관련 plan: 해당 없음
  - 상세: worktree 필드가 올바르게 기재되어 있으며 실제 worktree 디렉토리명과 일치한다.

- **[INFO]** `cafe24-spec-sync-e2a8b9` worktree 의 plan 목록에 `cafe24-test-connection.md` 미수록
  - target 위치: `cafe24-spec-sync-e2a8b9` 의 plan/in-progress 목록
  - 관련 plan: `plan/in-progress/cafe24-test-connection.md` (본 worktree 에서만 존재)
  - 상세: `cafe24-spec-sync-e2a8b9` 는 main 보다 앞선 커밋에서 분기했으므로 본 plan 을 알지 못한다. 추후 `cafe24-spec-sync-e2a8b9` 가 머지된 후 main 에서 보면 `cafe24-test-connection.md` 와 spec 변경이 충돌 없이 합쳐지는지 merge-coordinator 가 검토해야 한다.
  - 제안: `cafe24-spec-sync-e2a8b9` PR merge 시 `spec/2-navigation/4-integration.md` 의 §5.8 관련 내용을 확인한다.

---

## 요약

`spec/2-navigation/4-integration.md` 는 현재 최소 두 개의 독립 worktree(`cafe24-spec-sync-e2a8b9`, `cafe24-app-url-reuse-f9a2e3`)가 동시에 수정 중이며, 추가로 `prod-rereview-fix-a7c93f`(`spec-update-cafe24-background-refresh.md`)도 동일 파일의 §11 을 project-planner 위임으로 갱신 예정이다. 본 plan(`cafe24-test-connection-2d7fa4`)이 구현 완료 후 `spec-update-cafe24-test-connection.md` 를 project-planner 에 위임하면 해당 파일에 대한 동시 편집 경쟁이 최소 3방향으로 가중된다. 이는 CRITICAL 등급의 worktree 충돌이며, 구현 코드 자체는 다른 파일을 건드리므로 선진행이 가능하나 spec 갱신 위임은 반드시 직렬화 이후에 착수해야 한다. 아울러 사전 의무 절차인 `/consistency-check --impl-prep` 결과를 plan 에 기록하고 CRITICAL 해소를 확인해야 구현 착수 요건이 충족된다.

---

## 위험도

CRITICAL
