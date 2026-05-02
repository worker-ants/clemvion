### 발견사항

- **[WARNING]** `EmbeddingService` spec의 차원 불일치 테스트에서 mock embed가 청크 수와 다른 개수의 벡터를 반환
  - 위치: `embedding.service.spec.ts`, "marks document as error when embedding dimension does not match KB" (line ~148)
  - 상세: `chunkText` mock은 청크 2개를 반환하지만 `mockLlm.embed.mockResolvedValue([[0.1, 0.2, 0.3]])` 는 벡터 1개만 반환. 실제 LLM은 입력 텍스트 수 만큼 벡터를 반환하므로 현실과 괴리가 있음. 차원 불일치가 첫 벡터에서 즉시 throw되어 테스트는 통과하지만, `allEmbeddings`가 청크보다 부족한 케이스의 방어 로직은 별도로 검증되지 않음.
  - 제안: `mockLlm.embed.mockResolvedValue([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]])` 으로 청크 수에 맞추거나, "embedding count mismatch" 케이스를 별도 테스트로 추가

- **[WARNING]** 멀티배치(청크 수 > 20) 시 배치 간 차원 일관성 검증 미테스트
  - 위치: `embedding.service.spec.ts` 전체
  - 상세: `EmbeddingService`의 배치 루프(`batchSize=20`)에서 `expectedDim`이 첫 배치에서 설정된 후 이후 배치에서 불일치가 발생하는 경로가 테스트되지 않음. 청크 2개짜리 fixture만 사용하므로 멀티배치 경로 자체가 미커버.
  - 제안: `chunkText` mock을 21개 이상 청크 반환으로 오버라이드하는 테스트 추가

- **[WARNING]** `RagSearchService` spec의 `buildKbsQueryReturn` 이중 Promise 래핑
  - 위치: `rag-search.service.spec.ts:8-14`
  - 상세: `buildKbsQueryReturn`이 `Promise.resolve(rows)`를 반환하고 이를 `mockResolvedValueOnce()`에 전달하면 `Promise.resolve(Promise.resolve(rows))`가 됨. JS의 promise 자동 flatten으로 결과는 맞지만 함수 시그니처와 의도가 혼란스러움. 미래 유지보수자가 `Promise.resolve`를 제거하면 동작이 바뀔 수 있다고 오해할 수 있음.
  - 제안: `buildKbsQueryReturn`이 rows 배열을 직접 반환하거나, helper를 제거하고 `mockResolvedValueOnce([{id:'kb-1',...}])` 형태로 직접 작성

- **[WARNING]** `RagSearchService` - unsupported dimension 경로(SUPPORTED_DIMS 미포함) 테스트 없음
  - 위치: `rag-search.service.ts:64-70`, `rag-search.service.spec.ts` 전체
  - 상세: `embeddingDimension`이 512 등 `SUPPORTED_DIMS`에 없는 값이면 경고 로그 후 skip되어 빈 결과 반환. 이 경로에 대한 테스트가 없어 동작이 보장되지 않음.
  - 제안: `embeddingDimension: 512` fixture로 결과가 `[]`이고 `mockLlm.embed`가 호출되지 않음을 검증하는 테스트 추가

- **[WARNING]** `KnowledgeBaseController.reEmbedAll` 엔드포인트 테스트 없음
  - 위치: `knowledge-base.controller.ts:143-170`
  - 상세: 컨트롤러 spec이 업데이트되지 않아 새 `POST :id/re-embed` 라우트는 테스트 미커버. `@Roles('editor')` 권한 검증, `ParseUUIDPipe` 동작, 202 응답 코드 등이 미검증.
  - 제안: 컨트롤러 spec에 `reEmbedAll` 성공 케이스 및 404(KB 없음) 케이스 추가

- **[WARNING]** `EmbeddingModelCombobox` 컴포넌트 테스트 없음
  - 위치: `frontend/src/components/knowledge-base/embedding-model-combobox.tsx`
  - 상세: `llmConfigsApi.getAll` 실패 시 graceful degrade 동작, `defaultConfigId`가 없을 때 `enabled: false`로 models query를 skip하는 동작, datalist 옵션 렌더링 등이 테스트되지 않음.
  - 제안: `@testing-library/react` + msw 또는 vitest mock을 이용해 (1) configs 로딩 실패 시 일반 Input 렌더링, (2) embedding 모델 목록이 datalist에 반영되는지 검증하는 단위 테스트 추가

