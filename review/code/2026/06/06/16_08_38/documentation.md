# 문서화(Documentation) 리뷰 결과

리뷰 대상: RAG 동적 컷(D1) + Conditional Escalate(D2) 관련 consistency review 산출물 및 spec 파일 변경

---

## 발견사항

- **[WARNING]** spec draft 의 Rationale 갱신 항목이 "편집 지시" 형태에 머물러 확정 문서로서의 자기완결성 부족
  - 위치: `plan/in-progress/spec-draft-rag-dynamic-cut.md §A8` (review 파일들이 공통으로 지적)
  - 상세: `review/consistency/2026/06/06/14_53_44/rationale_continuity.md` 와 `SUMMARY.md` 가 모두 지적하듯, §A8 의 핵심 Rationale 갱신 내용(D2 번복 기존 결정 출처 인용, byte-identical 폐기 선언)이 실제 확정 텍스트가 아닌 "편집 지시" 형태로만 존재한다. spec 문서 기준에서 Rationale 은 "결정의 배경·근거"를 담는 확정 단일 진실이어야 하며, 지시 형태로만 남기면 spec 편집 시 해당 내용이 생략될 경우 기존 문서와 신규 동작이 문서상 충돌 상태가 된다.
  - 제안: spec draft 의 §A8 Rationale 갱신 항목에 "v1 확정 결정 폐기 선언(출처 3곳 직접 인용)"과 "byte-identical 조항 폐기 선언"을 지시가 아닌 확정 문안으로 삽입해 자기완결적 spec 편집 지침이 되도록 한다.

- **[WARNING]** `spec/5-system/9-rag-search.md` Rationale 절의 기존 (a) byte-identical 조항 폐기가 spec 본문에서 미완 — 주석 정확성 훼손 위험
  - 위치: `spec/5-system/9-rag-search.md §Rationale "왜 완전 선택적(off 기본)인가"` (현재 변경 미포함)
  - 상세: 이번 변경 diff 에 포함된 `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/17-agent-memory.md` 는 실제로 변경됐으나, `spec/5-system/9-rag-search.md` 의 기존 Rationale "(a) 하위호환 byte-identical" 항목 교체는 이번 PR diff 에 포함되지 않는다. off 모드가 이미 동적 컷을 적용하는 동작으로 변경됐다면 기존 "byte-identical (하위호환)" 문구가 오래된 주석으로 남게 된다. 이는 독자가 spec을 읽을 때 잘못된 동작을 기대하게 만들 수 있다.
  - 제안: `spec/5-system/9-rag-search.md` §3.3.1 `off` 행 및 Rationale 절의 byte-identical 문구를 동적 컷 적용 사실을 반영한 내용으로 교체한다.

- **[INFO]** consistency review 산출물에 검토 대상 spec draft 파일 경로가 절대 경로로 기재됨 — 이식성 문제
  - 위치: `review/consistency/2026/06/06/14_53_44/convention_compliance.md` 라인 3, `review/consistency/2026/06/06/14_44_26/rationale_continuity.md`
  - 상세: `검토 대상: /Volumes/project/private/clemvion/.claude/worktrees/...` 형태의 절대 경로가 review 산출물 본문에 기재되어 있다. review 산출물은 `review/` 폴더에 이식 가능한 상대 경로나 repo 루트 기준 경로를 사용해야 다른 머신이나 clone 에서 읽을 때 의미를 보존할 수 있다.
  - 제안: review 산출물의 "검토 대상" 행에서 절대 경로 대신 repo 루트 기준 상대 경로(`plan/in-progress/spec-draft-rag-dynamic-cut.md`)를 사용하도록 review 도구 프롬프트 템플릿을 보정한다.

- **[INFO]** `spec/5-system/10-graph-rag.md` §4.2 SQL `LIMIT $5` 주석 교체 — 인라인 주석이 코드-spec 계약을 기술하지만 파라미터 번호($5)의 의미가 다른 파라미터($1~$4)와의 관계 없이 독립 서술됨
  - 위치: `spec/5-system/10-graph-rag.md` 라인 471
  - 상세: 신규 주석 `-- 회수 폭(recall): vectorSeedTopK + expandedChunkLimit. 최종 주입 청크 수는 app-layer 동적 점수 컷(RAG 검색 §3.4)이 결정` 은 변경 내용을 기술하지만, `$5` 라는 바인딩 파라미터 번호가 SQL 나머지 파라미터($1~$4)의 의미와 함께 문서화되지 않아 독자가 파라미터 바인딩 순서를 이해하기 어렵다. cross_spec.md 의 W4 지적처럼 `$5` 가 실제로 `vectorSeedTopK + expandedChunkLimit` 를 바인딩하는지 `ragTopK` 를 바인딩하는지 spec 레벨에서 확정되지 않은 상태다.
  - 제안: `10-graph-rag.md §4.2` SQL 블록 상단 또는 직전에 파라미터 바인딩 표($1=…, $2=…, $5=vectorSeedTopK+expandedChunkLimit)를 짧게 명시하거나, `$5` 주석에 "코드 `rag-search.service.ts` graph 분기 `$5` 바인딩 확인 필요" 조건 주석을 남긴다.

