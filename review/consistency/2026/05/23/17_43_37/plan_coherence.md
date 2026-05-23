# Plan 정합성 검토 결과

> 검토 모드: 구현 착수 전 검토 (`--impl-prep`, scope=`spec/4-nodes/`)
> Target worktree: `render-form-submit-fix-3f10bf`
> Target plan: `plan/in-progress/render-form-submit-fix.md`
> 검토 일시: 2026-05-23

---

## 발견사항

### 1. **[WARNING]** `ai-presentation-tools` plan 의 `spec/4-nodes/6-presentation/0-common.md` 동시 수정 경합

- **target 위치**: `plan/in-progress/render-form-submit-fix.md` §변경 범위 (S) — `spec/4-nodes/6-presentation/0-common.md` §10.6/7/9 신설 + Rationale 추가
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` §4.1 Spec 작성 — `spec/4-nodes/6-presentation/0-common.md` 에 "AI tool 모드" 섹션 신설 (`[x]` 완료 마킹)
- **상세**: `ai-presentation-tools` plan 이 `spec/4-nodes/6-presentation/0-common.md` 에 이미 "AI tool 모드" 섹션을 추가했다고 체크박스가 표시되어 있다 (`[x]`). render-form-submit-fix plan 역시 동일 파일의 §10.6/7/9(또는 신규 번호)에 form submission wire format 명문화를 기록한다. `ai-presentation-tools` worktree(`ai-presentation-tools-9b7c5c`) 는 현재 `.claude/worktrees/` 디렉토리에 실체가 없어 이미 merge 되었거나 정리된 상태이나, `ai-presentation-tools.md` plan 자체는 `in-progress` 에 남아 있고 백엔드·프론트엔드 구현 항목이 미완료(`[ ]`) 상태다. 해당 plan 의 spec 작성 완료분과 현 target plan 의 spec 변경이 같은 파일에 겹친다.
- **제안**: target plan 착수 전 `spec/4-nodes/6-presentation/0-common.md` 의 현재 상태(main 기준)를 확인하여 `ai-presentation-tools` 의 "AI tool 모드" 섹션이 실제로 merge 되어 있는지 점검한다. 해당 섹션이 이미 존재하면 target plan 의 §10.x 번호를 충돌 없이 배정해야 한다. worktree 충돌보다는 문서 섹션 번호 충돌 위험이다.

---

### 2. **[WARNING]** `ai-presentation-tools` plan 의 미해결 결정 — `render_form` blocking 흐름 / `pendingFormToolCall` spec

- **target 위치**: `plan/in-progress/render-form-submit-fix.md` §변경 범위 (S) ai-agent.md 항목 — `state.pendingFormToolCall` 누락 시 fallback 규약 spec 화. 동 (C) 항목 — `pendingFormToolCall` 미존재 시 warn log + fallback 동작 유지.
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` §2 결정사항 #13 — "`_resumeState.pendingFormToolCall` 필드" 를 ai-agent §7.4 에 추가 (`[x]` 완료). §4.1 — `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 step 2 / §7.4 갱신 (`[x]` 완료).
- **상세**: `ai-presentation-tools` plan 이 `pendingFormToolCall` 을 이미 spec 에 반영했다고 표시되어 있다. render-form-submit-fix plan 의 (S) 항목은 "누락 시 fallback 규약" 을 추가로 spec 화하겠다고 한다. 이것은 `ai-presentation-tools` 가 이미 결정한 사항(#13)의 후속 보강이므로 직접 충돌은 아니다. 다만 `ai-presentation-tools` 가 §6.2 step 2 를 갱신한 내용과 render-form-submit-fix 가 같은 항목을 다시 수정하면 merge 시 conflict 가능성이 있다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 와 §7.4 의 현재 main 기준 내용을 확인한 뒤, render-form-submit-fix 의 spec 변경이 이를 override 하지 않고 보강(append) 만 하는 형태인지 확인한다. `ai-presentation-tools` 구현이 아직 미완료이므로 동일 파일의 중복 편집을 최소화하도록 scope 를 한정한다.

---

### 3. **[WARNING]** `spec/4-nodes/6-presentation/4-form.md` — `node-output-redesign` plan 잔여 미완 항목

- **target 위치**: `plan/in-progress/render-form-submit-fix.md` §변경 범위 (S) — `spec/4-nodes/6-presentation/0-common.md` 변경. 직접 `4-form.md` 는 변경하지 않는 것으로 보이나, render-form-submit-fix 의 변경이 form submission 흐름 전반을 재정의한다.
- **관련 plan**: `plan/in-progress/node-output-redesign/form.md` 종합 개선안 — `(spec) §1 allowedMimeTypes 기본 목록 적용 시점 명시`, `(impl) rawConfig ↔ config 분리 검증 unit 테스트 추가`, `(impl) file 타입 필드 size/mime/count 검증 시점 책임 경계 명시`. 이 항목들은 아직 체크박스 미완료(`[ ]`) 상태다.
- **상세**: `node-output-redesign` plan 의 form.md 잔여 (spec) 항목은 `spec/4-nodes/6-presentation/4-form.md` §1 의 `allowedMimeTypes` 적용 시점을 명시하는 것을 포함한다. render-form-submit-fix 가 `spec/4-nodes/6-presentation/0-common.md` 에 form submission wire format 을 추가하면, `4-form.md` 자체를 건드리지 않더라도 form 관련 spec 의 "단일 진실" 위치가 분산될 수 있다. 또한 `node-output-redesign` plan 의 `(impl)` 항목이 나중에 동일 backend 파일(execution-engine.service.ts, form.handler.ts)을 수정할 때, render-form-submit-fix 의 dispatch/continueExecution 변경과 충돌 가능성이 있다.
- **제안**: render-form-submit-fix 의 spec 보강이 `4-form.md` 를 직접 수정하지 않는다면 충돌 범위는 제한적이다. 단 `node-output-redesign` form.md 의 `(impl)` 항목이 execution-engine 계층을 향후 수정할 것이므로, render-form-submit-fix 의 `continueExecution` 변경에 주석(cross-ref)을 남겨두어 `node-output-redesign` 처리 시 인지할 수 있도록 한다.

---

### 4. **[WARNING]** `spec-drift-ws-button-config` plan 의 미해결 결정 — WS Protocol `buttonConfig.timeout` / `nodeOutput.type` — `spec/5-system/6-websocket-protocol.md` 동시 수정

- **target 위치**: `plan/in-progress/render-form-submit-fix.md` §변경 범위 (S) — `spec/5-system/6-websocket-protocol.md` (해당 시) `execution.submit_form` payload shape 명문화.
- **관련 plan**: `plan/in-progress/spec-drift-ws-button-config.md` — `spec/5-system/6-websocket-protocol.md §4.4` 의 `buttonConfig.timeout`/`timeoutAction` 제거 및 `nodeOutput.type` 판별자 제거. 처리 우선순위 MEDIUM, `worktree: pending-assignment`.
- **상세**: render-form-submit-fix 가 `spec/5-system/6-websocket-protocol.md` 를 수정할 경우(`"해당 시"` 조건부), spec-drift-ws-button-config plan 이 같은 파일 §4.4 를 수정하는 항목과 겹친다. `spec-drift-ws-button-config` 는 아직 worktree 가 배정되지 않아 동시 worktree 경합은 없으나, render-form-submit-fix 가 `spec/5-system/6-websocket-protocol.md` 를 먼저 편집하면 spec-drift-ws-button-config 가 해결할 `buttonConfig.timeout` / `nodeOutput.type` 충돌 영역과 merge conflict 가능성이 생긴다.
- **제안**: render-form-submit-fix 의 `spec/5-system/6-websocket-protocol.md` 변경 시 §4.4 의 `submission` 관련 payload 만 수정하고, `buttonConfig` / `interactionType` 열거 부분은 건드리지 않는다. 변경 후 `spec-drift-ws-button-config` 처리자에게 변경 내역을 changelog 나 주석으로 알린다.

---

### 5. **[INFO]** `render-form-options-and-state-fix` — 직전 PR 의 spec 변경분 확인 권장

- **target 위치**: `plan/in-progress/render-form-submit-fix.md` §배경 — "PR #285 (`fix(render-form): option.value collision`) 의 후속"
- **관련 plan**: `plan/complete/render-form-options-and-state-fix.md` (worktree `render-form-options-and-state-fix-d72e6d` 에서 완료)
- **상세**: PR #285 가 `spec/4-nodes/6-presentation/0-common.md` 과 `spec/4-nodes/6-presentation/4-form.md` 를 수정했다 (해당 worktree diff 에서 두 파일이 변경됨). render-form-submit-fix 는 같은 파일들에 추가 변경을 가하므로 PR #285 의 내용이 main 에 merge 되었는지 확인이 필요하다. 이미 merge 되었다면 target 은 그 변경분을 전제로 작성해야 한다.
- **제안**: `spec/4-nodes/6-presentation/0-common.md` 의 main 브랜치 최신 상태를 확인하여 PR #285 의 변경이 반영되었음을 확인하고 착수한다. 현재 worktree(`render-form-submit-fix-3f10bf`)가 main 기반이므로 기본적으로 반영되어 있어야 하나, 충돌 없이 base 가 맞는지 스폿 체크 권장.

---

### 6. **[INFO]** `node-output-redesign` Phase E P2 항목 — Parallel `count` spec drift 와의 독립성

- **target 위치**: target 문서 `spec/4-nodes/` 전체
- **관련 plan**: `plan/in-progress/spec-drift-parallel-count.md` (`worktree: pending-assignment`) — `spec/4-nodes/1-logic/10-parallel.md §5.2` 의 `count` 필드 제거 vs 공통 규약의 `{<컬렉션>, count}` 명세 직접 모순. 처리 우선순위 LOW.
- **상세**: render-form-submit-fix 의 scope 는 Presentation 과 AI 노드 영역이며 Parallel 노드는 직접 관계없다. 단 `spec/4-nodes/` 전체를 대상으로 `--impl-prep` 를 수행하므로 target 범위 안에 이 미해결 모순이 존재한다는 점을 인지할 것.
- **제안**: Parallel count drift 는 render-form-submit-fix 와 무관하므로 본 PR 에서 수정하지 않는다. consistency-check 보고서에서 이미 별도 plan 으로 격리된 상태이며 LOW 우선순위이므로 차단 사유가 아니다.

---

## 요약

`spec/4-nodes/` 를 target 으로 하는 render-form-submit-fix plan 은 spec 변경 범위(`0-common.md`, `1-ai-agent.md`, `6-websocket-protocol.md`)가 모두 `ai-presentation-tools` plan 이 이미 수정한 파일들과 겹친다. `ai-presentation-tools` worktree 는 현재 실체가 없어 직접 worktree 경합은 없으나, 해당 plan 이 `in-progress` 에 남아 있고 동일 spec 파일의 관련 항목(form blocking 흐름, `pendingFormToolCall`, `0-common.md` AI tool 모드)을 "완료" 표기한 상태다. render-form-submit-fix 의 spec 추가가 이 완료분을 무효화하거나 override 하지 않도록 섹션 범위를 세심히 한정해야 한다. `spec-drift-ws-button-config` plan 의 미해결 결정(WS §4.4 정합화)도 동일 파일을 대상으로 하므로 수정 범위를 좁게 가져갈 것을 권고한다. `node-output-redesign` 의 잔여 form (spec) 항목과 Parallel count drift 는 본 PR 과 직접 충돌하지 않으나 추적 메모 수준으로 인지가 필요하다.

---

## 위험도

MEDIUM
