# Requirement Review — config-c2-autoclear-isip

## 발견사항

### **[INFO]** [SPEC-DRIFT] `generatedKey` 30초 자동클리어가 spec 본문에 미기재
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` L153–161 + 테스트 파일 전체
- 상세: spec/2-navigation/6-config.md §A.4 line 118 은 **Reveal 흐름**에 대해 "평문 표시 + 30초 후 자동 hide" 를 명시한다. 그런데 이번 변경은 **create/regenerate 경로의 `generatedKey`** 에도 동일한 30초 자동클리어 `useEffect` 를 추가했다. spec §A.4 의 Reveal 흐름 서술만으로는 create/regenerate 경로에 동일 정책이 적용돼야 한다는 명세가 없다. 단 코드 주석 자체가 "reveal 경로의 30초 자동 hide 와 동일 정책" 으로 의도를 명시하고 있어, 이는 보안을 강화하는 **합리적·의도적 확장** — 코드를 되돌리는 것이 오답이다.
- 제안: 코드 유지 + spec 갱신. `spec/2-navigation/6-config.md §A.4` 또는 §A.2 에 "create / regenerate 응답의 평문(`generatedKey`)도 30초 후 자동 클리어" 행동을 명시하도록 spec 본문에 반영 필요 (`project-planner` 위임).

---

### **[WARNING]** `revealedSecret` 타이머가 언마운트 시 정리되지 않음
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` L282–283 (`revealMutation.onSuccess` 내부)
- 상세: 이번 변경은 `generatedKey` 에는 `useEffect` + `clearTimeout` 으로 안전하게 타이머를 관리하지만, `revealedSecret` 의 30초 타이머(L283 `window.setTimeout`)는 `useMutation.onSuccess` 콜백 안에 **날 setTimeout** 으로만 설정돼 있다. 언마운트 시 이 타이머가 정리되지 않아, 컴포넌트가 이미 사라진 뒤 `setRevealedSecret(null)` 이 호출되면 React "Can't perform a state update on an unmounted component" 경고 또는 stale closure 동작이 발생할 수 있다. 이번 PR 목표 (`generatedKey autoclear`) 와 대칭되어야 하는 부분임에도 `revealedSecret` 경로는 개선되지 않았다.
- 제안: `revealedSecret` 도 `useEffect([revealedSecret], ...)` 패턴으로 `generatedKey` 와 동일하게 처리하거나, 최소한 `clearTimeout` 을 `resetForm` 이나 언마운트 클린업에 포함시킨다. `generatedKey` 와 `revealedSecret` 의 30초 타이머를 단일 `useEffect` 로 통합하는 방식도 가능.

---

### **[INFO]** `isIpOrCidr` 가 IPv6 + prefix 초과 CIDR 을 실제로 거부하는지 라이브러리 동작 확인 필요
- 위치: `codebase/backend/src/modules/auth-configs/dto/is-ip-or-cidr.validator.ts` L397–399
- 상세: validator 는 `Address4.isValid(value) || Address6.isValid(value)` 를 사용한다. `ip-address` 라이브러리 기준 `Address4.isValid('192.0.2.0/33')` 가 false 를 반환하는지는 라이브러리 버전에 따라 다를 수 있다. 테스트(spec 파일 L98–102)가 `'192.0.2.0/33'` 을 무효로 기대하고 있으므로 실 테스트 통과 여부로 확인 가능 — 테스트가 존재하므로 실 CI 에서 반증됨. 심각한 결함은 아니지만 `Address6.isValid('::1/129')` 등 IPv6 prefix 초과 케이스의 테스트가 없음.
- 제안: IPv6 prefix 범위 초과 케이스(`2001:db8::/129`)를 무효 케이스에 추가해 `isIpOrCidr` 가 양쪽 프로토콜의 prefix 범위 초과를 거부함을 명시적으로 보장한다.

---

### **[INFO]** 테스트에서 `basic_auth` 생성 후 `generatedKey` 미노출 경로 미검증
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/generated-key-autoclear.test.tsx`
- 상세: 테스트는 `api_key` 타입만 다루어 `generatedKey` 가 설정될 때의 30초 자동클리어를 검증한다. `basic_auth` 는 `pickPlaintextSecret` 가 `null` 을 반환해 `generatedKey` 를 설정하지 않는 분기(L1063–1065 `if (!secret) { resetForm(); }`)를 테스트하지 않는다. 해당 분기는 간단하고 로직도 명확해 주요 결함은 아니나, 커버리지 공백.
- 제안: 필요시 `basic_auth` 생성 시 `generatedKey` 가 설정되지 않음을 확인하는 단위 케이스 추가.

---

### **[INFO]** spec/2-navigation/6-config.md 의 `generatedKey` 자동클리어 언급이 "구현 현황" 노트에만 있음
- 위치: `spec/2-navigation/6-config.md` L55 (구현 현황 note)
- 상세: L55 의 "구현 현황" 인라인 note 는 IP Whitelist 저장 검증의 구현 사실을 문서화하고 있으나, create/regenerate 평문 30초 자동클리어는 spec 요구사항 본문에 없다. 이번 PR 의 spec 변경(`spec/1-data-model.md §2.17 ip_whitelist 행 갱신`)은 저장 검증 요구사항을 spec 에 반영했지만, `generatedKey` 30초 자동클리어 정책의 spec 반영은 이루어지지 않았다. (위 SPEC-DRIFT 발견과 동일 맥락.)

---

## 기능 완전성 평가

**백엔드 IP Whitelist 저장 검증**: `CreateAuthConfigDto` 와 `UpdateAuthConfigDto` 에 `@IsIpOrCidr({ each: true })` 가 정확히 추가됐다. `isIpOrCidr` 함수는 `AuthConfigsService.parseIp` 와 동일한 `ip-address` 라이브러리 기준을 재사용해 저장 검증과 런타임 평가 사이의 drift 를 제거했다. spec/1-data-model.md §2.17 `ip_whitelist` 필드 정의도 "저장 시 형식 검증 + 400 거부" 를 명시하도록 갱신됐다. 단위 테스트가 IPv4/IPv6/CIDR 유효·무효·비문자열 케이스를 모두 포괄한다.

**프론트엔드 generatedKey 자동클리어**: `useEffect([generatedKey])` 패턴이 정확하게 구현됐다 — 값이 없으면 early return, 30_000ms 후 null 설정, cleanup 에서 clearTimeout. 언마운트 및 `generatedKey` 변경 시 타이머 누수가 없다. 그러나 대칭되어야 할 `revealedSecret` 타이머는 여전히 날 setTimeout 이어서 언마운트 안전성이 부족하다(WARNING 항목).

## 요약

변경이 의도한 두 기능 — (1) `ip_whitelist` 항목의 DTO 수준 형식 검증 (저장 시 400 거부), (2) 생성·재생성 후 평문 키의 30초 자동클리어 — 은 코드 레벨에서 완전히 구현되어 있다. spec/1-data-model.md §2.17 갱신으로 저장 검증 요구사항도 반영됐다. 단 `revealedSecret` 의 타이머가 언마운트 시 정리되지 않는 비대칭 문제(WARNING)가 있으며, spec/2-navigation/6-config.md §A.4 에 create/regenerate 경로의 30초 자동클리어 정책이 아직 명시되지 않았다(SPEC-DRIFT / INFO). IPv6 prefix 초과 CIDR 케이스의 테스트 커버리지 공백도 존재한다(INFO).

## 위험도

LOW
