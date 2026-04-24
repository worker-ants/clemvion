## 발견사항

---

### `preview-llm-models.dto.spec.ts`

**[WARNING]** SSRF 방어 검증이 스킴 레벨에 국한됨 — 내부 IP 테스트 부재
- **위치**: baseUrl 관련 케이스 전체
- **상세**: `file:///etc/passwd` (비http 스킴)와 `'not a url'` (URL 형식 오류)는 테스트하지만, `http://169.254.169.254/latest/meta-data/`, `http://192.168.1.1/`, `http://10.0.0.5/` 같은 내부 망 주소는 테스트하지 않는다. `@IsUrl({ protocols: ['http', 'https'] })`는 이 케이스들을 통과시키므로 — 실제로 `isPrivateHost()` 서비스 레이어 가드가 별도 존재하는 구조라면 — DTO 레벨 한계를 명시적으로 문서화하는 테스트가 있어야 한다.
- **제안**:
  ```ts
  it('passes private IP through DTO (blocked at service layer)', async () => {
    // DTO validates scheme only; SSRF IP guard lives in LlmService.isPrivateHost()
    await expectNoErrors({
      provider: 'openai', apiKey: 'k',
      baseUrl: 'http://169.254.169.254',
    });
  });
  ```
  또는 서비스 레이어 가드가 없다면 DTO에 IP 차단 validator 추가 후 테스트.

---

**[WARNING]** 다중 어서션 단일 케이스 — 실패 지점 특정 불가
- **위치**: `it('does not require baseUrl for openai/anthropic/google')`
- **상세**: 세 provider에 대한 `expectNoErrors`가 하나의 `it` 블록에 직렬로 나열된다. 중간에 실패하면 어느 provider가 원인인지 테스트 리포트에서 바로 알 수 없다.
- **제안**: `it.each`로 파라미터화하거나 개별 케이스로 분리.
  ```ts
  it.each(['openai', 'anthropic', 'google'] as const)(
    'does not require baseUrl for %s',
    async (provider) => {
      await expectNoErrors({ provider, apiKey: 'sk-xxx' });
    },
  );
  ```

---

**[WARNING]** `apiKey` 공백만 포함 케이스(`'   '`) 미검증
- **위치**: apiKey 관련 케이스
- **상세**: DTO에 `@IsString()` + `@MaxLength(500)`만 있고 `@IsNotEmpty()` / `@MinLength()` 가 없으므로 `apiKey: '   '`는 통과한다. `local` 이외 provider에서 빈 apiKey를 서비스 레이어가 거부한다면 DTO 레벨에서의 공백 허용이 의도적 설계인지, 누락인지 테스트로 명시해야 한다.
- **제안**: `it('accepts whitespace-only apiKey at DTO level (service layer rejects for non-local)')` 케이스 추가.

---

**[INFO]** `baseUrl` 빈 문자열 — `local` provider 케이스 누락
- **위치**: azure 빈 문자열 테스트 하단
- **상세**: `azure` provider의 빈 문자열 baseUrl 거부는 테스트하지만 `local`의 동일 케이스는 없다. `PROVIDERS_REQUIRING_BASE_URL`에 둘 다 포함되므로 동일 동작이 보장되어야 한다.
- **제안**: `it('rejects empty-string baseUrl for local provider')` 추가.

---

### `llm-config.controller.spec.ts`

**[WARNING]** `Pick<>` 타입 정의 후 `as unknown as` 캐스팅으로 타입 안전성 무력화
- **위치**: `beforeEach`, `controller = new LlmConfigController(...)` 라인
- **상세**: `mockLlmService`를 `jest.Mocked<ServiceMethods>`(Pick 기반)로 정의하는 것은 올바르지만, 생성자에 `as unknown as LlmService`로 넘기면서 TypeScript의 타입 검사가 무력화된다. `LlmService` 인터페이스에 새 메서드가 추가되거나 기존 메서드 시그니처가 변경되어도 이 테스트는 컴파일 오류 없이 통과한다.
- **제안**: 컨트롤러 생성자가 `Pick<LlmService, ...>`을 수용하도록 인터페이스를 좁히거나, DI 컨테이너 없이 직접 테스트하는 패턴을 선택할 것.

---

