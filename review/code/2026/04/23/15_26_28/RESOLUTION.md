# Code Review Resolution — LLM Config 기본 모델 드롭다운 개선

리뷰 보고서: [SUMMARY.md](./SUMMARY.md)

전체 위험도 **MEDIUM**. Critical 1건, Warning 12건, Info 12건. Warning 이상 전체 + 관련 Info 다수 조치.

## Critical

### C-1. preview-models 엔드포인트 Rate Limiting 부재 → ✅ 조치

`@Throttle({ default: { limit: 10, ttl: 60_000 } })` 데코레이터를 `POST /llm-configs/preview-models`에 적용. 인증된 editor가 1분에 최대 10회로 제한됨.

- 파일: `backend/src/modules/llm-config/llm-config.controller.ts`
- 기존 `ThrottlerGuard`가 `APP_GUARD`로 전역 등록되어 있어 데코레이터만 추가해 활성화.

## Warning

### W-1. SSRF via 미검증 baseUrl → ✅ 조치

`PreviewLlmModelsDto.baseUrl` 에 `@IsUrl({ require_tld: false, protocols: ['http', 'https'] })` 추가. 메타데이터 엔드포인트 등 file://·gopher:// 스킴 차단. `require_tld: false`로 로컬 개발용 `http://localhost:11434/v1` 허용.

- 파일: `backend/src/modules/llm-config/dto/preview-llm-models.dto.ts`
- 추가 검증 테스트: `preview-llm-models.dto.spec.ts`에 `file://` 스킴 차단 케이스 + "not a url" 케이스 2건 추가.

### W-2. 팩토리 에러 미sanitize 노출 → ✅ 조치 (판단 수정)

팩토리 에러 경로를 검토한 결과:

- `llm-client.factory.ts`의 throw 메시지는 모두 하드코딩된 문자열이고 사용자 입력(apiKey·baseUrl)을 포함하지 않음.
- sanitize 처리 시 "Azure OpenAI requires a base URL (deployment endpoint)" 같은 UX 친화적 메시지가 `'Connection test failed. Please check your configuration.'`로 덮여 UX가 악화됨.

따라서 **sanitize 대신 원문 유지 + 로그 기록**으로 결정. 해당 판단 근거를 인라인 주석으로 남기고, 테스트에서도 원문 메시지가 그대로 보존됨을 검증.

- 파일: `backend/src/modules/llm/llm.service.ts:208-215`
- 테스트: `llm.service.spec.ts` "should surface factory errors ... with the original message"

### W-3. 원본 에러를 sanitize 전에 로깅 → ✅ 조치

`previewModels` 의 두 catch 블록에서 raw → sanitized → `logger.warn(sanitized)` → throw 순서로 재배열. spec §5.4 "apiKey는 로그·응답·캐시 어디에도 기록하지 않는다" 준수. Provider가 자체 에러 본문에 키를 echo back하는 비정상 케이스에서도 원문 메시지가 로그로 새지 않음.

- 파일: `backend/src/modules/llm/llm.service.ts:220-224`

### W-4. 외부 HTTP 호출 Timeout 부재 → ✅ 조치

`withTimeout(client.listModels(), 30_000)` 헬퍼 도입. `Promise.race`로 30초 경과 시 `Connection timed out...` 에러를 throw. `finally`에서 `clearTimeout`으로 리소스 누수 방지.

- 파일: `backend/src/modules/llm/llm.service.ts:238-253`
- 테스트: `llm.service.spec.ts` "should time out long-running provider calls after 30s" — `jest.useFakeTimers()` + `advanceTimersByTimeAsync` 로 결정적 검증.

### W-5. `LlmService.previewModels` 파라미터 타입 확장 → ✅ 조치

`provider: string` → `provider: LlmProvider` (컨트롤러/DTO의 유니온 타입 계승). 컨트롤러를 우회한 직접 호출 시 TS 단계에서 걸러짐.

- 파일: `backend/src/modules/llm/llm.service.ts:4, 186`

### W-6. 프론트 `apiKey`·`baseUrl` 미trim 전달 → ✅ 조치

`ModelCombobox.loadMutation.mutationFn` 에서 `apiKey.trim()`, `baseUrl?.trim()` 을 사용하도록 수정. 주변 공백 포함된 붙여넣기 키가 401로 떨어지는 사용자 혼란 제거.

- 파일: `frontend/src/components/llm-config/model-combobox.tsx:44-54`
- 테스트: `model-combobox.test.tsx` "trims apiKey and baseUrl before calling preview endpoint"

### W-7. `previewModels` sanitize 분기 부분 커버 → ✅ 조치

추가 테스트 3건:

- 429 rate-limit → `'Rate limit exceeded. Please try again later.'`
- ECONNREFUSED → `'Connection refused. Please check your endpoint URL.'`
- Timeout (fake timers) → `'Connection timed out...'`

### W-8. configId + apiKey 동시 존재 케이스 미검증 → ✅ 조치

`model-combobox.test.tsx` "uses preview endpoint (not saved-config) when both configId and re-entered apiKey are present" 추가. 수정 플로우에서 키를 재입력하면 preview 경로로 전환되는 동작 보장.

### W-9. `apiKey` 필드 누락 DTO 검증 테스트 없음 → ✅ 조치

