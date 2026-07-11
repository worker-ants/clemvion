# Rationale 연속성 재검증 — A3 CRITICAL 해소 확인 (적용 후)

대상: `spec/1-data-model.md` §2.16.1 LlmUsageLog 신설(및 부수 A1 두 cross-ref 정정, 7-llm-usage.md
역링크, ERD 트리 1줄). 관점: `spec/data-flow/0-overview.md ## Rationale`("폴더를 분리한 이유" /
"`spec/1-data-model.md` 와 중복 회피") 및 `spec/data-flow/7-llm-usage.md ## Rationale` 과의 결정 연속성.

## 발견사항

없음. 직전 회차 CRITICAL 은 해소됐고, 재검토 범위에서 새 CRITICAL/WARNING 은 발견되지 않았다.

### 직전 CRITICAL 해소 확인

- `spec/1-data-model.md` §2.16.1 은 이제 `> 관련 문서:` 블록쿼트 오프너 + 도입 산문 + **필드|타입|설명
  full 표(14행: id/workspace_id/workflow_id/execution_id/node_execution_id/llm_config_id/provider/
  model/prompt_tokens/completion_tokens/total_tokens/thinking_tokens/cost_usd/created_at)** + 인덱스
  목록 구조로, §2.10.1 IntegrationUsageLog·§2.23 AgentMemory 와 완전히 동형이다. `1-data-model.md`
  §2.1~§2.23 전 엔티티 실측 재확인 결과 "필드 없이 링크만" 인 lean 섹션은 여전히 0건이며, §2.16.1 도
  그 관행에 정확히 부합한다 — `spec/data-flow/0-overview.md ## Rationale`("1-data-model.md = 엔티티
  정의 단일 진실")과의 상충이 해소됐다.
- attribution *정책* 서술("워크플로우 밖·미배선 caller 는 NULL")은 표 안에서 반복 서술하지 않고 `§1.3`
  각주로 위임했다 — 이는 원칙 위반이 아니라 오히려 `0-overview.md ## Rationale`("각 도메인 문서의
  Schema 매핑 표는 전체 정의를 복사하지 않는다")의 반대 방향 적용(엔티티 스키마는 1-data-model 소유,
  흐름/정책 서술은 data-flow 문서 소유)으로, 두 SoT 의 역할 분담이 자연스럽게 유지된다.
- `plan/in-progress/spec-llm-usage-adjacent-docs.md` §Rationale "왜 A3 를 full 표로"에 이번 lean→full
  번복의 근거(직전 CRITICAL 인용 + `0-overview.md` 원칙 재확인)가 명시적으로 기록되어 있다 — "결정의
  무근거 번복" 에 해당하지 않는다(새 Rationale 동반 확인).

### DDL·인접 문서 정합 확인 (참고, 이슈 아님)

- 필드 표 14개 컬럼·nullable·타입이 `V014__llm_usage_logs.sql`(13컬럼, CASCADE=workspace_id,
  SET NULL=workflow_id/execution_id/node_execution_id/llm_config_id) + `V018__llm_usage_thinking_tokens.sql`
  (`thinking_tokens` 추가)과 정확히 일치. `llm_config_id` FK 물리 대상 테이블이 `V088` 로 `llm_config`→
  `model_config` in-place rename 됐다는 사실도 "FK → llm_config (=ModelConfig chat kind, SET NULL)"
  서술과 모순 없음(rename 은 FK 유지, UUID 보존).
- `7-llm-usage.md §2.1` 행이 `[엔티티 §2.16.1](../1-data-model.md#2161-llmusagelog)` 역링크를 갖게
  됐고 앵커(`#2161-llmusagelog`)도 GitHub 헤딩 슬러그 규칙과 일치. `spec-link-integrity.test.ts` 11
  tests 재실행 결과 PASS 확인(`codebase/frontend`).
- A1 두 cross-ref 정정("모든 LLM 호출은 적재" → "chat 계열만 적재, embed 미적재")은 `7-llm-usage.md
  §1.3`/`Overview`/`## Rationale`("모든 호출을 LlmService 로 통합" 항)의 기존 확정 사실과 정확히
  일치 — 과거 결정 번복이 아니라 stale 서술의 정합화.
- §2.16.1 의 신규 섹션 번호(§2.16 ModelConfig 와 §2.17 AuthConfig 사이)는 §2.10.1/§2.12.1~4/§2.13.1~3/
  §2.18.1~2/§2.21.1 과 동일한 "base 엔티티 뒤 `.1` 서브섹션" 번호 관행을 따른다.
- (참고, 비이슈) `## 3. 인덱스 전략` 통합 표에는 §2.16.1 LlmUsageLog 가 별도 행으로 등재되지 않았다.
  다만 이는 target 특유의 누락이 아니다 — `2.11 KnowledgeBase`/`2.12.x`/`2.15 WorkflowVersion`/
  `2.16 ModelConfig` 등 인접 엔티티도 동일하게 §3 미등재 상태이며, §2.16.1 은 자기 서브섹션 안에
  "**인덱스**: ..." 인라인 서술(§2.10.1/§2.23 과 동형)을 이미 갖추고 있어 기존 패턴과 정합적이다.
  Rationale 상 §3 완비를 요구하는 근거는 없어 CRITICAL/WARNING 대상이 아니다.

## 요약

이번 정정은 직전 회차 rationale_continuity CRITICAL("A3 lean 포인터가 `data-flow/0-overview.md
## Rationale` 의 '1-data-model.md = 엔티티 정의 단일 진실' 원칙과 상충")을 정확히 겨냥해 해소했다.
§2.16.1 LlmUsageLog 는 자매 로그 §2.10.1 IntegrationUsageLog·외부 SoT 를 가진 §2.23 AgentMemory 와
동형의 full 필드 표 + 인덱스 서술을 갖췄고, DDL(V014+V018)과 필드·nullable·FK cascade 가 완전히
일치하며, attribution 정책 권위만 `7-llm-usage.md §1.3` 각주로 위임해 "엔티티 스키마 SoT =
1-data-model.md / 흐름·정책 SoT = data-flow 문서" 라는 기존 분업을 그대로 유지한다. lean→full 번복은
plan 문서 `## Rationale` 에 근거와 함께 명시적으로 기록되어 있어 "무근거 번복"에도 해당하지 않는다.
A1 cross-ref 정정·§2.1 역링크·ERD 트리 추가 모두 기존 결정과 충돌 없이 정합하다. 새 CRITICAL/WARNING
없음.

## 위험도

NONE
