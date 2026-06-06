# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**CRITICAL** — `{ data }` 봉투 언랩 제거가 백엔드 `TransformInterceptor` 변경 없이 진행되어 이전 수정된 회귀가 재발할 가능성이 매우 높음.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | `{ data }` 봉투 언랩 Rationale(R5) 제거 + `unwrapEnvelope` 헬퍼 삭제 — `TransformInterceptor` 미변경 상태에서 동일 회귀 재발 위험 | `spec/7-channel-web-chat/3-auth-session.md` R5 삭제; `codebase/channel-web-chat/src/lib/eia-client.ts` `unwrapEnvelope` 제거 | `codebase/backend/src/common/interceptors/transform.interceptor.ts`(미변경), `spec/5-system/12-webhook.md §3.1`, `spec/5-system/2-api-convention.md §5` | (a) `TransformInterceptor` 가 실제로 바이패스됐다면 그 결정을 새 R5 Rationale 로 기술하고 `12-webhook.md` / `2-api-convention.md` 봉투 정책도 함께 갱신. (b) TransformInterceptor 가 그대로라면 `unwrapEnvelope` 제거는 명백한 회귀이므로 복구 필요. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/5-system/9-rag-search.md` 쿼리 임베딩 경로에 `inputType:'query'` 미반영 — e5/Gemini 계열 KB 검색 시 silent quality degradation 재발 가능 | `spec/5-system/9-rag-search.md §2` (이번 diff 미포함) | `spec/5-system/8-embedding-pipeline.md §5.4`, `spec/5-system/17-agent-memory.md §4` | `9-rag-search.md §2` query 임베딩 생성 부분에 `LlmService.embed(..., 'query')` 사용 명시 + `§5.4` cross-link 추가 |
| 2 | Cross-Spec / Rationale Continuity | 채널 웹채팅 spec 202 응답 표기에서 `{ data }` 봉투 언급 제거 — `12-webhook.md` · `2-api-convention.md` `TransformInterceptor` SoT 와 표기 불일치 | `spec/7-channel-web-chat/0-architecture.md` 줄 62, `spec/7-channel-web-chat/3-auth-session.md` 줄 41 | `spec/5-system/12-webhook.md §3.1`, `spec/5-system/2-api-convention.md §5`, `spec/5-system/14-external-interaction-api.md §4.1` | 논리 payload 임을 명시하거나 wire format `{ data: { executionId, interaction } }` + `res.data` 언랩 언급 복원 |
| 3 | Rationale Continuity | SSE wire 필드명 매핑 Rationale 제거 + `WaitingForInputEvent`/`AiMessageEvent` 타입 형태 번복 — 백엔드 SSE 어댑터 미변경 시 런타임 파싱 오류 | `spec/7-channel-web-chat/0-architecture.md §3` SSE wire 주의사항 단락 삭제; `codebase/channel-web-chat/src/lib/eia-events.ts` 전체 삭제; `eia-types.ts` 인터페이스 교체 | `spec/5-system/14-external-interaction-api.md §6.2`, `spec/5-system/6-websocket-protocol.md §4.4`; 백엔드 SSE 어댑터(diff 미포함) | 백엔드 SSE 어댑터가 실제로 `node.id`/`context.*` 형태로 변경됐다면 EIA spec §6.2 동기화 + Rationale 기술. 미변경이라면 이전 wire 형태(`waitingNodeId`, `message`) 유지 |
| 4 | Rationale Continuity | `spec/5-system/14-external-interaction-api.md` — 봉투 설명·NOTE 전체 삭제로 EIA spec 이 실제 wire format 과 불일치 | `§4.1` 논리 payload 주석 삭제, `§5` 인바운드 공통 봉투 NOTE 삭제, `§6.2`/`§6.5` SSE wire 주의사항 NOTE 삭제 | `spec/5-system/2-api-convention.md §5`, `spec/5-system/12-webhook.md §3.1` | TransformInterceptor 봉투가 여전히 적용된다면 삭제된 봉투 설명 복구. 봉투 제거 결정이라면 `2-api-convention.md` / `12-webhook.md` 에 근거 기록 후 연관 spec 전체 일관 갱신 |
| 5 | Rationale Continuity | `spec/5-system/7-llm-client.md §8.3` `LlmService.embed` `opts` 인자 신설에 대한 공식 Rationale 부재 | `spec/5-system/7-llm-client.md §8.3` | `spec/5-system/7-llm-client.md §3.3` "평탄한 시그니처" 원칙 | `7-llm-client.md ## Rationale` 에 `opts` 인자(서비스 래퍼 전용)와 `inputType` 위치 인자 선택 근거 추가 |
| 6 | Plan Coherence | P6 완료 사실이 상위 plan `rag-quality-improvement.md §P6` 체크박스에 미반영 | `plan/in-progress/embedding-model-ux.md` (Phase A/B/C 완료 기재) | `plan/in-progress/rag-quality-improvement.md §3 P6` (`[ ]` 미체크) | PR 머지 전 `rag-quality-improvement.md §P6` 3개 체크박스 `[x]` 갱신 + 완료 날짜·PR 번호 기재 |
| 7 | Plan Coherence | `rag-quality-improvement.md` P6 항목에 voyage/cohere 배선 범위가 D-P6-1 결정과 불일치 | `plan/in-progress/rag-quality-improvement.md §3 P6` | `plan/in-progress/embedding-model-ux.md §1 D-P6-1` (voyage/cohere = provider 부재로 OUT) | P6 항목을 "e5 계열 prefix, Google Gemini taskType 자동 배선(voyage/cohere 는 client 부재로 제외)" 로 정정 |
| 8 | Convention Compliance | `spec/5-system/10-graph-rag.md` 관련 문서 블록이 자기 자신을 `[PRD Graph RAG]` 로 참조 | `spec/5-system/10-graph-rag.md` 상단 관련 문서 블록 | `spec/4-nodes/3-ai/_product-overview.md` (올바른 PRD 경로) | `[PRD Graph RAG](./10-graph-rag.md)` 를 실제 PRD 위치로 교체하거나 링크 제거 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `7-llm-client.md §3.3` LLMClient 인터페이스와 `§8.3` LlmService 래퍼 간 `opts` 인자 위치 차이 cross-link 부재 | `spec/5-system/7-llm-client.md §3.3` | §3.3 에 "서비스 래퍼 시그니처는 §8.3 참조 — `opts`/`config` 인자 추가" 한 줄 cross-link 추가 |
| 2 | Cross-Spec | 기존 e5/Gemini KB 재임베딩 필요성에 대한 배포 업그레이드 가이드 부재 | `spec/5-system/8-embedding-pipeline.md §5.4` 정합성 섹션 | §5.4 에 "e5/Gemini 계열 KB 는 배포 후 KB 상세 화면의 전체 재임베딩 1회 수동 실행 필요" 배포 노트 추가 고려 |
| 3 | Rationale Continuity | `spec/5-system/17-agent-memory.md` `inputType` 배선 설명 추가는 기존 Rationale 과 정합 | `spec/5-system/17-agent-memory.md` | agent-memory ## Rationale 에 "이전 저장 메모리의 inputType 불일치 대응 정책(dedup UPDATE + TTL 자연 만료)" 항목 추가 권장 |
| 4 | Rationale Continuity | `spec/2-navigation/5-knowledge-base.md` 한국어 추천 배지는 select-only 원칙 준수 | `spec/2-navigation/5-knowledge-base.md` R-1 | 변경 없음 |
| 5 | Convention Compliance | `spec/5-system/11-mcp-client.md` `## Rationale` 최상위 섹션 부재 | `spec/5-system/11-mcp-client.md` | 파일 끝에 `## Rationale` 섹션 추가, 기존 인라인 근거 통합 |
| 6 | Convention Compliance | `spec/5-system/10-graph-rag.md` Overview/개요 중복 구조 | `spec/5-system/10-graph-rag.md` `## Overview (제품 정의)` + `## 1. 개요` | `## 1. 개요` 를 `## 1. 기술 개요` 로 rename 해 역할 분리 |
| 7 | Convention Compliance | `spec/5-system/1-auth.md §1.5.4` `lower_snake_case` 에러 코드 — historical-artifact 등재 규약 준수 | `spec/5-system/1-auth.md §1.5.4` | 현 상태 유지 |
| 8 | Convention Compliance | `spec/5-system/11-mcp-client.md §6.2` `skipReason` `lower_snake_case` — 규약 적용 범위 밖 명시 | `spec/5-system/11-mcp-client.md §6.2` | 운영 진단 enum `lower_snake_case` 허용 패턴을 `error-codes.md` 에 별도 항목으로 명시 고려 |
| 9 | Plan Coherence | `embedding-model-ux.md §2` 작업 항목 체크박스 미갱신 | `plan/in-progress/embedding-model-ux.md §2` | 완료된 Phase A/B/C 항목 `[x]` 업데이트 |
| 10 | Naming Collision | `input_type` 헤딩이 Cafe24 API 카탈로그 동명 필드와 공존 (영역·표기 구분됨) | `spec/5-system/8-embedding-pipeline.md §5.4` 헤딩 | 헤딩을 `### 5.4 비대칭 임베딩 입력 (inputType / prefix)` 로 변경해 camelCase 기준 용어 통일 (선택적) |
| 11 | Naming Collision | `embedding-input-type.ts` 가 두 spec frontmatter(`7-llm-client.md`, `8-embedding-pipeline.md`)에 동시 등재 — 소유 모호성 | `spec/5-system/7-llm-client.md` + `spec/5-system/8-embedding-pipeline.md` frontmatter | `7-llm-client.md` 단독 등재, `8-embedding-pipeline.md` 에서는 cross-link 만 유지 |
| 12 | Naming Collision | `LlmCallOptions` 타입이 spec 에 처음 등장하나 정의 SoT 를 코드로 위임 — 기존 패턴과 일관 | `spec/5-system/7-llm-client.md §8.3` | 조치 불필요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `9-rag-search.md` `inputType:'query'` 미동기화(W), 채널 웹채팅 202 응답 표기 불일치(W) |
| Rationale Continuity | CRITICAL | `{ data }` 봉투 R5 + `unwrapEnvelope` 제거로 이전 회귀 재발 위험(C), SSE wire 필드 매핑 Rationale 제거(W), EIA spec 봉투 설명 삭제(W), `opts` Rationale 부재(W) |
| Convention Compliance | LOW | `10-graph-rag.md` 자기지시 PRD 링크(W), 구조 일관성 INFO 3건 |
| Plan Coherence | LOW | `rag-quality-improvement.md §P6` 미갱신(W), voyage/cohere 범위 불일치(W) |
| Naming Collision | LOW | `input_type` 영역 간 동명(INFO), `embedding-input-type.ts` 이중 등재(INFO) |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `codebase/backend/src/common/interceptors/transform.interceptor.ts` 변경 여부를 먼저 확인한다. 미변경이라면 `eia-client.ts` 에 `unwrapEnvelope` 를 복구하고 `spec/7-channel-web-chat/3-auth-session.md ## Rationale` 에 R5 를 복원한다. 변경됐다면 그 결정을 새 R5 로 기술하고 `spec/5-system/12-webhook.md §3.1` / `spec/5-system/2-api-convention.md §5` / `spec/5-system/14-external-interaction-api.md` 봉투 정책을 일관 갱신한다.
2. **(BLOCK 연관)** SSE wire 타입(`WaitingForInputEvent`/`AiMessageEvent`) 교체가 실제 백엔드 SSE 어댑터 변경을 동반했는지 확인한다. 어댑터가 미변경이라면 `eia-types.ts` 를 이전 wire 형태로 복구하고 `eia-events.ts` 를 되살린다.
3. **(WARNING)** `spec/5-system/9-rag-search.md §2` 에 쿼리 임베딩 경로의 `inputType:'query'` 사용 명시 및 `§5.4` cross-link 추가.
4. **(WARNING)** `spec/5-system/14-external-interaction-api.md` 에 삭제된 봉투 설명(§4.1, §5, §6.2, §6.5)을 복구하거나, 봉투 제거 결정이면 모든 연관 spec 을 일관 갱신.
5. **(WARNING)** `spec/5-system/7-llm-client.md ## Rationale` 에 `opts` 인자(서비스 래퍼 전용)와 `inputType` 위치 인자 선택 근거 추가.
6. **(WARNING)** `plan/in-progress/rag-quality-improvement.md §P6` 3개 체크박스 `[x]` + 완료 날짜·PR 번호 갱신, voyage/cohere 범위 표현 정정.
7. **(WARNING)** `spec/5-system/10-graph-rag.md` 관련 문서 블록의 자기지시 링크를 실제 PRD 경로로 교체.
8. **(INFO)** `plan/in-progress/embedding-model-ux.md §2` 완료 항목 체크박스 `[x]` 업데이트.