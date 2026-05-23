# Cross-Spec 일관성 검토 결과

- 검토 대상: `plan/in-progress/spec-draft-presentation-normalize-button-ids.md`
- 변경 대상 spec: `spec/4-nodes/6-presentation/0-common.md` §10.5
- 검토 일시: 2026-05-23

---

## 발견사항

### [WARNING] AI Agent §6.1.d.i 파이프라인 순서와 draft의 정규화 삽입 위치 표기 불일치

- target 위치: draft §본문 step 3 — "validate 통과 + defaults overlay + 1MB cap 적용 이후, 누락된 button.id 를 UUID v4 로 자동 보완"
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1.d.i
- 상세: AI Agent §6.1.d.i 는 display-only 도구 처리 파이프라인을 `validate → defaults overlay → 1MB cap → presentations[] push` 순서로 명시한다. draft 가 제안하는 normalize 삽입 위치("cap 이후")는 이 파이프라인과 정합하며 모순이 없다. 그러나 AI Agent §6.1.d.i 는 `validate 실패 시 §4.1 "Schema 위반 처리" 적용`만을 언급하고, normalize 단계를 전혀 기술하지 않는다. draft 가 채택되면 §6.1.d.i 의 파이프라인 기술이 `... → 1MB cap → normalize(button.id) → presentations[] push` 로 갱신되어야 한다. 그렇지 않으면 §10.5 (새 step 3) 와 §6.1.d.i 의 파이프라인 기술이 불일치 상태가 된다.
- 제안: draft 적용 시 `spec/4-nodes/3-ai/1-ai-agent.md` §6.1.d.i 의 파이프라인 화살표 체인에 normalize 단계를 동시에 추가한다. 단일 진실이 §10.5 이므로 §6.1.d.i 는 "normalize(button.id) 는 Presentation 공통 §10.5 step 3 참조"와 같은 cross-ref 추가로도 충분하다.

---

### [WARNING] AI Agent §4.1 "Schema 위반 처리" 단계 번호 cross-reference 갱신 필요

- target 위치: draft §본문 step 4 — "재시도 1회 후에도 실패하면 silent drop + meta.presentationSchemaViolations[] 에 누적 ([AI Agent §4.1·§10](../3-ai/1-ai-agent.md#41-presentation-tool-family-render_))"
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §4.1 "Schema 위반 처리" (2-step: 1차 tool_result 에러 회신, 2차 silent drop)
- 상세: draft 는 기존 §10.5 의 step 3 (LLM 재시도/silent drop) 와 step 4 (error 포트 미발화) 가 step 4, 5 로 재번호된다고 명시한다. AI Agent §4.1 은 자체 2-step 번호 체계를 사용하므로 번호 자체는 충돌하지 않는다. 그러나 AI Agent §4.1 에서 `meta.presentationSchemaViolations[]` 의 entry 구조를 `{toolName, issues, attempts}` 로 정의하는데, 현재 §10.5 step 3 의 cross-ref 가 `[AI Agent §4.1·§10]` 형태다. draft 가 이 cross-ref 를 step 4 로 이동하면 해당 링크가 여전히 §4.1 을 정확히 가리키는지 확인이 필요하다. 번호 충돌 자체는 없지만 cross-ref 링크의 의도적 갱신이 요구된다.
- 제안: draft 에서 step 4 의 cross-ref 링크를 명시적으로 `([AI Agent §4.1·§10](../3-ai/1-ai-agent.md#41-presentation-tool-family-render_))` 로 유지하고, 이 링크가 AI Agent spec 의 해당 앵커와 일치하는지 확인 후 적용한다.

---

### [INFO] §1 ButtonDef.id "자동 생성" 원칙 — 적용 범위 확장의 명명 비일관성

- target 위치: draft §본문 step 3 — "(§1 의 "id: 자동 생성, 불변" 원칙을 LLM tool 모드에 일관 적용)"
- 충돌 대상: `spec/4-nodes/6-presentation/0-common.md` §1 ButtonDef 구조
- 상세: 현재 §1 의 id 필드 설명은 "자동 생성" 이라는 단어를 포함하지 않는다. 정확한 기술은 `| id | String (UUID v4) | 자동 생성 | 불변 버튼 식별자` 이며, "필수" 열이 "자동 생성"으로 되어 있어 모호하다. draft 가 "§1 의 'id: 자동 생성, 불변' 원칙"을 인용하지만 §1 의 표 구조에서 "자동 생성"은 필수 여부 컬럼에 위치하므로 직접 인용 시 혼란이 생길 수 있다. 기능 자체의 모순은 없지만 §1 의 표 컬럼 헤더 해석이 다양하다면 혼동의 여지가 있다.
- 제안: §1 ButtonDef 표의 컬럼명을 `| id | String (UUID v4) | 자동 생성 (필수) |` 또는 설명 컬럼에 "워크플로 에디터에서 자동 생성, LLM tool 모드에서도 backend 정규화로 보장" 정도로 명시하면 §10.5 step 3 의 cross-ref 가 더 명확해진다. 필수 변경은 아니며 INFO 수준.

