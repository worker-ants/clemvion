### 발견사항

- **[WARNING]** `GET /llm-configs/:id/models` 응답 형식 불일치 수정이 기존 소비자에게 영향 가능
  - 위치: `frontend/src/lib/api/llm-configs.ts` `listModels()`
  - 상세: 기존 코드 `return data as ModelInfo[]`는 TransformInterceptor가 씌운 `{ data: ModelInfo[] }`를 그대로 `ModelInfo[]`로 캐스팅했다 — 즉 프론트엔드는 실제로 `{ data: [...] }` 객체를 배열처럼 소비하고 있었음. 수정된 `(data?.data ?? data)` 패턴이 올바르지만, 동일 엔드포인트를 소비하는 다른 클라이언트가 있다면 기존 동작(잘못된 형태)에 의존하고 있을 수 있음
  - 제안: `GET /api/llm-configs/:id/models` 엔드포인트가 실제로 TransformInterceptor를 통과하는지(Swagger 응답 예시 포함) 명시적으로 테스트 추가 및 공식 응답 스키마를 `{ data: ModelInfo[] }`로 문서화

- **[WARNING]** `POST /api/llm-configs/preview-models` 라우트 순서 — 정적 경로 vs. 동적 경로
  - 위치: `llm-config.controller.ts`, `previewModels()` 데코레이터 위치
  - 상세: NestJS는 정적 세그먼트(`preview-models`)를 동적 파라미터(`:id`)보다 우선하지만, 이 보장은 동일 HTTP 메서드 내에서만 성립. `POST preview-models`가 `POST :id/test` 앞에 선언되어 있으므로 현재는 안전하나, 향후 `POST :id/...` 패턴 라우트가 추가될 경우 순서가 틀어질 위험이 있음
  - 제안: 컨트롤러 상단에 `// NOTE: 정적 경로(preview-models)는 반드시 :id 기반 라우트 앞에 위치해야 함` 주석 또는 e2e 라우팅 테스트로 고정

- **[WARNING]** `listModels()` 동작 변경 — 하드코딩 목록 → 실시간 Provider API 호출
  - 위치: `anthropic.client.ts`, `google.client.ts`
  - 상세: 기존에 하드코딩 배열(`ANTHROPIC_MODELS`, `GOOGLE_MODELS`)을 반환하던 `listModels()`가 이제 외부 네트워크 호출로 변경됨. 기존 소비자(`GET /api/llm-configs/:id/models`)는 항상 성공을 가정할 수 있었으나, 이제 Provider API 장애·네트워크 오류 시 500 → 해당 엔드포인트도 실패 가능. Anthropic 쪽은 에러 핸들링 없이 `for await`로 직접 호출
  - 제안: `GET /api/llm-configs/:id/models` 엔드포인트에도 `previewModels`와 동일한 에러 sanitize 및 timeout 적용 검토

- **[INFO]** `POST /api/llm-configs/preview-models` — DTO와 서비스 레이어의 이중 유효성 검증 불일치
  - 위치: `preview-llm-models.dto.ts` vs. `llm.service.ts:previewModels()`
  - 상세: `apiKey`는 DTO에서 `@IsString()`(빈 문자열 허용)이지만, 서비스에서 non-local 프로바이더에 대해 빈 문자열을 `LLM_CREDENTIALS_REQUIRED`로 거부함. DTO 레벨에서 잡히지 않아 422 대신 400으로 반환됨. 의도적 설계라면 허용되지만 OpenAPI 스키마에 명확히 기술 필요
  - 제안: Swagger `@ApiProperty`의 `description`에 "local 프로바이더 이외에는 빈 문자열 불가" 명시하거나, custom validator로 DTO에서 함께 처리

- **[INFO]** `previewModels` — workspace 컨텍스트 없이 외부 API 호출
  - 위치: `llm-config.controller.ts:previewModels()`, `llm.service.ts:previewModels()`
  - 상세: 저장된 리소스를 조회하지 않으므로 workspace 격리가 불필요한 설계이며 의도적. 단, 감사 로그 또는 abuse 추적 시 어떤 workspace/user가 호출했는지 식별 수단이 없음. Rate limit(`10/60s`)만으로 충분한지 검토 필요
  - 제안: `@Throttle` 설정은 적절. 운영 모니터링을 위해 `this.logger.log`에 `userId`/`workspaceId` 포함 고려

- **[INFO]** `spec/2-navigation/6-config.md` API 표에 `preview-models` 라우트 추가 — 문서·구현 일치
  - 위치: `spec/2-navigation/6-config.md:154`
  - 상세: 신규 엔드포인트가 spec에 정확히 반영되어 있고, `spec/5-system/7-llm-client.md` §5.5에 동작 명세까지 기술됨. 하위 호환성 영향 없음

---

### 요약

이번 변경의 핵심 API 계약 이벤트는 `POST /api/llm-configs/preview-models` 신규 엔드포인트 추가다. 인증(`editor` 권한), Rate limiting(10/60s), 30초 타임아웃, SSRF 방어(`IsUrl` http/https만 허용), 에러 sanitize(API 키 미노출) 등 보안 설계는 양호하다. 다만 기존 `GET /llm-configs/:id/models`의 응답 포맷 버그 수정이 기존 소비자에게 영향을 줄 수 있고, `listModels()`의 실시간 API 호출 전환으로 해당 엔드포인트가 외부 장애에 노출되었으나 에러 핸들링이 보강되지 않은 점이 주요 위험 요소다.

### 위험도
**LOW**