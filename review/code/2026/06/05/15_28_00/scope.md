# 변경 범위(Scope) 리뷰 — agent-memory-scope-index-6b4a98

- 대상: `git diff 84dd7314..HEAD`
- 커밋: `faa464b8` (단일)
- 작업: A1 backlog listScopes filesort 인덱스 (V086)

---

## CRITICAL

없음.

---

## WARNING

- **[WARNING] rag-rerank 2개 plan 파일에 `spec_impact` frontmatter 추가가 본 PR 에 동봉됨**
  - 위치: `plan/complete/rag-rerank-followup-v2.md`, `plan/complete/rag-rerank-impl.md`
  - 상세: 본 작업의 논리적 범위는 `agent_memory` 인덱스 V086 단일 항목이다. 위 두 파일은 rag-rerank 워크트리(`rag-rerank-followup-864891`, `rag-rerank-impl`)에 속하는 이전 PR(#465·#466·#479·#481)의 plan 문서이며, 이번 커밋에서 `spec_impact` 키가 추가되었다. 변경 이유는 선존 gate red(#479 PR CI, `spec_impact` 누락) 해소이며, #481 과 동일한 fix 임을 인지하고 동봉한 것이다.
  - 정당성 평가: 목적은 명확(다른 PR CI 언블록)하고 변경량은 frontmatter 각 3줄로 최소적이다. 그러나 이 수정은 rag-rerank 워크트리의 plan 파일을 대상으로 하며, 해당 plan 파일의 소유 작업과 무관한 worktree 에서 수정된 것이다. #481 이 동일 fix 를 이미 제출했다면 두 PR 이 같은 파일의 같은 섹션을 수정하는 충돌 위험도 있다. 격리 인지 하에 의도적으로 동봉한 것은 문서화되어 있으나, 범위 정책("의도된 단일 작업만 변경") 관점에서는 본 PR 외부 산물이다.
  - 제안: (a) #481 이 이미 동일 fix 를 포함했거나 이미 머지됐다면 이 변경을 제거하고 충돌을 해소한다. (b) #481 이 아직 머지 전이라면 이 fix 를 #481 에만 남기고 본 PR 에서는 revert 하여 PR 경계를 단순하게 유지한다. (c) 게이트 해소가 긴급하다면 별도 단독 PR 로 분리한다.

---

## INFO

- **[INFO] plan frontmatter 의 `spec_impact` 와 `spec` 키가 중복 선언됨**
  - 위치: `plan/complete/agent-memory-scope-index.md` (frontmatter lines 8-13)
  - 상세: `spec_impact`(lines 8-10)와 `spec`(lines 11-13)에 동일한 두 파일이 중복 나열되어 있다. 의미상 동일한 정보를 두 키에 반복하면 향후 자동화 파서가 다른 키로 해석할 여지가 있다.
  - 제안: plan lifecycle 규약에 명시된 키만 사용하고 중복을 제거한다. `spec_impact` 가 spec 변경 파일 목록을 의미하는 표준 키라면 `spec` 키는 삭제.

- **[INFO] 마이그레이션 주석의 DOWN 섹션이 주석으로만 존재**
  - 위치: `codebase/backend/migrations/V086__agent_memory_scope_updated_index.sql` (line 19)
  - 상세: `-- DOWN: DROP INDEX CONCURRENTLY IF EXISTS ...` 가 SQL 주석으로만 기재되어 있다. 프로젝트 마이그레이션 규약(별도 rollback 파일 없이 주석으로 down 을 표기하는 패턴)에 부합하는지 확인 필요. 기존 V073·V080 등이 동일 패턴이면 INFO 수준이다.
  - 제안: 기존 마이그레이션 파일과 동일 패턴인지 일관성 확인 후 이상 없으면 무시.

---

## 요약

핵심 변경(V086 마이그레이션 2파일 + spec 2파일 인덱스 표 갱신 + plan 1파일)은 A1 backlog "listScopes filesort 인덱스" 범위에 정확히 부합한다. spec/17-agent-memory.md §1/AGM-02 와 spec/1-data-model.md §3 인덱스 표가 V086 인덱스와 일치하며 불필요한 코드·설정·포맷팅 변경은 없다. 단, rag-rerank plan 2파일의 `spec_impact` 추가는 이번 작업 범위 외부 산물로, 목적(선존 gate red 해소)은 명시되어 있으나 PR 경계를 흐린다. #481 과 동일 fix 이므로 충돌 및 중복 머지 위험을 반드시 확인해야 한다.

---

## 위험도

LOW

---

## BLOCK: NO

핵심 인덱스 변경 자체는 정확하고 범위 내이다. rag-rerank plan fix 는 WARNING 수준(범위 외 동봉)이지만 변경량이 frontmatter 6줄로 최소적이고 #481 충돌 여부를 사전에 인지하고 있으므로 단독으로 차단 사유가 되지 않는다. 단, #481 이 이미 머지되어 충돌이 발생한다면 리베이스 시 제거 필요.
