# Cross-Spec 일관성 검토 결과

target: `plan/in-progress/spec-draft-port-id-uuid-slug.md`

---

## 발견사항

### [CRITICAL] `4-nodes/1-logic/0-common.md §7` — 동적 포트 UUID v4 기술이 SoT(`0-overview.md §1.3`)와 직접 모순

- target 위치: 변경안 #1 (`4-nodes/1-logic/0-common.md` line 140)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/spec/4-nodes/1-logic/0-common.md` line 140 (`## 7. 포트 ID 불변성`)  
  vs `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/spec/4-nodes/0-overview.md` line 123 (`§1.3 포트 정의 PortDef` 포트 ID 생성 규칙)
- 상세: `1-logic/0-common.md §7` line 140은 "동적 포트: 생성 시 **UUID v4** 를 할당"이라 기술한다. `0-overview.md §1.3`(SoT)은 "동적 포트: config 항목이 보유한 **stable slug id** 를 포트 ID 로 사용한다 … (UUID v4 는 사용하지 않는다.)"로 확정한다. 두 문서가 같은 도메인 엔티티(동적 포트 ID)에 대해 상반된 생성 규칙을 기술한다.
- 제안: target 변경안 #1 그대로 채택. `1-logic/0-common.md §7` line 140을 slug 기술로 교체하고 SoT 링크 추가.

---

### [CRITICAL] `3-workflow-editor/1-node-common.md §1.5` — 동적 포트 UUID v4 기술이 SoT와 직접 모순

- target 위치: 변경안 #2 (`3-workflow-editor/1-node-common.md` line 97 표)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/spec/3-workflow-editor/1-node-common.md` line 97 (`§1.5 동적 포트 ID 규칙` 표 "ID 생성" 행)  
  vs `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/spec/4-nodes/0-overview.md` line 123 (`§1.3`)
- 상세: `1-node-common.md §1.5` 표의 "ID 생성" 행이 "동적 포트 추가 시 **UUID v4**를 할당한다"로 기술된다. `0-overview.md §1.3` SoT 및 `4-nodes/1-logic/2-switch.md §3.3` 실구현 spec(slug 사용)과 직접 모순된다. 워크플로우 에디터 영역(`spec/3-*`)과 노드 시스템 영역(`spec/4-*`)이 동일 포트 ID 계약에 대해 상반된 서술을 제공하므로 새 개발자가 에디터 측 spec 만 읽을 경우 UUID 모델로 구현할 수 있다.
- 제안: target 변경안 #2 채택. `1-node-common.md §1.5` 표의 "ID 생성" 행을 slug 기술로 교체하고 SoT(노드 §1.3 / `port-id.util.ts`) 참조 추가. line 102의 `> 상세: [노드 개요 §1.3]` 참조는 이미 있으나 본문과의 충돌을 제거해야 링크가 의미를 가진다.

---

### [CRITICAL] `4-nodes/3-ai/_product-overview.md` ND-AG-20 — 포트 ID UUID v4 기술이 SoT와 직접 모순

- target 위치: 변경안 #3 (`4-nodes/3-ai/_product-overview.md` line 80, ND-AG-20)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/spec/4-nodes/3-ai/_product-overview.md` line 80  
  vs `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/spec/4-nodes/0-overview.md` line 123
- 상세: ND-AG-20은 "포트 ID는 생성 시 UUID v4로 할당되어 불변 유지된다"라 기술한다. 그러나 `4-nodes/3-ai/1-ai-agent.md §2` line 79의 `ConditionDef.id` 필드도 "UUID v4 할당, 이후 불변"으로 기술되어 있어, target이 ND-AG-20만 수정하면 `1-ai-agent.md §2` ConditionDef 표와의 내부 충돌이 잔존한다. 단, draft의 "제외" 섹션은 ND-AG-17의 LLM 도구명 UUID는 정정 대상이 아님을 명시하나, AI Agent 조건 포트의 ID 모델(`ConditionDef.id`)에 대해서는 target이 명시적으로 처리하지 않는다.
- 제안: target 변경안 #3 채택. 추가로 `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/spec/4-nodes/3-ai/1-ai-agent.md` line 79 `ConditionDef.id` 필드 설명도 동반 갱신 필요 — 현재 "UUID v4 할당, 이후 불변"이 slug 방식과 충돌한다. AI Agent 조건의 포트 ID가 실제 slug인지 UUID인지를 해당 필드 행에서 명확히 해야 한다.

---

### [CRITICAL] `4-nodes/6-presentation/1-carousel.md` line 429 — `ButtonDef.id` 설명의 UUID v4와 `0-common.md §1`의 명시적 UUID 정의가 target 정정 범위와 충돌

- target 위치: 변경안 #4 (`4-nodes/6-presentation/1-carousel.md` line 429)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/spec/4-nodes/6-presentation/0-common.md` line 32, line 253, line 319, line 447, line 458  
  vs `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/spec/4-nodes/0-overview.md` line 123
