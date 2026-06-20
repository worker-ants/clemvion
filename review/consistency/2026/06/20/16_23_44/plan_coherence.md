# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-draft-port-id-uuid-slug.md`
검토 기준: `plan/in-progress/**` 전체 (진행 중 결정·미해결 항목)

---

## 발견사항

### [INFO] spec-sync-carousel-gaps.md 의 carousel 결정과 변경 #4 의 공존

- target 위치: target 문서 "변경안 #4" — `4-nodes/6-presentation/1-carousel.md`(line 429) 의 "UUID v4 자동 할당" 서술을 "user-set slug id" 로 정정
- 관련 plan: `plan/in-progress/spec-sync-carousel-gaps.md` — `1-carousel.md` 전체를 대상으로 `layout` 변형(`image`/`minimal`) UX 결정(옵션 A/B/C 미결)이 열려 있음
- 상세: carousel plan 은 `1-carousel.md §1·§2·§4·§5.1` 의 layout 변형 의사결정을 아직 처리 중이지만, 그 대상 파일은 target 과 동일한 `1-carousel.md` 이다. 다만 carousel plan 의 열린 결정은 `layout` 렌더 UX 에 국한되고, target 의 변경 #4 는 같은 파일의 line 429("버튼 추가 시 UUID v4 자동 할당") 포트 ID 서술 정정만 건드린다 — 서로 다른 섹션·독립 토픽이므로 내용 충돌은 없다. 그러나 두 변경이 같은 파일에 동시 적용될 예정이므로 병합 시 hunk 경합 가능성이 있다.
- 제안: 정보성 메모. carousel layout 결정(spec-sync-carousel-gaps.md)이 확정·PR 되기 전에 본 port-id drift 정정이 먼저 머지되면 carousel plan 의 담당자가 rebase 시 line 429 주변 hunk 를 수동 조정해야 한다는 점을 plan 비고에 한 줄 기록 권장. spec 문서나 plan 자체를 변경할 필요는 없다.

---

### [INFO] refactor-m5-node-di-layer1.md 가 이미 planner 에 위임 완료함

- target 위치: target 문서 전체 (배경·영향 섹션)
- 관련 plan: `plan/in-progress/refactor-m5-node-di-layer1.md` §범위 밖 — "C1+W1 동적 포트 ID drift (planner 위임)" 으로 명시하고 비차단 처리
- 상세: refactor-m5 plan 이 consistency-check impl-done 에서 C1/C2 블록을 받았고, 이를 "pre-existing, 내 changeset 밖" 으로 판정하여 BYPASS_REVIEW_GUARD=1 + planner 위임으로 종결했다. target 은 그 위임의 산출물이다 — 관계가 명확하고 선행 plan 의 판단과 완전히 정합한다.
- 제안: 이미 정합. 추가 조치 불필요.

---

## 미해결 결정과의 충돌 (검토 결과)

target 이 건드리는 네 파일(`1-logic/0-common.md §7`, `3-workflow-editor/1-node-common.md`, `3-ai/_product-overview.md ND-AG-20`, `6-presentation/1-carousel.md line 429`) 과 신설하는 `4-nodes/0-overview.md ## Rationale` 에 대해 in-progress plan 중 **같은 섹션에서 "결정 필요"로 열어 둔 항목이 존재하지 않는다**.

- `ai-agent-tool-connection-rewrite.md` 는 `1-ai-agent.md §6.1·§Tool Area` 를 다루며, target 이 수정하는 `3-ai/_product-overview.md` ND-AG-20 과 문서가 다르다. 또한 tool-connection 의 미결정 항목(도구 등록 모델·시그니처 위치·실행 컨텍스트 등)은 포트 ID 생성 방식과 직교한다.
- `marketplace-and-plugin-sdk.md` 는 `4-nodes/0-overview.md §4·§5` 를 다루며, target 이 신설하는 `## Rationale` 와 섹션이 다르고 내용도 독립적이다.
- `spec-draft-conventions-code-data.md` 는 `4-nodes/0-overview.md §2.5` 변경을 이미 완료(체크박스 all ✅)했으므로 경합 없다.

**결론: 미해결 결정 우회에 해당하는 항목 없음.**

---

## 선행 plan 미해소 여부 (검토 결과)

target 이 가정하는 사전 조건:

1. `4-nodes/0-overview.md §1.3` 가 slug SoT 로 이미 확정되어 있어야 한다 → 코드(`port-id.util.ts`)와 spec 모두 확인됨 (`UUID v4 는 사용하지 않는다` 명문화 완료, 별도 선행 plan 불필요).
2. refactor-m5 작업이 이 drift 정정을 "pre-existing, 별도 planner 작업" 으로 위임했어야 한다 → `refactor-m5-node-di-layer1.md` §범위 밖에 명시 확인됨.

**결론: 미해소 선행 plan 없음.**

---

## 후속 항목 누락 여부 (검토 결과)

target 변경은 spec 문서 내 서술 정정(신규 결정 없음, 기존 SoT 일원화)이므로 다른 plan 의 후속 항목을 무효화하지 않는다. 특기사항:

- `spec-sync-carousel-gaps.md` 의 layout 결정이 확정·구현될 때 담당자가 `1-carousel.md` 를 편집하면 target 변경(line 429)이 이미 반영된 상태에서 작업하게 된다 — 이는 오히려 중복 정정이 사라지는 긍정적 결과이며, 후속 항목 누락이 아니다.
- `ai-agent-tool-connection-rewrite.md` §3 Spec 작성 시 `1-ai-agent.md` 를 편집할 때 `3-ai/_product-overview.md` ND-AG-20 은 간접 참조 문서다 — target 의 ND-AG-20 정정이 그 편집을 방해하지 않는다.

---

## 요약

`spec-draft-port-id-uuid-slug.md`(target)는 `refactor-m5-node-di-layer1.md` 가 planner 에 위임한 pre-existing UUID→slug drift 를 정확히 이행하는 문서다. 변경 대상 4개 파일·신설 Rationale 섹션 모두 in-progress plan 의 미결 결정과 충돌하지 않으며, 선행 조건(§1.3 SoT 확정)도 이미 충족됐다. `spec-sync-carousel-gaps.md` 와 같은 파일(`1-carousel.md`)을 건드리지만 서로 독립 섹션으로, 충돌 내용은 없고 병합 시 hunk 경합 가능성만 INFO 수준으로 존재한다.

## 위험도

NONE
