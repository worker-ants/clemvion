### 발견사항

- **[WARNING]** i18n 키 추가되었으나 사용처 미확인
  - 위치: `en.ts:1700`, `ko.ts:1696` — `retryAttemptInfo`, `lastError` 키
  - 상세: 두 키가 추가되었으나 이번 diff의 어느 컴포넌트에서도 참조되지 않음. plan 문서 spec/2-navigation/5-knowledge-base.md에 "hover tooltip 으로 embedding_error_message + 재시도 카운트 노출" 명시가 있으나, 해당 문서 테이블 컴포넌트 변경이 diff에 포함되지 않음. 실제 사용처가 이번 커밋에 없다면 dead i18n key.
  - 제안: 해당 키를 사용하는 문서 테이블 tooltip 구현이 별도 커밋으로 예정된 것이라면 명확히 하거나, 이번 커밋에서 제거하고 사용 시점에 함께 추가.

- **[INFO]** `embedding-progress-box.tsx` 컴포넌트 미생성 — 인라인으로 대체
  - 위치: `plan/in-progress/rag-kb-retry-failure-recovery.md` 영향받는 파일 목록
  - 상세: 계획 문서에 `frontend/src/components/knowledge-base/embedding-progress-box.tsx` 신규 생성이 명시되어 있으나, 실제로는 해당 로직이 `[id]/page.tsx`에 인라인으로 구현됨. 두 진행 박스(임베딩·그래프)가 각각 50줄 이상으로 page.tsx가 비대해짐.
  - 제안: 기능상 문제는 없으나 plan 문서의 파일 목록을 현실에 맞게 갱신하거나, 후속 리팩토링 이슈로 등록.

- **[WARNING]** 이중 재시도 중첩 가능성
  - 위치: `llm.service.ts` `withRetry` + `embedding.service.ts` `retryWithBackoff`
  - 상세: `LlmService.withRetry`는 내부적으로 이미 rate-limit 등 일부 오류를 재시도함. `EmbeddingService` / `GraphExtractionService`에서 `retryWithBackoff(maxRetries=3)`을 그 위에 중첩하면, 실제 LLM 호출 횟수는 최대 `4 × LlmService.withRetry 내부 시도 수`까지 불어날 수 있음. 계획 문서에 이 상호작용이 언급되지 않음.
  - 제안: `LlmService.withRetry`의 retry 대상이 이미 `retryWithBackoff`가 담당하는 오류와 겹치지 않는지 확인하거나, 한쪽의 retry 범위를 축소(예: `withRetry`를 pass-through로 교체).

- **[INFO]** `doExtract` 내 KB 재조회 — 리팩토링 부산물
  - 위치: `graph-extraction.service.ts` `doExtract` 메서드 내 `this.kbRepository.findOne`
  - 상세: 원본 코드는 `extractGraph`에서 KB를 1회 조회 후 try 블록 전체에서 재사용. 리팩토링 후 `doExtract`가 `knowledgeBaseId`만 받아 내부에서 재조회하므로, 재시도마다 불필요한 DB 쿼리가 추가됨 (최대 4회).
  - 제안: `kb` 객체를 `doExtract` 인자로 전달하거나, `extractGraph`에서 조회 후 전달하는 방식으로 변경.

- **[INFO]** `retryFailed` 엔드포인트에 `@ApiBody` 누락
  - 위치: `knowledge-base.controller.ts` `retryFailed` 메서드
  - 상세: `@Body() body: { scope?: 'embedding' | 'graph' | 'all' }` 에 Swagger `@ApiBody` 데코레이터가 없어 Swagger UI에서 요청 body 스키마가 보이지 않음. 기능적 문제는 아님.
  - 제안: `@ApiBody({ schema: { properties: { scope: { type: 'string', enum: ['embedding', 'graph', 'all'] } } } })` 추가 또는 별도 DTO 클래스 생성.

---

### 요약

변경 범위는 계획 문서(PR1~PR5)에서 정의한 재시도/실패/회수 시스템 구현에 전반적으로 잘 정렬되어 있다. 무관한 파일 수정이나 의도를 벗어난 리팩토링은 발견되지 않았다. 다만 `retryAttemptInfo`·`lastError` i18n 키의 사용처가 이번 diff에 없고, `LlmService.withRetry`와 `retryWithBackoff` 이중 적용의 상호작용이 명시적으로 검토되지 않은 점, `doExtract` 리팩토링 과정에서 도입된 재시도당 추가 DB 쿼리가 범위 내 부산물로 남아 있다.

### 위험도

**LOW**