- 상세: target은 carousel.md line 429의 "버튼 추가 시 UUID v4 자동 할당 (ID 불변)"만 정정하나, presentation 공통(`6-presentation/0-common.md`) §1 `ButtonDef.id` 타입이 "String (UUID v4)"로, §7.1 포트 ID 표가 "`<button.id>` (UUID v4)"로, §10.5 step 3이 "UUID v4 backfill"로 일관되게 ButtonDef.id를 UUID v4로 규정한다. 이는 `0-overview.md §1.3`(포트 ID = slug)과 달리 **ButtonDef.id 가 UUID v4이며, 그 id 를 동적 포트 ID 로 사용**하는 별도 모델이다.

  두 모델의 관계 파악:
  - `0-overview.md §1.3` SoT: "동적 포트: config 항목이 보유한 stable slug id 를 포트 ID 로 사용"
  - `6-presentation/0-common.md §1`: ButtonDef.id = UUID v4(워크플로 에디터 UI가 `crypto.randomUUID()` 로 생성), 이 id가 포트 ID로 사용됨
  - `normalizeNodeButtonIds` 함수명("label → slug 변환")과 `backfillButtonUuids` 함수명("UUID backfill") 공존이 두 경로가 혼재함을 암시

  즉, Presentation 노드의 ButtonDef.id는 **user-set slug가 아니라 워크플로우 에디터가 자동 발급하는 UUID v4**이며, `0-overview.md §1.3`의 "config 항목이 보유한 stable slug id"와 다른 경로다. target 변경안 #4는 carousel.md line 429를 "user-set slug id 부여(미입력 시 자동 slug)"로 수정하지만, 이는 `0-common.md §1`의 UUID v4 명시 및 LLM render_* 도구용 `backfillButtonUuids` 근거(§10.5 Rationale)와 정합하지 않는다.

  target이 carousel §1·§3 예시(`{"id":"approve"}`, Principle 6 `<button.id>`)를 근거로 "user-set slug"라 주장하지만, carousel.md §3 예시는 워크플로 편집자가 직접 label을 "Approve"로 입력한 시나리오이고, `0-common.md §1`의 ButtonDef.id 타입은 "String (UUID v4)"로 명시된다. 이 두 층위가 서로 충돌한다.

- 제안: target 변경안 #4를 채택하기 전에 Presentation ButtonDef.id의 ID 생성 방식을 별도 결정해야 한다. 옵션:
  1. Presentation ButtonDef.id = UUID v4 유지(워크플로 에디터가 자동 발급) — `0-common.md §1` 그대로, carousel.md line 429를 "버튼 추가 시 **UUID v4** 자동 할당 (ID 불변)"으로 원상 유지(정정 불필요)
  2. ButtonDef.id를 slug로 전환 — `6-presentation/0-common.md §1` 타입·§7.1 표·§10.5 step 3 backfill 로직·LLM render_* 도구 backfillButtonUuids 전체를 함께 수정해야 하며, Discord/Slack/Telegram 어댑터의 `buttonId(UUID v4)` 저장 방식도 영향을 받는다

  대부분의 근거를 볼 때 Presentation ButtonDef.id는 의도적으로 UUID v4이며(LLM 도구 render_* backfill 로직 포함), `0-overview.md §1.3`의 "stable slug"는 Switch/Classifier 처럼 **사람이 명시적으로 id를 정하는 config 항목** 전용 서술로 보인다. target의 제외 조항 "Presentation `ButtonDef.id` — 이미 user-set slug(`{"id":"approve"}`); UUID 가 아님(carousel:429 의 서술만 stale)"은 근거가 미약하다.

---

### [WARNING] `4-nodes/3-ai/1-ai-agent.md §2` ConditionDef.id — target이 다루지 않는 UUID v4 기술 잔존

- target 위치: (target 변경안에 포함되지 않음)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/spec/4-nodes/3-ai/1-ai-agent.md` line 79  
  vs `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/spec/4-nodes/0-overview.md` line 123
- 상세: target 변경안 #3은 `_product-overview.md` ND-AG-20만 수정한다. 그러나 `1-ai-agent.md §2` ConditionDef 표의 `id` 필드는 "UUID v4 할당, 이후 불변"으로 명시되어 있으며, ND-AG-17의 LLM 도구명 "cond_ 접두사 + 정제된 UUID"도 같은 행에 기술된다. ND-AG-17과 ConditionDef.id가 같은 행(line 79)에 혼재하여, ND-AG-20 수정 후에도 `1-ai-agent.md §2`가 UUID v4 포트 ID 기술을 유지하면 inconsistency가 잔존한다. (AI Agent 조건 포트는 `0-overview.md §1.3` slug 대상인지 여부도 명확하지 않음.)
- 제안: ND-AG-20 수정과 함께 `1-ai-agent.md §2` ConditionDef.id 필드 설명을 동반 검토·갱신. AI Agent 조건의 포트 ID가 slug인지 UUID인지를 명문화해야 한다.

---

### [WARNING] `6-presentation/0-common.md §1 ButtonDef` — UUID v4 포트 ID와 `0-overview.md §1.3` slug SoT의 범위 모호

- target 위치: 변경안 #4의 "제외" 근거
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/spec/4-nodes/6-presentation/0-common.md` line 32, 253  
  vs `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/spec/4-nodes/0-overview.md` line 123
