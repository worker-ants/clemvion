# Consistency Check (impl-prep) — agent-memory model fields → select

**대상 변경**: AI Agent / Information Extractor 노드의 `embeddingModel`(text→select),
`summaryModel`·`extractionModel`(expression→select). 저장 형태(모델명 문자열)·런타임
resolve 무변경.

**검토자**: rationale-continuity / convention-compliance / naming-collision (3종, 본
bg 세션 bgIsolation 제약으로 checker 는 텍스트 반환, main 이 본 SUMMARY 기록).

## BLOCK: NO

genuine CRITICAL 없음. 단 **spec 동반 갱신이 필수**(project-planner) — 미반영 시
spec-impl 불일치 + §2.6.2 widget 카운트 불일치.

## 발견사항

### [REJECTED — false positive] rationale-continuity CRITICAL "widget 미존재"
checker 가 schema 변경만 고립 평가해 "`embedding-model-selector`/`chat-model-selector`
가 UiWidget union/registry 에 없어 깨진다"를 CRITICAL 로 보고. 그러나 **위젯 신규 생성
(backend UiHint union + frontend UiWidget + widget-registry + 컴포넌트)이 본 작업의
본체**이며 plan 에 포함됨. "아직 없다"는 구현 대상이지 차단 사유 아님. → 기각.
유효 커널: schema 값·backend/frontend union·registry·컴포넌트를 **원자적으로 함께**
착지(하나라도 빠지면 빌드/런타임 깨짐).

### [REQUIRED — spec update] summaryModel/extractionModel expression 제거 = 문서화된 결정 번복
- `spec/4-nodes/3-ai/1-ai-agent.md §1` 표: summaryModel/extractionModel "(Expression 가능)"
- `spec/4-nodes/3-ai/1-ai-agent.md §12.12 Rationale`: "신규 필드는 모델 ID expression 문자열" 명시
- `spec/4-nodes/3-ai/3-information-extractor.md §1` (line 38 `extractionModel | Expression?`)
- 사용자가 expression 제거를 의도된 trade-off 로 승인 → 결정은 확정, **spec 을 그에 맞게 갱신** 필요.

### [REQUIRED — spec update] widget 어휘 SoT 갱신
- `spec/3-workflow-editor/1-node-common.md §2.6.2` "Widget 어휘 (19종)" → 21종 + 공용
  selector 분류에 신규 2개 등재 (convention-compliance 발견).

### [REQUIRED — spec update] embeddingModel 선택 방식 문구
- `spec/5-system/17-agent-memory.md §3` (+ §1 표 / ai-agent §1 표 embeddingModel 타입):
  select 방식 반영. embeddingModel text→select 는 코드 주석 의도(footgun 차단)와 **일치**
  (select 도 정적 리터럴) — 번복 아님, 문구 정합만.

### [INFO] 기존 부채
- backend `UiHint.widget` union 에 `multiselect` 누락(frontend/spec 엔 있음). 본 변경 범위
  밖이나, 신규 2개는 backend UiHint ↔ frontend UiWidget ↔ spec §2.6.2 3개소 동시 갱신로 이
  패턴 반복 회피.
- 신규 위젯을 `assistant.ts` `UserActionWidget`(어시스턴트 candidate picker)에는 **미등재**
  (모델명 문자열 입력 전용). 의도된 제외.

## 다음 단계
spec 갱신(planner + `consistency-check --spec`) → 코드 구현(developer) → TEST → ai-review →
`consistency-check --impl-done`.
</content>
