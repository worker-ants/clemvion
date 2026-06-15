# Testing Review — config-c2-autoclear-isip

## 발견사항

### [WARNING] `revealedSecret` 30초 자동 hide 타이머가 테스트로 커버되지 않음
- 위치: `/codebase/frontend/src/app/(main)/authentication/page.tsx` L283
- 상세: `revealMutation.onSuccess` 내 `window.setTimeout(() => setRevealedSecret(null), 30_000)`는 `useEffect` 기반 `generatedKey` 타이머와 달리 raw `setTimeout` 을 직접 호출하여 언마운트 시 cleanup 이 없다. `generated-key-autoclear.test.tsx` 는 `generatedKey` 경로만 검증하며, `revealedSecret` 30초 자동 hide 와 언마운트 시 타이머 누수(stale setTimeout 가 남아 있어 setState 가 호출될 수 있음)는 전혀 테스트되지 않는다. `generatedKey` 쪽은 `useEffect` 로 cleanup 이 완료되어 `clearTimeout` 을 보장하지만, `revealedSecret` 쪽은 동일한 안전 장치가 없고 테스트도 없다.
- 제안: `reveal` 경로(Reveal 버튼 클릭 → 비밀 표시 → 30초 후 자동 사라짐 + 언마운트 시 타이머 정리)를 커버하는 테스트를 `generated-key-autoclear.test.tsx` 또는 별도 파일에 추가. `revealMutation.onSuccess`의 타이머를 `useRef`/`useEffect`로 관리하는 리팩터링과 함께 검토 필요.

### [WARNING] `isIpOrCidr` 유효 케이스에 `/0` IPv4 전체-경로 CIDR 누락
- 위치: `/codebase/backend/src/modules/auth-configs/dto/auth-config-ip-whitelist.dto.spec.ts` L46–57
- 상세: 프론트엔드 `auth-config-form.test.ts`는 `0.0.0.0/0`을 `isValidIpOrCidr`의 유효 케이스로 검증하지만, 백엔드 `isIpOrCidr` 테스트는 `/0` 경우를 포함하지 않는다. 라이브러리 동작 일관성 확인 목적으로 추가하면 front-back 검증 기준이 맞춰진다.
- 제안: 유효 케이스 목록에 `'0.0.0.0/0'` 추가.

### [INFO] `IsIpOrCidrConstraint.defaultMessage` 에 대한 직접 테스트 없음
- 위치: `/codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts` L411–413
- 상세: `defaultMessage` 반환 문자열이 올바른지 (property 명 포함) 단위 테스트로 확인되지 않는다. DTO 통합 테스트에서 `constraints.isIpOrCidr`의 존재만 체크하고 메시지 내용은 확인하지 않는다. 실제 사용자에게 노출되는 에러 메시지 포맷에 대한 회귀 방어가 약하다.
- 제안: `IsIpOrCidrConstraint` 인스턴스를 직접 생성해 `defaultMessage({ property: 'ipWhitelist', ... })`의 반환값이 property 명을 포함하는지 확인하는 테스트를 `isIpOrCidr (저수준 검증 함수)` describe 내 또는 별도 블록에 추가.

### [INFO] `CreateAuthConfigDto` — `ipWhitelist` 가 배열이 아닌 단일 문자열로 오는 경우 미검증
- 위치: `/codebase/backend/src/modules/auth-configs/dto/auth-config-ip-whitelist.dto.spec.ts` L76–112
- 상세: `@IsArray()` + `@IsIpOrCidr({ each: true })` 조합 시, `ipWhitelist` 에 배열 대신 문자열(`"10.0.0.1"`)이 직접 전달되면 `@IsArray()` 에서 먼저 걸리겠지만, `@IsIpOrCidr` 까지 도달하지 않는 흐름이 테스트로 확인되지 않는다. DTO 레이어 방어 깊이 검증 차원.
- 제안: `validateWhitelist('10.0.0.1')` (문자열 직접 전달) 케이스를 추가해 `IsArray` 위반이 반환됨을 확인.

### [INFO] `generated-key-autoclear.test.tsx` — `regenerate` 경로 미커버
- 위치: `/codebase/frontend/src/app/(main)/authentication/__tests__/generated-key-autoclear.test.tsx`
- 상세: 테스트 파일 JSDoc 에 "create/regenerate 로 1회 노출되는 평문 키(generatedKey)" 라고 명시되어 있지만, `regenerate` 경로(재생성 확인 후 POST /regenerate 성공 → 30초 자동클리어)는 실제 테스트에 없다. `create` 경로만 검증하므로 `regenerateMutation.onSuccess`에서 `setGeneratedKey(secret)` 를 호출하는 브랜치가 커버되지 않는다.
- 제안: `postMock`이 재생성 엔드포인트 응답을 반환하도록 설정한 뒤 Regenerate 버튼 → 확인 버튼 클릭 → `PLAINTEXT_KEY` 표시 → 30초 후 소멸하는 시나리오를 추가.

### [INFO] `beforeEach`에서 `cleanup()` 중복 호출
- 위치: `/codebase/frontend/src/app/(main)/authentication/__tests__/generated-key-autoclear.test.tsx` L49 및 L63
- 상세: `@testing-library/react`의 `cleanup`이 `beforeEach`와 `afterEach` 양쪽에서 호출된다. vitest + `@testing-library/react` 환경에서는 afterEach 자동 cleanup 이 등록되는 경우가 많아 `beforeEach`에서의 추가 호출이 불필요하거나 혼란을 줄 수 있다. 중복은 격리에 큰 문제를 주지는 않지만 코드 의도가 명확하지 않다.
- 제안: `beforeEach`에서 `cleanup()` 제거하거나, 자동 cleanup 설정 여부를 `vitest.setup.ts`에서 확인 후 정리.

---

## 요약

백엔드 DTO 레이어(`is-ip-or-cidr.validator.ts`, `CreateAuthConfigDto`, `UpdateAuthConfigDto`)에 대한 테스트(`auth-config-ip-whitelist.dto.spec.ts`)는 유효/무효/비문자열 엣지 케이스를 잘 포함하고 있으며 격리도 적절하다. 프론트엔드 `generatedKey` 30초 자동 클리어는 fake timer를 활용해 경계값(29초/30초)과 언마운트 cleanup 을 모두 검증한 실용적인 구조다. 다만 두 가지 갭이 존재한다: (1) `revealedSecret` 30초 타이머는 cleanup 없는 raw `setTimeout` 으로 구현되어 있으나 테스트가 전혀 없고, 언마운트 시 stale timer 위험이 있다 — 이것이 가장 즉각적인 위험으로 WARNING 으로 분류한다. (2) `regenerate` 경로의 `generatedKey` 자동클리어가 파일 JSDoc 에 언급되었음에도 테스트에서 빠져 있다.

## 위험도

MEDIUM
