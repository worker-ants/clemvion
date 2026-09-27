# Plan 정합성 검토 — patch-body-followups (target: spec/2-navigation/)

## 검토 범위 요약

- target scope `spec/2-navigation/` 델타: 0 파일 (정상 — 이 PR 은 그 spec 영역을 바꾸지 않는다).
- 실제 코드 diff: 11 파일 / 372줄, 전부 backend PATCH 검증 계층 (`update-workflow.dto.ts` ·
  `update-node.dto.ts` · `update-auth-config.dto.ts` · `omit-undefined.ts` · 대응 spec/e2e).
  `git -C <worktree> diff --stat origin/main...HEAD -- codebase/` 로 직접 재확인함.
- 실행 plan: `plan/in-progress/patch-body-followups.md` (checklist 전항목 완료, `--impl-done` 만 미체크).
  상위 트래커: `plan/in-progress/spec-draft-nullable-notation-followups.md`.

## 발견사항

- **[INFO]** 트래커 좁히기·신규 항목 등재는 실측으로 확인됨, 재확인 권장 없음
  - target 위치: 해당 없음 (target spec 델타 0)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 항목 —
    (1) "PATCH 부분 본문 후속 …" 항목이 "남은 것: 실행 상세 응답에 선언 없는 관계 둘" 로 좁혀짐,
    (2) 신규 "PATCH 의 NOT NULL 필드에 `null` 을 보내면 500이다" 항목
  - 상세: `plan/in-progress/patch-body-followups.md` §방향 6 이 "트래커 항목을 닫지 않고 좁힌다
    (W1 → executions `findById`), 새 항목 등재" 라고 서술한 내용이 트래커 파일에 실제로 반영되어
    있음을 라인 단위로 대조 확인함(`spec-draft-nullable-notation-followups.md:1405-1450`, 커밋
    `6c7c976b0`). 좁혀진 항목은 `executions.service.ts findById` 착수 전 "planner 결정이 선행"
    (node 필드 처리 방식 · `14-execution-history.md` §5 vs `6-websocket-protocol.md` §6.2 목표
    계약 불일치)을 명시적으로 남겨 두어 미해결 결정을 우회하지 않음. 신규 500 항목은
    `plan/in-progress/keyset-cursor-uuid-validation.md §A` 의 기존 결정("필터에 SQLSTATE→400
    매핑을 넣지 않는다, 처방은 입구 DTO 검증")을 인용하며 그 결정과 충돌하지 않는 방향(입구
    검증)으로만 처방을 적어 두었음 — 해당 §A 원문과 대조해 인용이 정확함을 확인함.
  - 제안: 조치 불요. 완료 시(`--impl-done` 체크) 이 plan 을 `plan/complete/` 로 옮기면서 위 트래커의
    "`plan/complete/patch-body-followups.md`" 전방 참조가 유효해지도록 이동을 잊지 말 것(이미
    `patch-omit-undefined.md` 선례와 동일 패턴).

- **[INFO]** DTO 소유권 교차 확인 — 다른 in-progress plan 과의 충돌 없음
  - target 위치: 해당 없음
  - 관련 plan: 전체 `plan/in-progress/**`
  - 상세: 이번에 변경된 세 DTO(`UpdateWorkflowDto` · `UpdateNodeDto` · `UpdateAuthConfigDto`)를
    참조하는 다른 in-progress plan 이 있는지 전수 grep 했으나 `spec-draft-nullable-notation-followups.md`
    와 `patch-body-followups.md` 자신 외에는 없음. 동시에 같은 파일을 다른 방향으로 바꾸려는 미해결
    plan 은 없다.
  - 제안: 조치 불요.

## 요약

target(`spec/2-navigation/`)은 이 PR 에서 델타가 없고, 실제 변경은 backend PATCH DTO 의 nullable
선언·캐너리에 한정된다. 이 변경이 근거로 삼는 유일한 관련 결정(23502→400 필터 매핑 기각, §A)은
`keyset-cursor-uuid-validation.md`에서 이미 확정된 결정이며 이번 plan 은 그 결정을 그대로 따르고
있어 우회·충돌이 없다. 상위 트래커(`spec-draft-nullable-notation-followups.md`)의 항목 좁히기·신규
항목 등재도 plan 본문의 서술과 실제 파일 내용이 일치함을 확인했고, 남겨둔 미해결 사안(executions
응답의 `node`/`workflow` 관계 처리, `14-execution-history.md` vs `6-websocket-protocol.md` 목표
계약 불일치)은 착수 전 "planner 결정 선행" 으로 명시적으로 보류되어 있어 일방적으로 결정을 내린
곳이 없다. Plan 정합성 관점에서 차단 사유 없음.

## 위험도

NONE
