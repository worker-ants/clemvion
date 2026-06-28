# 의존성(Dependency) 리뷰

## 발견사항

### 새 의존성

- **[INFO]** `QueryFailedError` import 추가 (테스트 파일)
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` line 4
  - 상세: `typeorm` 패키지의 `QueryFailedError` 를 spec 파일에서 import. `typeorm` 은 이미 `package.json` 의 `dependencies` 에 `"typeorm": "^0.3.28"` 로 선언된 기존 의존성이다. 신규 외부 패키지 추가 없음.
  - 제안: 해당 없음 — 기존 의존성 재사용이므로 문제 없음.

- **[INFO]** `HttpException`, `HttpStatus` import 추가 (테스트 파일)
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` lines 35–36
  - 상세: `@nestjs/common` 의 기존 심볼을 테스트에서 추가 사용. 신규 패키지 없음.
  - 제안: 해당 없음.

### 버전 고정

- **[INFO]** 이번 변경에서 `package.json` / `package-lock.json` 변경 없음
  - 상세: 모든 변경은 기존 의존성(`@nestjs/common`, `typeorm`, `express`) 의 기존 API 를 재사용하거나, 내부 모듈 간 의존 관계를 조정하는 리팩터링이다. 새 외부 패키지가 추가되지 않았으므로 버전 고정 문제 없음.

### 라이선스

- **[INFO]** 신규 외부 패키지 없음 — 라이선스 검토 불필요
  - 상세: `typeorm`(MIT), `@nestjs/*`(MIT), `express`(MIT) 모두 기존 승인된 의존성이다.

### 취약점

- **[INFO]** 변경된 의존성 없음 — 신규 취약점 도입 위험 없음
  - 상세: 이번 변경은 패키지 추가/버전 변경을 수반하지 않는다.

### 불필요한 의존성

- **[INFO]** 불필요한 의존성 도입 없음
  - 상세: 모든 import 는 기존 의존성 범위 내에 있으며, 표준 라이브러리로 대체 가능한 패키지를 추가한 사례가 없다.

### 내부 의존성

- **[INFO]** `HooksService` → `ExecutionsService` 의존 방향 개선
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` lines 884–895
  - 상세: 기존 코드는 `this.executionsService['executionRepository']?.findOne?.(...)` 형태의 private 브래킷 접근을 사용하여 `ExecutionsService` 의 내부 구현에 직접 의존했다. 이번 변경으로 `ExecutionsService.getStatusById(executionId)` 공개 API 를 통해 접근하도록 캡슐화했다. 내부 모듈 간 의존 경계가 올바르게 정비된 것으로, 의존성 방향 관점에서 긍정적인 변화다.
  - 제안: 해당 없음 — SRP 준수 개선.

- **[INFO]** `hooks.service.spec.ts` 의 mock 에 `executionRepository` 잔류
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` lines 1619–1633
  - 상세: `getStatusById` 로 공개 API 를 노출하면서 테스트 mock 에서는 `executionRepository.findOne` 에 `getStatusById` 를 위임하는 패턴을 사용한다. 이 과정에서 mock 객체에 `executionRepository` 가 여전히 노출되어 있고, 테스트 내부 일부에서 (`lines 2345–2352`, `2481–2487`) `moduleRef.get(ExecutionsService).executionRepository` 로 직접 접근한다. 프로덕션 코드의 캡슐화 개선과 달리 테스트는 여전히 내부 구현 디테일에 의존하는 구조가 잔류한다.
  - 제안: 장기적으로 `getStatusById` mock 을 직접 제어하는 방향(예: `getStatusById: jest.fn().mockResolvedValue(null)`)으로 테스트를 정비하여 내부 구현 의존을 완전히 제거하는 것이 바람직하다. 다만 이번 변경의 주 목적이 "23개 테스트 사이트를 건드리지 않고 캡슐화만 달성"하는 것임을 주석으로 명시하고 있으므로, 현재 접근은 실용적인 마이그레이션 패턴이다. 기술 부채로 추적 권장.

- **[INFO]** `extractClientIpFromHeaders` 반환형 변경: `string | null` → `string | undefined`
  - 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts` line 556
  - 상세: 내부 유틸리티 함수의 반환 타입 변경이 `hooks.service.ts` 소비처(line 1527–1528, 1545–1546, 2554–2555)에 전파된다. 기존에는 `?? undefined` 로 null 을 undefined 로 변환하던 코드가 제거되었다. TypeScript 타입 시스템상 `string | undefined` 를 기대하는 소비처와의 정합이 확인된다. 다만 `extractClientIp` 함수(req 폴백 포함) 는 여전히 `string | null` 을 반환하여 두 함수의 반환 타입이 불일치한다(`line 610`). 두 함수를 혼용하는 소비처가 생기면 `null` vs `undefined` 혼용 버그로 이어질 수 있다.
  - 제안: `extractClientIp` 의 반환 타입도 `string | undefined` 로 통일하거나, 두 함수의 반환 타입 불일치를 JSDoc/주석으로 명확히 문서화할 것을 권장한다.

## 요약

이번 변경은 신규 외부 패키지 추가 없이 기존 의존성(`@nestjs/common`, `typeorm`, `express`) 의 API 를 재사용하거나 내부 모듈 간 의존 경계를 정비하는 리팩터링이다. 특히 `HooksService` 가 `ExecutionsService` 의 private 레포지토리를 브래킷 접근하던 방식을 공개 API `getStatusById` 로 교체한 것은 올바른 캡슐화 방향이며, 의존성 관점에서 추가 위험 요소는 발견되지 않는다. 테스트 코드에 잔류한 `executionRepository` 직접 접근과 `extractClientIp`/`extractClientIpFromHeaders` 두 함수의 반환 타입 불일치(`null` vs `undefined`)는 기술 부채로 관리할 필요가 있다.

## 위험도

LOW
