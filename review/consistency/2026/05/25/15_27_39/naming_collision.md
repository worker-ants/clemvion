# 신규 식별자 충돌 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
검토 대상: `spec/4-nodes/6-presentation/0-common.md`
검토 일시: 2026-05-25

---

## 발견사항

### [INFO] frontmatter `id: common` 이 다른 카테고리 공통 문서와 중복

- **target 신규 식별자**: frontmatter `id: common` (`spec/4-nodes/6-presentation/0-common.md` 라인 2)
- **기존 사용처**: `spec/4-nodes/1-logic/0-common.md:2`, `spec/4-nodes/2-flow/0-common.md:2`, `spec/4-nodes/3-ai/0-common.md:2`, `spec/4-nodes/4-integration/0-common.md:2`, `spec/4-nodes/5-data/0-common.md:2` 모두 동일하게 `id: common`
- **상세**: `id` 필드는 각 카테고리 폴더 내의 단일 값이므로 파일 경로 컨텍스트와 결합해야 의미가 확보된다. 현재 같은 `id: common` 값을 모든 카테고리 공통 문서가 공유하고 있어 이 패턴 자체가 spec-impl-evidence 레지스트리나 automated tooling 이 `id` 를 key 로 단독 조회하는 경우 충돌이 발생할 수 있다. 단, 기존 5개 카테고리가 이미 같은 패턴을 사용하고 있으므로 target 이 독자적으로 새 충돌을 도입한 것은 아니다 — 기존 컨벤션을 그대로 따른 것이다. tooling 이 `id` 를 scope-less key 로 사용한다면 6개 문서 모두 영향을 받는다.
- **제안**: 현재로서는 기존 컨벤션을 따른 것이므로 차단 사항은 아니다. 향후 automated spec-coverage 등에서 `id` 를 글로벌 고유 키로 사용할 계획이라면 `id: presentation-common` 처럼 카테고리 prefix 를 붙이는 것을 고려하되, 이는 기존 5개 파일의 동시 변경이 수반되므로 별도 일괄 작업 결정이 필요하다.

---

### [INFO] `excludeFromConversationThread` 필드가 AI 카테고리 공통 규약과 동일 이름으로 정의됨

- **target 신규 식별자**: `excludeFromConversationThread` Boolean config 필드 (`spec/4-nodes/6-presentation/0-common.md` §4.6)
- **기존 사용처**:
  - `spec/4-nodes/3-ai/0-common.md:145` — AI 카테고리 공통 config 필드
  - `spec/4-nodes/3-ai/1-ai-agent.md:39` — AI Agent 노드 config 표
  - `spec/conventions/conversation-thread.md:137, 204` — "각 노드에 공통 boolean config" 로 이미 범 카테고리 규약으로 명문화
- **상세**: 동일 필드명, 동일 타입(`Boolean`), 동일 기본값(`false`), 동일 UI 그룹(`Advanced > Conversation`) 으로 AI 카테고리에 이미 정의되어 있다. `spec/conventions/conversation-thread.md §4` 가 이미 이 필드를 "각 노드에 공통" 으로 선언하고 있으므로, Presentation 카테고리가 동일 이름으로 정의하는 것은 해당 공통 규약을 implement 한 것이다. 의미 충돌은 없고 오히려 일관성을 지킨 것이다. 단, target 문서 §4.6 의 비고 "AI 카테고리 노드의 동명 필드는 [공통 §10](../3-ai/0-common.md#10-conversation-context-자동-컨텍스트-주입) 참조" 가 정합하게 cross-ref 되어 있어 독립 정의처럼 보이지 않는다.
- **제안**: 충돌 없음. 현재 표현으로 적절하다. `conversation-thread.md` 의 범 카테고리 정의를 spec 본문에 명시 인용하면 정합성 가시성이 더 높아진다.

---

### [INFO] `ButtonDef` 타입명이 동 카테고리 내 5개 파일에서 참조되지만 정의는 target 단독

- **target 신규 식별자**: `ButtonDef` 구조체 (§1)
- **기존 사용처**: `spec/4-nodes/6-presentation/1-carousel.md`, `2-table.md`, `3-chart.md`, `5-template.md` 등이 `ButtonDef[]` 타입을 참조. `spec/3-workflow-editor/4-ai-assistant.md:627` 이 `carousel/chart/table/template` 의 `buttons`, `itemButtons`, `items[*].buttons` 를 언급하며 같은 구조를 지칭한다.
- **상세**: target `0-common.md` 가 `ButtonDef` 의 정규 정의 단일 진실이고 나머지 파일들이 `[공통 §1]` 로 참조하는 구조이므로 이름 충돌이 아니라 정의-참조 관계다. 동일 이름을 다른 의미로 사용하는 충돌은 없다.
- **제안**: 이상 없음.

