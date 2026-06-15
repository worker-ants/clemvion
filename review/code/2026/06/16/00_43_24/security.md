# 보안(Security) 리뷰 결과

## 발견사항

### 긍정적 구현 사항

- **[INFO]** IP/CIDR 저장 시점 형식 검증 도입 (is-ip-or-cidr.validator.ts)
  - 위치: `codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts`
  - 상세: `ip-address` 라이브러리의 `Address4.isValid` / `Address6.isValid` 를 사용하여 런타임 파싱 기준과 동일한 수용 조건으로 저장 시점 검증. 화이트리스트 주입 공격(IP 스푸핑 우회) 을 방어하는 핵심 입력 검증 계층.

- **[INFO]** 평문 비밀값 30초 자동 클리어 (page.tsx)
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx`, 라인 1251-1267
  - 상세: `generatedKey` / `revealedSecret` 을 `useEffect` + `window.clearTimeout` 으로 관리하여 언마운트 시 타이머 누수 제거. 기존 `window.setTimeout` 단독 호출(cleanup 없음) 대비 stale clear 위험 제거. XSS 공격자가 setTimeout 콜백이 실행되기 전 평문을 읽어내는 공격 창을 30초로 제한하는 효과.

---

### 경고 및 지적사항

- **[WARNING]** `0.0.0.0/0` 전체 허용 CIDR 를 유효한 값으로 수용
  - 위치: `codebase/backend/src/modules/auth-configs/dto/auth-config-ip-whitelist.dto.spec.ts`, 라인 53
  - 상세: 테스트 주석 "전체 허용 CIDR (프론트엔드 검증과 동일 수용)" 로 표기되어 있으나, `0.0.0.0/0` 은 사실상 IP 화이트리스트를 무효화하는 값이다. 사용자가 이 값을 저장하면 화이트리스트 기능 자체가 우회된다. 의도적 설계라면 문서화가 필요하고, 비의도적이라면 저장 계층에서 경고하거나 거부해야 한다.
  - 제안: `isIpOrCidr` 또는 서비스 계층에서 `0.0.0.0/0` / `::/0` 입력 시 경고 메시지를 반환하거나, 프론트엔드 힌트에 "전체 허용 CIDR 은 화이트리스트를 비활성화합니다" 라는 안내를 추가한다.

- **[WARNING]** `config` 필드가 `Record<string, unknown>` 으로 스키마 없이 수용됨
  - 위치: `codebase/backend/src/modules/auth-configs/dto/create-auth-config.dto.ts`, 라인 373
  - 상세: `config` 는 `@IsObject()` 만 검증하고 내부 키/값 검증이 없다. type 이 `api_key` 이면 `config.headerName` 이, `hmac` 이면 `config.algorithm` 등이 올 수 있는데, 임의의 JSON 구조가 암호화되어 DB 에 저장된다. 악의적 대형 payload 나 예상치 않은 키 injection 가능성이 있다.
  - 제안: type 별 discriminated union DTO 또는 별도 config 스키마 검증(최소한 `MaxLength` 혹은 크기 제한, 허용 키 allowlist)을 추가한다.

- **[WARNING]** 프론트엔드에서 비밀값이 React 상태(state)에 평문으로 보관됨
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx`, 라인 1238, 1245
  - 상세: `generatedKey` 와 `revealedSecret` 은 React state 에 저장되므로 React DevTools, 브라우저 메모리 dump, 크롬 확장 등을 통해 노출 가능하다. 30초 자동 클리어가 노출 창을 제한하지만 메모리 상 평문이 GC 될 때까지 잔류한다.
  - 제안: 현재 구조에서는 허용 범위 내 위험이나, 가능하면 표시 직후 사용자가 "복사 완료" 확인 시 즉시 클리어하는 UX 를 추가로 제공하는 것이 권장된다.

- **[WARNING]** 테스트 코드에 `"hunter2"` 평문 비밀번호 사용
  - 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/generated-key-autoclear.test.tsx`, 라인 799
  - 상세: 테스트에 `"hunter2"` 가 사용되고 있다. 테스트 코드이므로 실제 자격증명 노출 위험은 없으나, 테스트 비밀번호는 상수로 분리하거나 `"test-password"` 같은 명시적인 테스트 전용 값을 사용하는 것이 관행이다. 현재로선 실질적 위험 없음.
  - 제안: 테스트 비밀번호를 `const TEST_PASSWORD = "test-reveal-password";` 상수로 분리한다.

---

### 정보 및 관찰

- **[INFO]** `IsIpOrCidrConstraint` 가 stateless 싱글턴으로 설계됨 (race condition 회피)
  - 위치: `codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts`, 라인 444-454
  - 상세: class-validator 싱글턴 패턴에서의 경쟁 상태를 주석으로 명시하고 instance field 를 사용하지 않는 설계. 올바른 구현.

- **[INFO]** `빈 배열 → 통과` 정책 (전체 삭제 의도)
  - 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts`
  - 상세: 빈 배열 전송 시 화이트리스트가 전체 삭제된다. 이는 "IP 화이트리스트 없음 = 모든 IP 허용" 인 경우 보안 수준 저하를 의미한다. 런타임 평가 로직에서 `ip_whitelist = []` 일 때 모든 IP 를 허용하는지 아니면 모두 차단하는지 spec 이 명확히 정의되어 있어야 한다. spec/1-data-model.md §2.17 변경 내용에는 이 정책이 명시되지 않았음.
  - 제안: spec 에 "ip_whitelist 가 빈 배열이면 화이트리스트 미설정(모든 IP 허용)으로 동일 취급" 여부를 명시한다.

- **[INFO]** 에러 메시지에 민감 정보 미노출 확인
  - 위치: `codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts`, 라인 451-453
  - 상세: `defaultMessage` 는 property 이름과 일반 안내 문구만 반환하며 입력값 자체를 에러에 포함하지 않음. 양호.

- **[INFO]** 프론트엔드 IP 화이트리스트 입력이 textarea 로 구현됨
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx`, 라인 1679-1685
  - 상세: `validateAuthConfigForm` 에서 클라이언트 측 IP/CIDR 형식 검증을 수행하므로 백엔드 검증 도달 전 차단이 가능하다. 클라이언트 검증 우회 시 백엔드 `@IsIpOrCidr` 가 최종 방어선으로 작동. 이중 방어 구조 양호.

---

## 요약

이번 변경의 핵심은 IP 화이트리스트 저장 시점 형식 검증(`@IsIpOrCidr`) 도입과 평문 비밀값 30초 자동 클리어 개선이다. 두 기능 모두 보안 강화 방향으로 올바르게 구현되었다. 특히 `ip-address` 라이브러리의 `isValid` 를 런타임 파싱 기준과 동일하게 사용하여 저장-런타임 drift 를 제거한 점, `useEffect` cleanup 으로 타이머 누수를 제거한 점은 긍정적이다. 다만 `0.0.0.0/0`(전체 허용 CIDR) 수용 정책이 화이트리스트 무력화로 이어질 수 있어 사용자 안내 또는 정책 명시가 필요하고, `config` 필드의 스키마 없는 수용이 임의 payload 저장 위험을 내포한다. 이 두 항목을 제외하면 변경 전반의 보안 수준은 향상되었다.

## 위험도

LOW
