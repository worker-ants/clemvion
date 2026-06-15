# Testing Review

## 발견사항

### [INFO] `AUTOCLEAR_MS` 상수가 소스와 분리 — 동기화 위반 위험
- **위치**: `/codebase/frontend/src/app/(main)/authentication/__tests__/generated-key-autoclear.test.tsx` L692 (`const AUTOCLEAR_MS = 30_000`)
- **상세**: 테스트 파일 내 주석에 "page.tsx 의 SECRET_AUTOCLEAR_MS 와 동일해야 한다"고 명시되어 있으나, 실제로는 값을 직접 하드코딩. `SECRET_AUTOCLEAR_MS`가 `page.tsx`에서 export 되지 않아 import 할 수 없는 구조다. page.tsx의 상수가 변경될 때 테스트 경계값이 자동으로 추종하지 않는다.
- **제안**: `SECRET_AUTOCLEAR_MS`를 `page.tsx`에서 named export 하거나, 별도 상수 모듈(`auth-config-constants.ts`)로 분리해 테스트와 구현이 동일 소스를 참조하게 한다. 현재 구조는 리팩터링 시 조용한 회귀를 유발할 수 있다.

### [INFO] `clearTimeout` spy 가 다른 clearTimeout 호출과 충돌 가능
- **위치**: `generated-key-autoclear.test.tsx` L751, L824 (`vi.spyOn(window, "clearTimeout")`)
- **상세**: `clearSpy.mockClear()` 이후 `unmount()`를 호출하면 해당 spy 가 이후의 모든 `clearTimeout`(React 내부, QueryClient 등)을 포함해 집계한다. 테스트 의도는 "autoclear 타이머가 해제됐는가"이지만, spy 카운트가 1 이상이면 통과하므로 실제로 autoclear 타이머가 아닌 다른 타이머가 해제되어도 거짓 통과한다.
- **제안**: `setTimeout`도 spy해 반환된 timer ID를 캡처한 뒤, `clearTimeout`이 해당 ID로 호출됐는지 `toHaveBeenCalledWith(timerId)` 로 검증한다. 또는 `window.setTimeout`을 spy해 반환 ID를 추적하는 방식이 더 정밀하다.

### [INFO] `createApiKeyConfig` 헬퍼가 `fireEvent` + `userEvent` 혼용
- **위치**: `generated-key-autoclear.test.tsx` L703-709 (`createApiKeyConfig` 함수)
- **상세**: 다이얼로그 열기와 폼 제출에는 `fireEvent.click`을 쓰고, 텍스트 입력에는 `userEvent.type`을 사용한다. `fireEvent`는 실제 브라우저 이벤트 전파를 시뮬레이션하지 않아 동작이 다를 수 있다. 일관성 문제이지만, 현 구현에서는 두 방식 모두 기능적으로 동작한다.
- **제안**: `userEvent.click` 으로 통일하거나, 테스트 주석에 `fireEvent`를 의도적으로 쓰는 이유(타이머 진행 회피 등)를 명시한다.

### [INFO] `reveal` 흐름 헬퍼에서 버튼 탐색 로직이 취약
- **위치**: `generated-key-autoclear.test.tsx` L801-806
  ```tsx
  const confirm = screen
    .getAllByRole("button", { name: "Reveal" })
    .find((b) => b.textContent === "Reveal");
  if (!confirm) throw new Error("reveal 확인 버튼을 찾지 못함");
  ```
- **상세**: `aria-label="Reveal"`과 `textContent="Reveal"`이 동시에 존재하면 두 버튼 모두 `.find`를 통과한다. UI가 i18n 로케일에 따라 버튼 텍스트가 변경되면 헬퍼가 실패한다. `useLocaleStore.setState({ locale: "en" })` 으로 en을 고정하고 있어 현재는 안전하지만, 로케일 키가 변경되면 조용히 깨질 수 있다.
- **제안**: 다이얼로그 내 확인 버튼에 `data-testid="reveal-confirm-btn"` 같은 명시적 식별자를 추가하거나, `within(dialog)` 스코프를 사용해 버튼을 좁힌다.

