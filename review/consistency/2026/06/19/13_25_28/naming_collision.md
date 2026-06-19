# 신규 식별자 충돌 검토 결과

검토 대상: `spec/4-nodes/2-flow/1-workflow.md`
검토 모드: `--impl-prep` (구현 착수 전)

---

## 발견사항

### 발견사항 1
- **[WARNING]** `SUB_WORKFLOW_NOT_FOUND` / `SUB_WORKFLOW_TIMEOUT` / `SUB_WORKFLOW_QUEUE_FAILED` — 에러 코드 카탈로그 미등재
  - target 신규 식별자: `SUB_WORKFLOW_NOT_FOUND`, `SUB_WORKFLOW_TIMEOUT`, `SUB_WORKFLOW_QUEUE_FAILED` (target §6 에러 코드 표)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` §1.4 Sub-workflow 행 (line 85, 248) — `SUB_WORKFLOW_FAILED` 만 등재되어 있음. 세 개 세분화 코드는 카탈로그에 없음.
  - 상세: target 은 §6 에서 `SUB_WORKFLOW_NOT_FOUND` / `SUB_WORKFLOW_TIMEOUT` / `SUB_WORKFLOW_QUEUE_FAILED` 를 공개 노드 에러 코드(`output.error.code`)로 정의하고, 이들은 `codebase/backend/src/nodes/core/error-codes.ts` (lines 58-60) 에 이미 구현·테스트되어 있다. 그러나 에러 코드 공용 카탈로그인 `3-error-handling.md §1.4` Sub-workflow 행은 `SUB_WORKFLOW_FAILED` 만 열거하며, 세분화 코드 3종은 카탈로그에 누락된 상태다. `3-error-handling.md §1 footnote`(line 91)는 "본 enum 확장 시 분류 표 행 추가 검토 의무"를 명시하고 있어 카탈로그와 구현 간 불일치가 명백하다.
  - 제안: `3-error-handling.md §1.4` Sub-workflow 행을 `SUB_WORKFLOW_FAILED · SUB_WORKFLOW_NOT_FOUND · SUB_WORKFLOW_TIMEOUT · SUB_WORKFLOW_QUEUE_FAILED` 로 확장 등재. Chat Channel 어댑터 분류 표(`conventions/chat-channel-adapter.md §3.1` line 388)도 현재 `SUB_WORKFLOW_FAILED` 만 열거하므로, 세분화 코드가 어댑터 분류 로직에서 의도한 bucket 으로 처리되는지 분류 표 행 추가 검토 필요.

---

### 발견사항 2
- **[WARNING]** `WORKFLOW_FORBIDDEN_WORKSPACE` — 에러 코드 enum 및 카탈로그 미등재
  - target 신규 식별자: `WORKFLOW_FORBIDDEN_WORKSPACE` (target §2 "W-6" 런타임 워크스페이스 격리 안내)
  - 기존 사용처: `3-error-handling.md` 카탈로그 미등재. 구현은 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (line 562) 및 `codebase/backend/src/nodes/core/workflow-executor.interface.ts` (line 10) 에 존재하나 `error-codes.ts` enum 에도 등재되지 않은 인라인 문자열이다.
  - 상세: target 은 `WORKFLOW_FORBIDDEN_WORKSPACE` 를 Pre-flight throw 에러로 언급하나 §6 에러 코드 표에는 이 코드가 없다. `error-codes.ts` 에도 등재되지 않아 enum 밖 인라인 문자열 throw 상태다. `conventions/error-codes.md §1` 은 프로젝트 전체 에러 코드 문자열에 명명 규율을 적용한다고 명시한다. `execution-engine.service.spec.ts:847` 이 이 문자열로 분기하므로 enum 미등재는 추적·안정성 면에서 불안전하다.
  - 제안: `WORKFLOW_FORBIDDEN_WORKSPACE` 를 `error-codes.ts` enum 에 등재하고, target §6 에러 코드 표에도 Pre-flight throw 항목으로 추가한다. 엔진 레벨에서만 발생한다면 `3-error-handling.md §1.4` 엔진 수준 에러 테이블에 등재한다.

---

### 발견사항 3
- **[INFO]** `MappingDef` 타입명 — 동일 이름이 두 노드 도메인에서 독립적으로 참조됨
  - target 신규 식별자: `MappingDef` (target §1 설정 표 — `{ paramName, expression }` 구조 명시)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` line 258 — AI Agent Tool Area `inputMapping` 필드 타입으로 `MappingDef[]?` 참조 (구조 정의 없음)
  - 상세: target 에서 `MappingDef` 는 `{ paramName, expression }` 으로 명시된다. `1-ai-agent.md` 는 동일 타입명을 "도구 파라미터 → 노드 입력 매핑"에 쓰지만 구조를 정의하지 않는다. 의미는 유사하나 동일 shared 타입인지 독립 선언인지 spec 에서 불분명하다.
  - 제안: `1-ai-agent.md` 에 `MappingDef` 필드 구조를 명시하거나 target 정의로의 교차 참조를 추가한다. 두 스키마가 같은 shape 이면 공통 타입으로 추출을 검토한다.

---

### 발견사항 4
- **[INFO]** `W-6` 인라인 레이블 — 복수 도메인에서 서로 다른 항목 레이블로 혼용
  - target 신규 식별자: `W-6` (target §2 "구현됨, W-6" 인라인 레이블)
  - 기존 사용처: `plan/in-progress/spec-draft-unified-model-management.md` line 153 — "Rationale W-6/INFO-6" (RAG 검색 §3.3 이슈 추적). `plan/in-progress/ai-context-memory-followup-v2.md` line 61 — "W-6" (AI Agent 메모리 fallback 정책 체크박스). `plan/in-progress/auth-config-webhook-followups.md` line 21 — "W-6 fix"
  - 상세: `W-6` 은 공식 요구사항 ID 체계(ND-WF-06 스타일)가 아닌 비공식 작업 추적 레이블로 보이나, 네 파일에서 각각 다른 항목을 가리키고 있어 리뷰·추적 시 혼선을 일으킬 수 있다.
  - 제안: target §2 의 "W-6" 레이블을 공식 요구사항 ID(`ND-WF-06` 등) 또는 구체적인 서술형 앵커로 교체한다.

---

## 요약

`spec/4-nodes/2-flow/1-workflow.md` 는 기존 구현된 spec 이며, 도입되는 식별자 대부분이 이미 코드베이스에 존재한다. 신규 식별자 충돌 관점의 주요 발견은 두 가지다. 첫째, target §6 이 공개 에러 코드로 정의한 `SUB_WORKFLOW_NOT_FOUND` / `SUB_WORKFLOW_TIMEOUT` / `SUB_WORKFLOW_QUEUE_FAILED` 세 종이 `error-codes.ts` 에는 구현됐으나 `spec/5-system/3-error-handling.md §1.4` 공용 카탈로그에서 누락되어 있다. 둘째, `WORKFLOW_FORBIDDEN_WORKSPACE` 가 엔진 코드에서 사용되나 `error-codes.ts` enum 에도, 에러 카탈로그에도 등재되지 않아 추적 불가 상태다. 두 이슈 모두 카탈로그 보완으로 해소할 수 있으며 구현 착수를 차단할 수준의 의미 충돌은 없다. `MappingDef` 동명 사용과 `W-6` 레이블 중복은 명세 명확화 수준이다.

## 위험도

MEDIUM
