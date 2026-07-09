# Plan 정합성 검토 결과

> 검토 모드: --impl-done, scope=spec/5-system/, diff-base=origin/main
> 실제 target diff (payload 에 누락돼 있던 부분을 직접 확인): `spec/5-system/5-expression-language.md` §7.2
> 대응 governing plan: `plan/in-progress/trigger-param-output-enricher.md` (Manual Trigger `output.parameters` 자동완성 enricher 추가)

> **참고**: 본 세션에 전달된 `prompt_file` 의 "Target 문서" 섹션은 `spec/5-system/1-auth.md`·`10-graph-rag.md`·`_product-overview.md` 등을 포함하지만, 실제로 diff 가 발생한 `spec/5-system/5-expression-language.md` 본문은 누락돼 있었다 (orchestrator payload 조립 문제로 추정). 마찬가지로 "진행 중 plan 문서 모음"에는 `ai-agent-tool-connection-rewrite.md`·`cafe24-backlog-residual.md`·`chat-channel-discord-gateway.md`·`chat-channel-slack-socket-mode.md`·`chat-channel-visual-ssr-png.md` 5건만 포함돼 있었으나, 이 5건은 모두 expression-language/manual-trigger 와 무관함을 직접 확인했다(무관 — grep 0 hit). 대신 실제로 관련성이 높은 `plan/in-progress/manual-trigger-default-param.md`, `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md`, `plan/in-progress/node-output-redesign/{README,manual-trigger}.md` 는 payload 밖에 있어 워크트리에서 직접 Read 해 검토했다.

## 발견사항

- **[WARNING]** `node-output-redesign/manual-trigger.md` 의 미해결 frontend 체크박스가 이번 target 변경으로 부분 해소됐는데 반영이 안 됨
  - target 위치: `spec/5-system/5-expression-language.md` §7.2 enricher 표 — `manual_trigger` 행 신규 추가 (`config.parameters[].name → output.parameters.<name>`), 구현은 `codebase/frontend/.../node-output-schema-enrichers.ts` `enrichManualTriggerOutputSchema` + `use-expression-context.ts` 2개 호출부.
  - 관련 plan:
    - `plan/in-progress/node-output-redesign/manual-trigger.md` §"종합 개선안 (2026-05-16)" 마지막 미해결 항목(line 140): *"(frontend) 노드 spec §5 의 expression 접근 예 (`$node["Manual Trigger"].output.parameters.orderId` / `$params.orderId` / `$input.parameters.orderId`) 가 frontend expression autocomplete 에 모두 등록되어 있는지 확인 … *(2026-06-25 미해결: frontend 에 `$params`/`output.parameters` 전용 autocomplete 레지스트리 근거 미확인 — 확인 항목 잔여.)*"*
    - `plan/in-progress/node-output-redesign/README.md` "Phase F — frontend 동반" — "주요 대상: workflow/manual-trigger/merge/background" 로 manual-trigger 를 미해결 frontend 항목으로 명시.
  - 상세: 이번 target 변경으로 `$node["Manual Trigger"].output.parameters.<name>` 와 (직속 successor 의) `$input.parameters.<name>` 자동완성이 실제로 구현됐다 — 위 미해결 항목의 앞 두 갈래(`$node[...].output.parameters`, `$input.parameters`)를 충족한다. 그러나 같은 항목이 함께 요구한 세 번째 갈래 `$params.orderId` (root shortcut) 는 여전히 미구현이다 — 직접 확인 결과 `use-expression-context.ts` 어디에도 `$params` 루트 변수 등록이 없고, `trigger-param-output-enricher.md` 자신도 "`$params` 루트 변수의 하위키 자동완성은 별개 관심사로 본 enricher 영향권 밖" 이라고 명시적으로 scope 밖에 둔다 (ai-review W1 정정 반영). 즉 node-output-redesign 쪽 미해결 체크박스는 **부분 해소**된 상태인데, 그 문서에는 이 사실도, `$params` 만 남은 잔여 범위도 반영돼 있지 않다 — 다음 6·7차 정기 재검증(2026-06-25 패턴의 갱신 사이클) 때 "완전 미해결"로 재조사되거나, 반대로 "이미 다 됐다"고 오판될 위험이 있다.
  - 제안: `node-output-redesign/manual-trigger.md` 의 해당 체크박스를 "`$node[...].output.parameters` / `$input.parameters` 자동완성 — ✅ 해소 (trigger-param-output-enricher, spec/5-system/5-expression-language.md §7.2)" 로 갱신하고, `$params.<name>` root shortcut 은 별도 잔여 항목으로 재기술(README 의 "이름 중복 리네이밍은 호환성 영향이 커 별도 트랙" 문구와 일관되게). 또는 최소한 `trigger-param-output-enricher.md` 의 "비고"에 이 cross-link 를 남겨 다음 grooming 이 두 plan 을 대조하지 않아도 되게 한다.

