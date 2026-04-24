파일 쓰기 권한이 필요합니다. 아래가 통합 보고서 전문입니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `baseUrl` SSRF 취약점과 외부 API 호출 경로의 Rate Limiting·Timeout 부재가 주요 위험. 나머지는 LOW 수준의 유지보수·타입 안전성 이슈.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `preview-models` 엔드포인트에 Rate Limiting 없음. 외부 LLM Provider API를 매 호출마다 직접 프록시하므로, 인증된 사용자의 반복 호출만으로 Provider API 쿼터 소진 및 서버 커넥션 고갈 가능 | `llm-config.controller.ts` `@Post('preview-models')` | `@Throttle({ default: { limit: 10, ttl: 60000 } })` 데코레이터 적용 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | **SSRF via 미검증 `baseUrl`**: `@IsString()` + `@MaxLength(500)`만 적용되어 URL 형식·스킴 검증 없음. `editor` 권한 사용자가 `http://169.254.169.254/...` 등 내부 주소를 전달하면 서버가 해당 엔드포인트에 HTTP 요청 발신 | `preview-llm-models.dto.ts` `baseUrl` 필드 | `@IsUrl({ require_tld: false, protocols: ['http', 'https'] })` 추가 |
| 2 | Security | **팩토리 에러 메시지 미sanitize 노출**: `clientFactory.create()` 예외 경로에서 `error.message`를 `sanitizeErrorMessage()` 없이 `BadRequestException.message`에 그대로 반환. `client.listModels()` 경로는 sanitize를 거침 | `llm.service.ts` `previewModels()` 첫 번째 catch | 팩토리 에러도 `sanitizeErrorMessage()` 적용, 또는 `'Invalid provider configuration'` 고정 메시지만 노출 |
| 3 | Security | **원본 에러 메시지를 sanitize 전에 로깅**: raw `message`를 먼저 `logger.warn()`에 기록 후 sanitize. 스펙 §5.4 "apiKey는 로그·응답·캐시 어디에도 기록하지 않는다" 위반 가능 | `llm.service.ts` `previewModels()` 두 번째 catch | `const sanitized = this.sanitizeErrorMessage(message)` 먼저 실행 후 logger와 throw 모두에 `sanitized` 사용 |
| 4 | Performance | **외부 HTTP 호출에 명시적 Timeout 없음**: Provider 응답 지연 시 서버 이벤트 루프 자원 무기한 점유 | `llm.service.ts:220` `return await client.listModels()` | `Promise.race([client.listModels(), timeout(30_000)])` 또는 factory 생성 시 timeout 옵션 전달 |
| 5 | Architecture / API Contract | **`LlmService.previewModels` 파라미터 타입이 `string`으로 넓어짐**: DTO의 `LlmProvider` 유니온을 서비스 레이어가 계승하지 않아, 컨트롤러를 우회한 직접 호출 시 유효하지 않은 provider가 팩토리까지 전달 가능 | `llm.service.ts` `previewModels` 시그니처 | `provider: LlmProvider`로 좁히거나 `PreviewLlmModelsDto` 직접 참조 |
| 6 | Requirement | **프론트엔드에서 `apiKey`·`baseUrl` 미trim 전달**: `canLoad`는 `apiKey.trim()`으로 공백 제거하지만, `previewModels` 호출 시 원본 값이 그대로 전달됨. 공백 포함 키가 Provider 인증 실패로 이어짐 | `model-combobox.tsx` `mutationFn` | `apiKey: apiKey.trim()`, `baseUrl: baseUrl?.trim() \|\| undefined` 로 전달 |
| 7 | Testing | **`sanitizeErrorMessage` 분기가 `previewModels`에서 부분 커버**: 401만 검증, 429·timeout·ECONNREFUSED 등 누락. 두 경로의 예외 처리 방식(throw vs return)이 달라 독립 확인 필요 | `llm.service.spec.ts` `previewModels describe` | 최소 429, timeout 케이스 추가 |
| 8 | Testing | **`configId` + `apiKey` 동시 존재 케이스(수정 플로우 키 재입력) 미검증** | `model-combobox.test.tsx` | `configId="existing-uuid"` + `apiKey="new-key"` → `previewModels` 호출 케이스 추가 |
| 9 | Testing | **`apiKey` 필드 누락(`undefined`)인 경우 DTO 검증 테스트 없음** | `preview-llm-models.dto.spec.ts` | `await expectValidationError({ provider: 'openai' }, 'apiKey')` 케이스 추가 |
| 10 | Documentation | **스펙 §5.4에서 참조하는 에러 코드 3종이 §6 에러 테이블에 미등록**: `LLM_CREDENTIALS_REQUIRED`, `LLM_CONFIG_INVALID`, `LLM_MODEL_LIST_FAILED` | `spec/5-system/7-llm-client.md` §5.4 및 §6 | §6 에러 테이블에 세 코드 추가, 또는 §5.4에 "preview 전용 코드" 명시 |
| 11 | Architecture | **`LlmConfigController`가 `LlmService`에만 의존하는 `previewModels`를 직접 보유**: `previewModels`는 `LlmConfigService`를 전혀 사용하지 않아 컨트롤러가 두 모듈의 오케스트레이터 역할을 계속 떠안는 구조 고착화 | `llm-config.controller.ts` | `previewModels`를 `LlmController`(llm 모듈)로 이동하거나 `LlmConfigService`에 위임 메서드 추가 |
| 12 | Maintainability | **API 응답 언래핑 패턴 불일치**: `listModels`·`previewModels`는 `data?.data ?? data`, `testConnection`은 `data.data`로 혼재 | `llm-configs.ts:72,80` | axios 인터셉터 또는 `apiClient` 래퍼에서 unwrapping 중앙화 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | **`local` 프로바이더에서 `baseUrl` 없이 로드 버튼 활성화**: 스펙 §B.2 "Local: Base URL 필수"인데 `baseUrl` 없이도 `canLoad = true`가 되어 불필요한 팩토리 오류 유발 | `model-combobox.tsx` `canLoad` useMemo | `provider === 'local'` 일 때 `baseUrl.trim().length > 0` 조건 추가 |
| 2 | Maintainability | **`'local'` 매직 스트링 프런트·백엔드 분산**: `LLM_PROVIDERS` 상수가 이미 존재함에도 양쪽에 독립 하드코딩 | `llm.service.ts:193`, `model-combobox.tsx:22` | 프론트엔드에도 providers 상수 파일을 두거나 `LlmProvider` 타입 리터럴 상수로 추출 |
| 3 | Concurrency | **props 변경과 응답 도착 타이밍 겹칠 때 stale 모델 목록 렌더 가능성** | `model-combobox.tsx` `loadMutation` onSuccess | `onSuccess`에서 응답 시점의 `provider`/`apiKey`를 클로저로 캡처해 현재 props와 비교하는 가드 추가 |
| 4 | Architecture | **`ModelCombobox` 상태 이중 관리**: `useState<ModelInfo[]>`와 `useMutation.data`가 같은 정보를 중복 관리하여 렌더 사이클 내 일시적 불일치 가능 | `model-combobox.tsx:27-31` | `loadMutation.data`를 직접 파생하고 local state 제거. `chatModels`는 `useMemo`로 처리 |
| 5 | Dependency | **`model-combobox.tsx`에서 `axios` 직접 임포트**: UI 컴포넌트가 HTTP 클라이언트 구현에 직접 결합됨 | `model-combobox.tsx` 상단 임포트 | API 레이어에서 에러 정규화 후 throw하거나 `isApiError` 유틸리티 export해 사용 |
| 6 | Documentation | **`ModelComboboxProps`의 `configId`/`apiKey` 분기 로직 미문서화**: 인터페이스 레벨 JSDoc 없어 신규 사용자가 오용 가능 | `model-combobox.tsx` `ModelComboboxProps` | `configId`·`apiKey` prop에 JSDoc 추가 |
| 7 | Documentation | **테스트에서 Korean 로케일 묵시적 가정**: `/모델 불러오기/`로 버튼 쿼리, English 반환 환경에서 테스트 전체 실패 가능 | `model-combobox.test.tsx:24` | 테스트 상단 로케일 주석 추가 또는 `data-testid` 병행 사용 |
| 8 | Requirement | **`sanitizeErrorMessage` 폴백 문구가 `testConnection` 맥락**: "Connection test failed..." 메시지가 `previewModels` 맥락에서 노출되어 혼란 | `llm.service.ts` `sanitizeErrorMessage()` 폴백 | `'Request failed. Please check your configuration.'`처럼 중립적으로 변경 |
| 9 | Scope | **서비스 메서드의 과도한 주석**: 프로젝트 컨벤션(CLAUDE.md) 다중 줄 주석 블록 금지 | `llm.service.ts:178-183` JSDoc | 보안 의도 한 줄만 잔존: `// API Key는 이 스코프 밖으로 기록되지 않음` |
| 10 | API Contract | **정적 라우트가 동적 라우트 뒤에 등록**: NestJS 권장 패턴 어긋남(실제 충돌은 없음) | `llm-config.controller.ts:167` | `@Post('preview-models')`를 `:id/test` 앞으로 이동 |
| 11 | Architecture | **`previewModels`에 `@WorkspaceId()` 컨텍스트 부재**: 현재 stateless이므로 무해하나, 향후 감사 로그·워크스페이스별 비용 추적 도입 시 일관성 깨짐 | `llm-config.controller.ts:186` | 파라미터 예비 확보 고려 |
| 12 | Testing | **`listModels` 응답 언래핑 수정에 대한 단위 테스트 없음**: 버그 픽스인데 API 클라이언트 레이어 자체 테스트 없어 회귀 감지 불가 | `llm-configs.ts` `listModels` | API 클라이언트 함수 단위 테스트 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | MEDIUM | SSRF via `baseUrl`, 팩토리 에러 미sanitize, 로그에 원본 에러 기록 |
| Performance | MEDIUM | Rate Limiting·Timeout 미적용으로 외부 API 쿼터 소진·서버 자원 점유 위험 |
| Requirement | MEDIUM | API Key 로그 기록 보안 요건 위반 가능성, `baseUrl` 미trim 전달, URL 검증 누락 |
| Architecture | LOW | 서비스 파라미터 타입 확장, 크로스모듈 결합 고착화, `ModelCombobox` 상태 이중 관리 |
| Maintainability | LOW | `'local'` 매직 스트링 분산, 응답 언래핑 패턴 불일치 |
| Testing | LOW | `previewModels` 에러 sanitize 부분 커버리지, `configId+apiKey` 동시 케이스 미검증 |
| Documentation | LOW | 스펙 §6 에러 코드 3종 누락, `ModelComboboxProps` 분기 로직 미문서화 |
| API Contract | LOW | 팩토리 에러 미sanitize, 응답 언래핑 불일치, 서비스 파라미터 타입 |
| Concurrency | LOW | stale response 이론적 가능성(실제 빈도 낮음), `createClient` check-then-set은 안전 |
| Side Effect | LOW | `WorkspaceId` 격리 부재(stateless이므로 무해), 팩토리 에러 partial sanitize |
| Scope | LOW | `listModels` 응답 언래핑 수정(기능 외 기존 코드 수정), 과도한 서비스 주석 |
| Dependency | LOW | `axios` 직접 임포트로 HTTP 클라이언트 구현 결합 |
| Database | NONE | DB 접점 없는 순수 pass-through 기능, 검토 사항 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 이유 |
|----------|------|
| Database | 변경 전체가 DB와 접점 없음. 스키마 변경·마이그레이션·쿼리·트랜잭션 없음 |

