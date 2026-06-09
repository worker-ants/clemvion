# 동시성(Concurrency) 리뷰 결과

## 발견사항

해당 없음. 변경 코드에 동시성 관련 위험이 없습니다.

### 상세 분석

**RagAccumulator 신규 필드 (`diagnosticCount`, `unsearchableCount`) — 안전**

- `/Volumes/project/private/clemvion/.claude/worktrees/kb-unsearchable-warning-b47e20/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (라인 376-377, 430-431)
- `Promise.all`로 KB tool 호출이 병렬 실행되지만, 결과 집계(`pushDiagnostic` 호출)는 `await Promise.all(...)` resolve 이후 단일 `for` 루프(라인 1213-1216)에서 순차적으로 이루어짐. JavaScript 단일 이벤트 루프 특성상 인터리빙 없음. 경쟁 조건 없음.

**rag-search.service.ts `unsearchable` 필터링 — 안전**

- `/Volumes/project/private/clemvion/.claude/worktrees/kb-unsearchable-warning-b47e20/codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` (라인 202-217)
- `kbs` 배열은 로컬 변수(`const kbs = await dataSource.query(...)` 결과). `filter`/`map`은 로컬 스코프 내 순수 변환이며 공유 상태를 건드리지 않음.
- `withUnsearchable` 헬퍼 함수는 순수 함수 — 클로저로 캡처한 `unsearchable` 배열을 읽기만 하며 수정 없음.

**kb-tool-provider.ts `let unsearchable` — 안전**

- `/Volumes/project/private/clemvion/.claude/worktrees/kb-unsearchable-warning-b47e20/codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts` (라인 527-537)
- `let unsearchable`은 단일 `execute()` 호출 스코프 내 로컬 변수. 인스턴스 필드가 아님. 공유 상태 없음.

**테스트 파일 — 동시성 이슈 없음**

- 모두 mock 기반 단위 테스트. `vi.clearAllMocks()` + `cleanup()` 호출로 각 테스트 간 상태 격리 적절히 수행됨.
- Frontend 테스트에서 `act()` 래핑이 일부 사용되고 있어 React 상태 업데이트 플러싱이 올바르게 처리됨.

## 요약

이번 변경은 KB 검색 불가(`embedding_dimension NULL`) 상태를 감지·전파하는 순수 데이터 흐름 로직 추가입니다. 모든 신규 상태(`diagnosticCount`, `unsearchableCount`, `unsearchable`)는 요청 스코프 내 로컬 변수 또는 단일 요청 라이프사이클에 묶인 인스턴스 멤버입니다. 병렬 처리(`Promise.all`)가 존재하나 결과 집계는 resolve 이후 단일 이벤트 루프에서 순차 처리되므로 경쟁 조건이 발생하지 않습니다. async/await 누락 없음, 이벤트 루프 블로킹 없음, 공유 가변 상태 없음.

## 위험도

NONE
