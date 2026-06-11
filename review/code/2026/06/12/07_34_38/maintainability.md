# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### **[INFO]** V093 SQL 헤더 주석이 과도하게 길다 — 인라인 로직 주석과 역할이 중복된다
- 위치: `codebase/backend/migrations/V093__kb_embedding_repoint.sql` 라인 33–57 (헤더 25줄)
- 상세: 헤더 블록이 plan 문서와 CTE 인라인 주석에 이미 서술된 내용을 거의 그대로 반복하고 있다. 특히 "비가역성"·"DOWN:" 설명은 V094 파일의 헤더에 있는 내용을 중복 기재한다. SQL 파일 헤더 주석 분량이 실제 SQL 본문(~55줄)과 맞먹어 첫 독해 비용이 높다.
- 제안: 헤더는 "무엇을, 왜"(목적·spec 링크·우선순위 요약) 만 두고, "비가역성"·"DOWN:" 절은 V094 파일에만 남긴다. CTE 블록별 인라인 주석으로 충분히 서술되므로 헤더 중복을 줄여도 가독성이 떨어지지 않는다.

---

### **[INFO]** `DEFAULT_EMBEDDING_MODEL` 상수가 테스트 파일 두 곳에 독립 선언되어 있다
- 위치: `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.spec.ts` 라인 429, `codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts` 라인 1082
- 상세: 두 파일 모두 `const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'` 를 독립적으로 선언하고, `MODEL_BY_CONFIG` 패턴도 구조가 동일하다. 프로덕션 코드에서 기본 모델 문자열이 변경될 때 테스트 두 파일을 모두 수정해야 하는 부담이 생긴다.
- 제안: 테스트 공용 헬퍼 파일(`test/fixtures/embedding-mock.ts` 등)로 추출하거나, 프로덕션 측 상수를 import 해서 쓴다. 당장 수정이 어렵다면 두 선언에 `// sync with agent-memory.service.ts:DEFAULT_EMBEDDING_MODEL` 형태의 동기화 주석이라도 추가한다.

---

### **[INFO]** `attachEffectiveEmbeddingModel` 이 `findById`·`create`·`update`·`findAll` 각각에서 호출되지만 `findAll` 은 페이지 번호가 한 번에 전달되지 않는다
- 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` 라인 93, 107, 985, 1048
- 상세: 구현 자체에는 문제 없다. 단, `attachEffectiveEmbeddingModel` 이 `private` 이고 JSDoc 이 상세하여 미래 유지보수자가 수정 시 영향 범위를 한눈에 파악하기 어려울 수 있다 — 새로운 `findBy*` 메서드 추가 시 빠뜨리는 실수 패턴의 씨앗이다.
- 제안: 메서드 JSDoc 또는 클래스 레벨 주석에 "KB 를 외부에 반환하는 모든 경로에서 반드시 호출할 것(call site checklist)" 을 명시한다.

---

### **[INFO]** `rag-search.service.ts` 의 `VectorGroup` 인터페이스에서 제거된 필드(`legacyModel`, `embeddingLlmConfigId`)의 흔적이 주변 주석에 부분적으로 남아있다
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` `VectorGroup` 인터페이스 및 그룹 키 생성 블록
- 상세: 주석 정리가 전반적으로 잘 되었으나, `NULL_KEY` 상수가 이전 `legacyModel` 조합 키에서 유래했기 때문에, 이제 단일 `cfgKey` 로만 사용될 때 `NULL_KEY` 라는 이름이 의미를 충분히 전달하는지 재고할 필요가 있다.
- 제안: `NULL_KEY` 를 `NO_CONFIG_KEY` 또는 그냥 인라인 문자열 리터럴(`'null'`)로 교체하거나, 현재 역할("embeddingModelConfigId 가 null 인 KB 들의 그룹 키 placeholder")을 주석으로 보강한다.

---

### **[INFO]** `model-config.service.ts` 의 `resolveConfig` default 없음 에러 메시지가 kind 만 출력하고 workspaceId 를 포함하지 않는다
- 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` 라인 134
- 상세: `llm.service.ts` 의 `MODEL_CONFIG_DEFAULT_MISSING` 에러 payload 는 `workspaceId` 를 포함하지만, `model-config.service.ts:resolveConfig` 의 동일 코드 경로는 `workspaceId` 를 payload 에 포함하지 않는다. 두 발행처가 같은 에러코드를 쓰는데 payload 구조가 달라 클라이언트 로깅 일관성이 떨어진다.
- 제안: `resolveConfig` 의 `BadRequestException` payload 에도 `workspaceId` 를 포함시킨다:
  ```ts
  throw new BadRequestException({
    code: 'MODEL_CONFIG_DEFAULT_MISSING',
    message: `No ${kind} model config resolved for workspace`,
    workspaceId,
  });
  ```

---

### **[INFO]** `loader-error-messages.ts` 에서 `LLM_CONFIG_INVALID` 키 삭제 후 주석이 미묘하게 부정확해졌다
- 위치: `codebase/frontend/src/components/llm-config/loader-error-messages.ts` 라인 1879
- 상세: `LLM_CREDENTIALS_REQUIRED` 위의 주석을 "Still emitted by the LLM execution path (llm.service.ts) — credentials gate." 로 수정했는데, 기존에는 `LLM_CONFIG_INVALID` 도 이 주석의 적용 대상이었다. 수정 후 한 줄짜리 주석이 한 줄짜리 매핑만 커버하도록 되어 있어서 역할은 명확해졌다. 추가적인 개선이 필요하진 않지만, 이후 새 에러코드 추가 시 "Still emitted" 그룹과 "Unified codes" 그룹 구분을 유지하도록 주의한다.
- 제안: 현재 상태 유지. 단 섹션 구분 주석을 블록 단위로 정렬해두면 리뷰 시 가독성이 좋다.

---

## 요약

이 PR 은 legacy `embeddingModel`·`embeddingLlmConfigId` 컬럼과 3-step 폴백 체인을 2-step 1급 경로로 단순화하는 대규모 정리다. 전반적으로 네이밍이 명확하고(`embeddingModelConfigId`, `attachEffectiveEmbeddingModel`, `MODEL_CONFIG_DEFAULT_MISSING`), 함수 길이와 중첩 깊이도 적정 수준이다. SQL 마이그레이션은 CTE 분리와 fail-loud 블록으로 의도를 잘 표현하고 있다. 발견된 항목은 대부분 `DEFAULT_EMBEDDING_MODEL` 테스트 상수 중복, 헤더 주석 중복, `resolveConfig` 에러 payload 비일관성처럼 실수 발생 가능성이 낮고 런타임 영향이 없는 INFO 수준의 이슈이다. 당장 수정이 강제될 CRITICAL·WARNING 수준의 유지보수성 문제는 없다.

## 위험도

LOW