**[WARNING]** `clearClientCache` mock이 등록되지만 negative assertion 케이스가 하나뿐
- **위치**: `beforeEach` mock 설정 + 첫 번째 `previewModels` 테스트
- **상세**: `clearClientCache: jest.fn()`이 mock에 포함되지만 오직 첫 번째 테스트에서만 "호출되지 않아야 한다"를 검증한다. 에러 전파 케이스(세 번째 테스트)에서도 `clearClientCache`가 호출되지 않음을 명시적으로 단언하지 않는다.
- **제안**: 에러 케이스 테스트에도 `expect(mockLlmService.clearClientCache).not.toHaveBeenCalled()` 추가, 또는 `afterEach`에서 일괄 검증.

---

**[INFO]** 주석의 커버리지 참조가 부정확
- **위치**: 파일 최상단 주석
- **상세**: `"full CRUD handler coverage lives in llm-config.service.spec.ts for business logic"` — 컨트롤러 라우팅 커버리지가 서비스 스펙에 있다고 참조하는 것은 오해를 유발한다. 컨트롤러 레벨 커버리지는 e2e 테스트에 있다는 의미를 명확히 해야 한다.
- **제안**: `// Covers only previewModels; other handler routing covered in e2e tests.` 로 수정.

---

### `llm-configs.test.ts`

**[WARNING]** `afterEach(vi.restoreAllMocks)`가 모듈 mock에 효과 없음
- **위치**: `beforeEach` / `afterEach` 설정
- **상세**: `vi.mock('../client')`는 모듈 레벨 mock으로 `vi.restoreAllMocks()`의 영향을 받지 않는다. `restoreAllMocks`는 `vi.spyOn`으로 생성한 spy만 원상복구한다. `beforeEach`의 `vi.clearAllMocks()`로 이미 충분하며, `afterEach`가 의도하지 않은 격리를 보장한다는 잘못된 신뢰를 줄 수 있다.
- **제안**: `afterEach(() => vi.restoreAllMocks())` 제거. 또는 의도적으로 spy가 있다면 명시적 주석 추가.

---

**[WARNING]** `previewModels` non-envelope 폴백 케이스 — 데이터 내용 미검증
- **위치**: `it("falls back to the body itself when not enveloped")` (previewModels)
- **상세**: `expect(result).toHaveLength(1)`만 검증하고 `result[0].id`나 `result[0].type` 같은 실제 데이터 내용은 확인하지 않는다. `listModels`의 동일 케이스와 검증 depth가 불일치한다.
- **제안**:
  ```ts
  expect(result[0].id).toBe("gpt-4o-mini");
  ```

---

**[INFO]** null/undefined 응답 데이터 경계값 미검증
- **위치**: `listModels`, `previewModels` describe
- **상세**: `apiClient.get`이 `{ data: null }` 또는 `{ data: undefined }`를 반환할 때 `(data?.data ?? data)` 패턴이 null/undefined를 반환해 호출자가 `.length`에 접근 시 런타임 오류가 발생할 수 있다.
- **제안**:
  ```ts
  it('returns empty array when response data is null', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: null });
    // 현재 구현이 어떻게 처리하는지 계약으로 고정
  });
  ```

---

**[INFO]** `listModels` / `previewModels` 에러 케이스 비대칭
- **위치**: 두 describe 블록 에러 테스트
- **상세**: `listModels`는 네트워크 에러만 테스트하고, `previewModels`는 4xx AxiosError를 테스트한다. 두 함수가 같은 `apiClient`를 사용하므로 에러 패턴도 대칭적으로 테스트해야 회귀 안전망이 균일해진다.
- **제안**: `listModels`에도 4xx 에러 케이스(`{ status: 401, data: { message: "Unauthorized" } }`) 추가.

---

## 요약

리뷰 대상 세 파일의 테스트 전반은 핵심 경로(DTO 유효성 검증, 컨트롤러 위임, API 응답 언래핑)를 잘 커버하고 있다. 가장 실질적인 갭은 두 곳이다: `preview-llm-models.dto.spec.ts`에서 SSRF 방어 검증이 스킴 레벨에만 머물러 있어 내부 IP가 DTO를 통과하는 경로를 테스트로 명시하지 않고 있고, `llm-configs.test.ts`의 `afterEach(vi.restoreAllMocks)`가 모듈 mock 환경에서 효과가 없어 잘못된 격리 보장 신호를 준다. 컨트롤러 스펙의 `Pick<>` + `as unknown as` 조합은 타입 안전성 이점을 반감시키며, 다중 어서션 단일 케이스와 폴백 검증 depth 불일치는 테스트 가독성과 회귀 감지력을 낮춘다.

## 위험도

**LOW**