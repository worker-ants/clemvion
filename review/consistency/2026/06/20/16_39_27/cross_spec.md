## 발견사항

### [WARNING] `spec/4-nodes/0-overview.md §1.3` 의 기존 서술과 draft 변경안 사이 부분 중첩

- **target 위치**: plan/in-progress/spec-draft-port-id-uuid-slug.md 변경안 #1 (`4-nodes/0-overview.md §1.3` line 123)
- **충돌 대상**: `spec/4-nodes/0-overview.md` line 119–121 (현재 §1.3 "포트 ID 생성 규칙" 말미 "UUID v4 는 사용하지 않는다" 구절)
- **상세**: 현재 `spec/4-nodes/0-overview.md §1.3` 의 포트 ID 생성 규칙 블록 마지막 문장은 "검증·해석 단일 출처는 backend `nodes/core/port-id.util.ts` 와 frontend `lib/node-definitions/resolve-dynamic-ports.ts` 가 lockstep 으로 보유한다. (UUID v4 는 사용하지 않는다.)" 라고 되어 있다. draft 는 이 "(UUID v4 는 사용하지 않는다.)" 구절을 삭제하고 slug-regex 혼합 생성 모델 설명으로 교체하도록 제안한다. 이 변경 자체는 코드 정합에 맞고 바람직하나, `4-nodes/0-overview.md §1.3` 의 기존 본문 중 "slug 는 `^[a-zA-Z0-9_-]{1,64}$` 형식이며, 형식을 벗어나면 인덱스 기반 fallback(`case_0`, `branch_1` 등)으로 떨어진다. 포트 이름 변경, 재정렬, 다른 포트 삭제 등 편집 작업에도 **기존 slug id 는 불변**" 이라는 현행 문장은 이미 올바르게 코드 정합 모델을 기술하고 있다. 즉 draft 의 교체 대상은 마지막 괄호 문장 "(UUID v4 는 사용하지 않는다.)" 하나이며, 기존 §1.3 본문 전체를 재작성할 필요는 없다. draft 가 새로 삽입할 문장이 기존 §1.3 에 이미 존재하는 내용(slug-regex 형식·fallback·불변성)을 중복 기술하지 않도록 주의해야 한다. "생성은 노드별 — Switch case·Filter 등은 사용자 입력 의미 slug, AI Agent ConditionDef·Presentation ButtonDef 등은 frontend `crypto.randomUUID()` UUID v4(또한 slug-regex 통과)" 부분만 순증(追加)으로 처리하면 중복 없이 깔끔하다.
- **제안**: 변경안 #1 적용 시 기존 §1.3 본문의 slug-regex·fallback·불변성 절을 유지하고, "(UUID v4 는 사용하지 않는다.)" 문장만 제거한 뒤 "생성 출처는 노드별 — Switch/Filter 는 사용자 입력 의미 slug, AI Agent ConditionDef·Presentation ButtonDef 는 `crypto.randomUUID()` UUID v4(slug-regex 통과). SoT: `port-id.util.ts`" 문장을 말미에 추가하는 최소 교정을 권장한다.

---

### [WARNING] `spec/4-nodes/1-logic/0-common.md §7` 교체 범위와 기존 정의의 정합

