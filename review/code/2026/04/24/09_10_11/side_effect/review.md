## 발견사항

---

**[WARNING]** `PreviewLlmModelsDto.baseUrl` — 빈 문자열 전달 시 기존 클라이언트 동작 파괴
- **위치**: `preview-llm-models.dto.ts:38-45`
- **상세**: `ValidateIf` 조건이 `PROVIDERS_REQUIRING_BASE_URL.includes(dto.provider) || dto.baseUrl !== undefined`이므로, openai/anthropic/google 프로바이더라도 `baseUrl: ''`을 전달하면 조건이 `true`가 되어 `@IsNotEmpty`가 실패한다. 이전 버전의 DTO가 `baseUrl`을 단순 `@IsOptional() @IsString()`으로만 선언했다면, 기존 클라이언트 중 빈 문자열을 "미설정"의 sentinel로 사용하던 곳이 갑자기 422를 받게 된다. 스펙 테스트에 openai + `baseUrl: ''` 케이스가 없어 의도적 설계인지 불명확하다.
- **제안**: `expectValidationError({ provider: 'openai', apiKey: 'k', baseUrl: '' }, 'baseUrl')` 테스트 케이스를 추가해 의도적 차단임을 계약으로 고정. 또는 빈 문자열은 undefined와 동일하게 처리하도록 `ValidateIf` 조건을 `dto.baseUrl !== undefined && dto.baseUrl !== ''`로 조정하고 `@IsNotEmpty`를 제거.

---

**[WARNING]** `@IsUrl` + `@IsNotEmpty` 선언 순서 — 빈 문자열에 대해 두 에러가 동시 발생
- **위치**: `preview-llm-models.dto.ts:43-45`
- **상세**: class-validator는 `ValidateIf` 통과 시 필드의 모든 데코레이터를 독립적으로 실행하고 에러를 누적한다. `baseUrl: ''`이 입력되면 `@IsNotEmpty`와 `@IsUrl` 두 개의 에러가 동시에 `errors` 배열에 담긴다. 호출자가 `errors.find(e => e.property === 'baseUrl')`로 첫 번째 에러만 참조하면 문제없으나, `errors[i].constraints`의 키를 직접 참조하는 코드가 있으면 예상치 못한 constraint 키(`isNotEmpty` vs `isUrl`)가 섞여 혼란을 유발할 수 있다.
- **제안**: `@IsNotEmpty`를 제거하고 빈 문자열을 `@IsUrl`이 자연스럽게 걸러내도록 단일화. 단, `@IsUrl`은 빈 문자열에 대해 실패하므로 `@IsNotEmpty` 없이도 동일한 결과가 나온다.

---

**[INFO]** `llm-config.controller.spec.ts` — `clearClientCache` mock이 테스트와 연결되지 않음
- **위치**: `llm-config.controller.spec.ts:27`, `41`
- **상세**: `mockLlmService`에 `clearClientCache: jest.fn()`이 선언되어 있으나, 이 spec 파일의 모든 테스트는 `previewModels`만 다루고 `clearClientCache`는 "호출되지 않아야 한다"는 검증 외에 실제 동작 케이스가 없다. `ServiceMethods` 타입에 `clearClientCache`를 포함시키는 것은 타입 drift 방지에 유효하지만, mock에 무관한 메서드가 포함되면 추후 리더가 이 메서드가 `previewModels` 엔드포인트에서 중요한 역할을 하는지 오해할 수 있다.
- **제안**: `clearClientCache`는 현재 음의 검증(not.toHaveBeenCalled)에만 사용되므로 의도를 주석으로 명시: `// guard: previewModels must not invalidate the shared client cache`.

---

**[INFO]** `llm-configs.test.ts` — `previewModels` fallback 케이스에 임시성 표시 누락
- **위치**: `llm-configs.test.ts:55-61`
- **상세**: `listModels`의 fallback 케이스는 `"(interim dual-shape contract)"` 주석이 있어 제거 시점을 명시하지만, `previewModels`의 동일한 fallback 케이스에는 이 주석이 없다. 두 함수 모두 동일한 `data?.data ?? data` 패턴을 쓰므로 같은 한시성 계약이 적용되어야 하나, 주석 누락으로 영구 계약으로 오독될 수 있다.
- **제안**: `"falls back to the body itself when not enveloped"` 케이스에 `// TODO: remove after transform interceptor centralizes unwrapping` 주석 추가.

---

**[INFO]** `ValidateIf` 조건이 `dto.baseUrl`을 참조 — class-transformer 변환 타이밍 의존
- **위치**: `preview-llm-models.dto.ts:38-41`
- **상세**: `ValidateIf` 콜백이 `dto.baseUrl !== undefined`를 평가할 때, `plainToInstance`가 이미 `baseUrl`을 변환한 상태여야 조건이 올바르게 동작한다. `excludeExtraneousValues: true` 옵션 등 일부 class-transformer 설정에서는 선언되지 않은 필드가 `undefined`로 강제될 수 있다. 테스트가 `plainToInstance(PreviewLlmModelsDto, payload)` + 기본 설정을 사용하므로 현재는 안전하나, 변환 옵션이 달라지면 `ValidateIf` 조건 평가가 달라질 수 있다.
- **제안**: 현행 유지. 단, `plainToInstance` 호출부에 `excludeExtraneousValues` 등의 옵션이 추가될 경우 이 DTO의 조건부 검증 동작을 재검증해야 함을 주석으로 남길 것.

---

## 요약

이번 변경의 핵심 부작용 위험은 `PreviewLlmModelsDto.baseUrl`의 `ValidateIf` 조건에 집중된다. `dto.baseUrl !== undefined` 조건이 포함되어 있어 openai/anthropic/google 프로바이더에서도 `baseUrl`을 빈 문자열로 전달하면 검증이 실행되고 에러가 발생한다. 이전 구현이 이 필드를 단순 optional로 처리했다면 기존 클라이언트의 silent regression을 유발할 수 있다. 컨트롤러 spec은 `jest.Mocked<Pick<...>>` 패턴으로 이전 `as never`의 타입 안전성 문제를 올바르게 개선했다. API 클라이언트 테스트는 fallback 계약의 임시성 표시가 불일치한다는 점 외에 부작용 위험은 없다.

## 위험도

**LOW** — `baseUrl: ''` sentinel 사용 클라이언트 존재 여부에 따라 MEDIUM으로 상승 가능