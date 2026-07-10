# Cross-Spec 일관성 검토 — llm-usage 인접 문서 정합 draft (A1/A3)

대상 draft: `plan/in-progress/spec-llm-usage-adjacent-docs.md`
SoT: `spec/data-flow/7-llm-usage.md §1.3(Caller 카탈로그) / §2.1(스키마) / §4(외부 의존)`

## 발견사항

- **[WARNING]** A3 `§2.16.1 LlmUsageLog` 를 "필드 테이블 없는 lean 포인터"로 신설하는 것은 `1-data-model.md` 전체 문서의 기존 컨벤션과 유일하게 어긋난다
  - target 위치: draft `A3 — spec/1-data-model.md §2.16.1 LlmUsageLog (신규, lean) + ERD 트리 1줄` 섹션 (draft 파일 §변경 세트 A3, plan §Rationale "왜 A3 를 lean 으로")
  - 충돌 대상: `spec/1-data-model.md` 자신의 §2.1~§2.23 (및 모든 `.N.M` 서브엔티티: §2.10.1 IntegrationUsageLog, §2.12.1~2.12.4, §2.13.1~2.13.3, §2.18.1~2.18.2, §2.23 AgentMemory 등)
  - 상세: `1-data-model.md` 에서 엔티티(테이블)를 나타내는 서브섹션은 예외 없이 `| 필드 | 타입 | 설명 |` 전체 컬럼 테이블을 갖는다 — 실측 결과 §2.1~§2.23 + 모든 하위 `N.M` 엔티티 섹션 전부 테이블 보유, 유일하게 테이블이 없는 `### 2.9.1`은 엔티티가 아니라 동기화 **규칙** 섹션이다. 특히 draft 의 Rationale 이 근거로 드는 "IntegrationUsageLog(§2.10.1)가 full 표인 건 그 로그의 SoT 가 1-data-model.md 자신이기 때문 — llm_usage_log 는 전용 data-flow 문서를 가지므로 포인터가 정합" 이라는 구분은 **AgentMemory(§2.23) 사례로 반증**된다: AgentMemory 도 전용 시스템 문서(`spec/5-system/17-agent-memory.md`, "단일 진실" 로 `1-data-model.md §2.23` 을 명시)를 갖지만, 그 **위성 문서 쪽이 오히려** 전체 컬럼 테이블을 다시 그대로 들고 있다(`17-agent-memory.md §1`, id/workspace_id/scope_key/content/embedding/metadata/created_at/updated_at/expires_at 8컬럼 전부). 즉 이 코드베이스의 실제 관행은 "SoT 가 아닌 쪽도 필드 테이블을 duplicate 하고 `SoT: ...` 각주로 권위만 표시"이지, "SoT 아닌 쪽은 테이블을 생략"이 아니다. `§2.16.1` 만 테이블 없이 프로즈 포인터로 남기면 `1-data-model.md` 를 스캔하는 독자·차기 편집자에게 유일한 예외로 눈에 띄고, "ERD 문서인데 이 엔티티만 컬럼을 안 보여준다"는 의문·후속 PR 에서의 임의 보정(표 추가)로 인한 드리프트 재발 여지가 남는다.
  - 제안: 두 방향 중 하나를 명시적으로 택해 draft 의 Rationale 에 기록할 것을 권장한다 — (a) 기존 관행을 따라 `§2.16.1` 에도 `AgentMemory`/`IntegrationUsageLog` 와 동형의 축약 필드 테이블(컬럼명 + 1줄 설명, nullable 여부)을 두고 `SoT: 7-llm-usage.md §2.1` 각주로 권위만 위임 — 표 자체의 드리프트는 "컬럼 목록만 동기화, 세부 서술은 링크"로 최소화 가능. (b) 계획대로 lean-only 로 가되, 이것이 `1-data-model.md` 최초의 "테이블 없는 엔티티 서브섹션" 예외임을 §2.16.1 본문 또는 draft Rationale 에 **명시적으로 기록**해 향후 리뷰어가 "관행 위반"으로 재차 플래그하지 않도록 한다.

- **[INFO]** `7-llm-usage.md` → `1-data-model.md §2.16.1` 역방향 링크 부재 (선택 사항)
  - target 위치: draft A3 (신규 서브섹션 추가만 명시, 7-llm-usage.md 갱신은 범위 밖)
  - 충돌 대상: `spec/data-flow/7-llm-usage.md` 상단 "관련 문서" 줄(`[데이터 모델 §2.16](../1-data-model.md)`, anchor 없음) 및 §2.1 Postgres 표
  - 상세: A3 로 `§2.16.1` 이 신설돼도 `7-llm-usage.md` 쪽에서 그 신규 앵커로 역참조하는 곳은 없다(현재도 §2.16 ModelConfig 만 가리킴). 기능상 문제는 없으나(1-data-model.md → 7-llm-usage.md 단방향 포인터만으로 discoverability 목적은 달성), `IntegrationUsageLog` 는 `4-integration.md`/`11-mcp-client.md` 등에서 `#2101-integrationusagelog` 로 명시 역링크되는 것과는 비대칭이다.
  - 제안: 선택적 — `7-llm-usage.md` §2.1 표 앞이나 Overview 에 `[데이터 모델 §2.16.1](../1-data-model.md#2161-llmusagelog)` 한 줄 추가하면 양방향 discoverability 가 완성된다. BLOCK 사유 아님.