- **target 위치**: 변경안 #2 (`4-nodes/1-logic/0-common.md §7` line 140)
- **충돌 대상**: `spec/4-nodes/1-logic/0-common.md §7` 현재 본문 ("동적 포트: 생성 시 **UUID v4** 를 할당") 및 `spec/4-nodes/0-overview.md §1.3` (SoT 참조 관계)
- **상세**: `1-logic/0-common.md §7` 은 If/Else·Switch·Filter·AI Agent 조건 도구 등 Logic 카테고리 전체의 동적 포트 ID 불변성 규칙을 기술한다. 현재 "동적 포트: 생성 시 **UUID v4** 를 할당" 이라 되어 있는데, draft 는 이를 "slug-regex 유효 stable id 부여" 로 교체하고 "Switch case 는 사용자 입력 의미 slug, AI Agent 조건 등은 `crypto.randomUUID()` UUID v4(slug-regex 통과). 편집에도 불변. SoT 노드 §1.3 / `port-id.util.ts`" 로 대체한다. 이 변경은 Logic 카테고리의 두 생성 경로(Switch slug vs AI Agent UUID v4)를 모두 커버하므로 실질 내용은 정합하다. 단, `1-logic/0-common.md §7` 이 Logic 카테고리 전용 문서인데 AI Agent(ai 카테고리)의 ConditionDef UUID v4 를 여기서 기술하면 책임 경계가 불명확해진다. Logic 노드(Switch/Filter) 는 slug, AI Agent 조건은 ai 카테고리 spec(`3-ai/1-ai-agent.md`, `3-ai/_product-overview.md ND-AG-20`)이 따로 정의하고 있으므로, `1-logic/0-common.md §7` 에서는 Logic 노드 범위의 서술만 하고 AI Agent 쪽은 노드 §1.3 SoT 참조로 위임하는 것이 계층 책임에 맞는다.
- **제안**: 변경안 #2 에서 AI Agent 조건 UUID v4 언급은 제거하고 "Logic 동적 포트: slug-regex 유효 stable id (Switch case 는 사용자 입력 의미 slug, 편집에도 불변). SoT 노드 §1.3 / `port-id.util.ts`" 로만 기술한다. AI Agent 생성 방식은 `3-ai/1-ai-agent.md` 와 `3-ai/_product-overview.md ND-AG-20` 이 관할한다.

---

### [WARNING] `spec/3-workflow-editor/1-node-common.md §1.5` 에서 Merge·Parallel 포트 ID 처리가 누락될 위험

- **target 위치**: 변경안 #3 (`3-workflow-editor/1-node-common.md §1.5` line 97 표)
- **충돌 대상**: `spec/3-workflow-editor/1-node-common.md §1.5` 현재 본문 ("동적 포트(Switch 케이스, Parallel 분기, Merge 입력, Text Classifier 카테고리 등)")
- **상세**: 현재 §1.5 는 "동적 포트(Switch 케이스, Parallel 분기, Merge 입력, Text Classifier 카테고리 등)" 를 함께 언급하며 "UUID v4 를 할당" 한다고 기술한다. draft 는 표의 "ID 생성" 행만 "slug-regex 유효 stable id 부여 — 에디터 기본 `crypto.randomUUID()`(UUID v4, slug-regex 통과), Switch case 등은 사용자 입력 의미 slug. SoT 노드 §1.3" 으로 교체하는데, 여기서 "에디터 기본 `crypto.randomUUID()`" 가 Parallel 분기·Merge 입력·Text Classifier 카테고리 등에도 해당되는지, 아니면 AI Agent ConditionDef·ButtonDef 에만 해당되는지 명확하지 않다. 특히 Parallel 분기 ID 는 현행 코드에서 어떤 방식으로 생성되는지 §1.5 를 수정하는 draft 에서 언급이 없다. `3-workflow-editor/1-node-common.md §1.5` 는 에디터 레이어 관점에서 모든 노드 종류의 동적 포트를 포괄하므로, 변경 후 Parallel/Merge/Text Classifier 등의 ID 생성 방식이 불명확하게 남을 수 있다.
- **제안**: 변경안 #3 에서 "에디터 기본 `crypto.randomUUID()`" 를 열거하는 대신 "생성 방식은 노드별 — 상세 SoT 는 노드 §1.3" 으로 위임하고, §1.5 에는 에디터 공통 불변성 원칙(ID 불변·엣지 유지·포트 삭제 시 엣지 삭제)만 유지하는 것이 계층 책임에 맞는다.

---

### [INFO] `spec/4-nodes/3-ai/_product-overview.md ND-AG-20` 과 `3-ai/1-ai-agent.md §2 ConditionDef.id` 의 "UUID v4 할당" 표현 명료화 일관성

