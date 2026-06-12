# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] SQL 마이그레이션 파일 — 헤더 문서화 우수
- 위치: `codebase/backend/migrations/V093__kb_embedding_repoint.sql`, `V094__kb_drop_legacy_embedding_columns.sql`
- 상세: 두 파일 모두 목적·선행조건·비가역성·DOWN 처리·우선순위 체인을 헤더 주석으로 명시하고 있어 마이그레이션 문서화 기준을 잘 충족한다. V093의 `-- DOWN:` 주석에서 "forward-only" 의도를 명시한 점, V094의 "IRREVERSIBLE" 명시도 적절하다.
- 제안: 없음. 현행 수준 유지.

---

### [WARNING] `KnowledgeBase` 엔티티 — `embeddingModel` 과도기 필드 문서화 불충분
- 위치: `codebase/backend/src/modules/knowledge-base/entities/knowledge-base.entity.ts` (변경된 `embeddingModel?: string` transient 필드)
- 상세: 주석이 "transient, 비영속", "응답 직렬화용", "service가 채운다"를 기술하고 있으나, 이 필드가 TypeORM `@Column()` 데코레이터 없이 엔티티에 존재하는 이유(직렬화 혼동 위험)와, 언제 채워지지 않을 수 있는지(예: 직접 repository 조회 후 `attachEffectiveEmbeddingModel` 미통과)에 대한 설명이 없다. 특히 TypeORM이 이 필드를 DB 컬럼으로 오인하거나, 다른 개발자가 이 필드를 영속 필드로 혼동할 수 있다.
- 제안: 주석에 "@Transient — DB 컬럼 없음. `attachEffectiveEmbeddingModel` 통과 후에만 값이 보장된다. 직접 `kbRepository.findOne` 결과를 외부에 노출할 경우 undefined일 수 있음" 형태의 경고를 추가한다.

---

### [WARNING] `attachEffectiveEmbeddingModel` 메서드 — JSDoc 불완전
- 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (`attachEffectiveEmbeddingModel` private 메서드)
- 상세: JSDoc이 존재하며 전반적인 동작을 설명하고 있으나, @param 태그가 없어 파라미터 `kbs`·`workspaceId`의 의미와 제약을 기술하지 않는다. 또한 "throw 하지 않는다(표시용 soft resolve)" 계약은 중요한 동작 보장임에도 @throws 태그로 명시되지 않고 본문에만 포함된다. 호출 누락 시 미초기화 `embeddingModel`이 노출되는 위험도 문서화가 필요하다.
- 제안: `@param kbs — 모델이 채워져야 할 KnowledgeBase 배열 (변경됨, in-place)`, `@param workspaceId — 배치 조회 범위 필터`, `@throws — 절대 throw 하지 않음. config 미존재 시 빈 문자열로 대체한다.` 형태의 JSDoc을 보강한다.

---

### [INFO] `model-config.service.ts` — `findManyByIds` JSDoc 적절
- 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` (`findManyByIds` 메서드)
- 상세: 목적, 부분 조회 허용, 사용 시나리오 예시(KB.embeddingModel derive)가 충분히 기술되어 있다.
- 제안: 없음.

---

### [WARNING] `resolveEmbedding` JSDoc — 파라미터 시그니처 변경 반영 불완전
- 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` (`resolveEmbedding` 메서드 JSDoc)
- 상세: JSDoc 본문이 PR4b 변경을 반영해 step-3 제거와 legacy 파라미터 제거를 기술하고 있으나, `opts` 파라미터 내의 `embeddingModelConfigId?: string | null`과 `workspaceId: string`에 대한 @param 설명이 없다. 함수 시그니처에서 `legacyModel`과 `embeddingLlmConfigId`가 제거됐으므로, 이전 호출자가 이 파라미터를 전달하면 TypeScript 컴파일러가 잡아주지만, API 소비자 입장에서 `embeddingModelConfigId: null`과 `undefined`의 차이(null=step-1 skip, undefined=기본 동작)가 문서화되지 않았다.
- 제안: JSDoc에 `@param opts.embeddingModelConfigId — null 전달 시 step-1 skip, undefined 전달 시 동일. 미지정 시 워크스페이스 default kind=embedding 으로 resolve.`를 추가한다.

