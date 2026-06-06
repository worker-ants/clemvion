# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/9-rag-search.md` + 관련 구현 diff (origin/main...HEAD)
검토 기준 Rationale 출처: `spec/5-system/9-rag-search.md §Rationale`, `plan/complete/spec-draft-rag-reranking.md §Rationale`, `plan/in-progress/rag-quality-improvement.md §6`

---

## 발견사항

### [WARNING] `cross_encoder_llm` — "항상 grading(v1)" 결정 번복, 새 Rationale 존재하나 spec 본문과 plan 사이 선언 위치 정합 필요

- **target 위치**: `spec/5-system/9-rag-search.md §3.3.2` · `§Rationale "왜 D2 conditional escalate 를 지금 도입하나"` / `rerank.service.ts` `shouldEscalateGrading()`
- **과거 결정 출처**: `plan/complete/spec-draft-rag-reranking.md §Rationale` 항목 ② — `"v1 확정: cross_encoder 수행 후 survivors(~15개)에 listwise LLM grading 을 항상 1콜 수행 (조건부 escalate 없음)"` / `plan/in-progress/rag-quality-improvement.md §6` — `"기존 2026-06-04 '항상 grading(v1)' 대체"`
- **상세**: `spec-draft-rag-reranking.md §Rationale` 와 `rag-quality-improvement.md §6` 의 2026-06-04 확정 결정("항상 grading")을 본 PR 이 "conditional escalate"로 번복하고 있다. `9-rag-search.md §Rationale` 에 "왜 D2 conditional escalate 를 지금 도입하나" 항목이 추가되어 번복 근거가 **spec 내에 명시**되어 있으나, `plan/complete/spec-draft-rag-reranking.md §Rationale` 의 `"항상 LLM grading(v1)"` 항목이 수정·폐기 표시 없이 원문 그대로 남아 있다. 두 문서가 같은 v1 결정에 대해 상충된 서술을 제공한다.
- **제안**: `plan/complete/spec-draft-rag-reranking.md §Rationale` ② 항에 `[2026-06-06 번복 — rag-dynamic-cut PR: conditional escalate 로 대체, 근거: 9-rag-search.md §Rationale "왜 D2 conditional escalate 를 지금 도입하나"]` 주석을 추가하거나, 혹은 `9-rag-search.md §Rationale` 이 SoT 임을 명시하고 spec-draft 를 아카이브로 격하 처리한다. spec 변경이므로 `project-planner` 위임.

---

### [INFO] `ragTopK` 기본값 5 → optional(undefined) 변경 — Rationale 존재하나 data-model spec 측 기본값 명세 미갱신 가능성

