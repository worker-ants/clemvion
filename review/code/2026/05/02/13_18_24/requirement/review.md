### 발견사항

---

**[WARNING]** `UpdateKnowledgeBaseDto.embeddingModel` 입력값 검증 부재
- 위치: `update-knowledge-base.dto.ts:36`
- 상세: `@IsString()` + `@MaxLength(100)` 만 적용되어 임의 문자열이 저장됨. 존재하지 않는 모델명을 저장하면 이후 임베딩 호출 시 LLM 서비스 오류가 발생하나, KB 레코드엔 잘못된 값이 남음.
- 제안: 화이트리스트 검증이 어렵다면 최소한 `embeddingModel` 변경 시 DB에서 실제 provider 호출을 통해 모델 존재 여부를 확인하거나, 컨트롤러 레이어에서 `llmService.listModels` 결과와 교차 검증.

---

**[WARNING]** `SUPPORTED_DIMS` 하드코딩 — 새 차원 도입 시 묵묵히 검색 결과 0건
- 위치: `rag-search.service.ts:8`
- 상세: `new Set([768, 1536, 3072])` 가 파일에 박혀 있음. 새 차원 마이그레이션(예: 2048)을 추가하고 이 상수를 수정하지 않으면 해당 KB의 검색 결과가 경고 로그 한 줄만 남기고 조용히 0건으로 반환됨.
- 제안: 화이트리스트를 `knowledge_base.embedding_dimension` 컬럼 기반으로 동적 유도하거나, 최소한 런타임에 알 수 없는 차원이 들어오면 `INFO` 대신 `ERROR` 레벨로 기록해 운영 중 누락을 감지 가능하게 할 것.

---

**[WARNING]** `embeddingDimension` 모델 변경 후 DB와 불일치 상태 노출
- 위치: `knowledge-base.service.ts:100–108`, `knowledge-base.service.spec.ts:132`
- 상세: `update()` 가 `embeddingModel` 만 바꾸고 `embeddingDimension` 는 그대로 둠. 명세대로 의도적 설계이나, 사용자는 UI에서 모델을 바꾼 뒤 "차원: 1536" 이 그대로 표시됨. 재임베딩 전까지 API 응답과 실제 청크 상태가 불일치.
- 제안: `embeddingModel` 변경 시 `embeddingDimension = NULL` 로 함께 초기화하거나, 프론트엔드 `[id]/page.tsx` 에서 "모델 변경됨·재임베딩 필요" 배지를 `embeddingDimension` != null 이어도 모델 변경 감지 시 표시.

---

**[WARNING]** 프론트엔드 `payload` 타입 불일치 — TypeScript 컴파일 오류 가능
- 위치: `[id]/page.tsx:175–185`
- 상세: `const payload: Record<string, string | number> = {}` 로 선언 후 `updateMutation.mutate(payload)` 에 전달. `mutationFn` 의 인자 타입 `{ name?: string; description?: string; ... }` 에 `Record<string, string | number>` 는 assignable하지 않아 `tsc --strict` 빌드 시 에러 발생 가능.
- 제안: 
```ts
const payload: { name?: string; description?: string; embeddingModel?: string; chunkSize?: number; chunkOverlap?: number } = {};
```

---

**[WARNING]** 프론트엔드 청크 크기/중첩 범위 검증 누락
- 위치: `[id]/page.tsx:193–196`
- 상세: `parseInt(formChunkSize)` 후 범위 검증(100–8000, 0–2000) 없이 `payload.chunkSize = cs` 로 전달. 백엔드가 400을 반환하지만 사용자에게 구체적 피드백 없이 `updateFailed` 토스트만 표시됨.
- 제안: `if (cs < 100 || cs > 8000)` 조건에서 `toast.error(t("knowledgeBases.chunkSizeRange"))` 등으로 사전 검증.

---

