# 문서화(Documentation) Review

## 발견사항

### [INFO] `hnswEfSearchFor` JSDoc — 공개 함수 문서화 충분
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` L24–31
- 상세: 공개 함수 `hnswEfSearchFor`에 JSDoc이 추가되어 있으며, clamp 범위([40, 1000]), 2× 헤드룸 근거, SET LOCAL GUC 직접 보간 안전성 근거, `Math.ceil`·비유한 입력 방어 목적이 모두 명시돼 있다. spec 참조(§3.4)는 없으나 상수 `HNSW_EF_SEARCH_DEFAULT`/`HNSW_EF_SEARCH_MAX` 위의 인라인 주석에 `(spec/5-system/9-rag-search.md §3.4)` 가 포함되어 상호 보완이 된다.
- 제안: 없음 (양호).

### [INFO] `HNSW_EF_SEARCH_DEFAULT`/`HNSW_EF_SEARCH_MAX` 상수 — 인라인 주석으로 맥락 충분
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts` L18–22
- 상세: 두 상수 모두 단독 JSDoc 없이 블록 인라인 주석으로 설명된다. pgvector 기본값(40)·상한(1000)의 의미, recall@LIMIT 저하 조건, wide 회수 폭(RAG_RECALL_K=50·candidateK≤200)과의 관계, spec 링크(`§3.4`)가 모두 포함돼 있어 공개 모듈 상수 수준으로 적절하다.
- 제안: 없음 (양호).

### [INFO] `rag-search.service.ts` `searchVectorGroup` — 인라인 주석이 트랜잭션 도입 이유를 정확히 설명
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` L420–426
- 상세: `SET LOCAL`이 트랜잭션 스코프임을 명시하고 풀 커넥션 오염 없음·GUC 파라미터 바인딩 불가에 따른 직접 보간 안전 근거·정수 clamp 보장까지 설명한다. 기존 단순 `query` 호출에서 `transaction` 래퍼로 변경되면서 코드 의도가 불명확해질 수 있는 지점을 주석이 정확히 커버한다.
- 제안: 없음 (양호).

### [INFO] graph seed 미적용 주석 — 미래 유지보수 가이드 포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` L515–517
- 상세: `seedTopK < HNSW_EF_SEARCH_DEFAULT(40)` 라 미적용한 이유와, seedTopK 가 40 초과가 될 경우 `hnswEfSearchFor(seedTopK)` 적용을 재검토하라는 미래 가이드가 명시돼 있다. 유사 패턴을 나중에 적용할 개발자에게 필요한 정보를 정확히 제공한다.
- 제안: 없음 (양호).

### [INFO] 테스트 파일 주석 — mock 설계 의도가 명확히 서술됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts` diff L131–143
- 상세: `mockEm` 설계 근거(SET LOCAL 흡수·recall SQL은 기존 mock으로 위임·기존 호출 인덱스 단언 유지)가 `beforeEach` 코드블록 위 주석에 정확히 서술돼 있다. 테스트 설계 의도를 코드만으로는 파악하기 어려운 지점이라 주석이 중요하고 충분하다.
- 제안: 없음 (양호).

