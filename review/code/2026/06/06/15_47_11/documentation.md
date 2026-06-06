# 문서화(Documentation) Review

리뷰 대상: `spec/5-system/9-rag-search.md` (RAG 동적 점수 컷 D1 + conditional escalate D2 spec 갱신)

---

## 발견사항

### [INFO] §3.4 신규 섹션 — 내부 상수 값 노출 수준 적절
- 위치: §3.4 상수 목록 (`RAG_RECALL_K`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT`)
- 상세: 세 상수가 spec 본문에 구체 숫자와 함께 정의되어 있고, `dynamic-cut.util.ts` 의 실제 값(50, 8000, 12)과 일치한다. "환경변수 미노출·module-level 상수" 라는 제약도 코드와 일치(`export const`, 환경변수 참조 없음).
- 제안: 현행 유지. 다만 값이 후속 PR 에서 바뀌면 spec 도 함께 갱신 필요 (단일 진실 유지).

### [INFO] `top_k` tool description 실코드와 미묘한 표현 차이 (비차단)
- 위치: spec §2.1 tool 정의 JSON 예시 vs `kb-tool-provider.ts` 라인 161
- 상세: spec 예시는 `"Max chunks to inject. If omitted, a dynamic token-budget cut applies (internal ceiling). Increase for broader recall."`, 실제 코드는 `"Max chunks to inject. If omitted, a dynamic token-budget cut decides the count. Increase for broader recall."`. 의미 차이는 없으나 spec 이 정규 API 계약 문서 역할을 할 때 표현이 미세하게 다르다.
- 제안: spec 예시 문구를 코드와 동일하게(`decides the count`)로 맞추거나, spec 은 의미적 기술로 유지하는 방침을 명확화. v1 단계에서는 비차단.

### [INFO] `gradingNoGrounding` 필드 — `rerank` 서브객체 스키마 예시에 이미 반영됨
- 위치: §4.2 `rerank` 서브객체 JSON 예시 (라인 `"gradingNoGrounding": false`)
- 상세: 새 진단 필드 `gradingNoGrounding` 가 스키마 예시와 필드 설명 두 곳 모두에 추가되어 있고 서로 일치한다. `dynamic-cut.util.ts` 및 `kb-tool-provider.ts` 에는 이 필드 값이 직접 생성되지 않으므로(rerank 서비스 레이어에서 생성될 예정), 현재 diff 범위에서는 구현 부재가 예상된다.
- 제안: 구현 완료 시 `rerank.service.ts` 에 `gradingNoGrounding` 산출 로직의 JSDoc 주석 추가 권장. 현재 spec은 충분히 명세하고 있어 문서화 자체는 완결.

### [INFO] `cutoffApplied` 의미 확장 — 설명 내 두 케이스 혼용 가능성
- 위치: §4.2 `cutoffApplied` 설명
- 상세: `cutoffApplied: true` 가 "rerank 점수 컷(θ) / token-budget 컷 / inject-cap 컷 어느 것이든" 포함하며, off 경로의 동적 컷은 v1 에서 진단에 노출하지 않는다고 명시되어 있다. 즉 `rerank` 서브객체가 없는 off 경로에서는 `cutoffApplied` 자체가 없으므로 off 경로 소비자(UI·테스트)가 혼동할 여지가 있다.
- 제안: spec 주석에 "off 경로 호출에는 `rerank` 서브객체 자체가 부재하므로 `cutoffApplied` 도 노출 안 됨"을 한 줄 명시하면 소비자 혼동을 방지할 수 있다. 현재 `rerank` 서브객체 조건(`rerank_mode ≠ off`)이 그 위에 서술되어 있어 추론은 가능하나, 컴팩트 명시가 더 명확.

### [INFO] `[^recall]` 각주와 본문 중복 서술 — 가독성 약간 저하
- 위치: §3.1 파라미터 표 `[^recall]` 각주 + §3.1 직후 blockquote "회수·컷 분기"
- 상세: 각주와 blockquote 가 유사한 내용("D1 이전의 `LIMIT topK(5)` 고정 COUNT 선차단을 회수 폭 확대 + 동적 컷으로 대체")을 각기 다른 길이로 반복한다. spec 문서 내에서 단일 진실 원칙이 약간 희석되는 느낌이나, 각주는 파라미터 표 맥락용, blockquote 는 경로 분기 요약용으로 구분이 있어 허용 범위.
- 제안: 두 설명이 실질적으로 겹치는 문장을 줄이거나, 각주를 "→ 상세는 §3.4" 참조 링크 한 줄로 축약하면 유지보수 비용 감소.

### [INFO] `pending_plans` frontmatter 갱신 — 적절
- 위치: 파일 상단 frontmatter (라인 35 추가)
- 상세: `plan/in-progress/rag-dynamic-cut.md` 가 `pending_plans` 에 추가되어 spec ↔ plan 연결이 올바르게 유지됨. 해당 plan 파일도 실제로 존재한다.
- 제안: 이상 없음.

### [INFO] Rationale 섹션 — v1 결정 갱신 이력 명시 양호
- 위치: §Rationale "byte-identical 조항 폐기 (D1, 2026-06-06)"
- 상세: 기존 결정(`plan/complete/spec-draft-rag-reranking.md`)과의 연결, 폐기 사유, 새로운 하위호환 정의가 명확하게 기술되어 있다. 날짜(2026-06-06) 태깅이 되어 있어 변경 이력 추적이 가능하다.
- 제안: 이상 없음.

### [WARNING] `DynamicCutOptions` / `DynamicCutResult` 인터페이스 — JSDoc 부분 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` 라인 18-29
- 상세: `DynamicCutOptions` 와 `DynamicCutResult<T>` 인터페이스의 각 필드에는 한 줄 인라인 주석이 있으나, 인터페이스 자체에 JSDoc 블록이 없다. 공개 `applyDynamicCut` 함수에는 상세한 JSDoc 이 있으나, 타입 인터페이스에 요약 JSDoc 이 없으면 IDE 호버 문서가 빈 상태가 된다.
- 제안:
  ```ts
  /** RAG 동적 점수 컷 옵션 (spec §3.4). */
  export interface DynamicCutOptions { ... }

  /** 동적 점수 컷 결과. */
  export interface DynamicCutResult<T> { ... }
  ```
  추가 권장. 단 spec 문서 자체 완결성에는 영향 없음.

### [INFO] 코드 참조 링크 일관성 — spec 과 코드 교차 참조 적절
- 위치: `rag-search.service.ts` 라인 34 (`// spec/5-system/9-rag-search.md §3.3`), `dynamic-cut.util.ts` 라인 4 (`// spec/5-system/9-rag-search.md §3.4`)
- 상세: 코드의 인라인 주석이 spec 섹션을 명확히 참조하고 있어 spec ↔ 코드 추적이 용이하다. `kb-tool-provider.ts` 라인 120 도 `(spec/5-system/9-rag-search.md §3.4)` 를 참조한다.
- 제안: 이상 없음.

---

## 요약

이번 변경은 순수 spec 문서(`spec/5-system/9-rag-search.md`) 갱신으로, 구현 코드(`dynamic-cut.util.ts`, `rag-search.service.ts`, `kb-tool-provider.ts`)와의 정합성이 전반적으로 양호하다. §3.4 신규 섹션은 내부 상수·적용 경로·실패 처리를 빠짐없이 서술했고, Rationale 의 byte-identical 조항 폐기와 날짜 태깅은 변경 이력을 충분히 보존한다. 주요 미비점은 (1) `top_k` tool description 의 spec 예시와 실코드 간 미세 표현 불일치(비차단), (2) `DynamicCutOptions`/`DynamicCutResult` 인터페이스에 JSDoc 블록 부재(낮은 심각도)이며, `cutoffApplied` 의 off 경로 명시적 부재 설명을 보강하면 소비자 혼동을 줄일 수 있다. README·CHANGELOG·환경변수 문서 갱신은 내부 상수 미노출 정책 하에 불필요하다.

## 위험도

LOW
