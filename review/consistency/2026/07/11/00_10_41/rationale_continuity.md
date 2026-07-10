# Rationale 연속성 검토 — llm-usage 인접 문서 정합 draft (A1/A3, A2·A4 no-op)

대상: `plan/in-progress/spec-llm-usage-adjacent-docs.md`
관점: `spec/data-flow/7-llm-usage.md ## Rationale` 및 `spec/data-flow/0-overview.md ## Rationale` 과의 결정 연속성.

## 발견사항

- **[CRITICAL] A3 "1-data-model.md 는 lean 포인터, 전체 스키마는 7-llm-usage.md §2.1" 이 기존 SoT 분업 원칙을 정면으로 뒤집음**
  - target 위치: `plan/in-progress/spec-llm-usage-adjacent-docs.md` §"변경 세트 (draft)" A3 문단 + `## Rationale` "왜 A3 를 lean 으로" 문단.
  - 과거 결정 출처: `spec/data-flow/0-overview.md ## Rationale` → "### 폴더를 분리한 이유"("기존 `spec/1-data-model.md` 는 엔티티 *정의* 의 단일 진실로 잘 동작한다") 및 "### `spec/1-data-model.md` 와 중복 회피"("각 도메인 문서의 *Schema 매핑 표* 는 entity 의 모든 컬럼을 복사하지 않는다. 해당 흐름에서 실제로 read/write 되는 컬럼만 발췌하고, **전체 정의는 `1-data-model.md` 의 해당 섹션을 링크**한다").
  - 상세: data-flow 폴더 신설 당시 이미 "1-data-model.md = 엔티티 전체 정의의 단일 진실, data-flow/*.md §2 Schema 매핑 = 흐름 관점의 컬럼 발췌 + 1-data-model.md 로 역참조"라는 방향이 명시적으로 합의·기록되어 있다. 이 분업은 llm_usage_log 에 한정된 예외가 아니라 **`1-data-model.md` 전체 37개 엔티티 섹션에 일관 적용**되고 있음을 실측으로 확인했다 — `2.10.1 IntegrationUsageLog`(자매 로그, `data-flow/5-integration.md §2.1` 에도 동일 테이블의 흐름-발췌 행이 별도로 존재), `2.13.1 ExecutionNodeLog`, `2.18/2.18.1/2.18.2` 계열 로그, 심지어 `2.23 AgentMemory`(자기 본문에 "SoT: [Spec Agent Memory]" 라고 **명시적으로 밝히면서도** 필드 전체 표를 그대로 유지)까지 예외 없이 `필드|타입|설명` 전체 표를 갖는다. `1-data-model.md` 안에 "필드 없이 링크만" 인 lean 섹션은 현재 0건이다. 즉 draft 가 근거로 든 "llm_usage_log 는 전용 data-flow 문서를 가지므로 포인터가 정합"이라는 구분 기준은, KnowledgeBase/AgentMemory/Integration 등 **다른 모든 엔티티도 동일하게 전용 data-flow 문서를 가지고 있음에도** 거기서는 적용되지 않는 자의적 예외다. draft 대로 진행하면 llm_usage_log 는 spec 전체에서 "필드 타입·설명이 나열된 canonical 정의가 어디에도 없는" 유일한 엔티티가 되어, 정확히 data-flow/0-overview.md Rationale 이 우려한 "entity 정의가 바뀌면 두 곳이 드리프트" 문제를 (반대 방향 포인터로) 재도입한다. `7-llm-usage.md §2.1` 은 애초에 "해당 흐름에서 read/write 되는 컬럼" 발췌 표(다른 data-flow 문서들과 동형 포맷)로 설계된 것이지, `필드|타입|설명` 형태의 entity 정의 표가 아니다.
  - 제안: A3 를 "lean 포인터"가 아니라 `2.10.1 IntegrationUsageLog` 와 동형의 **전체 필드 표**(`id`/`workspace_id`/`workflow_id?`/`execution_id?`/`node_execution_id?`/`llm_config_id?`/`provider`/`model`/`prompt_tokens`/`completion_tokens`/`total_tokens`/`thinking_tokens?`/`cost_usd?`, 인덱스 V014/V018, nullable attribution 정책 요약)로 재작성. `7-llm-usage.md §2.1` 은 기존 흐름-발췌 포맷을 유지하되 필요하면 "전체 정의는 §2.16.1 참고" 역참조 한 줄만 추가. 만약 이 팀이 "로그성 엔티티는 전용 data-flow 문서가 SoT" 라는 **새로운** 분업 원칙을 의도적으로 도입하려는 것이라면, 그것 자체는 유효한 선택일 수 있으나 `data-flow/0-overview.md ## Rationale` 을 함께 개정해 그 새 원칙과 예외 범위(예: "로그 테이블 한정")를 명시해야 한다 — 현재 draft 는 이 번복을 인지·기록하지 않은 채 조용히 반대 방향 포인터를 도입하고 있다.