- **[WARNING]** `page.tsx`의 `handleSaveSettings` 페이로드 diff 로직 테스트 없음
  - 위치: `frontend/src/app/(main)/knowledge-bases/[id]/page.tsx:175-202`
  - 상세: 변경된 필드만 payload에 포함하는 diff 로직(name/description/embeddingModel/chunkSize/chunkOverlap 비교), `formName.trim()` 빈 문자열 검증, 아무 변경도 없을 때 조기 return하는 세 가지 분기가 컴포넌트 테스트 없이 런타임에만 의존.
  - 제안: `handleSaveSettings` 로직을 순수 함수로 추출하거나, 컴포넌트 테스트에서 각 분기를 커버

- **[WARNING]** `reEmbedAll` fire-and-forget 오류 처리 미테스트
  - 위치: `knowledge-base.service.ts:120-135`
  - 상세: `processDocument` 호출이 `.catch()`로만 처리되고 caller에 전파되지 않음. `reEmbedAll` 테스트는 `processDocument`가 성공하는 경우만 검증하며, 일부 문서가 실패할 때 나머지가 계속 처리되는지, 로거 호출이 정확한지 검증하지 않음.
  - 제안: `mockEmbeddingService.processDocument`를 첫 번째 호출에서 reject, 두 번째에서 resolve하는 케이스 추가하여 `.catch` 핸들러가 동작하고 `documentCount`가 여전히 올바른지 확인

- **[INFO]** `EmbeddingService` spec에서 `buildModule`이 `beforeEach` 대신 각 `it` 블록 내부에서 호출됨
  - 위치: `embedding.service.spec.ts:30-44`, 각 `it` 블록
  - 상세: 각 테스트에서 `await buildModule()`을 직접 호출하는 패턴은 `beforeEach`에서 한 번 빌드하는 표준 패턴과 다름. `buildModule` 내부에서 예외가 발생해도 `it` 블록의 실패로 보고되어 원인 파악이 어려울 수 있음. 현재 기능적 문제는 없지만 일관성 저하.
  - 제안: `beforeEach`에서 `await buildModule()` 호출로 통일

- **[INFO]** `UpdateKnowledgeBaseDto.embeddingModel` 유효성 검증 경계값 테스트 없음
  - 위치: `update-knowledge-base.dto.ts:31-42`
  - 상세: `@MaxLength(100)` 검증 추가됐지만 101자 입력 거부, 빈 문자열 처리(`@IsString`은 빈 문자열 허용), 공백 전용 문자열 등의 경계값 테스트가 없음.

- **[INFO]** `activeTasks` 동시성 제한 로직 미테스트
  - 위치: `embedding.service.ts:37-45`
  - 상세: `MAX_CONCURRENT = 3`을 초과하는 동시 `processDocument` 호출 시 대기 루프가 동작하는지 검증 없음. 성능/동작 보장이 테스트에 의존하지 않음.

---

### 요약

전반적으로 핵심 비즈니스 로직(차원 저장/불일치 감지, KB 재임베딩, 멀티모델 RAG 검색)에 대한 단위 테스트가 잘 작성되어 있고 happy path와 주요 error path가 커버됨. 다만 `RagSearchService`의 unsupported dimension 경로, `EmbeddingService`의 멀티배치 시나리오, `KnowledgeBaseController.reEmbedAll` 엔드포인트, 새로 추가된 `EmbeddingModelCombobox` 컴포넌트는 테스트가 완전히 누락되어 있음. 차원 불일치 테스트의 mock 정확도 문제와 `buildKbsQueryReturn`의 이중 Promise 래핑은 테스트 신뢰도를 미묘하게 저하시킴. 프론트엔드 `handleSaveSettings` 페이로드 diff 로직은 순수 함수 추출 또는 컴포넌트 테스트로 커버할 가치가 있음.

### 위험도
**MEDIUM**