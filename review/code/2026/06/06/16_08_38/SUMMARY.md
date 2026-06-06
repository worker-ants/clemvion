# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — spec 규약 준수(pending_plans 미등록, status: implemented 유지 근거 미문서화) 및 문서 완전성(byte-identical Rationale 잔존 가능성) 이슈 2건이 WARNING 으로 남아 있음. 코드 런타임 영향 없음.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 규약 준수 | 편집된 4개 spec 파일(`1-ai-agent.md`, `0-common.md`, `17-agent-memory.md`, `10-graph-rag.md`)에 본 plan(`rag-dynamic-cut.md`)이 `pending_plans` 에 미등록. `spec-pending-plan-existence.test.ts` 실패 가능성 있음 | `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/5-system/17-agent-memory.md`, `spec/5-system/10-graph-rag.md` frontmatter | 4개 파일 각각의 frontmatter `pending_plans:` 에 `  - plan/in-progress/rag-dynamic-cut.md` 1줄 추가 |
| W2 | 문서화 | `spec/5-system/10-graph-rag.md` 가 `status: implemented` 인 채로 편집됐으나 "동작 변경 없는 주석/설명 교체 → status 유지" 근거가 spec 내 미문서화 | `spec/5-system/10-graph-rag.md` frontmatter 및 편집 섹션 | 편집된 섹션 근처 인라인 노트 또는 plan draft §E 에 "status: implemented 유지 — 동작 변경 없는 설명 교체" 명기 |
| W3 | 문서화 | spec draft §A8 Rationale 핵심 결정 번복 내용(D2 escalate 도입, byte-identical 폐기 선언)이 확정 텍스트가 아닌 "편집 지시" 형태에 머물러 있어 spec 편집 시 누락 위험 | `plan/in-progress/spec-draft-rag-dynamic-cut.md §A8` | §A8 에 "v1 확정 결정 폐기 선언(출처 3곳 직접 인용)"·"byte-identical 조항 폐기 선언"을 지시가 아닌 확정 문안으로 삽입 |
| W4 | 문서화 | `spec/5-system/9-rag-search.md` 기존 "(a) byte-identical 하위호환" Rationale 조항이 이번 PR diff 미포함 — off 모드가 동적 컷 적용으로 변경됐다면 구 문구가 오래된 주석으로 잔존 가능 | `spec/5-system/9-rag-search.md §Rationale "왜 완전 선택적(off 기본)인가"` | §3.3.1 off 행 및 Rationale 절 byte-identical 문구를 동적 컷 적용 사실 반영 내용으로 교체 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/9-rag-search.md` §3.4 — pgvector 인덱스 파라미터(`hnsw.ef_search`, `ivfflat.probes`) follow-up 항목이 추가됐으나 plan 추적 미등록 | `spec/5-system/9-rag-search.md §3.4` 마지막 bullet | `plan/in-progress/rag-rerank-followup.md` (또는 신규 follow-up plan)에 "pgvector ANN 파라미터 조정" 항목 추가 검토 |
| I2 | 규약 준수 | `spec/5-system/9-rag-search.md §3.3.2 step 1` 에서 `rerank_candidate_k(기본 50)` 표현이 draft §A4 지시(`RAG_RECALL_K(50)`)와 불일치 — spec 내부 일관성은 유지되나 의도적 변경 여부 확인 필요 | `spec/5-system/9-rag-search.md` 라인 202 | `rerank_mode ≠ off` 경로에서 `rerank_candidate_k` 사용이 정확하다면 현행 유지가 맞음 — draft 표현의 모호성이 원인으로 판단 |
| I3 | spec-impl 정합 | `spec/4-nodes/3-ai/0-common.md` `ragTopK` 설명이 "기본: 5"에서 "상한(optional), 미지정 시 동적 점수 컷 결정"으로 변경 — developer 단계에서 `rag-search.service.ts` 의 `ragTopK` fallback 로직 확인 필요 | `spec/4-nodes/3-ai/0-common.md` 라인 45 | developer 구현 착수 시 `rag-search.service.ts` 에서 `ragTopK = 5` hardcoding/fallback 로직 제거 여부 확인 |
| I4 | spec-impl 정합 | `spec/5-system/10-graph-rag.md` §4.2 SQL `$5` 바인딩 — 주석은 `vectorSeedTopK + expandedChunkLimit` 로 교체됐으나 코드 확인 없이 주석만 변경된 경우 spec-impl 불일치 위험 | `spec/5-system/10-graph-rag.md` 라인 471 | developer 착수 시 `rag-search.service.ts` graph 분기 `$5` 바인딩 실제 값 확인 |
| I5 | 문서화 | `spec/4-nodes/3-ai/1-ai-agent.md` 예시 JSON 에서 `"ragTopK": 5` 삭제 — 선택적 override 사용법 예시 부재 | `spec/4-nodes/3-ai/1-ai-agent.md` 라인 664 구간 | 예시 JSON 에 `ragTopK` optional override 예시 블록 추가 |
| I6 | 문서화 | `spec/5-system/10-graph-rag.md` §4.2 SQL 파라미터 바인딩 표($1~$5 의미) 미문서화 | `spec/5-system/10-graph-rag.md §4.2` SQL 블록 | SQL 블록 상단에 파라미터 바인딩 표 추가 |
| I7 | 운영 | `review/consistency/2026/06/06/14_53_44/_retry_state.json` 이 `agents_success: []` 초기 상태로 커밋됨 — 실제 실행 결과 미반영 | `review/consistency/2026/06/06/14_53_44/_retry_state.json` | `review/**/_retry_state.json` 을 `.gitignore` 에 추가 또는 산출물 폴더와 분리 관리 권장 |
| I8 | 운영 | consistency review 산출물에 절대 경로(`/Volumes/project/...`) 기재 — 이식성 문제 | `review/consistency/*/convention_compliance.md`, `rationale_continuity.md` | review 도구 프롬프트 템플릿에서 절대 경로 대신 repo 루트 기준 상대 경로 사용 |
| I9 | 운영 | `meta.json` `mode` 필드가 자유 서술("spec draft 검토 (--spec)") — 프로그래머틱 파싱 어려움 | `review/consistency/2026/06/06/14_53_44/meta.json` 라인 3 | `"mode": "spec"` 또는 `"mode": "--spec"` 형태의 enum-like 값 사용 권장 |
| I10 | 운영 | `spec/1-data-model.md` 추가된 Markdown 앵커 링크(`9-rag-search.md#34-...`)가 제목 변경 시 깨질 수 있음 | `spec/1-data-model.md` 라인 345 근처 | spec 편집 시 `9-rag-search.md §3.4` 실제 앵커 ID 확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | pending_plans 미등록(4개 파일), status: implemented 유지 근거 미문서화 |
| documentation | MEDIUM | spec draft §A8 확정 텍스트 부재, byte-identical Rationale 잔존 가능성 |
| side_effect | LOW | ragTopK 의미 변경으로 developer 단계 spec-impl 불일치 일시 발생(불가피) |
| scope | NONE | 변경 범위 적절, 불필요한 리팩토링 없음 |
| api_contract | NONE | API 계약 변경 없음 |
| user_guide_sync | NONE | 유저 가이드 동반 갱신 trigger 미활성(codebase 변경 없음) |

## 발견 없는 에이전트

- **api_contract** — 해당 없음 (API 계약 변경 없음)
- **user_guide_sync** — 해당 없음 (codebase 변경 없음, spec-major-change trigger 충족)

## 권장 조치사항

1. **[W1 즉시 수정]** `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/5-system/17-agent-memory.md`, `spec/5-system/10-graph-rag.md` frontmatter `pending_plans:` 에 `- plan/in-progress/rag-dynamic-cut.md` 추가 — spec-pending-plan-existence 테스트 통과 조건.
2. **[W2 즉시 수정]** `spec/5-system/10-graph-rag.md` 편집 섹션 근처에 "status: implemented 유지 — 동작 변경 없는 설명 교체" 인라인 노트 추가.
3. **[W3 즉시 수정]** `spec-draft-rag-dynamic-cut.md §A8` Rationale 항목을 편집 지시가 아닌 확정 텍스트로 전환.
4. **[W4 확인 후 수정]** `spec/5-system/9-rag-search.md §Rationale` byte-identical 문구가 현행 동적 컷 동작과 불일치하면 교체.
5. **[I3/I4 developer 착수 시]** `rag-search.service.ts` 에서 `ragTopK` fallback 로직 및 graph 분기 `$5` 바인딩 값 확인 후 코드 변경.
6. **[I1 follow-up]** `plan/in-progress/rag-rerank-followup.md` 에 pgvector ANN 파라미터 조정 추적 항목 추가.
7. **[I7 운영 개선]** `.gitignore` 에 `review/**/_retry_state.json` 패턴 추가 고려.

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행** (6명): `requirement`, `scope`, `side_effect`, `documentation`, `api_contract`, `user_guide_sync`
- **강제 포함(router_safety)** (2명): `documentation`, `requirement`
- **제외** (8명):

| 제외된 reviewer | 이유 |
|------------------|------|
| security | 이번 변경이 spec 문서·review 산출물 전용으로 인증·권한·입력 검증 코드 없음 |
| performance | codebase 코드 변경 없음, 성능 회귀 분석 불필요 |
| architecture | 아키텍처 구조 변경 없음, spec 편집 수준 |
| maintainability | 코드 유지보수성 검토 대상 코드 없음 |
| testing | 테스트 코드 변경 없음 |
| dependency | 의존성 변경 없음 |
| database | DB 마이그레이션·스키마 코드 변경 없음 |
| concurrency | 비동기·동시성 코드 변경 없음 |