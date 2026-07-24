# 정식 규약 준수 검토 — spec/4-nodes/6-presentation

## 검토 방법

`spec/conventions/**` (특히 `node-output.md`, `interaction-type-registry.md`,
`conversation-thread.md`, `error-codes.md`, `cross-node-warning-rules.md`) 를
정본으로 두고 `spec/4-nodes/6-presentation/{0-common,1-carousel,2-table,3-chart,
4-form,5-template}.md` 전문을 대조했다. "impl-done" 지시에 따라 코드 사실관계는
HEAD 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/resumable-handler-generic-typing-3918dd`)
를 절대경로로 직접 조회해 검증했다 (`button-interaction.service.ts`,
`form-interaction.service.ts`, `render-tool-provider.ts`, `execution-engine.service.ts` 등).

참고: 이번 diff(`origin/main` 대비)는 `codebase/frontend/src/components/editor/
run-results/output-shape.ts`(JSDoc 확장) 와 그 테스트만 건드리며 `spec/4-nodes/
6-presentation/**` 자체는 diff 대상이 아니다. 아래 발견사항은 diff 로 신규
도입된 것이 아니라 target 문서의 **현재 상태**가 정식 규약과 어긋나는 기존
drift 다.

---

## 발견사항

- **[CRITICAL] `previousOutput` "폐기/금지" 서술이 실제 출력과 모순**
  - target 위치: `spec/4-nodes/6-presentation/0-common.md` §4.2(문장: "이전 초안의
    `output.type: 'form'`, `output.submittedData`, `output.format`,
    `output.content`, `previousOutput` 등의 필드는 **폐기**"), `3-chart.md` §5.5
    출력 표(문장: "별도 `previousOutput` 필드 사용 금지 (Principle 4.2)"), 그리고
    `1-carousel.md`/`2-table.md`/`5-template.md` §5.5(Resumed) 의 JSON 예시 전체
    (`previousOutput` 키를 예시에서 완전히 누락).
  - 위반 규약: `spec/conventions/node-output.md` §4.2 (line 194) 자신의 **과도기
    예외** 조항 — "단 Phase 3 완료 전 과도기 예외: presentation resume 경로
    (`ButtonInteractionService`)는 재개 출력에 `previousOutput`(nested chain 은
    strip)을 transitional legacy 필드로 여전히 보존한다" — 및 Principle 11
    (출력 예시는 `undefined` 가 아닌 실제 필드를 문서화해야 함).
  - 상세: HEAD 워크트리에서 직접 확인한 결과, `codebase/backend/src/modules/
    execution-engine/button-interaction.service.ts` 의
    `buildResumedStructuredOutput()` (line 291-295) 은 Carousel/Table/Chart/
    Template 의 **모든** 버튼 클릭/Continue 재개(resumed) 출력에 무조건
    `previousOutput: prevOutput` 키를 주입한다 (조건부 아님). 이 동작은
    `button-interaction.service.spec.ts` 에 회귀 테스트로도 고정돼 있다
    (`expect(out.previousOutput).toEqual(...)`). 즉 target 문서가 "폐기됐다"
    / "사용 금지" 라고 서술하는 필드가 실제로는 4/5 presentation 노드
    (form 제외 — form 은 `FormInteractionService` 를 통해 재개되며 이 필드를
    주입하지 않으므로 `4-form.md` 의 동일 서술은 정확함) 의 Resumed 출력에
    상시 존재한다. node-output.md 자체가 바로 이 사실(과도기 예외)을 명시하고
    있음에도, target 문서(0-common.md/3-chart.md)는 그 예외를 반영하지 않고
    단정적으로 "폐기/금지" 라고 서술해 두 문서가 직접 모순된다. 이를 그대로
    신뢰해 (a) `ButtonInteractionService` 의 strip 로직을 "이미 죽은 필드"로
    오판해 삭제하거나, (b) 이 문서의 JSON 예시를 근거로 exact-shape 검증/스키마를
    구현하면 실제 런타임 payload 와 어긋나 깨진다.
  - 제안: `0-common.md` §4.2 문장에 node-output.md §4.2 와 동일한 과도기 예외
    각주를 추가(예: "단, Carousel/Table/Chart/Template 의 버튼 재개 출력에는
    Phase 3 정리 전까지 `previousOutput`(legacy, 신규 소비 금지) 이 여전히
    포함된다 — SoT: [node-output.md §4.2](../../conventions/node-output.md#42-폐기할-필드--구조)").
    `3-chart.md` §5.5 표의 "사용 금지" 를 "신규 소비 금지(레거시 보존 필드,
    §Rationale 참조)" 로 정정. `1-carousel.md`/`2-table.md`/`5-template.md` 의
    §5.5 JSON 예시에도 동일 각주(예시 필드 자체를 넣거나 최소 각주)로
    Principle 11 의 "실제 출력 반영" 요건을 충족. 근본 해소를 원하면 Phase 3
    (`ButtonInteractionService` 의 `previousOutput` 제거)를 완료하고 두 문서를
    동시에 갱신하는 편이 더 정합적이다.

- **[INFO] Continuation Bus 메시지 타입 개수 cross-ref 오차 (5종 vs 실제 6종)**
  - target 위치: `spec/4-nodes/6-presentation/0-common.md` §10.9 문장 "[execution-engine
    §7.4] 의 Continuation Bus 메시지 타입 **5종** (`continue / cancel / button_click
    / ai_message / ai_end_conversation`) 표는 변경 없음"
  - 위반 규약: 엄밀히는 `spec/conventions/**` 가 아니라 `spec/5-system/
    4-execution-engine.md` §7.4 (system spec) 대비 사실관계 오차라 본 체크 범위
    (conventions 준수) 밖에 가깝지만, 출력/이벤트 포맷 정합성 관점에서 참고
    기록한다.
  - 상세: `spec/5-system/4-execution-engine.md` (line 893, 1162) 는 현재
    `ContinuationType` 을 `continue / cancel / button_click / ai_message /
    ai_end_conversation / retry_last_turn` **6종**으로 명시한다. 0-common.md
    §10.9 는 `retry_last_turn` 을 누락한 채 "5종·변경 없음" 이라 서술 — AI
    Agent retry 기능이 이후 추가되며 execution-engine.md 쪽만 갱신되고 이
    cross-ref 는 stale 해진 것으로 보인다. presentation 노드의 버튼/폼 재개
    동작 자체에는 영향이 없으나 (retry_last_turn 은 AI Agent 전용), 숫자
    불일치는 문서 신뢰도를 낮춘다.
  - 제안: "5종" → "6종(`retry_last_turn` 포함, AI Agent 전용이라 본 절 범위 밖)"
    로 정정하거나, 개수를 명시하지 않고 execution-engine §7.4 링크만 인용하는
    형태로 완화해 향후 enum 확장 시 재drift 를 방지.

- **[INFO] API 문서 규약(swagger/DTO) — 해당 없음 확인**
  - target 위치: 전체
  - 상세: `spec/4-nodes/6-presentation/*.md` 전체에 `@Api*` 데코레이터·DTO·
    Swagger 관련 언급이 전혀 없다 (grep 0건). 이 target 은 REST API 표면이
    아니라 노드 실행 계약을 다루므로 `spec/conventions/swagger.md` 관점 점검은
    구조적으로 해당 없음. 위반 아님 — 완전성을 위해 기록.

---

## 준수 확인 (참고 — 위반 아님)

다음은 정식 규약을 정확히 따르고 있음을 코드 대조로 확인했다 (허위 음성 방지
목적으로 기록):

- `output.type: 'carousel'|'table'|...` 판별자 금지(Principle 1.1.4), `output.view`
  래퍼 폐기, `submittedData`/`format`/`content` 폐기 — target 문서가 명시적으로
  준수 서술.
- `interaction.type` 3값(`button_click`/`button_continue`/`form_submitted`)과
  `data` shape — `node-output.md` §4.5 표와 필드 단위로 정확히 일치.
- `output.items`(carousel dynamic)/`output.rows`+`totalRows`(table)/`output.data`
  (chart)/`output.rendered`(template) 네이밍 — `node-output.md` §8.2 "프레젠테이션
  뷰" 행과 일치.
- 동적 포트 명명 `<button.id>`, `<itemButton.id>__item_<idx>`, 예약 포트 `continue`
  — `node-output.md` Principle 6 과 일치.
- `excludeFromConversationThread` 필드명 — `conversation-thread.md` 의 동일
  개념(AI 3노드)과 이름은 일치하나 독립 구현(별도 스키마)이며 UI 그룹 라벨만
  다름 (`Advanced > Conversation` vs `Conversation Context`) — 서로 다른 노드
  집합의 별개 기능이라 규약 위반 아님.
- `backfillButtonUuids` / `backfillFormOptionValues` / `normalizeNodeButtonIds`
  함수명, `PRESENTATION_MAX_BYTES` 상수명 — 코드( `render-tool-provider.ts`,
  `button-slug.util.ts`) 와 spec 서술이 정확히 일치.
- `interaction-type-registry.md` 의 `WaitingInteractionType`(`buttons`,
  `ai_form_render` 등) 값과 target 문서의 `meta.interactionType` 서술 일치.
- 문서 구조 — `0-common.md` 는 Overview 대체 인트로 문단 + 본문(§1-10) +
  `## Rationale` 3섹션을 갖추어 CLAUDE.md 의 spec 문서 구성 권장과 일치(형제
  카테고리 `3-ai/0-common.md` 와 동일 패턴). `_product-overview.md` 미존재는
  상위 `spec/4-nodes/_product-overview.md#9-presentation-노드-5종` 로 커버되며
  (`0-common.md` 프런트 링크로 cross-ref), 7개 노드 카테고리 중 5개가 동일
  패턴이라 위반 아님.

---

## 요약

`spec/4-nodes/6-presentation` 문서군은 명명·포트·인터랙션 페이로드·config/output
직교성 등 `node-output.md`/`interaction-type-registry.md` 핵심 조항을 대체로
정확히 따르고 있으며, 문서 구조(본문+Rationale)·API 문서 규약(해당 없음)에서도
위반이 없다. 다만 `previousOutput` 필드에 대해 target 문서(0-common.md,
3-chart.md 및 세 노드 문서의 예시)가 "폐기/금지" 라고 단정하는 서술이, 그
필드를 명시적으로 과도기 예외로 인정하는 정식 규약(node-output.md §4.2) 및
현재 HEAD 워크트리 코드의 실제 동작(carousel/table/chart/template 버튼 재개
출력에 상시 존재, 테스트로 고정됨)과 직접 모순된다 — 이는 출력 포맷 규약
(Principle 11 문서화 완전성 + §4.2 예외 반영) 을 정면으로 벗어나는 CRITICAL
사안이다. 이번 diff 자체는 이 영역을 건드리지 않았으므로 신규 회귀는 아니지만,
target 문서의 현재 상태로는 규약 완전 준수라 볼 수 없다. 부가로 Continuation
Bus 메시지 타입 개수(5종→실제 6종) cross-ref 가 stale 해 INFO 로 남긴다.

## 위험도

HIGH
