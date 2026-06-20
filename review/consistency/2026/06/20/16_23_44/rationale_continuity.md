# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-port-id-uuid-slug.md`
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

### [WARNING] `spec/4-nodes/1-logic/0-common.md §7` 의 UUID v4 서술 — SoT 기각 결정이 없는 상태에서 변경 시도

- **target 위치**: target 문서 "변경안 #1" — `4-nodes/1-logic/0-common.md §7` (line 140) 의 "UUID v4 → stable slug" 정정
- **과거 결정 출처**: `spec/4-nodes/1-logic/0-common.md §7` 자체는 현재 "UUID v4 를 할당" 을 명시하고 있으며, **이 문서에 `## Rationale` 섹션이 없다**. 즉 UUID v4 채택에 대한 배경 Rationale 가 해당 문서에 기록된 바 없다.
- **상세**: 현행 `0-common.md §7` (line 140)의 UUID v4 서술은 Rationale 없이 기입된 구 초안 서술이다. 반면 실제 SoT `spec/4-nodes/0-overview.md §1.3` 은 "stable slug id, UUID v4 는 사용하지 않는다" 로 이미 확정됐다. target 문서는 이 변경을 "새 결정·번복이 아닌 잔존 4문서 일원화" 로 자체 분류하고 있으며, 그 근거는 타당하다. 그러나 `0-common.md §7` 이 UUID v4 를 채택했던 명시적 Rationale(기각된 대안 근거)가 해당 파일에 없으므로, "무근거 번복" 이라기보다 **"Rationale 가 없던 구 서술을 SoT 에 맞게 교정"** 에 해당한다. 이 케이스 자체는 올바르게 처리된다. 단, target 문서가 `## Rationale` 섹션 신설 대상을 `4-nodes/0-overview.md` 로만 지목하고, `1-logic/0-common.md` 에는 SoT 참조 포인터만 남기는 구조가 명확히 서술되어 있다면 문제 없다.
- **제안**: 변경안 #1 에서 `0-common.md §7` 변경 텍스트에 "SoT: 노드 §1.3 / `port-id.util.ts`" 참조를 포함하도록 이미 기술되어 있어 보완이 내포됨. 추가적으로 `0-common.md` 에 `## Rationale` 부재 사실을 명시하거나, 변경안 텍스트가 SoT 포인터를 포함하는 것으로 갈음함을 plan 에 명기 권장.

---

### [INFO] `spec/4-nodes/3-ai/_product-overview.md` ND-AG-17 "정제된 UUID" 유지 — 포트 ID 아닌 도구명 UUID 이므로 제외 처리가 정확

- **target 위치**: target 문서 "제외" 섹션 — ND-AG-17
- **과거 결정 출처**: `spec/4-nodes/3-ai/_product-overview.md` line 77 — "도구 이름은 `cond_` 접두사 + 정제된 UUID 로 자동 지정"
- **상세**: target 이 ND-AG-17 을 정정 대상에서 의도적으로 제외("LLM 도구명 생성용, 포트 ID 아님")한 것은 Rationale 연속성 관점에서 정확하다. 포트 ID slug 결정은 포트 식별자에만 적용되며, LLM 도구 이름 네이밍(UUID-derived string)은 별개 도메인이다. 기존 AI Agent 노드 spec 에 이 구분에 대한 명시적 Rationale 는 없지만 target 의 제외 근거가 도메인 구분으로 충분히 설명된다.
- **제안**: Rationale 보완 관점에서, 향후 `4-nodes/3-ai/_product-overview.md` 의 `## Rationale` 에 "ND-AG-17 도구명 UUID 와 포트 ID slug 는 별개 식별자 도메인" 임을 한 줄 명기하면 후속 혼동 방지에 도움됨.

---

### [INFO] `spec/4-nodes/6-presentation/1-carousel.md` line 429 UUID v4 서술 — 동일 문서 내 §1·§3 예시·Principle 6 와 충돌 해소가 목적

