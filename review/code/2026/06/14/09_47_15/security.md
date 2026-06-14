# 보안(Security) 리뷰

리뷰 대상: IP Whitelist UI + API Key Header 이름 입력 필드 추가 (§A.2)

---

## 발견사항

### [WARNING] 클라이언트 측 IP/CIDR 입력에 대한 형식 검증 부재

- **위치**: `codebase/frontend/src/app/(main)/authentication/page.tsx` — `formIpWhitelist` 파싱 로직 (라인 276-280)
- **상세**: `formIpWhitelist.split("\n").map(trim).filter(非空)` 로 배열을 만들고 그대로 백엔드에 전송한다. 클라이언트 측에서 각 항목이 유효한 IP 주소나 CIDR 표기법(`0.0.0.0/0`, `::1/128` 등)인지 검증하지 않는다. 사용자가 임의 문자열(`javascript:alert(1)`, `; rm -rf /`, 공격자가 의도한 값)을 제출할 수 있다. 실질적 취약점 여부는 백엔드 DTO 검증에 달려 있으나, 프런트에서 전혀 걸러내지 않으면 (a) UX 피드백 없이 잘못된 데이터가 서버로 전달되고, (b) 만약 백엔드 검증도 미흡하다면 IP 화이트리스트 우회(예: `0.0.0.0/0` 전체 허용)가 조용히 설정될 수 있다.
- **제안**: `textarea` 제출 시 각 항목을 정규식(`/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^[0-9a-fA-F:]+\/\d{1,3}$|^[0-9a-fA-F:]+$/`)으로 검증하거나, 백엔드 DTO에서 `@IsIP()` / `@IsCIDR()` 등 클래스-밸리데이터 데코레이터 적용을 확인하고 프런트에도 동일 수준의 검증을 추가한다.

---

### [WARNING] API Key 헤더 이름 입력에 대한 형식 검증 부재

- **위치**: `codebase/frontend/src/app/(main)/authentication/page.tsx` — `formApiKeyHeader` 처리 (라인 266-270)
- **상세**: `formApiKeyHeader.trim()`만 수행하고 HTTP 헤더명으로 유효한 값인지 검증하지 않는다. RFC 7230 기준으로 헤더 이름은 토큰 문자(`[!#$%&'*+\-.^_\`|~0-9A-Za-z]`)만 허용하며, 개행·콜론·공백 등이 포함되면 HTTP 응답 분할(Response Splitting) 위험이 있다. 이 값이 웹훅 요청의 헤더명으로 활용된다는 점에서 인젝션 위험이 있다.
- **제안**: 헤더 이름 입력을 `/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/` 정규식으로 검증하거나, UI에서 최대 길이(일반적으로 256자)를 제한한다. 백엔드 DTO에서도 동일 검증을 강제한다.

---

### [WARNING] 생성된 비밀키(generatedKey)가 React 상태에 잔존

- **위치**: `codebase/frontend/src/app/(main)/authentication/page.tsx` — `resetForm` 함수 및 생성 성공 후 흐름 (라인 581-592)
- **상세**: `generatedKey`는 생성 성공 후 React state에 저장되고, `resetForm()` 호출(Done 버튼 또는 X 버튼)이 호출될 때 `setGeneratedKey(null)`로 초기화된다. 그러나 Dialog 외부 클릭이나 ESC 등 다른 dismiss 경로에서 `resetForm`이 호출되는지 확인이 필요하다. Dialog 안에 평문 키를 보여주는 컴포넌트(`<code>{generatedKey}</code>`)가 렌더링되는 동안 브라우저 개발자도구 DOM 검사나 React DevTools로 키가 노출될 수 있다. 생성 키 자체가 SPA 메모리에 남는 것은 현재 설계 의도이지만, 30초 자동 숨김(`revealedSecret`처럼)이 `generatedKey`에는 적용되지 않아 탭을 열어놓는 동안 무기한 메모리에 보유된다.
- **제안**: `generatedKey`도 `revealedSecret`과 동일하게 30초 자동 클리어 타이머를 적용한다. 또한 Dialog에 `onClickOutside`·`onKeyDown(Escape)` dismiss 핸들러가 `resetForm`을 호출하는지 확인한다.

---

