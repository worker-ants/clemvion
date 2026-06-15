# Architecture Review

## 발견사항

### [INFO] 커스텀 Validator 의 레이어 배치가 적절
- 위치: `codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts`
- 상세: `IsIpOrCidrConstraint`가 `ValidatorConstraintInterface`를 구현하며 class-validator의 공식 확장 패턴을 따른다. 순수 함수(`isIpOrCidr`)와 데코레이터(`IsIpOrCidr`)가 동일 파일에 공존하지만, 두 역할이 응집력 있게 묶여 있다. DTO 레이어가 데이터 포맷 검증만 담당하고 비즈니스 로직(ip_whitelist 필터링)은 서비스 레이어에 분리된 것은 레이어 책임 원칙을 준수한다.
- 제안: 유지.

### [INFO] isIpOrCidr 순수 함수와 런타임 parseIp 간 동일 라이브러리 기반 수용 기준 — drift 방지 설계
- 위치: `is-ip-or-cidr.validator.ts` L394–399 / `auth-configs.service.ts` L11
- 상세: DTO 검증(`Address4.isValid || Address6.isValid`)과 런타임 IP 매칭(`AuthConfigsService.parseIp`)이 동일한 `ip-address` 라이브러리를 사용해 "저장 가능 = 런타임 파싱 가능" 불변식을 유지한다. 이는 아키텍처적으로 좋은 설계(단일 정규화 기준)이며 spec이 명시적으로 요구한 제약을 구조적으로 강제한다.
- 제안: 유지.

### [WARNING] 프론트엔드 IP 검증 로직 중복 — 단일 진실 원칙 미흡
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` L24–54 (`isValidIpv6OrCidr`, `isValidIpOrCidr`)
- 상세: 프론트엔드에 독자적인 IP/CIDR 검증 구현(`isValidIpv6OrCidr`, `isValidIpOrCidr`)이 존재하고, 백엔드 DTO 검증(`is-ip-or-cidr.validator.ts`)과 별도 구현이다. 프론트엔드는 `ip-address` 라이브러리 없이 정규식 기반 pragmatic 검증을 수행하므로 두 구현의 수용 집합이 이론적으로 다를 수 있다. 예컨대 IPv4-mapped IPv6(`::ffff:192.0.2.1`)는 백엔드 spec 테스트에서 명시적으로 허용되나, 프론트엔드 `isValidIpv6OrCidr`의 hex-only 체크(`/^[0-9a-fA-F:]+$/`)가 이를 어떻게 처리하는지 명확하지 않다. 이런 검증 분기는 "백엔드가 거부하는데 프론트엔드는 통과" 또는 그 역의 UX 불일치를 초래할 수 있다.
- 제안: 공유 패키지(`packages/`)에 검증 함수를 두거나, 최소한 테스트로 양쪽의 수용 집합이 동일한지 교차 검증한다. 현재 프론트엔드 검증은 "입력 단계 UX 가드"로 주석에 명시되어 있어 의도적 단순화이지만, 테스트 커버리지로 불일치 범위를 문서화하는 것이 바람직하다.

### [WARNING] AuthenticationPage — 단일 컴포넌트에 과도한 책임 집중 (SRP 위반)
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx`
- 상세: 단일 컴포넌트가 ①목록 조회, ②생성 폼, ③편집 폼, ④삭제 확인 모달, ⑤재발급 확인 모달, ⑥reveal 비밀번호 모달, ⑦reveal 결과 표시 모달, ⑧사용량 상세 드로어, ⑨8개 이상의 mutation, ⑩폼 상태 10개 이상의 `useState` 를 직접 관리한다. 컴포넌트 라인 수가 약 700줄에 달하며, 새로운 인증 타입이나 UI 패턴 추가 시 파일 수정 범위가 전체에 걸친다. 이번 변경(`generatedKey` autoclear useEffect 추가)은 기능상 올바르나, 기존 SRP 문제가 있는 컴포넌트에 또 하나의 책임이 추가된 형태다.
- 제안: 점진적 분리 — `useAuthConfigMutations` 훅, `GeneratedKeyDisplay`, `RevealSecretDisplay`, `AuthConfigFormDialog` 같은 서브 컴포넌트/훅으로 분리. 이번 PR 범위 밖이지만 기술 부채로 기록.

