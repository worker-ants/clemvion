# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 변경 범위 내 package.json 수정 없음
  - 위치: `backend/package.json`, `frontend/package.json` (변경 없음)
  - 상세: 이번 PR(cafe24-mall-dup-followup-b)에서 신규 npm 패키지는 추가되지 않았다. 변경된 10개 파일 모두 기존 의존성만 사용한다.
  - 제안: 현상 유지.

- **[INFO]** 신규 내부 모듈 `frontend/src/lib/api/integration-error-codes.ts` 도입
  - 위치: `frontend/src/lib/api/integration-error-codes.ts` (신규 파일, line 1)
  - 상세: 단일 외부 의존성 `@/lib/i18n` 에서 `TranslationKey` 타입만 import 한다. 해당 경로는 기존 코드베이스에서 이미 광범위하게 사용 중인 내부 i18n 모듈이며, 순환 참조(circular dependency) 위험이 없다. 모듈이 `frontend/src/lib/api/` 아래에 위치하는데, 실제 API 호출을 수행하지 않고 오직 에러 코드-i18n 키 매핑 상수만 보유하는 pure utility 성격이다.
  - 제안: 현재 배치는 기능적으로 문제없으나, 향후 이 파일이 `frontend/src/lib/api/integrations.ts` 의 타입과 강하게 결합될 경우 `frontend/src/lib/integrations/` 하위로 이동을 검토할 수 있다. 지금은 낮은 위험도.

- **[INFO]** 신규 내부 모듈 `frontend/src/lib/integrations/use-cafe24-mall-id-precheck.ts` 도입
  - 위치: `frontend/src/lib/integrations/use-cafe24-mall-id-precheck.ts` (신규 파일, line 1-2)
  - 상세: `react` (useEffect, useState) 와 `@/lib/api/integrations` (integrationsApi, Cafe24PrecheckResult) 두 개만 import 한다. 두 모듈 모두 기존 코드베이스에서 사용 중이며, 의존 방향이 단방향(hook → api → ...)으로 순환이 없다. `frontend/src/lib/integrations/` 내 기존 파일(`use-cafe24-pending-polling.ts` 등)과 동일한 패턴이므로 일관성도 유지된다.
  - 제안: 현상 유지.

- **[INFO]** `page.tsx` 의 import 추가 — 내부 모듈 두 개 신규 참조
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx`, diff +2 lines (import 섹션)
  - 상세: `getIntegrationErrorI18nKey` (`@/lib/api/integration-error-codes`) 와 `useCafe24MallIdPrecheck` (`@/lib/integrations/use-cafe24-mall-id-precheck`) 두 개를 추가했다. 두 모듈 모두 이번 PR 에서 함께 신설된 내부 모듈이다. page.tsx 는 이미 `integrationsApi`, `useT`, `useCafe24PendingPolling` 등 다수의 내부 모듈을 참조하고 있어, 새 참조가 fan-out을 크게 늘리지 않는다.
  - 제안: 현상 유지.

- **[INFO]** 테스트 파일의 새 import 패턴 — `vi.mock` 을 통한 경계 격리
  - 위치: `frontend/src/lib/integrations/__tests__/use-cafe24-mall-id-precheck.test.tsx` (신규), `frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx`
  - 상세: 테스트에서 `@/lib/api/integrations` 를 `vi.mock` 으로 대체해 실제 API 모듈에 대한 런타임 의존성을 차단하고 있다. 이는 vitest 의 표준적인 격리 패턴이며, 의존 관계가 테스트 경계를 올바르게 넘지 않도록 한다.
  - 제안: 현상 유지.

- **[INFO]** backend `integrations.service.spec.ts` 의 타입 import 추가 (`type PublicIntegration`)
  - 위치: `backend/src/modules/integrations/integrations.service.spec.ts`, diff line `+  type PublicIntegration,`
  - 상세: `type` 키워드를 사용한 type-only import 이므로 런타임 번들에 영향이 없다. `integrations.service.ts` 에서 이미 export 하는 타입을 spec 파일에서 assertion 용도로만 가져온다. 모듈 간 경계를 서비스 파일 내부로 한정하고 있다.
  - 제안: 현상 유지.

- **[INFO]** `integration-error-codes.ts` 의 `Object.prototype.hasOwnProperty.call` 사용
  - 위치: `frontend/src/lib/api/integration-error-codes.ts`, line 51 (`getIntegrationErrorI18nKey`)
  - 상세: `INTEGRATION_ERROR_CODE_TO_I18N` 는 `Readonly<Record<...>>` 타입으로 선언된 상수 객체이므로 prototype chain 오염 가능성이 없다. `Object.prototype.hasOwnProperty.call` 사용이 방어적으로 좋긴 하지만, `errorCode in INTEGRATION_ERROR_CODE_TO_I18N` 또는 `INTEGRATION_ERROR_CODE_TO_I18N[errorCode as key] !== undefined` 로도 충분하다. 기능상 문제는 없다.
  - 제안: 선택적 — 더 간결한 `in` 연산자 또는 옵셔널 체이닝으로 대체 가능하나, 현재 구현도 안전하다.

## 요약

이번 변경(cafe24-mall-dup-followup-b)은 신규 외부 npm 패키지를 전혀 도입하지 않았다. 모든 추가 의존성은 프로젝트 내부 모듈 재사용(react, @/lib/api/integrations, @/lib/i18n) 이며, 각 모듈의 역할이 명확하게 분리되어 순환 참조나 버전 충돌 위험이 없다. 신규 파일(`integration-error-codes.ts`, `use-cafe24-mall-id-precheck.ts`)은 기존 패턴을 따르고, 의존 방향이 단방향으로 올바르게 설계되었다. 번들 크기 영향도 미미하며, 테스트에서는 `vi.mock` 으로 외부 의존 경계를 정상적으로 격리하고 있다. 의존성 관점에서 발견된 CRITICAL, WARNING 등급의 사항은 없다.

## 위험도

NONE