- 상세: `0-overview.md §1.3` SoT의 "동적 포트: config 항목이 보유한 stable slug id"가 Presentation 노드 ButtonDef.id(UUID v4)까지 적용되는지 여부가 spec상 불명확하다. `0-common.md §7.1` 표는 "Carousel/Table/Chart/Template (글로벌 버튼) `<button.id>` (UUID v4)"라 명시하고, §10.5 step 3 Rationale은 워크플로 에디터가 `crypto.randomUUID()`로 발급하는 것과 동일 의미라고 설명한다. 이는 포트 ID가 slug인 Switch/Classifier와 별개 경로임을 암시하지만, `0-overview.md §1.3`은 이 구분을 명시하지 않는다.
- 제안: `0-overview.md §1.3`에 "Presentation 노드의 ButtonDef.id는 워크플로 에디터가 UUID v4로 자동 발급하며, `0-common.md §1`이 SoT" 예외 기술을 추가하거나, §1.3 설명을 명확히 범위 한정("Switch/Classifier/Background 등 사람이 명시하는 config 항목 전용")으로 정제할 것을 권장한다.

---

### [INFO] `3-workflow-editor/1-node-common.md §1.5` 표의 "포트 삭제" 행 — target 변경안에 누락

- target 위치: 변경안 #2 (`3-workflow-editor/1-node-common.md` line 97 표)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/spec/3-workflow-editor/1-node-common.md` line 100 ("포트 삭제" 행)
- 상세: target 변경안 #2는 "ID 생성" 행만 수정한다. §1.5 표의 line 99 "ID 불변" 행과 line 100 "포트 삭제" 행은 UUID 방식에서도 slug 방식에서도 의미가 동일하므로 현행 텍스트가 slug 방식과 충돌하지 않는다. 단, "ID 생성" 행 변경 후 표의 일관성(slug 기반으로 행 설명이 slug 관련 용어를 쓰도록)을 검토해 업데이트하는 것이 좋다.
- 제안: target 변경안 #2에서 "ID 불변" 행도 slug 맥락에 맞는 표현으로 동기화 권장.

---

### [INFO] `4-nodes/0-overview.md` Rationale 섹션 신설 — 다른 spec 와의 충돌 없음, 단 기존 참조 구조와 정합 확인 필요

- target 위치: target 추가 항목 (`0-overview.md ## Rationale 신설`)
- 충돌 대상: 없음 (현재 `0-overview.md`에 Rationale 미존재)
- 상세: `0-overview.md`에 Rationale 섹션이 없음은 impl-done INFO #3이 지적한 사항이며, target draft의 Rationale 내용은 `0-overview.md §1.3` 기존 본문과 정합하고 다른 영역 spec과 충돌하지 않는다. `spec/0-overview.md`(루트)도 Rationale 섹션을 갖는 패턴이 이미 확립되어 있다.
- 제안: 그대로 진행. `## Rationale` 섹션 추가 후 내부에 "동적 포트 ID = stable slug (UUID v4 폐기)" 항목을 신설.

---

## 요약

target draft는 `spec/4-nodes/0-overview.md §1.3`(SoT: stable slug)에 이미 확정된 동적 포트 ID 방식을 4개 하위 문서에 일원화하는 것을 목적으로 한다. 변경안 #1(logic 공통)과 #2(워크플로 에디터 노드 공통)는 SoT와 직접 모순하는 UUID v4 기술을 제거하므로 채택 타당하다. 변경안 #3(AI 노드 PRD ND-AG-20)은 올바르나 동일 파일 `1-ai-agent.md §2` ConditionDef.id 필드(line 79)에도 UUID v4 기술이 잔존하여 추가 갱신이 필요하다. 변경안 #4(Carousel line 429)는 **근거가 미약하며 위험하다** — Presentation 노드의 ButtonDef.id는 워크플로 에디터가 UUID v4로 자동 발급하는 별도 경로이며, `6-presentation/0-common.md §1·§7.1·§10.5`가 이를 일관되게 명시한다. target의 "carousel:429만 stale"이라는 전제는 `0-common.md`의 다중 UUID v4 기술을 간과하므로 변경안 #4 채택 전 Presentation ButtonDef.id의 ID 모델을 명시적으로 결정해야 한다.

## 위험도

HIGH

(변경안 #1·#2·#3은 SoT에 부합하고 채택 안전하나, 변경안 #4는 Presentation ButtonDef.id 도메인의 UUID v4 일관 모델과 충돌하며 이를 그대로 적용하면 `6-presentation/0-common.md` 전체와 LLM render_* backfill 로직과 새로운 모순이 발생한다.)
