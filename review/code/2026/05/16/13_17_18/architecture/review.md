# Architecture Review

## 발견사항

- **[INFO]** 코드 포맷팅 전용 변경 — 실질적 아키텍처 변경 없음
  - 위치: 전체 9개 파일 diff
  - 상세: 이번 변경 세트의 모든 diff는 Prettier 등 포매터에 의한 줄 줄바꿈(line wrapping) 조정에 해당한다. 로직·의존성·레이어 책임·모듈 경계 등에는 변경이 없다.
  - 제안: 해당 사항 없음.

- **[INFO]** `ThirdPartyOAuthController` — 레이어 책임 분리 양호
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.ts`
  - 상세: 컨트롤러가 직접 비즈니스 로직을 수행하지 않고 `IntegrationOAuthService`에 위임한다. 단, `cafe24Install` 메서드는 `req.url.includes('?')` 로 raw query string을 직접 파싱하는 파편화된 로직을 포함하며, Accept 헤더 기반 분기(HTML vs JSON 응답)도 컨트롤러에서 직접 처리한다. 이 두 가지 관심사는 컨트롤러의 단일 책임 범위 경계에 있다.
  - 제안: raw query string 추출 로직은 NestJS interceptor 또는 서비스 레이어 어댑터로 분리하는 것을 검토. Accept 헤더 기반 응답 분기는 NestJS Exception Filter로 위임하면 컨트롤러 본문이 단순해진다. 단, 현재 구조도 기능상 큰 문제는 없으므로 즉각적인 리팩토링 필수는 아니다.

- **[INFO]** `isValidPostMessageOrigin` — 유틸리티 함수의 모듈 위치
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.ts` 하단 (export 함수)
  - 상세: 보안 유틸리티 함수인 `isValidPostMessageOrigin`이 컨트롤러 파일에 직접 포함되어 있다. 현재는 `export`로 노출되어 테스트 가능성은 확보됐으나, `common/utils/` 또는 `common/security/` 등 공유 유틸리티 모듈로 분리하면 다른 컨트롤러에서도 재사용 가능하고 응집도가 더 높아진다.
  - 제안: `backend/src/common/security/origin-validator.ts` 로 추출 고려. 단, 현재 사용처가 이 파일 하나뿐이라면 즉시 이동의 실익이 작다.

- **[INFO]** 노드 스키마 패턴 — 일관된 3-레이어 검증 아키텍처
  - 위치: `if-else.schema.ts`, `variable-declaration.schema.ts`, `variable-modification.schema.ts`, `parallel.schema.spec.ts`, `switch.schema.spec.ts`, `send-email.schema.spec.ts`, `carousel.schema.spec.ts`
  - 상세: 모든 노드 스키마가 동일한 3-레이어 검증 패턴을 일관되게 따른다: (1) Zod 스키마 파싱(구조·타입), (2) 선언적 `warningRules`(DSL 표현 가능한 단일 필드 검사, 캔버스 배지 연동), (3) 명령형 `validateConfig`(배열 순회 등 DSL로 표현 불가한 복잡 검사). 이 패턴은 확장 가능하고 SSOT 원칙을 준수하며, 프론트엔드와 백엔드 간 검증 규칙 불일치를 컴파일 타임에 차단하는 설계이다.
  - 제안: 현재 구조 유지. 신규 노드 추가 시 동일 패턴을 강제하는 가이드라인 또는 테스트 픽스처를 추가하면 아키텍처 일관성을 장기적으로 보장할 수 있다.

- **[INFO]** `variable-modification.schema.ts` — VALID_OPERATIONS 로컬 Set 중복
  - 위치: `backend/src/nodes/logic/variable-modification/variable-modification.schema.ts`, `validateVariableModificationConfig` 함수 내부
  - 상세: `modOperationSchema`(Zod enum)와 `VALID_OPERATIONS`(로컬 `Set<string>`) 두 곳에 동일한 6개 연산 목록이 중복 정의되어 있다. 코드 주석에도 "keep all three in sync"라고 명시되어 있어 향후 연산 추가 시 누락 위험이 있다.
  - 제안: `validateVariableModificationConfig` 내의 `VALID_OPERATIONS`를 `new Set(modOperationSchema.options)` 로 대체하면 단일 진실 원칙을 준수하고 sync 관리 부담을 제거할 수 있다.

- **[INFO]** `migrations.spec.ts` — 테스트 파일에 구현 로직(`findDuplicateVersions`) 혼재
  - 위치: `backend/src/migrations.spec.ts`
  - 상세: `findDuplicateVersions` 함수가 테스트 파일에 직접 정의되어 `export`로 노출되고 있다. 이 함수는 빌드 시점 가드(`check-duplicate-versions.sh`)와 동일 규칙을 공유하는 실제 비즈니스 로직이다. 테스트 파일은 원칙적으로 검증만 담당해야 하며, 구현 로직이 포함되면 테스트 대상과 구현이 동일 파일에 공존하는 구조가 된다.
  - 제안: 중장기적으로는 `findDuplicateVersions`를 별도 모듈(예: `migrations/migration-guard.ts`)로 추출하고 테스트 파일은 이를 import하도록 리팩토링. 단, 현재는 마이그레이션 가드 전용 유틸리티이므로 즉각 이동의 우선순위는 낮다.

---

### 요약

이번 변경 세트는 코드 포맷팅(줄 줄바꿈) 조정이 전부로, 아키텍처 구조 자체의 변경은 없다. 리뷰 대상 파일 전반을 보면, 노드 스키마 아키텍처는 Zod 스키마 / 선언적 warningRules / 명령형 validateConfig 의 3-레이어 검증 패턴이 일관되게 적용되어 있고, 프론트엔드-백엔드 간 SSOT 원칙도 잘 지켜진다. `ThirdPartyOAuthController`는 서비스 위임 패턴을 올바르게 사용하나, raw query 파싱과 Accept 헤더 분기 등 일부 관심사가 컨트롤러 레이어에 혼재한다. `variable-modification.schema.ts`의 연산 목록 이중 정의는 향후 유지보수 부채가 될 수 있어 단일화가 권장된다. 전반적으로 아키텍처 위험도는 낮다.

### 위험도

LOW
