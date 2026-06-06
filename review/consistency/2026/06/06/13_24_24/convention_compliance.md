# Convention Compliance Review

**Target**: `spec/5-system/9-rag-search.md`
**Mode**: `--impl-prep` (구현 착수 전 검토)
**Scope**: D1 동적 컷 + D2 listwise escalate 변경사항 반영 여부, off 경로 하위호환 약속 충돌 여부

---

## 발견사항

### 1. **[CRITICAL]** `off` 경로 byte-identical 하위호환 약속과 D1 변경 충돌 — spec 본문 갱신 없음

- **target 위치**: `spec/5-system/9-rag-search.md §3.3.1` 모드 표의 `off` 행 설명: "**현행과 byte-identical (하위호환)**" + Rationale 첫 번째 항목 "(a) 하위호환 byte-identical"
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 의 의미는 "일부 구현됨"이며, spec 본문이 약속한 surface 와 구현이 정합해야 한다. `spec-code-paths.test.ts` 는 `code:` glob 이 실존 파일을 매치하는지만 검증하지만, spec 본문의 invariant 서술이 변경 전 구현을 기술하는 상태로 착수하면 "spec 본문이 구현 의도를 잘못 안내"하는 상태가 된다.
- **상세**: 변경 계획(prompt 내 D1)은 `off` 경로를 "topK(5) LIMIT SQL + cosine 임계 선차단"에서 "wide 회수(~50) → app-layer 동적 컷"으로 교체한다. 그런데 현행 spec §3.3.1 `off` 설명은 "현행과 byte-identical (하위호환)", §3.1 파라미터 표는 `$4 = 기본값 5`, Rationale은 "(a) 하위호환 byte-identical"을 `off` 기본의 첫 번째 근거로 든다. 구현 후 이 서술들은 사실과 다르게 된다. 구현 착수 전에 spec 을 갱신하지 않으면, 구현이 spec 과 충돌한 채 merged 되고 `spec-frontmatter.test.ts` / `spec-code-paths.test.ts` 는 이를 감지하지 못한다(서술 불일치는 텍스트 레벨 가드 없음).
- **제안**: 구현 착수 전(또는 동일 PR 안에서) `project-planner` 역할로 spec 을 갱신해야 한다. 갱신 범위:
  1. §3.3.1 `off` 행 설명을 D1 실제 동작(wide 회수 → app-layer 동적 컷)으로 교체하고 "byte-identical 하위호환" 서술 제거.
  2. §3.1 파라미터 표에서 `$4 = 기본값 5` 를 wide 회수 상수(~50)와 동적 컷 메커니즘으로 교체.
  3. §3.3.2 흐름 단계에 `off` 경로 동적 컷 단계 추가.
  4. Rationale에서 "byte-identical" 근거를 제거하고 D1 결정의 근거를 Rationale I5 이후로 추가.
  5. `pending_plans:` 에 본 변경 plan 경로 등재 후 `status: partial` 유지 또는 plan 목록 정합 점검.

---

### 2. **[CRITICAL]** `ragTopK` default 제거(`.optional()`) 시 §3.1 파라미터 표의 "기본값 5" 서술과 충돌

