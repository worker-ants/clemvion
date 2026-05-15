### 발견사항

---

**[INFO]** `interpolate()` 함수의 파라미터 바인딩이 안전하게 구현됨 (긍정적 발견)
- 위치: `core.ts:24-30`
- 상세: 정규식 `/\{\{\s*(\w+)\s*\}\}/g`이 `\w+`(영문자·숫자·언더스코어)로 플레이스홀더 이름을 제한하므로, 파라미터 키에 대한 인젝션 범위가 구조적으로 차단됨. `String(value)` 변환 결과는 React의 일반 JSX 렌더링에서 HTML 이스케이프가 적용되므로 XSS 경로 없음.

---

**[INFO]** `resolve()` 함수에서 dot-notation 경로 탐색 시 프로토타입 체인 노출 가능성
- 위치: `core.ts:17-23`
- 상세: `key.split(".")` 후 `current = current[part]` 패턴으로 dict 객체를 순회함. `\w+`에는 언더스코어가 포함되므로 이론상 `__proto__` 등의 키가 경로에 포함될 수 있음. 단, (1) `TranslationKey` 타입이 컴파일 타임에 유효한 키로 제한하고, (2) 최종 반환 전 `typeof current === "string"` 체크로 비문자열 값을 차단하므로 실질적 악용 가능성은 없음. 읽기 전용 탐색이므로 Prototype Pollution 위험도 없음.
- 제안: 현재 구현으로 충분하나, 방어적 코드로 `Object.hasOwn(current, part)` 체크를 추가하면 체인 탐색을 명시적으로 차단할 수 있음.

---

**[INFO]** `isLocale()` 타입 가드가 모든 외부 입력 경계에서 일관되게 적용됨 (긍정적 발견)
- 위치: `locale-store.ts:readStoredLocale()`, `locale-sync.tsx:16`
- 상세: localStorage 읽기값, 사용자 프로필의 `user.locale` 필드 모두 `isLocale()` 화이트리스트 검증 통과 후에만 store에 반영됨. `document.documentElement.lang` 조작도 검증된 값(`"ko"` | `"en"`)만 사용하여 DOM 속성 인젝션 불가.

---

**[INFO]** 서버 오류 메시지가 사용자에게 직접 노출됨 (기존 패턴 지속)
- 위치: 다수 파일의 `error.response?.data?.message` 참조부
- 상세: 백엔드 응답 메시지를 toast/화면에 그대로 전달하는 패턴이 이번 변경에서도 유지됨. 백엔드가 DB 오류 상세, 스택 트레이스, 내부 경로 등을 메시지에 포함할 경우 정보 노출(OWASP A05) 위험이 있음. 이번 i18n 작업에서 새로 도입된 문제는 아니나 개선 필요.
- 제안: API 오류 메시지를 사용자에게 표시 전 화이트리스트 필터링하거나, 알 수 없는 오류는 `t("common.error")` 같은 generic 키로만 표시.

---

**[WARNING]** `date.ts`의 `"use client"` 경계 부재로 서버 컨텍스트에서의 예외 처리 미흡
- 위치: `date.ts` 상단 (file not shown but referenced throughout)
- 상세: `"use client"` 없이 클라이언트 전용 `locale-store`를 임포트하여 서버 컴포넌트에서 사용 시 예외 발생 가능. 에러 핸들링 없는 런타임 실패가 서버 로그에 내부 경로/스택 트레이스를 기록할 수 있음. 직접적 보안 취약점은 아니나 서버 정보 노출 경로가 될 수 있음.
- 제안: `date.ts` 상단에 `"use client"` 추가 (이미 다른 리뷰에서 제안됨).

---

### 요약

이번 i18n 변경은 보안 관점에서 전반적으로 안전하게 구현되어 있다. `isLocale()` 타입 가드로 모든 외부 입력(localStorage, 사용자 프로필)이 화이트리스트 검증을 거치고, 보간 정규식이 `\w+`로 제한되어 인젝션 벡터가 구조적으로 차단된다. `dangerouslySetInnerHTML` 사용 없이 React 엘리먼트로 동적 콘텐츠를 삽입하는 점도 긍정적이다. 서버 오류 메시지 직접 노출은 기존부터 존재하던 정보 노출 위험이며, `date.ts`의 클라이언트 경계 부재는 SSR 런타임 예외를 유발할 수 있어 주의가 필요하다.

### 위험도
**LOW**