### [WARNING] revealedSecret 30초 autoclear가 useEffect 없이 직접 setTimeout 사용 — 타이머 누수 위험
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` L1145–1147
- 상세: `generatedKey`에 대한 autoclear는 이번 PR에서 `useEffect` + cleanup 패턴으로 올바르게 구현되었다. 그런데 같은 파일의 `revealMutation.onSuccess` 내부에서 `revealedSecret`에 대한 30초 타이머는 여전히 `window.setTimeout(() => setRevealedSecret(null), 30_000)` 를 직접 호출하고 있어 cleanup 없이 처리된다. 컴포넌트 언마운트 시 `revealedSecret` 타이머는 정리되지 않아 stale setState 경고나 (엄격 모드에서) 에러가 발생할 수 있다. spec(§A.4)에서 두 경로(create/regenerate와 reveal)에 동일한 30초 정책을 규정하는데 구현이 비대칭이다.
- 제안: `revealedSecret`에 대해서도 `useEffect`로 동일한 cleanup 패턴 적용. `generatedKey` useEffect와 동일 구조로 `revealedSecret` 의존 useEffect를 추가.

### [INFO] IsIpOrCidrConstraint Stateless 구현 — 올바른 class-validator singleton 패턴
- 위치: `is-ip-or-cidr.validator.ts` L402–413
- 상세: `@ValidatorConstraint` 클래스가 instance field 없이 순수 메서드만 가져 singleton 인스턴스를 통한 race condition 가능성을 구조적으로 제거한다. 주석으로 의도가 명시된 점도 적절하다.
- 제안: 유지.

### [INFO] @IsString({each:true}) + @IsIpOrCidr({each:true}) 데코레이터 중복 가능성 — 허용 가능한 방어적 설계
- 위치: `create-auth-config.dto.ts` L343–344 / `update-auth-config.dto.ts` L584–585
- 상세: `@IsString({ each: true })`와 `@IsIpOrCidr({ each: true })` 를 함께 사용하는데, `isIpOrCidr`의 첫 체크가 `typeof value !== 'string'`이므로 `@IsString`이 먼저 거르는 역할이 의미 있다. 다만 `@IsIpOrCidr`가 비-문자열에도 false를 반환하므로 `@IsString`이 없어도 동작은 동일하다. 이 중복은 명시성(의도 표현)과 class-validator의 short-circuit 동작을 활용한 방어적 구현으로 허용 범위 내다.
- 제안: 유지 (명시적 방어 코드로 의미 있음).

### [INFO] 테스트 구조 — dto spec 파일의 테스트 레이어 구분 적절
- 위치: `auth-config-ip-whitelist.dto.spec.ts`
- 상세: 저수준 순수 함수 테스트(`isIpOrCidr`)와 DTO 통합 테스트(`CreateAuthConfigDto`, `UpdateAuthConfigDto`)를 명확히 구분한 `describe` 블록으로 구성해 단위/통합 레이어가 명확하다. 외부 DB/HTTP 의존성 없이 class-validator 계층만 검증하는 구조는 테스트 격리 원칙을 준수한다.
- 제안: 유지.

---

## 요약

이번 변경의 핵심은 두 가지다: (1) 백엔드 `ip_whitelist` DTO 검증을 위한 `IsIpOrCidr` 커스텀 validator 신규 추가, (2) 프론트엔드 `generatedKey` 30초 autoclear `useEffect` 추가. 백엔드 validator는 class-validator 확장 패턴을 준수하고, `ip-address` 라이브러리를 서비스 런타임 parseIp와 공유해 수용 기준 drift를 구조적으로 방지한다는 점에서 아키텍처적으로 올바르다. 프론트엔드 `generatedKey` autoclear는 useEffect cleanup 패턴으로 올바르게 구현되었으나, 같은 spec 정책(§A.4)을 따르는 `revealedSecret` 경로는 여전히 직접 setTimeout을 사용해 구현이 비대칭인 것이 주요 결함이다. 또한 프론트엔드에 독자적 IP 검증 로직이 존재해 백엔드 수용 집합과의 동기화 위험이 남아 있다. `AuthenticationPage`가 단일 컴포넌트에 다수 책임을 집중하는 구조는 이번 PR 이전부터 존재하는 기술 부채이며, 이번 변경이 그 부채를 심화하지는 않으나 해소도 하지 않는다.

## 위험도

MEDIUM
