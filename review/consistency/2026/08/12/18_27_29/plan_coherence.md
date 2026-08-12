# Plan 정합성 검토 — spec/data-flow/ (impl-done, diff-base=origin/main)

## 검토 범위 요약

target 은 `spec/data-flow/` (핵심은 `15-external-interaction.md`). 구현 diff 는
`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` +
`idempotency.interceptor.spec.ts` + `test/external-interaction.e2e-spec.ts` — Idempotency
캐시가 Spec EIA §R8 의 닫힌 목록(`2xx`·`409`·`410`)을 지키지 못하던 선재 결함(2026-05-21
원본 구현부터)을 6개 커밋(`779a6e240`~`147075a51`)에 걸쳐 처음엔 조건식만 고쳤다가(dead
code, `16_29_45` CRITICAL) `catchError` 기반으로 재설계해 닫은 작업이다.

`plan/in-progress/backend-lint-gate-broken-on-main.md` 가 이 작업 전체를 처음부터 끝까지
(1~4차 시도 실패 경위 포함) 스스로 기록하고 있고, 관련 planner 선행 작업
`plan/in-progress/spec-draft-eia-r8-alignment.md`(#1154, `ba3dbd676`)가 spec 을 SoT(§R8)에
맞춰 정정해 이 개발 작업의 선행 조건을 이미 해소해 뒀다. 두 plan 모두 target 의 현재 상태와
내용상 정합한다.

## 발견사항

- **[WARNING]** `spec/data-flow/15` 의 후속 수정이 developer 커밋에 섞여 들어갔는데, 그
  사실이 어느 plan 의 체크리스트에도 기록되지 않았다
  - target 위치: `spec/data-flow/15-external-interaction.md` §2.2 Redis/BullMQ 표,
    `interaction:idempotency:<key>` 행 — "⚠️ 현행 구현은 `statusCode >= 400` 전체를 제외해
    409·410 이 재현되지 않는다 (선재 갭)" 문구 삭제 (`git diff origin/main...HEAD` 상 2줄
    변경, 커밋 `779a6e240`)
  - 관련 plan: `plan/in-progress/spec-draft-eia-r8-alignment.md` (frontmatter
    `owner: project-planner`, `spec_impact: [spec/data-flow/15-external-interaction.md, ...]`,
    `status: in-progress`) — 이 plan 이 바로 이 파일의 §R8 정합화를 전담하는 문서인데,
    체크리스트 마지막 항목(L113-114)은 "backend-lint-gate-broken-on-main.md 의 planner
    인계 2건 체크 + 후속 구현 항목에 표시" 까지만 적었고, developer 턴이 같은 파일에 또 한
    번(갭 caveat 제거) 손댄 사실은 기록돼 있지 않다.
  - 상세: CLAUDE.md·`developer/SKILL.md` L28 은 "`spec/` | Read only — 수정 시
    `project-planner` 위임. 갱신 제안은 `plan/in-progress/spec-update-<name>.md`" 라고
    명시한다. 커밋 `779a6e240` 메시지는 이 경계를 스스로 인지("`spec/` 쓰기는 원칙적으로
    planner 권한이지만…")하고 "구현이 바뀌는 커밋과 원자적으로 지워지지 않으면 그 사이
    spec 이 거짓이 된다"는 근거로 편입했다고 밝힌다. 내용 자체(현재 구현 상태를 서술하는
    caveat 한 문구 삭제, §R8 SoT 와 상충 없음)는 사실 정합적이고 새로운 제품 결정을
    도입하지 않는다 — 이 점은 `review/code/2026/08/12/18_07_36/scope.md` 도 이미
    "임의의 spec drift 가 아니다" 로 검토를 마쳤다. 다만 그 리뷰는 최종 판단을
    "`--impl-done` consistency 검증 대상으로 남겨졌다" 고 명시적으로 이 검토 라인에
    떠넘겼는데, 정작 그 검증을 담당해야 할 `spec-draft-eia-r8-alignment.md` (owner:
    project-planner) 는 이 두 번째 편집을 전혀 인지하지 못한 상태로 남아 있다. 즉 "spec
    편집의 근거가 되는 plan" 과 "실제로 spec 을 두 번째로 건드린 커밋" 사이의 연결고리가
    plan 문서 어디에도 남지 않았다 — plan lifecycle 상 이 plan 이 `complete/` 로 이동할
    때 이 두 번째 편집의 존재·정당성 판단 근거가 함께 유실될 위험이 있다.
  - 제안: `spec-draft-eia-r8-alignment.md` 체크리스트에 "developer 턴 `eia-r8-cache-scope`
    가 §2.2 표의 갭 caveat 을 코드 수정과 원자적으로 제거함 — planner 사후 확인" 항목을
    한 줄 추가하거나(가장 저비용), 혹은 `developer/SKILL.md` L28 규약대로
    `plan/in-progress/spec-update-eia-r8-idempotency-gap-close.md` 를 별도 등록해 정식
    planner 승인 경로를 남긴다. 어느 쪽이든 이번 PR 자체를 막을 필요는 없다 — 내용은
    맞고 이미 한 리뷰 라인이 검증했으므로, 사후 planner 턴에서 plan 문서만 동기화하면
    된다.

- **[INFO]** `spec-draft-eia-r8-alignment.md` 는 체크리스트가 전부 `[x]`인데
  `status: in-progress` 로 남아 있다
  - target 위치: 해당 없음 (plan 자체의 lifecycle 상태)
  - 관련 plan: `plan/in-progress/spec-draft-eia-r8-alignment.md` frontmatter
  - 상세: `plan-lifecycle.md` §3 완료 조건("체크박스 전부 `[x]` + 미해결 follow-up 0건")을
    이미 만족한 것으로 보인다. 위 WARNING 항목(developer 후속 편집 기록)을 반영한 뒤
    `complete/` 이관을 검토할 만하다. 이번 PR 의 스코프는 아니다.

## 요약

target(`spec/data-flow/15-external-interaction.md`)과 관련 두 plan
(`backend-lint-gate-broken-on-main.md`, `spec-draft-eia-r8-alignment.md`) 은 §R8 캐시 대상
정합화라는 동일한 서사를 처음부터 끝까지 일관되게 기록하고 있고, 선행 조건(spec 을 SoT 에
맞추는 planner 턴)은 이미 해소돼 있어 "미해결 결정과의 충돌"이나 "선행 plan 미해소"에
해당하는 항목은 발견되지 않았다. 유일한 지적은 developer 커밋이 spec 파일을 코드와
원자적으로 한 번 더 건드리면서(내용은 정합) 그 사실이 담당 plan 문서에 기록되지 않은
점이며, 이는 push 를 막을 사안이 아니라 plan 문서 갱신으로 닫을 수 있는 WARNING 이다.

## 위험도

LOW