- **target 위치**: target 문서 "변경안 #4" — `carousel.md` line 429
- **과거 결정 출처**: `carousel.md` 자체 §1·§3 예시(`{"id":"approve"}`, `<button.id>` Principle 6)는 이미 user-set slug id 를 정의하고 있다.
- **상세**: carousel.md line 429 의 "UUID v4 자동 할당" 은 동일 문서 내 다른 섹션과 모순인 상태였다. target 변경안은 이를 문서 내부 정합으로 교정한다. 이는 새로운 결정 도입이 아니라 동문서 내 일관성 회복이다. Rationale 연속성 위반에 해당하지 않는다.
- **제안**: 없음. target 처리 방향 타당.

---

### [INFO] `spec/4-nodes/0-overview.md` `## Rationale` 신설 — UUID→slug 결정 근거 영속화

- **target 위치**: target 문서 "Rationale (0-overview.md `## Rationale` 에 등재할 내용)" 섹션
- **과거 결정 출처**: `spec/4-nodes/0-overview.md` 에는 현재 `## Rationale` 섹션이 **부재**하다 (impl-done INFO #3 에서도 지적됨).
- **상세**: target 이 제안하는 Rationale 신설 내용(엣지 보존·가독 포트 ID·직렬화 안정성 3가지)은 `§1.3` 에 이미 기술된 결정을 Rationale 로 영속화하는 것이며, 기존 어떤 spec Rationale 에서도 slug 방식을 기각하거나 UUID 방식을 채택해야 한다고 명기한 항목이 없다. 신설 자체가 Rationale 연속성을 강화하는 방향이다.
- **제안**: 없음. 적극 권장.

---

### [INFO] `spec/3-workflow-editor/1-node-common.md` "ID 생성" 행 — UUID v4 기술이 §1.3 SoT 를 선행 참조 없이 단독 존재

- **target 위치**: target 문서 "변경안 #2" — `3-workflow-editor/1-node-common.md` line 97 표
- **과거 결정 출처**: `spec/3-workflow-editor/1-node-common.md §1.5` 동적 포트 ID 규칙 표 — "ID 생성 | 동적 포트 추가 시 UUID v4 를 할당한다"
- **상세**: 이 행 역시 UUID v4 서술을 담고 있으나 `## Rationale` 섹션이 해당 파일에 있는지 확인이 필요하다. target 변경안은 SoT 포인터를 포함하는 교체 텍스트를 제공하고 있어 정합 방향은 맞다. `1-node-common.md` 에 독립적인 UUID 채택 Rationale 가 없었으므로 무근거 번복이 아닌 일원화다.
- **제안**: `3-workflow-editor/1-node-common.md §1.5` 에도 `## Rationale` 에 "(포트 ID 결정 근거는 노드 §1.3 참조)" 한 줄 크로스 레퍼런스를 두면 장기적 유지보수에 유리.

---

## 요약

target 문서(`spec-draft-port-id-uuid-slug.md`)는 `spec/4-nodes/0-overview.md §1.3` 이 이미 확정("stable slug, UUID v4 미사용")한 결정을 4개 잔존 문서에 일원화하는 교정 작업이다. 이는 기각된 대안(UUID v4)을 새로 재도입하는 것이 아니라 반대로 이미 기각된 UUID v4 서술을 제거하는 것이며, 합의된 slug 원칙을 강화한다. 명시적으로 거부한 대안을 재채택하거나, 합의 invariant 를 위반하거나, 새 결정을 Rationale 없이 번복하는 케이스는 발견되지 않았다. 발견사항 중 WARNING 1건은 "변경 대상 파일에 원래 UUID 를 채택한 Rationale 가 부재했다"는 맥락 명료화 권고이며 차단 요인이 아니다. INFO 항목들은 추가 Rationale 크로스 레퍼런스를 보완하면 장기 유지보수에 도움이 된다는 권고다. target 은 `0-overview.md §1.3` SoT 와 구현(`port-id.util.ts`) 을 유일한 최종 기준으로 삼아 4건의 정정과 Rationale 신설을 제안하며, Rationale 연속성 원칙을 충실히 따르고 있다.

---

## 위험도

LOW
