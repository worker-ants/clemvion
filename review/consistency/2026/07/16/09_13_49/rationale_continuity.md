# Rationale 연속성 검토 결과

## 검토 범위

- scope: `spec/4-nodes/3-ai/`, diff-base: `origin/main` (impl-done)
- 실제 변경분(`git diff origin/main`)은 `spec/4-nodes/3-ai/1-ai-agent.md` 1개 파일 (frontmatter `pending_plans` 항목 1개 제거 + §10 "도구 정의 payload 예산 경고" 문단 "Planned/미구현" 표기 제거) — 스코프 밖이지만 같은 논리적 변경 세트인 `spec/conventions/cross-node-warning-rules.md` (`status: partial → implemented`, 동일 pending_plans 제거, 표 행에서 Planned 문구 제거)도 함께 대조했다.
- 대조 대상: `spec/4-nodes/3-ai/1-ai-agent.md §12.15`(도구 정의 payload 예산 도입 Rationale), `spec/conventions/spec-impl-evidence.md §3/§3.1 + Rationale R-5`(status 라이프사이클·`pending_plans` 역방향 링크 원칙), `plan/in-progress/ai-agent-tool-payload-budget-followups.md`(선행 plan 본문·체크리스트), 실제 코드(`tool-payload-save-warning.ts`, `workflows.service.ts`)

## 발견사항

- **[INFO]** `status: implemented` 승격이 "pending_plans가 `plan/complete/`로 이동한 커밋" 원칙과 문구상 어긋남
  - target 위치: `spec/conventions/cross-node-warning-rules.md` frontmatter (`status: partial → implemented`, `pending_plans` 항목 삭제) / `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter (`pending_plans`에서 `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 삭제)
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md §3.1` "`partial` → `implemented`: 마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격 (가드)" 및 `## Rationale` R-5("spec 이 자기를 책임지는 plan 을 가리킴" — 역방향 링크로 "책임지는 plan 없는 빈 약속"의 영구 누락을 막기 위한 설계 원칙)
  - 상세: 이번 diff는 두 spec 문서에서 `pending_plans: - plan/in-progress/ai-agent-tool-payload-budget-followups.md` 항목을 물리적으로 지웠지만, 그 plan 파일 자체는 여전히 `plan/in-progress/`에 남아 있고 (`plan/complete/`로 이동하지 않음) 체크리스트도 "9.4 `/consistency-check --impl-done`", "PR (항목 A 단독)" 두 스텝이 미완이며, 별도로 "항목 B (resume 턴 timeoutMs+signal)"가 완전히 미착수 상태로 남아 있다. §3.1 문구는 "pending_plans가 complete/로 이동한 커밋에서 승격"을 전제로 하는데, 실제로는 plan을 옮기지 않고 참조만 제거 + 즉시 승격한 형태라 절차 문구와 정확히 일치하지 않는다. 다만 (a) `pending_plans` 정리는 followups plan 자체의 체크리스트 항목 7("spec 마감: … 두 spec pending_plans 정리")로 이미 명시적으로 계획된 작업이고, (b) cross-node-warning-rules.md 안에는 다른 Planned/미구현 잔여 표기가 없어 `implemented` 승격이 내용상 사실과 부합하며, (c) 남은 "항목 B"는 리소스 타임아웃 배선이라는 내부 구현 디테일로 두 spec 문서 어디에도 대응하는 미구현 약속이 없다(grep 결과 timeoutMs/abortSignal 관련 spec 텍스트 없음). 즉 "책임지는 plan 없는 빈 약속"이 실질적으로 재발하지는 않았다 — 절차 문구와의 자구적 불일치이며, 자동 가드(`spec-status-lifecycle.test.ts`)도 `implemented`/`archived` 상태는 idle이라 이를 잡지 않는다.
  - 제안: 문제 삼을 정도는 아니나, followups plan의 "항목 B"가 완료되어 plan을 `plan/complete/`로 옮길 때 두 spec 어느 쪽도 이 항목을 참조하지 않았음을 재확인(현재는 불필요해 보이지만 향후 항목 B가 spec 표면에 영향을 주게 되면 재등록 필요). 또는 이번처럼 plan 완료 전에 미리 pending_plans를 정리하는 패턴을 쓸 경우, §3.1 절차 문구에 "부분 완료된 plan의 특정 항목만 fulfil된 경우의 예외" 케이스를 짧게 추가해 두면 향후 동일 패턴에서 혼선을 줄일 수 있다.

## 검증 확인 사항 (참고, 발견사항 아님)

- 코드 대조 결과 §10 새 문구("connected cafe24/makeshop 정적 카탈로그 + presentation 도구만 집계, generic MCP·비-connected 통합은 best-effort skip")는 `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts`의 실제 로직과 정확히 일치 — "구현 완료" 주장은 사실에 부합한다.
- §12.15 Rationale("저장 시 payload 추정은 근사… hard block 을 기본으로 두면 정상 설정을 오차단할 위험")이 이번에 추가된 "generic MCP skip" 스코프 결정을 이미 사전에 포섭하고 있어, 별도 신규 Rationale 항목 없이도 근거가 끊기지 않는다 — 기각된 대안 재도입/무근거 번복 없음.
- `1-ai-agent.md`의 `pending_plans`에 남아있는 `ai-agent-tool-connection-rewrite.md`(별개 `tool_*` 재작성 트랙)는 이번 변경과 무관하게 그대로 유지돼 있어 §Tool Area 관련 미구현 표기와의 정합에는 영향 없음.

## 요약

diff 자체는 매우 작고(`1-ai-agent.md` 1곳 + 인접한 `cross-node-warning-rules.md`), 내용은 이미 §12.15에 근거가 마련된 "도구 정의 payload 예산 config-time 경고" 기능을 Planned→Implemented로 마킹하는 code-sync 성격의 변경이다. 실제 코드(`tool-payload-save-warning.ts`, `WorkflowsService.getGraphWarnings`/`saveCanvas`)와 대조한 결과 새 문구는 사실과 일치하며, 과거 Rationale(§12.15의 "근사치라 warn 기본", "backend-only async 평가")과 모순되지 않는다. 유일하게 짚을 점은 `pending_plans` 제거 및 `status: implemented` 승격이 `spec-impl-evidence.md §3.1`/Rationale R-5가 명시한 "plan이 `complete/`로 이동한 커밋에서 승격" 절차 문구와 자구적으로는 어긋난다는 것인데, 원인이 된 plan(`ai-agent-tool-payload-budget-followups.md`) 자체의 체크리스트에 이 정리 작업이 이미 계획돼 있고 남은 "항목 B"가 두 spec 문서 어디에도 대응하는 미구현 약속을 남기지 않아 실질적 피해(책임 plan 없는 빈 약속)는 없다. 기각된 대안의 재도입, 원칙의 실질적 위반, 무근거 결정 번복, invariant 우회는 발견되지 않았다.

## 위험도

LOW
