# Plan 정합성 검토 — EIA getStatus() 2단계 컬럼 projection

모드: `--impl-done` (구현 완료 후 사후 검토)
대상 plan: `plan/in-progress/eia-getstatus-column-projection.md`
diff: `origin/main...HEAD` (3 commits: `0e80bd4a1` 구현, `629f628e6` TEST WORKFLOW 기록, `f2764f3a9` ai-review Warning 4건 반영)

## 발견사항

- **[WARNING]** `spec-sync-external-interaction-api-gaps.md` line 17 인용 line-range 가 두 번째로 stale 화됨 (ai-review fix 커밋이 라인을 다시 밀었는데 인용을 재정정하지 않음)
  - target 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:17`, `[x] GET /api/external/executions/:id 의 currentNode / context 실값` 항목 — 현재 텍스트 `interaction.service.ts:276-351`
  - 관련 plan: `plan/in-progress/eia-getstatus-column-projection.md` 체크리스트 항목 4(DOCUMENTATION, "W3 인용 정정")·9a(REVIEW WORKFLOW)
  - 상세: 커밋 `0e80bd4a1`(최초 구현) 시점에는 `276-351`이 정확했다 — 그 커밋의 파일 스냅샷을 직접 확인한 결과 276행이 `if (execution.status === ExecutionStatus.WAITING_FOR_INPUT) {`, 351행이 그 if-block 을 닫는 `}` 로 정확히 일치했다. 그런데 이어진 ai-review Warning 반영 커밋 `f2764f3a9`(W-2: `STATUS_PROJECTION_COLUMNS` 모듈 상수 + JSDoc 신설, 그 외 주석 보강)가 `getStatus()` 앞뒤로 약 12줄을 추가하면서 같은 블록이 현재는 **288-364**로 밀렸다(직접 `codebase/backend/src/modules/external-interaction/interaction.service.ts:288-364` 확인 — 288행 `if (execution.status === ExecutionStatus.WAITING_FOR_INPUT) {`, 364행이 닫는 `}`). `spec-sync-external-interaction-api-gaps.md` 는 이 두 번째 이동을 반영하지 못한 채 여전히 `276-351`을 인용한다. 이 정확한 회귀는 impl-prep 단계 `plan_coherence.md`(`review/consistency/2026/07/10/22_25_21/plan_coherence.md`)가 이미 한 차례 지적했던 것과 **동일한 클래스의 문제**이고, W3 로 한 번 고쳐졌지만 후속 커밋에서 재발했다. 실질 주장("waiting_for_input 상태에서 currentNode/context 를 SSE 와 동일 형식으로 복원")은 여전히 참이라 결정 우회는 아니지만, line-range 인용 자체는 현재 틀렸다.
  - 제안: 본 PR 안에서(9b 검토 결과 반영 차원) `spec-sync-external-interaction-api-gaps.md:17` 의 `interaction.service.ts:276-351` 을 `interaction.service.ts:288-364` 로 재정정할 것. 향후 유사 재발을 막으려면 line-range 대신 함수/블록 anchor("`getStatus()` 의 `WAITING_FOR_INPUT` 분기" 등) 식별을 병기하는 편이 라인 드리프트에 강건하다.

- **[INFO]** `eia-getstatus-column-projection.md` 체크리스트는 실제 상태를 정확히 반영
  - target 위치: `plan/in-progress/eia-getstatus-column-projection.md` 체크리스트 (항목 0~9a `[x]`, 9b/9c `[ ]`)
  - 상세: git log 상 3커밋(`0e80bd4a1` 구현+테스트 선작성/보강, `629f628e6` TEST WORKFLOW 기록, `f2764f3a9` ai-review Warning 4건+INFO 3건 반영)이 항목 5~9a 의 서술과 정확히 대응한다. e2e 로그 `_test_logs/e2e-20260710-231316.log`(43 suite·249 test, 파일 존재 확인) 및 `/ai-review` 산출물 `review/code/2026/07/10/22_47_32/{SUMMARY,RESOLUTION}.md`(존재 확인, Critical 0/Warning 4 전량 fix) 가 항목 8·9a 의 근거와 일치한다. 9b(본 검토)·9c(fresh `/ai-review`)는 아직 미수행이라 `[ ]` 로 남아있는 것이 맞다 — 과대/과소 표시 없음.
  - 제안: 없음 (확인용 기록). 9b 는 본 리뷰로 충족되므로, 본 리뷰 산출물 경로를 반영해 plan 체크박스를 `[x]` 로 갱신하고 9c(fresh ai-review)를 진행할 것.

- **[INFO]** `complete/` 이동 시점 아님 — 잔여 체크박스 존재
  - target 위치: `plan/in-progress/eia-getstatus-column-projection.md` 항목 9b/9c
  - 상세: 9b(본 검토)·9c(fresh `/ai-review`, resolution 커밋 `f2764f3a9` 이후 원 리뷰가 stale)가 아직 `[ ]`. `.claude/docs/plan-lifecycle.md` 관례상 전 체크박스 완료 전 `complete/` 이동은 부적절.
  - 제안: 9b 완료 표시 + 9c(fresh `/ai-review --branch origin/main` 권장, `feedback_ai_review_diff_base_after_commit.md` 참고) 수행 후 이동.

- **[INFO]** `pending_plans:` 등재 불필요 확인 (재검증)
  - target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter (`status: partial`, `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]`)
  - 상세: `spec/conventions/spec-impl-evidence.md` §2.1/§3 기준 `pending_plans:` 는 **status: partial spec 의 미구현 surface** 를 추적하는 plan 만 등재 대상이다. 본 PR 은 wire 계약·spec §5.3/§R17 텍스트 무변경(순수 내부 DB 조회 최적화)이라 spec 이 새로 약속하거나 유예하는 surface 가 없다 — `eia-getstatus-column-projection.md` 를 `pending_plans` 에 추가할 필요 없음. impl-prep 단계 판단(동일 결론)과 일치.
  - 제안: 없음.

- **[INFO]** 다른 in-progress plan 과 표면 충돌 없음
  - target 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()`
  - 상세: `plan/in-progress/` 전체를 `interaction.service|getStatus|conversation_thread|conversationThread` 로 재검색한 결과 `node-output-redesign/{ai-agent,form,information-extractor}.md` 가 매치되나, 이들은 전부 `form-interaction.service.ts`/`button-interaction.service.ts`/`ai-turn-orchestrator.service.ts` 의 멀티턴 `resumed` status emit 논의로 대상 파일·메서드와 무관. `trigger-param-output-enricher.md` 의 "projection" 매치도 워크플로우 output 스키마 projection(무관 도메인)이며 DB 컬럼 projection 이 아니다. 충돌 없음 — impl-prep 판단과 일치.
  - 제안: 없음.

## 요약

체크리스트는 실제 수행 이력(3 커밋 + e2e 로그 + ai-review 산출물)과 정확히 대응하며 9b/9c 를 미완으로 남긴 것도 정확하다 — 아직 `complete/` 이동 대상이 아니다. `pending_plans` 등재도 불필요함이 재확인됐고, 다른 in-progress plan 과의 표면 충돌도 없다. 유일한 실질 이슈는 `spec-sync-external-interaction-api-gaps.md:17` 의 `interaction.service.ts` line-range 인용으로, impl-prep 단계에서 이미 한 차례 지적되어 최초 구현 커밋(`0e80bd4a1`)에서 `276-351`로 정정됐으나 그 뒤 ai-review Warning 반영 커밋(`f2764f3a9`)이 12줄가량 코드를 더 추가하면서 실제 위치가 `288-364`로 다시 밀렸고 인용은 갱신되지 않았다. 결정 우회나 spec 계약 위반은 아니며(실질 주장은 여전히 참), 추적성 정확도 문제이므로 WARNING 으로 등급을 매긴다.

## 위험도

LOW

STATUS: OK