## 검증한 항목 (연속성 확인, 이슈 없음)

- **A1 (chat 계열만 적재 표기 정정)**: `6-knowledge-base.md:348` · `13-agent-memory.md:231` 의 "모든 LLM 호출은 `llm_usage_log` 적재" 문구를 실측 확인했고(`grep` 결과 두 곳뿐), `7-llm-usage.md §1.3`/`Overview`/`## Rationale`("모든 호출을 LlmService 로 통합" 항)이 이미 "chat 계열만 usage 적재, embed 는 계측 불가에 따른 현행 한계"로 확정한 것과 정확히 일치한다. 과거 기각 대안의 재도입이나 원칙 위반 없음 — 오히려 stale 서술을 §1.3 SoT 에 맞추는 정합화라 연속성 관점에서 문제 없음.
- **A2 no-op**: `spec/2-navigation/7-statistics.md §2.5`, `spec/2-navigation/9-user-profile.md §6.3`(및 §5.4)을 직접 읽어 "attribution 갭/노드 발 누락" 류 캐비어트가 실제로 없음을 확인했다. attribution 현황의 권위 서술은 `7-llm-usage.md §4`(Statistics/Alerts downstream 행, "노드 발 사용량 반영, 잔여 non-node 만 누락")에 이미 일원화되어 있어 draft 의 no-op 판단은 반증되지 않는다.
- **A4 no-op**: `spec/5-system/4-execution-engine.md`(§1.3 "두 재유도 채널" 문단, §Rationale "resume/retry 턴 usage-log attribution — 식별 필드 재유도 불변식 (#501, 2026-07)")와 `spec/4-nodes/3-ai/1-ai-agent.md §7.4`(`_resumeCheckpoint` 생명주기 비교표 각주)를 직접 읽어, "조작 필드(`node.config` 재평가) vs 식별 필드(`workflowId`/`nodeExecutionId`/`workspaceId`, 호출측 컨텍스트 재유도)" 3-way 구분이 이미 명문화되어 있음을 확인했다. draft 가 겨냥한 "턴 가변 식별자" 문구는 이미 존재 — no-op 판단은 정당하다.

## 요약

A1(cross-ref 문구 정정)과 A2·A4(no-op 판단)는 `7-llm-usage.md §1.3/§4`, `5-system/4-execution-engine.md §1.3/§Rationale`, `4-nodes/3-ai/1-ai-agent.md §7.4` 의 기존 결정과 실측 대조 결과 완전히 정합하며 과거 기각 대안 재도입이나 원칙 위반이 없다. 다만 A3 는 "llm_usage_log 전체 스키마 SoT 를 `7-llm-usage.md §2.1` 로 두고 `1-data-model.md` 는 lean 포인터만 둔다"는 결정을 새 Rationale 로 정당화하려 하는데, 이는 `spec/data-flow/0-overview.md ## Rationale` 이 data-flow 폴더 신설 시점에 명시적으로 합의·기록한 "1-data-model.md = 엔티티 정의의 단일 진실, data-flow 문서 = 흐름 발췌 + 1-data-model 역참조" 원칙과 정면으로 배치되고, `1-data-model.md` 내 37개 엔티티 섹션 전수(자매 로그 IntegrationUsageLog 포함) 어디에도 전례가 없는 예외다. draft 자신의 "IntegrationUsageLog 는 자기 SoT 가 1-data-model.md 라서 full, llm_usage_log 는 전용 data-flow 문서가 있어서 lean" 이라는 구분 근거는 다른 로그·엔티티에도 똑같이 성립하는 조건이라 근거로 성립하지 않는다. 이 항목은 spec 작성 전 반드시 교정하거나, 새 분업 원칙으로 명시적으로 override 해야 한다.

## 위험도

CRITICAL
