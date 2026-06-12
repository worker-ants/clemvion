# Architecture Review — PR4b KB Embedding Retire + Error Code Unification

리뷰 대상: spec 변경 문서(일관성 검토 산출물 포함) + 실제 코드 파일

---

## 발견사항

### [CRITICAL] `resolveEmbedding` 의 step-3 legacy 경로가 코드베이스에 아직 잔존 — spec-impl 불일치
- **위치**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/model-config/model-config.service.ts:128-174`
- **상세**: `spec/5-system/8-embedding-pipeline.md §5.5` 는 PR4b 이후 2-step 폴백으로 교체됐다고 선언하지만, 실제 `resolveEmbedding` 메서드는 step-3 legacy 폴백(chat piggyback, `embeddingLlmConfigId`/`legacyModel`)을 포함한 3-step 을 그대로 유지하고 있다. 함수 시그니처에 `embeddingLlmConfigId` 와 `legacyModel` 파라미터가 여전히 존재한다. 이 상태에서 spec 이 "V093/V094 에서 제거됐다"고 기술하면 spec 이 구현보다 앞서 거짓 완료로 기록되는 anti-pattern 이다.
- **제안**: `resolveEmbedding` 에서 step-3 분기 및 `embeddingLlmConfigId`/`legacyModel` 파라미터를 제거한 뒤 spec §5.5 2-step 선언을 확정하거나, V093 마이그레이션이 완료될 때까지 spec 에 "(코드 변경 pending — V093 이후 활성화)" 주석을 명시한다.

### [CRITICAL] `LLM_CONFIG_INVALID` 가 live 발행 중인데 spec `error-codes.md §4 Retired` 에 은퇴 코드로 등재
- **위치**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/llm/llm-preview.service.ts:39,48,69` / `spec/conventions/error-codes.md §4`
- **상세**: `error-codes.md §4 Rename 이력` 테이블은 `LLM_CONFIG_INVALID` 를 "더 이상 발행되지 않으며 코드베이스에서 완전 제거"된 retired 코드로 기재한다. 그러나 `llm-preview.service.ts` line 39/48/69 에서 여전히 HTTP 400 응답으로 `LLM_CONFIG_INVALID` 를 발행 중이다. 이는 SRP(단일 책임) 위반이 아니라 **spec 과 구현 사이의 계약 거짓 선언**이다 — spec §4 의 "구 코드는 더 이상 발행되지 않는다" 조건이 충족되지 않은 상태에서 등재됐다.
- **제안**: `llm-preview.service.ts` 의 `LLM_CONFIG_INVALID` 3곳을 `MODEL_CONFIG_INVALID` 로 교체하는 코드 변경을 PR4b 에 포함시키거나, 미포함 시 `error-codes.md §4` 에서 해당 행을 제거하고 "코드 교체 완료 후 등재"로 분리한다.

### [CRITICAL] `LLM_CONFIG_NOT_FOUND` 가 live 발행 중인데 spec `error-codes.md §4 Retired` 에 은퇴 코드로 등재
- **위치**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/llm/llm.service.ts:356` / `spec/conventions/error-codes.md §4`
- **상세**: `error-codes.md §4` 는 `LLM_CONFIG_NOT_FOUND` 를 `MODEL_CONFIG_DEFAULT_MISSING` 으로 교체한 retired 코드로 등재하지만, `llm.service.ts:356` 에서 여전히 `BadRequestException({ code: 'LLM_CONFIG_NOT_FOUND' })` 를 발행한다. 또한 대체 코드 `MODEL_CONFIG_DEFAULT_MISSING` 는 `error-codes.ts` 에 존재하지 않고(`ErrorCode` enum 확인), `model-config.service.ts:121` 도 default-missing 경로에서 `MODEL_CONFIG_NOT_FOUND(400 BadRequest)` 를 사용한다. 이는 레이어 책임 위반보다 더 근본적인 문제로, **존재하지 않는 코드를 이미 구현된 것처럼 spec 에 기록**하는 데이터 모델 무결성 위반이다.
- **제안**: (a) `error-codes.ts` 에 `MODEL_CONFIG_DEFAULT_MISSING` 추가 → `llm.service.ts:356` 및 `model-config.service.ts:121` 의 default-missing throw 경로를 신규 코드로 전환 → spec 등재 순으로 구현 선행 후 spec 갱신한다. (b) 또는 현재 PR4b 범위에서 제외하고 `error-codes.md §4` 에서 해당 행을 제거한다.

### [WARNING] `resolveConfig` 의 default-missing 경로가 `MODEL_CONFIG_NOT_FOUND(400)` 를 발행 — spec §1.3 의 분리 의도와 구현 불일치
- **위치**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/model-config/model-config.service.ts:119-123`
- **상세**: `spec/5-system/3-error-handling.md §1.3 Rationale` 는 id 지정 경로(404)와 default-missing 경로(400)를 코드 레벨에서 명확히 분리한다고 선언한다. 그러나 실제 `resolveConfig` 의 default-missing throw 경로는 `MODEL_CONFIG_NOT_FOUND(400 BadRequest)` 를 사용해 id 지정 경로의 `notFound()` → `NotFoundException(404)` 와 다른 코드·status 로 이미 분리된 상태다. 신규 코드 `MODEL_CONFIG_DEFAULT_MISSING` 는 코드베이스에 없으므로 현재 spec Rationale 이 기술하는 분리는 절반만 구현됐다.
- **제안**: `MODEL_CONFIG_DEFAULT_MISSING` 가 구현 완료되면 `resolveConfig:121` 을 신규 코드로 교체하고 spec Rationale 과 일치시킨다. 미구현 시 spec Rationale 의 `MODEL_CONFIG_DEFAULT_MISSING(400)` 기술을 "(구현 pending)" 으로 표기한다.

