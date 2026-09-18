# Plan 정합성 검토 — `spec-draft-deletion-release-current-tense.md`

## 발견사항

- **[INFO]** 트래커 row 6(ModuleRef 지연 해석 표 추가)을 draft 가 일방적으로 "하지 않는다"로 뒤집음
  - target 위치: draft `## 비대상 — 트래커 6행을 하지 않는 이유` 표, 첫 행
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4563`(트래커 원본 row 6 — "`spec/5-system/4-execution-engine.md §4.4` 지연 해석 표에 `ModuleRef.get(…, { strict: false })` 의 **던지는** 사례 … 행 추가"), 그리고 그 근거인 `plan/complete/trigger-deletion-release.md:129`(`INFO 2 | ModuleRef throw 실패 모드가 4-execution-engine.md §4.4 표에 없다 | planner 후속에 함께 등재`)
  - 상세: row 6 은 `/ai-review` INFO 를 근거로 "표에 행을 추가하라"는 구체적 지시로 등재됐다. draft 는 이를 실행하지 않고 "그 표는 실행 엔진의 이벤트 발행 sink 전용이라 트리거 정리 사례를 넣으면 표가 저장소 전체 규약처럼 읽힌다"는 새 근거로 미실행 결정을 내린다. 논리 자체는 타당해 보이고 draft 는 이를 숨기지 않고 "비대상" 절에 명시하며, 트래커 반영 절에서도 "6행은 위 비대상 사유로 처분을 적는다"고 밝혀 투명하게 처리한다. 다만 이는 **원래 지시를 낸 review round 의 처분("등재")을 사후에 뒤집는 결정**이라는 점에서, 순수 정합성 검증 관점에서는 "결정 필요"로 명시적으로 남겨진 항목은 아니었으나 실행 지시가 있었던 항목의 결과를 바꾸는 셈이다.
  - 제안: 현재 draft 문면 그대로도 수용 가능(사유가 실질적이고 detectable). 다만 `plan/complete/trigger-deletion-release.md` 의 INFO 2 처분 기록("planner 후속에 함께 등재")도 사후적으로 "미실행 확정"이라는 각주를 남기면, 다음에 이 completed plan 을 열어보는 사람이 "등재됐어야 하는데 안 됐다"고 재차 flag 하는 것을 막을 수 있다(선택적 보강, 필수는 아님).

## 확인된 정합 사항 (참고)

아래는 CRITICAL/WARNING 후보로 조사했으나 실측 결과 정합함을 확인한 항목들이다(false positive 배제용 기록):

- **트래커 자기 정합성**: 대상 트래커 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md:4552-4564`)의 7개 row 전부가 draft C1~C9 로 1:1 대응되며 내용도 일치한다(잔여 목록의 "워크스페이스 선검사 뒤 역할 변경" 문구까지 `plan/complete/trigger-deletion-release.md:140-142`의 리뷰 처분과 정확히 일치).
- **선행 plan 미해소 없음**: draft 가 전제하는 "구현이 머지됐다"는 사실은 `a9288bf6e`(gitStatus 최근 커밋) 및 `plan/complete/trigger-deletion-release.md` 전체 종결로 이미 충족됨. `plan/complete/spec-draft-deletion-releases-trigger-resources.md` 의 D1~D7 계약도 grep 대조 결과 draft 가 손대지 않음(주장대로).
- **사후 정리(sweeper) 재판단 미해결 항목과 충돌 없음** — 트래커의 "트리거 자원 정리의 사후 정리(sweeper) 필요 여부 재판단"(같은 파일, row 바로 다음)은 여전히 `[ ]` 로 열려 있고, draft 의 C1 잔여 창 서술(권한 선검사↔재검사 역할 변경 창 포함)은 이 sweeper 판단 항목이 나열한 창(외부 해제 스냅샷 뒤 트리거 생성, 동시 재등록, 프로세스 종료)과 겹치지 않는 별개 창이며, 이미 `plan/complete/trigger-deletion-release.md` 리뷰 처분 단계에서 "planner 후속"(바로 이 draft 가 닫는 대상 항목) 쪽으로 명시 배정돼 있어 sweeper 항목을 갱신할 필요가 없다.
- **`pending_plans` 승격(C10) 이 다른 in-progress plan 의 가정과 충돌하지 않음** — `spec-status-lifecycle.test.ts` 실측 결과 게이트 (c)는 "모든 `pending_plans` 가 `complete/` 로 이동했는데 `status` 가 `partial` 로 남으면 실패"만 검사하고, `implemented` 로의 승격 자체를 막는 반대 방향 검사는 없음(코드 확인 완료) — C10 이 규약화하려는 "가드가 이 방향을 안 본다"는 서술은 사실과 일치.
- **`1-workflow-list.md` frontmatter 관례 준수** — `pending_plans:` 에 이미 `plan/complete/workflow-duplicate-nodes-edges.md`(완료된 plan의 경로를 `complete/` 로 치환해 남겨두는 방식)가 있는데, 이는 `plan/complete/workflow-duplicate-nodes-edges.md:117-119` 에 명시된 저장소 관례("완료 시 pending_plans 경로를 in-progress/ → complete/ 로 치환, 삭제하지 않음")와 정확히 일치한다. C8 이 이 항목은 그대로 두고 대상 트래커 줄만 제거하는 것은 관례에 맞다.
- **WARNING 1 처분의 선례 검증** — draft 가 "`aecf877c1` 은 선례가 아니다"라고 주장한 근거를 `git show aecf877c1` 로 직접 대조한 결과, 커밋 메시지가 "같은 PR 에서 완전 구현되므로 지연 surface 아님, `status: spec-only` 유지"라고 명시해 draft 의 구분(공유 트래커 승격과 무관)이 정확함을 확인.
- **동시 편집 중인 다른 in-progress plan 과의 섹션 충돌 없음** — `2-trigger-list.md`/`secret-store.md`/`10~12-triggers·workflow·workspace.md`/`spec-impl-evidence.md §3.1` 을 참조하는 다른 in-progress plan(`auth-guard-reflection-hardening`, `backend-lint-gate-broken-on-main`, `keyset-cursor-uuid-validation`, `harness-review-gate-followups`, `spec-sync-auth-gaps`, `spec-sync-external-interaction-api-gaps`, `execution-engine-residual-gaps`, `rag-quality-improvement`, `webchat-auth-session-status-reconcile` 등)을 전수 확인했으나, draft 가 편집하는 정확한 절(§4.3/§4.4/frontmatter status·code·pending_plans/§3.1 전이규칙)과 내용상 겹치는 곳은 없다(라인 근접은 `spec-sync-auth-gaps.md` 가 `2-trigger-list.md:182` 감사 로그 액션명 이슈를 별도로 다루는 정도이나, 이는 동시 편집 mechanics 문제이지 정합성 충돌이 아니다 — 검토 범위 밖).

## 요약

Plan 정합성 관점에서 이 draft 는 자신의 출처인 트래커 항목(`spec-draft-nullable-notation-followups.md`)의 7개 지시사항을 정확히 그대로 실행하고, 형제 항목들(sweeper 재판단, 성능 후속, 동시 DELETE 감사중복)의 존재·범위와 충돌하지 않으며, `#1345`의 D1~D7 계약도 손대지 않는다. 유일한 편차는 트래커 row 6(ModuleRef 표 추가)을 사후 판단으로 미실행 처리한 것인데, 이는 투명하게 문서화되고 근거가 실질적이라 결정 자체는 수용 가능한 수준이다(INFO). 이전 라운드(`09_58_25`, BLOCK:YES)가 지적한 CRITICAL/WARNING 에 대한 draft 자체의 처분도 트래커 원문·git 이력과 대조해 사실관계가 맞는 것으로 확인했다. 종합적으로 plan 정합성 상 차단 사유는 없다.

## 위험도

LOW
