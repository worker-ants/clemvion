# Side Effect Review — memory-backlog-a2-fe9c8f

diff 범위: `7afa9ae0..HEAD -- codebase/`  
검토일: 2026-06-05

---

## 발견사항

### [INFO] (1) listScopes — 단일쿼리화. 정상 페이지 items/total 동일성 확인됨
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` L526–574
- 상세: CTE `grouped` + `COUNT(*) OVER()` 윈도우 함수 패턴은 LIMIT/OFFSET 이전 시점에 평가되어, 정상 페이지(0행 이상 반환)에서는 기존 별도 COUNT 서브쿼리와 동일한 `total`을 반환한다. `scope_key`, `count`, `latestUpdatedAt` 매핑 로직도 변경 없음. 기존 2번 query 호출이 1번으로 줄었으나 public API 시그니처(`{ items, total }`)는 보존됨.
- 제안: 변경 없음. 동작 동일성 확인됨.

### [INFO] (1) listScopes — over-page 시 total=0 미세 변화. 호출부 영향 없음
- 위치: `agent-memory.service.ts` L574, 서비스 주석
- 상세: OFFSET이 전체 그룹 수를 초과하면 반환 행이 0개이므로 `rows[0]?.total ?? 0` = 0이 된다. 기존 구현에서는 별도 COUNT 쿼리가 실제 total을 반환했으므로 이론적으로 "total > 0, items = []" 상태가 가능했다. 변경 후에는 "items = [], total = 0"으로 수렴한다. 백엔드에 `listScopes`를 직접 호출하는 컨트롤러 파일이 없고(`grep -rn listScopes` 결과 서비스·spec 파일만 검출), 프론트엔드에도 이 엔드포인트를 소비하는 API 클라이언트 코드가 현재 미존재함(agentMemory/scopes 관련 프론트 코드 검색 결과 없음). 따라서 over-page total=0 변화가 실제 호출부(컨트롤러 page 파생, useInfiniteQuery)에 악영향을 주는 경로가 현재 코드베이스에 존재하지 않는다.
- 제안: 추후 프론트에서 이 엔드포인트를 소비할 때, over-page 응답에서 total=0을 "더 이상 페이지 없음" 신호로 처리하도록 클라이언트 로직 작성 필요. 현재는 영향 없음.

### [INFO] (2) ai-agent.schema.ts — embeddingModel widget `'text'` → `'expression'`
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` L596
- 상세: 이 변경은 프론트엔드 설정 패널의 입력 위젯 렌더 방식만 바꾼다. `ExpressionWidget`은 `ExpressionInput` 컴포넌트를 사용하며, 내부에서 `rawValue == null ? "" : String(rawValue)` 강제 변환을 수행하므로 기존에 `text` 위젯으로 저장된 문자열 값(예: `"text-embedding-3-small"`)은 그대로 렌더/편집된다. Zod 스키마 타입(`z.string().optional()`)은 변경 없으므로 저장된 노드 데이터의 직렬화·역직렬화에 영향 없음. `ExpressionWidget`은 `{{...}}` 블록이 없는 평문 문자열도 그대로 통과시키므로 기존 저장값과 호환된다. `WIDGET_REGISTRY`에 `expression: ExpressionWidget`으로 이미 등록되어 있어 렌더 경로 문제 없음.
- 제안: 변경 없음. 단, 이 필드가 expression 참조(변수 치환)를 실제로 지원하는지 핸들러(`ai-agent.handler.ts`)에서 resolve 처리가 있는지 별도 확인 권장 (본 리뷰 범위 외).

### [INFO] (3) agent-memory-injection.spec.ts — 테스트 추가
- 위치: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.spec.ts` L654–785
- 상세: 순수 테스트 파일 추가. 프로덕션 코드 변경 없음. 새 테스트 케이스 2개(B3-a: 비어있지 않은 runningSummary 경로, B3-b: 정확 경계 no-op)는 기존 `buildSummaryBufferUpdate` 함수를 화이트박스로 검증한다. 부작용 없음.
- 제안: 변경 없음.

---

## 요약

3건의 변경 모두 의도한 범위에 부합한다. listScopes 단일쿼리화는 public 반환 시그니처를 보존하며, over-page total=0 미세 변화는 현재 코드베이스에 실제 호출부가 없어 런타임 영향이 없다. embeddingModel의 widget `text`→`expression` 변경은 프론트엔드 입력 위젯 렌더 레이어만 영향을 주며 저장된 값과 완전 호환된다. 테스트 추가는 순수 부가이다. 전역 상태·파일시스템·네트워크·이벤트·환경 변수에 대한 의도치 않은 부작용은 발견되지 않았다.

## 위험도

LOW

---

BLOCK: NO