---

### [WARNING] `KnowledgeBaseDto` 응답 DTO — `embeddingModel` 필드 설명 상세하나 client 계약 명시 부족
- 위치: `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts`
- 상세: `@ApiProperty` description이 "read-only, derived", 모델 출처, 변경 방법을 잘 설명하고 있다. 그러나 "embeddingModelConfigId가 없으면 워크스페이스 default kind=embedding, 둘 다 없으면 빈 문자열"이라는 동작 중 "빈 문자열" 케이스가 API 소비자 관점에서 어떤 의미인지(설정이 없는 정상 상태 vs 오류)와, 프론트엔드에서 이 빈 문자열을 어떻게 처리해야 하는지가 불명확하다.
- 제안: `description`에 "빈 문자열인 경우 워크스페이스에 embedding ModelConfig가 없는 상태이므로 임베딩 기능을 사용하기 전 설정이 필요하다"는 안내를 추가한다.

---

### [INFO] `CreateKnowledgeBaseDto` / `UpdateKnowledgeBaseDto` — legacy 필드 제거와 함께 JSDoc 정리 적절
- 위치: `codebase/backend/src/modules/knowledge-base/dto/create-knowledge-base.dto.ts`, `update-knowledge-base.dto.ts`
- 상세: `embeddingModel`, `embeddingLlmConfigId` 관련 `@ApiPropertyOptional` 데코레이터와 JSDoc이 함께 제거되어 API 문서 drift 없이 정리됐다. `embeddingModelConfigId`의 설명도 legacy 폴백 언급이 제거되어 현행 동작과 일치한다.
- 제안: 없음.

---

### [WARNING] `knowledge-bases.ts` (프론트엔드 API 인터페이스) — 타입 변경에 대한 변경 이력 주석 없음
- 위치: `codebase/frontend/src/lib/api/knowledge-bases.ts`
- 상세: `embeddingLlmConfigId` 제거, `embeddingModel` description 추가, `create`/`update` payload에서 `embeddingModel`·`embeddingLlmConfigId` 제거가 이루어졌다. 이는 API 계약 변경이며, 프론트엔드 코드가 이 타입을 직접 사용하는 컴포넌트들이 영향을 받는다. 그러나 인터페이스 파일 자체에 "PR4b에서 제거된 필드" 주석이 없어 타입 정의만 보고는 변경 경위를 알 수 없다.
- 제안: `KnowledgeBaseData` 인터페이스 상단 또는 변경된 필드 인근에 `// PR4b: embeddingLlmConfigId removed (V094 DROP). embeddingModel is now read-only, derived server-side.` 형태의 변경 경위 주석을 추가한다.

---

### [INFO] `loader-error-messages.ts` — 에러코드 변경 주석 명확
- 위치: `codebase/frontend/src/components/llm-config/loader-error-messages.ts`
- 상세: `LLM_CONFIG_INVALID` 제거와 `MODEL_CONFIG_DEFAULT_MISSING` 추가에 대한 인라인 주석이 "PR4b: legacy LLM_CONFIG_INVALID / LLM_CONFIG_NOT_FOUND were renamed into these"라고 명시하여 변경 맥락을 충분히 설명한다.
- 제안: 없음.

---

### [WARNING] 테스트 파일 — 변경 의도 설명 주석의 일관성 부족
- 위치: `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.spec.ts`, `rag-search.service.spec.ts`
- 상세: 두 파일 모두 파일 상단에 `// PR4b:` 블록 주석으로 변경 맥락을 설명하는 점은 좋다. 그러나 `rag-search.service.spec.ts`의 `KbRowFixture` 인터페이스에서 `embeddingModel`·`embeddingLlmConfigId` 제거에 대한 주석이 `makeKbRow` 함수 주석에만 부분적으로 언급되고, 인터페이스 정의 자체에는 제거 경위 주석이 없다. 향후 테스트 유지보수자가 왜 이 필드들이 없는지 파악하기 어렵다.
- 제안: `KbRowFixture` 인터페이스 상단에 `// PR4b: embeddingModel·embeddingLlmConfigId 은퇴. embeddingModelConfigId 만 임베딩 관련 필드.` 주석을 추가한다.

