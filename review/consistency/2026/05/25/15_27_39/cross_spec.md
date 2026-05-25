# Cross-Spec 일관성 검토 결과

- 검토 모드: `--impl-prep`
- 검토 대상: `spec/4-nodes/6-presentation/0-common.md`
- 검토 일시: 2026-05-25

---

## 발견사항

### [WARNING] `_product-overview.md` ND-CL-07/ND-TB-07/ND-CH-07/ND-TP-06 — "선택적 타임아웃 지원" vs `0-common.md §3·§6.1` "무제한 대기"

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md §3` ("버튼 클릭 시까지 무제한 대기 (외부 cancel/종료 외에는 타임아웃 없음)") 및 `§6.1` ("버튼 클릭 시까지 무제한 대기")
- **충돌 대상 1**: `spec/4-nodes/_product-overview.md §9.1 ND-CL-07`, `§9.2 ND-TB-07`, `§9.3 ND-CH-07`, `§9.5 ND-TP-06` — 모두 "선택적 타임아웃 지원 (무제한 가능)"으로 기술
- **충돌 대상 2**: `spec/5-system/6-websocket-protocol.md §4.4` — `buttonConfig.timeout: 300`, `buttonConfig.timeoutAction: "cancel"` 예시 필드가 포함되어 있고, 에러 코드 표에 `INTERACTION_TIMEOUT` 이 등록되어 있음
- **상세**: `0-common.md`는 버튼 Blocking Mode를 "무제한 대기"로 정의하지만, `_product-overview.md`의 4개 요구사항(ND-CL-07, ND-TB-07, ND-CH-07, ND-TP-06)은 "선택적 타임아웃 지원"을 명시한다. WS spec §4.4의 `buttonConfig` 예시도 `timeout`/`timeoutAction` 필드를 포함하고 있다. 이미 별도 plan (`plan/in-progress/spec-drift-ws-button-config.md`, C2)에서 이 충돌이 식별되어 있으며, "WS spec §4.4 예시에서 `timeout`/`timeoutAction` 제거 (A안)"이 자연스럽다는 결론이 나와 있다. 본 검토 범위에서 `0-common.md`의 "무제한 대기" 정책은 현재 구현 및 다른 spec과 일관되므로 정합 방향은 `_product-overview.md`와 WS spec의 타임아웃 기술을 제거하는 것이다.
- **제안**: 구현 착수 전 반드시 해결해야 할 차단 사항은 아니지만, `_product-overview.md`의 ND-CL-07 등 타임아웃 언급 제거, WS spec §4.4 예시 정합화를 병행 처리하거나 계획에 명시 필요. plan `spec-drift-ws-button-config.md`의 C2 항에서 이미 추적 중.

---

### [WARNING] `spec/5-system/6-websocket-protocol.md §4.4` `buttonConfig.nodeOutput.type` 판별자 vs `0-common.md §4` Principle 1.1.4

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md §4` — "노드 판별용 `type: 'carousel' | 'table' | 'chart' | 'form' | 'template'` 래퍼는 사용하지 않는다 (Principle 1.1.4)"
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.4` — `buttonConfig.nodeOutput: { "type": "carousel", "items": [...], "rendered": "..." }` 예시에 `type` 판별자 키가 포함되어 있음
- **상세**: 동일 충돌이 plan `spec-drift-ws-button-config.md` C3에서 이미 식별되어 있다. WS spec의 `nodeOutput` 예시가 Principle 1.1.4를 위반하는 `type` 키를 포함하고 있어, 현재 구현과 다른 spec 기술 사이에 불일치가 있다.
- **제안**: WS spec §4.4의 `buttonConfig.nodeOutput` 예시를 실제 output shape (`{ items: [...] }` 등, type 판별자 없음)으로 교체. plan `spec-drift-ws-button-config.md` C3과 함께 처리 권장.

---

### [INFO] `spec/1-data-model.md §2.14 NodeExecution.interaction_data` shape vs `0-common.md §4.2`의 `interaction.data` shape 명명 비일관성

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md §4.2` — Resumed 시 `output.interaction.data: { buttonId, buttonLabel, selectedItem? }` (button_click), `{ buttonId, buttonLabel, url }` (button_continue)
- **충돌 대상**: `spec/1-data-model.md §2.14` NodeExecution.`interaction_data` JSONB 컬럼 정의 — `{ interactionType: "form_submitted" | "button_click" | "button_continue", buttonId?, buttonLabel?, clickedAt, clickedBy }` 형태로 기술
- **상세**: 두 spec이 동일한 인터랙션 정보를 다른 두 장소(output.interaction.data vs interaction_data DB 컬럼)에서 기술한다. `0-common.md §4.2`의 `interaction.data`는 `selectedItem?`를 포함하지만 `clickedAt`, `clickedBy`를 포함하지 않는다. 반면 `1-data-model.md`의 `interaction_data` 컬럼은 `clickedAt`, `clickedBy`를 포함하지만 `selectedItem`을 언급하지 않는다. 두 필드가 같은 내용을 담는지(output.interaction이 DB에 그대로 저장되는지) 또는 DB 컬럼이 별도 보완 정보를 저장하는지 명시되지 않아 구현자에게 모호하다.
- **제안**: `spec/1-data-model.md §2.14`의 `interaction_data` 필드 설명에 `selectedItem?`를 추가하거나, 두 shape의 관계(DB 컬럼이 output.interaction의 서브셋인지 슈퍼셋인지)를 `0-common.md §4.2`에 명시적으로 cross-ref. 구현 전 명확화 권장.

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md §6.1` — `__continue__` ID vs `spec/5-system/4-execution-engine.md §2.2` Continuation Bus `button_click` 메시지

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md §6.1` — "link 전용 시 `[Continue →]` 암시적 버튼 표시 → `__continue__` ID로 WS 명령"
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.2` — `execution.click_button: { executionId, nodeId, buttonId }`. `buttonId`가 `__continue__`일 때의 처리가 WS spec에서 명시적으로 기술되지 않음
- **상세**: `0-common.md`는 link-only 버튼 상황의 Continue 클릭 시 `__continue__` buttonId로 `execution.click_button` WS 명령을 보낸다고 정의한다. WS spec은 `click_button` 명령의 payload shape만 정의하고, `__continue__` 특수 ID의 의미와 엔진 처리를 별도 기술하지 않는다. 구현자가 두 spec을 함께 참조하지 않으면 특수 ID 처리를 누락할 수 있다.
- **제안**: WS spec §4.2의 `execution.click_button` 비고에 `__continue__` 특수 ID 처리를 cross-ref 추가. 또는 `0-common.md §6.1`에서 WS spec cross-ref 추가. 구현 착수 전 두 spec 중 하나에 명시 권장.

---

### [INFO] `_product-overview.md` ND-CL-08 — Carousel per-item 버튼 "최대 5개/아이템" vs `0-common.md §1.1` "노드당 최대 5개"

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md §1.1` — "최대 버튼 수: 노드당 최대 5개 (globalButtons). Carousel `itemButtons` 도 각 아이템당 5개"
- **충돌 대상**: `spec/4-nodes/_product-overview.md §9.1 ND-CL-08` — "Static 모드: 각 아이템마다 개별 버튼 구성 (최대 5개/아이템)"
- **상세**: 두 spec이 동일한 5개 cap을 기술하고 있어 직접 모순은 없다. 그러나 `0-common.md §1.1`은 global 5 + item 5 = 최대 10이라는 합산 모델을 명시하는 반면, `_product-overview.md`는 아이템당 5개만 언급하고 globalButtons와의 합산 모델을 기술하지 않는다. 구현자가 globalButtons 5개 cap을 별도로 파악해야 한다.
- **제안**: INFO 수준의 명명 비일관성. `_product-overview.md` ND-CL-08에 globalButtons 5개 별도 cap과 합산 가시 모델(최대 10)에 대한 짧은 비고 추가 권장.