---

### [INFO] §10.3 Defaults Overlay 규칙과 normalize 순서의 명시적 연결 부재

- target 위치: draft §본문 step 3, Rationale "normalize 시점 — validate 후 / cap 이후 / overlay 이후"
- 충돌 대상: `spec/4-nodes/6-presentation/0-common.md` §10.3 Defaults Overlay 규칙
- 상세: §10.3 은 `defaults` 가 LLM 페이로드와 deep-merge 되어 `defaults` 가 우선한다고 정의한다. 이 규칙에서 `buttons[]` 는 defaults 가 비어있지 않으면 교체(replace)된다. draft 의 step 3 은 "사용자가 defaults 또는 LLM payload 에 명시한 id 는 보존"이라고 명시하므로, overlay 이후 id 가 채워진 경우(defaults 에 id 가 있는 경우)는 normalize 대상에서 제외된다는 의도다. 이는 §10.3 의 `defaults 가 후순위 merge`(defaults 가 우선) 및 `Array: defaults 로 교체` 규칙과 결합하면 정합하지만, 두 규칙의 상호작용이 §10.5 step 3 본문에서 명시적으로 언급되지 않아 구현 시 혼동 가능성이 있다. 모순은 아니지만 구현자가 "overlay 후 id 가 채워진 버튼은 normalize skip"을 명시적으로 알아야 한다.
- 제안: step 3 에 "defaults overlay 이후 남아 있는 누락 id 만을 대상으로" 혹은 "overlay 에서 이미 id 가 채워진 버튼은 건드리지 않는다"는 1구절을 추가하면 §10.3 과의 연결이 명확해진다.

---

### [INFO] §10.5 title 변경 — §10.4 의 cross-ref 문구와 불일치 가능성

- target 위치: draft 변경 요지 — "섹션 제목: 'Schema 위반 처리' → 'Schema 위반 처리 및 정규화'"
- 충돌 대상: `spec/4-nodes/6-presentation/0-common.md` §10.4 1MB cap 마지막 문장 — "§10.5 의 schema 위반 흐름을 따른다"
- 상세: §10.4 는 "cap 초과 케이스 중 tail truncate 후에도 element 가 없는 경우 §10.5 의 schema 위반 흐름을 따른다"고 기술한다. 이 문장은 §10.5 의 이름이 "Schema 위반 처리"임을 암묵적으로 가정한다. title 이 "Schema 위반 처리 및 정규화"로 바뀌면 §10.4 의 참조 문구가 구 제목을 가리키게 되어 독자가 헷갈릴 수 있다. 기능적 충돌은 없고, 앵커(#105-schema-위반-처리) 변경 여부에 따라 링크도 영향을 받는다.
- 제안: draft 적용 시 §10.4 의 "§10.5 의 schema 위반 흐름을 따른다" 문구를 "§10.5 의 schema 위반 처리 및 정규화 흐름을 따른다"로 함께 갱신하거나, 앵커가 바뀌는 경우 링크를 재확인한다.

---

## 요약

target draft 가 `spec/4-nodes/6-presentation/0-common.md` §10.5 에 삽입하는 `button.id` 정규화 단계는 기존 spec 어느 영역과도 직접 모순을 일으키지 않는다. `§1 ButtonDef.id "자동 생성"` 원칙의 적용 범위 확장이라는 논리적 일관성도 확보되어 있으며, draft 의 파이프라인 순서(`validate → overlay → cap → normalize`)는 AI Agent §6.1.d.i 가 기술하는 실행 순서와 정합한다. 다만 (1) AI Agent §6.1.d.i 파이프라인 서술에 normalize 단계가 반영되지 않아 두 문서 간 기술 불일치가 발생하며, (2) §10.4 의 §10.5 참조 문구가 title 변경으로 인해 구 제목을 가리키는 상황이 생긴다. 이 두 항목은 draft 채택 시 동시 반영이 권장된다. 나머지 발견사항은 명명 명확성 및 구현 가이드 보강 수준의 INFO 등급이다.

---

## 위험도

LOW

---

STATUS: SUCCESS