---

### [INFO] `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md` — 문서화 수준 우수
- 위치: `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md`
- 상세: 사용자 확정 결정, consistency-check 결과, repoint 우선순위 Rationale, fail-loud RAISE 근거, 워크플로 체크 목록이 상세히 기술되어 있다. plan 문서 표준을 잘 충족한다.
- 제안: `related_plan:` frontmatter의 `plan/in-progress/kb-model-change-reembed-followup.md`가 실제로는 `plan/complete/`에 있으므로 경로를 `plan/complete/kb-model-change-reembed-followup.md`로 수정하면 문서 정확성이 높아진다.

---

### [WARNING] `embedding.service.ts` — 인라인 주석에서 "PR2" 참조 완전 제거되지 않은 채 기술 내용 변경
- 위치: `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts`
- 상세: 주석 "4. Resolve embedding model config + model (1급화 폴백 체인):"으로 "PR2" 수식어가 제거됐다. 그러나 기존 주석의 "embedding_model_config_id → ws default kind=embedding → legacy(chat piggyback)" 3단계 설명이 2단계로 줄었음에도 `embedding.service.ts`와 `rag-search.service.ts` 내 다른 인라인 주석들에서 "PR2 폴백 체인" 같은 잔존 참조가 완전히 제거됐는지 diff만으로는 확인이 어렵다. 변경된 부분의 주석은 현행과 일치한다.
- 제안: 코드베이스 내 `PR2 폴백 체인`, `PR2:` 패턴 잔존 여부를 추가로 점검한다.

---

### [CRITICAL] 에러코드 변경 — API 공개 문서 업데이트 미명시
- 위치: `llm-preview.service.ts`, `llm.service.ts`, `loader-error-messages.ts`
- 상세: `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID`, `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` 에러코드 rename은 외부 API 소비자에게 breaking change일 수 있다. plan 문서에 "외부 소비자 Sunset/deprecation 정책 검토 (api-contract-reviewer)"가 미체크 항목으로 남아있으며, `spec/conventions/error-codes.md §3 historical-artifact` 레지스트리 등재도 미완료 상태다. 현재 CHANGELOG나 마이그레이션 가이드에 이 에러코드 변경이 기록되지 않았다.
- 위치: `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md` §범위 2 작업 체크리스트 (미완료 항목)
- 제안: `spec/conventions/error-codes.md §3`에 `LLM_CONFIG_INVALID`와 `LLM_CONFIG_NOT_FOUND`를 historical-artifact로 등재하고, 이 rename이 내부 전용임(프론트엔드 `loader-error-messages.ts`가 이미 양쪽을 동일 UI 메시지로 매핑하므로 사용자 영향 없음)을 명시하는 문서화가 필요하다. 외부 API 문서(OpenAPI spec 등)에 에러코드 변경 이력이 반영되어야 한다.

---

## 요약

이번 PR4b 변경은 KB 임베딩 legacy 컬럼 은퇴라는 비가역적 데이터 변경을 포함하므로 SQL 마이그레이션 파일의 헤더 주석 문서화는 매우 충실하게 작성되어 있다. DTO·엔티티·서비스 레이어의 legacy 필드 제거와 함께 JSDoc·`@ApiProperty` description이 일관되게 정리된 점도 긍정적이다. 주요 문서화 갭은 세 가지다: (1) `KnowledgeBase` 엔티티의 transient `embeddingModel` 필드가 TypeORM 엔티티 내에서 `@Column` 없이 존재하는 이유와 미초기화 위험에 대한 경고가 부족하다. (2) 에러코드 rename(`LLM_CONFIG_INVALID` 등)에 대한 historical-artifact 레지스트리 등재와 외부 소비자용 변경 안내가 미완료 상태이다. (3) 프론트엔드 API 인터페이스(`knowledge-bases.ts`)에서 제거된 필드에 대한 변경 경위 주석이 없어 타입 변경 맥락 추적이 어렵다. `resolveEmbedding` JSDoc의 파라미터 계약(null vs undefined 의미 차이)도 보강이 필요하다.

## 위험도

MEDIUM
