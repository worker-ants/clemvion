# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/ai-agent-formdata-size-limit.md`  
검토 일시: 2026-05-24  
검토 모드: plan draft 검토 (--plan)

---

## 발견사항

### [WARNING] developer 가 `spec/` 를 직접 갱신 — 규칙 예외 근거 없음

- **target 위치**: `plan/in-progress/ai-agent-formdata-size-limit.md` §"Spec (spec/) — 작은 보강" 절, "본 변경은 §12.6 의 직접 후속이라 dev skill 안에서 직접 갱신 (CLAUDE.md spec read-only 룰의 작은 보강 예외)" 문장
- **관련 plan/규약**: `.claude/skills/developer/SKILL.md` §쓰기 범위 표 — `spec/ | Read only — 수정 시 project-planner 위임. 갱신 제안은 plan/in-progress/spec-update-<name>.md`; `CLAUDE.md` Skill 체계 표 — developer 의 쓰기 권한 `codebase/**`, `plan/**` 에 `spec/**` 미포함
- **상세**: target plan 이 "변경 면적이 한 단락 이하" 임을 이유로 project-planner 위임 없이 developer 가 `spec/4-nodes/3-ai/1-ai-agent.md §12.6 / §12.7` 을 직접 갱신하겠다고 선언하고 있다. 그러나 developer SKILL.md 및 CLAUDE.md 어디에도 "단락 이하 보강" 예외 조항이 존재하지 않는다. `ai-agent-formdata-size-limit.md` 는 신규 spec 절 (§12.7) 신설 또는 §12.6 본문 추가를 포함하는 변경으로, 이는 `project-planner` 위임 요건에 해당한다.
- **제안**: plan 의 진행 체크리스트 step 2 ("spec 보강") 를 `project-planner` 위임 항목으로 명시 변경하거나, spec 변경을 별도 `plan/in-progress/spec-update-ai-agent-formdata-cap.md` 로 분리하여 project-planner 가 선행 처리 후 developer 단계가 이를 따르도록 재구성 권장.

---

### [INFO] `multiturn-error-preserve.md` 가 동일 파일(`spec/4-nodes/3-ai/1-ai-agent.md`) 변경 예정 — worktree 미생성, branch 미존재

- **target 위치**: `plan/in-progress/ai-agent-formdata-size-limit.md` §"Spec (spec/) — 작은 보강" 절
- **관련 plan**: `plan/in-progress/multiturn-error-preserve.md` — `spec/4-nodes/3-ai/1-ai-agent.md §7.4, §7.9, §7 서두, §10` 에 `_retryState`, `retryable` 분류 열 등 복수 절 갱신 예정
- **상세**: `multiturn-error-preserve` 는 동일 spec 파일의 여러 절을 갱신하는 plan 이다. 현재 해당 plan 의 worktree (`multiturn-error-preserve`) 는 디렉토리도 branch 도 존재하지 않아 실제 작업이 개시된 상태가 아니다. target plan 의 spec 변경 범위 (§12.6 후속 또는 §12.7 신설) 는 `multiturn-error-preserve` 의 변경 절 (§7계열 / §10) 과 직접 겹치지 않아 텍스트 충돌 위험은 낮다. 그러나 두 plan 이 모두 동일 파일을 건드릴 경우, 먼저 머지되는 plan 이 이후 plan 의 diff context 를 변경할 수 있다. plan 진행 전 `multiturn-error-preserve` 작업 개시 여부를 확인 후 협력 필요.
- **제안**: target plan 의 spec 단계에서 `multiturn-error-preserve` 의 worktree 개시 여부 및 동일 파일 변경 진행 상황을 확인 후 진입 (충돌 방지 위한 직렬화 권고). 현재 active 가 아니므로 CRITICAL 이 아닌 INFO 로 처리.

---

### [INFO] `ai-agent-tool-connection-rewrite.md` 의 미해결 결정과의 잠재 연관성 — 직접 충돌 없음

- **target 위치**: `plan/in-progress/ai-agent-formdata-size-limit.md` §"변경 범위" — `ai-agent.handler.ts` 의 `form_submitted` 분기
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 "디자인 결정 (사용자 합의 필요)" — 도구 등록 모델·도구 시그니처 위치·도구 결과 라우팅 모두 TBD
- **상세**: `ai-agent-tool-connection-rewrite` 는 `spec/4-nodes/3-ai/1-ai-agent.md §6.1 dispatcher 분류 순서 표` 등 handler 와 spec 의 도구 처리 로직에 걸친 대규모 재설계 plan 이다. target plan 은 `form_submitted` 분기의 크기 cap 이라는 국소 변경만 다루어 도구 연결 설계 결정과 직접 충돌하지 않는다. `render_form` 흐름은 `ai-agent-tool-connection-rewrite` 의 `tool_*` 재설계 scope 에 포함되지 않으므로 실질적 영향은 없다.
- **제안**: 추적 메모 수준. 별도 조치 불필요.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 분석 결과:

활성 worktree 4건 (`ai-agent-formdata-size-limit-2ad8ff`, `chat-channel-e2e-hardening-5ff799`, `chore-stale-plan-cleanup-c7e170`, `fix-secret-store-root-entities-6aa869`) 중 target plan 이 건드리는 파일(`ai-agent.handler.ts`, `ai-agent.handler.spec.ts`, `spec/4-nodes/3-ai/1-ai-agent.md`)과 교차하는 worktree 없음 → worktree 충돌 후보 0건. stale 판정 cascade 적용 대상 없음.

- (없음) — worktree 충돌 후보 식별 없음.

---

## 요약

target plan `ai-agent-formdata-size-limit.md` 는 PR #301 ai-review 보안 INFO 후속으로 `form_submitted` 의 formData 크기 cap 을 구현하는 소규모 hardening 작업이다. 코드 변경 범위 자체는 다른 in-progress plan 과 겹치지 않으며, 활성 worktree 간 파일 충돌도 없다. 주요 문제는 developer 가 `spec/4-nodes/3-ai/1-ai-agent.md` 를 직접 갱신하겠다는 계획인데, developer SKILL.md 및 CLAUDE.md 어디에도 "단락 이하 보강 예외" 조항이 없어 규칙 위반이다. spec 변경 단계는 project-planner 위임 또는 별도 spec-update plan 분리가 필요하다. worktree 충돌 후보 0건 — stale skip 대상 없음.

---

## 위험도

LOW
