## 발견사항

### **[WARNING]** `PreviewLlmModelsDto.baseUrl` — SSRF 방어가 스킴 수준에만 국한됨
- **위치**: `preview-llm-models.dto.ts:47` `@IsUrl({ require_tld: false, protocols: ['http', 'https'] })`
- **상세**: `file://`, `gopher://` 스킴은 차단되지만 `http://169.254.169.254/latest/meta-data/`, `http://10.0.0.1/` 같은 사설 IP 대역은 유효한 `http` URL로 통과함. `local` 프로바이더가 `http://localhost:11434` 를 필요로 하는 한 `require_tld: false` + localhost 허용과 사설 IP 차단을 동시에 해결하는 서비스 레이어 IP allowlist/blocklist가 없으면 SSRF 경로가 잔존함. RESOLUTION.md W-1이 "스킴 차단"으로 조치 완료를 기재했으나 IP 레이어 방어는 미포함.
- **제안**: 서비스 레이어에서 `provider !== 'local'` 일 때 `parsed.hostname`이 루프백/링크로컬/사설 대역인지 검증하는 guard 추가.

### **[WARNING]** `apiKey` 빈 문자열 허용 범위가 DTO·서비스 레이어 간 분산됨
- **위치**: `preview-llm-models.dto.ts:29-32` (`@IsString()` + `@MaxLength(500)`만 선언)
- **상세**: DTO는 모든 프로바이더에 대해 `apiKey: ''` 를 허용하고, 비로컬 프로바이더에서 빈 apiKey를 거부하는 로직은 서비스 레이어에 있음. Swagger 문서의 `@ApiProperty.description`에 "local 프로바이더는 빈 문자열 허용"이 표기되어 있으나, 역으로 "비로컬은 빈 문자열 불가"가 명시되지 않아 API 소비자가 400 응답 원인을 파악하기 어려움.
- **제안**: `@ApiProperty.description`에 "local 이외의 프로바이더는 서비스 레이어에서 빈 값을 거부함 (`LLM_CREDENTIALS_REQUIRED`, 400)" 추가.

### **[INFO]** `ValidateIf` + `@IsString()` 조합 시 `undefined` 에서 에러 메시지 3중 노출
- **위치**: `preview-llm-models.dto.ts:40-50`
- **상세**: azure/local 프로바이더에서 `baseUrl`을 전송하지 않으면 `@IsString()` ("must be a string"), `@IsNotEmpty()` ("baseUrl is required for azure and local providers"), `@IsUrl()` ("must be a URL address") 세 에러가 동시에 반환됨. `@IsNotEmpty` 메시지만 의미 있고 나머지는 혼란을 가중함.
- **제안**: `@IsNotEmpty` 하나만 남기고 `@IsString()`, `@IsUrl()`을 `@IsString()` + `@IsNotEmpty()` → `@IsUrl()` 순서로 유지하되, 서버 응답을 클라이언트에서 첫 번째 메시지만 표시하도록 정렬하거나, `@IsString`을 제거하고 `@IsUrl`이 형식을 담당하게 할 것.

### **[INFO]** `model-combobox.tsx` — `useSavedConfig && configId` 이중 검사
- **위치**: `model-combobox.tsx:65`
- **상세**: `useSavedConfig = Boolean(configId) && !trimmedKey`로 이미 `configId` 존재가 보장되므로 `if (useSavedConfig && configId)` 의 `&& configId` 는 항상 참. 의미 없는 재검사가 조건 분기 로직의 단일 진입점을 희석하고, 추후 `useSavedConfig` 정의가 변경될 때 불일치 위험이 생김.
- **제안**: `if (useSavedConfig)` 로 단순화.

### **[INFO]** `model-combobox.tsx` — `onSuccess`에서 `setErrorMessage(null)` 중복 호출
- **위치**: `model-combobox.tsx:57-62`
- **상세**: `onMutate`에서 이미 `setErrorMessage(null)`을 호출하므로, `onSuccess`에서 재호출하는 것은 정상 응답 경로에서 불필요한 추가 렌더를 유발함. 기능상 문제는 없으나 설계 의도가 불명확해짐.
- **제안**: `onSuccess`의 `setErrorMessage(null)` 제거.

### **[INFO]** `llm-configs.test.ts` — `afterEach(vi.restoreAllMocks)` 효과 없음
- **위치**: `llm-configs.test.ts:12-14`
- **상세**: `vi.mock('../client', ...)` 으로 모듈을 완전 교체했으므로 `restoreAllMocks`는 spy 원본 복원 대상이 없어 실질적으로 효과가 없음. `beforeEach(vi.clearAllMocks)` 만으로 충분하며 `afterEach`는 독자에게 잘못된 기대를 심어줌.
- **제안**: `afterEach(vi.restoreAllMocks)` 제거.

---

## 요약

`PreviewLlmModelsDto`·`ModelCombobox`·API 클라이언트 테스트 전반에서 스펙의 핵심 요구사항(생성/수정 플로우 분기, chat 타입 필터링, baseUrl azure/local 필수, local 빈 apiKey 허용, trim 처리, 에러 표시)이 올바르게 구현되어 있다. 요구사항 관점의 주요 미결 사항은 단 하나로, SSRF 방어가 HTTP 스킴 제한에 그쳐 사설 IP 대역으로의 서버 측 요청이 차단되지 않는 점이다. 나머지 지적 사항은 모두 DTO·서비스 레이어 간 검증 책임 분산으로 인한 문서화 공백과 코드 가독성 이슈이며 기능 정확성에는 영향이 없다.

## 위험도
**LOW**