**[WARNING]** `kbReEmbedMutation.onSuccess` 응답 파싱 이중 방어 — 계약 불명확
- 위치: `[id]/page.tsx:148–156`
- 상세:
```ts
const payload = (res as { data?: { documentCount?: number } })?.data;
const count = (res as { documentCount?: number })?.documentCount ?? payload?.documentCount ?? 0;
```
`reEmbedAll` API 함수가 이미 `const { data } = await apiClient.post(...)` 로 한 번 unwrap하므로 `res` 는 이미 unwrapped body. 이중 파싱은 응답 형태가 확실하지 않다는 신호이며 `documentCount` 가 항상 0으로 fallback될 수 있음.
- 제안: `knowledge-bases.ts`의 `reEmbedAll` 반환 타입을 `{ message: string; documentCount: number }` 로 명시하고, API 응답 래퍼 전략을 다른 엔드포인트(예: `reEmbed`)와 통일.

---

**[WARNING]** 재임베딩 중 `reEmbedAll` 재호출 방지 미흡
- 위치: `knowledge-base.service.ts:112`
- 상세: `reEmbedAll` 은 `embedding_dimension = NULL` 초기화 후 모든 문서를 즉시 큐에 넣음. 처리 중 재호출 시 이미 `processing` 상태인 문서도 `processDocument(docId, reEmbed=true)` 로 재투입되어 동시에 두 워커가 같은 문서를 처리할 수 있음 (청크 DELETE → INSERT 경합).
- 제안: `reEmbedAll` 시작 시 KB 소속 문서의 `embeddingStatus = 'pending'` 일괄 업데이트 후 처리하거나, 이미 `processing` 상태인 문서는 제외.

---

**[INFO]** `EmbeddingModelCombobox` 기본 LLM Config만 사용
- 위치: `embedding-model-combobox.tsx:43`
- 상세: `configs.find(c => c.isDefault)?.id ?? configs[0]?.id` 로 기본/첫 번째 config의 모델만 제안. 여러 Provider(OpenAI + Anthropic)를 사용하는 워크스페이스에서는 다른 config의 임베딩 모델을 직접 타이핑해야 함.
- 제안: 현재 구현으로도 graceful degrade(텍스트 입력)가 되므로 허용 가능하나, 향후 config 선택 드롭다운 추가 고려.

---

**[INFO]** i18n 키 `updated` / `updateFailed` / `nameRequired` diff에 미포함
- 위치: `[id]/page.tsx:133, 135, 165`
- 상세: `t("knowledgeBases.updated")`, `t("knowledgeBases.updateFailed")`, `t("knowledgeBases.nameRequired")` 가 사용되나 en/ko diff에 해당 키 추가가 없음. 기존 사전에 이미 존재하면 무관하지만, 부재 시 키 문자열 그대로 노출됨.
- 제안: 존재 여부 확인 후 없으면 추가.

---

**[INFO]** `reEmbedAll`에서 `processDocument` 호환성 — 이미 임베딩된 문서 중단 처리 없음
- 위치: `knowledge-base.service.ts:122–130`
- 상세: 현재 `processing` 상태 문서를 포함한 모든 문서를 큐잉. 진행 중이던 임베딩과 새 재임베딩이 동시 실행될 경우 청크 데이터 정합성 문제 발생 가능(위 WARNING 참조).

---

### 요약

기능적으로는 spec §5.3(가변 차원)·§6(KB별 모델 일관성) 요구사항을 대부분 구현하였고, 테스트 커버리지(dimension 초기화, mismatch, 재임베딩 큐, topK 병합)도 핵심 시나리오를 충실히 검증하고 있다. 그러나 임베딩 모델명 입력 검증 부재, `SUPPORTED_DIMS` 하드코딩으로 인한 묵묵한 검색 누락, 프론트엔드 타입 불일치, 재임베딩 중 동시 재호출 경합 등 운영 안정성을 위협하는 WARNING 수준의 문제가 복수 존재한다. 특히 새 차원 모델 도입 시 코드 두 곳(마이그레이션 + `SUPPORTED_DIMS`)을 반드시 함께 수정해야 하는 암묵적 결합이 운영 실수의 위험을 가지고 있어 개선이 필요하다.

### 위험도
**MEDIUM**