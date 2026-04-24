# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — SSRF 취약점, Google SDK 마이그레이션으로 인한 Knowledge Base 임베딩 정합성 위험, `listModels()` 라이브 API 전환에 따른 에러 처리 공백이 주요 위험 요인

---

## Critical 발견사항

없음

---

## 경고 (HIGH → WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **보안** | **SSRF via `baseUrl`**: `@IsUrl({ require_tld: false })`가 `http://169.254.169.254`, `http://10.0.0.1` 등 내부 IP를 차단하지 않아 editor 권한 사용자가 클라우드 메타데이터·내부망에 서버발 요청 가능 | `preview-llm-models.dto.ts` | 서비스 레이어에서 사설 IP 대역 필터링 추가. `local` 프로바이더에만 localhost 허용하는 조건 분기 필요 |
| 2 | **부작용** | **Google `embed()` N회 순차 → 1회 배치 호출**: 신 SDK의 `contents: texts` 배치 지원 여부 및 응답 순서 보장이 검증되지 않음. Knowledge Base 벡터 저장 전체에 영향 | `google.client.ts`, `embed()` | SDK 문서에서 배치 지원·순서 보장 확인. `texts.length === result.length` 어서션 테스트 추가 |
| 3 | **부작용/요구사항** | **스트리밍 usage 메타데이터 fallback 제거**: 구 SDK의 `result.response` 재조회 경로가 삭제되어 일부 Gemini 모델에서 `totalTokens === 0` 이 조용히 발생 가능. 과금 추적·컨텍스트 관리 영향 | `google.client.ts`, `stream()` | 신 SDK 스트림 청크에 항상 usageMetadata가 포함되는지 실측 검증. 불확실하면 fallback 복원 또는 0일 때 경고 로그 |
| 4 | **동시성/성능** | **`withTimeout`이 타임아웃 후 원본 HTTP 요청을 취소하지 않음**: `Promise.race` 패턴 특성상 타임아웃 발생 시에도 `client.listModels()`가 백그라운드에서 계속 실행되어 소켓 누수 가능 | `llm.service.ts`, `withTimeout()` | `AbortController` 생성 후 `LLMClient.listModels(signal?)` 시그니처로 signal 전파 |
| 5 | **보안** | **factory 에러 로그에 apiKey 포함 가능**: `this.logger.warn(\`LLM preview client init failed: ${raw}\`)` 에서 일부 SDK(Azure 등)가 초기화 실패 시 입력값을 에러 메시지에 포함 가능 | `llm.service.ts`, `previewModels()` 첫 번째 catch | factory 에러도 `sanitizeErrorMessage()` 통과 후 로깅 |
| 6 | **API 계약** | **`listModels()` 라이브 API 전환 후 기존 엔드포인트 에러 처리 공백**: `GET /llm-configs/:id/models`도 이제 네트워크 장애·401 시 에러가 발생하나 `previewModels`와 달리 sanitize·timeout 없음 | `anthropic.client.ts:132`, `google.client.ts:490` | 해당 엔드포인트에도 에러 sanitize·타임아웃 적용 |
| 7 | **의존성** | **`@google/genai` 스트림 반환 타입을 `AsyncIterable<unknown>`으로 강제 캐스팅**: SDK 타입과 런타임 실제 타입 불일치 가능성 | `google.client.ts` | SDK 내부 청크 타입 명시적 import 또는 캐스팅 근거 주석 추가 |
| 8 | **의존성** | **구 패키지 `@google/generative-ai` 제거 여부 확인 불가**: `pnpm-lock.yaml` diff 미포함으로 두 SDK 공존 여부 검증 불가 | `backend/package.json`, `pnpm-lock.yaml` | `pnpm list @google/generative-ai @google/genai` 실행으로 공존 여부 확인 |
| 9 | **요구사항** | **Azure 프로바이더 `baseUrl` 필수 검증이 DTO 레벨 누락**: 스펙 명시와 달리 `@IsOptional()`로 처리되어 factory 예외로만 거부됨 | `preview-llm-models.dto.ts` | `provider === 'azure'` 조건부 validator 추가 또는 spec 테스트 케이스 추가 |
| 10 | **의존성/부작용** | **`ThrottlerModule` 전역 등록 여부 미확인**: 미등록 시 `@Throttle` 데코레이터가 silent fail되어 Rate Limit 없이 엔드포인트 노출 | `llm-config.controller.ts`, `AppModule` | `AppModule`에 `ThrottlerModule.forRoot()` 및 `ThrottlerGuard` 등록 확인 |
| 11 | **테스트** | **`listModels()` 에러 경로 미테스트 (Anthropic/Google)**: 라이브 API 전환 후 401·네트워크 오류 케이스 테스트 없음 | `anthropic.client.spec.ts`, `google.client.spec.ts` | API 실패 케이스 단위 테스트 추가 |
| 12 | **보안** | **`JSON.parse(preview.credentials)` try/catch 없음**: 손상된 자격증명 문자열 입력 시 unhandled 500 발생 | `integration-oauth.service.ts:303` | try/catch 추가 후 `BadRequestException` throw |
| 13 | **문서화/유지보수** | **Gemini 비자명 동작 주석 대거 삭제**: 빈 ObjectSchema 거부, functionResponse role 규칙, responseMimeType 제약 등 SDK 문서에 없는 핵심 제약 설명이 삭제되어 향후 동일 버그 재발 위험 | `google.client.ts`, `sanitizeGeminiSchema`, `buildContents` | 비자명한 외부 API 제약(에러 코드 포함) 주석 복원 |
| 14 | **범위** | **기능 무관 파일 23개 이상에 타입 단언 일괄 정리 혼재**: execution-engine, ai-agent, condition-eval 등 소스 파일까지 포함되어 회귀 추적 어려움 | 다수 spec.ts, `execution-engine.service.ts`, `ai-agent.handler.ts`, `condition-eval.util.ts` | 타입 정리 작업 별도 PR로 분리 권장 |
| 15 | **부작용** | **`sanitizeErrorMessage` 메서드 존재 여부 미확인**: diff에 없음. 미존재 시 런타임 `TypeError` | `llm.service.ts` | `llm.service.ts` 전체에서 메서드 존재 확인 |
| 16 | **API 계약** | **`listModels` 응답 언래핑 수정이 기존 소비자에 영향 가능**: 구 코드는 `{ data: [...] }`를 `ModelInfo[]`로 잘못 캐스팅하고 있었으며, 수정 후 기존 소비 코드가 이중 언래핑을 하고 있을 수 있음 | `frontend/src/lib/api/llm-configs.ts` | 호출 사이트 전체 점검 및 TransformInterceptor 적용 범위 명시 |
| 17 | **테스트** | **`ModelCombobox` 컴포넌트 테스트·리뷰 누락**: `chat` 타입 필터링, 수정 플로우 `configId` 분기 등 핵심 UX 요구사항 검증 불가 | `frontend/src/components/llm-config/model-combobox` | 컴포넌트 spec 파일 작성 (previewModels 호출, 로딩/에러/fallback 케이스 포함) |
| 18 | **성능** | **Google `listModels()` 페이지네이션 상한 없음**: 모델 수 증가 시 페이지 수만큼 HTTP 요청 발생, 응답 시간 선형 증가 | `google.client.ts:491~507` | 최대 항목 수 제한(예: 100개) 또는 SDK `pageSize` 파라미터 사용 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `listModels()` 결과 캐싱 없음: 동일 자격증명 반복 조회 시 매번 외부 API 호출. Throttle로 남용 제한 중이나 불필요한 API 비용 발생 | `anthropic.client.ts`, `google.client.ts` | TTL 60s 단기 메모리 캐시 추가. 키는 `hash(provider+apiKey+baseUrl)` |
| 2 | 유지보수 | `buildGenerationConfig` 반환 타입 `Record<string, unknown>`: SDK 타입 안전성 소실 | `google.client.ts` | `GenerateContentConfig` 인터페이스 또는 로컬 타입 정의 사용 |
| 3 | 유지보수 | 스트림 루프 내 익명 타입 캐스트: `chat()`·`stream()` 양쪽에서 동일한 익명 타입 | `google.client.ts`, `stream()` | `GoogleStreamChunk` 모듈 레벨 인터페이스로 추출 |
| 4 | 테스트 | `embed()` 배치 처리 변경에 대한 회귀 테스트 없음 | `google.client.spec.ts` | 입력·출력 배열 길이 일치, `embeddings: undefined` 처리 테스트 추가 |
| 5 | 테스트 | `sanitizeErrorMessage` 미인식 패턴(일반 에러) 처리 방식 미테스트 | `llm.service.spec.ts` | 인식 불가 에러에서 원문이 노출되지 않는지 테스트 추가 |
| 6 | 아키텍처 | 프론트엔드 응답 언래핑 `data?.data ?? data` 패턴 중복: TransformInterceptor 적용 범위 불일치를 시사 | `frontend/src/lib/api/llm-configs.ts` | 통일된 unwrapping 유틸리티 또는 인터셉터 적용 범위 명확화 |
| 7 | 아키텍처 | NestJS 라우트 순서 의존성: 현재 순서는 올바르나 향후 `POST :id/...` 추가 시 `preview-models`가 `:id`로 캡처될 위험 | `llm-config.controller.ts` | 라우트 순서 주석 명시 또는 `/-/preview-models` prefix 사용 |
| 8 | 보안 | `testConnection()`이 실제 LLM 추론 호출 (Google): 연결 확인 목적 대비 비용 과다 | `google.client.ts`, `testConnection()` | `listModels()` 등 비용 낮은 API로 대체 검토 |
| 9 | 문서화 | MDX 문서 EN/KO 수정 플로우 설명 불일치: 영문본에 수정 플로우(`configId` fallback) 누락 | `llm-config.en.mdx` | 수정 플로우 설명 영문본에 추가 |
| 10 | 개선 (긍정) | `as unknown as T` / `as any` / `as never` 일괄 제거: 타입 시스템이 실제 타입을 추론하도록 개선 | 테스트 파일 전반 | 별도 조치 불필요 |
| 11 | 개선 (긍정) | `embed()` N회 → 1회 배치 호출: 왕복 횟수 N→1 성능 향상 (단, #2 WARNING 선결 조건) | `google.client.ts` | — |
| 12 | 개선 (긍정) | Jest `transformIgnorePatterns` pnpm 중첩 경로 대응: ESM 패키지 transform 누락 방지 | `backend/package.json:124` | 별도 조치 불필요 |
| 13 | 개선 (긍정) | `previewModels` 단위 테스트 커버리지 양호: 정상·에러·타임아웃·sanitize 케이스 망라 | `llm.service.spec.ts` | — |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | **MEDIUM** | SSRF via baseUrl (editor 권한으로 완화), factory 에러 로그 apiKey 노출 가능 |
| Side Effect | **MEDIUM** | Google embed() 배치 전환·usage fallback 제거 → Knowledge Base·과금 추적 영향 |
| Requirement | **MEDIUM** | ModelCombobox 리뷰 누락, sanitizeErrorMessage 실효성 미검증, Azure baseUrl 필수 검증 누락 |
| Testing | **MEDIUM** | listModels 에러 경로·ModelCombobox·embed 배치 변경 테스트 없음 |
| Dependency | **MEDIUM** | Google SDK 메이저 교체, 구 패키지 공존 여부 미확인, usage fallback 제거 |
| Concurrency | **LOW** | withTimeout 소켓 누수 가능성 |
| Performance | **LOW** | listModels 캐싱 없음, Google pager 상한 없음 |
| Architecture | **LOW** | 전반적으로 레이어 분리·패턴 준수 양호 |
| Maintainability | **LOW** | Gemini 주석 삭제, buildGenerationConfig 타입 약화 |
| Documentation | **LOW** | Gemini 아키텍처 주석 삭제, MDX EN/KO 불일치 |
| API Contract | **LOW** | listModels 응답 언래핑 수정의 기존 소비자 영향 |
| Scope | **LOW** | 기능 무관 파일 23개 이상 혼재 |
| Database | **NONE** | 타입 캐스트 제거 외 DB 변경 없음 |

---

## 발견 없는 에이전트

- **Database**: 스키마·쿼리·트랜잭션 관련 변경 없음. `outputData` 타입 캐스트 제거만 해당

---

## 권장 조치사항

1. **[즉시] SSRF 방어 강화**: `previewModels` 서비스에 사설 IP 대역 필터링 추가. `local` 프로바이더만 localhost 허용하는 조건 분기 필요 (`preview-llm-models.dto.ts` / `llm.service.ts`)

2. **[즉시] Google embed() 배치 지원 검증**: `@google/genai`에서 `contents: texts[]` 배치 임베딩 지원 여부·응답 순서 보장을 공식 문서 및 실측으로 확인. 미보장 시 순차 호출 복원

3. **[즉시] 스트리밍 usage fallback 검증**: 신 SDK에서 모든 Gemini 모델이 스트림 청크에 `usageMetadata`를 포함하는지 실측. 미포함 케이스 발견 시 fallback 복원

4. **[단기] `withTimeout` AbortController 적용**: `LLMClient.listModels(signal?)` 인터페이스 추가 후 타임아웃 발생 시 HTTP 소켓 조기 종료

5. **[단기] factory 에러 sanitize**: `previewModels` 첫 번째 catch의 factory 에러도 `sanitizeErrorMessage()` 적용

6. **[단기] ThrottlerModule 등록 확인**: `AppModule`에 `ThrottlerModule.forRoot()` 및 전역 `ThrottlerGuard` 등록 여부 확인. Rate Limit 실제 동작 여부 e2e 테스트

7. **[단기] `GET /llm-configs/:id/models` 에러 처리**: 라이브 API 전환 후 해당 엔드포인트에도 에러 sanitize·타임아웃 적용

8. **[단기] ModelCombobox 테스트 작성**: `chat` 타입 필터링, `configId` 유무 분기, 에러 폴백(자유 입력) 케이스 포함

9. **[중기] Gemini 비자명 주석 복원**: 빈 ObjectSchema 거부, functionResponse role 규칙 등 SDK 문서에 없는 제약 설명 복원

10. **[중기] 타입 정리 PR 분리**: 기능 무관 `as unknown as T` 일괄 제거를 별도 커밋/PR로 분리하여 이력 명확화