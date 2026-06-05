---
worktree: agent-memory-summary-model-fa4efb
started: 2026-06-05
owner: developer
status: complete
spec_impact:
  - spec/4-nodes/3-ai/1-ai-agent.md
  - spec/5-system/17-agent-memory.md
  - spec/conventions/conversation-thread.md
related_plan: plan/in-progress/ai-context-memory-followup-v2.md
---

# AI Agent 요약/추출 전용 LLM 모델 옵션 (A3)

`summary_buffer` 롤링 요약 LLM 콜과 `persistent` 메모리 추출 LLM 콜에 노드 메인
`model`/`llmConfigId` 와 **다른 저비용 전용 모델**을 지정할 수 있는 두 optional
필드 `summaryModel` / `extractionModel` 도입.

본 plan 이 in-progress 인 동안 `spec/4-nodes/3-ai/1-ai-agent.md` 와
`spec/5-system/17-agent-memory.md` 의 `pending_plans:` 가 본 plan 을 가리킨다.

## Fallback 체인 (핵심 불변식)

```
[전용 필드 summaryModel/extractionModel] → [노드 model] → [llmConfig.defaultModel]
```

미설정 시 기존 동작 100% 유지 (하위호환). `llmConfigId`(provider/credential) 는
노드 것을 그대로 재사용 — 모델 ID 만 분리하고 provider 분리는 하지 않는다.

## 작업

- [x] **Phase A — spec**: §1 config 표 2행, §2 visibleWhen, §6.1 단계 1.5/2.7,
      §12.12 Rationale 번복(과거 scope-freeze 기각 → 현재 도입 근거 명시),
      `5-system/17-agent-memory.md §3`·AGM-04 정합.
- [x] **Phase B — backend**: schema 필드 2개(group 'Memory', visibleWhen),
      요약 경로(`buildSummaryBufferUpdate` model = `summaryModel ?? model`),
      추출 경로(extraction job payload `extractionModel`, processor
      `extractionModel ?? model ?? llmConfig.defaultModel`), TDD 테스트.
- [x] **Phase C — frontend**: `backend-labels.ts` LABEL_KO/HINT_KO 2쌍.

## 결정 근거

§12.12 Rationale 참조 — v1 의 scope-freeze 기각을 의도적으로 번복. 번복 근거:
(1) 보조 콜 저비용 모델로 비용 절감, (2) 메인 추론 품질과 요약/추출 품질 요구가
달라 분리 정당, (3) optional + fallback 으로 기본 동작 회귀 0 (scope-freeze 가
보호하던 불변식 유지). 신규 필드는 모델 ID expression 문자열 1개씩일 뿐
provider 선택 UI 를 추가하지 않으므로 v1 (b) credential UI 우려도 미발생.