- **target 위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` `ragTopK: z.number().int().optional()` / `ai-agent.schema.spec.ts` `expect(result.ragTopK).toBeUndefined()`
- **과거 결정 출처**: `spec/5-system/9-rag-search.md §3.4` 주석 `"고정 default 없음"` 및 `§Rationale "왜 회수폭/예산/ceiling 을 내부 상수로 두나"` 항목 — `"v1 은 module-level 상수(환경변수 미노출)로 시작"`, `"신규 노드 config 필드 증식 회피"` 원칙
- **상세**: 구현이 Rationale 에 합의된 "내부 상수·신규 config 필드 증식 회피" 원칙에 정합하게 `ragTopK` 를 optional 로 변경했다. `spec/5-system/9-rag-search.md §3.4` 본문도 동일 방향으로 기술되어 있다. 그러나 노드 스키마 영역을 별도로 다루는 spec(`spec/4-nodes/ai-agent` 류)가 존재한다면 `ragTopK` default 값 `5` 가 해당 문서에 잔존하는지 확인이 필요하다. 프론트엔드 docs(`codebase/frontend/src/content/docs/02-nodes/ai.mdx`, `ai.en.mdx`) 는 이미 "동적 컷" 으로 갱신됐다.
- **제안**: `spec/4-nodes/` 하위에 AI Agent 노드 config schema 를 서술하는 문서가 있다면 `ragTopK` 기본값 항목을 `optional / 동적 컷` 으로 갱신하거나 미갱신 이유를 Rationale 에 명시한다.

---

### [INFO] `byte-identical` 하위호환 조항 폐기 — spec 본문 내 명시됐으나 `spec-draft-rag-reranking.md` 구판 선언이 충돌 문서로 잔존

- **target 위치**: `spec/5-system/9-rag-search.md §Rationale "byte-identical 조항 폐기 (D1, 2026-06-06)"`
- **과거 결정 출처**: `plan/complete/spec-draft-rag-reranking.md §3.1` `"하위호환: 현 동작과 byte-identical"` / `§Rationale "왜 완전 선택적(off 기본)인가 (a) 하위호환 byte-identical"`
- **상세**: `9-rag-search.md §Rationale` 이 "byte-identical 조항 폐기" 를 명시적으로 선언하고 새 하위호환 정의("리랭커 인프라 없이 동작·점진 도입 가능")를 제공하고 있어 번복 근거 자체는 spec 에 있다. 다만 `spec-draft-rag-reranking.md` 가 `plan/complete/` 아카이브에 있어 갱신 대상 여부가 불명확하다. 독자가 두 문서를 모두 읽으면 "off = byte-identical" 과 "byte-identical 폐기" 사이에서 혼선이 발생할 수 있다.
- **제안**: `plan/complete/spec-draft-rag-reranking.md` 상단에 `> [SUPERSEDED 2026-06-06] byte-identical 조항 폐기됨. 최신 정의: spec/5-system/9-rag-search.md §Rationale.` 주석 추가를 `project-planner` 에 위임하거나, 문서가 archive 전용이라 갱신 불필요임을 CLAUDE.md 에 명시한다.

---

### [INFO] escalate 정량 임계 (`ESCALATE_TOP_SCORE_FLOOR`, `ESCALATE_FLAT_REL_GAP`) — "provisional default" 표기 존재, 후속 plan 연결 확인

- **target 위치**: `codebase/backend/src/modules/knowledge-base/search/rerank.service.ts` 상수 선언 주석 `"provisional default — P0 골든셋 기반 A/B 로 확정 예정 (plan/in-progress/rag-rerank-followup.md)"`
- **과거 결정 출처**: `plan/in-progress/rag-quality-improvement.md §6` — `"escalate 진입 정량 임계는 합리적 default 로 시작, P0 골든셋 A/B 확정은 후속"` / `spec/5-system/9-rag-search.md §3.3.2` — `"v1 결정: 정량 임계는 합리적 default 로 시작, P0 골든셋 기반 A/B 확정은 후속(rag-rerank-followup.md)"`
- **상세**: Rationale 의 "provisional default / 후속 A/B 확정" 정책과 완전히 정합한다. 코드 주석이 `plan/in-progress/rag-rerank-followup.md` 를 참조하고 있고 spec 도 동일 경로를 지목한다.
- **제안**: `plan/in-progress/rag-rerank-followup.md` 파일이 실제 생성되어 있는지 확인하고, 없다면 plan stub 생성을 `project-planner` 에 위임. (`rag-quality-improvement.md §P1` 추적 항목과의 연결도 검토)

---

## 요약

이번 diff 는 `spec/5-system/9-rag-search.md §Rationale` 에 번복 근거("byte-identical 폐기", "conditional escalate 도입", "내부 상수 원칙")를 명시적으로 작성하고 구현이 이를 따르고 있어 Rationale 연속성 관점에서 전반적으로 양호하다. 주요 위험은 `plan/complete/spec-draft-rag-reranking.md §Rationale` 의 과거 "항상 grading(v1)" 및 "byte-identical" 선언이 번복 표시 없이 잔존하는 점으로, 이 문서를 읽는 독자가 새 spec 과 충돌을 인지할 수 있다. 이는 spec 파일 쓰기 권한이 없는 `developer` 가 처리하는 대신 `project-planner` 위임 항목으로 명시해야 한다. CRITICAL 급 위반(기각된 대안의 무근거 재도입, invariant 직접 위반)은 없다.

## 위험도

LOW
