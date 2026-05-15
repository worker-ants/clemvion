충분한 정보를 수집했습니다. 이제 cross-spec 일관성 점검 결과를 작성하겠습니다.

---

## 발견사항

---

### [WARNING] `spec/5-system/4-execution-engine.md` §5.5 ExpressionContext 구성 표에 `$thread` 누락

- **target 위치**: Draft §6 — `spec/5-system/5-expression-language.md` §4.1에 `$thread` 행 추가. Draft §4 — `spec/5-system/4-execution-engine.md` §6.1에 `conversationThread` 필드 추가
- **충돌 대상**: `spec/5-system/4-execution-engine.md` §5.5 (ExpressionContext 구성) — 표현식 컨텍스트의 모든 변수와 그 소스를 열거하는 권위 있는 표
- **상세**: Draft는 expression-language.md §4.1에 `$thread`를 추가하고, execution-engine.md §6.1에 `conversationThread`를 추가하지만, **execution-engine.md §5.5의 ExpressionContext 구성 표** (`$input / $params / $node / $var / $execution / $now / $loop / $item, $itemIndex`)는 변경 범위에 포함되지 않는다. §5.5는 "ExpressionContext 구성"의 단일 진실로 사용되므로, 여기에 `$thread`가 없으면 두 spec 문서가 불일치 상태가 된다.
- **제안**: Draft의 `spec/5-system/4-execution-engine.md` 수정 목록에 §5.5 표 갱신을 추가:
  ```
  | `$thread` | context.conversationThread | ConversationThread readonly view — 사용자 인터랙션 + AI 대화 turn 누적 ([Spec Conversation Thread](../../conventions/conversation-thread.md)) |
  ```

---

### [WARNING] 영속화 §4의 `"in-memory"` 표기가 기존 실행 엔진 §6.2 Redis 저장 전략과 혼동 유발

- **target 위치**: `spec/conventions/conversation-thread.md` (신규) §4 영속화 표 — `"실행 중 | in-memory ExecutionContext"`
- **충돌 대상**: `spec/5-system/4-execution-engine.md` §6.2 (저장 전략) — `"실행 중 | Redis | 실행 컨텍스트를 Redis에 저장 (TTL: 실행 타임아웃 × 2)"`
- **상세**: 기존 실행 엔진 spec은 실행 중 전체 ExecutionContext가 Redis에 직렬화·저장됨을 명시한다. `conversationThread`는 ExecutionContext의 일부이므로 Redis에 포함된다. 그러나 Draft §4 영속화 표에서 `"in-memory"`로만 표기하면 Redis 없이 순수 프로세스 메모리에만 존재한다는 오해를 줄 수 있다 — 특히 Worker 장애 복구(§7.2) 시나리오에서 thread 상태가 어떻게 되는지 불분명해진다.
- **제안**: Draft §4 영속화 표의 해당 셀을 다음으로 명확화:
  ```
  실행 중 | ExecutionContext (실행 엔진 §6.2에 의해 Redis에 포함 직렬화됨) | ...
  ```

---

### [INFO] `spec/1-data-model.md` §2.14 `form_submit` → `form_submitted` 정정은 올바른 동기화

- **target 위치**: Draft §9 — `interaction_data` JSONB 컬럼의 `interactionType` enum을 `"form_submit"` → `"form_submitted"`로 정정
- **충돌 대상**: `spec/conventions/node-output.md` §4.5 및 `spec/5-system/4-execution-engine.md` §1.3 — 양쪽 모두 `"form_submitted"` 사용
- **상세**: 기존 data-model.md가 혼자 `"form_submit"`을 사용하고 있었으나, CONVENTIONS와 실행 엔진 spec은 모두 `"form_submitted"`를 사용 중이었다. Draft의 정정은 올바른 일관성 복원이며 Critical/Warning 수준의 신규 충돌은 없다.

---

### [INFO] `spec/5-system/5-expression-language.md` 자동완성 섹션에 `$thread` 트리거 미기술

- **target 위치**: Draft §6 — expression-language.md §4.1에 `$thread` 추가, §4.4 신설
- **충돌 대상**: `spec/5-system/5-expression-language.md` §7.1 (트리거 조건 표) — `$input.`, `$node["`, `$var.` 등 자동완성 트리거가 열거되어 있음
- **상세**: `$thread`가 §4.1에 추가되었으나 §7.1 자동완성 트리거 조건 표와 §8.4.2 자동완성 데이터 소스 표에는 기술이 없다. 기능상 충돌은 아니지만 spec 완결성 미흡.
- **제안**: §7.1에 `| $thread. | ConversationThread 속성 목록 표시 | context.conversationThread (ConversationThreadService) |` 행 추가 권장.

---

### [INFO] 기존 `conversationHistory` / `historyCount` 필드의 `✓` (required) 마크 처리

- **target 위치**: Draft §3.1 — `spec/4-nodes/3-ai/1-ai-agent.md` §1 설정 표에서 두 필드를 DEPRECATED strikethrough 처리
- **충돌 대상**: 기존 `spec/4-nodes/3-ai/1-ai-agent.md` §1 — `conversationHistory`에 `✓` (필수) 마크
- **상세**: Draft는 strikethrough로 deprecated를 표현하지만, source of truth로 언급된 `backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`의 schema validation도 동시에 조정되어야 한다. spec만 변경하고 schema가 여전히 required로 검증하면 v1 사이클 호환성 시도가 오히려 깨진다. 단, Draft §12.2 Rationale에 "handler 가 읽지 않는 deadweight"임이 명확히 기술되어 있어 schema 변경 방향이 자연스럽게 따라옴.

---

## 요약

Draft의 핵심 설계 — ConversationThread를 1급 ExecutionContext 필드로 도입하고, AI Agent의 노드 설정으로 자동 주입을 제어하며, 기존 `conversationHistory` deadweight를 대체하는 방향 — 는 기존 spec 구조(CONVENTIONS Principle 0~11, 실행 엔진 §6, 표현식 언어 §4, WebSocket §4.4, 데이터 모델 §2.14)와 직접적인 모순이 없다. 발견된 WARNING 2건은 모두 표에서 특정 필드/행이 누락된 문서 정합성 문제이며 기능적 충돌은 아니다. INFO 2건은 문서 완결성 권장 사항이다.

## 위험도

**LOW**

Critical 위배 없음 — spec 채택을 차단할 근거가 없다. WARNING 2건(§5.5 표 갱신, 영속화 용어 명확화)은 spec 반영 시 함께 처리하면 충분하다.