- **target 위치**: 변경안 #4 (`3-ai/_product-overview.md ND-AG-20`) 및 변경안 #5 (`3-ai/1-ai-agent.md §2 ConditionDef.id`)
- **충돌 대상**: 현재 ND-AG-20 ("포트 ID는 생성 시 UUID v4로 할당되어 불변 유지된다"), `3-ai/1-ai-agent.md` line 79 ("id | UUID | ✓ | ... 생성 시 UUID v4 할당, 이후 불변")
- **상세**: draft 는 두 위치를 "유지 + 명료화만" 하도록 제안한다. 이는 올바른 방향이다. 두 위치 모두 UUID v4 라는 사실(코드 정합)을 그대로 유지하면서 "(UUID v4 는 slug-regex `^[a-zA-Z0-9_-]{1,64}$` 통과 유효 포트 ID — 노드 §1.3)" 를 괄호로 추가하는 것이므로 모순은 없다. 단 `3-ai/1-ai-agent.md` line 79 의 `id | UUID | ✓` 타입 컬럼이 "UUID" 로만 표기돼 있는데, 노드 §1.3 이 slug-regex 통과 안정 문자열이라는 상위 개념으로 재정의된 후에도 ConditionDef.id 의 타입 컬럼이 "UUID" 로 남아 있으면 읽는 사람이 "UUID 형식만 허용" 으로 오해할 수 있다. 타입을 "String (UUID v4)" 또는 "String (slug-regex 통과 UUID v4)" 로 더 명확히 표기하는 것이 좋다.
- **제안**: `3-ai/1-ai-agent.md §2 ConditionDef.id` 타입 컬럼을 "UUID" 에서 "String (UUID v4)" 로 변경하고, 설명에 "(slug-regex `^[a-zA-Z0-9_-]{1,64}$` 통과 유효 포트 ID — 노드 §1.3)" 를 추가하면 `6-presentation/0-common.md §1 ButtonDef.id` 의 "String (UUID v4)" 표기와 일치해 cross-spec 명명 일관성이 높아진다.

---

### [INFO] `spec/4-nodes/6-presentation/1-carousel.md` line 429 의 "UUID v4 자동 할당" 은 무수정 — `spec/4-nodes/6-presentation/0-common.md §1` ButtonDef.id 와 정합 확인

- **target 위치**: draft 에서 carousel.md:429 를 무수정으로 유지한다고 명시
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md §1` ("id | String (UUID v4) | 자동 생성 | 불변 버튼 식별자") 및 §10.5 step 3 `backfillButtonUuids`
- **상세**: carousel.md line 429 "버튼 추가 시 UUID v4 자동 할당 (ID 불변)" 은 presentation 공통 §1 ButtonDef 정의 및 §10.5 `backfillButtonUuids` 와 완전 정합한다. ButtonDef.id 는 UUID v4 이고 slug-regex 를 통과하므로 draft 제외 결정은 올바르다. 이 항목은 정합 확인 목적의 INFO.

---

### [INFO] `spec/4-nodes/3-ai/_product-overview.md ND-AG-17` 의 "정제된 UUID" 는 LLM 도구명이며 포트 ID 아님 — 오염 없음

- **target 위치**: draft §"제외 (포트 ID 아님)" 섹션
- **충돌 대상**: `spec/4-nodes/3-ai/_product-overview.md` line 77 (ND-AG-17: "도구 이름은 `cond_` 접두사 + 정제된 UUID")
- **상세**: draft 가 올바르게 제외 처리했다. ND-AG-17 의 "정제된 UUID" 는 LLM tool call 에서 사용되는 도구 이름(`cond_<sanitized_uuid>`)이지 포트 ID 가 아니다. `3-ai/1-ai-agent.md` line 243 ("UUID 내 `-` 등 비영숫자 문자를 `_`로 치환하여 LLM API 호환성 보장") 과 일치한다. 이 분리는 명확하다.

---

## 요약

draft 는 코드 정합 방향이 정확하며 핵심 오류(§1.3의 "(UUID v4 는 사용하지 않는다)" 구절)를 올바르게 식별했다. Cross-spec 관점에서 중요한 위험은 두 가지다: (1) 변경안 #2(`1-logic/0-common.md §7`)에서 Logic 카테고리 전용 문서에 AI Agent(ai 카테고리) 의 UUID v4 생성 방식을 혼재시키면 계층 책임 경계가 흐려진다. (2) 변경안 #3(`3-workflow-editor/1-node-common.md §1.5`)에서 Parallel·Merge·Text Classifier 등 에디터 레이어의 다른 동적 포트 노드의 ID 생성 방식이 기술 범위에서 빠질 수 있다. 두 CRITICAL 수준 모순은 없으며, ND-AG-20·ConditionDef.id·carousel.md 의 처리 방향은 올바르다. 전체적으로 채택 가능한 draft 이나 변경안 #2·#3 의 계층 책임 기술 범위를 좁히고, §1.3 교체 시 기존 본문의 중복 없이 최소 증분 교정으로 처리하는 것을 권장한다.

## 위험도

LOW