### [WARNING] 에러코드 레지스트리(`error-codes.md`) 에 §3 과 §4 의 목적 레이어 분리 — 개방-폐쇄 원칙 위반 위험
- **위치**: `spec/conventions/error-codes.md §3, §4`
- **상세**: §3 은 "원칙 위반이나 안정성 때문에 유지되는 active 코드" 등록부이고 §4 는 "retired 코드 이력"이다. 이 두 목적을 하나의 파일 안에서 서로 다른 테이블 스키마(§3: 5-컬럼, §4: 5-컬럼이나 목적 다름)로 분리한 것 자체는 올바른 방향이다. 그러나 §3 테이블 바로 뒤에 `§3 은 active 코드 등록부고 retired 는 §4 에 둔다`는 안내 주석이 §4 제목 위에 삽입됐다 — 이 구조에서 §3 테이블 스키마(`코드/HTTP/이름이 부정확한 이유/진실(의미)/근거`)와 §4 테이블 스키마(`구 코드/대체 코드/HTTP/PR/비고`)가 달라 문서 구조의 일관성이 깨진다. 문서 구조에서도 OCP 를 적용하자면 §4 는 기존 §3 테이블과 독립적으로 확장될 수 있어야 하고, 신규 섹션 추가로 기존 섹션이 영향받지 않아야 한다 — 현재는 §3 표 아래에 안내 주석을 삽입해 §3 구조를 수정했다.
- **제안**: §3 과 §4 가 레이어 목적이 다름을 Overview 에 명확히 기술하고, §4 테이블 컬럼 스키마를 §3 표 수정 없이 독립적으로 정의한다. 현재 변경은 기능적으로 올바르나 이후 유지보수 시 혼선 방지를 위해 §4 앞에 독립적인 Overview 단락을 신설한다.

### [WARNING] `model-config.service.ts` 의 `resolveEmbedding` — chat kind 에 대해 kind-check 없이 조회
- **위치**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/model-config/model-config.service.ts:167-169`
- **상세**: step-3 legacy 경로에서 `findEntity(embeddingLlmConfigId, workspaceId)` 를 kind 파라미터 없이 호출한다(3번째 인자 생략 — `findEntity` 의 kind 파라미터가 선택적일 때). 반면 step-1 에서는 `findEntity(id, workspaceId, 'embedding')` 처럼 kind 를 명시 전달한다. legacy chat config 를 embedding 용도로 사용하는 piggyback 은 설계상 kind 무시가 의도이나, kind 검사 생략이 명시적 주석 없이 이루어져 리스코프 치환 관점에서 `findEntity` 계약("kind 지정 = cross-kind 차단")이 일관되게 적용되지 않는다. PR4b 에서 step-3 를 제거한다면 이 경로도 함께 제거돼야 한다.
- **제안**: PR4b 에서 step-3 제거 시 해당 경로를 함께 삭제한다. 유지 시에는 `// kind 무시: legacy piggyback 경로 — PR4b V094 DROP 후 제거 예정` 주석을 추가한다.

