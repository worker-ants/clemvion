### 발견사항

- **[INFO]** V093 마이그레이션에서 `api_key` 컬럼 복사 시 암호화 상태 유지 확인 필요
  - 위치: `codebase/backend/migrations/V093__kb_embedding_repoint.sql` — `legacy_src` CTE 에서 `src.api_key` 를 `SELECT` 하고 `INSERT INTO model_config(api_key, ...)` 로 직접 복사
  - 상세: 마이그레이션 주석은 "api_key 는 암호화된 컬럼을 그대로 복사하므로 재암호화 불필요(동일 ciphertext 보존)"라고 명시한다. `model_config.api_key` 가 DB 레벨 컬럼 암호화(예: `pgcrypto`, 애플리케이션 레이어 암호화)가 아닌 애플리케이션 레이어에서 암호화된 ciphertext 를 저장하는 구조라면, SQL 레벨 복사는 ciphertext 를 그대로 보존한다 — 주석 주장이 맞다. 반면 DB 레벨(예: Transparent Data Encryption)이거나 암호화 컨텍스트(nonce/IV 포함 AEAD)가 row-bound 라면 복사 후 복호화에 실패할 수 있다. 코드베이스 내 api_key 암호화 방식이 애플리케이션 레이어 대칭 암호화이고 row-bound IV 가 없는지 확인이 필요하다.
  - 제안: 기존 암호화 방식(키/IV 구조)을 명시적으로 확인하고, V093 적용 후 통합 테스트에서 새로 생성된 `kind=embedding` config 의 api_key 복호화를 검증하는 테스트를 추가한다.

- **[INFO]** 오류 메시지에 `workspaceId` 포함 — 내부 식별자 노출 여부 확인 필요
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` line 353 — `MODEL_CONFIG_DEFAULT_MISSING` BadRequestException 의 `message` 에 `workspaceId` 값이 포함됨 (기존 코드 유지, 이번 diff 에서 에러코드만 rename)
  - 상세: `workspaceId` 는 내부 UUID 이다. 클라이언트에게 직접 노출될 경우, 악의적 사용자가 타 워크스페이스 ID 를 열거하거나 정보 유출에 활용할 수 있다. 그러나 이 오류는 인증된 사용자의 자기 워크스페이스 컨텍스트에서만 발생하므로 실질적 추가 위험은 제한적이다. 이미 존재하던 패턴으로 이번 PR 이 신규 도입한 것은 아니다.
  - 제안: 운영 환경에서 오류 응답이 클라이언트에게 그대로 노출되는지 확인한다. 필요 시 메시지에서 `workspaceId` 를 제거하고 서버 로그에만 남긴다.

- **[INFO]** `attachEffectiveEmbeddingModel` 의 `findManyByIds` — cross-workspace 격리 확인
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — `attachEffectiveEmbeddingModel` 내 `this.modelConfigService.findManyByIds(configIds, workspaceId)` 호출
  - 상세: `findManyByIds` 구현 (`model-config.service.ts`) 은 `{ id: In(ids), workspaceId }` 조건으로 쿼리하므로 workspaceId 격리가 올바르게 적용된다. 요청 워크스페이스 외 config 는 반환되지 않는다. 현재 구현상 취약점 없음 — 확인 완료.
  - 제안: 없음 (이미 올바르게 구현됨).

- **[INFO]** `embeddingModel` transient 필드 — `@Column` 미선언으로 TypeORM save() 시 영속화 안 됨 (의도적)
  - 위치: `codebase/backend/src/modules/knowledge-base/entities/knowledge-base.entity.ts` — `embeddingModel?: string;` (`@Column` 없음)
  - 상세: PR4b 에서 `embedding_model` DB 컬럼이 V094 로 DROP 되므로 엔티티에서 `@Column` 을 제거하고 transient 필드로 전환했다. TypeORM 은 `@Column` 없는 필드를 save 시 무시한다. 의도된 설계이며 보안 영향 없음. 다만 `kbRepository.findOne` 직접 결과를 service 메서드를 거치지 않고 외부에 노출하면 `embeddingModel` 이 `undefined` 가 된다는 주석이 entity 에 명시돼 있어, 이를 클라이언트에 직렬화할 때 `undefined` 가 예기치 않은 응답 누락을 야기할 수 있다.
  - 제안: 응답 DTO(`knowledge-base-response.dto.ts`)에서 `embeddingModel` 이 항상 서비스 레이어를 거친 값임을 보장하는 unit test 를 작성하거나, `undefined` 케이스를 명시적으로 빈 문자열로 serialize 하는 처리를 추가한다.

- **[INFO]** SSRF 가드 에러코드 rename: `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` (보안 기능 유지 확인)
  - 위치: `codebase/backend/src/modules/llm/llm-preview.service.ts` — SSRF 가드의 `isPrivateHost` 및 `resolvesToPrivate` 차단 경로
  - 상세: SSRF 가드 로직 자체(비공개 주소 차단, DNS 1차 rebinding 방어)는 이번 PR 에서 변경되지 않았다. 에러코드 이름만 rename 됐으며 차단 조건·동작은 동일하다. 보안 기능에 영향 없음.
  - 제안: 없음.

---

### 요약

이번 PR 의 변경 범위는 (1) KB 임베딩 legacy 컬럼(`embedding_llm_config_id`, `embedding_model`) DB 은퇴, (2) 에러코드 rename(`LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID`, `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING`), (3) 관련 spec/문서 갱신이다. 하드코딩된 시크릿, 인젝션 취약점(SQL 파라미터는 TypeORM ORM 또는 파라미터화된 쿼리 사용), XSS, 인증 우회 등 OWASP Top 10 해당 취약점은 발견되지 않았다. 가장 주의할 지점은 V093 마이그레이션에서 `api_key` ciphertext 를 SQL 레벨로 직접 복사하는 부분으로, 애플리케이션 레이어 암호화 구조(row-bound IV 없음)임을 전제하고 있다 — 이 전제가 맞는지 통합 테스트 수준에서 검증이 권장된다. SSRF 가드의 보안 차단 로직은 에러코드 rename 과정에서도 보존됐으며 기능에 변화 없음이 확인된다. 전반적으로 이번 변경에서 신규 보안 취약점이 도입된 증거는 없다.

### 위험도

LOW