---

## 요약

`spec/4-nodes/6-presentation/0-common.md`는 구조적으로 다른 영역과 심각한 데이터 모델 또는 API 계약 충돌을 일으키지 않는다. 그러나 두 개의 WARNING 등급 충돌이 존재한다. 첫째, `_product-overview.md`의 ND-CL-07 등 4개 요구사항과 WS spec §4.4 예시가 "선택적 타임아웃"을 기술하는 반면 `0-common.md`는 "무제한 대기"를 정의한다. 이 충돌은 기존 plan(`spec-drift-ws-button-config.md` C2/C3)에서 이미 추적 중이며 WS spec과 product-overview 예시를 정합화하는 것이 해결 방향이다. 둘째, WS spec §4.4의 `buttonConfig.nodeOutput` 예시에 Principle 1.1.4에서 금지한 `type` 판별자 키가 여전히 남아 있다. 두 WARNING은 `0-common.md` 자체를 수정하는 것이 아니라 WS spec과 product-overview를 `0-common.md`에 맞춰 갱신하는 방향으로 해소할 수 있다. 나머지 INFO 항목들은 cross-reference 명확화 및 명명 보완 수준이다. 구현 착수를 차단하는 CRITICAL 충돌은 없다.

---

## 위험도

MEDIUM

STATUS: SUCCESS