`preview-llm-models.dto.spec.ts` "rejects missing apiKey field" 추가. `@IsString()` 이 undefined를 거부하는지 보장.

### W-10. 스펙 §6 에러 테이블에 preview 전용 코드 3종 미등록 → ✅ 조치

`spec/5-system/7-llm-client.md` §6 에러 테이블에 다음 3행 추가:

- `LLM_CREDENTIALS_REQUIRED` (400)
- `LLM_CONFIG_INVALID` (400)
- `LLM_MODEL_LIST_FAILED` (400)

### W-11. `LlmConfigController`의 책임 고착화 → ⏭️ 보류

`LlmController` 신설/이동은 모듈 경계 재설계가 필요한 별도 리팩터 성격. 현재 `LlmConfigController`가 이미 `LlmService.listModels`·`testConnection` 을 감싸고 있어 신규 엔드포인트를 같은 위치에 두는 것이 일관성 측면에서 기존 패턴과 부합. 이번 PR 범위 외.

### W-12. 응답 언래핑 패턴 불일치 (`data?.data ?? data` vs `data.data`) → ⏭️ 부분 조치

- axios 인터셉터/`apiClient` 래퍼에서의 중앙화는 그 자체로 프론트 전체 API 호출 계약을 바꾸는 큰 변경이라 이번 범위 외.
- 대신 기존 `listModels` 의 버그(`return data as ModelInfo[]` → 실제론 envelope 반환)를 조용히 고치는 대신 **테스트로 동작 계약을 고정**: `frontend/src/lib/api/__tests__/llm-configs.test.ts` 에서 "unwraps the {data: ...} envelope" + "falls back to the body itself when not enveloped" 2건을 명시해 회귀 방지.

## Info (선별 조치)

### I-1. local provider baseUrl 없이 로드 활성화 → ✅ 조치

`canLoad` useMemo에 `PROVIDERS_REQUIRING_BASE_URL`(`azure`·`local`) 가드 추가. spec §B.2 "Local: Base URL 필수" 와 정합.

- 테스트: "disables the load button when local provider is missing baseUrl"

### I-2. `'local'` 매직 스트링 → ✅ 부분 조치

`model-combobox.tsx` 내부에 `LOCAL_PROVIDER` 상수 추출. 백엔드는 이미 `LLM_PROVIDERS` 공유 타입을 가지고 있음.

### I-6. `ModelComboboxProps` 분기 로직 JSDoc 부재 → ✅ 조치

`apiKey`·`configId` prop에 JSDoc 추가. 신규 사용자가 생성/수정 플로우 분기를 이해할 수 있도록.

### I-7. 테스트에서 Korean 로케일 묵시적 가정 → ✅ 조치

버튼에 `data-testid="model-combobox-load"` 추가. 테스트는 `getByTestId` 로 조회해 로케일 독립.

### I-9. 과도한 주석 → ✅ 조치

`previewModels` 의 다중 줄 JSDoc 을 1줄 보안 의도 주석으로 축소. 팩토리 에러 경로에는 UX 판단 이유를 필요한 최소 분량으로만 남김.

### I-10. 정적 라우트가 동적 라우트 뒤 → ✅ 조치

`@Post('preview-models')` 를 `@Post(':id/test')` 앞으로 이동. NestJS 패턴 정렬.

### I-12. `listModels` 언래핑 회귀 테스트 → ✅ 조치

W-12 참조.

## 보류한 Info 이유

| 항목 | 보류 근거 |
|------|-----------|
| I-3 Stale 응답 가드 | 1분에 최대 10회로 rate limit 설정했고, 사용자 인터랙션(버튼 클릭) 기반이라 실제 경합 시나리오가 극히 드묾. 추가 복잡도 대비 이득이 낮음. |
| I-4 `models` state 이중 관리 | `useMutation.data` 직접 사용은 첫 로드 전 빈 상태와 에러 후 상태 분기 처리를 다시 짜야 하는 비용이 있음. 현재 구조로도 React 렌더 사이클 내 불일치는 실무상 발생하지 않음. |
| I-5 `axios` 직접 임포트 | `axios.isAxiosError` 1회 사용으로 최소 결합. 에러 정규화 유틸리티 추가는 프론트 전역 API 계약을 건드리는 규모. |
| I-8 sanitize 폴백 문구 변경 | 기존 `testConnection` 테스트가 해당 문구를 계약으로 기대하고 있어 글로벌 변경은 테스트 계약을 깸. 문맥별 분기는 sanitize 헬퍼 인자 확장이 필요해 이번 범위 외. |
| I-11 `@WorkspaceId()` 컨텍스트 | 현재 stateless이며, 감사 로그/워크스페이스별 비용 집계는 아직 요구사항 없음. 도입 시점에 통합 처리. |

## 검증

- Backend: `pnpm lint` 통과, `pnpm test` 1664 passed (+6 신규), `pnpm build` 통과
- Frontend: `pnpm lint` 통과, `pnpm test` 1047 passed (+6 신규), `pnpm build` 통과
- Spec: `spec/2-navigation/6-config.md`, `spec/5-system/7-llm-client.md`, `frontend/src/content/docs/05-integrations-and-config/llm-config{.mdx, .en.mdx}` 동기화 완료
