# Plan 정합성 검토 결과

## 발견사항

- **[INFO]** `WORKFLOW_FORBIDDEN_WORKSPACE` enum 등재를 "dev 후속(작업 1b)"으로 표기 — 기존 plan 에 이미 추적됨
  - target 위치: `spec-draft-c1-spec-drift.md` §비반영 "dev 후속(작업 1b)" + 변경 2·변경 3 의 "enum 등재 dev 후속" 주석
  - 관련 plan: `plan/in-progress/refactor/c1-engine-split.md` §후속 고려 `assertSameWorkspace` SPEC-DRIFT 후속 항목 — "impl-prep WARNING(에러 카탈로그): `WORKFLOW_FORBIDDEN_WORKSPACE`·`SUB_WORKFLOW_NOT_FOUND` 등 `error-codes.ts` enum(dev)" 미착수
  - 상세: target 이 enum 미등재 사실을 "현재 상태" 로 정확히 기술하고 enum 등재를 "별도 소 PR(developer)" 후속으로 남긴 것은 부모 plan 의 기술과 일치한다. 추적이 두 곳(target draft + 부모 plan)에 분산돼 있지만 미해결 결정이 아닌 단순 후속 작업이므로 CRITICAL·WARNING 에 해당하지 않는다.
  - 제안: target 적용 후, 부모 plan(`c1-engine-split.md`)의 해당 SPEC-DRIFT 후속 항목에 "spec 반영 완료(본 draft)" 표기를 추가하면 추적 단절을 방지할 수 있다.

- **[INFO]** `node-output-redesign/workflow.md` 의 미결 output 개선안(async `output.workflowId`·`output.status` 제거)과 target 변경 2(W-6 callout 갱신)의 직접 충돌 없음 — 단, 연관성 문서화 부재
  - target 위치: 변경 2 — `spec/4-nodes/2-flow/1-workflow.md §2 W-6` callout 갱신
  - 관련 plan: `plan/in-progress/node-output-redesign/workflow.md` — §5.2 async `output.workflowId`·`output.status` 제거 미착수 항목
  - 상세: target 은 W-6 진입점 명시와 fail-closed 행동만 갱신하며 §5 output shape 에는 손대지 않는다. `node-output-redesign` 의 미결 개선안(async output shape 정리)과 편집 위치가 다르므로 직접 충돌은 없다. 그러나 target 이 W-6 callout 에 진입점 3종(executeInline/executeSync/executeAsync)을 명시함으로써 node-output-redesign 착수 시 해당 섹션에 touch 가 필요해지는 점이 plan 에 언급되지 않는다.
  - 제안: 정합성 문제가 아닌 추적 편의 이슈다. target 적용 후 `node-output-redesign/workflow.md` 에 "W-6 callout 은 spec-drift-c1-spec-drift draft 에서 갱신됨(fail-closed + 진입점 명시), §5 output shape 작업 시 해당 섹션 재확인 필요" 1줄 메모를 추가할 것을 권장한다.

- **[INFO]** `spec-fix-prod-guards-prose.md` W5(`spec/5-system/3-error-handling.md §1.2` `TOKEN_INVALID` 보강)가 미착수 상태에서 target 변경 3이 동일 파일 §1.4·§3.2를 편집
  - target 위치: 변경 3 — `spec/5-system/3-error-handling.md §1.4/§3.2` Sub-workflow 에러코드 4종 확장
  - 관련 plan: `plan/in-progress/spec-fix-prod-guards-prose.md` W5 항 — `spec/5-system/3-error-handling.md §1.2` `TOKEN_INVALID` reuse 탐지 케이스 추가
  - 상세: target 은 §1.4·§3.2(Sub-workflow 행)를 편집하고, `spec-fix-prod-guards-prose.md` W5 는 §1.2(`TOKEN_INVALID` 행)를 편집한다. 두 변경의 편집 위치가 동일 파일 내 다른 섹션이므로 의미 충돌은 없다. 단, `spec-fix-prod-guards-prose.md` frontmatter 가 `worktree: (stale — prod-fail-closed-guards 제거됨; 본 W5/W8/W9/W10+SPEC-DRIFT 미착수)` 로 표기돼 해당 draft 가 언제 적용될지 불투명하다. 본 target 이 동일 파일에 먼저 반영된다면 후속 merge 시 context 를 고려해야 한다.
  - 제안: 위험도가 INFO 수준이다. target 적용 PR 본문에 "3-error-handling.md W5(TOKEN_INVALID) 미적용 draft 잔존" 를 언급하면 충분하다.

- **[INFO]** `ai-agent-tool-connection-rewrite.md` §3 Spec 작성 항에 "dispatcher 분류 순서 표 갱신 필요" 가 미결인데 target 변경 4가 `spec/4-nodes/3-ai/1-ai-agent.md §10` 을 편집
  - target 위치: 변경 4 — `spec/4-nodes/3-ai/1-ai-agent.md §10` L1099 분류 산문 갱신
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 — "dispatcher 분류 순서 표(`cond_* → kb_* → mcp_* → render_* → tool_*`) 를 갱신해야 한다" (미결, 도구 등록 모델 TBD)
  - 상세: target 이 편집하는 §10 L1099 는 LLM 에러 분류 산문이며, `ai-agent-tool-connection-rewrite.md` 가 갱신 예정인 §6.1 dispatcher 분류 순서 표와는 별개 섹션이다. 미해결 결정(도구 등록 모델 TBD)에 영향을 주는 편집이 아니므로 CRITICAL 에 해당하지 않는다.
  - 제안: 충돌 없음. 별도 조치 불요.

## 요약

target(`spec-draft-c1-spec-drift.md`)은 C-1 분할·review-파생 후속(①~⑤★)이 이미 머지된 코드에 맞춰 spec 을 소급 갱신하는 비차단 SPEC-DRIFT draft 다. 검토 대상 plan 전체를 살펴보면, target 이 일방적으로 우회하는 "결정 필요" 미해결 항목은 없다. 선행 조건(부모 plan `c1-engine-split.md` 의 후속 ①~④★ 완료 + 코드 정합 입증)도 해당 plan 에서 전부 완료 표기로 확인된다. 후속 항목 측면에서는 enum 등재 dev 후속·`node-output-redesign` §5.2 output 개선·`spec-fix-prod-guards-prose.md` W5 등이 아직 in-progress 에 잔존하나 target 편집 위치와 직접 충돌하지 않으며 "후속 미완료" 사실도 target 자체에 명시돼 있다. 전체적으로 미해결 결정 우회·선행 plan 미해소·후속 항목 무효화에 해당하는 발견사항이 없다.

## 위험도

NONE