---

### [INFO] `render_table` / `render_chart` / `render_carousel` / `render_template` / `render_form` 이벤트/도구 이름이 AI Agent 문서에 이미 정의됨

- **target 신규 식별자**: §10 에서 `render_table`, `render_chart`, `render_carousel`, `render_template`, `render_form` 도구 이름을 카탈로그화하고 schema 단일 진실 정책 명문화
- **기존 사용처**: `spec/4-nodes/3-ai/1-ai-agent.md:72, 207, 238-242` 등에서 동일 도구 이름이 이미 SoT 로 정의되어 있고, `spec/4-nodes/3-ai/_product-overview.md:85`, `spec/conventions/interaction-type-registry.md:80-84` 에도 동일 이름이 사용됨
- **상세**: target §10.1 이 "parameters JSON Schema 출처" 의 단일 진실을 presentation 공통 spec 측에서 명문화한 것이며, AI Agent 스펙(§4.1, §12.4)과 교차 참조로 연결되어 있다. 두 문서 중 어느 쪽이 SoT 인지 §10 본문이 "AI Agent 의 dispatcher / 종료 시멘틱 / blocking 흐름은 [AI Agent §4.1·§6.1.d·§7.10] 단일 진실" 이라고 명시적으로 구분해 놓았다. 이름 자체의 충돌이 아니라 역할 분담 문서화다.
- **제안**: 이상 없음. 단, §10.1 의 도구 이름 카탈로그와 `spec/conventions/interaction-type-registry.md` 의 `SCHEMA_BY_TYPE` 레지스트리가 같은 도구 이름과 schema 이름을 담고 있어, 향후 도구 추가 시 양측을 동시에 갱신해야 하는 점을 유의한다.

---

### [INFO] `PRESENTATION_MAX_BYTES` 상수 이름이 presentation 공통에서 정의되지만 AI Agent 문서에서도 이름을 직접 인용

- **target 신규 식별자**: `PRESENTATION_MAX_BYTES = 1024 × 1024` 상수 (§4)
- **기존 사용처**: `spec/4-nodes/3-ai/1-ai-agent.md:1250` 에서 `PRESENTATION_MAX_BYTES = 1MB` 를 직접 인용. `spec/4-nodes/6-presentation/2-table.md:151` 에서도 `PRESENTATION_MAX_BYTES` 를 코드 수준 상수 이름으로 참조
- **상세**: target 이 본 상수의 정의 위치이고 다른 문서들이 참조하는 구조이므로 충돌 없음.
- **제안**: 이상 없음.

---

### [INFO] 파일 경로 컨벤션 정합 — `spec/4-nodes/6-presentation/0-common.md`

- **target 신규 식별자**: 파일 경로 `spec/4-nodes/6-presentation/0-common.md`
- **기존 사용처**: `spec/4-nodes/0-overview.md:3` 에서 이미 `[Presentation 노드](./6-presentation/0-common.md)` 로 참조됨
- **상세**: 파일이 이미 존재하고(실제 코퍼스 확인) 기존 참조와 경로가 일치한다. `0-common.md` 명명은 다른 카테고리(`1-logic/0-common.md`, `2-flow/0-common.md` 등) 와 동일 패턴을 따른다. 기존 파일과 겹치거나 명명 컨벤션을 위반하지 않는다.
- **제안**: 이상 없음.

---

## 요약

`spec/4-nodes/6-presentation/0-common.md` 가 도입하는 식별자들은 전반적으로 기존 코퍼스와 충돌하지 않는다. `ButtonDef`, `render_*` 도구 이름, `excludeFromConversationThread`, `PRESENTATION_MAX_BYTES` 등 주요 식별자들은 이미 상위 spec 문서들(AI Agent, conversation-thread 컨벤션, interaction-type-registry)과 명시적 cross-ref 로 역할 분담이 이루어진 상태이며, 동일 이름이 다른 의미로 사용되는 실질적 충돌은 발견되지 않았다. frontmatter `id: common` 이 모든 카테고리 공통 문서에서 중복 사용되는 패턴은 기존 컨벤션을 그대로 따른 것으로, target 이 새롭게 도입한 충돌이 아니다.

---

## 위험도

NONE
