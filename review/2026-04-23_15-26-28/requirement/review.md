## 발견사항

### [WARNING] 로그에 비정제(unsanitized) 프로바이더 에러 메시지 기록

- **위치**: `llm.service.ts` — `previewModels()` 내 `client.listModels()` 예외 처리
- **상세**: 스펙(`spec/5-system/7-llm-client.md §5.4`)은 "apiKey는 로그·응답·캐시 어디에도 기록하지 않는다"고 명시한다. 그런데 현재 코드는 `sanitizeErrorMessage(message)` 이전의 원본 `message`를 `this.logger.warn(...)` 으로 기록한다. 일부 프로바이더 SDK는 에러 메시지에 인증 헤더나 엔드포인트 URL을 포함시킬 수 있어, 요구사항의 보안 의도가 부분적으로 무력화된다.
- **제안**:
  ```ts
  // 변경 전
  this.logger.warn(`LLM preview models failed: ${message}`);
  throw new BadRequestException({ message: this.sanitizeErrorMessage(message) });

  // 변경 후
  const sanitized = this.sanitizeErrorMessage(message);
  this.logger.warn(`LLM preview models failed: ${sanitized}`);
  throw new BadRequestException({ message: sanitized });
  ```

---

### [WARNING] 팩토리 예외 메시지가 sanitize 없이 응답에 노출됨

- **위치**: `llm.service.ts` — `previewModels()` 내 `clientFactory.create()` 예외 처리
- **상세**: 팩토리 생성 단계의 예외는 `error.message`를 그대로 `BadRequestException.message`에 담는다. 스펙 §5.4는 "에러는 sanitize 후 BadRequest로 변환"을 요구하는데, 이 경로는 `sanitizeErrorMessage()`를 거치지 않는다. 팩토리 에러 자체는 대부분 benign하나, 향후 팩토리 구현이 변경될 경우 키·엔드포인트 정보가 노출될 위험이 있다.
- **제안**: 팩토리 예외 처리 블록에도 `sanitizeErrorMessage()` 또는 별도의 고정 메시지 매핑을 적용한다.

---

### [WARNING] `baseUrl` URL 형식 검증 누락 (`PreviewLlmModelsDto`)

- **위치**: `backend/src/modules/llm-config/dto/preview-llm-models.dto.ts`
- **상세**: `baseUrl`은 `@IsOptional() @IsString() @MaxLength(500)`만 선언되어 있어 임의 문자열이 통과된다. 저장용 `CreateLlmConfigDto`에 `@IsUrl()` 검증이 있다면 일관성이 없는 것이다. 잘못된 URL은 팩토리에서 런타임 오류로 이어지며, 그 에러 메시지가 위의 WARNING처럼 클라이언트에 노출될 수 있다.
- **제안**: `@IsOptional() @IsUrl({ require_tld: false }) @MaxLength(500)` 추가 (로컬 `http://localhost:...` 허용을 위해 `require_tld: false` 필요).

---

### [WARNING] `ModelCombobox` — `baseUrl` 값이 trim되지 않은 채로 API에 전달됨

- **위치**: `frontend/src/components/llm-config/model-combobox.tsx` — `mutationFn`
- **상세**: `canLoad` 로직은 `apiKey.trim()`으로 공백을 제거하지만, `previewModels` 호출 시 `apiKey`는 원본 값이 그대로 전달된다. `baseUrl`은 공백 유무만 체크하고(`baseUrl?.trim() ? baseUrl : undefined`) trim된 값 대신 원본이 전달된다. "sk- xxx"처럼 실수로 공백이 포함된 키가 넘어가면 프로바이더 인증이 실패한다.
- **제안**:
  ```ts
  return llmConfigsApi.previewModels({
    provider,
    apiKey: apiKey.trim(),
    baseUrl: baseUrl?.trim() || undefined,
  });
  ```

---

### [INFO] `sanitizeErrorMessage` 폴백 문구가 preview 맥락에 부적합

- **위치**: `llm.service.ts` — `sanitizeErrorMessage()` 폴백 반환값
- **상세**: 매칭되지 않는 에러의 폴백 메시지는 `'Connection test failed. Please check your configuration.'`으로, `testConnection` 맥락을 가정한 문구다. `previewModels`에서 발생하면 사용자에게 "연결 테스트 실패"로 표시되어 혼란을 줄 수 있다.
- **제안**: `previewModels` 전용 폴백 메시지 파라미터를 추가하거나, 폴백 문구를 `'Request failed. Please check your configuration.'`처럼 중립적으로 변경한다.

---

### [INFO] `local` 프로바이더에 `baseUrl` 없을 때 로드 버튼 활성화

- **위치**: `model-combobox.tsx` — `canLoad` useMemo
- **상세**: `local` 프로바이더는 API 키가 없어도 `canLoad = true`가 된다. 그러나 스펙 §B.2에서 "Local: Base URL 필수"라고 명시하므로, `baseUrl`이 비어 있는 상태에서 버튼을 누르면 백엔드에서 팩토리 오류가 발생한다. 기능은 동작하지만 버튼이 조기에 활성화되어 UX상 불필요한 오류를 유발한다.
- **제안**: `provider === 'local'` 일 때 `baseUrl.trim().length > 0` 조건을 추가한다.

---

### [INFO] `preview-models` 엔드포인트에 Rate Limiting 없음

- **위치**: `llm-config.controller.ts` — `previewModels` 핸들러
- **상세**: 외부 프로바이더 API를 직접 호출하는 엔드포인트이므로, 악의적인 반복 호출로 워크스페이스의 API 쿼터를 소진시키거나 비용을 유발할 수 있다. 저장 API와 달리 idempotent하지 않고 매 요청마다 외부 호출이 발생한다.
- **제안**: 사용자 또는 워크스페이스 단위의 rate limit guard 적용을 검토한다.

---

## 요약

`preview-models` 기능 전반의 요구사항 구현은 충실하다. 스펙이 요구하는 생성/수정 플로우 분기, chat 모델 필터링, 캐시 우회, Fallback 자유 입력이 백엔드와 프론트엔드 모두에서 올바르게 구현되어 있다. 다만 **"apiKey는 로그·응답·캐시 어디에도 기록하지 않는다"는 보안 요구사항에 두 곳에서 잠재적 위반이 있다** — 로그에 비정제 프로바이더 에러 메시지가 기록되는 점과 팩토리 에러가 sanitize 없이 응답으로 나가는 점이 그것이다. 입력 데이터 측면에서는 `baseUrl` URL 형식 검증이 저장 DTO 대비 약하며, 프론트엔드에서 `apiKey`/`baseUrl` trim 처리가 일관되지 않아 공백 포함 값이 그대로 전달될 수 있다.

## 위험도

**MEDIUM**