## 검증 완료 (충돌 없음 — 참고용 근거)

- **A1**: `spec/data-flow/6-knowledge-base.md:348` · `spec/data-flow/13-agent-memory.md:231` 의 "모든 LLM 호출은 llm_usage_log 적재" → "chat 계열만 적재(embed 미적재)" 정정은 SoT `7-llm-usage.md §1.3`(및 §4 외부 의존 표의 KB/Agent Memory 행)와 **정확히 일치**한다. 두 문서 모두 실제로 chat+embed 를 함께 호출함을 코드 레벨로 교차 확인:
  - KB — chat: `graph-extraction.service.ts`(GraphExtractionService), `rerank.service.ts`(cross_encoder_llm listwise). embed: `embedding.service.ts`(청크), `knowledge-base.service.ts`(probeEmbedding), `rag-search.service.ts`(query, 2곳).
  - Agent Memory — chat: `agent-memory-extraction.processor.ts`. embed: `agent-memory.service.ts`(저장/recall).
  - `spec/` 전체를 `모든 LLM 호출` 로 grep 한 결과 이 두 위치 외 "all calls" 식 과잉 일반화 서술은 없음(`3-workflow-editor/4-ai-assistant.md:664` 의 "각 LLM 호출" 은 Assistant 자신의 chatStream 범위로 국소화된 서술이라 상충 아님).
- **A3 스키마 정합**: draft 가 §2.16.1 에 요약하려는 필드군(`workspace_id` 항상 채움, nullable attribution FK 3종 — AI 노드 채움/워크플로우 밖·미배선 caller NULL, `llm_config_id`, 토큰/비용)은 `7-llm-usage.md §2.1` Postgres 표 및 §1.3 "attribution 채움 현황" 각주와 컬럼명·nullable·채움 조건 모두 일치. 새 모순 없음(위 WARNING 은 "표 유무" 구조 문제이지 내용 모순 아님).
- **A2/A4 no-op 판단 재검증**: `spec/2-navigation/7-statistics.md §2.5`, `spec/2-navigation/9-user-profile.md §6.3` 에는 사용량/attribution 갭에 대한 stale 서술이 없음(코드 확인). `spec/5-system/4-execution-engine.md`(§1.3 불변식, §7.5, addendum 1382/1384행), `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/3-information-extractor.md:378` 은 이미 "조작 필드(`node.config`) vs 식별 필드(`workflowId`/`nodeExecutionId`) 재유도" 3-way 구분을 정확히 서술 — 추가 변경 불요 판단 타당.
- **인접 영역 사이드이펙트**: `spec/data-flow/9-observability.md`, `spec/data-flow/3-execution.md`, `spec/data-flow/11-workflow.md`, `spec/5-system/17-agent-memory.md`, `spec/5-system/7-llm-client.md` 를 `llm_usage_log`/"LLM Usage" 로 전수 grep — A1/A3 로 인한 신규 stale 서술이나 dangling anchor 는 없음. `spec/1-data-model.md` 내 `llm_usage_log` 언급은 현재 §2.16 "참조 관계(kind 별)" 1줄뿐이라는 draft 의 전제도 grep 으로 확인됨(§2.16.1 신설 후 그 줄과도 모순 없음).

## 요약

A1(6-knowledge-base.md·13-agent-memory.md 의 cross-ref 행 정정)은 SoT `7-llm-usage.md §1.3`과 코드 레벨까지 정확히 일치하며 다른 spec 영역에 새 충돌을 만들지 않는다. A2/A4 를 no-op 로 남긴 판단도 재검증 결과 타당하다. A3(§2.16.1 LlmUsageLog 신설)은 내용 자체(컬럼·nullable·attribution 서술)는 `7-llm-usage.md §2.1/§1.3` 과 모순이 없으나, "필드 테이블 없이 포인터만" 두는 형식이 `1-data-model.md` 의 예외 없는 기존 관행(모든 엔티티 서브섹션이 전체 컬럼 테이블 보유, AgentMemory 처럼 SoT 가 별도 문서인 경우도 예외 없음)과 유일하게 어긋난다 — 기능적 모순은 아니지만 문서 일관성 관점에서 명시적 결정(테이블 포함 vs. 의도적 예외 기록)이 필요하다. Critical 은 없다.

## 위험도

LOW