### [INFO] `UpdateAuthConfigDto` 테스트에서 `null` 값 검증 케이스 누락
- **위치**: `auth-config-ip-whitelist.dto.spec.ts` L134-153
- **상세**: `UpdateAuthConfigDto` describe 블록은 3개 케이스만 검증한다. `CreateAuthConfigDto` 블록과 달리 `null` 전달(`validateWhitelist(null)`)과 배열 대신 문자열(`validateWhitelist('10.0.0.1')`) 케이스가 없다. DTO 상속 구조가 동일한 decorator 를 쓰므로 통과 가능성이 높지만, UpdateDto 경로의 독립 커버리지가 불완전하다.
- **제안**: `UpdateAuthConfigDto` describe 블록에도 `배열 대신 단일 문자열 → @IsArray 위반` 케이스를 추가한다.

### [INFO] `IsIpOrCidrConstraint` singleton 동시성 케이스 미검증
- **위치**: `auth-config-ip-whitelist.dto.spec.ts` L124-132 (`IsIpOrCidrConstraint.defaultMessage`)
- **상세**: `defaultMessage` 테스트는 메시지에 property명이 포함되는지만 확인한다. `validate()` 메서드의 stateless 설계(주석에 명시)가 class-validator singleton 환경에서 race 조건 없이 동작하는지는 unit 수준에서 직접 검증되지 않는다. 실제 문제가 발생하기 어려운 구조이나, 의도를 명시하는 테스트가 있으면 좋다.
- **제안**: stateless 검증이 명확한 목적이므로 현재 수준에서 INFO 로 분류. 필요 시 `validate()` 를 여러 값으로 연속 호출하는 케이스를 추가한다.

### [INFO] `regenerate` 흐름의 autoclear 테스트 부재
- **위치**: `generated-key-autoclear.test.tsx` 전체
- **상세**: `create`와 `reveal` 경로의 autoclear는 검증되나, `regenerate` 경로(`regenerateMutation` → `setGeneratedKey(secret)`)는 테스트 파일 내 커버 없다. `regenerate`도 동일한 `generatedKey` state를 설정하므로 같은 useEffect가 동작하지만, 실제 POST `/auth-configs/:id/regenerate` 경로를 통한 평문 노출-clearTimeout 흐름이 단독으로 검증되지 않는다.
- **제안**: "regenerate 후 30초 자동클리어" describe 블록을 추가한다. `postMock`이 `/regenerate` URL 호출 시 `generatedKey`를 설정하도록 mock 분기하거나 URL 패턴으로 구분한다.

## 요약

백엔드 DTO 검증 테스트(`auth-config-ip-whitelist.dto.spec.ts`)는 `isIpOrCidr` 저수준 함수, DTO class-validator 통합, 비-문자열 엣지케이스, optional 필드 동작을 체계적으로 커버하며 전반적으로 충실하다. 프론트엔드 autoclear 테스트(`generated-key-autoclear.test.tsx`)는 핵심 경계값(29초/30초)과 언마운트 cleanup을 검증해 의도한 보안 정책을 단위 수준에서 잘 표현한다. 다만 `AUTOCLEAR_MS` 상수가 구현과 독립적으로 하드코딩되어 리팩터링 시 동기화 실패 위험이 있으며, `clearTimeout` spy 가 특정 timer ID로 좁혀지지 않아 검증 정밀도가 다소 낮다. `regenerate` 경로의 autoclear 케이스가 누락된 점과 `UpdateAuthConfigDto` 블록의 커버리지 갭은 minor한 보완 사항이다. 전체적으로 구현의 핵심 동작과 보안 요건을 잘 반영한 테스트 세트이며, 위험 수준은 낮다.

## 위험도

LOW
