### 발견사항

---

**[WARNING] 임베딩 모델 식별자에 허용 목록(allowlist) 검증 없음**
- 위치: `update-knowledge-base.dto.ts:38–48`, `embedding.service.ts` (embed 호출부)
- 상세: `embeddingModel` 필드는 `@IsString()` + `@MaxLength(100)` 만 적용됨. `text-embedding-3-small` 등 실존하는 모델만 허용하는 열거형 또는 패턴 검증이 없어, editor 권한을 가진 공격자가 임의 문자열을 DB에 저장하고 LLM 서비스에 그대로 전달할 수 있음. 외부 API 호출 시 비정상 응답이나 비용 낭비가 발생할 수 있으며, LLM 클라이언트 구현에 따라 Prompt Injection 경로가 열릴 수 있음.
- 제안: `@IsIn(['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002', ...])` 또는 `@Matches(/^[\w\-.:\/]{1,100}$/)` 형태의 서버 측 패턴 검증 추가. 서버에서 허용 모델 목록을 중앙 상수로 관리하고, DTO와 SUPPORTED_DIMS 추가 시 함께 갱신하도록 규약화.

---

**[WARNING] `POST /:id/re-embed` 엔드포인트에 rate limiting 누락**
- 위치: `knowledge-base.controller.ts:143–172`
- 상세: `/test`, `/:id/models` 엔드포인트에는 `@Throttle({ default: { limit: 10, ttl: 60_000 } })`가 적용되어 있으나, `re-embed` 엔드포인트에는 없음. editor 권한 사용자가 이 엔드포인트를 반복 호출하면 KB 내 모든 문서에 대해 S3 다운로드 → LLM API 임베딩 → DB 벌크 INSERT가 연쇄 실행됨. `MAX_CONCURRENT = 3`이 인스턴스 내 동시성을 제한하지만, 다수의 KB에 대해 반복 호출하면 LLM API 예산 소진 및 DB 부하(OWASP A05 자원 고갈)로 이어질 수 있음.
- 제안: `@Throttle({ default: { limit: 3, ttl: 60_000 } })` 등 재임베딩에 맞는 보수적인 throttle 적용. 서비스 레이어에서도 KB별 중복 실행 방지(예: running 상태 플래그 또는 분산 락) 고려.

---

**[WARNING] `dim` 값의 SQL 직접 인라인 (주석 의존 완화)**
- 위치: `rag-search.service.ts:122–141`
- 상세: `SUPPORTED_DIMS` 화이트리스트 + DB INTEGER 타입 보장으로 현재는 SQL injection이 불가하지만, `dim` 값이 SQL 문자열에 템플릿 리터럴로 인라인됨. 해당 패턴의 안전성은 화이트리스트 검사가 선행된다는 주석 설명에 의존함. 향후 개발자가 화이트리스트 검사 위치를 이동하거나 삭제할 경우 SQL injection으로 전환될 수 있음. "정당한 수단으로는 안전하지만 코드 변경에 취약한 패턴"에 해당.
- 제안: 현재 구조는 유지하되, `dim` 인라인 직전에 타입 단언(`const safeDim: 768 | 1536 | 3072 = dim as ...`)을 추가하거나, 인라인 위치에 어서션을 삽입해 화이트리스트 통과 없이 실행되지 않음을 코드 레벨에서 강제. 주석만으로 안전성을 보증하는 구조는 회귀 위험이 있음.

---

**[INFO] 임베딩 실패 오류 메시지에 내부 식별자 포함**
- 위치: `embedding.service.ts:140–146`
- 상세: 오류 메시지에 `kb.id`(UUID)와 `kb.embeddingModel`이 포함되며, 이 메시지는 `document.metadata.error` 필드에 저장되어 API 응답으로 노출될 수 있음. 운영 환경에서 문서 목록 조회 API가 metadata를 그대로 반환한다면 내부 식별자 노출에 해당함.
- 제안: 사용자 향 오류 메시지와 내부 로그 메시지를 분리. `metadata.error`에는 사용자 친화적 메시지("임베딩 처리 중 오류가 발생했습니다")를, 상세 정보(KB ID, 모델명)는 서버 로그에만 기록.

---

**[INFO] `?type` 쿼리 파라미터의 DTO/Pipe 검증 없음**
- 위치: `llm-config.controller.ts:218`
- 상세: `@Query('type') type?: string`은 NestJS `ValidationPipe`를 거치지 않은 raw string. 현재 로직은 `type === 'chat' || type === 'embedding'` 조건으로 안전하게 처리하지만, 공식 DTO 없이 문자열이 컨트롤러에 직접 진입하는 구조임. 프레임워크 레벨의 입력 계약 문서화 미비.
- 제안: `@IsOptional() @IsIn(['chat', 'embedding'])` 데코레이터를 가진 쿼리 DTO 도입 또는 `ParseEnumPipe` 적용.

---

### 요약

전반적으로 SQL 파라미터화, UUID 파이프, 워크스페이스 격리, 역할 기반 접근 제어 등 핵심 보안 요소가 잘 구현되어 있습니다. 가장 주목할 부분은 두 가지입니다. 첫째, 임베딩 모델 식별자에 서버 측 허용 목록 검증이 없어 LLM 서비스에 임의 문자열이 전달될 수 있습니다. 둘째, `re-embed` 엔드포인트의 rate limiting 부재로 editor 권한 사용자가 LLM API 비용과 서버 자원을 과도하게 소모하는 경로가 열려 있습니다. `dim` 인라인 SQL은 현재 안전하지만 화이트리스트-인라인 결합의 유지보수 의존성을 해소할 필요가 있습니다.

### 위험도

**MEDIUM**