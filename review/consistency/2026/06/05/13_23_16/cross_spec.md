# Cross-Spec 일관성 검토

worktree: memory-backlog-a2-fe9c8f
기준 커밋: 7afa9ae0..HEAD
검토 일시: 2026-06-05

---

## 발견사항

### WARNING — `embeddingModel` widget `'text'→'expression'` 이 spec §1 타입 선언·UI 목업과 불일치
- **target 위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` L596 (`widget: 'expression'`)
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` §1 설정 테이블 (L54) 및 §2 UI 목업 (L144-168)
- **상세**:
  - spec §1 테이블은 `embeddingModel` 을 `String` 으로 선언한다. 다른 Expression 가능 필드(`model`, `systemPrompt`, `userPrompt`, `memoryKey`)는 모두 `String (Expression 가능)` 또는 `String (Expression)` 으로 명시돼 있다. `embeddingModel` 에는 그 어노테이션이 없다.
  - spec §2 UI 목업의 `Memory 섹션 visibleWhen` (L168) 은 `Memory Key / Top-K / Threshold / TTL (days)` 만 `persistent` 조건부 필드로 열거하며, `Embedding Model` 은 목업 ASCII 다이어그램에도 없다.
  - `widget: 'expression'` 은 프론트엔드 `WIDGET_REGISTRY` 에서 `ExpressionWidget` 으로 매핑되어 `{{ }}` 템플릿 입력 UI 를 렌더한다. `widget: 'text'` 는 `TextWidget` (plain string input). 변경 후 사용자에게 노출되는 UI 인터페이스가 달라진다.
  - `spec/5-system/17-agent-memory.md` §3 임베딩 출처 (L66) 는 `embeddingModel` 을 "임베딩 모델 식별자" 로 서술하며, 회수·저장이 같은 모델 문자열을 써야 차원이 일치해야 한다고 설명한다. expression 으로 동적 평가되면 턴마다 다른 모델이 쓰일 가능성이 생기고, spec §3 의 "회수와 저장이 항상 같은 모델을 써야" 불변식과 긴장 관계가 생긴다.
- **제안**:
  - spec `1-ai-agent.md` §1 테이블의 `embeddingModel` 타입 컬럼을 `String (Expression 가능)` 으로 갱신하거나, 또는 widget 을 `'text'` 로 되돌린다. 전자를 선택한다면 §2 UI 목업과 `visibleWhen` 설명에도 `Embedding Model` 필드를 추가해야 한다.
  - `spec/5-system/17-agent-memory.md` §3 임베딩 출처에도 expression 가능 여부와 동적 평가 시 불변식 주의사항을 명시해야 한다.

---

### WARNING — `listScopes` `total=0`(offset 초과 시) 이 spec §6 기존 "페이지네이션" 계약과 충돌 가능
- **target 위치**: `spec/5-system/17-agent-memory.md` §6 신규 추가 라인 (L117), `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` `listScopes` (L574)
- **충돌 대상**: `spec/5-system/17-agent-memory.md` §6 `GET /agent-memories/scopes` 엔드포인트 설명 (L109) — "페이지네이션(`limit`/`offset`)"
- **상세**:
  - 기존 spec 은 `total` 의 의미를 "전체 distinct scope_key 수"로 암묵적으로 정의했다 (별도 COUNT 서브쿼리로 항상 전체 수 반환).
  - 변경된 구현은 `COUNT(*) OVER()` 윈도우 함수 방식으로 단일 쿼리화하면서, `OFFSET` 이 전체 그룹 수를 초과해 0행이 반환되면 `total` 도 `0` 이 된다.
  - 신규 spec 라인은 이 동작을 "UI 는 첫 페이지의 `total` 범위 안에서만 페이지하므로 무해하다"는 단서를 달아 허용한다. 그러나 이 단서는 클라이언트 구현이 "항상 첫 페이지부터 탐색"한다는 가정에 의존한다.
  - `spec/2-navigation/16-agent-memory.md` 의 pagination UI 구현이 직접 임의 offset 으로 `total` 을 참조하는 경우(예: 북마크된 URL, 딥링크, 총 개수 표시), `total=0` 을 수신하면 UI 가 빈 상태나 잘못된 페이지 계산을 보여줄 수 있다.
- **제안**:
  - `spec/2-navigation/16-agent-memory.md` 의 페이지네이션 UI 구현이 첫 페이지의 `total` 범위를 항상 지킨다는 불변식이 보장되는지 확인 후 spec 라인을 유지하거나, 또는 구현에서 offset 초과 시 별도 COUNT 쿼리로 true total 을 반환하도록 수정.

---

### INFO — spec §1 UI 목업에 `Embedding Model` 필드 미반영 (WARNING 과 연동)
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §2 UI 목업 (L144-165) 및 Memory 섹션 visibleWhen 설명 (L168)
- **충돌 대상**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` L590-603 (embeddingModel 필드 정의, `order: 49.5`, `visibleWhen: memoryStrategy === persistent`)
- **상세**: 스키마에는 `embeddingModel` 이 `persistent` 조건부로 렌더되는 Memory 그룹 필드로 선언돼 있으나, spec §2 목업에는 해당 필드가 없다. 현재 Memory 섹션 visibleWhen 설명(L168)도 `Memory Key/Top-K/Threshold/TTL (days)` 만 열거하고 `Embedding Model` 을 누락한다.
- **제안**: spec §2 목업에 `Embedding Model: [text-embedding-3-small]` 행 추가 및 visibleWhen 설명에 `Embedding Model` 을 나열해 스키마·spec 동기화.

---

## 요약

이번 변경(메모리 백로그 그루밍)은 세 가지 spec 영역을 건드린다. (1) `listScopes` 단일쿼리화는 `spec/5-system/17-agent-memory.md` §6 에 1줄을 추가해 offset 초과 시 `total=0` 동작을 허용하는 계약 변경을 도입했는데, UI 가 "첫 페이지 total 범위 안에서만 페이지" 한다는 가정의 보증이 `spec/2-navigation/16-agent-memory.md` 측에서 확인되지 않아 잠재적 API 계약 충돌이다. (2) `embeddingModel` widget `'text'→'expression'` 변경은 `spec/4-nodes/3-ai/1-ai-agent.md` §1 의 타입 선언(`String`, Expression 어노테이션 없음)·§2 UI 목업(해당 필드 미기재)·`spec/5-system/17-agent-memory.md` §3 "항상 같은 모델" 불변식과 정합하지 않는다. (3) 요구사항 ID(AGM-01~13) 충돌·데이터 모델 충돌·RBAC 충돌·상태 전이 충돌은 발견되지 않았다.

## 위험도

MEDIUM

---

BLOCK: NO
