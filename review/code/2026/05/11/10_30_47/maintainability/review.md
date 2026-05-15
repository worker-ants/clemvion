### 발견사항

---

**[WARNING] `EmbeddingService.processDocument`의 `attemptIndex` 클로저 캡처 패턴이 불투명함**
- 위치: `embedding.service.ts`, `processDocument` 메서드
- 상세: `let attemptIndex = 0`을 외부에 선언하고 `onAttempt` 콜백 내에서 `attemptIndex = idx + 1`로 갱신한 뒤, `retryWithBackoff`의 `fn` 클로저에서 `reEmbed || attemptIndex > 0`로 참조함. `retryWithBackoff`가 `fn`을 호출할 때 `onAttempt`가 이미 실행된 이후라는 실행 순서 가정이 코드만 읽어서는 즉시 파악되지 않음.
- 제안: `retryWithBackoff`의 `fn` 시그니처에 `attemptIdx` 인자를 추가하거나, `onAttempt` 대신 `beforeAttempt(idx)` 훅을 분리해 순서 의존성을 명시적으로 표현.

---

**[WARNING] `retryWithBackoff` 종료 경로에 도달 불가한 코드가 존재**
- 위치: `retry-with-backoff.util.ts`, 마지막 `throw` 문
- 상세: `// unreachable` 주석과 함께 `throw lastError ?? new Error(...)` 구문이 있음. TypeScript 컴파일러가 이 경로를 dead code로 탐지하지 못하므로 `lastError`가 항상 `Error`로 보장되어야 한다는 불변식이 타입으로 표현되지 않음. `lastError`를 `Error | undefined`로 선언하면 마지막 `throw`에서 nullish coalescing이 필요한데, 이는 논리적으로 불가능한 상황을 타입이 허용하는 것.
- 제안: `lastError!` 또는 루프 구조를 재설계해 `lastError`를 `Error` 타입으로 좁힌 뒤 throw.

---

**[WARNING] `StuckDocumentRecoveryService`의 `recoverStuckEmbedding`·`recoverStuckGraphExtraction`이 문서별 순차 루프**
- 위치: `stuck-document-recovery.service.ts`, `for (const row of rows)` 루프
- 상세: 부팅 시 stuck 문서가 수십 건이면 UPDATE + queue.add를 순차적으로 반복함. 부팅 지연이 문서 수에 선형으로 비례. 두 메서드의 구조가 완전히 동일해 복붙 패턴.
- 제안: `Promise.all(rows.map(...))` 병렬 처리 또는 공통 로직을 `recoverStuck(config)` 제네릭 메서드로 추출해 중복 제거.

---

**[WARNING] `knowledge-base.service.ts`의 `retryFailedDocuments`에 빈 `else` 블록**
- 위치: `knowledge-base.service.ts`, `retryFailedDocuments`, `scope === 'graph'` 분기
- 상세: `if (kb.ragMode !== 'graph') { /* 비어있음 */ } else { ... }` 패턴. 빈 블록에 주석만 있고 실제 로직 없이 흘러감. 처음 읽는 사람이 의도적 no-op인지 미완성 코드인지 구분하기 어려움.
- 제안: 조건 반전으로 early return: `if (kb.ragMode !== 'graph') return { embeddingRequeued, graphRequeued };` 후 graph 로직 직접 작성.

---

**[WARNING] `useKbEvents`의 `documentIds.join(",")` deps 배열 최적화 우회가 버그 가능성 내포**
- 위치: `use-kb-events.ts`, `useEffect` deps
- 상세: `eslint-disable-next-line react-hooks/exhaustive-deps` 주석과 함께 `documentIds.join(",")` 문자열을 deps로 사용. `scheduleInvalidate`가 `queryClient`와 `knowledgeBaseId`를 직접 참조하지만 deps에 없음. `queryClient`는 안정적이나 `knowledgeBaseId`가 변경될 때 `handler` 클로저가 stale closure를 참조할 위험.
- 제안: `scheduleInvalidate`를 `useCallback`으로 감싸거나, `knowledgeBaseId`를 effect 내부에서 직접 참조하도록 구조 변경.

---

**[INFO] `EmbeddingStatus`와 `GraphExtractionStatus`가 동일한 유니온 타입으로 중복 선언**
- 위치: `document.entity.ts`, `knowledge-bases.ts`
- 상세: `EmbeddingStatus`와 `GraphExtractionStatus`가 같은 5개 리터럴 유니온. 프론트엔드에서는 `type DocumentGraphExtractionStatus = DocumentEmbeddingStatus`로 별칭만 선언했으나, 백엔드 entity에서는 두 타입을 따로 선언함. 미래에 한쪽만 값이 추가되면 동기화 문제 발생.
- 제안: `ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error' | 'failed'`를 공통 타입으로 정의하고 두 타입을 alias로 선언.

---

**[INFO] 매직 넘버 `4`가 백오프 공식에 노출**
- 위치: `retry-with-backoff.util.ts`, `Math.pow(4, attemptIdx)`
- 상세: 지수 밑(base multiplier)이 `4`로 하드코딩되어 있음. 주석의 "1s / 4s / 16s" 설명과 연결되긴 하지만, `RetryOptions`에 `backoffMultiplier?: number` 필드가 없어 호출자가 다른 백오프 배율이 필요할 때 유틸을 수정해야 함.
- 제안: 지금 당장 외부화할 필요는 없으나, `BACKOFF_MULTIPLIER = 4` 상수로 추출해 공식 의도를 명확히 표현.

---

**[INFO] `V037` SQL의 DOWN 스크립트가 주석으로만 존재**
- 위치: `V037__kb_retry_failed_status.sql`, 파일 상단 주석
- 상세: `-- DOWN:` 섹션이 주석으로만 기술됨. 프로젝트가 Flyway/별도 마이그레이션 도구를 쓰고 DOWN이 실행 파일로 관리되지 않는다면 문제 없지만, 주석 형식이 파일마다 일관되게 유지되는지 확인 필요.
- 제안: 프로젝트 마이그레이션 컨벤션에 DOWN 기술 방식을 통일.

---

**[INFO] `use-kb-events.ts`의 WS 이벤트 이름이 문자열 배열로 중복 관리**
- 위치: `use-kb-events.ts` (`KB_EVENT_NAMES`), `spec/5-system/8-embedding-pipeline.md`, `spec/5-system/10-graph-rag.md`
- 상세: WS 이벤트 이름 12개가 훅 내부에 인라인 배열로 하드코딩됨. 새 이벤트가 추가될 때 훅과 스펙 문서를 별도로 갱신해야 해 동기화 누락 가능.
- 제안: 이벤트 이름을 `kb-event-names.ts` 상수 파일로 분리하거나, 현재 수준에서는 `as const` 배열 타입을 공유 위치로 이동.

---

### 요약

전체적으로 재시도·실패·회수 시스템의 핵심 로직(`retryWithBackoff`, `StuckDocumentRecoveryService`)이 깔끔하게 분리되어 있고, 테스트 커버리지도 주요 경로를 잘 포함한다. 유지보수 관점의 주요 위험은 두 곳이다: `processDocument`의 `attemptIndex` 클로저 순서 의존성(실행 순서 오해 시 `reEmbed` 플래그가 잘못 전달될 수 있음)과 `StuckDocumentRecoveryService`의 복붙 패턴(향후 필드 추가 시 한쪽만 수정될 가능성). 나머지 발견사항은 타입 표현 정밀도나 상수 명명 수준의 개선으로, 전체 코드 품질은 양호하다.

### 위험도

**LOW**