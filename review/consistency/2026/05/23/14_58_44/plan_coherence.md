# plan_coherence — render-form-options-and-state-fix (spec draft 검토)

## Plan 본문 vs spec 변경 정합

`plan/in-progress/render-form-options-and-state-fix.md` 의 (S) spec 단계는 다음을 약속:

1. §10.5 backfill 단계 본문에 form option.value backfill 추가 + Rationale 1단락
2. 4-form.md 변경 — LLM tool 모드 옵션 정규화 명문화 + file 타입 UI 동작 명문화
3. §9 CHANGELOG 2026-05-23 항목

본 spec 작업이 정확히 위 3건을 다룬다 — plan 약속과 1:1.

## TDD 체크리스트와의 결합

- [ ] (S) project-planner 위임 — §10.5 form option value backfill + spec 변경 ← **본 작업이 처리**
- [ ] (S) `/consistency-check --spec` BLOCK:NO 확인 ← **본 작업이 처리**
- [ ] (S) spec commit ← **본 작업이 처리**
- 후속: (impl-prep) consistency-check → (C) backend test 선작성 → 구현 → frontend → e2e → review → PR

본 spec 작업 후 다음 단계 (impl-prep) 가 자연스럽게 이어짐. spec 변경이 backend `backfillFormOptionValues` 와 frontend file case 의 4-layer SSOT 라인업을 명시하면, 후속 단계의 구현자가 함수명·시점·동작을 spec 에서 직접 인용 가능.

## Plan 의 "결정 메모" 와 spec 변경 일치

| Plan 메모 | spec 변경 반영 |
|---|---|
| 함수명 `backfillFormOptionValues` (PR #279 `backfillButtonUuids` 와 평행) | §10.5 step 4 본문 + Rationale 4-layer SSOT 라인에 명시 |
| fallback 형식 `opt-{idx}-{slug(label)}` (slug 비면 `opt-{idx}`) | §10.5 step 4 본문에 명시 (예시 1줄) |
| file 타입 → project-planner 결정 | 의뢰서의 (A) 안 (metadata-only) 채택 — Rationale 단락에 명시 |
| number 빈 입력 보존 | 본 spec 변경의 (S) 항목 아님 — frontend 구현 단계 (A2) 에서 처리. spec 에는 명시 불요 (Principle 4.5 의 free-form value 슬롯 안) |

## Follow-up 분리 여부

Plan 본문이 "한 PR 안에서 일괄, follow-up 없음" 으로 명시. 본 spec 변경도 별 plan 분리하지 않고 본 worktree branch 에 1 commit 으로 처리.

## 다른 in-progress plan 과의 충돌

| Plan | 영향 |
|---|---|
| `ai-presentation-tools.md` | render_* tool family 의 schema 단일 진실. 본 spec 변경이 §10.5 step 신설로 schema 변환 단계 (validate → overlay → cap → backfill) 의 backfill 항목 확장. 충돌 없음 — 같은 단계 안에서 form 분기 추가. |
| `ai-agent-tool-connection-rewrite.md` | tool 연결 라우팅 변경. 본 작업은 render-tool-provider 내부 normalization 으로 라우팅에 영향 없음. |
| `node-output-redesign/*` | node-output schema 의 redesign 진행 중인 경우 본 backfill 단계가 redesign 후 schema 와 정합 필요. **확인 필요** — node-output-redesign plan 내부 본문을 별도로 확인하지 않았으므로, 후속 단계에서 형식 drift 발생 시 회귀 가능성. |

→ node-output-redesign 의 진행 상태는 본 spec 변경 후 impl-prep 단계의 consistency-check 가 다시 잡아낼 수 있음. spec 본문에는 영향 없음.

## 결론

- BLOCK: NO
- Plan 의 (S) 약속과 spec 변경 1:1 매칭. 후속 (C)/(A)/(8)/(9)/(10) 단계가 자연스럽게 이어짐. node-output-redesign 잠재 충돌은 impl-prep 단계에서 재검증.
