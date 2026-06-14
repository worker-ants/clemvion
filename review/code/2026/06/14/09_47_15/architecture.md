# Architecture Review

## 발견사항

### [WARNING] God Component — 단일 책임 원칙(SRP) 위반 심화
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx`
- 상세: `AuthenticationPage` 컴포넌트는 이번 변경으로 상태 변수가 더 추가되어 (formApiKeyHeader, formIpWhitelist) 이미 비대한 컴포넌트의 책임이 더 커졌다. 하나의 컴포넌트가 6개 이상의 모달 흐름(생성·재생성·Reveal·삭제·Reveal 표시·비밀 표시) + 5개 mutation + 2개 query + 다수의 form state를 직접 관리한다. 컴포넌트가 약 750줄에 달하며, 새 type 필드(bearer_token 같은 추가 type)가 생길 때마다 이 파일을 수정해야 하므로 OCP도 위반한다.
- 제안: 생성 폼을 `AuthConfigCreateForm` 컴포넌트로 분리하고, type별 추가 입력 필드를 `ApiKeyFields`, `HmacFields`, `BasicAuthFields` 등의 서브컴포넌트로 추출한다. IP Whitelist textarea도 `IpWhitelistInput` 컴포넌트로 분리하면 재사용성과 테스트 용이성이 높아진다.

### [WARNING] 비즈니스 로직이 프레젠테이션 레이어에 혼재
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx`, lines ~488-497 (createMutation.mutationFn 내부)
- 상세: IP Whitelist 파싱 로직(split→trim→filter)과 api_key headerName 조건 분기가 `mutationFn` 안에 직접 작성되어 있다. 이는 프레젠테이션 컴포넌트에 데이터 변환 비즈니스 로직이 내장된 형태로, 레이어 책임 분리 원칙에 어긋난다.
- 제안: `buildCreateAuthConfigPayload(formState): CreateAuthConfigDto` 같은 순수 함수로 페이로드 조립 로직을 추출한다. 이 함수는 독립적으로 단위 테스트할 수 있고, 폼 컴포넌트는 조립 결과만 전달한다.

### [INFO] 테스트가 Page 컴포넌트 전체를 통합 테스트로 검증 — 적절한 격리 범위
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx`
- 상세: 테스트는 Page 컴포넌트를 전체 렌더링하고 apiClient와 role-gate만 mock 처리한다. 위의 WARNING에서 지적한 것처럼 비즈니스 로직이 컴포넌트에 내장되어 있기 때문에 현재 구조에서는 이 방식이 불가피하다. 단, 페이로드 조립 함수를 분리하면 `buildCreateAuthConfigPayload`에 대한 순수 단위 테스트를 별도로 작성할 수 있어 테스트 피라미드 구조가 개선된다.
- 제안: 현 테스트 방식은 이 PR 범위에서 허용 가능하나, 리팩토링 시 페이로드 조립 로직 분리와 함께 단위 테스트를 보완한다.

### [INFO] rawTextarea 직접 사용 — 디자인 시스템 일관성 이슈
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx`, IP Whitelist textarea 렌더링 부분
- 상세: IP Whitelist 입력에 `<textarea>` 를 직접 사용하며 인라인 Tailwind 클래스로 스타일을 지정한다. 동일한 프로젝트에서 `<Input>`, `<Button>` 등 디자인 시스템 컴포넌트를 사용하는 패턴과 불일치한다. 향후 테마·포커스링 변경 시 이 textarea만 누락될 위험이 있다.
- 제안: `@/components/ui/textarea` 컴포넌트가 존재하면 그것을 사용하고, 없으면 추가한다. 인라인 클래스 대신 디자인 시스템 컴포넌트를 일관되게 사용해야 모듈 경계와 UI 추상화 레이어가 유지된다.

### [INFO] IP 화이트리스트 검증 책임 위치 — 클라이언트 측 검증 부재
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx`
- 상세: IP/CIDR 형식 검증이 프런트엔드에 전혀 없다. 잘못된 형식의 IP 문자열이 그대로 백엔드로 전송된다. 현재는 "split + trim + filter empty" 만 수행하며, 형식 오류는 백엔드 DTO 검증에서 처리되어 에러가 반환된다. 이 자체가 잘못은 아니지만(백엔드가 SoT), UX 관점에서 기본적인 형식 체크(간단한 정규식)를 프런트에서 해주면 왕복 비용을 줄일 수 있다.
- 제안: 필수 대응은 아니나, 향후 IpWhitelistInput 컴포넌트로 분리 시 내부에 기본 형식 검증을 포함한다.

### [INFO] i18n 딕셔너리 — 타입 안전성 유지 확인
- 위치: `codebase/frontend/src/lib/i18n/dict/en/authentication.ts`, `codebase/frontend/src/lib/i18n/dict/ko/authentication.ts`
- 상세: en 딕셔너리는 `Dict["authentication"]` 타입을 명시적으로 선언하고, ko 딕셔너리는 `as const`만 사용한다. 이 불일치는 기존 패턴으로 이번 PR에서 새로 도입된 것은 아니나, 새로운 키(apiKeyHeaderLabel, ipWhitelistLabel, ipWhitelistHint)가 양쪽 파일에 모두 추가되어 동기화는 올바르게 유지되고 있다.
- 제안: 이번 변경 범위에서는 문제 없음. 장기적으로 ko 딕셔너리도 타입 명시적 선언으로 통일하면 타입 검사 레이어가 일관된다.

---

## 요약

이번 변경은 §A.2 스펙에서 요구하는 IP Whitelist 입력 UI와 API Key Header 이름 필드를 최소한의 범위로 구현한 것으로, 기능적 범위 자체는 적절하다. 다만 기존 `AuthenticationPage`의 God Component 문제를 심화시키는 방향으로 상태와 로직이 추가되었다 — IP 파싱과 headerName 조건 분기가 mutationFn에 직접 내장되어 레이어 책임 분리가 이루어지지 않았고, rawTextarea 직접 사용은 디자인 시스템 일관성을 깨뜨린다. 이번 PR의 기능 완성도는 스펙과 일치하나, 컴포넌트 분리(CreateForm + type별 Fields + IpWhitelistInput)와 페이로드 조립 순수 함수 추출을 후속 리팩토링으로 진행해야 컴포넌트의 확장성과 테스트 용이성이 회복된다.

---

## 위험도

LOW
