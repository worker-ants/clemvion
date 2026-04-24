## 발견사항

### **[WARNING]** DTO 레벨 SSRF 방어가 스킴 필터링에 한정됨

- **위치**: `preview-llm-models.dto.ts` — `@IsUrl({ require_tld: false, protocols: ['http', 'https'] })`
- **상세**: `http://169.254.169.254/latest/meta-data/`, `http://10.0.0.1/`, `http://192.168.1.1/` 등 사설 IP·클라우드 메타데이터 주소는 스킴이 http이므로 DTO 레벨 검증을 통과한다. RESOLUTION W-1에서 서비스 레이어(`isPrivateHost()`)가 이를 차단하도록 조치되었으나, DTO 자체에는 이 방어가 없어 두 레이어 중 하나가 우회·변경될 경우 단독 방어선이 없다. 또한 `preview-llm-models.dto.spec.ts`에는 내부 IP 차단 케이스 테스트가 없어 DTO 수준의 계약이 문서화되어 있지 않다.
- **제안**: 스펙에서 "DTO는 스킴만 제한, IP 차단은 서비스 레이어" 설계임을 명시하거나, 테스트에 `http://169.254.169.254` 케이스를 추가해 "DTO는 이를 허용하며 서비스 레이어에서 차단됨"을 계약으로 고정한다.

---

### **[WARNING]** `apiKey` 빈 문자열 허용 범위가 스펙과 DTO 간 암묵적으로 분리됨

- **위치**: `preview-llm-models.dto.ts:apiKey` — `@IsString() @MaxLength(500)` (no `@IsNotEmpty()`)
- **상세**: DTO는 `apiKey: ''`을 모든 프로바이더에 허용한다. 실제 거부 (`LLM_CREDENTIALS_REQUIRED`)는 서비스 레이어에서 non-local 프로바이더에 대해 이루어진다. 이로 인해 동일한 "비어 있는 apiKey" 입력이 프로바이더에 따라 서로 다른 HTTP 상태 코드(DTO 검증 실패 → 422 vs 서비스 거부 → 400)로 반환된다. `@ApiProperty` description에는 이 규칙("local 외 프로바이더는 빈 값 불가, 단 400 반환")이 명시되어 있지 않아 API 소비자가 Swagger만으로는 동작을 예측할 수 없다.
- **제안**: `@ApiProperty.description`에 "local 프로바이더 이외에는 서비스 레이어에서 빈 값을 거부하며 400으로 반환됩니다"를 추가한다. 또는 커스텀 validator로 DTO 레벨에서 일관되게 처리한다.

---

### **[INFO]** `previewModels` non-envelope 폴백 테스트 — 요건 충족 확인

- **위치**: `llm-configs.test.ts` — `previewModels describe` 내 `"falls back to the body itself when not enveloped"` 케이스
- **상세**: Batch 2 리뷰(requirement/review.md W-2)에서 `previewModels`의 non-envelope 폴백 케이스가 누락됨을 지적하였으나, 현 코드에서 해당 테스트가 존재한다. `listModels`와 동일한 두 케이스(enveloped + direct array)가 계약으로 고정되어 있다.
- **제안**: 없음. 요건 충족.

---

### **[INFO]** 컨트롤러 스펙의 `clearClientCache` 부정 단언이 "preview는 캐시하지 않는다" 요건을 명시적으로 검증

- **위치**: `llm-config.controller.spec.ts:53` — `expect(mockLlmService.clearClientCache).not.toHaveBeenCalled()`
- **상세**: `clearClientCache`를 mock에 포함하고 not.toHaveBeenCalled()로 검증하는 패턴은 스펙 §5.5의 "preview는 per-config 캐시에 기록하지 않는다" 요건을 컨트롤러 레이어에서 회귀 방지하는 올바른 접근이다.
- **제안**: 없음. 의도된 요건 검증.

---

### **[INFO]** `ValidateIf` 조건에서 provider가 없을 때 baseUrl 검증 스킵 동작

- **위치**: `preview-llm-models.dto.ts` — `ValidateIf` 람다
- **상세**: `provider: undefined`이고 `baseUrl: undefined`인 페이로드에서 `ValidateIf`가 false를 반환해 baseUrl 검증이 모두 스킵된다. 이 경우 `@IsIn(LLM_PROVIDERS)` 위반으로 provider 필드에서 오류가 발생하므로 전체 DTO는 정상 거부된다. 단 `provider: undefined, apiKey: 'k', baseUrl: ''` 페이로드에서는 `dto.baseUrl !== undefined` → true이므로 `@IsNotEmpty()`가 baseUrl에도 실행되어 두 필드 모두 에러가 발생한다. 동작이 일관되며 문제없다.
- **제안**: 없음.

---

## 요약

RESOLUTION 적용 후 코드는 `preview-models`의 핵심 요구사항 — 생성/수정 플로우 분기, chat 모델 필터링, API Key 비영속화, 조건부 baseUrl 필수화, SSRF 스킴 차단 — 을 전 레이어에서 일관되게 구현하고 있다. 테스트 계약도 DTO 검증, 컨트롤러 위임, API 클라이언트 응답 처리 각 레이어에서 주요 경로를 커버한다. 미결 요건 위험은 두 가지다: DTO가 사설 IP를 차단하지 않아 SSRF 방어의 실질적 책임이 서비스 레이어(`isPrivateHost()`)에 단일 의존하고 있는 점, 그리고 `apiKey` 빈 문자열의 422/400 이중 응답 동작이 API 문서에 기술되지 않아 API 소비자에게 비직관적인 점이다.

## 위험도

**LOW**