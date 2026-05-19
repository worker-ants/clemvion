# Cross-Spec 일관성 검토 — `requiredwhen-dsl-whitelist` plan

검토 대상: `plan/in-progress/requiredwhen-dsl-whitelist.md`
검토 모드: `--plan` (plan draft 검토)
검토 시각: 2026-05-19

---

### 발견사항

- **[WARNING]** `requiredWhen`과 `visibleWhen` DSL 간 비대칭 — spec 에 명시 없음
  - target 위치: plan §결정 + `spec/4-nodes/1-logic/2-switch.md §8.1 Rationale`
  - 충돌 대상: `codebase/backend/src/nodes/core/node-component.interface.ts` (visibleWhen 타입), `codebase/frontend/src/lib/node-definitions/types.ts` (visibleWhen 타입), `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts:151`
  - 상세: plan 은 `requiredWhen` DSL 을 단일 shape `{ field, equals: T | readonly T[] }` 로 정준화 (`notEquals`/`oneOf` 제거) 하고 그 근거로 "블랙리스트 위험"을 제시한다. 그런데 `visibleWhen` 은 여전히 `{ field, notEquals }` 와 `{ field, oneOf }` 형태를 interface 에서 보유하고 있으며 `ai-agent.schema.ts:151` 에서 `visibleWhen: { field: 'mode', notEquals: 'multi_turn' }` 로 실제 사용 중이다. `switch.md §8.2` bullet 4 에 "visibleWhen 도 동일 패턴으로 검토" 라는 언급이 있지만 commit 대상에서 제외되었고 spec 에도 명시적 결정이 없다. `requiredWhen` 의 `notEquals` 가 위험한 이유가 `visibleWhen` 의 `notEquals` 에도 동일하게 적용되므로, 의도적 제외인지 후속 결정이 필요한 미결 사안인지 spec 에 기록되지 않은 상태다.
  - 제안: `spec/4-nodes/1-logic/2-switch.md §8.1` (또는 `spec/4-nodes/0-overview.md` 에 신규 UiHint DSL 정책 섹션) 에 "visibleWhen 은 notEquals 를 한시적으로 허용하되, 신규 스키마에는 equals/equals-array 형태를 권장" 또는 "visibleWhen.notEquals 도 동일 정책으로 이행 예정" 중 하나를 명시한다. `ai-agent.schema.ts:151` 의 `notEquals` 가 의도적 예외라면 주석으로 이유를 남긴다.

- **[WARNING]** UiHint DSL 의 canonical spec 정의 부재
  - target 위치: plan §결정, `spec/4-nodes/1-logic/2-switch.md §8 Rationale`
  - 충돌 대상: `spec/4-nodes/0-overview.md` — UiHint/visibleWhen/requiredWhen 정의 없음. `spec/3-workflow-editor/1-node-common.md` — 해당 DSL 정의 없음.
  - 상세: `visibleWhen` / `requiredWhen` DSL 의 허용 형태와 평가 의미는 현재 코드(`node-component.interface.ts`, `types.ts`, `visibility.ts`) 와 `2-switch.md §8 Rationale` 에 분산되어 있고 spec 의 교차 참조 가능한 단일 위치가 없다. 이번 plan 이 `requiredWhen` 정준화를 결정했으므로, 이 DSL 정의를 코드 주석이 아닌 spec 에 anchor 하지 않으면 다음 노드 추가 시 개발자가 코드를 직접 읽어야 정책을 파악할 수 있다.
  - 제안: `spec/4-nodes/0-overview.md §1.X` 에 "UiHint DSL 정책" 섹션을 신설하거나, `spec/conventions/ui-hint-dsl.md` 를 생성해 `visibleWhen`/`requiredWhen` 의 허용 shape 와 평가 규칙을 spec 레벨로 끌어올린다. 이는 이번 PR 의 필수 조건은 아니나 다음 노드 작업 이전에 처리를 권장한다.

- **[INFO]** `switch.md §8.2` bullet 4 — `visibleWhen` 후속 검토 미결 항목이 plan 에 없음
  - target 위치: `spec/4-nodes/1-logic/2-switch.md §8.2` bullet 4: "`visibleWhen` / cases 필드 등 다른 mode-dependent 메타도 동일 패턴으로 검토"
  - 충돌 대상: `plan/in-progress/requiredwhen-dsl-whitelist.md` 작업 항목 목록
  - 상세: spec §8.2 에 "visibleWhen 도 동일 패턴으로 검토" 가 권고로 기술되어 있지만, plan 의 체크리스트에 대응하는 후속 항목(`[ ]`)이 없다. spec 과 plan 이 서로 다른 작업 범위를 암시하고 있어, 향후 reviewerc 가 미완료 작업이 있다고 오해할 수 있다.
  - 제안: plan 에 "follow-up: visibleWhen.notEquals 이행 검토" 항목을 `[ ]` 로 추가하거나, spec §8.2 bullet 4 를 "이 이행은 별도 작업으로 추적한다" 식으로 명시해 현재 PR 범위 밖임을 분명히 한다.

---

### 요약

plan `requiredwhen-dsl-whitelist` 는 `requiredWhen` DSL 을 `{ field, equals }` 단일 shape 으로 정준화하는 결정으로서, `spec/4-nodes/1-logic/2-switch.md §8` Rationale 과 코드베이스의 인터페이스·스키마·테스트 변경이 내부적으로 일치하며 RBAC, 상태 전이, 데이터 모델, API 계약 영역과의 직접 충돌은 없다. 다만 두 가지 잠재 충돌이 존재한다: 첫째, `requiredWhen` 은 `notEquals` 를 제거했으나 `visibleWhen` 은 여전히 보유하며 `ai-agent.schema.ts` 에서 활성 사용 중이어서, spec 이 두 DSL 키의 허용 정책을 비대칭으로 다루는 근거를 명시하지 않은 채 코드 상태만 앞서 있다. 둘째, `visibleWhen`/`requiredWhen` DSL 의 canonical spec 정의가 없어 노드 추가 시 정책 파악이 코드 의존적이다. CRITICAL 충돌은 없으나, `visibleWhen.notEquals` 의 존치 의도를 spec 에 명시하지 않으면 다음 consistency-check 에서 동일 지적이 재발할 가능성이 있다.

### 위험도

LOW
