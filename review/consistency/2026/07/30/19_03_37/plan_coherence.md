# Plan 정합성 검토 — spec/data-flow/ (impl-done)

## 검토 대상 재확인

- 실 diff(`origin/main...HEAD`): `spec/data-flow/11-workflow.md` §1.5/§2.1/Rationale +
  `spec/2-navigation/1-workflow-list.md` §2.6/§3 (`POST /api/workflows/:id/duplicate` 계약을
  "메타 row 만 복제"에서 "nodes/edges 포함 캔버스 전체 복제"로 정정) — 이번 impl-done 단계에서
  spec 파일 자체의 추가 변경은 없었다(`git log`로 확인: 두 spec 파일은 `f71839fe6`/`0502e43c7`
  이후 손대지 않음). 실제로 진행된 것은 `codebase/backend/src/modules/workflows/workflows.service.ts`
  구현(`13b818ec5`) + 테스트 보강 + `/ai-review` Warning 7건 조치(`RESOLUTION.md`,
  `review/code/2026/07/30/17_54_27/`) + `CHANGELOG.md`/`ui-tour` 문서 갱신이다.
- 이 변경을 구동하는 plan 은 `plan/in-progress/workflow-duplicate-nodes-edges.md`
  (frontmatter `worktree: resumable-handler-generic-typing-3918dd` — 현재 세션과 일치). 체크리스트는
  실제 상태와 정확히 일치한다: 완료 항목만 `[x]`, 남은 2건(`완료 시 동기화` — plan 이동 시
  `pending_plans` 치환 / 본 `--impl-done` 게이트 자체)만 `[ ]`로 열려 있다 — 둘 다 정상적인
  라이프사이클 잔여 항목이지 미해소 결정이 아니다.
- 동일 target 에 대한 선행 두 라운드(`review/consistency/2026/07/30/16_45_59/`(--spec),
  `review/consistency/2026/07/30/17_03_26/`(--impl-prep))가 이미 32개 `plan/in-progress/**`
  문서 전체(및 `node-output-redesign/*` 30개 포함) 를 grep 으로 전수 대조해 Plan Coherence
  위험도 NONE 을 확정한 바 있다. 이번 라운드는 그 이후 spec 변경이 없었으므로 (a) 그 결론이
  구현 단계에서도 유지되는지, (b) 구현 중 발생한 신규 커밋(코드/리뷰/문서)이 새로운 저촉을
  만들지 않았는지를 재확인하는 데 집중했다.

## 발견사항

없음.

재확인 근거:

1. **미해결 결정과의 충돌 없음** — `plan/in-progress/**` 32개 문서를 `duplicate`/`복제`/
   `workflow_version`/`WorkflowsService` 키워드로 재grep 한 결과, 워크플로우 `duplicate` 엔드포인트
   자체를 다루는 문서는 target 의 plan(`workflow-duplicate-nodes-edges.md`) 뿐이다. 나머지 히트
   (`webchat-usewidget-extraction.md`, `migration-tooling-evaluation.md`,
   `spec-update-node-cancellation-shutdown-classification.md`, `ie-resume-turn-boundary-cancel.md`,
   `rag-quality-improvement.md`, `node-cancellation-residual-signal-propagation.md`,
   `pnpm-migration-followups.md`, `harness-env-value-subpattern-dedup.md`,
   `node-output-redesign/{text-classifier,database-query}.md`)는 전부 "코드 중복"·"라벨 중복"·
   "SQL 필터 복제" 등 무관한 의미의 동음이의 매치였다.
2. **선행 plan 미해소 없음** — target 이 재사용하는 기존 패턴(`importWorkflow()` 의 UUID
   사전발급→참조재매핑→배치insert, `container_id`/`tool_owner_id` 재매핑, `executions.service.ts`
   의 `REPEATABLE READ` 선례)을 동시에 바꾸는 다른 in-progress plan 없음. `workflow_version`/
   `trigger`/`workflow_test_dataset` 비승계 결정과 충돌하는 plan 도 없음(전수 확인 유지).
3. **후속 항목 누락 없음** —
   - `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` 는 이번 diff 로
     `workflow-duplicate-nodes-edges.md` 가 추가됐고, 기존 `marketplace-and-plugin-sdk.md` 항목은
     같은 파일의 **다른 절**(§2.7 빈 상태 마켓 추천 링크, target 이 건드리는 §2.6 복제 행과 무관)을
     근거로 하므로 두 항목이 공존해도 저촉이 아니다 — 실제로 두 plan 이 정확히 이렇게 나란히
     등재돼 있음을 diff 로 확인.
   - `node-output-redesign/README.md` 의 "Workflow(Sub-Workflow)" 행이 `spec/data-flow/11-workflow.md`
     를 잘못 링크(실제 내용은 `spec/4-nodes/2-flow/1-workflow.md`)하는 pre-existing mislink 는
     이전 라운드에서 이미 target 과 무관한 사전 결함으로 판정됐고, 이번 구현 단계에서도 그 파일이
     손대지지 않아(변경 이력에 없음) 상태 변화가 없다 — 재차 등급 부여 안 함(target 이 만들거나
     악화시키지 않음).
   - `spec/3-workflow-editor/3-execution.md:753` (R-2.2, test-dataset clone 이 workflows duplicate
     를 "복제 후 자기 소유" 패턴 선례로 인용)는 직접 열어 재확인 — 소유권 패턴만 인용하고 노드
     내용 복사를 진술하지 않아 이번 정정과 충돌하지 않는다(plan §1.4 의 "역할 한정" 서술 그대로).

부차 관찰(등급 미부여 — 참고용):

- `/ai-review` RESOLUTION(`review/code/2026/07/30/17_54_27/RESOLUTION.md`)이 INFO 10건을
  "요청 범위 밖" 으로 명시적으로 보류했다(`findById` TOCTOU, 메타-트랜잭션 밖 타이밍, naming
  drift 등). 전부 리뷰어 자신이 "필수 아님"으로 표기한 항목이고 plan 체크리스트가 RESOLUTION.md
  를 포인터로 정확히 인용하고 있어 유실 위험은 낮다. 다만 본 plan 이 조만간 `plan/complete/`
  로 이동하면 이 보류 항목들을 찾을 수 있는 유일한 경로가 gitignore 되지 않은 `review/code/**`
  뿐이라는 점은 인지해 둘 만하다 — 별도 plan 파일화가 필수는 아니나(전부 INFO, "다른 plan 의
  후속 항목"에 해당하지 않음), 추적 메모 수준의 참고 사항으로 남긴다.

## 요약

target(`spec/data-flow/11-workflow.md` · `spec/2-navigation/1-workflow-list.md` 의 workflow
duplicate 계약 정정)은 `plan/in-progress/workflow-duplicate-nodes-edges.md` 의 TO-BE 를 그대로
구현한 결과물이며, 동일 plan 에 대한 선행 두 라운드(`--spec`, `--impl-prep`)가 이미 32개
in-progress plan 전체를 대상으로 Plan Coherence NONE 을 확정했다. impl-done 단계에서는 spec
파일 추가 변경이 없었고(코드/테스트/리뷰 조치만 진행), 이번 라운드의 재대조에서도 미해결
결정과의 충돌, 선행 plan 미해소, 다른 plan 의 후속 항목 누락 중 어느 것도 발견되지 않았다.
plan 체크리스트는 실제 상태(스펙·구현·리뷰 완료 항목만 체크, 라이프사이클 잔여 2건만 미체크)와
정확히 일치한다. Plan 정합성 관점에서 이 변경을 막을 사유가 없다.

## 위험도

NONE
