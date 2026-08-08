# 아키텍처(Architecture) 리뷰 — secret-resolver.service.ts

## 발견사항

발견사항 없음. 이번 변경은 `SecretResolverService.assertRefFormat()` 내부의 `const refStr: string = ref as unknown as string;` 에서 이중 캐스트(`as unknown as string`)를 제거하고 주석을 보강한 것뿐이다(`codebase/backend/src/modules/secret-store/secret-resolver.service.ts` 함수 `assertRefFormat`). 클래스 구조, 책임 분리, 의존성 그래프, 레이어 경계, 퍼블릭 API 시그니처는 전혀 변경되지 않았다.

- **[INFO]** `isSecretRef` 타입가드의 negative-branch narrowing 특성
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` 함수 `assertRefFormat` (약 56~70행 부근, 클래스 `SecretResolverService`)
  - 상세: `isSecretRef(value: string): value is string` 형태의 타입가드가 입력 타입과 narrowing 대상 타입이 동일(`string`)해서, `!isSecretRef(ref)` 분기에서 `ref` 가 `never` 로 좁혀진다. 그 결과 `const refStr: string = ref;` 라는 우회 대입이 매 호출부마다 필요해지는데, 이는 기능상 문제는 아니지만 타입가드 설계가 "포맷 검증"이라는 의도를 타입 시스템에 정확히 표현하지 못하고 있다는 신호다(예: 브랜드 타입 `type SecretRef = string & { __brand: 'SecretRef' }` 를 썼다면 `never` 좁힘 우회 코드 자체가 불필요했을 것). 이번 diff 의 스코프는 아니며 즉시 조치가 필요한 결함도 아니다.
  - 제안: 향후 `secret-ref.ts` 를 다시 만질 기회가 있다면 브랜드 타입 도입을 검토(선택 사항, 이번 PR 범위 밖).

## 요약

diff 는 lint 규칙(`no-unnecessary-type-assertion`)이 지목한 불필요한 이중 타입 캐스트(`as unknown as string`)를 제거하고, 왜 캐스트 없이도 안전한지(`never` 는 bottom type 이라 모든 타입에 대입 가능) 를 설명하는 주석으로 대체한 것이 전부다. `SecretResolverService` 의 단일 책임(secret store 단일 진입점), Repository 패턴을 통한 영속성 계층 분리, 도메인 모듈과의 결합 경계, 퍼블릭 메서드 시그니처는 모두 그대로다. 오히려 `as unknown as X` 이중 캐스트는 타입 검사를 완전히 무력화하는 안티패턴인데 이를 제거했으므로 타입 안전성 측면에서는 미세하게 개선된 방향이다. 순환 의존성, 레이어 위반, 결합도/응집도, 확장성에 영향을 주는 요소는 발견되지 않았다.

## 위험도

NONE
