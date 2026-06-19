# 정식 규약 준수 검토 결과

검토 대상: `spec/4-nodes/2-flow/` (`0-common.md`, `1-workflow.md`)
검토 모드: `--impl-done` (diff-base=origin/main)
검토 일시: 2026-06-19

---

## 발견사항

### 1. **[WARNING]** `0-common.md` §2.1 에러 컨트랙트 표에 `WORKFLOW_FORBIDDEN_WORKSPACE` 누락

- **target 위치**: `spec/4-nodes/2-flow/0-common.md` §2.1 에러 컨트랙트 표 (라인 48–53)
- **위반 규약**: `spec/conventions/node-output.md` §3 에러 컨트랙트 통일 — 노드 카테고리 공통 문서가 Runtime 에러 코드의 카테고리 수준 요약을 담는 SoT 역할을 한다는 관례
- **상세**: `1-workflow.md` §6 에러 코드 표에는 `WORKFLOW_FORBIDDEN_WORKSPACE` (W-6 워크스페이스 격리 차단)가 정식 런타임 에러 코드로 추가됐다. 그런데 `0-common.md` §2.1 에러 컨트랙트 표의 "Sync 모드: 서브 워크플로우 런타임 실패" 행 (code 세분화 목록)에는 `SUB_WORKFLOW_NOT_FOUND` / `SUB_WORKFLOW_TIMEOUT` / generic `SUB_WORKFLOW_FAILED` 세 코드만 열거돼 있고 `WORKFLOW_FORBIDDEN_WORKSPACE` 는 언급되지 않는다. 카테고리 공통 문서가 개별 노드 문서(§6)와 에러 코드 목록이 불일치하게 됐다.
- **제안**: `0-common.md` §2.1 "Sync 모드" 행의 code 세분화 목록에 `WORKFLOW_FORBIDDEN_WORKSPACE` (W-6 워크스페이스 격리 차단)를 추가한다. 예시: `... / WORKFLOW_FORBIDDEN_WORKSPACE (W-6 워크스페이스 격리 차단) / 그 외 generic SUB_WORKFLOW_FAILED`.

---

### 2. **[INFO]** `0-common.md`·`1-workflow.md` 양쪽 모두 `## Rationale` 섹션 부재

- **target 위치**: `spec/4-nodes/2-flow/0-common.md` 전체, `spec/4-nodes/2-flow/1-workflow.md` 전체
- **위반 규약**: CLAUDE.md "정보 저장 위치" — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" (권장 3섹션 구성: Overview / 본문 / Rationale)
- **상세**: 두 파일 모두 `## Rationale` 섹션이 없다. `0-common.md` 에는 `recursionDepth` 한도 10 설정, Flow vs Logic 범주 구분, `status` 미발행 설계 등 결정 배경이 있고, `1-workflow.md` 에는 sync 1단 래핑(`output.result`) 설계, fail-closed 전환(PR #637), async fire-and-forget 정책 등 설계 근거가 인라인 서술로 산재한다. CLAUDE.md 는 이를 `## Rationale` 에 모을 것을 권장한다.
- **제안**: 각 파일 말미에 `## Rationale` 섹션을 추가하고 설계 근거를 consolidate 한다. 이 섹션은 필수(build 차단) 가드 항목이 아니라 권장이므로 즉시 수정 없이 후속 spec-cleanup 작업으로 진행해도 무방하다.

---

### 3. **[INFO]** frontend `TurnRagDelta` rename 이 AI 계열 spec Canonical 타입 SoT 와 명칭 불일치

- **target 위치**: `codebase/frontend/src/components/editor/run-results/output-shape.ts` (diff 내 `TurnRagDelta` rename)
- **위반 규약**: `spec/4-nodes/3-ai/0-common.md` §6 Canonical 타입 SoT 및 `spec/4-nodes/3-ai/1-ai-agent.md` §5 — 두 spec 모두 backend canonical `TurnDebugEntry` 를 참조한다
- **상세**: backend canonical SoT (`codebase/backend/src/shared/llm-tracing/llm-call-record.ts`) 의 타입 이름은 `TurnDebugEntry`. AI 공통 spec 및 AI Agent spec 도 `TurnDebugEntry` 로 명시한다. frontend `output-shape.ts` 는 rename 주석에 "동명 충돌 해소" 이유를 기술했지만, 이 rename 이 AI 계열 spec 문서에 반영돼 있지 않아 spec 참조가 구버전 이름을 가리킨다. 두 `TurnDebugEntry` (backend llm-tracing vs frontend RAG delta) 의 의미 도메인이 실제로 다르므로 rename 자체는 합리적이나, spec 정합이 필요하다.
- **제안**: 이번 검토 범위(flow 노드 spec) 외 별도 spec 업데이트 — `spec/4-nodes/3-ai/0-common.md` §6 Canonical 타입 표 및 `spec/4-nodes/3-ai/1-ai-agent.md` §5 에 frontend RAG delta 타입이 `TurnRagDelta` 로 rename 됐음을 반영한다. 규약(node-output / error-codes) 직접 위반은 아니므로 INFO 로 분류한다.

---

## 요약

`spec/4-nodes/2-flow/` 의 두 spec 문서는 정식 규약 준수 측면에서 전반적으로 양호하다. Frontmatter 스키마(id/status/code/pending_plans)는 `spec/conventions/spec-impl-evidence.md` 요건을 충족하고, 에러 코드 표기는 `UPPER_SNAKE_CASE`(`node-output` §3.2, `error-codes` §1)를 준수하며, 출력 포맷 예시는 5필드 invariant(`node-output` Principle 0/11)를 정확히 따른다. 이번 diff 에서 추가된 `WORKFLOW_FORBIDDEN_WORKSPACE` 코드 자체는 명명 규약(의미 기반 명명, `error-codes` §1)을 만족한다. 다만 카테고리 공통 문서(`0-common.md`) §2.1 에러 컨트랙트 표가 개별 노드 문서(`1-workflow.md`) §6 에 추가된 신규 코드를 아직 반영하지 않아 카테고리-레벨 계약과 노드-레벨 계약 간 불일치가 발생했다(WARNING). 나머지 두 항목은 권장 사항 수준의 INFO 이다.

## 위험도

LOW