- **[INFO]** `spec/4-nodes/3-ai/1-ai-agent.md` 예시 JSON 에서 `ragTopK: 5` 행 삭제 — 예시 코드에서 `ragTopK` 사용법(선택적 override) 설명 부재
  - 위치: `spec/4-nodes/3-ai/1-ai-agent.md` 라인 664~665 구간
  - 상세: 기존 예시 JSON 에서 `"ragTopK": 5` 행이 삭제됐다. `ragTopK` 가 이제 "선택적 상한 override"라는 새로운 의미를 갖는데, 예시 코드에서 이를 어떻게 쓰는지(예: `"ragTopK": 8` — inject-cap 을 8로 ceiling 지정)를 보여주는 예제가 없다. 새로운 동작 패턴은 예시 없이 필드 설명만으로는 사용법이 불명확하다.
  - 제안: 예시 JSON 에 주석 형태(`// ragTopK: 8 // optional — ceiling, 미지정 시 동적 컷이 결정`)나 별도 "선택적 override 예시" 블록을 추가해 사용법을 명확히 한다.

- **[INFO]** `_retry_state.json` 이 review 산출물 폴더에 커밋됨 — 도구 내부 상태 파일이 산출 문서와 동일 폴더에 위치
  - 위치: `review/consistency/2026/06/06/14_53_44/_retry_state.json`
  - 상세: `_retry_state.json` 은 orchestrator 의 재시도 상태기계 내부 파일이다. 산출물 폴더에 포함되어 있으면 코드 리뷰 도구나 독자가 산출물로 오해할 수 있고, `agents_pending: [...]` / `agents_success: []` 같은 초기 상태가 영구 기록으로 남아 실제 실행 결과를 나타내지 않는다. 현재 파일은 `agents_success: []`(성공 에이전트 없음)이지만 실제로는 모든 checker 가 성공적으로 완료됐다.
  - 제안: `_retry_state.json` 등 도구 내부 상태 파일은 `.gitignore` 에 `review/**/_retry_state.json` 패턴으로 추가하거나 산출물 폴더와 분리된 임시 경로에서 관리한다.

- **[INFO]** `meta.json` 의 `mode` 필드 값이 한국어 자유 서술("spec draft 검토 (--spec)")로 기재됨 — 프로그래머틱 파싱 어려움
  - 위치: `review/consistency/2026/06/06/14_53_44/meta.json` 라인 3
  - 상세: `"mode": "spec draft 검토 (--spec)"` 는 자유 텍스트 형태라 일관된 파싱이 어렵다. `--spec`, `--impl-prep` 등 CLI 플래그 값 자체를 사용하면 도구 간 일관성이 높아진다.
  - 제안: `"mode": "spec"` 또는 `"mode": "--spec"` 형태의 enum-like 값 사용을 권장한다.

---

## 요약

이번 변경은 RAG 동적 컷(D1)·conditional escalate(D2) 도입에 따른 spec 파일 5종(`1-data-model.md`, `0-common.md`, `1-ai-agent.md`, `10-graph-rag.md`, `17-agent-memory.md`) 갱신과 consistency review 산출물 추가로 구성된다. 실제 spec 변경 파일들은 필드 설명을 신규 동작에 맞게 충실히 갱신했으나, 문서화 관점에서 두 가지 WARNING 이 존재한다. 첫째, spec draft(§A8 Rationale)의 핵심 결정 번복 내용(D2 escalate 도입, byte-identical 폐기)이 확정 텍스트가 아닌 편집 지시 형태에 머물러 있어 실제 spec 편집 시 누락 위험이 있다. 둘째, `spec/5-system/9-rag-search.md` 의 기존 "(a) byte-identical" Rationale 조항이 이번 PR diff 에 포함되지 않아 오래된 주석이 잔존할 가능성이 있다. INFO 수준에서는 예시 JSON 에서 새로운 ragTopK 사용법 예제 부재, SQL 파라미터 바인딩 문서 미완, review 내부 파일 관리 방식이 개선 여지로 지적된다.

---

## 위험도

MEDIUM
