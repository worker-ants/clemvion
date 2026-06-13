# 유지보수성(Maintainability) 리뷰

## 발견사항

### **[WARNING]** `CHUNK_SIZE` 지역 상수와 `EMBED_CHUNK_SIZE` 클래스 상수 중복 — 동일한 값 100이 두 곳에 독립 선언됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-05-database-721c98/codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` line 57, line 519
- 상세: `KnowledgeBaseService.EMBED_CHUNK_SIZE = 100`(클래스 `static readonly`)과 `retryFailedDocuments` 메서드 내부의 `const CHUNK_SIZE = 100`(지역 상수)이 동일한 의미의 숫자를 두 번 정의하고 있다. `enqueueEmbedChunked`가 `EMBED_CHUNK_SIZE`를 쓰는 반면 `retryFailedDocuments`(graph 경로)는 여전히 지역 `CHUNK_SIZE`를 사용한다. 두 값이 현재는 동일하지만, 한쪽만 바꾸면 embedding과 graph 경로의 배치 크기가 달라지는 묵시적 불일치가 생긴다.
- 제안: `retryFailedDocuments` 내부의 `const CHUNK_SIZE = 100`을 제거하고 graph 경로도 `KnowledgeBaseService.EMBED_CHUNK_SIZE`(또는 별도 `GRAPH_CHUNK_SIZE` 상수)를 참조하도록 통일한다.

---

### **[WARNING]** `updateExecutionStatus` else 분기 주석이 함수 본문 흐름보다 앞서 등장 — 가드 조건과 실제 분기 위치 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-05-database-721c98/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 내 `updateExecutionStatus` (diff hunk `@@ -9212`)
- 상세: 코드상 `if (linkedNodeExec)` 블록이 `return true`로 끝난 뒤 else 없이 곧바로 else 분기 로직이 이어진다. 긴 블록 주석("M-3 — else 분기: …")이 guard clause 이후의 평탄화된 흐름을 설명하는데, 초독자에게 "이 코드가 어떤 조건에서 실행되는가"를 파악하려면 `if (linkedNodeExec)` 블록과 `return true`를 다시 위로 추적해야 한다. 가독성보다 복잡도가 소폭 올라간다.
- 제안: else 분기 진입부에 한 줄 짧은 인라인 주석(`// linkedNodeExec 없음 — guarded raw UPDATE`)을 두고, 긴 설명 주석은 JSDoc 수준으로 함수 시그니처 위 `@returns` 에 이미 존재하므로 코드 안 블록 주석을 3~4줄로 압축할 것을 고려한다.

---

### **[INFO]** `nonNegativeIntEnv` 함수 위치 — 모듈 외부 노출 없이 파일 하단에 선언
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-05-database-721c98/codebase/backend/src/common/config/database.config.ts` lines 928–932
- 상세: 헬퍼 함수가 파일 하단에 선언되어 있어 `registerAs` 콜백 내에서 호출될 때 함수 선언 전에 호출되는 것처럼 보일 수 있다. TypeScript hoisting 상 `function` 선언은 끌어올려지므로 런타임에는 무관하지만, 다른 `config/*.ts` 파일들은 유사한 헬퍼를 상단에 두는 패턴이 없어 일관성 판단이 어렵다. 현재 프로젝트 컨벤션 내에서는 허용 범위지만, 재사용 가능성이 있는 유틸이라면 `common/utils/`로 추출을 고려한다.
- 제안: 단기적으로는 현 위치 유지 가능. 동일 패턴(음수/NaN 폴백)이 다른 config 파일에도 필요해지면 `src/common/utils/parse-env.ts`로 추출하여 중복 방지.

---

### **[INFO]** `resolveRecipientsForBatch` — 루프를 두 번 순회하여 workspace 범위 integration을 처리
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-05-database-721c98/codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` lines 2331–2358 (diff 번호 기준)
- 상세: 메서드는 integration 배열을 두 번 순회한다: 첫 루프에서 personal 분류 + workspace id 수집, 두 번째 루프에서 non-personal에 admin 배열 할당. 중간에 `workspacesService.findAdminUserIdsByWorkspaces` 호출이 있어 불가피한 구조이나, 주석 없이 이중 루프를 읽으면 처음에 "한 번 더 도는 이유"를 파악하기 어렵다.
- 제안: 두 번째 `for` 루프 상단에 인라인 주석(`// admin 조회 결과를 non-personal integration에 매핑`)을 한 줄 추가하면 충분하다.

---

### **[INFO]** `integration-expiry-scanner.service.ts` — `for (;;)` 무한 루프 패턴
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-05-database-721c98/codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` `run` 메서드 내 `for (;;)` 루프
- 상세: `for (;;)` 관용구는 codebase에서 보기 드문 패턴이다. `while (true)` 또는 `do { … } while (candidates.length === SCAN_BATCH_SIZE)`가 의도(배치 크기 = 상수일 때 계속)를 더 직접적으로 표현한다. 현재는 break 조건이 두 군데(length 0, length < BATCH_SIZE)에 분산되어 루프 종료 조건을 추적하려면 body 전체를 읽어야 한다.
- 제안: `while (true)` 또는 `do/while`로 교체하거나, break 조건을 한 곳으로 집약(`break if candidates.length < SCAN_BATCH_SIZE`)하여 종료 조건을 단일화한다.

---

### **[INFO]** `spec/1-data-model.md` 테이블 행 — 신규 인덱스 5개를 한 diff에 추가하면서 일부 행이 현저히 길어짐
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-05-database-721c98/spec/1-data-model.md` (diff hunk `@@ -793`)
- 상세: 추가된 행 중 일부(V047, V048 등)는 설명 셀이 80자를 훨씬 넘어 Markdown 뷰어에서 수평 스크롤이 필요할 수 있다. 기존 행들도 같은 스타일이므로 컨벤션 위반은 아니나, 신규 행의 density가 높아 가독성이 낮다.
- 제안: 각 행의 설명을 핵심 키워드(인덱스명, 사용 경로, 마이그레이션 번호)로 압축하고, 상세 rationale은 `## Rationale` 또는 인라인 링크로 분리하는 것을 차회 편집 시 고려.

---

## 요약

전체적으로 이번 변경은 구조 개선(N+1 제거, guarded UPDATE, 재귀 CTE 단일 쿼리, chunk 분할)을 명확한 상수·JSDoc·주석으로 뒷받침하고 있어 유지보수성이 전반적으로 향상되었다. 가장 주목할 결함은 `CHUNK_SIZE`(지역 상수 100)와 `EMBED_CHUNK_SIZE`(클래스 상수 100)의 중복으로, 현재는 값이 같아 무해하지만 graph 경로와 embedding 경로의 배치 크기가 암묵적으로 독립 관리되는 구조가 되어 향후 변경 시 불일치를 유발할 수 있다. 나머지 이슈는 가독성 개선 제안 수준으로 기능에는 영향을 주지 않는다.

## 위험도

LOW
