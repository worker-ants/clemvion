---
worktree: llm-usage-adjacent-docs
started: 2026-07-11
owner: project-planner
spec: spec/data-flow/7-llm-usage.md §1.3
spec_impact:
  - spec/1-data-model.md
  - spec/data-flow/6-knowledge-base.md
  - spec/data-flow/13-agent-memory.md
  - spec/data-flow/7-llm-usage.md
precedent: PR #900 (§1.3 memory-compression attribution 확정) 의 A-track follow-up
---

# LLM-usage 인접 문서 정합 (A-track, spec-only)

PR #879/#900 이 `spec/data-flow/7-llm-usage.md §1.3` 을 "chat 계열만 `llm_usage_log` 적재 /
embed 미적재, AI 노드 호출은 attribution 채움" 으로 확정했다. 그 §1.3 SoT 와 어긋나는 인접
문서 stale 서술을 정리한다. (선행 plan `resume-llm-usage-attribution.md` §잔여 follow-up A1~A4.)

## 검증 결과 — 실제 필요 범위 (2026-07-11, origin/main `ab5abc1a6` 기준)

follow-up 초안(2026-07-09)은 A1~A4 를 나열했으나, 그 사이 #877/#879/#900 이 A2·A4 를 이미
해소함을 코드/문서 대조로 확인했다. **genuine 범위 = A1 + A3**:

- **A1 (FIX)** — `spec/data-flow/6-knowledge-base.md:348` · `spec/data-flow/13-agent-memory.md:231`
  두 파일 동일 라인 `| LLM Usage | cross-ref | 모든 LLM 호출은 \`llm_usage_log\` 적재 — ... |` 이
  §1.3(chat 적재/embed 미적재)와 상충. **두 문서 모두 chat+embed 를 실제로 호출**(KB: graph/rerank
  chat + 청크/query embed; AgentMemory: 추출 chat + 저장/recall embed)하므로 "모든 호출 적재" 는
  부정확. → "chat 계열만 적재(embed 미적재)" 로 정정.
- **A2 (NO-OP, 검증 완료)** — `spec/2-navigation/7-statistics.md` §2.5(LLM 토큰 사용량 위젯) 과
  `spec/2-navigation/9-user-profile.md` §6.3(alerts `llm_cost`) 에는 "노드 발 usage 누락/attribution
  갭" 류 **stale 캐비어트가 존재하지 않는다**. attribution 채움 현황의 권위 서술은 `7-llm-usage.md §4`
  (Statistics/Alerts downstream 행 — 이미 "노드 발 사용량 반영, 잔여 non-node 만 누락")에 일원화돼
  있고 정확하다. → 변경 불요.
- **A3 (ADD)** — `spec/1-data-model.md` 에 `LlmUsageLog` 전용 서브섹션 부재(자매 로그
  `IntegrationUsageLog` 는 §2.10.1 보유 + ERD 트리 등재). llm_usage_log 는 현재 §2.16 ModelConfig
  참조 라인 1곳에만 등장 → 데이터 모델에서 비가시. **discoverability 비대칭 해소**를 위해 §2.16.1
  LlmUsageLog **full 필드 테이블 서브섹션**(§2.10.1 IntegrationUsageLog·§2.23 AgentMemory 와 동형)
  + ERD 트리 1줄 추가.
  > **consistency-check --spec 반영(초안 정정)**: 최초 draft 는 "lean 포인터(표 없음)" 로 잡았으나
  > rationale_continuity 가 **CRITICAL** 판정 — `spec/data-flow/0-overview.md ## Rationale` 가
  > "1-data-model.md = 엔티티 정의 단일 진실, data-flow = 흐름 발췌 + 역참조" 를 명시 합의했고,
  > 실측상 §2.1~§2.23 **모든** 엔티티가(외부 SoT 문서를 둔 §2.23 AgentMemory 포함) full 필드 표를
  > 보유(§2.23 직접 확인 = 9필드 표). 따라서 §2.16.1 도 full 표 + `SoT` 각주(AgentMemory 패턴)로 정정.
- **A4 (NO-OP, 검증 완료)** — `spec/5-system/4-execution-engine.md`(§1.3/§7.5)와
  `spec/4-nodes/3-ai/1-ai-agent.md:717`(§7.4 `_resumeCheckpoint` 라이프사이클 표)는 **이미**
  "context-binding 재유도 = 조작 필드(`node.config` 재평가) / **식별 필드(`workflowId`·
  `nodeExecutionId`·`workspaceId`) = 호출측 컨텍스트 재유도**" 로 3-way 구분을 서술한다(#877/#879
  반영). 플랜이 원한 "턴 가변 식별자(caller opts, node.config 재유도 불가)" 문구가 이미 존재. → 변경 불요.

## 변경 세트 (draft)

### A1 — 두 cross-ref 행 정정 (before/after)

