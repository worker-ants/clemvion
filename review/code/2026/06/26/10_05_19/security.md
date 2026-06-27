# 보안(Security) 리뷰

리뷰 대상: `refactor(llm,model-config): C-2 cluster 4 — llm↔model-config forwardRef 순환 제거`
커밋: `2bee0da5a101ab1dc7762c0cf0da0c7b548be562`

---

## 발견사항

### [WARNING] testConnection / listModels 엔드포인트에 @Roles 가드 누락

- **위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `testConnection (POST :id/test)`, `listModels (GET :id/models)`
- **상세**: 두 엔드포인트 모두 `@Roles` 데코레이터가 없다. 같은 컨트롤러의 `previewModels (POST preview-models)` 는 `@Roles('editor')` 로 보호하는 반면, testConnection 과 listModels 는 인증(bearer token)만 요구하고 역할 검사가 없다. 이 두 엔드포인트는 실제 LLM 프로바이더 API 를 호출하며(네트워크 I/O, 과금 대상), 뷰어 역할 등 권한이 낮은 인증 사용자도 반복 호출할 수 있다. rate limit(10회/60초)이 부분적으로 완화하지만 멀티테넌트 환경에서 비용 증폭 공격 면이 남는다. 이 동작은 원본 `ModelConfigController` 에서 verbatim 복사된 것으로 본 리팩터가 새로 도입한 문제는 아니다. 다만 엔드포인트 재배치라는 명시적 기회에 함께 수정 가능하다.
- **제안**: `previewModels` 와 동일하게 `@Roles('editor')` 를 두 엔드포인트에 추가하거나, 뷰어도 모델 목록 조회가 허용된다면 최소한 `@Roles('viewer')` 를 붙여 역할 검사가 적용됨을 명시한다. 의도가 "인증이면 충분"이라면 테스트에 해당 역할 정책을 주석으로 명기해 미래 보안 감사 시 의도를 확인할 수 있게 한다.

---

### [INFO] notifyInvalidated — 리스너 예외가 후속 리스너 호출을 건너뛸 수 있음

- **위치**: `codebase/backend/src/modules/model-config/model-config.service.ts` — `notifyInvalidated` (신규 추가)
- **상세**: `for...of` 루프로 리스너를 순차 호출하며 예외 처리가 없다. 특정 리스너가 예외를 던지면 그 이후의 리스너는 호출되지 않고 예외가 `update`/`remove` 호출 스택으로 전파돼 캐시 무효화가 부분 적용된다. 현재 등록되는 리스너(`clearClientCache`)는 `Map.delete` 로만 구성되어 throw 하지 않으며, 코드 주석도 "리스너는 throw 하지 않는 멱등 무효화여야 한다"고 명시한다. 현재 위험도는 낮지만 향후 추가 리스너 등록 시 잠재적 정합성 문제가 생길 수 있다.
- **제안**: 방어적 구현 관점에서 각 리스너 호출을 try/catch 로 감싸고 예외는 로깅만 하도록 강화하면, 한 리스너의 예외가 다른 리스너와 원래 작업(update/remove)에 영향을 주지 않는다. (`try { listener(configId); } catch (err) { this.logger.warn(...) }`)

---

### [INFO] workspaceId 가 400 에러 응답 본문에 포함됨 (기존 동작, 의도적)

- **위치**: `codebase/backend/src/modules/llm/llm.service.ts` — `resolveConfig` 메서드 (`MODEL_CONFIG_DEFAULT_MISSING` 케이스)
- **상세**: 기본 LLM 설정 미지정 시 400 응답에 `workspaceId` 가 메시지/payload 에 포함된다. 이는 본 커밋 이전부터 존재하던 동작이며, 코드 주석에 "사용자가 직접 식별할 수 있도록 workspaceId 포함" 이라 의도를 명시했다. 오직 인증된 사용자에게만 반환되므로 직접적 외부 노출 경로는 없다.
- **제안**: 현행 유지 가능. 추후 보안 레벨 강화를 원한다면 에러 응답에서 내부 식별자를 제거하고 클라이언트가 로컬 컨텍스트에서 workspaceId 를 참조하도록 변경할 수 있다.

---

### [INFO] @Query('type') 런타임 enum 검증 없음

- **위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `listModels` 의 `@Query('type') type?: 'chat' | 'embedding'`
- **상세**: 쿼리 파라미터 `type` 이 TypeScript 타입 애노테이션으로만 제한되며 `class-validator` 등 런타임 검증이 없다. 잘못된 값(예: `type=invalid`)이 전달되면 서비스 계층에서 `opts?.type === 'chat' || opts?.type === 'embedding'` 분기에 해당하지 않아 필터 없이 전체 목록이 반환된다. 기능적 오류나 보안 취약점은 없지만 방어적 입력 검증 측면에서 미흡하다.
- **제안**: `@IsOptional() @IsIn(['chat', 'embedding'])` 을 DTO 클래스에 적용하거나 `ParseEnumPipe` 를 사용한다.

---

## 요약

이번 변경은 `llm ↔ model-config` 모듈 간 순환 의존을 제거하는 아키텍처 리팩터로, 보안 관점에서 새로운 주요 취약점을 도입하지 않는다. API 키는 암호화 저장·마스킹 반환 정책이 유지되고, SQL 쿼리는 TypeORM 파라미터 바인딩으로 인젝션이 차단되며, LLM 에러 메시지는 `sanitizeLlmErrorMessage` 로 정제된다. SSRF 가드(`assertBaseUrlNotSsrf`)도 그대로 유지된다. 가장 주목할 점은 신규 `LlmModelConfigController` 의 `testConnection`/`listModels` 가 원본과 동일하게 `@Roles` 없이 복사됐다는 것으로, 이 엔드포인트는 실제 외부 LLM API 를 호출해 과금이 발생할 수 있으므로 역할 검사 추가가 권장된다. 하드코딩된 시크릿, 인증 우회, 취약한 암호화 알고리즘, 알려진 취약 의존성은 발견되지 않았다.

## 위험도

**LOW**