### [INFO] IP Whitelist `0.0.0.0/0` 또는 `::/0` 전체 허용에 대한 UI 경고 없음

- **위치**: `codebase/frontend/src/app/(main)/authentication/page.tsx` — IP Whitelist textarea (라인 322-338)
- **상세**: 사용자가 `0.0.0.0/0`(IPv4 전체) 또는 `::/0`(IPv6 전체)을 입력하면 IP 화이트리스트가 사실상 비활성화된다. 이는 기능상 정상 동작이나, UX 레벨에서 "전체 허용 = 화이트리스트 없음과 동일" 임을 경고하지 않으면 운영자가 의도치 않게 과도한 접근을 허용할 수 있다.
- **제안**: 전체 허용 CIDR 감지 시 인라인 경고(`"⚠ 이 설정은 모든 IP를 허용합니다"`)를 표시한다.

---

### [INFO] 테스트에서 `useHasRole`을 항상 `true`로 mock

- **위치**: `codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx` — 라인 60-62
- **상세**: `vi.mock("@/components/auth/role-gate", () => ({ useHasRole: () => true }))` 는 테스트 격리를 위한 의도적 설계이나, 이 mock이 권한 없는 사용자가 IP Whitelist 입력 필드를 렌더링/전송 가능한지 여부를 검증하는 테스트를 누락시킨다. IP Whitelist·Header 이름 입력은 현재 모든 인증 타입 선택 시 노출되고 특별한 권한 제한이 없는 것으로 보이나, 권한별 접근 제어 테스트가 없어 의도 확인이 어렵다.
- **제안**: 테스트 범위의 INFO 수준 사항이므로 차단 이슈는 아니다. 다만, 인증 설정 생성 자체가 Admin/Editor 한정이라면 해당 권한 검증 테스트를 추가하는 것이 좋다.

---

### [INFO] 에러 처리에서 민감 정보 미노출 — 적절

- **위치**: `codebase/frontend/src/app/(main)/authentication/page.tsx` — `onError` 핸들러들 (라인 511-513, 525-527 등)
- **상세**: 모든 mutation의 `onError`는 i18n 번역 키를 통한 일반 에러 메시지만 표시하고, 서버 응답의 구체적인 에러 내용이나 스택 트레이스를 노출하지 않는다. 이는 보안 관점에서 올바른 구현이다.
- **제안**: 해당 없음. 현행 유지.

---

### [INFO] 평문 비밀키 클립보드 복사 — 의도된 설계

- **위치**: `codebase/frontend/src/app/(main)/authentication/page.tsx` — `copyToClipboard` 및 생성 키 표시 (라인 606-611, 644-661)
- **상세**: 생성된 평문 키를 `navigator.clipboard.writeText()`로 복사한다. 클립보드는 OS 및 다른 앱에서 접근할 수 있어 잠재적인 노출 경로가 존재하나, 이는 시크릿 관리 도구 전반의 표준 UX 패턴이며 사용자가 명시적으로 복사 버튼을 눌러야 실행된다. `revealedSecret` 30초 자동 숨김은 구현되어 있다.
- **제안**: 해당 없음. 현행 설계 의도와 합치.

---

## 요약

이번 변경은 인증 설정 생성 폼에 IP Whitelist 텍스트에어리어와 API Key 헤더 이름 입력 필드를 추가하는 프런트엔드 UI 변경이다. 전반적으로 에러 처리는 민감 정보를 노출하지 않고, 비밀키 평문 표시는 스펙에 따른 의도된 설계다. 가장 주요한 보안 우려는 **클라이언트 측 입력 검증 부재** 두 건이다: IP/CIDR 형식 검증이 없으면 잘못된 화이트리스트가 조용히 등록될 수 있고, 헤더 이름 검증이 없으면 RFC 7230 위반 문자가 포함될 수 있다. 두 항목 모두 백엔드 DTO 검증이 방어 최후선이 되므로, 백엔드에서의 검증 여부를 확인하고 프런트에서도 동일 수준 검증을 추가하는 것을 권고한다. `generatedKey` 자동 클리어 타이머 누락은 메모리 잔존 민감 데이터 측면의 낮은 수준 우려다.

---

## 위험도

MEDIUM