### [WARNING] `spec/5-system/9-rag-search.md` — `hnswEfSearchFor` 함수명·`HNSW_EF_SEARCH_DEFAULT`/`MAX` 상수명 spec에 미언급
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/spec/5-system/9-rag-search.md` §3.4 (L245 구간)
- 상세: spec §3.4 는 `clamp(LIMIT×2, 40, 1000)` 공식과 `hnswEfSearchFor`를 언급하며 구현과 연결하지만, 두 상수(`HNSW_EF_SEARCH_DEFAULT=40`, `HNSW_EF_SEARCH_MAX=1000`)가 코드에서 독립 명명 상수로 분리돼 있음을 spec이 명시하지 않는다. spec은 매직 넘버 40·1000을 직접 사용하고 있어, 나중에 상수값 조정 시 spec과 코드 간 drift가 발생할 여지가 있다. 단, spec이 구현 상수명을 모두 나열할 의무는 없으므로 WARNING 수준이다.
- 제안: spec §3.4 에 한 줄 추가: "`HNSW_EF_SEARCH_DEFAULT(40)`·`HNSW_EF_SEARCH_MAX(1000)`은 `dynamic-cut.util.ts`에 명명 상수로 정의돼 있어 조정 시 단일 지점에서 변경 가능." (선택사항이나 spec-as-SoT 원칙상 권장).

### [INFO] `plan/in-progress/rag-followup-efsearch.md` — 작업 배경·범위·체크리스트 충분
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/plan/in-progress/rag-followup-efsearch.md`
- 상세: worktree, started, owner, spec_impact frontmatter가 완전하고, 배경(#500 머지 후 ef_search 누락 correctness gap), 범위(#3 ef_search + #2 spec 정합), #1 보류 이유(골든셋 미확보)가 모두 서술돼 있다. 체크리스트 미완료 항목(2~4)이 현 진행 상태를 정확히 반영한다.
- 제안: 없음 (양호).

### [INFO] `plan/in-progress/rag-quality-improvement.md` — P1 완료 항목 업데이트가 코드 변경과 정합
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/plan/in-progress/rag-quality-improvement.md` §P1 구간
- 상세: D1/D2/cross-encoder/grounding 4개 항목 모두 체크돼 있으며, PR 번호·spec 링크·조치 요약이 정확하다. `ef_search recall 보전`이 D1 완료 항목 설명에 포함된 점은 이 PR의 변경 내용과 정합한다(`rag-dynamic-cut PR #500: ... ef_search recall 보전`). 단, `ef_search recall 보전`이 사실은 본 PR(#500이 아니라 rag-followup-efsearch)에서 처리됨에도 #500 항목 설명에 이미 포함돼 있다 — 이는 기록 정확성 관점에서 사소한 혼선 요소다.
- 제안: D1 설명에서 "ef_search recall 보전"을 별도 항목(`- [ ] **ef_search recall 보전**(#3) — rag-followup-efsearch PR`)으로 분리하거나, 완료 후 `[x]`로 업데이트하면 PR 귀속이 명확해진다. (선택사항)

### [INFO] `plan/complete/spec-draft-rag-reranking.md` — SUPERSEDED 주석 추가로 역사 맥락 보존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/plan/complete/spec-draft-rag-reranking.md` 마지막 결정 항목
- 상세: ② 결정에 `[SUPERSEDED 2026-06-06]` 마커와 대체 내용·근거 링크가 추가됐다. 완료된 plan 문서의 역사적 사실을 덮어쓰지 않고 supersede 주석으로 보존하는 방식이 적절하다.
- 제안: 없음 (양호).

### [INFO] `plan/complete/fix-carousel-waiting-status.md` — `spec_impact` frontmatter 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/plan/complete/fix-carousel-waiting-status.md`
- 상세: `spec_impact` 필드가 소급 추가됐다. plan lifecycle 규약상 완료 plan 문서는 이동 후 수정 최소화가 권장되나, `spec_impact` 필드 추가는 spec 정합성 추적에 유용한 메타데이터 보완이다.
- 제안: 없음 (양호).

### [INFO] `dynamic-cut.util.spec.ts` 테스트 주석 — 각 케이스 기대값 설명이 명확
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-followup-efsearch-b6c8e8/codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.spec.ts` diff L43–58
- 상세: `hnswEfSearchFor` 테스트 각 케이스에 인라인 설명(`// 50×2`, `// 10 < 40 → 하한`, `// ceil(5.5)=6, 12 < 40 → 하한`, `// 비유한 → 기본값` 등)이 포함돼 있어 기대값이 어떤 수식에서 도출됐는지 즉시 이해 가능하다. 숫자만 나열된 테스트보다 문서 기능을 겸하는 좋은 패턴이다.
- 제안: 없음 (양호).

---

## 요약

이번 변경(RAG ef_search recall 보전 + 주변 plan 정합)의 문서화 품질은 전반적으로 우수하다. `hnswEfSearchFor` 공개 함수에 JSDoc이 완비됐고, 상수 2개는 인라인 주석으로 spec 링크와 함께 맥락이 서술됐다. `rag-search.service.ts`의 트랜잭션 도입 이유와 graph seed 미적용 근거도 인라인 주석으로 정확히 설명된다. 테스트 파일의 `mockEm` 설계 의도와 각 케이스 기대값 도출 수식도 주석으로 명확히 표현돼 있다. 주요 미흡 사항은 `spec/5-system/9-rag-search.md §3.4`가 `HNSW_EF_SEARCH_DEFAULT`/`MAX`를 매직 넘버로 직접 기재하고 있어 나중에 상수값을 조정할 때 spec-코드 drift가 생길 여지가 있다는 점이다(WARNING 1건). 이를 제외하면 비고·이력·설정 문서화 측면에서 미흡 사항이 없다.

## 위험도

LOW