- **target 위치**: `spec/5-system/9-rag-search.md §3.1` 파라미터 표, `$4` 행: "최대 결과 수 (topK) | LLM 호출 인자 또는 5"
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` 동일. 또한 `spec/4-nodes/3-ai/1-ai-agent.md §1` config 표: `ragTopK | Integer | | 5 | ...`
- **상세**: 변경 계획은 `ai-agent.schema.ts` 의 `ragTopK` zod `.default(5)` 를 제거해 `.optional()` 로 바꾼다. 미지정 시 dynamic cut 의 inject-cap(12)이 ceiling이 된다고 기술한다. 그러나 spec §3.1은 여전히 `기본값 5` 를 표기하고, `1-ai-agent.md §1`도 `기본값 5` 를 표기한다. 구현 후 두 spec 문서의 기본값 서술이 사실과 달라진다. `ai-agent.md §1` 의 수정은 `developer` 가 `spec/` 를 직접 수정할 수 없으므로 `project-planner` 위임 없이 착수하면 spec-drift 가 남는다.
- **제안**:
  1. `spec/5-system/9-rag-search.md §3.1` 파라미터 표에서 `$4` 기본값 "5" → "미지정 시 dynamic cut inject-cap(12) ceiling; LLM 호출 인자 또는 노드 ragTopK 명시 시 그 값이 override" 로 수정.
  2. `spec/4-nodes/3-ai/1-ai-agent.md §1` config 표에서 `ragTopK` 기본값 `5` → `—` (optional, dynamic cut 이 지배; 명시 시 ceiling override) 로 수정하고 설명에 D1 의미 변경 기술.
  3. 두 수정 모두 `project-planner` 가 선행 처리하거나 동일 PR 안에서 처리한 뒤 구현 착수.

---

### 3. **[WARNING]** D2 `cross_encoder_llm` 동작 변경 — spec §3.3.1·§3.3.2 v1 결정 서술과 불일치

- **target 위치**: `spec/5-system/9-rag-search.md §3.3.1` v1 결정 서술: "cross_encoder_llm 은 **항상** LLM grading 을 수행한다(점수 평탄/모호 기반 conditional escalate 는 LLM 콜 비용 절감 최적화로, **정량 임계를 P0 평가셋으로 보정한 뒤 후속 도입**)" 및 §3.3.2 단계 3: "[cross_encoder_llm 만] survivors(~15) listwise LLM grading **항상** 수행"
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — spec 본문의 약속과 구현 의도 정합 원칙. 단, 본 항목은 D2 가 "v1 spec 이 명시한 P0 후속 메커니즘 도입"이라고 prompt 에 적시됐으므로, spec 이 스스로 허용한 후속 도입이기도 하다.
- **상세**: 변경 계획(D2)은 `cross_encoder_llm` 을 "항상 LLM grading" → "conditional escalate(상위 점수 평탄/모호 시에만 listwise grading)"으로 변경한다. 이는 spec §3.3.1 의 "항상" 서술과 정반대다. spec 이 "P0 평가셋 보정 후 후속 도입"이라고 명시했으므로 의도는 인지됐으나, 정량 임계(A/B 확정은 follow-up)가 아직 없는 상태에서 conditional escalate 를 먼저 도입하면 spec 본문의 "항상" 과 구현의 "conditional" 이 공존하게 된다.
- **제안**: D2 착수 전에 spec §3.3.1 v1 결정 서술을 "conditional escalate 도입 단계(정량 임계 미확정, 휴리스틱 임계 적용) + 정량 임계 A/B 는 후속"으로 갱신하고, §3.3.2 단계 3 도 "상위 점수 평탄/모호 시 conditional escalate" 로 수정한다. 정량 임계 보정이 follow-up 임을 Rationale 에 명시. 또는 D1 만 먼저 착수하고 D2 는 spec 갱신 확정 후 별도 PR 로 분리.

---

### 4. **[WARNING]** `pending_plans:` 에 본 구현을 책임지는 in-progress plan 이 누락될 가능성

- **target 위치**: `spec/5-system/9-rag-search.md` frontmatter
  ```yaml
  status: partial
  pending_plans:
    - plan/in-progress/rag-rerank-followup.md
  ```
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: partial` 시 `pending_plans:` 의무. §3 — `partial` 의 `pending_plans:` 은 미구현 surface 를 책임지는 plan 경로여야 한다. `spec-pending-plan-existence.test.ts` 가 실존을 강제한다.
- **상세**: D1·D2 변경을 책임지는 신규 plan 이 `plan/in-progress/` 에 존재하고 `pending_plans:` 에 등재돼야 한다. 현재 등재된 `rag-rerank-followup.md` 가 D1·D2 범위를 포함하는지 확인이 필요하다. 만약 별도 plan 파일이 생성됐거나 기존 plan 이 갱신됐다면 `pending_plans:` 도 동기화해야 한다. 등재 누락 시 `spec-pending-plan-existence.test.ts` 는 현재 등재된 경로의 실존만 보므로 silently 통과할 수 있으나, spec-impl 갭 심화의 원인이 된다.
- **제안**: D1·D2 구현 plan 파일 경로를 `pending_plans:` 에 명시적으로 추가한다. `rag-rerank-followup.md` 가 이미 D1·D2 를 포함한다면 그 plan 의 내용이 갱신됐음을 확인한다.

---

### 5. **[WARNING]** `ragDiagnostics.rerank` error 코드 케이스 — D1 off 경로 신규 에러 코드 없음 여부 확인 필요