`6-knowledge-base.md:348` · `13-agent-memory.md:231` (동일):
- before: `| LLM Usage | cross-ref | 모든 LLM 호출은 \`llm_usage_log\` 적재 — [\`llm-usage.md\`](./7-llm-usage.md) |`
- after:  `| LLM Usage | cross-ref | chat 계열 LLM 호출만 \`llm_usage_log\` 적재 (embed 계열 미적재) — [\`llm-usage.md\`](./7-llm-usage.md) §1.3 |`

### A3 — `spec/1-data-model.md` §2.16.1 LlmUsageLog (신규, full 표) + ERD 트리 1줄

- §2.16 ModelConfig 직후(§2.17 앞)에 `### 2.16.1 LlmUsageLog` 삽입. §2.10.1/§2.23 동형:
  `> 관련 문서:` 블록쿼트 오프너(SoT 링크) + 도입 산문(CASCADE 부모=Workspace, `llm_config_id`=SET NULL)
  + **full 필드 표**(V014+V018 DDL 기준) + 인덱스 목록. 컬럼: id / workspace_id(NOT NULL, CASCADE) /
  workflow_id? · execution_id? · node_execution_id?(SET NULL, AI 노드 호출은 채움/워크플로우 밖·미배선
  caller NULL — §1.3) / llm_config_id?(SET NULL) / provider · model / prompt·completion·total_tokens /
  thinking_tokens?(V018, 저장만) / cost_usd?(NUMERIC(12,6)) / created_at.
- **링크 경로 주의**(convention_compliance WARNING): 1-data-model.md 는 `spec/` 루트라 7-llm-usage 링크는
  `./data-flow/7-llm-usage.md` (디렉터리 prefix 필수 — `spec-link-integrity` 빌드가드).
- ERD 트리(§2 앞)의 Workspace 서브트리에 `IntegrationUsageLog` 옆 형태로 `LlmUsageLog (1:N)` 1줄 추가.
- (cross_spec INFO, 선택) `7-llm-usage.md` §2.1 표 근처에 `[데이터 모델 §2.16.1](../1-data-model.md#2161-llmusagelog)` 역링크 1줄 — 양방향 discoverability.

## Rationale

- **왜 A2/A4 를 건드리지 않나**: single-truth 원칙상 attribution 현황 SoT 는 `7-llm-usage.md`(§1.3/§4)
  하나다. Statistics/user-profile 은 그 downstream 소비처일 뿐 자체 갭 서술이 없어, 손대면 오히려
  중복/드리프트를 만든다. execution-engine/ai-agent 의 §7.x 재구성 서술도 이미 식별-필드 채널을
  갖춰 추가 불요. (검증 없이 초안대로 4건을 다 고치면 이미 해소된 것을 중복 수정하는 stale-plan 함정.)
- **왜 A3 를 full 표로**(초안 lean 판단을 --spec 이 CRITICAL 로 반증): `0-overview.md ## Rationale` 는
  "**1-data-model.md = 엔티티 정의 단일 진실**, data-flow 문서 = 흐름 발췌 + 1-data-model.md 역참조"
  를 명시 합의했다. 즉 attribution 채움 *정책* SoT 는 `7-llm-usage.md §1.3` 이지만 *엔티티 스키마* SoT
  는 1-data-model.md 다. 실측상 §2.23 AgentMemory(외부 SoT `17-agent-memory.md` 보유)조차 9필드 full
  표를 유지 — "SoT 가 타 문서면 표 생략" 관행은 이 저장소에 없다. 따라서 §2.16.1 도 full 표 + `SoT`
  각주로 §1.3 에 attribution *정책* 권위만 위임(표 컬럼은 DDL SoT, 채움 서술은 §1.3 링크)해 드리프트
  최소화. (초안대로 lean 으로 갔으면 1-data-model.md 최초의 표-없는 엔티티 예외가 돼 후속 임의 보정
  드리프트를 유발.)

## 워크플로 (project-planner)

- [x] consistency-check --spec (draft, `review/consistency/2026/07/11/00_10_41/`) — 최초 **CRITICAL**
      (rationale_continuity: A3 lean 이 "1-data-model=엔티티 SoT" 관행 위반) → A3 를 full 표로 정정 +
      `reverify/` 재검증 **BLOCK:NO**(rationale_continuity NONE, convention_compliance LOW). A1/A2/A4 판단은
      cross_spec/convention_compliance 가 검증.
- [x] A1 두 파일 정정 (`6-knowledge-base.md:348`·`13-agent-memory.md:231`)
- [x] A3 §2.16.1 LlmUsageLog full 표 + ERD 트리 + §3 인덱스 표 + 7-llm-usage 역링크
- [x] side-effect 점검 (7-llm-usage §2.1/§1.3 와 DDL 정합, `spec-link-integrity` 11/11 PASS, 새 cross-spec 충돌 없음)
- [x] 선행 plan `resume-llm-usage-attribution.md` §잔여 follow-up A1~A4 체크오프(A2/A4=검증 no-op 기록)
- [x] commit `docs(spec): llm-usage 인접 문서 정합 (A1 cross-ref + A3 LlmUsageLog 서브섹션)` + PR
- [x] 완료 → `plan/complete/` 이동 (spec_impact 선언)
