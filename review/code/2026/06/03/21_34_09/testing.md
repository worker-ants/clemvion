# Testing Review

## 발견사항

### [INFO] $itemIsFirst/$itemIsLast — isLast=true 케이스 테스트 누락
- 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` 신규 테스트 (파일 1)
- 상세: 추가된 테스트 `exposes $itemIsFirst / $itemIsLast from itemContext flags` 는 `isFirst=true, isLast=false` 케이스만 검증한다. `isLast=true` (마지막 항목) 케이스가 없어 `$itemIsLast` 가 `true` 일 때 올바로 전달되는지 별도 어설션이 없다. 기존 수정 테스트(line 35-36)에서 양쪽 모두 `false` 를 확인하므로 `true` 전파 경로는 신규 테스트에서만 확인 가능한데, `isFirst=true` 만 다룬다.
- 제안: `isFirst=false, isLast=true` itemContext 로 한 케이스를 더 추가하거나, 기존 케이스를 `isFirst=false, isLast=true` 로 교체해 양쪽 플래그의 `true` 전파를 모두 커버.

### [INFO] chunkText baseMetadata — 다중 청크 시 모든 청크에 메타데이터가 전파되는지 확인 부족
- 위치: `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.spec.ts` 신규 describe (파일 3)
- 상세: `copies baseMetadata onto every chunk` 테스트는 입력 텍스트 `'hello world. this is a small document body.'` 가 `chunkSize: 100` 에서 단일 청크로 생성될 가능성이 높다. `chunks.length > 0` 을 확인하나 실제로 여러 청크가 생성되는지 보장하지 않는다. `forceSplitAndPush` 경로(paragraph>chunkSize, sentence>chunkSize) 및 sentence 분기에서 metadata 전파 여부를 커버하는 케이스가 없다.
- 제안: `chunkSize: 5, chunkOverlap: 0` 처럼 강제 다중 청크 생성을 유도하는 값으로 테스트하거나, `forceSplitAndPush` 경로를 직접 트리거하는 큰 단일 문장 케이스를 추가.

### [INFO] parsePdfSegments — 빈 페이지 처리 테스트 없음
- 위치: `codebase/backend/src/modules/knowledge-base/parsers/pdf.parser.spec.ts` (파일 10)
- 상세: 두 케이스(다중 페이지·수직 위치 변화)만 커버. `str: ''` 아이템이 포함된 페이지, 또는 페이지 전체가 공백만 있는 케이스(`text.trim() === ''`)가 segments 배열에 포함되는지 아니면 필터링되는지 검증하지 않는다. 현재 구현(`renderPageText`)은 빈 str 도 그대로 push 하므로, 빈 페이지가 `{ text: '', metadata: { page: N } }` 로 들어와 이후 `chunkText` 에서 빈 text 로 0개 청크를 반환할 수 있다.
- 제안: 빈 페이지(`str: ''` 또는 공백 텍스트만) 포함 PDF 케이스를 추가하고, segment 필터링 여부를 명세.

### [INFO] parseMdSegments — 중첩 헤딩(h1 아래 h2) 시 section 값이 마지막 헤딩으로 덮이는지 테스트 없음
- 위치: `codebase/backend/src/modules/knowledge-base/parsers/md.parser.spec.ts` (파일 7)
- 상세: 기존 테스트는 `# Intro` → `## Details` 의 단순 순서 케이스는 확인하지만, 동일 섹션 내에 여러 하위 헤딩이 있거나 본문 없이 헤딩만 연속될 때의 동작은 커버되지 않는다. 특히 `## Details\n### Sub\nbody` 처럼 body 없이 연속 헤딩이 오는 경우 `flush()` 가 빈 buf 로 호출돼 segment 가 생략될 수 있는지 확인하는 케이스가 없다.
- 제안: 연속 헤딩(중간 body 없음) 케이스 및 헤딩 레벨 혼재 케이스 추가.

### [WARNING] embedding.service.spec.ts — parseDocumentSegments mock 이 단일 segment 만 반환, 다중 segment / index 재부여 로직 미검증
- 위치: `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.spec.ts` (파일 5)
- 상세: mock 이 `[{ text: 'parsed text body', metadata: {} }]` (단일 segment)만 반환한다. `embedding.service.ts` 에서 구현한 핵심 로직 — 다중 segment 를 순회하며 `chunk.index` 를 연속 재부여(`{ ...chunk, index: chunks.length }`) — 은 이 mock 으로는 전혀 실행되지 않는다. `parseDocumentSegments` 가 2개 이상의 segment 를 반환하고 각 segment 에서 여러 chunk 가 생성될 때, 전체 청크 인덱스가 연속적이고 각 청크에 해당 segment 의 metadata 가 붙는지를 검증하는 통합 수준 테스트가 없다.
- 제안: mock 을 `[{ text: 'seg1', metadata: { section: 'A' } }, { text: 'seg2', metadata: { section: 'B' } }]` 형태 다중 segment 로 구성하고, 최종 insert 되는 `chunk.metadata` 와 `chunk.index` 연속성을 어설션하는 테스트 케이스 추가.

