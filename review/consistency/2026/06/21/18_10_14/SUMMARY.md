# Consistency Check 통합 보고서

**BLOCK: YES** — cross_spec checker 에서 Critical 위배 1건 발견 (단, 아래 developer 판정 참조: 본 refactor 와 무관한 pre-existing spec 모순).

## 전체 위험도
**MEDIUM** — Critical 1건(spec 간 직접 모순), Warning 1건(타입 표기 불일치), Info 4건.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Multi Turn 모드 조건 0개 시 `out` 포트 존재 여부 — 두 spec 파일이 직접 모순 | `spec/4-nodes/3-ai/1-ai-agent.md §3.2` ("조건 0개도 `out` 포트 없음, dangling") | `spec/4-nodes/_product-overview.md` ND-AG-24 ("조건 0개 시 `out` + `error` 존재, 하위 호환") | ND-AG-24 의 "조건 0개 시 `out` + `error` (하위 호환)" 문구를 제거하거나, `1-ai-agent.md §3.2` migration note 를 ND-AG-24 와 정합. 현재 `1-ai-agent.md §3.2` 가 최신 의도를 반영하는 것으로 보이므로 ND-AG-24 를 갱신하는 방향 권장. |

> **developer 판정 (2026-06-21, M-1 1단계 AiConditionEvaluator 추출)**: 본 Critical 은 **두 spec 문서 간 사전 존재(pre-existing) 모순**으로, 이번 구현(condition 평가 로직의 behavior-preserving 내부 추출)이 **유발하지도 의존하지도 않는다**. 추출 대상(`classifyToolCalls`/`extractConditionReason`/`buildConditionSystemPromptSuffix`/`buildConditionTools`/`condToolName`)은 모두 조건 도구 정의·tool_call 분류·사유 추출만 담당하며, "조건 0개 시 `out` 포트 라우팅" 동작은 핸들러에 잔류(미변경)다. 따라서 **이 refactor PR 의 차단 사유가 아님** — 해소는 `project-planner` 의 spec doc-sync 항목으로 위임(M-7/M-2 보류 spec 항목과 동류). plan §M-1 도 "spec 갱신: 불요" 로 명시.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `includeSystemContext` / `systemContextSections` 타입 표기 불일치 — optional vs non-optional | `spec/4-nodes/3-ai/3-information-extractor.md §1 config 표` (`Boolean?`, `String[]?`) | `spec/4-nodes/3-ai/0-common.md §11.1` (`Boolean`, `String[]`, non-optional) 및 `2-text-classifier.md` | `3-information-extractor.md` config 표의 두 필드를 `Boolean`, `String[]` 으로 수정해 통일 (planner — 본 refactor 무관). |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `0-common.md §10` 의 `§1.4` 참조가 내부 절로 오해될 수 있음 | `spec/4-nodes/3-ai/0-common.md §10` | 절대 링크로 갱신 (planner). |
| 2 | cross_spec | `0-common.md §5` 제목 "(Principle 11)" 이 `node-output.md Principle 11` 과 명칭 혼동 가능 | `spec/4-nodes/3-ai/0-common.md §5` | 제목에서 "(Principle 11)" 제거 또는 구분 주석 (planner). |
| 3 | naming_collision | `embeddingModelConfigId` — KB 엔티티 동명 필드와 의미 중복(수용된 공유 패턴) | AI Agent / Information Extractor 노드 config 필드 | 현행 유지 (의도적 재사용). |
| 4 | naming_collision | `SystemContextSection` / `SystemContextPrefix` — `ExecutionContext` 와 표기 근접 | `nodes/ai/shared/system-context-prefix.ts` | 현행 유지 (레이어 분리). |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | CRITICAL 1건(multi-turn out 포트 모순, **pre-existing·본 refactor 무관**) + WARNING 1건 + INFO 2건 |
| rationale_continuity | success | 차단 발견 없음 |
| convention_compliance | success | 차단 발견 없음 |
| plan_coherence | success | 차단 발견 없음 |
| naming_collision | NONE | 차단 발견 없음. INFO 2건(의도적 재사용 패턴) |

---

## 권장 조치사항

1. **(BLOCK 사유 — 본 refactor 와 무관, planner 위임)** `spec/4-nodes/_product-overview.md` ND-AG-24 ↔ `1-ai-agent.md §3.2` 의 조건 0개 `out` 포트 모순을 planner 가 정합. 본 M-1 1단계 PR 은 behavior-preserving 이라 이 모순을 건드리지 않으므로 차단되지 않음.
2. **(Warning — planner)** `3-information-extractor.md §1` 의 `includeSystemContext`/`systemContextSections` 타입을 non-optional 로 통일.
3. **(Info — 선택)** §10 `§1.4` 절대 링크, §5 제목 명칭 정리.
