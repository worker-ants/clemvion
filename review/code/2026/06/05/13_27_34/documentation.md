# 문서화(Documentation) 리뷰 결과

리뷰 일시: 2026-06-05
대상: rag-rerank-followup 브랜치 변경분 (26개 파일)

---

## 발견사항

### [INFO] spec/2-navigation/6-config.md — Part C 링크가 `(Planned)` suffix 가 붙은 anchor 를 참조
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/spec/2-navigation/6-config.md` §Part C 첫 단락
- 상세: `엔티티: [데이터 모델 §2.16.1](../1-data-model.md#2161-rerankconfig-planned)` — `(Planned)` suffix anchor 를 여전히 사용. 동일 파일 §3 Rerank Config API 에서도 `/api/rerank-configs/:id/set-default` 등 신규 API 엔드포인트를 문서화했는데, 이 링크만 구 anchor 를 참조한다.
- 제안: `spec/2-navigation/5-knowledge-base.md` 는 이미 `#2161-rerankconfig` 로 업데이트됐으므로, `6-config.md` §Part C 의 해당 링크도 동일하게 `#2161-rerankconfig` 로 통일한다. `5-knowledge-base.md` 와 불일치하는 anchor 참조를 제거해 링크 일관성을 확보한다.

---

### [INFO] spec/1-data-model.md — `rerank_mode` 컬럼 설명에 migration 버전 표기가 어색
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/spec/1-data-model.md` KnowledgeBase 표 `rerank_mode` 행
- 상세: 변경 후 서술이 `` `cross_encoder_llm` `(V082)` `` 처럼 enum 값 중간에 버전 태그를 삽입해 가독성이 낮다. `rerank_config_id`·`rerank_candidate_k`·`rerank_score_threshold` 등 인접 행은 버전 태그 없이 서술된다.
- 제안: enum 열거 끝에 ` (V082 에서 두 모드 모두 구현됨)` 형식으로 이동하거나, `rerank_llm_config_id` 행과 함께 컬럼 그룹 머릿글 주석으로 이전하는 것이 일관성에 부합한다.

---

### [INFO] spec/5-system/9-rag-search.md — "Overview (제품 정의)" 섹션 신설 후 §1 개요와 내용이 일부 중복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/spec/5-system/9-rag-search.md` 신설 `## Overview` 와 기존 `## 1. 개요`
- 상세: Overview 는 "AI Agent 가 Knowledge Base 를 LLM tool 로 검색…RAG 검색 엔진이다" 라고 서술하고, §1 개요도 "AI Agent 노드가 Knowledge Base의 관련 문서를 검색하여 LLM 컨텍스트에 추가하는 RAG(Retrieval-Augmented Generation) 검색 엔진"으로 거의 동일하게 시작한다. CLAUDE.md 의 spec 3섹션 구성(Overview/본문/Rationale) 규약과는 부합하나, §1 개요와 중복되는 문장 수준의 반복이 독자에게 혼란을 줄 수 있다.
- 제안: Overview 를 제품 맥락(PRD 링크) 중심의 1~2문장 요약으로 유지하고, 기술 세부(SQL·파라미터 등)는 §1 이하에서만 서술하는 역할 분리를 명시하면 된다. 현 수준은 INFO — 독자에게 큰 혼란은 없다.

---

### [INFO] spec/4-nodes/3-ai/1-ai-agent.md — `summaryModel` / `extractionModel` 파라미터 테이블에 Expression 지원 여부 미명시
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/spec/4-nodes/3-ai/1-ai-agent.md` §파라미터 표 신규 행
- 상세: 변경된 표 행에서 타입이 `String (Expression 가능)` 으로 기재됐다. 인접 행인 `embeddingModel`(String)·`memoryTtlDays`(Integer) 등은 `(Expression 가능)` 표기가 없다. `embeddingModel` 도 동일 Expression 지원 여부가 확인되지 않은 상태로 타입 표기가 일관되지 않을 가능성이 있다.
- 제안: 파라미터 표의 "타입" 컬럼에서 Expression 지원 명시 정책을 일관화한다. `embeddingModel` 등 유사 string 필드의 Expression 지원 여부를 확인해 표기를 동기화하거나, 표 헤더 아래 공통 주석으로 "모든 String 필드는 Expression 사용 가능"을 명시하는 방식을 고려한다.

---

### [INFO] spec/5-system/4-execution-engine.md — §8 절 제목에서 `(미구현 — Planned)` 제거됐으나 내부 표의 "설정 위치" 열 서술이 장황
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/spec/5-system/4-execution-engine.md` §8 표 `단일 Execution 최대 실행 시간` 행
- 상세: 변경 후 "설정 위치" 셀이 `(1단계 PR2a) 시스템 env EXECUTION_MAX_ACTIVE_RUNNING_MS(기본 1800000ms; 0=무제한). (2단계 후속) per-workflow Workflow.settings` 로 매우 길어져 표 레이아웃을 해친다. 동일 테이블의 다른 행들("Node.config", "Workspace.settings")과 형식이 불일치한다.
- 제안: "설정 위치" 셀은 `env EXECUTION_MAX_ACTIVE_RUNNING_MS (1단계 구현)` 으로 압축하고, PR2a 상세·`0`=무제한 등을 표 아래 §8 본문 설명 블록이나 `> 비고` 형식으로 이전한다.

---

### [INFO] spec/conventions/conversation-thread.md — §8.4 와 `## 9. 미리보기 UI 렌더 규칙` 섹션 순서로 인한 헤딩 번호 충돌 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/spec/conventions/conversation-thread.md`
- 상세: 변경 diff 를 보면 기존 `---` 구분선 뒤에 바로 `## 9. 미리보기 UI 렌더 규칙` 이 왔던 위치에 `### 8.4 ...` 가 삽입되고, `## 9. 미리보기 UI 렌더 규칙` 으로 이어진다. 그런데 전체 파일에서 §8.3 (또는 §8.x 이전 항목)이 존재하는지 명시적으로 보이지 않는다. `8.4` 라는 번호가 §8 의 선행 항목 없이 등장하면 독자가 §8.1~§8.3 을 찾을 수 없다.
- 제안: 파일 전체에서 §8.1~§8.3 존재 여부를 확인하고, 부재 시 §8.4 를 §8.1 로 재번호화하거나 `### 8. Execution.conversation_thread 컬럼` → `#### 8.1 채택 근거` 구조로 정리한다.

---

### [WARNING] spec/2-navigation/6-config.md — 신규 Rerank Config API 엔드포인트의 응답 스키마(Response Schema) 문서 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/spec/2-navigation/6-config.md` §3 Rerank Config API 테이블
- 상세: LLM Config API 섹션은 엔드포인트 목록만 있고 응답 스키마 상세는 `spec/5-system/7-llm-client.md` 로 위임된다. 그러나 Rerank Config 의 경우 `spec/5-system/7-llm-client.md §3.6` 에 RerankConfig CRUD API shape(`api_key` 마스킹 정책·`set-default` 엔드포인트 응답 등)이 얼마나 기술되어 있는지 diff 에서 확인되지 않는다. 특히 `PATCH /rerank-configs/:id/set-default` 의 응답 형태(어떤 필드를 반환하는지, 204 vs 200), `GET /rerank-configs` 의 페이지네이션 응답 필드가 6-config.md 에서는 API 규약 §5.2 를 언급하는 것으로만 처리된다.
- 제안: `spec/5-system/7-llm-client.md §3.6` 이 RerankConfig CRUD shape 의 SoT 임을 6-config.md §3 에 명시적으로 링크로 안내한다. 만약 §3.6 에 응답 스키마가 없다면 LLMConfig 패턴과 동일하다는 명시("응답 shape 는 LLMConfig 패턴 준용 — `7-llm-client.md §3.1`")를 추가한다.

---

### [WARNING] spec/2-navigation/16-agent-memory.md 신규 파일 — 구현 상태 표시 없는 환경변수/설정 옵션 문서 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/spec/2-navigation/16-agent-memory.md`
- 상세: 신규 파일에 frontmatter `status: implemented` 로 표시됐고 §2 에 API 엔드포인트가 명세됐으나, `GET /agent-memories/scopes` 및 `GET /agent-memories` 의 응답 스키마(필드 목록·페이지네이션 형태)가 이 파일에는 없다. §2 는 "데이터·API 계약은 Agent Memory §6 가 SoT" 라 위임하고 있는데, 화면에서 소비하는 필드(`expiresAt`, `kind` 배지 등)가 §6 응답에서 어떤 JSON 키로 오는지를 화면 spec 에서 연결하는 단서가 부족하다. UI 개발자가 §6 을 별도로 읽어야 필드명을 알 수 있다.
- 제안: §2 의 각 API 호출에 "(응답 필드: `id`, `content`, `kind`, `scopeKey`, `createdAt`, `updatedAt`, `expiresAt?` — 임베딩 제외)" 수준의 한 줄 인라인 스키마 힌트를 추가한다. 또는 "응답 shape: [§6 응답 필드 목록](#6-메모리-관리-api-조회삭제-admin-surface)" 식의 anchor 링크로 독자를 안내한다.

---

### [INFO] spec/5-system/17-agent-memory.md — 기존 §6 "v2 로드맵" 이 §7 로 변경되면서 외부 anchor 링크 구식화 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/spec/5-system/17-agent-memory.md`
- 상세: 기존 `## 6. v2 로드맵` 이 `## 7. v2 로드맵` 으로 번호가 바뀌고, 신규 `## 6. 메모리 관리 API` 가 삽입됐다. 만약 다른 spec 파일에서 `#6-v2-로드맵` anchor 를 직접 참조하는 경우 링크가 끊긴다.
- 제안: `grep -r "#6-v2-로드맵" spec/` 으로 외부 anchor 참조를 확인한다. 참조 발견 시 해당 링크를 `#7-v2-로드맵` 으로 갱신한다. (현재 diff 에서 관련 참조는 보이지 않지만, `spec/5-system/_product-overview.md` 등 연관 파일에서 `§6` 으로 번호 언급이 있을 수 있다.)

---

### [INFO] spec/data-flow/9-observability.md — BullMQ 큐 개수 수치 업데이트 ("12개" → "13개")만 되고 큐 목록 자체의 변경은 `0-overview.md` SoT 로 위임 (정합 확인 필요)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/spec/data-flow/9-observability.md`
- 상세: 다이어그램 레이블(`12개 BullMQ 큐` → `13개 BullMQ 큐`)과 본문 텍스트가 동기화됐다. `0-overview.md §4` 큐 카탈로그에 `execution-run` 이 추가된 것과 일치한다. 현재는 정합 상태이나, `0-overview.md` 에 큐가 추가/삭제될 때 `9-observability.md` 의 수치 도 수동으로 동기화해야 한다는 점이 인라인 주석 등으로 명시되어 있지 않다.
- 제안: `9-observability.md` 다이어그램 주석에 "큐 수는 `0-overview.md §4` 에 동기화" 를 한 줄 추가해 수동 유지보수 의존성을 가시화한다.

---

### [INFO] spec/5-system/4-execution-engine.md — 신규 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 환경변수 §10.2 표에 추가됐으나 `spec/0-overview.md` §2.4 의 환경변수 목록 언급 수준이 불충분
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/spec/5-system/4-execution-engine.md` §10.2
- 상세: `spec/0-overview.md` §2.4 에 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 의 인라인 언급이 추가됐다 (diff 파일 3). 그러나 PROJECT.md 나 환경변수 일람 문서(있다면)에서 운영자가 한눈에 조정 가능한 env 목록을 파악하기가 어려울 수 있다. `EXECUTION_RUN_WORKER_CONCURRENCY` · `CONTINUATION_WORKER_CONCURRENCY` 도 §10.2 에만 있다.
- 제안: 현 상태는 §10.2 가 실질 SoT 이므로 허용 가능하다. 단 운영 매뉴얼/PROJECT.md 에 "실행엔진 튜닝 환경변수는 §10.2 참조" 한 줄 포인터가 있으면 발견성이 개선된다.

---

### [INFO] spec/4-nodes/3-ai/1-ai-agent.md — §12.13 `runningSummary` 영속 경로 변경 후 §12.10 v1/v2 경계 항목의 "신규 DB 컬럼 없음" 문구 삭제 여부 불명확
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/spec/4-nodes/3-ai/1-ai-agent.md` §12.10
- 상세: diff 에서 §12.10 v1 경계 항목이 `- v1: ... in-memory + NodeExecution 분산 SoT, ... 신규 DB 컬럼 없음` → `- v1: ... in-memory + NodeExecution 분산 SoT (실행 이력) + Execution.conversation_thread durable park 스냅샷 ...` 으로 업데이트됐다. "신규 DB 컬럼 없음"은 삭제되고 `conversation_thread` 컬럼 도입이 v1 scope 에 포함됐다. 이는 `conversation-thread.md §4` 의 "신규 컬럼 없음 → 채택 완료" 변경과 일관된다.
- 제안: 정합 상태. 단 다른 spec 파일(예: `spec/data-flow/3-execution.md` 등)에 "v1 은 신규 DB 컬럼 없음"을 언급하는 곳이 있으면 같이 동기화했는지 확인한다. consistency-checker 에서 이미 flagged 된 사항이라면 생략.

---

## 요약

이번 변경은 RAG rerank 기능 구현 완료·Agent Memory admin UI·exec-park-durable-resume Phase A1 spec 동기화를 광범위하게 커버하는 spec-only diff 다. 문서화 관점에서 전반적으로 양호하며 CRITICAL 발견사항은 없다. 두 개의 WARNING 은 (1) `spec/2-navigation/6-config.md` 신규 Rerank Config API 의 응답 스키마 SoT 링크가 명시되지 않아 독자가 7-llm-client.md §3.6 을 독립적으로 탐색해야 하는 점, (2) `spec/2-navigation/16-agent-memory.md` 신규 파일이 API 응답 필드명을 §6 에 완전 위임하면서 화면 spec 내에 필드 힌트가 부재한 점이다. 나머지 INFO 는 anchor 일관성(`(Planned)` suffix 혼재), 표 셀 장황, 섹션 번호 단절, 큐 수 수동 동기화 의존성 등 발견성·유지보수성 개선 권고 수준이다.

---

## 위험도

LOW