- **[INFO]** `trigger-param-output-enricher.md` 의 인라인 후속 항목(0-common.md §3)이 별도 plan 파일로 분리되지 않음
  - target 위치: `plan/in-progress/trigger-param-output-enricher.md` "## 후속 (spec 문서, 비차단 — project-planner)" 섹션 — `spec/4-nodes/7-trigger/0-common.md §3` 의 `output: $params` 축약 표기를 `output.parameters: $params` 로 명확화하라는 항목.
  - 관련 plan: 없음(신규 파일 미생성) — 참고로 형제 사례인 `plan/in-progress/manual-trigger-default-param.md` 는 동일 패턴의 spec-only 후속을 `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` 라는 별도 project-planner 소유 plan 파일로 분리해 추적한다.
  - 상세: `.claude/docs/plan-lifecycle.md` §2 는 "미해결 follow-up 항목이 하나라도 있으면 in-progress/" 로 분류한다고 명시한다. 현재 이 항목은 체크박스 없이 산문으로만 존재해 plan-stale-audit 등 체크박스 기반 진행률 집계에 잡히지 않을 수 있고, 본 plan 이 완료 이동될 때 이 항목이 누락되기 쉽다. (단, 본 plan 자체도 아직 TEST WORKFLOW 최종 e2e·`--impl-done` 항목이 `[ ]` 로 남아 있어 지금 당장 `complete/` 이동 대상은 아니다.)
  - 제안: 완료 이동 전에 이 항목을 형제 사례처럼 별도 `plan/in-progress/spec-update-manual-trigger-output-params-notation.md`(가칭) 로 분리해 owner: project-planner 로 넘기거나, 최소한 체크박스(`- [ ]`) 형태로 전환해 lifecycle 추적에 걸리게 한다.

## 요약

target 변경(`spec/5-system/5-expression-language.md` §7.2 의 `manual_trigger` enricher 행 추가) 자체는 프론트엔드 전용 UX 힌트로 런타임·API 계약을 건드리지 않으며, 전제 조건(Manual Trigger 파라미터 default/조회 버그 수정, PR #868)은 이미 `origin/main` 에 병합돼 있어 선행 plan 미해소 문제는 없다. `plan/in-progress` 30여 건 중 관련 있는 것은 `manual-trigger-default-param.md`(선행조건 충족, 문제 없음)·`spec-update-manual-trigger-save-time-error-code.md`(무관 영역, 문제 없음)·`node-output-redesign/manual-trigger.md`(부분 해소 미반영, WARNING) 세 건이며, orchestrator 가 준 payload 의 plan 목록(5건)은 실제로는 모두 무관했다. CRITICAL 급 미해결 결정 충돌은 발견되지 않았고, node-output-redesign 쪽 문서 갱신 누락 1건과 자체 후속 항목의 lifecycle 분리 누락 1건만 정리하면 된다.

## 위험도

LOW
