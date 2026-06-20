# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] sessions.service.spec.ts — 반복 패턴: 두 findOne 분기 mock 중복
- 위치: sessions.service.spec.ts 라인 99-105, 122-127
- 상세: `'tokenHash' in where ? ... : ...` 패턴의 `mockImplementation`이 두 신규 테스트에서 동일하게 반복된다. 분기 로직 자체가 간결해 현 수준은 허용 범위이나, 향후 케이스가 늘면 헬퍼 `makeFindOneByField(tokenHashToken, ownedToken)` 등으로 추출하면 가독성이 올라간다.
- 제안: 현 2건은 허용. 동일 분기 3건 이상이 되면 테스트 헬퍼로 추출 권장.

### [INFO] sessions.service.spec.ts — `hashRaw` 함수가 spec 파일과 production 코드의 내부 구현을 미러링
- 위치: sessions.service.spec.ts 라인 168-170
- 상세: `hashRaw`는 `resolveCurrentFamilyId` 내부의 SHA-256 해시 계산을 그대로 복제한다. production 쪽 해시 알고리즘이 바뀌면 테스트 헬퍼도 함께 수정해야 하는 결합이 생긴다. 이는 `sessions.service.ts`에서 해시 로직이 private 메서드 안에 인라인되어 노출 불가한 구조적 한계에서 비롯된다.
- 제안: 중장기적으로 `createHash('sha256')...digest('hex')` 래핑을 `password.util.ts` 형태처럼 `token-hash.util.ts`로 추출하면 테스트·production 공유 가능. 현 changeset 범위 밖이므로 INFO.

### [INFO] sessions.service.ts — `resolveCurrentFamilyId`의 방어 가드(`if (!refreshToken)`)와 타입 불일치
- 위치: sessions.service.ts 라인 849-858
- 상세: 파라미터 타입이 `string`(null 불가)으로 선언되어 있으나 내부에 `if (!refreshToken) return null;` 런타임 가드가 존재한다. 타입 시그니처와 구현이 불일치하며, 호출부 `revokeFamily`가 `string | null`을 전달하므로 타입 오류가 발생하거나 암묵적 캐스팅에 의존할 수 있다. TypeScript strict mode 환경에서는 파라미터를 `string | null`로 넓혀야 타입과 로직이 일치한다.
- 제안: `private async resolveCurrentFamilyId(refreshToken: string | null): Promise<string | null>` 로 시그니처를 수정하거나, 호출부에서 null 체크 후 호출하도록 일관화.

### [INFO] webauthn.controller.ts — `mapCredential` private 메서드의 인라인 타입
- 위치: webauthn.controller.ts 라인 1662-1676
- 상세: `mapCredential`의 파라미터가 인터페이스 없는 인라인 구조체 타입으로 선언되어 있다. WebAuthn credential 엔티티 형상이 변경될 때 이 타입만 별도로 추적해야 한다. 이는 본 changeset 범위 밖이며 pre-existing이므로 INFO.
- 제안: 별도 리팩터링 시 credential entity 또는 DTO 타입을 직접 참조하도록 변경.

### [INFO] webauthn.controller.spec.ts — `payload` 픽스처가 describe 블록 외부에 선언되어 공유
- 위치: webauthn.controller.spec.ts 라인 1008-1013
- 상세: `payload` 상수가 `describe` 최상위에 선언되어 모든 중첩 describe에서 암묵적으로 공유된다. 현재는 변경 없이 안전하지만, 특정 테스트가 payload를 변경(mutation)하면 다른 테스트에 영향을 줄 수 있다. pre-existing 패턴이며 현 changeset은 이를 그대로 유지.
- 제안: 향후 readonly 단언(`as const`) 또는 `beforeEach` 내 재생성을 고려.

---

## 요약

이번 changeset은 `sessions.service.ts`에서 raw `bcrypt.compare`를 `comparePassword` 헬퍼로 교체하고, `webauthn.controller.ts`에서 13줄짜리 inline 검증 블록을 `authService.verifyPasswordForUser` 한 줄로 대체한 것이 핵심이다. 두 변경 모두 단일진실 원칙 정렬이라는 명확한 의도 아래 코드 양을 줄이고 책임 경계를 명확히 했으며, 전체 가독성과 레이어 일관성이 개선되었다. 추가된 테스트(`self-revoke` / `non-current family` / `webauthnRegenerateRecovery`)는 의도와 경계조건을 잘 설명한다. 지적 사항은 전부 INFO 수준이며 대부분 pre-existing 패턴 또는 본 changeset 범위 밖 구조적 개선 후보다. 유지보수성 관점에서 본 PR의 변경은 긍정적이다.

## 위험도

NONE
