# Plan 정합성 검토

## 검토 대상

`--impl-done` 대상은 `plan/in-progress/workspace-guard-followups.md`(경로 워크스페이스 가드 후속 — reflection
골격 · 403 설명 코드 보간 · 서비스 문구, `spec_impact: none`, 구현 커밋 `097411779`)이며, 그 트래커 항목은
`plan/in-progress/spec-draft-nullable-notation-followups.md` (line ~4985)의 "경로 워크스페이스 가드 후속" 이다.
구현 diff(8파일/291줄)를 실제로 대조한 결과 요구 1~5 전부 diff 에 반영되어 있고(`routeArgEntriesMatching` 골격
통합, controller 3곳 코드 보간, `throwOwnerTransferRequired` 형태 정리 + docstring 정정, `integrations.service.ts`
`ADMIN_ROLES` 공용화), 관련 선행 plan(`auth-guard-reflection-hardening.md`)이 요구하는 "부트 캐너리는
`handlerConsumesWorkspaceId`/`workspaceParamNamesOf` 를 그대로 호출해야 한다" 불변식도 diff 상 그대로 유지된다
(두 함수의 top-level export·시그니처 불변, 내부만 `routeArgEntriesMatching` 헬퍼로 위임). 다른 in-progress plan
중 `FORBIDDEN_*_ROUTE`/`ROLE_REQUIRED`/`ADMIN_ROLES`/`workspace-roles.ts` 를 참조하는 곳은 이 두 문서뿐이라
후속 항목 무효화·중복도 없다.

## 발견사항

- **[WARNING]** 트래커 종결 노트가 plan 본문의 실제 완료 상태보다 앞서 있다
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` line 5001-5002 (커밋
    `8723c5132`, "docs(review): /ai-review 19_27_34" 에서 추가)
  - 관련 plan: `plan/in-progress/workspace-guard-followups.md` 체크리스트 — `[ ] TEST WORKFLOW`,
    `[ ] /ai-review`, `[ ] --impl-done(...)`, `[ ] 트래커 항목 닫기` 4개가 여전히 미체크
  - 상세: 트래커는 "**2026-09-25 — 닫힘.** `plan/complete/workspace-guard-followups.md` — 다섯 건 모두
    처리 ... `/ai-review` `review/code/2026/09/25/19_27_34` 1라운드 Critical 0 · Warning 0 · 수정 0 으로
    수렴" 이라 적어 이미 완전히 종결된 것처럼 서술하지만, 실제로는 (1) `plan/complete/workspace-guard-followups.md`
    파일이 아직 존재하지 않고 `plan/in-progress/` 에 그대로 있으며, (2) 그 plan 자신의 체크리스트에서
    `/ai-review` 항목이 여전히 `[ ]` 로 남아 있다 — `/ai-review` 자체는 실제로 이미 실행되어 수렴했음이
    같은 커밋(`8723c5132`)의 `review/code/2026/09/25/19_27_34/*` 산출물로 확인되는데도 체크박스가 그 사실을
    반영하지 않았다. `--impl-done`(현재 이 검토)과 "트래커 항목 닫기" 도 아직 수행 전이다. 즉 트래커 문서 한
    곳만 놓고 보면 이 작업이 이미 `plan/complete/` 로 이관되어 완전히 끝난 것으로 읽히는데, 저장소 실제
    상태는 그렇지 않다 — 세션이 여기서 중단되면 트래커에는 존재하지 않는 경로(`plan/complete/...`)를
    가리키는 거짓 종결 서술이 남는다.
  - 제안: 이번 `--impl-done`(BLOCK: NO 확인) 이후, 같은 세션에서 (a) `workspace-guard-followups.md` 의 남은
    4개 체크박스를 실제 수행 순서대로 체크하고 (b) 파일을 `plan/complete/workspace-guard-followups.md` 로
    이동해 트래커의 "닫힘" 서술과 저장소 상태를 일치시킬 것. 체크와 `complete/` 이동은 동일 커밋(또는 동일
    마무리 커밋 시퀀스)에서 함께 처리해 중간 상태가 커밋 경계에 노출되지 않게 한다.

## 요약

구현 diff(8파일/291줄)는 `workspace-guard-followups.md` 가 요구한 5건과 `--impl-prep` 처리 방침(W1 골격 통합 시
`handlerConsumesWorkspaceId`/`workspaceParamNamesOf` export 유지)을 정확히 반영하며, 선행 plan
(`auth-guard-reflection-hardening.md`)의 부트 캐너리 불변식이나 다른 in-progress plan 의 후속 항목과 충돌·무효화가
발견되지 않았다. 유일한 이슈는 미해결 결정 충돌이 아니라 plan 문서 간 완료 상태 동기화 지연이다 — 트래커가 이미
"닫힘"으로 기록했지만 대상 plan 자신의 체크리스트·파일 위치는 아직 그 상태를 따라가지 못했다. 이는 이번
`--impl-done` 통과 뒤 같은 세션에서 마무리 커밋으로 해소 가능한 경미한 수준이다.

## 위험도
LOW