- **target 위치**: `spec/5-system/9-rag-search.md §4.2` + §6 에러 처리 표
- **위반 규약**: `spec/conventions/error-codes.md §1` — 신규 에러 코드는 "의미 기반 명명, UPPER_SNAKE_CASE". `spec/conventions/node-output.md §3.2` — `code` 는 UPPER_SNAKE_CASE.
- **상세**: D1 동적 컷 로직(`applyDynamicCut`)이 실패하거나 예상 밖 입력을 받을 때 새 에러 코드가 필요한지 검토가 필요하다. 현재 spec §6 에는 off 경로 실패에 대한 전용 에러 코드가 없다(cosine 경로는 `search_failed` 로 처리). D1 이 app-layer 에서 동적 컷을 수행하므로 추가 실패 모드(token 추정 실패 등)가 생기면 새 에러 코드를 spec-first 로 정의해야 한다. 정의 없이 구현에서 임의 문자열을 사용하면 error-codes 명명 규약 위반.
- **제안**: D1 구현 전 "동적 컷이 실패할 수 있는 케이스와 그 에러 코드(또는 fallback 동작)"를 spec §6 에 명시한다. 추가 에러 코드가 없고 기존 cosine 경로의 `search_failed` fallback 으로 처리한다면 그 결정을 spec 에 명시.

---

### 6. **[INFO]** `spec/5-system/9-rag-search.md` 문서 구조 — 3섹션(Overview/본문/Rationale) 준수 확인

- **target 위치**: `spec/5-system/9-rag-search.md` 전체 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: 현행 spec 은 `## Overview (제품 정의)` → 본문(§1~§7) → `## Rationale` 으로 3섹션을 갖추고 있다. D1·D2 변경 내용은 본문 §3.3 과 Rationale 에 반영되어야 하며 구조 자체를 파괴하지 않는다. 기존 Rationale 에 I4(`신규 config 필드 증식 회피`)·I5(`ragThreshold 재해석`) 등이 존재하므로, D1 결정 근거는 I5 이후 연번으로 추가한다(기존 Rationale 의 bullet 스타일을 따름).
- **제안**: D1·D2 관련 Rationale 항목을 기존 bullet 스타일(왜 off 경로를 변경했나, 왜 byte-identical 약속을 철회했나, 왜 conditional escalate 를 먼저 도입하는가)로 추가.

---

### 7. **[INFO]** `spec/5-system/9-rag-search.md` frontmatter `id` 필드 — kebab-case 준수

- **target 위치**: `spec/5-system/9-rag-search.md` frontmatter: `id: rag-search`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `id: string (kebab-case)`. 현행 `rag-search` 는 규약 준수.
- **상세**: 이상 없음. 참고로 `status: partial` 이고 `pending_plans:` 에 `plan/in-progress/rag-rerank-followup.md` 1개가 등재돼 있으며, `code:` glob 2개가 실존 파일을 참조하는지는 별도 `spec-code-paths.test.ts` 가 검증한다.
- **제안**: 해당 없음.

---

## 요약

정식 규약 준수 관점에서 가장 중요한 문제는 **D1 이 `off` 경로의 byte-identical 하위호환 약속을 명시적으로 철회하는 변경임에도 spec 본문이 사전 갱신되지 않는다는 점**이다. `spec/5-system/9-rag-search.md §3.3.1·§3.1·Rationale` 이 여전히 "byte-identical" 와 "기본값 5"를 약속하는 상태에서 구현이 wide 회수 + 동적 컷으로 교체되면 spec 과 구현이 역전된다. 같은 이유로 `ai-agent.md §1` 의 `ragTopK` 기본값 서술도 불일치를 유발한다. 이 두 CRITICAL 항목은 `project-planner` 가 spec 을 먼저 갱신해야 `developer` 가 착수할 수 있다는 CLAUDE.md 의 역할 분리 원칙과 정합한다. D2(`cross_encoder_llm` conditional escalate)는 spec 이 "P0 후속 도입"이라 사전 허용했으나, "항상" 서술을 "conditional" 로 바꾸는 것이므로 WARNING 수준의 spec 갱신이 선행되어야 한다. 나머지 항목(pending_plans 동기화, 신규 에러코드 정의)은 구현 착수 전·동일 PR 안에서 처리 가능한 WARNING/INFO 수준이다.

---

## 위험도

**HIGH**

> CRITICAL 2건(off 경로 byte-identical 약속 철회 미반영, ragTopK default 제거 미반영)은 구현 착수 전 spec 갱신 없이 진행하면 spec-impl invariant 가 깨진다. `project-planner` 선행 처리 또는 동일 PR 에 spec 갱신 포함이 차단 조건.