### [WARNING] `spec/1-data-model.md §2.11` KnowledgeBase 테이블에서 legacy 컬럼 행 삭제 — 데이터 모델 SoT 에서 컬럼 추적성 소실
- **위치**: `spec/1-data-model.md` diff — `embedding_llm_config_id`, `embedding_model` 행 삭제
- **상세**: 두 legacy 컬럼이 V094 에서 DROP 된다는 사실을 테이블 정의에서 완전히 제거했다. 데이터 모델 SoT 에서 컬럼 이력이 사라지면 후속 마이그레이션 설계자가 "이 컬럼들이 언제 어떻게 존재했는가"를 추적하기 어렵다. `구현 상태` 주석에는 "V093/V094 에서 은퇴됐다"고 기술되어 있으나 테이블 정의에는 흔적이 없다. 이는 데이터 레이어 책임(DB 스키마 SoT)의 연속성을 약화시킨다.
- **제안**: 테이블에 행은 삭제하되 `구현 상태` 주석에 이미 기술된 것처럼 "V093/V094 에서 삭제됨" 을 `spec/1-data-model.md` 의 마이그레이션 이력 표(`§2.16` 하단 또는 해당 섹션)에 한 줄 append-only 기록으로 남긴다. 현재 변경 방향은 기능적으로 올바르나 추적성 보완이 필요하다.

### [INFO] `spec/data-flow/6-knowledge-base.md §1.1` POST 요청 파라미터에서 `embedding_model` 제거 — API 레이어 단순화
- **위치**: `spec/data-flow/6-knowledge-base.md` diff line 1699
- **상세**: `POST /api/knowledge-bases` 요청 파라미터에서 `embedding_model` 이 제거됐다. 이는 legacy 필드 은퇴에 따른 올바른 API 계약 갱신이다. 단, API breaking change 여부(기존 클라이언트가 이 파라미터를 전송하는지)를 확인하는 마이그레이션 가이드가 spec 에 없다. 내부 전용이면 문제 없으나 외부 API 라면 deprecation 기록이 필요하다.
- **제안**: `spec/data-flow/6-knowledge-base.md` 또는 CHANGELOG.md 에 "PR4b: `embedding_model` request param removed" 항목을 추가한다 (이미 CHANGELOG.md 가 수정됐다면 확인 불필요).

### [INFO] `spec/5-system/7-llm-client.md §6` 에러 처리 표 — `MODEL_CONFIG_INVALID` 로 갱신됐으나 `llm-preview.service.ts` 와 불일치
- **위치**: `spec/5-system/7-llm-client.md` diff line 1501 / `llm-preview.service.ts:39,48,69`
- **상세**: spec §6 에러 표는 `MODEL_CONFIG_INVALID` 로 교체됐으나 실제 서비스는 `LLM_CONFIG_INVALID` 를 발행한다. 이는 CRITICAL #2 의 연장이며 별도 INFO 로 기록한다. "spec 먼저 갱신, 코드 나중" 패턴을 따른 경우에도 현재 상태에서 spec 과 구현이 1:1 불일치한다.

---

## 요약

PR4b 의 spec 변경들은 아키텍처적 방향(임베딩 1급화 완결, 에러코드 명칭 통일)은 올바르다. 그러나 핵심 문제는 **spec 이 구현 완료를 앞서 선언**하는 세 지점에서 발생한다. (1) `resolveEmbedding` step-3 legacy 경로가 코드에 여전히 존재하면서 spec §5.5 는 2-step 완료를 선언한다. (2) `LLM_CONFIG_INVALID` 와 `LLM_CONFIG_NOT_FOUND` 가 코드베이스에서 여전히 live 발행되는데 `error-codes.md §4` 는 이들을 retired 로 등재한다. (3) `MODEL_CONFIG_DEFAULT_MISSING` 은 `error-codes.ts` 와 서비스 코드 어디에도 존재하지 않는데 spec §4 의 대체 코드이자 `3-error-handling.md §1.3` 신규 코드로 등재됐다. 이 세 지점은 개방-폐쇄 원칙과 레이어 책임(spec = 구현 계약의 SoT) 관점에서 spec 이 아직 완료되지 않은 구현을 기정사실화하는 상태를 만든다. spec 변경 자체의 내용은 의미론적으로 올바르나, 코드 변경이 선행되지 않으면 spec 이 거짓 SoT 가 된다.

---

## 위험도

HIGH