---

## 권장 조치사항

1. **[즉시] `baseUrl` URL 형식 검증 추가** (`preview-llm-models.dto.ts`): `@IsUrl({ require_tld: false, protocols: ['http', 'https'] })` — SSRF 공격 벡터 차단
2. **[즉시] 로그와 응답의 에러 sanitize 통일** (`llm.service.ts` `previewModels()`): `sanitizeErrorMessage()` 먼저 실행 후 logger와 BadRequestException 모두에 적용. 팩토리 에러 경로도 동일하게 처리
3. **[즉시] `preview-models` 엔드포인트 Rate Limiting 적용** (`llm-config.controller.ts`): `@Throttle({ default: { limit: 10, ttl: 60000 } })` 데코레이터 추가
4. **[단기] 외부 HTTP 호출 Timeout 적용** (`llm.service.ts`): `client.listModels()` 호출에 30초 타임아웃 설정
5. **[단기] 프론트엔드 `apiKey`·`baseUrl` trim 통일** (`model-combobox.tsx`): `mutationFn`에서 trim된 값으로 전달
6. **[단기] `LlmService.previewModels` 파라미터 타입 좁히기** (`llm.service.ts`): `provider: LlmProvider`로 변경
7. **[단기] 스펙 §6 에러 테이블에 preview 전용 코드 3종 추가** (`spec/5-system/7-llm-client.md`)
8. **[단기] `local` 프로바이더 `canLoad` 조건에 `baseUrl` 필수 추가** (`model-combobox.tsx`)
9. **[중기] API 응답 언래핑 패턴 중앙화**: axios 인터셉터 또는 `apiClient` 래퍼에서 일관화
10. **[중기] 테스트 보완**: `sanitizeErrorMessage` 추가 분기, `configId+apiKey` 동시 케이스, `apiKey` 필드 누락 케이스 추가

---

보고서를 작성했습니다. 파일로 저장하려면 `review/2026-04-23_15-26-28/SUMMARY.md` 쓰기 권한을 허용해 주세요.