### [WARNING] NodeSettingsPanel error-handling 테스트 — 상태 격리 부재 (store가 테스트 간 공유됨)
- 위치: `codebase/frontend/src/components/editor/settings-panel/__tests__/node-settings-panel-error-handling.test.tsx` (파일 21)
- 상세: `useEditorStore.setState()`로 직접 전역 store 를 변이하고 `afterEach` 에서 `cleanup()` 만 호출한다. Zustand store 자체는 리셋되지 않아 테스트 실행 순서에 따라 이전 테스트의 store 상태가 누출될 수 있다. `beforeEach`에서 `seedNode`를 호출하지 않는 테스트나 다른 spec 파일과 병렬 실행될 경우 간헐적 실패 위험이 있다.
- 제안: `afterEach` 또는 `beforeEach` 에서 `useEditorStore.setState({ nodes: [], edges: [], selectedNodeId: null })` 등으로 store 를 명시적으로 리셋. 또는 Zustand `create` 의 `initialState` 를 `beforeEach` 로 복원하는 헬퍼 사용.

### [INFO] NodeSettingsPanel 테스트 — `retryInterval` 변경 UI 테스트 없음
- 위치: `codebase/frontend/src/components/editor/settings-panel/__tests__/node-settings-panel-error-handling.test.tsx` (파일 21)
- 상세: `maxRetries` 입력 변경은 테스트하지만 `retryInterval` 입력 변경은 테스트하지 않는다. 패널에서 `retryInterval` 을 수정하고 저장했을 때 `retryConfig.retryInterval` 이 정확히 반영되는지 커버 없음.
- 제안: `retryInterval` 변경 케이스 추가.

### [INFO] NodeSettingsPanel 테스트 — 기존 errorHandling nested 구조 로드 케이스 없음
- 위치: `codebase/frontend/src/components/editor/settings-panel/__tests__/node-settings-panel-error-handling.test.tsx` (파일 21)
- 상세: 레거시 flat `errorPolicy` 마이그레이션 테스트는 있으나, 이미 nested `errorHandling` 구조가 있는 노드를 로드하는 케이스(정상 경로)가 `migrates legacy flat errorPolicy` 케이스와 분리되어 명시적으로 테스트되지 않는다. `initialErrorHandling` 에서 `policy` 를 직접 읽는 경로의 선택 UI 표시 여부 검증 없음.
- 제안: `{ errorHandling: { policy: 'retry', retryConfig: { maxRetries: 2, retryInterval: 500 } } }` 형태로 seed 하고, UI 에서 해당 값들이 초기값으로 표시되는지 검증하는 케이스 추가.

### [INFO] expression-constants.ts — $itemIsFirst/$itemIsLast 프론트엔드 상수 테스트 없음
- 위치: `codebase/frontend/src/components/editor/expression/expression-constants.ts` (파일 20)
- 상세: `ROOT_VARIABLES` 에 추가된 두 항목에 대해 `filterRootVariablesByScope` 로 `hasItem: false` 일 때 필터링되고, `hasItem: true` 일 때 포함되는지 검증하는 단위 테스트가 없다(기존 테스트에서 다른 scopeKey 변수에 대해 이 함수를 테스트하고 있다면 회귀 여부 확인 필요).
- 제안: `filterRootVariablesByScope` 유닛 테스트에 `hasItem: false` 케이스에서 `$itemIsFirst`/`$itemIsLast` 가 제외되는지, `hasItem: true` 케이스에서 포함되는지 어설션 추가.

### [INFO] summaryTemplate 테스트 — undefined/null 필드 입력 케이스 없음
- 위치: `codebase/backend/src/nodes/data/code/code.schema.spec.ts`, `database-query.schema.spec.ts`, `send-email.schema.spec.ts`, `template.schema.spec.ts` (파일 12, 14, 16, 18)
- 상세: 각 `summaryTemplate` 테스트는 정상 입력만 검증한다. `language` 가 `undefined`, `to` 가 빈 배열, `buttons` 가 `undefined` 인 경우 `renderSummaryTemplate` 의 동작(null 반환·빈 문자열·예외 여부) 테스트가 없다.
- 제안: 각 노드에 대해 관련 필드가 `undefined` 또는 빈 배열일 때 `renderSummaryTemplate` 가 안전하게 처리되는지(예: `null` 반환, 빈 text) 엣지 케이스 케이스 1개 이상 추가.

---

## 요약

전반적으로 변경 코드에 대한 테스트가 함께 추가되어 있고, 핵심 경로(baseMetadata 전파, PDF/MD 파싱 segment, $itemIsFirst/$itemIsLast 노출, error-handling UI)는 테스트로 커버된다. 그러나 몇 가지 갭이 존재한다. 가장 중요한 것은 `embedding.service.spec.ts` 의 `parseDocumentSegments` mock 이 단일 segment 만 반환해 다중 segment index 재부여 로직이 전혀 검증되지 않는 점과, NodeSettingsPanel 테스트에서 Zustand store 가 테스트 간 명시적으로 리셋되지 않아 격리 위험이 있는 점이다. text-chunker 의 `baseMetadata` 테스트도 단일 청크 가능성이 높은 입력값으로 `forceSplitAndPush` 경로의 metadata 전파를 커버하지 못한다. 나머지 항목들(isLast=true 케이스, retryInterval UI 테스트, summaryTemplate null 입력)은 완성도 향상을 위한 보완 사항이다.

## 위험도

MEDIUM
