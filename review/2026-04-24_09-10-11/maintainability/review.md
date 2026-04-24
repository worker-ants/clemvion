### 발견사항

---

**[WARNING] `@IsString()`이 `@IsUrl()` 앞에 중복 선언**
- 위치: `preview-llm-models.dto.ts:37-40`
- 상세: `@IsUrl()`은 대상 값이 문자열임을 이미 전제하므로 `@IsString()`이 동일 필드에 선언될 경우 검증이 이중으로 실행된다. 제거해도 동작은 동일하며 데코레이터 체인이 짧아져 가독성이 개선된다.
- 제안: `@IsString()` 제거.

---

**[WARNING] `'does not require baseUrl for openai/anthropic/google'` 단일 테스트에 3개 프로바이더 혼합**
- 위치: `preview-llm-models.dto.spec.ts:83-87`
- 상세: 한 `it` 블록에서 세 프로바이더를 순차적으로 `await`한다. 하나가 실패하면 이후 케이스 실행이 건너뛰어지고, 실패 메시지가 "어떤 프로바이더가 실패했는지" 즉시 드러나지 않는다. 프로바이더가 추가될 때 이 테스트를 수정해야 한다는 사실도 이름에서 드러나지 않는다.
- 제안:
  ```ts
  it.each(['openai', 'anthropic', 'google'])(
    'does not require baseUrl for %s',
    async (provider) => {
      await expectNoErrors({ provider, apiKey: 'sk-xxx' });
    },
  );
  ```

---

**[WARNING] `ValidateIf` 다중 줄 주석이 WHAT을 설명**
- 위치: `preview-llm-models.dto.ts:32-35`
- 상세: `// Azure/Local 에서는 baseUrl 이 필수 ... ValidateIf 가 false 를 돌려주면 하위 validator 가 모두 skip 되므로 "전달되지 않은 선택값"과 "필수 누락" 케이스를 한 필드 선언으로 처리할 수 있다.` — ValidateIf의 동작을 설명하는 3줄짜리 주석이다. 프로젝트 컨벤션(CLAUDE.md)은 다중 줄 주석을 금지하며, 이 주석은 WHY가 아닌 HOW를 설명한다. 비자명한 제약인 "Azure/Local은 필수, 나머지는 선택"이라는 **비즈니스 규칙**만 1줄로 남기면 충분하다.
- 제안: 3줄 주석을 `// Azure/Local: baseUrl 필수; 나머지 프로바이더: 선택` 1줄로 대체.

---

**[INFO] `type ServiceMethods` / `type ConfigMethods` 로컬 타입 별칭이 중복 역할**
- 위치: `llm-config.controller.spec.ts:5-13`
- 상세: `Pick<LlmService, ...>`와 `Pick<LlmConfigService, ...>`를 별도 타입으로 선언한 뒤 `jest.Mocked<ServiceMethods>`로 조합하는 패턴은 타입 안전성을 확보하는 좋은 방향이다. 다만 타입 별칭 이름(`ServiceMethods`, `ConfigMethods`)이 "LLM 서비스의 일부 메서드"라는 맥락 없이는 generic하게 읽힌다.
- 제안: `type PreviewControllerLlmServiceMethods`처럼 범위를 명시하거나, 별칭 없이 인라인으로 `jest.Mocked<Pick<LlmService, ...>>`를 직접 사용해 중간 타입 단계를 줄인다.

---

**[INFO] `'falls back to the body itself when not enveloped'` 테스트명이 임시성을 불충분하게 표현**
- 위치: `llm-configs.test.ts:34`
- 상세: 현재 테스트명 `"falls back to the body itself when not enveloped (interim dual-shape contract)"`는 RESOLUTION W-12에서 의도적으로 보류한 임시 계약임을 암시하나, "interim"이 괄호 안에 묻혀 있어 미래 개발자가 이 테스트를 영구 계약으로 오인할 수 있다. 같은 문제를 maintainability 리뷰 배치3(파일 46)에서도 지적했으나 테스트명이 유지되었다.
- 제안: `// TODO: apiClient 인터셉터 중앙화(W-12) 후 제거` 주석을 테스트 내부에 추가하거나, 테스트명을 `'[TODO:W-12] interim: accepts raw array until transform interceptor centralizes unwrapping'`으로 변경.

---

**[INFO] `previewModels` 테스트에 non-envelope fallback 케이스 부재**
- 위치: `llm-configs.test.ts:54-94`
- 상세: `listModels`는 envelope/non-envelope 양쪽을 모두 검증하지만, 동일한 `data?.data ?? data` 패턴을 사용하는 `previewModels`는 envelope 케이스와 4xx 에러 케이스만 존재한다. 두 함수의 테스트 구조가 비대칭이어서 패턴을 추가·수정할 때 누락을 유발할 수 있다.
- 제안: `previewModels` describe 블록에 non-envelope fallback 케이스 추가. `listModels`의 두 번째 케이스 구조를 재사용.

---

**[INFO] `mockLlmService`에 `clearClientCache`가 포함되지만 테스트에서 미사용**
- 위치: `llm-config.controller.spec.ts:28`
- 상세: `clearClientCache: jest.fn()`이 mock에 선언되어 있고, `previewModels` 테스트에서 `not.toHaveBeenCalled()` 검증에 활용된다. 이는 의도된 사용이다. 단, `mockLlmConfigService`의 6개 메서드는 어떤 테스트에서도 호출 검증 없이 stub만 되어 있다. 컨트롤러가 `LlmConfigService`를 사용하지 않는 `previewModels`만 커버하는 파일이므로 이 mock은 생성자 주입을 위한 형식적 stub일 뿐이다. 파일 상단 주석이 이 점을 명시하고 있어 혼란을 줄인다.

---

### 요약

리뷰 대상 코드는 전반적으로 책임 분리와 테스트 구조가 잘 설계되어 있다. `Pick<>` 기반 mock 타입, `expectValidationError`/`expectNoErrors` 헬퍼 추출, `PROVIDERS_REQUIRING_BASE_URL` 상수화 등 가독성과 DRY 원칙을 잘 지키고 있다. 유지보수 관점에서 실질적인 위험은 `preview-llm-models.dto.spec.ts`의 복수 프로바이더 단일 테스트(실패 추적 어려움), `@IsString()` 중복 선언(의미 오독 유발), `llm-configs.test.ts`의 fallback 테스트가 임시 계약임을 충분히 표현하지 못하는 점으로 좁혀진다. 모두 기능 오류를 유발하는 수준은 아니나, 프로바이더 목록이나 API 응답 포맷이 변경될 때 누락이 발생할 수 있는 지점이다.

### 위험도

**LOW**