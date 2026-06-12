# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] 파일 14~17: `llm-preview.service.ts`, `llm.service.ts` 에러코드 rename — 범위 내 (범위 2 작업)
- 위치: `codebase/backend/src/modules/llm/llm-preview.service.ts` (3개소), `llm.service.ts` (1개소), 대응 spec 파일 2개
- 상세: `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID`, `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` 변경은 plan `범위 2` 체크리스트에 명시된 작업이다. llm 모듈 파일 변경이 knowledge-base 모듈과 직접 무관해 보이지만, plan 문서가 이 작업을 포함하므로 범위 일탈이 아니다.
- 제안: 이상 없음.

### [INFO] 파일 19: `model-config.service.ts` — `findManyByIds` 신규 메서드 추가
- 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` 103~101줄
- 상세: `findManyByIds` 메서드는 `attachEffectiveEmbeddingModel` N+1 회피를 위해 추가됐다. 이 메서드는 `knowledge-base.service.ts`의 응답 derive 기능(plan §범위 1 DTO 정리·응답 derive 항목)에 직접 사용된다. 새 기능이지만 현 작업 범위에서 필수이며 과도한 추상화 없이 최소 인터페이스로 구현됐다.
- 제안: 이상 없음.

### [INFO] 파일 19: `resolveConfig` 에러코드 변경 (`MODEL_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING`)
- 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` 130줄 (`resolveConfig` 기본값 미설정 경로)
- 상세: plan §범위 2 작업이나, 해당 변경이 `resolveConfig`(id=null인 default 미설정 경로)에도 적용됐다. plan 표는 `llm.service.ts:354-364` 발행처만 명시하고 있으나, `resolveConfig` 내의 동일 패턴도 함께 변경된 것은 논리적으로 일관성이 있다. plan 정의와 미묘하게 넓어졌으나 에러코드 통일의 취지에 완전히 부합한다.
- 제안: 이상 없음 (의도적 확장으로 판단).

### [INFO] 파일 18: `model-config.service.spec.ts` — `MODEL_CONFIG_DEFAULT_MISSING` 신규 테스트 추가
- 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts` 560~568줄 (신규 it 블록)
- 상세: `resolveConfig`의 `MODEL_CONFIG_DEFAULT_MISSING` 에러코드 변경을 검증하는 테스트가 추가됐다. 범위 2 작업과 직접 연관된 테스트 추가이므로 범위 내 작업이다.
- 제안: 이상 없음.

### [INFO] 파일 21: `sanitize-loader-error.test.ts` — `LLM_CONFIG_INVALID` 제거 + `MODEL_CONFIG_DEFAULT_MISSING` 추가
- 위치: `codebase/frontend/src/components/llm-config/__tests__/sanitize-loader-error.test.ts`
- 상세: 프론트엔드 테스트에서 `LLM_CONFIG_INVALID`가 더 이상 매핑되지 않음을 명시적으로 검증한다(`expect(map.LLM_CONFIG_INVALID).toBeUndefined()`). 에러코드 통일(범위 2) 작업의 일환으로 적절한 변경이다.
- 제안: 이상 없음.

### [WARNING] 파일 3: `agent-memory.service.ts` 주석 변경 — 소범위 관련
- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` 195~198줄
- 상세: `DEFAULT_EMBEDDING_MODEL` 상수의 주석이 "KB `knowledge_base.embedding_model` DEFAULT 와 동기화" → "agent-memory 자체 경로 전용"으로 변경됐다. 이 변경은 KB의 `embedding_model` 컬럼 DROP 후 agent-memory가 그 컬럼에 의존하지 않음을 명확히 하는 목적이다. 직접 코드 로직 변경은 없고 주석만 수정됐다. plan 체크리스트에 명시된 항목은 아니나, embedding_model 컬럼 DROP의 side-effect 문서화로 볼 수 있어 논란의 여지가 있다. 그러나 오해 방지 목적의 최소 주석 수정으로 범위 일탈 수준은 낮다.
- 제안: 허용 가능. 필요시 별도 PR로 분리해도 되나, 영향 없는 주석 수정이므로 현행 유지도 무방.

### [WARNING] 파일 20: `knowledge-bases/[id]/page.tsx` — 프론트엔드 타입 변경
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` 272~273줄
- 상세: `KbUpdatePayload` 타입에서 `embeddingModel?: string`과 `embeddingLlmConfigId?: string | null`이 제거됐다. plan §범위 1 DTO 정리에 포함된 작업(API 페이로드에서 legacy 필드 제거)이나, plan 체크리스트 항목이 "DTO 정리: create/update-knowledge-base, embedding-probe, knowledge-base-response"로만 명시돼 프론트엔드 페이지 컴포넌트 내부 타입까지 포함하는지는 plan에 명시되지 않았다. 다만 API 계층 타입과 일관성을 유지하기 위한 변경으로, 범위 2 연장선상에 있다.
- 제안: 허용 가능. API 클라이언트 타입(`knowledge-bases.ts`)에서 동일 필드가 제거됐으므로 일관성 확보 목적의 필수 정리로 판단.

### [INFO] 파일 25: plan 파일 추가 (`plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md`)
- 위치: `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md`
- 상세: PR4b 작업 계획 파일 추가. 프로젝트 규약(CLAUDE.md)상 `plan/**` 파일은 developer 쓰기 권한 범위이며, worktree 기반 작업에서 plan 파일 추가는 표준 절차다.
- 제안: 이상 없음.

### [INFO] 파일 26~28+: consistency-check 산출물 추가
- 위치: `review/consistency/2026/06/12/00_23_39/` 디렉토리 하위 파일들
- 상세: 구현 착수 전 `consistency-check --impl-prep` 의무 실행 결과물(CLAUDE.md 규약). `review/` 디렉토리는 개발자 쓰기 권한 범위(`review/**/RESOLUTION.md`)에 엄밀히는 포함되지 않으나, plan lifecycle 규약에 따라 consistency check 산출물은 `review/consistency/**`에 저장하도록 돼 있다. 규약상 정상적인 워크플로 산출물이다.
- 제안: 이상 없음.

---

## 요약

PR4b의 변경 범위는 전반적으로 plan `§범위 1`(KB 임베딩 legacy 컬럼 은퇴) 및 `§범위 2`(에러코드 통일)에 충실하게 집중돼 있다. 핵심 변경인 V093/V094 마이그레이션, `resolveEmbedding` step-3 제거, 엔티티·DTO·API 클라이언트 legacy 필드 정리, 에러코드 rename, 대응 테스트 갱신이 모두 범위 내 작업이다. 신규 추가된 `findManyByIds`와 `attachEffectiveEmbeddingModel`은 응답 derive 기능의 N+1 회피를 위한 최소 인터페이스로, 과도한 기능 확장에 해당하지 않는다. `agent-memory.service.ts` 주석 변경과 프론트엔드 페이지 컴포넌트 내부 타입 변경은 plan 에 직접 명시되지 않았으나 legacy 필드 제거의 side-effect 문서화 및 타입 일관성 목적으로 범위 일탈 수준은 낮다. 불필요한 포맷팅 변경, 관련 없는 파일 수정, 미요청 기능 추가는 발견되지 않았다.

## 위험도

LOW
